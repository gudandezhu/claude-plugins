#!/usr/bin/env node
"use strict";
/**
 * validate-feature-tree.js — T1.3
 * 功能树格式校验：缩进层级、编号格式、引用有效性、编号唯一性、
 * deprecatedIds 冲突、流程循环引用检测
 *
 * 用法: node validate-feature-tree.js --dir <feature-tree-dir>
 */
const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("../lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let dir = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" && argv[i + 1]) dir = argv[++i];
  }
  if (!dir) { console.error("[FAIL] --dir is required"); process.exit(1); }
  return { dir };
}

const ABBREV_PATTERN = /^[A-Z]{2,6}$/;
const GROUP_PATTERN = /^[A-Z]{2,6}-[A-Z]{2,6}$/;
const FEAT_PATTERN = /^[A-Z]{2,6}-[A-Z]{2,6}-[A-Z]{2,6}$/;
const FLOW_PATTERN = /^F-[A-Z][A-Z0-9]{2,10}$/;
const REF_PATTERN = /^\{##([A-Z][A-Z0-9-]+)\}/;

function validate(dir) {
  const errors = [];
  const warnings = [];
  const allIds = new Set();
  const allRefs = []; // { ref, file, line }
  const flowSteps = {}; // flowId -> [stepId]

  // Load index.json if exists (for deprecatedIds check)
  const indexPath = path.join(dir, "index.json");
  let deprecatedIds = [];
  if (fs.existsSync(indexPath)) {
    const idx = safeReadJson(indexPath, { fallback: null });
    if (idx) {
      deprecatedIds = idx.deprecatedIds || [];
    }
  }

  const mdFiles = fs.readdirSync(dir).filter(f => f.endsWith(".md") && f !== "README.md");
  if (mdFiles.length === 0) {
    errors.push("[FAIL] No .md files found in " + dir);
    return { errors, warnings };
  }

  for (const file of mdFiles) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const lines = content.split("\n");
    let hasPage = false;
    let currentFlowId = null;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].replace(/\r$/, "");
      const lineNum = i + 1;
      const match = raw.match(/^(\s*)- (.+)$/);
      if (!match) continue;

      const indent = match[1].length;
      const text = match[2].replace(/@smoke\b/, "").replace(/@infra-dep:\S+/g, "").trim();

      // Level 0: Page
      if (indent === 0) {
        const pm = text.match(/^([A-Z]{2,6})\s+/);
        if (!pm) {
          errors.push(`[FAIL] ${file}:${lineNum}: Page abbreviation must be 2-6 uppercase letters`);
        } else {
          hasPage = true;
          const pageId = pm[1];
          if (allIds.has(pageId)) errors.push(`[FAIL] ${file}:${lineNum}: Duplicate page ID "${pageId}"`);
          allIds.add(pageId);
        }
        currentFlowId = null;
        continue;
      }

      // Level 1: Group
      if (indent === 2) {
        const gm = text.match(/^([A-Z][A-Z0-9-]+)\s+/);
        if (!gm) {
          errors.push(`[FAIL] ${file}:${lineNum}: Expected feature group ID (e.g. PAGE-GROUP)`);
        } else {
          const gid = gm[1];
          if (!GROUP_PATTERN.test(gid) && gid.split("-").length < 2) {
            warnings.push(`[WARN] ${file}:${lineNum}: Group ID "${gid}" may not follow PAGE-GROUP pattern`);
          }
          if (allIds.has(gid)) errors.push(`[FAIL] ${file}:${lineNum}: Duplicate group ID "${gid}"`);
          allIds.add(gid);
        }
        currentFlowId = null;
        continue;
      }

      // Level 2+: Feature / Flow / Ref
      if (indent >= 4) {
        // Flow step reference
        const refM = text.match(REF_PATTERN);
        if (refM) {
          allRefs.push({ ref: refM[1], file, line: lineNum });
          if (currentFlowId) {
            if (!flowSteps[currentFlowId]) flowSteps[currentFlowId] = [];
            flowSteps[currentFlowId].push(refM[1]);
          }
          continue;
        }

        // Flow definition
        const flowM = text.match(/^(F-[A-Z][A-Z0-9]{2,10})\s+/);
        if (flowM) {
          const fid = flowM[1];
          if (allIds.has(fid)) errors.push(`[FAIL] ${file}:${lineNum}: Duplicate flow ID "${fid}"`);
          if (deprecatedIds.includes(fid)) errors.push(`[FAIL] ${file}:${lineNum}: Flow ID "${fid}" conflicts with deprecated ID`);
          allIds.add(fid);
          currentFlowId = fid;
          flowSteps[fid] = [];
          continue;
        }

        // Atomic feature
        const featM = text.match(/^([A-Z][A-Z0-9-]{4,20})\s+/);
        if (featM) {
          const fid = featM[1];
          if (allIds.has(fid)) errors.push(`[FAIL] ${file}:${lineNum}: Duplicate feature ID "${fid}"`);
          if (deprecatedIds.includes(fid)) errors.push(`[FAIL] ${file}:${lineNum}: Feature ID "${fid}" conflicts with deprecated ID`);
          allIds.add(fid);
          currentFlowId = null;
        }
      }
    }

    if (!hasPage) {
      errors.push(`[FAIL] ${file}: No page definition found (expected "- PAGE Name /route")`);
    }
  }

  // Check {##} references resolve to known IDs
  for (const { ref, file, line } of allRefs) {
    if (!allIds.has(ref)) {
      errors.push(`[FAIL] ${file}:${line}: Reference {##${ref}} not found in any feature tree`);
    }
  }

  // Circular reference detection in flows
  const flowIds = Object.keys(flowSteps);
  for (const startFlow of flowIds) {
    const visited = new Set();
    const stack = [startFlow];
    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current)) {
        errors.push(`[FAIL] Circular flow reference detected: ${startFlow} → ... → ${current}`);
        break;
      }
      visited.add(current);
      const steps = flowSteps[current] || [];
      for (const step of steps) {
        if (step.startsWith("F-") && flowSteps[step]) {
          stack.push(step);
        }
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const { dir } = parseArgs();
  if (!fs.existsSync(dir)) {
    console.error(`[FAIL] Directory not found: ${dir}`);
    process.exit(1);
  }

  const { errors, warnings } = validate(dir);

  for (const w of warnings) console.log(w);
  for (const e of errors) console.log(e);

  if (errors.length === 0) {
    console.log(`[OK] Feature tree validation passed (${warnings.length} warnings)`);
    process.exit(0);
  } else {
    console.log(`[FAIL] Feature tree validation failed: ${errors.length} errors, ${warnings.length} warnings`);
    process.exit(1);
  }
}

main();
