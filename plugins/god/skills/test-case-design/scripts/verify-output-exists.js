#!/usr/bin/env node
/**
 * verify-output-exists.js
 * 验证 subagent 产出文件的存在性和完整性
 *
 * 验证 JSON（case-designer 直接输出）+ MD（json-to-md.js 后处理生成）
 *
 * 用法：
 *   gen 模式:  node verify-output-exists.js --type <e2e|api|flow> --testing-dir <path>
 *   fix 模式:  node verify-output-exists.js --type <e2e|api|flow> --testing-dir <path>
 *              --mode fix [--pre-fix-backup <backup-file-path>]
 *   fix 模式下自动根据 --type 计算 .cache/backup/<filename>.pre-fix.bak 路径，
 *   --pre-fix-backup 可选，用于覆盖默认路径。
 * exit 0 = 通过，exit 1 = 失败（触发降级）
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { extractCoverageIds } = require("../../../scripts/lib/coverage-id-extractor");

const TYPE_TO_FILES = {
  e2e: { json: "test-cases/e2e-test-cases.json", md: "test-cases/e2e-test-cases.md", dir: "test-cases/e2e" },
  api: { json: "test-cases/api-test-cases.json", md: "test-cases/api-test-cases.md", dir: "test-cases/api" },
  flow: { json: "test-cases/api-flow-test-cases.json", md: "test-cases/api-flow-test-cases.md", dir: "test-cases/flow" },
};

const MIN_SIZE = 1024;

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { type: null, testingDir: null, mode: "gen", preFixBackup: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--type" && argv[i + 1]) args.type = argv[++i];
    if (argv[i] === "--testing-dir" && argv[i + 1]) args.testingDir = argv[++i];
    if (argv[i] === "--mode" && argv[i + 1]) args.mode = argv[++i];
    if (argv[i] === "--pre-fix-backup" && argv[i + 1]) args.preFixBackup = argv[++i];
  }
  return args;
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function main() {
  const args = parseArgs();

  if (!args.type || !TYPE_TO_FILES[args.type]) {
    fail(`无效的 type 参数: ${args.type}（可选: e2e, api, flow）`);
  }
  if (!args.testingDir) {
    fail("缺少 --testing-dir 参数");
  }

  const files = TYPE_TO_FILES[args.type];

  // ── Split 目录优先，fallback 到单文件 ──
  const splitDir = path.join(args.testingDir, files.dir);
  const useSplit = fs.existsSync(splitDir);

  if (useSplit) {
    // Split 模式：glob 目录下所有 JSON/MD
    const jsonFiles = fs.readdirSync(splitDir).filter(f => f.endsWith(".json") && !f.startsWith("_"));
    const mdFiles = fs.readdirSync(splitDir).filter(f => f.endsWith(".md") && !f.startsWith("_"));

    if (jsonFiles.length === 0) fail(`split 目录无 JSON 文件: ${splitDir}`);
    if (mdFiles.length === 0) fail(`split 目录无 MD 文件（json-to-md.js 未执行？）: ${splitDir}`);

    let totalCases = 0;
    const MARKERS = {
      e2e:  /^###+\s*FE-/m,
      api:  /^###+\s*API-/m,
      flow: /^###+\s*FLOW-/m,
    };
    const marker = MARKERS[args.type];
    let mdCaseCount = 0;

    for (const jf of jsonFiles) {
      const jp = path.join(splitDir, jf);
      try {
        const d = JSON.parse(fs.readFileSync(jp, "utf-8"));
        if (!d.test_cases || !Array.isArray(d.test_cases)) fail(`JSON 缺少 test_cases: ${jf}`);
        if (d.test_cases.length === 0) fail(`JSON test_cases 为空: ${jf}`);
        totalCases += d.test_cases.length;
      } catch (e) {
        fail(`JSON 解析失败: ${jf} — ${e.message}`);
      }
    }

    for (const mf of mdFiles) {
      const mp = path.join(splitDir, mf);
      const content = fs.readFileSync(mp, "utf-8");
      mdCaseCount += (content.match(new RegExp(marker.source, "gm")) || []).length;
    }

    if (totalCases === 0) fail("所有 JSON 的 test_cases 为空");

    console.log(
      `[OK] ${args.type} split 产出验证通过: ${jsonFiles.length} JSON (${totalCases} cases), ${mdFiles.length} MD (${mdCaseCount} markers)`
    );
  } else {
    // 单文件模式（向后兼容）
    const jsonPath = path.join(args.testingDir, files.json);
    const mdPath = path.join(args.testingDir, files.md);

    // ── JSON validation ──
    if (!fs.existsSync(jsonPath)) {
      fail(`JSON 文件不存在: ${jsonPath}`);
    }

    const jsonStat = fs.statSync(jsonPath);
    if (jsonStat.size < MIN_SIZE) {
      fail(`JSON 文件过小: ${jsonStat.size} bytes < ${MIN_SIZE} bytes`);
    }

    let jsonData;
    try {
      jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    } catch (e) {
      fail(`JSON 解析失败: ${e.message}`);
    }

    if (!jsonData.test_cases || !Array.isArray(jsonData.test_cases)) {
      fail("JSON 缺少 test_cases 数组");
    }

    if (jsonData.test_cases.length === 0) {
      fail("JSON test_cases 数组为空");
    }

    // ── MD validation ──
    if (!fs.existsSync(mdPath)) {
      fail(`MD 文件不存在（json-to-md.js 未执行？）: ${mdPath}`);
    }

    const mdStat = fs.statSync(mdPath);
    if (mdStat.size < MIN_SIZE) {
      fail(`MD 文件过小: ${mdStat.size} bytes < ${MIN_SIZE} bytes`);
    }

    const mdContent = fs.readFileSync(mdPath, "utf-8");
    const MARKERS = {
      e2e:  /^###+\s*FE-/m,
      api:  /^###+\s*API-/m,
      flow: /^###+\s*FLOW-/m,
    };
    const marker = MARKERS[args.type];
    if (!marker.test(mdContent)) {
      const expected = { e2e: "### FE-*", api: "### API-*", flow: "### FLOW-*" };
      fail(`MD 未检测到案例标记（期望: ${expected[args.type]}）`);
    }

    const mdCaseCount = (mdContent.match(new RegExp(marker.source, "gm")) || []).length;

    console.log(
      `[OK] ${args.type} 产出验证通过: JSON ${jsonData.test_cases.length} cases (${jsonStat.size} bytes), MD ${mdCaseCount} markers (${mdStat.size} bytes)`
    );
  }

  // fix 模式: 覆盖标注完整性校验（从 MD 提取，兼容旧流程）
  if (args.mode === "fix") {
    const backupPath = args.preFixBackup || path.join(
      args.testingDir, ".cache", "backup",
      `${path.basename(files.md)}.pre-fix.bak`
    );
    if (!fs.existsSync(backupPath)) {
      fail(`修正前备份文件不存在: ${backupPath}`);
    }

    const beforeContent = fs.readFileSync(backupPath, "utf-8");
    const beforeIds = extractCoverageIds(beforeContent);
    const afterIds = extractCoverageIds(mdContent);

    const beforeSet = new Set(beforeIds);
    const afterSet = new Set(afterIds);

    const lost = beforeIds.filter(id => !afterSet.has(id));
    const added = afterIds.filter(id => !beforeSet.has(id));

    if (lost.length > 0) {
      fail(`修正后覆盖标注丢失 ${lost.length} 个: ${lost.join(", ")}（修正前 ${beforeIds.length} 个, 修正后 ${afterIds.length} 个）`);
    }

    console.log(`[OK] 覆盖标注完整性: 修正前 ${beforeIds.length} 个, 修正后 ${afterIds.length} 个 (+${added.length})`);
  }

  process.exit(0);
}

main();
