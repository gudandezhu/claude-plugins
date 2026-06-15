#!/usr/bin/env node
/**
 * evaluation-check.js
 * 端到端质量评估模块（由 gate-check.js --evaluation-mode 调用）
 * 独立于门禁检查，不影响 gate-result.json 的 passed 字段
 *
 * 四维评估：
 *   1. AC → TC 覆盖完整性
 *   2. TC → 脚本覆盖完整性
 *   3. 流程覆盖完整性
 *   4. 脚本质量汇总
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { loadAcAssignment } = require("../../scripts/lib/ac-assignment-loader");

/**
 * 从案例文档提取 TC → AC 映射
 */
function extractCaseTcToAc(testingDir) {
  const caseFiles = [
    path.join(testingDir, "test-cases/e2e-test-cases.md"),
    path.join(testingDir, "test-cases/api-flow-test-cases.md"),
    path.join(testingDir, "test-cases/api-test-cases.md"),
  ];
  const tcToAc = {};
  for (const cf of caseFiles.filter(f => fs.existsSync(f))) {
    const content = fs.readFileSync(cf, "utf-8");
    const blocks = content.split(/(?=###\s+(?:FE|API|FLOW)-)/);
    for (const block of blocks) {
      const tcMatch = block.match(/(?:###\s+|用例ID\s*[|｜]\s*)((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/);
      const coverMatch = block.match(/\*{0,2}覆盖\s*AC\*{0,2}\s*(?:[:：]|[|｜])\s*([\w\-.\s,，;；（()）]+)/i);
      if (tcMatch && coverMatch) {
        const acIds = coverMatch[1].split(/[,，;；\s]+/)
          .map(id => id.trim().replace(/[（(].*$/, ""))
          .filter(id => id && /^(AC|UI)-/.test(id));
        if (acIds.length > 0) tcToAc[tcMatch[1]] = acIds;
      }
    }
  }
  return tcToAc;
}

/**
 * 从脚本文件提取 TC 编号（test() 块）
 */
function extractScriptTcIds(testingDir) {
  const scriptDirs = [
    path.join(testingDir, "scripts/e2e/tests"),
    path.join(testingDir, "scripts/flow"),
    path.join(testingDir, "scripts/api/tests"),
  ];
  const tcIds = new Set();
  const skipIds = new Set();
  for (const dir of scriptDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = findFilesRecursive(dir, /\.(spec|test)\.ts$/);
    for (const f of files) {
      const content = fs.readFileSync(f, "utf-8");
      const pattern = /test(?:\.skip)?\s*\(\s*['"`]((?:FE|API|FLOW)-[A-Z]+-\d{3}[^'"`]*)/g;
      let m;
      while ((m = pattern.exec(content)) !== null) {
        const tcId = m[1].match(/((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/);
        if (tcId) {
          tcIds.add(tcId[1]);
          if (m[0].startsWith("test.skip")) skipIds.add(tcId[1]);
        }
      }
    }
  }
  return { tcIds, skipIds };
}

function findFilesRecursive(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursive(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 维度 1：AC → TC 覆盖完整性
 */
function checkAcTcCoverage(testingDir, acAssignmentPath) {
  const assignment = loadAcAssignment(acAssignmentPath);
  const caseTcToAc = extractCaseTcToAc(testingDir);
  const coveredAcIds = new Set();
  for (const acIds of Object.values(caseTcToAc)) {
    acIds.forEach(id => coveredAcIds.add(id));
  }

  if (assignment) {
    const excludedSet = new Set(assignment.assignment.excluded?.ids || []);
    const coverableIds = (assignment.assignment.coverable?.ids || [])
      .filter(id => !excludedSet.has(id));
    const uncovered = coverableIds.filter(id => !coveredAcIds.has(id));
    return {
      total: coverableIds.length,
      covered: coverableIds.length - uncovered.length,
      rate: coverableIds.length > 0 ? Math.round(((coverableIds.length - uncovered.length) / coverableIds.length) * 100) : 100,
      uncovered,
      status: uncovered.length === 0 ? "PASS" : "FAIL",
    };
  }

  // 无 assignment 时简单统计
  return {
    total: coveredAcIds.size,
    covered: coveredAcIds.size,
    rate: 100,
    uncovered: [],
    status: "PASS",
    note: "无 ac-assignment.json，仅统计案例文档中声明的 AC",
  };
}

/**
 * 维度 2：TC → 脚本覆盖完整性
 */
function checkTcImplementation(testingDir) {
  const caseTcToAc = extractCaseTcToAc(testingDir);
  const caseTcIds = new Set(Object.keys(caseTcToAc));
  const { tcIds: scriptTcIds, skipIds } = extractScriptTcIds(testingDir);

  const notImplemented = [...caseTcIds].filter(id => !scriptTcIds.has(id));
  const skipped = [...caseTcIds].filter(id => skipIds.has(id));

  return {
    totalInCases: caseTcIds.size,
    totalInScripts: scriptTcIds.size,
    notImplemented,
    skipped,
    rate: caseTcIds.size > 0 ? Math.round(((caseTcIds.size - notImplemented.length) / caseTcIds.size) * 100) : 100,
    status: notImplemented.length === 0 ? "PASS" : (notImplemented.length <= 3 ? "WARN" : "FAIL"),
  };
}

/**
 * 维度 3：流程覆盖完整性
 */
function checkFlowImplementation(testingDir) {
  const flowIdPath = path.join(testingDir, ".cache/flow-identification.json");
  if (!fs.existsSync(flowIdPath)) {
    return { skipped: true, status: "PASS", note: "flow-identification.json 不存在，跳过" };
  }

  let flowData;
  try {
    flowData = JSON.parse(fs.readFileSync(flowIdPath, "utf-8"));
  } catch (e) {
    return { skipped: true, status: "WARN", note: `flow-identification.json 解析失败: ${e.message}` };
  }

  const flows = flowData.flows || [];
  const flowCasesPath = path.join(testingDir, "test-cases/api-flow-test-cases.md");
  const flowCases = fs.existsSync(flowCasesPath) ? fs.readFileSync(flowCasesPath, "utf-8") : "";

  const uncoveredFlows = [];
  for (const flow of flows) {
    // 检查流程名称或相关 AC 是否在案例中出现
    const nameInCases = flowCases.includes(flow.name);
    const acInCases = (flow.relatedAc || []).some(ac => flowCases.includes(ac));
    if (!nameInCases && !acInCases) {
      uncoveredFlows.push(flow.name);
    }
  }

  return {
    totalFlows: flows.length,
    coveredFlows: flows.length - uncoveredFlows.length,
    uncoveredFlows,
    rate: flows.length > 0 ? Math.round(((flows.length - uncoveredFlows.length) / flows.length) * 100) : 100,
    status: uncoveredFlows.length === 0 ? "PASS" : "WARN",
  };
}

/**
 * 汇总质量问题
 */
function collectQualityIssues(gateResult) {
  const issues = [];
  if (!gateResult || !gateResult.steps) return issues;

  const steps = gateResult.steps;
  for (const [key, step] of Object.entries(steps)) {
    if (step.passed === false && step.issues && step.issues.length > 0) {
      issues.push({ step: key, name: step.name || key, count: step.issues.length });
    }
  }
  return issues;
}

/**
 * 综合评估
 */
function determineOverallStatus(acTcCov, tcImpl, flowImpl, qualityIssues) {
  const statuses = [acTcCov.status, tcImpl.status, flowImpl.status || "PASS"];
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARN") || qualityIssues.length > 0) return "WARN";
  return "PASS";
}

/**
 * 生成建议
 */
function generateRecommendations(acTcCov, tcImpl, flowImpl) {
  const recs = [];
  if (acTcCov.uncovered && acTcCov.uncovered.length > 0) {
    recs.push(`补充 ${acTcCov.uncovered.length} 个未覆盖 AC 的测试案例: ${acTcCov.uncovered.slice(0, 5).join(", ")}`);
  }
  if (tcImpl.notImplemented && tcImpl.notImplemented.length > 0) {
    recs.push(`实现 ${tcImpl.notImplemented.length} 个未实现的 TC 脚本: ${tcImpl.notImplemented.slice(0, 5).join(", ")}`);
  }
  if (tcImpl.skipped && tcImpl.skipped.length > 0) {
    recs.push(`检查 ${tcImpl.skipped.length} 个 test.skip 的 TC: ${tcImpl.skipped.slice(0, 5).join(", ")}`);
  }
  if (flowImpl.uncoveredFlows && flowImpl.uncoveredFlows.length > 0) {
    recs.push(`补充 ${flowImpl.uncoveredFlows.length} 个未覆盖流程的案例: ${flowImpl.uncoveredFlows.slice(0, 3).join(", ")}`);
  }
  return recs;
}

/**
 * 运行评估模式（由 gate-check.js 调用）
 */
function runEvaluationMode(testingDir, scope, acFile, acAssignmentPath, evalOutput, gateResult) {
  const acTcCoverage = checkAcTcCoverage(testingDir, acAssignmentPath);
  const tcImplementation = checkTcImplementation(testingDir);
  const flowImplementation = checkFlowImplementation(testingDir);
  const qualityIssues = collectQualityIssues(gateResult);
  const overallStatus = determineOverallStatus(acTcCoverage, tcImplementation, flowImplementation, qualityIssues);
  const recommendations = generateRecommendations(acTcCoverage, tcImplementation, flowImplementation);

  const result = {
    overallStatus,
    timestamp: new Date().toISOString(),
    dimensions: {
      acTcCoverage,
      tcImplementation,
      flowImplementation,
      qualityIssues,
    },
    recommendations,
  };

  if (evalOutput) {
    const outputDir = path.dirname(evalOutput);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(evalOutput, JSON.stringify(result, null, 2));
  }

  // 输出摘要
  console.log(`\n评估模式结果: [${overallStatus}]`);
  console.log(`  维度 1 AC→TC 覆盖: ${acTcCoverage.rate}% (${acTcCoverage.covered}/${acTcCoverage.total})`);
  console.log(`  维度 2 TC→脚本覆盖: ${tcImplementation.rate}% (${tcImplementation.totalInScripts}/${tcImplementation.totalInCases})`);
  if (!flowImplementation.skipped) {
    console.log(`  维度 3 流程覆盖: ${flowImplementation.rate}% (${flowImplementation.coveredFlows}/${flowImplementation.totalFlows})`);
  }
  if (qualityIssues.length > 0) {
    console.log(`  维度 4 质量问题: ${qualityIssues.length} 个步骤有问题`);
  }
  if (recommendations.length > 0) {
    console.log(`  建议:`);
    for (const rec of recommendations) console.log(`    - ${rec}`);
  }

  return result;
}

module.exports = { runEvaluationMode };
