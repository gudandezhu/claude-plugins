#!/usr/bin/env node
"use strict";
/**
 * gen-test-readme.js — T2.8
 * 自动生成/更新每个功能目录下的 TEST-README.md
 *
 * 用法:
 *   node gen-test-readme.js --project-dir <project-dir> --tree-index <index.json>
 *
 * 从 test-meta.json + feature-tree/index.json 自动生成，不需要人工维护。
 */
const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("../lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let projectDir = "", treeIndex = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project-dir" && argv[i + 1]) projectDir = argv[++i];
    if (argv[i] === "--tree-index" && argv[i + 1]) treeIndex = argv[++i];
  }
  if (!projectDir) { console.error("[FAIL] --project-dir is required"); process.exit(1); }
  if (!treeIndex) { console.error("[FAIL] --tree-index is required"); process.exit(1); }
  return { projectDir, treeIndex };
}

function generateReadme(meta, indexFragment, dirType) {
  const lines = [];
  const groupId = meta.group || "UNKNOWN";
  const groupName = meta.groupName || "";
  const pageId = meta.page || "";
  const pageRoute = meta.pageRoute || "";
  const projectGroup = meta.projectGroup || "";
  const lastReq = meta.lastUpdated?.requirement || "";
  const lastDate = meta.lastUpdated?.date || "";

  lines.push(`# ${groupId} ${groupName}`);
  lines.push(``);
  if (pageId) lines.push(`> 页面: ${pageId} ${pageRoute}`);
  if (projectGroup) lines.push(`> 项目组: ${projectGroup}`);
  if (lastReq) lines.push(`> 最后更新: ${lastReq} (${lastDate})`);
  lines.push(``);

  // Script list
  const scripts = meta.scripts || [];
  if (scripts.length > 0) {
    lines.push(`## 脚本列表`);
    lines.push(``);
    lines.push(`| 脚本 | 类型 | 说明 |`);
    lines.push(`|------|------|------|`);
    for (const s of scripts) {
      lines.push(`| ${s.file} | ${s.type || "e2e"} | ${s.description || groupName + "测试"} |`);
    }
    lines.push(``);
  }

  // API scripts
  const apiScripts = meta.apiScripts || [];
  if (apiScripts.length > 0) {
    lines.push(`## 关联 API 测试`);
    lines.push(``);
    lines.push(`| 脚本 | 位置 |`);
    lines.push(`|------|------|`);
    for (const s of apiScripts) {
      lines.push(`| ${path.basename(s)} | ${path.dirname(s)} |`);
    }
    lines.push(``);
  }

  // Quick run command
  lines.push(`## 快速执行`);
  lines.push(``);
  if (dirType === "feature") {
    lines.push("```bash");
    lines.push(`npx playwright test tests/e2e/features/${groupId}/`);
    lines.push("```");
  } else if (dirType === "flow") {
    lines.push("```bash");
    lines.push(`npx playwright test tests/e2e/flows/`);
    lines.push(`npx vitest run tests/api/flows/`);
    lines.push("```");
  }
  lines.push(``);

  return lines.join("\n");
}

function main() {
  const { projectDir, treeIndex } = parseArgs();

  let index = {};
  if (fs.existsSync(treeIndex)) {
    index = safeReadJson(treeIndex, { fallback: {} });
  }

  let generated = 0;

  // Process features/ directories
  const featuresDir = path.join(projectDir, "features");
  if (fs.existsSync(featuresDir)) {
    for (const dir of fs.readdirSync(featuresDir)) {
      const metaPath = path.join(featuresDir, dir, "test-meta.json");
      if (!fs.existsSync(metaPath)) continue;
      const meta = safeReadJson(metaPath, { fallback: null });
      if (!meta) continue;
      const readme = generateReadme(meta, index, "feature");
      fs.writeFileSync(path.join(featuresDir, dir, "TEST-README.md"), readme, "utf-8");
      generated++;
    }
  }

  // Process flows/ directories
  const flowsDir = path.join(projectDir, "flows");
  if (fs.existsSync(flowsDir)) {
    for (const dir of fs.readdirSync(flowsDir)) {
      const metaPath = path.join(flowsDir, dir, "test-meta.json");
      if (!fs.existsSync(metaPath)) continue;
      const meta = safeReadJson(metaPath, { fallback: null });
      if (!meta) continue;
      const readme = generateReadme(meta, index, "flow");
      fs.writeFileSync(path.join(flowsDir, dir, "TEST-README.md"), readme, "utf-8");
      generated++;
    }
  }

  console.log(`[OK] Generated ${generated} TEST-README.md files`);
}

main();
