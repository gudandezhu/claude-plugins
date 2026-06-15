#!/usr/bin/env node
/**
 * review-case-quality.js
 * 脚本化案例质量评审（替代 AI 主观打分）。
 * 从案例文档中提取结构化指标，按规则打分，禁止 AI 主观判断。
 *
 * 评分模型（100分制，4个正交维度）：
 *   结构完整性 (25): 步骤编号 + 前置条件
 *   内容准确度 (30): 模糊描述检测 + 具体数据值
 *   场景覆盖度 (30): 正常/异常/边界比例
 *   断言有效性 (15): 预期结果存在性 + 模糊结果检测
 *
 * 用法：node review-case-quality.js \
 *   --testing-dir $WORK_DIR/testing \
 *   --scope <frontend|backend|fullstack> \
 *   --pass-score 80 \
 *   --fix-score 60
 *
 * 输出：testing/.cache/merged-review-result.json（兼容原 review-merger.js 格式）
 */
"use strict";

const fs = require("fs");
const path = require("path");
const parseArgs = require("../../../scripts/lib/parse-args");

function readSafe(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

function splitCases(content) {
  return content.split(/(?=###\s+(?:FE|API|FLOW)-)/).filter(b => /###\s+(?:FE|API|FLOW)-/.test(b));
}

// ─── 维度1: 结构完整性 (25分) ─────────────────────────────────

function checkStructure(casesContent) {
  const blocks = splitCases(casesContent);
  let noStepNumberCount = 0;
  let emptyPrecondCount = 0;
  let totalCases = 0;

  for (const block of blocks) {
    totalCases++;
    if (!/(?:\d+\.\s|S\d{2})/.test(block)) noStepNumberCount++;
    const precondMatch = block.match(/前置条件\s*[|｜:：]\s*([^|｜\n]*)/);
    if (precondMatch) {
      const val = precondMatch[1].trim();
      if (!val || val === "无" || val === "-" || val === "—") emptyPrecondCount++;
    }
  }

  let score = 25;
  const issues = [];
  if (noStepNumberCount > 0) {
    const deduction = Math.min(noStepNumberCount * 3, 12);
    score -= deduction;
    issues.push(`${noStepNumberCount}/${totalCases} 个案例步骤无编号`);
  }
  if (emptyPrecondCount > 0) {
    const deduction = Math.min(emptyPrecondCount * 2, 8);
    score -= deduction;
    issues.push(`${emptyPrecondCount}/${totalCases} 个案例前置条件为空`);
  }

  return { score: Math.max(score, 0), maxScore: 25, issues, passed: issues.length === 0 };
}

// ─── 维度2: 内容精确度 (30分) ─────────────────────────────────

function checkContentPrecision(casesContent) {
  // 模糊操作描述
  const vaguePatterns = [
    /等操作/g, /相关操作/g, /进行测试/g, /执行操作/g,
    /类似操作/g, /相应操作/g, /对应操作/g, /其他操作/g,
    /参考上述/g, /同上/g, /类似地/g,
  ];
  let vagueCount = 0;
  const vagueExamples = [];
  for (const p of vaguePatterns) {
    const matches = casesContent.match(p);
    if (matches) {
      vagueCount += matches.length;
      if (vagueExamples.length < 5) vagueExamples.push(p.source.replace(/\\/g, ""));
    }
  }

  // 缺少具体数据值的案例
  const blocks = splitCases(casesContent);
  let noDataValueCount = 0;
  let totalCases = 0;
  for (const block of blocks) {
    totalCases++;
    if (!/["'「」]/.test(block) && !/\b\d{2,}\b/.test(block)) noDataValueCount++;
  }

  let score = 30;
  const issues = [];
  const vagueDeduction = Math.min(vagueCount * 2, 15);
  if (vagueDeduction > 0) {
    score -= vagueDeduction;
    issues.push(`${vagueCount} 处模糊操作描述`);
  }
  if (noDataValueCount > totalCases * 0.3) {
    const dataDeduction = Math.min(Math.round(noDataValueCount * 2), 15);
    score -= dataDeduction;
    issues.push(`${noDataValueCount}/${totalCases} 个案例缺少具体数据值`);
  }

  return { score: Math.max(score, 0), maxScore: 30, vagueCount, vagueExamples, noDataValueCount, totalCases, issues, passed: issues.length === 0 };
}

// ─── 维度3: 场景覆盖度 (30分) ─────────────────────────────────

function checkScenarioCoverage(casesContent) {
  const normalCount = (casesContent.match(/###\s+(?:FE|API|FLOW)-[A-Z]+-\d{3}\b/g) || []).length;
  const exceptionCount = (casesContent.match(/###\s+(?:FE|API|FLOW)-[A-Z]+-\d{3}-E\d{2}/g) || []).length;
  const boundaryCount = (casesContent.match(/###\s+(?:FE|API|FLOW)-[A-Z]+-\d{3}-B\d{2}/g) || []).length;

  let score = 30;
  const issues = [];
  if (exceptionCount === 0) { score -= 15; issues.push("无异常场景案例（E 编号）"); }
  else if (exceptionCount < normalCount * 0.5) { score -= 8; issues.push(`异常场景不足（${exceptionCount} 个，正常 ${normalCount} 个，建议至少 ${Math.ceil(normalCount * 0.5)} 个）`); }
  if (boundaryCount === 0) { score -= 10; issues.push("无边界值案例（B 编号）"); }
  else if (boundaryCount < 2) { score -= 5; issues.push(`边界值案例不足（${boundaryCount} 个，建议至少 2 个）`); }

  return { score: Math.max(score, 0), maxScore: 30, normalCount, exceptionCount, boundaryCount, issues, passed: issues.length === 0 };
}

// ─── 维度4: 断言有效性 (15分) ─────────────────────────────────

function checkAssertionQuality(casesContent) {
  const blocks = splitCases(casesContent);
  let noExpectedCount = 0;
  let vagueResultCount = 0;
  let noMethodCount = 0;
  let totalCases = 0;

  const vagueResultPatterns = [
    /预期结果[^|]*[|｜]\s*正常\s*[|｜]/g,
    /预期结果[^|]*[|｜]\s*成功\s*[|｜]/g,
    /预期结果[^|]*[|｜]\s*通过\s*[|｜]/g,
    /预期结果[^|]*[|｜]\s*无异常\s*[|｜]/g,
  ];

  for (const block of blocks) {
    totalCases++;
    if (!/预期结果/.test(block)) noExpectedCount++;
    for (const p of vagueResultPatterns) {
      if (p.test(block)) { vagueResultCount++; break; }
    }
    if (!/design[_-]?method/i.test(block) && !/设计方法\s*[|｜:：]/i.test(block)) noMethodCount++;
  }

  let score = 15;
  const issues = [];
  if (noExpectedCount > 0) {
    const deduction = Math.min(noExpectedCount * 4, 10);
    score -= deduction;
    issues.push(`${noExpectedCount}/${totalCases} 个案例缺少预期结果`);
  }
  if (vagueResultCount > 0) {
    const deduction = Math.min(vagueResultCount * 3, 5);
    score -= deduction;
    issues.push(`${vagueResultCount} 处模糊预期结果（正常/成功/通过）`);
  }
  if (noMethodCount > totalCases * 0.5) {
    score -= 3;
    issues.push(`${noMethodCount}/${totalCases} 个案例缺少 design_method 标注`);
  }

  return { score: Math.max(score, 0), maxScore: 15, noExpectedCount, vagueResultCount, totalCases, issues, passed: issues.length === 0 };
}

// ─── 主流程 ─────────────────────────────────────────────────

function main() {
  const raw = parseArgs(process.argv.slice(2), {
    testingDir: { flag: "--testing-dir", default: "testing" },
    scope: { flag: "--scope", default: "fullstack" },
    passScore: { flag: "--pass-score", default: 80 },
    fixScore: { flag: "--fix-score", default: 60 },
  });
  const testingDir = raw.testingDir;
  const scope = raw.scope;
  const passScore = parseInt(raw.passScore, 10);
  const fixScore = parseInt(raw.fixScore, 10);
  const cacheDir = path.join(testingDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  // 收集所有案例内容（支持 split 目录 + 旧路径 fallback）
  function readTypeMdDir(testingDir, type) {
    const splitDir = path.join(testingDir, "test-cases", type);
    if (fs.existsSync(splitDir)) {
      const mdFiles = fs.readdirSync(splitDir)
        .filter(f => f.endsWith(".md") && !f.startsWith("_"))
        .sort();
      if (mdFiles.length > 0) {
        return mdFiles.map(f => readSafe(path.join(splitDir, f))).join("\n");
      }
    }
    const fallbackMap = {
      e2e: "test-cases/e2e-test-cases.md",
      api: "test-cases/api-test-cases.md",
      flow: "test-cases/api-flow-test-cases.md",
    };
    return readSafe(path.join(testingDir, fallbackMap[type] || ""));
  }

  const contentParts = [];
  if (scope !== "backend") {
    contentParts.push(readTypeMdDir(testingDir, "e2e"));
  }
  if (scope !== "frontend") {
    contentParts.push(readTypeMdDir(testingDir, "api"));
    contentParts.push(readTypeMdDir(testingDir, "flow"));
  }
  const allCasesContent = contentParts.join("\n");

  if (!allCasesContent.trim()) {
    console.error("[FAIL] 无案例文档可评审");
    process.exit(1);
  }

  // 4 维度评审
  const structure = checkStructure(allCasesContent);
  const contentPrecision = checkContentPrecision(allCasesContent);
  const scenarioCoverage = checkScenarioCoverage(allCasesContent);
  const assertionQuality = checkAssertionQuality(allCasesContent);

  const overall = structure.score + contentPrecision.score + scenarioCoverage.score + assertionQuality.score;

  // 收集 suggestions
  const suggestions = [];
  const dims = [
    { key: "structure", label: "结构完整性", dim: structure, weight: "25" },
    { key: "content-precision", label: "内容精确度", dim: contentPrecision, weight: "30" },
    { key: "scenario-coverage", label: "场景覆盖度", dim: scenarioCoverage, weight: "30" },
    { key: "assertion-quality", label: "断言有效性", dim: assertionQuality, weight: "15" },
  ];
  for (const { key, label, dim, weight } of dims) {
    if (!dim.passed) {
      const maxDimScore = parseInt(weight);
      const ratio = dim.score / maxDimScore;
      suggestions.push({
        severity: ratio < 0.5 ? "high" : "medium",
        check: key,
        message: `[${label}] ${dim.issues.join("; ")}`,
        ...(dim.vagueExamples ? { examples: dim.vagueExamples } : {}),
      });
    }
  }

  const highSeverityCount = suggestions.filter(s => s.severity === "high").length;

  // 决策
  let action;
  if (overall >= passScore && highSeverityCount === 0) {
    action = "passed";
  } else if (overall >= passScore && highSeverityCount > 0) {
    action = "high-impact-fix";
  } else if (overall >= fixScore) {
    action = "auto-fix";
  } else {
    action = "user-decide";
  }

  const result = {
    overall,
    action,
    passScore,
    fixScore,
    breakdown: {
      structure: { score: structure.score, maxScore: structure.maxScore },
      contentPrecision: { score: contentPrecision.score, maxScore: contentPrecision.maxScore },
      scenarioCoverage: { score: scenarioCoverage.score, maxScore: scenarioCoverage.maxScore },
      assertionQuality: { score: assertionQuality.score, maxScore: assertionQuality.maxScore },
    },
    // 兼容旧格式
    bizScore: structure.score + Math.round(contentPrecision.score * 0.5),
    techScore: scenarioCoverage.score + assertionQuality.score + Math.round(contentPrecision.score * 0.5),
    suggestions,
    highSeverityCount,
    reviewMode: "script-based",
    timestamp: new Date().toISOString(),
  };

  const outputPath = path.join(cacheDir, "merged-review-result.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  // --- 精简摘要文件（供 agent 直接透传，避免读大 JSON 触发 retry）---
  const actionMap = { 'passed': 'continue', 'high-impact-fix': 'fix', 'auto-fix': 'fix', 'user-decide': 'degrade' };
  const reviewSummary = {
    score: overall,
    action: actionMap[action] || action,
    dimensions: [
      { name: 'structure', score: structure.score, maxScore: structure.maxScore },
      { name: 'contentPrecision', score: contentPrecision.score, maxScore: contentPrecision.maxScore },
      { name: 'scenarioCoverage', score: scenarioCoverage.score, maxScore: scenarioCoverage.maxScore },
      { name: 'assertionQuality', score: assertionQuality.score, maxScore: assertionQuality.maxScore },
    ],
    details: suggestions.map(s => `[${s.severity}] ${s.check}: ${s.message}`).join('; ') || 'All dimensions passed',
  };
  fs.writeFileSync(path.join(cacheDir, "review-check-summary.json"), JSON.stringify(reviewSummary, null, 2));

  console.log(`案例质量评审: 综合分 ${overall}/100 (结构 ${structure.score}/25 + 精确度 ${contentPrecision.score}/30 + 覆盖度 ${scenarioCoverage.score}/30 + 断言 ${assertionQuality.score}/15)`);
  console.log(`决策: ${action} (passScore=${passScore}, fixScore=${fixScore})`);
  if (suggestions.length > 0) {
    console.log(`问题: ${suggestions.length} 条 (高影响 ${highSeverityCount} 条)`);
    for (const s of suggestions) {
      console.log(`  [${s.severity}] ${s.check}: ${s.message}`);
    }
  }

  process.exit(action === "user-decide" ? 1 : 0);
}

main();
