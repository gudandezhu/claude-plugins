#!/usr/bin/env node
"use strict";
/**
 * workspace-check.js — 工作空间检测工具 (合并版)
 *
 * 合并自: detect-testing-repo.js + check-orphan-scripts.js
 *
 * 用法 (根据参数自动选择模式):
 *   node workspace-check.js --config <test-config.json>                         → 探测 testing repo
 *   node workspace-check.js --project-dir <dir> --tree-index <index.json>       → 孤儿脚本检测
 */
const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("../lib/safe-json");

// ═══════════════════════════════════════════════════════════════
// Mode 1: detect-testing-repo
// ═══════════════════════════════════════════════════════════════

function modeDetectTestingRepo(cfgPath) {
  const ws = process.env.JLC_AI_WORKSPACE || "";
  if (!ws) { console.log(JSON.stringify({ error: "NO_WORKSPACE" })); process.exit(0); }

  const REPO_NAME = "biz-test-regression";
  const repoPath = path.join(ws, REPO_NAME);
  if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, ".git"))) {
    console.log(JSON.stringify({ error: "NO_TESTING_REPO_FOUND" }));
    process.exit(0);
  }

  const testingRepo = {
    path: repoPath.replace(ws, "$JLC_AI_WORKSPACE"),
    repoUrl: "",
    branch: "",
  };

  try {
    const { execSync } = require("child_process");
    testingRepo.repoUrl = execSync("git remote get-url origin", { cwd: repoPath, encoding: "utf-8" }).trim();
  } catch (e) { /* ignore */ }

  if (cfgPath && fs.existsSync(cfgPath)) {
    const cfg = safeReadJson(cfgPath, { fallback: null });
    if (cfg) {
      // 检测旧格式并提醒
      const old = cfg.testingRepo;
      if (old && old.path && !old.path.includes(REPO_NAME)) {
        console.error("[WARN] 检测到旧格式 testingRepo 配置，正在修正...");
        console.error(`[WARN] 请将测试仓库重命名为 ${REPO_NAME}，路径: ${repoPath}`);
      }
      cfg.testingRepo = testingRepo;
      const tmpPath = cfgPath + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify(cfg, null, 2));
      fs.renameSync(tmpPath, cfgPath);
    }
  }

  console.log(JSON.stringify(testingRepo));
}

// ═══════════════════════════════════════════════════════════════
// Mode 2: check-orphan-scripts
// ═══════════════════════════════════════════════════════════════

function extractGroupId(dirName) {
  const match = dirName.match(/^([A-Z][A-Z0-9-]+)_/);
  return match ? match[1] : dirName;
}

function extractFlowId(dirName) {
  const match = dirName.match(/^(F-[A-Z][A-Z0-9]+)_/);
  return match ? match[1] : dirName;
}

function modeCheckOrphanScripts(projectDir, treeIndexPath) {
  if (!fs.existsSync(treeIndexPath)) { console.error(`[FAIL] Index file not found: ${treeIndexPath}`); process.exit(1); }

  const index = safeReadJson(treeIndexPath);
  const validGroups = new Set();
  for (const page of Object.values(index.pages || {})) {
    for (const groupId of Object.keys(page.groups || {})) validGroups.add(groupId);
  }
  const validFlows = new Set(Object.keys(index.flows || {}));
  const deprecatedIds = new Set(index.deprecatedIds || []);

  const orphanFeatures = [], orphanFlows = [];

  const featuresDir = path.join(projectDir, "features");
  if (fs.existsSync(featuresDir)) {
    for (const dir of fs.readdirSync(featuresDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const groupId = extractGroupId(dir.name);
      if (!validGroups.has(groupId)) {
        orphanFeatures.push({ directory: `features/${dir.name}`, groupId, reason: deprecatedIds.has(groupId) ? "deprecated" : "not-in-tree" });
      }
    }
  }

  const flowsDir = path.join(projectDir, "flows");
  if (fs.existsSync(flowsDir)) {
    for (const dir of fs.readdirSync(flowsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const flowId = extractFlowId(dir.name);
      if (!validFlows.has(flowId)) {
        orphanFlows.push({ directory: `flows/${dir.name}`, flowId, reason: deprecatedIds.has(flowId) ? "deprecated" : "not-in-tree" });
      }
    }
  }

  const totalOrphans = orphanFeatures.length + orphanFlows.length;
  console.log(JSON.stringify({ orphanFeatures, orphanFlows, totalOrphans }, null, 2));

  if (totalOrphans > 0) {
    console.error(`\n[WARN] Found ${totalOrphans} orphan directories:`);
    for (const o of orphanFeatures) console.error(`  ${o.directory} (${o.groupId}: ${o.reason})`);
    for (const o of orphanFlows) console.error(`  ${o.directory} (${o.flowId}: ${o.reason})`);
    process.exit(1);
  } else {
    console.error("\n[OK] No orphan scripts found");
  }
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

function main() {
  const argv = process.argv.slice(2);
  let config = "", projectDir = "", treeIndex = "";

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config" && argv[i + 1]) config = argv[++i];
    if (argv[i] === "--project-dir" && argv[i + 1]) projectDir = argv[++i];
    if (argv[i] === "--tree-index" && argv[i + 1]) treeIndex = argv[++i];
  }

  if (projectDir && treeIndex) {
    modeCheckOrphanScripts(projectDir, treeIndex);
  } else if (config) {
    modeDetectTestingRepo(config);
  } else {
    console.error("用法:");
    console.error("  node workspace-check.js --config <test-config.json>");
    console.error("  node workspace-check.js --project-dir <dir> --tree-index <index.json>");
    process.exit(1);
  }
}

main();
