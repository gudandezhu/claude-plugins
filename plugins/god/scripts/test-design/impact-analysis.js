#!/usr/bin/env node
"use strict";
/**
 * impact-analysis.js — T2.1
 * 功能树驱动的影响分析：功能编号 → 功能组 → features/ 目录 + flows/ 递归查找
 * 支持 changeType 判断（feature / infra）
 *
 * 用法:
 *   node impact-analysis.js --index <index.json> --features "PRQL-FLTR-KW,PRQE-LINE-ADD" [--infra-patterns <patterns>]
 *   node impact-analysis.js --index <index.json> --proposal <proposal.md> [--infra-patterns <patterns>]
 *
 * 输出: JSON 到 stdout
 *   {
 *     changeType: "feature" | "infra",
 *     affectedFeatures: [...],
 *     affectedGroups: [...],
 *     affectedFlows: [...],
 *     directGroups: [...],
 *     indirectFlows: [...],
 *     featureDetails: { groupId: { name, page, pageRoute, features: [...] } }
 *   }
 */
const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("../lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let indexPath = "", features = "", proposal = "", infraPatterns = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--index" && argv[i + 1]) indexPath = argv[++i];
    if (argv[i] === "--features" && argv[i + 1]) features = argv[++i];
    if (argv[i] === "--proposal" && argv[i + 1]) proposal = argv[++i];
    if (argv[i] === "--infra-patterns" && argv[i + 1]) infraPatterns = argv[++i];
  }
  if (!indexPath) { console.error("[FAIL] --index is required"); process.exit(1); }
  return { indexPath, features, proposal, infraPatterns };
}

/**
 * Extract feature IDs from a proposal markdown file.
 * Looks for lines like: - PRQL-FLTR-KW ... or - F-PRQNEW ...
 */
function extractFeaturesFromProposal(proposalPath) {
  if (!fs.existsSync(proposalPath)) return [];
  const content = fs.readFileSync(proposalPath, "utf-8");
  const ids = [];
  const featPattern = /^\s*-\s+([A-Z][A-Z0-9-]{4,20})\s+/gm;
  const flowPattern = /^\s*-\s+(F-[A-Z][A-Z0-9]{2,10})\s+/gm;
  let m;
  while ((m = featPattern.exec(content)) !== null) ids.push(m[1]);
  while ((m = flowPattern.exec(content)) !== null) ids.push(m[1]);
  return ids;
}

/**
 * Check if changed file paths match infra patterns.
 * infraPatterns: comma-separated glob-like patterns (e.g. "src/components/common/**,src/config/**")
 */
function detectInfraChange(changedFiles, infraPatterns) {
  if (!infraPatterns || !changedFiles || changedFiles.length === 0) return false;
  const patterns = infraPatterns.split(",").map(p => p.trim()).filter(Boolean);
  if (patterns.length === 0) return false;

  for (const file of changedFiles) {
    for (const pattern of patterns) {
      const regex = new RegExp("^" + pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
      if (regex.test(file)) return true;
    }
  }
  return false;
}

/**
 * Core impact analysis: feature IDs → groups → flows (recursive with cycle protection)
 */
function analyzeImpact(affectedFeatures, index) {
  const result = {
    directGroups: new Set(),
    indirectFlows: new Set(),
    allGroups: new Set(),
  };
  const visited = new Set(); // cycle protection

  // 1. Direct impact: feature ID → group → features/ directory
  for (const feat of affectedFeatures) {
    const info = index.featureIndex[feat];
    if (info) {
      result.directGroups.add(info.group);
      result.allGroups.add(info.group);
    }
  }

  // 2. Indirect impact: find flows referencing affected features/groups
  const affectedSet = new Set(affectedFeatures);

  function findAffectedFlows() {
    for (const [flowId, flow] of Object.entries(index.flows || {})) {
      if (visited.has(flowId)) continue;
      const hasAffectedStep = (flow.steps || []).some(step => {
        if (affectedSet.has(step)) return true;
        const stepInfo = index.featureIndex[step];
        return stepInfo && result.allGroups.has(stepInfo.group);
      });
      if (hasAffectedStep) {
        visited.add(flowId);
        result.indirectFlows.add(flowId);
        // Recursive: find parent flows referencing this flow
        findFlowsReferencingFlow(flowId);
      }
    }
  }

  function findFlowsReferencingFlow(targetFlowId) {
    for (const [flowId, flow] of Object.entries(index.flows || {})) {
      if (visited.has(flowId)) continue;
      const referencesTarget = (flow.steps || []).some(step => step === targetFlowId);
      if (referencesTarget) {
        visited.add(flowId);
        result.indirectFlows.add(flowId);
        findFlowsReferencingFlow(flowId); // continue upward
      }
    }
  }

  findAffectedFlows();

  // 3. Implicit impact: all features in affected groups
  const implicitFeatures = new Set(affectedFeatures);
  for (const groupId of result.allGroups) {
    for (const [pageId, page] of Object.entries(index.pages || {})) {
      const group = (page.groups || {})[groupId];
      if (group) {
        for (const feat of group.features || []) {
          implicitFeatures.add(feat);
        }
      }
    }
  }

  return {
    directGroups: [...result.directGroups],
    indirectFlows: [...result.indirectFlows],
    allGroups: [...result.allGroups],
    allFeatures: [...implicitFeatures],
  };
}

/**
 * Build feature details for each affected group (name, page, route, features list)
 */
function buildFeatureDetails(groups, index) {
  const details = {};
  for (const groupId of groups) {
    for (const [pageId, page] of Object.entries(index.pages || {})) {
      const group = (page.groups || {})[groupId];
      if (group) {
        details[groupId] = {
          name: group.name,
          page: pageId,
          pageRoute: page.route,
          features: group.features || [],
        };
        break;
      }
    }
  }
  return details;
}

function main() {
  const { indexPath, features, proposal, infraPatterns } = parseArgs();

  if (!fs.existsSync(indexPath)) {
    console.error(`[FAIL] Index file not found: ${indexPath}`);
    process.exit(1);
  }

  const index = safeReadJson(indexPath);

  // Support tree-context.json format (wrapped in functionTree key)
  const resolvedIndex = index.functionTree && index.status ? index.functionTree : index;

  // Collect affected feature IDs
  let featureIds = [];
  if (features) {
    featureIds = features.split(",").map(f => f.trim()).filter(Boolean);
  }
  if (proposal) {
    featureIds = featureIds.concat(extractFeaturesFromProposal(proposal));
  }

  // Deduplicate
  featureIds = [...new Set(featureIds)];

  if (featureIds.length === 0) {
    console.error("[FAIL] No feature IDs provided. Use --features or --proposal");
    process.exit(1);
  }

  // Validate feature IDs exist in index
  const unknownIds = featureIds.filter(id =>
    !resolvedIndex.featureIndex[id] && !resolvedIndex.flows[id]
  );

  // Run impact analysis
  const impact = analyzeImpact(featureIds, resolvedIndex);

  // Determine changeType (default: feature; infra detection is advisory)
  const changeType = "feature"; // infra detection requires changedFiles from git diff, handled by caller

  const output = {
    changeType,
    inputFeatures: featureIds,
    unknownIds,
    affectedFeatures: impact.allFeatures,
    affectedGroups: impact.allGroups,
    directGroups: impact.directGroups,
    affectedFlows: impact.indirectFlows,
    featureDetails: buildFeatureDetails(impact.allGroups, resolvedIndex),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
