#!/usr/bin/env node
"use strict";

// PostToolUse hook: PRD file edited → detect sibling artifacts → suggest sync
// Script filters: .md + basename contains "prd" + sibling artifacts exist
// This script searches for derived artifacts (AC, function-tree, menu-tree) nearby

const fs = require("fs");
const path = require("path");

// DEBUG: log every invocation to verify hook fires
const debugLog = path.join(require("os").tmpdir(), "prd-sync-debug.log");
let input;
try {
  const raw = fs.readFileSync(0, "utf-8");
  fs.appendFileSync(debugLog, `[${new Date().toISOString()}] invoked, raw=${raw.substring(0, 200)}\n`);
  input = JSON.parse(raw);
} catch (e) {
  try { fs.appendFileSync(debugLog, `[${new Date().toISOString()}] parse error: ${e.message}\n`); } catch(_) {}
  process.exit(0);
}

const filePath = (input.tool_input && input.tool_input.file_path) || "";
if (!filePath) process.exit(0);

// Only .md files
if (!filePath.toLowerCase().endsWith(".md")) process.exit(0);

// Filename must contain "prd" (not directory name — only check basename)
const basename = filePath.replace(/\\/g, "/").split("/").pop().toLowerCase();
if (!basename.includes("prd")) process.exit(0);

const dir = path.dirname(filePath);
const parentDir = path.dirname(dir);

// Search for derived artifacts in given directories
function findInDirs(dirs, names) {
  for (const d of dirs) {
    for (const n of names) {
      try {
        if (fs.existsSync(path.join(d, n))) return path.join(d, n);
      } catch (_) { /* skip */ }
    }
  }
  return null;
}

const searchDirs = [dir, parentDir];

const ac = findInDirs(searchDirs, ["12-ac.md", "ac.md"]);
const ft = findInDirs(searchDirs, ["10-function-tree.md"]);
const mt = findInDirs(searchDirs, ["11-menu-tree.md"]);

// Must have at least 1 artifact to suggest sync
if (!ac && !ft && !mt) process.exit(0);

const normalized = filePath.replace(/\\/g, "/");
const lines = [
  `[prd-sync] PRD文件已修改: ${normalized}`,
  "关联产物:",
];

if (ac) lines.push(`  AC: ${ac.replace(/\\/g, "/")}`);
if (ft) lines.push(`  功能树: ${ft.replace(/\\/g, "/")}`);
if (mt) lines.push(`  菜单树: ${mt.replace(/\\/g, "/")}`);

lines.push("");
lines.push("如为需求变更，建议以PRD为准同步更新关联产物:");
lines.push("- 比对PRD与AC → 补充缺失/删除过期/修复冲突");
lines.push("- 同步功能树和菜单树的增量标注");
lines.push("如仅为格式微调，可忽略。");

console.error(lines.join("\n"));
process.exit(0);
