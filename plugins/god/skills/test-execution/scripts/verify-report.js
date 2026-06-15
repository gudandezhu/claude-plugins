#!/usr/bin/env node
"use strict";
/**
 * verify-report.js
 * 验收报告合规校验 + 截图完整性检查。
 * 在 run-test 步骤五生成报告后自动运行。
 *
 * 用法：node verify-report.js --testing-dir testing/ --scope fullstack
 * 输出：testing/.cache/verify-report-result.json
 * 退出码：0=全部通过，1=有缺失
 */
const fs = require("fs");
const path = require("path");
const { TC_ID_PATTERN } = require("../../../scripts/lib/tc-id-extractor");
const { collectTests } = require("../../../scripts/lib/test-file-collector");
const { safeReadJson } = require("../../../scripts/lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = "testing";
  let scope = "fullstack";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--scope" && argv[i + 1]) scope = argv[++i];
  }
  return { testingDir, scope };
}

function readSafe(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

function findFiles(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(entry.name)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

// ─── 验收报告必填章节检查 ────────────────────────────────────
const REQUIRED_SECTIONS = [
  { keyword: "版本号", aliases: ["版本", "version"] },
  { keyword: "验收日期", aliases: ["验收时间", "日期"] },
  { keyword: "验收环境", aliases: ["测试环境", "环境信息"] },
  { keyword: "验收结论", aliases: ["测试结论", "结论"] },
  { keyword: "验收范围", aliases: ["测试范围", "覆盖范围"] },
  { keyword: "测试用例统计", aliases: ["用例统计", "统计表", "通过率"] },
  { keyword: "模块明细", aliases: ["按模块", "模块测试"] },
  { keyword: "缺陷", aliases: ["缺陷清单", "defect", "bug"] },
  { keyword: "截图", aliases: ["截图证据", "证据", "screenshot"] },
  { keyword: "未覆盖", aliases: ["未覆盖项", "遗留"] },
  { keyword: "风险", aliases: ["遗留风险", "风险项"] },
  { keyword: "签字", aliases: ["验收签字", "确认"] },
  { keyword: "后续", aliases: ["后续行动", "行动项", "action"] },
];

function checkReportSections(testingDir) {
  const reportPath = path.join(testingDir, "reports/acceptance-report.md");
  const content = readSafe(reportPath);
  if (!content) {
    return {
      exists: false,
      missing: REQUIRED_SECTIONS.map((s) => s.keyword),
      found: [],
    };
  }

  const contentLower = content.toLowerCase();
  const missing = [];
  const found = [];

  for (const section of REQUIRED_SECTIONS) {
    const allKeywords = [section.keyword, ...section.aliases];
    const hasSection = allKeywords.some((kw) =>
      contentLower.includes(kw.toLowerCase())
    );
    if (hasSection) {
      found.push(section.keyword);
    } else {
      missing.push(section.keyword);
    }
  }

  return { exists: true, missing, found };
}

// ─── 验收清单检查 ────────────────────────────────────────────
function checkChecklist(testingDir) {
  const checklistPath = path.join(
    testingDir,
    "reports/acceptance-checklist.md"
  );
  return {
    exists: fs.existsSync(checklistPath),
    path: checklistPath,
  };
}

// ─── 截图完整性检查 ──────────────────────────────────────────
function checkScreenshots(testingDir, scope) {
  if (scope === "backend") {
    return { skipped: true, reason: "scope=backend，无 E2E 截图" };
  }

  // 从 test-summary.json 提取所有 E2E TC 编号
  const summaryPath = path.join(testingDir, ".cache/test-summary.json");
  const summaryContent = readSafe(summaryPath);
  let expectedTcIds = [];

  if (summaryContent) {
    try {
      const summary = JSON.parse(summaryContent);
      // 从 e2e 结果中提取所有 TC（包括通过和失败的）
      // 通过的 TC 不在 failures 中，需要从脚本文件提取
    } catch (e) {
      // ignore
    }
  }

  // 从 E2E 脚本文件提取所有 TC 编号（支持 testingRepo）
  const configPath = path.join(testingDir, "test-config.json");
  const config = fs.existsSync(configPath) ? safeReadJson(configPath, { fallback: {} }) : {};
  const specFiles = collectTests(testingDir, config, "e2e");
  const legacySpecFiles = findFiles(
    path.join(testingDir, "scripts/e2e/tests"),
    /\.spec\.ts$/
  );
  const allSpecFiles = [...new Set([...specFiles, ...legacySpecFiles])];
  const scriptContent = allSpecFiles.map((f) => readSafe(f)).join("\n");
  const tcPattern = new RegExp(TC_ID_PATTERN.source, "g");
  const tcIds = new Set();
  let m;
  while ((m = tcPattern.exec(scriptContent)) !== null) {
    if (m[1].startsWith("FE-")) tcIds.add(m[1]);
  }
  expectedTcIds = [...tcIds];

  // 检查截图目录
  const screenshotDir = path.join(testingDir, "screenshots");
  const screenshots = findFiles(screenshotDir, /\.png$/);
  const screenshotNames = screenshots.map((f) => path.basename(f));

  // 检查每个 TC 是否有对应截图
  const missingScreenshots = [];
  const foundScreenshots = [];

  for (const tcId of expectedTcIds) {
    const hasScreenshot = screenshotNames.some((name) =>
      name.includes(tcId)
    );
    if (hasScreenshot) {
      foundScreenshots.push(tcId);
    } else {
      missingScreenshots.push(tcId);
    }
  }

  return {
    skipped: false,
    expectedCount: expectedTcIds.length,
    foundCount: foundScreenshots.length,
    missingCount: missingScreenshots.length,
    missing: missingScreenshots,
    rate:
      expectedTcIds.length > 0
        ? `${Math.round((foundScreenshots.length / expectedTcIds.length) * 100)}%`
        : "N/A",
  };
}

// ─── API 证据完整性检查 ──────────────────────────────────────
function checkApiEvidence(testingDir, scope) {
  if (scope === "frontend") {
    return { skipped: true, reason: "scope=frontend，无 API 证据" };
  }

  const evidenceDir = path.join(testingDir, "evidence/api");
  const evidenceFiles = findFiles(evidenceDir, /\.json$/);

  // 从 API 脚本提取 TC 编号（支持 testingRepo）
  const testFiles = collectTests(testingDir, config, "api");
  const legacyTestFiles = findFiles(
    path.join(testingDir, "scripts/api/tests"),
    /\.api\.test\.ts$/
  );
  const allTestFiles = [...new Set([...testFiles, ...legacyTestFiles])];
  const scriptContent = allTestFiles.map((f) => readSafe(f)).join("\n");
  const tcPattern = new RegExp(TC_ID_PATTERN.source, "g");
  const tcIds = new Set();
  let m;
  while ((m = tcPattern.exec(scriptContent)) !== null) {
    if (m[1].startsWith("API-")) tcIds.add(m[1]);
  }

  const evidenceNames = evidenceFiles.map((f) => path.basename(f));
  const missingEvidence = [];
  for (const tcId of tcIds) {
    const hasEvidence = evidenceNames.some((name) => name.includes(tcId));
    if (!hasEvidence) {
      missingEvidence.push(tcId);
    }
  }

  return {
    skipped: false,
    expectedCount: tcIds.size,
    foundCount: evidenceFiles.length,
    missingCount: missingEvidence.length,
    missing: missingEvidence.slice(0, 10),
  };
}

// ─── 通过率门禁检查 ──────────────────────────────────────────
function checkPassRate(testingDir) {
  const summaryPath = path.join(testingDir, ".cache/test-summary.json");
  const configPath = path.join(testingDir, "test-config.json");

  if (!fs.existsSync(summaryPath)) {
    return { skipped: true, reason: "test-summary.json 不存在" };
  }

  // 通过率阈值强制 100%——全部 success 才算通过
  const threshold = 100;

  try {
    const summary = safeReadJson(summaryPath, { fallback: null });
    if (!summary) return { skipped: true, reason: "test-summary.json 解析失败" };

    // 进程异常时不计入通过率（total=0 意味着没有测试被执行）
    const apiTotal = summary.api?.processError ? 0 : (summary.api?.total || 0);
    const apiPassed = summary.api?.processError ? 0 : (summary.api?.passed || 0);
    const e2eTotal = summary.e2e?.processError ? 0 : (summary.e2e?.total || 0);
    const e2ePassed = summary.e2e?.processError ? 0 : (summary.e2e?.passed || 0);

    const totalTests = apiTotal + e2eTotal;
    const totalPassed = apiPassed + e2ePassed;

    if (totalTests === 0) {
      return { skipped: true, reason: "无有效测试执行结果" };
    }

    const overallRate = Math.round((totalPassed / totalTests) * 100);
    const apiRate = apiTotal > 0 ? Math.round((apiPassed / apiTotal) * 100) : null;
    const e2eRate = e2eTotal > 0 ? Math.round((e2ePassed / e2eTotal) * 100) : null;
    const passed = totalPassed === totalTests; // 全部 success 才算通过

    return {
      skipped: false,
      passed,
      threshold,
      overall: { total: totalTests, passed: totalPassed, rate: overallRate },
      api: apiRate !== null ? { total: apiTotal, passed: apiPassed, rate: apiRate } : null,
      e2e: e2eRate !== null ? { total: e2eTotal, passed: e2ePassed, rate: e2eRate } : null,
    };
  } catch (e) {
    return { skipped: true, reason: `解析 test-summary.json 失败: ${e.message}` };
  }
}

// ─── 主流程 ─────────────────────────────────────────────────
function main() {
  const { testingDir, scope } = parseArgs();
  const cacheDir = path.join(testingDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  const report = checkReportSections(testingDir);
  const checklist = checkChecklist(testingDir);
  const screenshots = checkScreenshots(testingDir, scope);
  const apiEvidence = checkApiEvidence(testingDir, scope);
  const passRate = checkPassRate(testingDir);

  // AC 覆盖矩阵阻断检查（ac.md 已在命令前置检查中确认存在，矩阵文件应始终存在）
  const acMatrixPath = path.join(cacheDir, "ac-coverage-matrix.json");
  let acMatrixCheck = { skipped: false, passed: false, missing: true };
  if (fs.existsSync(acMatrixPath)) {
    try {
      const matrix = JSON.parse(fs.readFileSync(acMatrixPath, "utf-8"));
      if (matrix.summary && matrix.summary.total > 0) {
        const uncovered = matrix.matrix.filter(m => m.result === "UNCOVERED");
        const failed = matrix.matrix.filter(m => m.result === "FAIL");
        const unknown = matrix.matrix.filter(m => m.result === "UNKNOWN");
        const partial = matrix.matrix.filter(m => m.result === "PARTIAL");
        const allPass = matrix.matrix.filter(m => m.result === "PASS").length;
        // 只有全部 PASS 才算通过，FAIL/UNCOVERED/UNKNOWN/PARTIAL 都不行
        const notPass = failed.length + uncovered.length + unknown.length + partial.length;
        acMatrixCheck = {
          skipped: false,
          passed: notPass === 0,
          total: matrix.summary.total,
          allPass,
          failCount: failed.length,
          uncoveredCount: uncovered.length,
          unknownCount: unknown.length,
          partialCount: partial.length,
          failedAc: failed.map(m => m.acId),
          uncoveredAc: uncovered.map(m => m.acId),
          unknownAc: unknown.map(m => m.acId),
          partialAc: partial.map(m => m.acId),
        };
      }
    } catch (e) { /* ignore parse error */ }
  }

  const issues = [];

  // 通过率门禁检查（[FAIL] 级别，阻塞报告生成）——要求 100% 全部 success
  if (!passRate.skipped && !passRate.passed) {
    issues.push(
      `[FAIL] 测试通过率未达标: ${passRate.overall.rate}% < 100%（${passRate.overall.passed}/${passRate.overall.total}），全部 success 才算通过`
    );
  }

  // AC 覆盖矩阵门禁检查（[FAIL] 级别，阻塞报告生成）——只有全部 PASS 才算通过
  if (acMatrixCheck.missing) {
    issues.push(
      `[FAIL] AC 覆盖矩阵文件不存在（ac-coverage-matrix.json），请确认 generate-ac-matrix.js 已执行`
    );
  } else if (!acMatrixCheck.passed) {
    if (acMatrixCheck.uncoveredCount > 0) {
      issues.push(
        `[FAIL] ${acMatrixCheck.uncoveredCount} 个 AC 未被任何测试覆盖: ${acMatrixCheck.uncoveredAc.slice(0, 5).join(", ")}${acMatrixCheck.uncoveredCount > 5 ? "..." : ""}`
      );
    }
    if (acMatrixCheck.failCount > 0) {
      issues.push(
        `[FAIL] ${acMatrixCheck.failCount} 个 AC 对应的测试失败: ${acMatrixCheck.failedAc.slice(0, 5).join(", ")}${acMatrixCheck.failCount > 5 ? "..." : ""}`
      );
    }
    if (acMatrixCheck.unknownCount > 0) {
      issues.push(
        `[FAIL] ${acMatrixCheck.unknownCount} 个 AC 对应的测试未执行: ${acMatrixCheck.unknownAc.slice(0, 5).join(", ")}${acMatrixCheck.unknownCount > 5 ? "..." : ""}`
      );
    }
    if (acMatrixCheck.partialCount > 0) {
      issues.push(
        `[FAIL] ${acMatrixCheck.partialCount} 个 AC 对应的测试部分失败: ${acMatrixCheck.partialAc.slice(0, 5).join(", ")}${acMatrixCheck.partialCount > 5 ? "..." : ""}`
      );
    }
  }

  // 报告检查
  if (!report.exists) {
    issues.push("[FAIL] 验收报告不存在: reports/acceptance-report.md");
  } else if (report.missing.length > 0) {
    issues.push(
      `[FAIL] 验收报告缺少 ${report.missing.length} 个必填章节: ${report.missing.join(", ")}`
    );
  }

  if (!checklist.exists) {
    issues.push("[FAIL] 验收清单不存在: reports/acceptance-checklist.md");
  }

  // 截图检查
  if (!screenshots.skipped && screenshots.missingCount > 0) {
    issues.push(
      `[WARN] E2E 截图缺失 ${screenshots.missingCount}/${screenshots.expectedCount} 个 TC: ${screenshots.missing.slice(0, 5).join(", ")}${screenshots.missingCount > 5 ? "..." : ""}`
    );
  }

  // API 证据检查
  if (!apiEvidence.skipped && apiEvidence.missingCount > 0) {
    issues.push(
      `[WARN] API 证据缺失 ${apiEvidence.missingCount}/${apiEvidence.expectedCount} 个 TC`
    );
  }

  const passed = issues.filter((i) => i.startsWith("[FAIL]")).length === 0;

  const result = {
    timestamp: new Date().toISOString(),
    passed,
    report,
    checklist,
    screenshots,
    apiEvidence,
    passRate,
    acMatrixCheck,
    issues,
  };

  fs.writeFileSync(
    path.join(cacheDir, "verify-report-result.json"),
    JSON.stringify(result, null, 2)
  );

  // 输出
  if (!passRate.skipped) {
    const rateIcon = passRate.passed ? "[OK]" : "[FAIL]";
    console.log(`${rateIcon} 测试通过率: ${passRate.overall.rate}% (${passRate.overall.passed}/${passRate.overall.total}), 要求: 100% 全部 success`);
    if (passRate.api) console.log(`   API: ${passRate.api.rate}% (${passRate.api.passed}/${passRate.api.total})`);
    if (passRate.e2e) console.log(`   E2E: ${passRate.e2e.rate}% (${passRate.e2e.passed}/${passRate.e2e.total})`);
    console.log("");
  }
  if (acMatrixCheck.missing) {
    console.log(`[FAIL] AC 覆盖矩阵: 文件不存在`);
    console.log("");
  } else {
    const acIcon = acMatrixCheck.passed ? "[OK]" : "[FAIL]";
    console.log(`${acIcon} AC 覆盖矩阵: ${acMatrixCheck.allPass}/${acMatrixCheck.total} PASS, ${acMatrixCheck.failCount} FAIL, ${acMatrixCheck.uncoveredCount} UNCOVERED, ${acMatrixCheck.unknownCount} UNKNOWN, ${acMatrixCheck.partialCount} PARTIAL`);
    console.log("");
  }

  if (issues.length === 0) {
    console.log("[OK] 验收报告合规校验通过");
  } else {
    console.log(
      `${passed ? "[WARN]" : "[FAIL]"} 验收报告合规校验${passed ? "有警告" : "未通过"}：`
    );
    console.log("");
    for (const issue of issues) {
      console.log(`  ${issue}`);
    }
    console.log("");
    if (!passed) {
      // 区分通过率不达标和其他问题的提示
      if (!passRate.skipped && !passRate.passed) {
        console.log(`[INFO] 测试通过率 ${passRate.overall.rate}%，要求 100% 全部 success。`);
        console.log("   请修复失败用例后重新执行测试。");
      } else if (!acMatrixCheck.passed) {
        console.log("[INFO] AC 覆盖矩阵存在 FAIL 或 UNCOVERED，请修复后重新执行。");
      } else {
        console.log("[INFO] 请补充缺失的必填章节后重新验证。");
      }
      process.exit(1);
    } else {
      console.log("[INFO] 以上为警告项，建议补充但不阻塞。");
    }
  }
}

main();
