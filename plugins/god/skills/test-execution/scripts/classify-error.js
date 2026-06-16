#!/usr/bin/env node
"use strict";
/**
 * classify-error.js
 * 对单文件重试的 Playwright/vitest JSON 输出进行错误分类，输出 suggestedAction。
 * 解决单文件重试时 LLM 直接看原始错误输出、绕过 suggestedAction 机制的问题。
 *
 * 用法：
 *   node classify-error.js --file testing/.cache/retry-raw.json --type e2e
 *   node classify-error.js --file testing/.cache/retry-raw.json --type api
 * 输出：testing/.cache/classify-error-result.json + 控制台摘要
 */
const fs = require("fs");
const path = require("path");
const { getSuggestedAction, classifyPlaywrightError, classifyVitestError } = require("./lib/error-classifier");
const { extractTcIdFromTitle } = require("../../../scripts/lib/tc-id-extractor");

function parseArgs() {
  const argv = process.argv.slice(2);
  let file = "";
  let type = "e2e";
  let output = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) file = argv[++i];
    if (argv[i] === "--type" && argv[i + 1]) type = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
  }
  if (!output && file) {
    output = path.join(path.dirname(file), "classify-error-result.json");
  }
  return { file, type, output };
}

// ─── Playwright JSON 解析 ───────────────────────────────────
function parsePlaywrightFailures(raw) {
  const failures = [];
  function walkSuite(suite, parentFile) {
    const file = suite.file || parentFile || "";
    for (const sub of suite.suites || []) walkSuite(sub, file);
    for (const spec of suite.specs || []) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          if (result.status === "passed" || result.status === "skipped") continue;
          const errorMsg = result.error?.message || "";
          const tcId = extractTcIdFromTitle(spec.title);
          const eType = classifyPlaywrightError(errorMsg);
          failures.push({
            tcId: tcId || spec.title,
            testName: spec.title,
            errorType: eType,
            suggestedAction: getSuggestedAction(eType),
            message: errorMsg.substring(0, 500),
          });
        }
      }
    }
  }
  if (raw.suites) {
    for (const suite of raw.suites) walkSuite(suite);
  }
  return failures;
}

// ─── Vitest JSON 解析 ───────────────────────────────────────
function parseVitestFailures(raw) {
  const failures = [];
  const testResults = raw.testResults || raw.results || [];
  for (const fileResult of testResults) {
    const tests = fileResult.assertionResults || fileResult.tests || [];
    for (const test of tests) {
      const status = test.status || test.state;
      if (status === "passed" || status === "skipped" || status === "pending") continue;
      const errorMsg = (test.failureMessages || []).join("\n") || test.message || "";
      const tcMatch = extractTcIdFromTitle(test.fullName || test.title || "");
      const eType = classifyVitestError(errorMsg);
      failures.push({
        tcId: tcMatch || test.title || "unknown",
        testName: test.fullName || test.title || "",
        errorType: eType,
        suggestedAction: getSuggestedAction(eType),
        message: errorMsg.substring(0, 500),
      });
    }
  }
  return failures;
}

// ─── 主流程 ─────────────────────────────────────────────────
function main() {
  const { file, type, output } = parseArgs();

  if (!file || !fs.existsSync(file)) {
    console.error(`[FAIL] 文件不存在: ${file}`);
    process.exit(2);
  }

  let failures = [];
  try {
    const content = fs.readFileSync(file, "utf-8");
    const jsonStart = content.indexOf("{");
    if (jsonStart < 0) {
      console.error("[FAIL] 文件中未找到 JSON 内容");
      process.exit(2);
    }
    const raw = JSON.parse(content.substring(jsonStart));
    failures = type === "api" ? parseVitestFailures(raw) : parsePlaywrightFailures(raw);
  } catch (err) {
    console.error(`[FAIL] 解析失败: ${err.message}`);
    process.exit(2);
  }

  const result = {
    timestamp: new Date().toISOString(),
    sourceFile: file,
    type,
    failures,
  };

  // ─── 全量失败启发式：>90% 相同错误模式 → 大概率环境问题 ───
  if (failures.length > 3) {
    const defectFailures = failures.filter(f => f.suggestedAction === "report-defect");
    if (defectFailures.length / failures.length > 0.9) {
      // 提取错误消息的关键模式
      const patterns = defectFailures.map(f => {
        if (/tobevisible|not visible|to be visible/i.test(f.message)) return "not-visible";
        if (/navigation|navigate|invalid url/i.test(f.message)) return "navigation";
        if (/timeout/i.test(f.message)) return "timeout";
        if (/toHaveCount|toHaveText|toContainText/i.test(f.message)) return "assertion";
        return "other";
      });
      const uniquePatterns = new Set(patterns);
      // 全部是 not-visible/navigation/timeout → 几乎 100% 是环境/认证问题
      // 混合了 assertion 和 other → 可能是真实业务缺陷，不升级
      const envPatterns = new Set(["not-visible", "navigation", "timeout"]);
      const allEnvRelated = [...uniquePatterns].every(p => envPatterns.has(p));
      if (uniquePatterns.size <= 2 && allEnvRelated) {
        const dominantPattern = [...uniquePatterns].join("+");
        for (const f of defectFailures) {
          f.suggestedAction = "check-environment";
          f.originalAction = "report-defect";
          f.message = `[全量失败模式: ${dominantPattern}，可能是环境/认证问题] ` + f.message;
        }
        console.log("");
        console.log(`[WARN] 全量失败启发式触发：${defectFailures.length}/${failures.length} 个失败模式相同（${[...uniquePatterns].join("+")}）`);
        console.log("   已将 suggestedAction 从 report-defect 升级为 check-environment");
        console.log("   常见原因：登录态过期、服务未启动、baseUrl 错误");
      }
    }
  }

  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
  }

  // 输出摘要 — 这是 LLM 应该读取的决策依据
  if (failures.length === 0) {
    console.log("[OK] 重试全部通过");
  } else {
    console.log(`[FAIL] ${failures.length} 个失败：`);
    console.log("");
    for (const f of failures) {
      console.log(`  ${f.tcId}: [${f.errorType}] → ${f.suggestedAction}`);
      if (f.suggestedAction === "report-defect") {
        console.log(`    [BLOCK] 禁止修改脚本，必须记录为缺陷`);
      } else if (f.suggestedAction === "check-environment") {
        console.log(`    [BLOCK] 禁止修改脚本，提示用户检查环境`);
      } else if (f.suggestedAction === "retry") {
        console.log(`    [RETRY] 浏览器崩溃，自动重试`);
      } else if (f.suggestedAction === "fix-selector") {
        console.log(`    [FIX] 可以修正选择器，禁止修改断言逻辑`);
      } else if (f.suggestedAction === "fix-api-path") {
        console.log(`    [FIX] 可以修正字段路径，禁止修改断言期望值`);
      } else {
        console.log(`    [INSPECT] 需要 Playwright 诊断`);
      }
    }
    console.log("");
    console.log("[INFO] 严格按 suggestedAction 行动，不要自行判断修复边界。");
  }
}

main();
