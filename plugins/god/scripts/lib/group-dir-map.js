#!/usr/bin/env node
"use strict";
/**
 * group-dir-map.js
 * 功能树 groupId → 目录名映射工具。
 * 输入 tree-context.json 的 functionTree.pages 结构，
 * 输出 { groupId: "groupId" } 映射表。
 *
 * 目录名直接使用 groupId（如 PRQL-FLTR），不拼接中文 slug。
 * groupId 由功能树定义，始终为英文，保证跨平台兼容。
 *
 * 用法（作为模块引入）：
 *   const { buildGroupDirMap } = require('./lib/group-dir-map');
 *   const map = buildGroupDirMap(treeContext.functionTree.pages);
 *
 * 或命令行测试：
 *   node group-dir-map.js --tree-context path/to/tree-context.json
 */
const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("./safe-json");

/**
 * 从功能树 pages 结构构建 groupId → 目录名映射。
 * 目录名直接使用 groupId（英文、唯一），禁止中文目录名。
 * 示例：groupId "PRQL-FLTR" → 目录名 "PRQL-FLTR"
 *
 * @param {Object} pages - tree-context.json 的 functionTree.pages 对象
 * @returns {Object} - { groupId: "groupId" } 映射表
 */
function buildGroupDirMap(pages) {
  if (!pages || typeof pages !== "object") return {};
  const map = {};
  for (const [pageId, page] of Object.entries(pages)) {
    for (const [groupId, group] of Object.entries(page.groups || {})) {
      // 目录名直接使用 groupId（英文），不拼接中文 group.name
      map[groupId] = groupId;
    }
  }
  return map;
}

/**
 * 从 tree-context.json 文件构建映射。
 *
 * @param {string} treeContextPath - tree-context.json 的文件路径
 * @returns {Object|null} - { groupId: "groupId" } 映射表，解析失败返回 null
 */
function buildGroupDirMapFromFile(treeContextPath) {
  if (!fs.existsSync(treeContextPath)) return null;
  const ctx = safeReadJson(treeContextPath, { fallback: null });
  if (ctx && ctx.functionTree && ctx.functionTree.pages) {
    return buildGroupDirMap(ctx.functionTree.pages);
  }
  return null;
}

// CLI 测试入口
if (require.main === module) {
  const args = process.argv.slice(2);
  let ctxPath = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tree-context" && args[i + 1]) ctxPath = args[++i];
  }
  if (!ctxPath) {
    console.error("Usage: node group-dir-map.js --tree-context <path>");
    process.exit(1);
  }
  const map = buildGroupDirMapFromFile(ctxPath);
  if (!map) {
    console.error("[FAIL] Cannot parse tree-context.json or no functionTree found");
    process.exit(1);
  }
  console.log(JSON.stringify(map, null, 2));
}

module.exports = { buildGroupDirMap, buildGroupDirMapFromFile };
