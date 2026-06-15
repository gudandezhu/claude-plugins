#!/usr/bin/env node
"use strict";
/**
 * case-hash.js — T2.5
 * AC 变更检测：计算案例文档对应功能组片段的规范化 hash。
 * 用于 test-meta.json 的 lastCaseHash 字段对比，判断是否需要重新生成脚本。
 *
 * 用法:
 *   node lib/case-hash.js --cases <cases.md> --group <GROUP_ID> [--meta <test-meta.json>]
 *
 * 规范化规则（避免格式变化导致误判）：
 *   ① trim 每行首尾空白
 *   ② 合并连续空行为单空行
 *   ③ 统一全角/半角标点（，→,  ：→:  ；→;）
 *   ④ 提取 TC 编号 + AC 编号 + 案例描述三列，忽略其他列
 *   ⑤ 对提取结果排序后再 hash（防止 TC 重排序误判）
 *
 * 输出: JSON { hash, changed, lastHash }
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { safeReadJson } = require("./safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let cases = "", group = "", meta = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cases" && argv[i + 1]) cases = argv[++i];
    if (argv[i] === "--group" && argv[i + 1]) group = argv[++i];
    if (argv[i] === "--meta" && argv[i + 1]) meta = argv[++i];
  }
  if (!cases) { console.error("[FAIL] --cases is required"); process.exit(1); }
  if (!group) { console.error("[FAIL] --group is required"); process.exit(1); }
  return { cases, group, meta };
}

/**
 * Normalize text for semantic comparison:
 * - trim lines, collapse blank lines
 * - normalize punctuation (fullwidth → halfwidth)
 */
function normalize(text) {
  return text
    .split("\n")
    .map(l => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/，/g, ",")
    .replace(/：/g, ":")
    .replace(/；/g, ";")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/"|"/g, '"')
    .replace(/'|'/g, "'");
}

/**
 * Extract TC entries for a specific feature group from cases markdown.
 * Returns sorted array of "TC_ID|AC_IDS|DESCRIPTION" strings.
 */
function extractGroupCases(content, groupId) {
  const normalized = normalize(content);
  const entries = [];

  // Match TC entries in markdown tables or heading blocks
  // Table format: | TC编号 | 覆盖AC | 案例描述 | ...
  const tableRowPattern = /\|\s*((?:FE|API|FLOW)-[A-Z]+-\d{3}[^\|]*)\s*\|\s*([^\|]*)\s*\|\s*([^\|]*)\s*\|/g;
  let m;
  while ((m = tableRowPattern.exec(normalized)) !== null) {
    const tcId = m[1].trim();
    const acIds = m[2].trim();
    const desc = m[3].trim();
    entries.push(`${tcId}|${acIds}|${desc}`);
  }

  // Heading format: ### FE-XXX-001 描述
  const headingPattern = /###\s+((?:FE|API|FLOW)-[A-Z]+-\d{3}[^\n]*)/g;
  while ((m = headingPattern.exec(normalized)) !== null) {
    const line = m[1].trim();
    // Extract AC from nearby "覆盖AC" line
    const afterHeading = normalized.slice(m.index, m.index + 500);
    const acMatch = afterHeading.match(/覆盖\s*AC\s*[:：]\s*([\w\-,\s]+)/i);
    const acIds = acMatch ? acMatch[1].trim() : "";
    entries.push(`${line}|${acIds}`);
  }

  // Filter entries related to this group (by group ID prefix in TC ID)
  // e.g., group "PRQL-FLTR" matches TC IDs containing "FLTR"
  const groupShort = groupId.split("-").slice(1).join("-"); // PRQL-FLTR → FLTR
  const filtered = entries.filter(e => {
    const upper = e.toUpperCase();
    return upper.includes(groupId) || upper.includes(groupShort);
  });

  // Sort for deterministic hash
  filtered.sort();
  return filtered;
}

function computeHash(entries) {
  const content = entries.join("\n");
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex").slice(0, 12);
}

function main() {
  const { cases, group, meta } = parseArgs();

  if (!fs.existsSync(cases)) {
    console.error(`[FAIL] Cases file not found: ${cases}`);
    process.exit(1);
  }

  const content = fs.readFileSync(cases, "utf-8");
  const entries = extractGroupCases(content, group);
  const hash = computeHash(entries);

  // Compare with lastCaseHash from test-meta.json
  let lastHash = null;
  let changed = true;
  if (meta && fs.existsSync(meta)) {
    const metaData = safeReadJson(meta, { fallback: null });
    if (metaData) {
      lastHash = metaData.lastCaseHash || null;
      changed = lastHash !== hash;
    }
  }

  console.log(JSON.stringify({
    group,
    hash,
    lastHash,
    changed,
    entryCount: entries.length,
  }));
}

main();
