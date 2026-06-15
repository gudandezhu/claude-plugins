#!/usr/bin/env node
/**
 * merge-parts.js
 * 确定性合并同章节的 JSON 分片：重编号 id、合并 test_cases、删除 part 文件。
 *
 * 用法：
 *   node merge-parts.js --testing-dir <path> [--types e2e,api,flow]
 *
 * 输入：test-cases/{type}/{slug}-{part}.json（分片文件）
 * 输出：test-cases/{type}/{slug}.json（合并后文件）
 *
 * 退出码：0 = 成功，1 = 失败
 */
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_TYPES = ["e2e", "api", "flow"];

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { testingDir: null, types: DEFAULT_TYPES };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) args.testingDir = argv[++i];
    if (argv[i] === "--types" && argv[i + 1]) args.types = argv[++i].split(",").map(t => t.trim()).filter(Boolean);
  }
  return args;
}

/**
 * 从 part 文件名提取基名和 part 编号。
 * "payment-1.json" → { base: "payment", part: 1 }
 * "bank-config.json" → { base: "bank-config", part: 0 }（无 part 后缀）
 */
function parsePartName(filename) {
  const name = filename.replace(/\.json$/, "");
  const match = name.match(/^(.+)-(\d+)$/);
  if (match) {
    return { base: match[1], part: parseInt(match[2], 10) };
  }
  return { base: name, part: 0 };
}

/**
 * 重编号 id，保持前缀+模块部分不变，只改数字部分。
 * "FE-PAY-001" → "FE-PAY-001"（counter=1）
 * "FE-PAY-005" → "FE-PAY-002"（counter=2）
 * "API-BC-001-S01" → "API-BC-001-S01"（子步骤不变）
 */
function renumberId(id, counter) {
  // 匹配 xxx-NUM 或 xxx-NUM-Sxx 模式
  const subStepMatch = id.match(/^(.+?)-(\d{3})(-[A-Z]\d{2})$/);
  if (subStepMatch) {
    // 子步骤（如 FE-PAY-001-S01）：只改主编号，保留子步骤
    return `${subStepMatch[1]}-${String(counter).padStart(3, "0")}${subStepMatch[3]}`;
  }
  const mainMatch = id.match(/^(.+?)-(\d{3})$/);
  if (mainMatch) {
    return `${mainMatch[1]}-${String(counter).padStart(3, "0")}`;
  }
  // 无法匹配模式，原样返回
  return id;
}

/**
 * 合并单个 type 目录下的分片文件。
 * @returns {{ type: string, fileCount: number, caseCount: number }}
 */
function mergeType(testingDir, type) {
  const typeDir = path.join(testingDir, "test-cases", type);

  if (!fs.existsSync(typeDir)) {
    return { type, fileCount: 0, caseCount: 0, skipped: true };
  }

  const allFiles = fs.readdirSync(typeDir).filter(f => f.endsWith(".json") && !f.startsWith("_"));

  // 按基名分组
  const groups = {};
  for (const f of allFiles) {
    const { base, part } = parsePartName(f);
    if (!groups[base]) groups[base] = [];
    groups[base].push({ filename: f, part });
  }

  let totalCases = 0;
  let fileCount = 0;

  for (const [base, parts] of Object.entries(groups)) {
    // 按 part 编号排序
    parts.sort((a, b) => a.part - b.part);

    if (parts.length === 1 && parts[0].part === 0) {
      // 单文件无 part 后缀，不需要合并
      try {
        const data = JSON.parse(fs.readFileSync(path.join(typeDir, parts[0].filename), "utf-8"));
        totalCases += (data.test_cases || []).length;
        fileCount++;
      } catch (_e) {
        // 跳过解析失败的文件
      }
      continue;
    }

    // 多 part 合并
    const merged = {
      feature: "",
      version: "v1",
      generatedAt: new Date().toISOString().slice(0, 10),
      source_section: "",
      test_cases: [],
    };

    // 收集子步骤映射（用于重编号主 id 时同步调整子步骤）
    let mainCounter = 0;
    const subCounters = {};

    for (const p of parts) {
      const filePath = path.join(typeDir, p.filename);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (data.feature) merged.feature = data.feature;
        if (data.source_section) merged.source_section = data.source_section;
        if (data.version) merged.version = data.version;

        for (const tc of data.test_cases || []) {
          mainCounter++;

          // 检查是否是子步骤（如 FE-PAY-001-S01）
          const subMatch = tc.id.match(/^(.+?-\d{3})-([A-Z]\d{2})$/);
          if (subMatch) {
            const parentBase = subMatch[1];
            if (!subCounters[parentBase]) subCounters[parentBase] = { main: mainCounter, sub: {} };
            const subIdx = subMatch[2];
            if (!subCounters[parentBase].sub[subIdx]) {
              subCounters[parentBase].sub[subIdx] = Object.keys(subCounters[parentBase].sub).length + 1;
            }
            tc.id = renumberId(tc.id, subCounters[parentBase].main);
          } else {
            tc.id = renumberId(tc.id, mainCounter);
          }

          merged.test_cases.push(tc);
        }

        // 删除 part 文件
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error(`[WARN] 跳过损坏文件: ${p.filename} — ${e.message}`);
      }
    }

    // 写入合并文件
    const mergedPath = path.join(typeDir, `${base}.json`);
    fs.writeFileSync(mergedPath, JSON.stringify(merged, null, 2), "utf-8");
    totalCases += merged.test_cases.length;
    fileCount++;
  }

  return { type, fileCount, caseCount: totalCases };
}

function main() {
  const args = parseArgs();
  if (!args.testingDir) {
    console.error("[FAIL] 缺少 --testing-dir 参数");
    process.exit(1);
  }

  const results = [];
  for (const type of args.types) {
    const result = mergeType(args.testingDir, type);
    results.push(result);
  }

  const output = {
    types: results,
    totalCases: results.reduce((s, r) => s + r.caseCount, 0),
    totalFiles: results.reduce((s, r) => s + r.fileCount, 0),
  };

  console.log(JSON.stringify(output));
}

main();
