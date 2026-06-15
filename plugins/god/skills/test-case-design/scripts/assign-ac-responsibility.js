#!/usr/bin/env node
/**
 * assign-ac-responsibility.js
 * 解析 ac.md，将 AC 分为 coverable（全量共享）和 excluded（排除）。
 * 所有 coverable AC 对所有 subagent 可见，覆盖率只看全局。
 *
 * 用法：node assign-ac-responsibility.js --ac-file <ac.md路径> --output <输出路径> --scope <fullstack|frontend|backend>
 * 输出：ac-assignment.json (v2.0)
 */
"use strict";

const fs = require("fs");
const path = require("path");

// 排除前缀：规则定义类 + 非功能需求 + UI 样式规格
const EXCLUDED_PREFIXES = [
  "AC-RULE-",
  "AC-STS-",
  "AC-CALC-",
  "AC-FMT-",
  "AC-PERM-",
  "AC-NF-",
  "UI-ELEM-",
];

// UI 交互前缀（单独跟踪，分配给 E2E）
const UI_PREFIXES = ["UI-IXD-"];

// ── CLI 参数解析 ──────────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  let acFile = null;
  let output = null;
  let scope = "fullstack";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ac-file" && argv[i + 1]) acFile = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
    if (argv[i] === "--scope" && argv[i + 1]) scope = argv[++i];
  }
  if (!acFile) { console.error("[ERROR] --ac-file 参数必填"); process.exit(1); }
  if (!output) { console.error("[ERROR] --output 参数必填"); process.exit(1); }
  return { acFile, output, scope };
}

// ── AC 编号提取 ──────────────────────────────────────────────────
function extractAcIds(acContent) {
  const ids = new Set();
  const patterns = [
    /\b(AC-[A-Z]+-\d+[a-z]?)\b/g,
    /\b(UI-[A-Z]+-\d+[a-z]?)\b/g,
    /\b(AC-\d+[a-z]?)\b/g,
  ];
  for (const p of patterns) {
    let m;
    const pat = new RegExp(p.source, "g");
    while ((m = pat.exec(acContent)) !== null) {
      ids.add(m[1]);
    }
  }
  return [...ids];
}

// ── 分类 ────────────────────────────────────────────────────────
function isExcluded(id) {
  return EXCLUDED_PREFIXES.some(prefix => id.startsWith(prefix));
}

function isUi(id) {
  return UI_PREFIXES.some(prefix => id.startsWith(prefix));
}

// ── 主逻辑 ──────────────────────────────────────────────────────
function main() {
  const { acFile, output, scope } = parseArgs();

  if (!fs.existsSync(acFile)) {
    console.error(`[ERROR] ac.md 不存在: ${acFile}`);
    process.exit(1);
  }

  let acContent;
  try {
    acContent = fs.readFileSync(acFile, "utf-8");
  } catch (e) {
    console.error(`[ERROR] ac.md 读取失败: ${e.message}`);
    process.exit(1);
  }

  const allIds = extractAcIds(acContent);

  const coverableIds = [];
  const excludedIds = [];
  const uiIds = [];

  for (const id of allIds) {
    if (isExcluded(id)) {
      excludedIds.push(id);
    } else {
      coverableIds.push(id);
    }
    if (isUi(id) && !isExcluded(id)) {
      uiIds.push(id);
    }
  }

  const totalAc = allIds.length;
  const coverableCount = coverableIds.length;
  const excludedCount = excludedIds.length;

  const result = {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    acFilePath: path.resolve(acFile),
    scope,
    assignment: {
      coverable: { ids: coverableIds, count: coverableCount },
      excluded: { ids: excludedIds, count: excludedCount },
    },
    ui: { ids: uiIds, count: uiIds.length },
    summary: {
      totalAc,
      coverableCount,
      excludedCount,
      uiCount: uiIds.length,
    },
  };

  const outputDir = path.dirname(output);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2), "utf-8");

  console.log(`[OK] AC 分配完成 (v2.0 全量共享): ${output}`);
  console.log(`  总数: ${totalAc}, 可覆盖: ${coverableCount}, 排除: ${excludedCount}, UI交互: ${uiIds.length}`);
}

main();
