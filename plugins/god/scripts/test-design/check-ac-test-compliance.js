#!/usr/bin/env node
/**
 * check-ac-test-compliance.js
 * 统一检查 AC 测试覆盖率、通过率、跳过率
 * 消费 ac-coverage-matrix.json 作为数据源，避免重复解析
 *
 * 用法：
 *   node check-ac-test-compliance.js \
 *     --testing-dir $WORK_DIR/testing \
 *     --ac-file $AC_FILE \
 *     --ac-assignment $WORK_DIR/testing/.cache/ac-assignment.json \
 *     --summary-file $WORK_DIR/testing/.cache/test-summary.json \
 *     --mode <coverage-only|pre-execution|post-execution> \
 *     --active-types <e2e|api|flow>[,<type>...] \
 *     --output $WORK_DIR/testing/.cache/ac-test-compliance.json
 *
 * mode 说明：
 *   coverage-only: 仅检查 AC→TC 覆盖率（gen-test 阶段）
 *   pre-execution: 检查 AC 覆盖 + TC 实现 + test.skip（run-test 门禁）
 *   post-execution: 检查 AC 覆盖 + TC 实现 + 测试执行结果（run-test 阶段）
 *
 * active-types 说明：
 *   指定要检查的案例类型，多个类型用逗号分隔
 *   不传时检查所有类型（e2e + api + flow + ui）
 *   --active-types api: 只检查 api 组 AC
 *   --active-types e2e: 检查 e2e + ui 组 AC
 *   --active-types flow: 只检查 flow 组 AC
 *   --active-types api,flow: 检查 api + flow 组 AC
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { extractTcIdsFromCaseFile, extractTcIdsFromScript } = require("../lib/tc-id-extractor");
const { safeReadJson } = require("../lib/safe-json");
const { collectTests } = require("../lib/test-file-collector");

// === 默认门禁阈值配置 ===
const DEFAULT_GATE_CONFIG = {
  acCoverageGate: { threshold: 100, strict: true },
  tcImplementationGate: { threshold: 100, strict: true },
  noSkipGate: { threshold: 0, strict: true },
  testPassGate: { threshold: 100, strict: false },  // 测试失败可接受但需确认
  testSkipGate: { threshold: 0, strict: true }
};

// === 参数解析 ===
function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = null;
  let acFile = null;
  let acAssignment = null;
  let summaryFile = null;
  let mode = "post-execution";
  let output = null;
  let activeTypes = null;
  
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--ac-file" && argv[i + 1]) acFile = argv[++i];
    if (argv[i] === "--ac-assignment" && argv[i + 1]) acAssignment = argv[++i];
    if (argv[i] === "--summary-file" && argv[i + 1]) summaryFile = argv[++i];
    if (argv[i] === "--mode" && argv[i + 1]) mode = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
    if (argv[i] === "--active-types" && argv[i + 1]) {
      activeTypes = argv[++i].split(",").map(t => t.trim()).filter(t => t);
      if (activeTypes.length === 0) activeTypes = null;
    }
  }
  
  if (!testingDir) {
    console.error("[ERROR] --testing-dir 参数必填");
    process.exit(1);
  }
  
  return { testingDir, acFile, acAssignment, summaryFile, mode, output, activeTypes };
}

// === 读取门禁配置（支持项目级覆盖）===
function loadGateConfig(testingDir) {
  const configPath = path.join(testingDir, "test-config.json");
  if (fs.existsSync(configPath)) {
    const config = safeReadJson(configPath, { fallback: null });
    if (config && config.gateThresholds) {
      return { ...DEFAULT_GATE_CONFIG, ...config.gateThresholds };
    }
  }
  return DEFAULT_GATE_CONFIG;
}

// === 维度 1: AC → TC 覆盖检查 ===
function checkAcCoverage(testingDir, acAssignmentPath, gateConfig, activeTypes) {
  // 读取 ac-assignment.json
  if (!acAssignmentPath || !fs.existsSync(acAssignmentPath)) {
    console.error(`[ERROR] ac-assignment.json 不存在: ${acAssignmentPath || '(未指定路径)'}`);
    console.error(`[诊断] 可能原因：gen-test Step 0.6 未成功执行 assign-ac-responsibility.js`);
    console.error(`[修复] 请重新执行 /zcode:gen-test，确保 ac.md 存在且 Step 0.6 正常完成`);
    return {
      status: "FAIL",
      total: 0, covered: 0, uncovered: [], rate: 0,
      message: "ac-assignment.json 不存在。请重新执行 /zcode:gen-test 生成此文件。",
      gate: { threshold: gateConfig.acCoverageGate.threshold, passed: false }
    };
  }
  
  const assignment = safeReadJson(acAssignmentPath, { fallback: null });
  if (!assignment) {
    return {
      status: "FAIL",
      total: 0, covered: 0, uncovered: [], rate: 0,
      message: `ac-assignment.json 解析失败`,
      gate: { threshold: gateConfig.acCoverageGate.threshold, passed: false }
    };
  }
  
  // 提取可覆盖的 AC（v2.0 全量共享）
  const excludedSet = new Set(assignment.assignment?.excluded?.ids || []);

  const coverableIds = (assignment.assignment?.coverable?.ids || [])
    .filter(id => !excludedSet.has(id));

  // UI AC 也加入覆盖池
  const uiIds = (assignment.ui?.ids || [])
    .filter(id => !excludedSet.has(id));
  coverableIds.push(...uiIds);
  
  // 从案例文档提取已覆盖的 AC
  const caseFiles = [
    path.join(testingDir, "test-cases/e2e-test-cases.md"),
    path.join(testingDir, "test-cases/api-flow-test-cases.md"),
    path.join(testingDir, "test-cases/api-test-cases.md"),
  ];
  
  const coveredAcIds = new Set();
  for (const cf of caseFiles.filter(f => fs.existsSync(f))) {
    const content = fs.readFileSync(cf, "utf-8");
    const patterns = [
      /\*{0,2}覆盖\s*AC\*{0,2}\s*[:：]\s*([\w\-.\s,，;；（()）]+)/gi,
      /\|\s*\*{0,2}覆盖\s*AC\*{0,2}\s*\|\s*([\w\-.\s,，;；（()）]+?)\s*\|/gi,
    ];
    for (const p of patterns) {
      let m;
      while ((m = p.exec(content)) !== null) {
        m[1].split(/[,，;；\s]+/).forEach(id => {
          const t = id.trim().replace(/[（(].*$/, "");
          if (t && /^(AC|UI)-/.test(t)) coveredAcIds.add(t);
        });
      }
    }
  }
  
  const uncovered = coverableIds.filter(id => !coveredAcIds.has(id));
  const covered = coverableIds.filter(id => coveredAcIds.has(id));
  const rate = coverableIds.length > 0 
    ? Math.round((covered.length / coverableIds.length) * 100) 
    : 100;
  
  const passed = rate >= gateConfig.acCoverageGate.threshold;
  
  return {
    total: coverableIds.length,
    covered: covered.length,
    uncovered,
    rate,
    status: passed ? "PASS" : "FAIL",
    excludedCount: excludedSet.size,
    activeTypes: activeTypes || 'all',
    gate: { threshold: gateConfig.acCoverageGate.threshold, actual: rate, passed }
  };
}

// === 维度 2: TC 实现检查 ===
function checkTcImplementation(testingDir, gateConfig) {
  // 从案例文档提取 TC 编号
  const caseFiles = [
    path.join(testingDir, "test-cases/e2e-test-cases.md"),
    path.join(testingDir, "test-cases/api-flow-test-cases.md"),
    path.join(testingDir, "test-cases/api-test-cases.md"),
  ];
  
  const caseTcIds = new Set();
  for (const cf of caseFiles.filter(f => fs.existsSync(f))) {
    const content = fs.readFileSync(cf, "utf-8");
    const ids = extractTcIdsFromCaseFile(content);
    ids.forEach(id => caseTcIds.add(id));
  }
  
  // 从脚本提取 TC 编号（支持 testingRepo 模式）
  const configPath = path.join(testingDir, "test-config.json");
  const config = fs.existsSync(configPath) ? safeReadJson(configPath, { fallback: {} }) : {};

  const scriptDirs = [
    path.join(testingDir, "scripts/e2e/tests"),
    path.join(testingDir, "scripts/flow"),
    path.join(testingDir, "scripts/api/tests"),
  ];

  // testingRepo 模式下追加额外路径
  const extraFiles = [
    ...collectTests(testingDir, config, "e2e"),
    ...collectTests(testingDir, config, "api"),
  ];
  
  const scriptTcIds = new Set();
  const skippedTcIds = new Set();
  
  for (const dir of scriptDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = findFilesRecursive(dir, /\.(spec|test)\.ts$/);
    for (const f of files) {
      const content = fs.readFileSync(f, "utf-8");
      const { ids, skippedIds } = extractTcIdsFromScript(content);
      ids.forEach(id => scriptTcIds.add(id));
      skippedIds.forEach(id => skippedTcIds.add(id));
    }
  }

  // testingRepo 额外文件
  for (const f of extraFiles) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, "utf-8");
    const { ids, skippedIds } = extractTcIdsFromScript(content);
    ids.forEach(id => scriptTcIds.add(id));
    skippedIds.forEach(id => skippedTcIds.add(id));
  }
  
  const notImplemented = [...caseTcIds].filter(id => !scriptTcIds.has(id));
  const rate = caseTcIds.size > 0 
    ? Math.round(((caseTcIds.size - notImplemented.length) / caseTcIds.size) * 100) 
    : 100;
  
  const passed = rate >= gateConfig.tcImplementationGate.threshold && skippedTcIds.size === 0;
  
  return {
    totalInCases: caseTcIds.size,
    totalInScripts: scriptTcIds.size,
    implemented: caseTcIds.size - notImplemented.length,
    notImplemented,
    skipped: [...skippedTcIds],
    skippedCount: skippedTcIds.size,
    rate,
    status: passed ? "PASS" : (skippedTcIds.size > 0 ? "FAIL" : "WARN"),
    gates: {
      implementation: { threshold: gateConfig.tcImplementationGate.threshold, actual: rate, passed: rate >= gateConfig.tcImplementationGate.threshold },
      noSkip: { threshold: gateConfig.noSkipGate.threshold, actual: skippedTcIds.size, passed: skippedTcIds.size === 0 }
    }
  };
}

// === 维度 3: 测试执行结果检查（消费 ac-coverage-matrix.json）===
function checkTestExecution(testingDir, gateConfig) {
  const matrixPath = path.join(testingDir, ".cache", "ac-coverage-matrix.json");
  
  if (!fs.existsSync(matrixPath)) {
    return { 
      status: "SKIP", 
      message: "ac-coverage-matrix.json 不存在，跳过执行结果检查"
    };
  }
  
  const matrixData = safeReadJson(matrixPath, { fallback: null });
  if (!matrixData) {
    return {
      status: "FAIL",
      message: `ac-coverage-matrix.json 解析失败`
    };
  }
  
  const summary = matrixData.summary || {};
  const skippedTcs = matrixData.skippedTcs || [];
  
  const total = summary.total || 0;
  const passed = summary.passed || 0;
  const failed = summary.failed || 0;
  const skipped = summary.skipped || 0;
  
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 100;
  
  return {
    total,
    passed,
    failed,
    skipped,
    skippedTcs,
    passRate,
    status: failed === 0 && skipped === 0 ? "PASS" : "FAIL",
    gates: {
      testPass: { threshold: gateConfig.testPassGate.threshold, actual: passRate, passed: failed === 0 },
      testSkip: { threshold: gateConfig.testSkipGate.threshold, actual: skipped, passed: skipped === 0 }
    }
  };
}

// === 门禁判定 ===
function determineGates(acCoverage, tcImpl, testExec, mode, gateConfig) {
  const gates = {
    acCoverageGate: acCoverage.gate
  };
  
  if (mode !== "coverage-only") {
    gates.tcImplementationGate = tcImpl.gates.implementation;
    gates.noSkipGate = tcImpl.gates.noSkip;
  }
  
  if (mode === "post-execution" && testExec.status !== "SKIP") {
    gates.testPassGate = testExec.gates.testPass;
    gates.testSkipGate = testExec.gates.testSkip;
  }
  
  return gates;
}

// === 综合判定 ===
function determineOverallStatus(gates, gateConfig) {
  for (const [name, gate] of Object.entries(gates)) {
    if (!gate.passed) {
      const config = gateConfig[name];
      if (config && config.strict) {
        return "FAIL";
      }
    }
  }
  // 非严格门禁失败时返回 WARN
  const hasFailed = Object.values(gates).some(g => !g.passed);
  return hasFailed ? "WARN" : "PASS";
}

// === 生成建议 ===
function generateRecommendations(acCoverage, tcImpl, testExec, gates) {
  const recs = [];
  
  if (!gates.acCoverageGate?.passed) {
    recs.push(`补充 ${acCoverage.uncovered.length} 个未覆盖 AC 的测试案例: ${acCoverage.uncovered.slice(0, 5).join(", ")}${acCoverage.uncovered.length > 5 ? '...' : ''}`);
  }
  
  if (tcImpl.notImplemented && tcImpl.notImplemented.length > 0) {
    recs.push(`实现 ${tcImpl.notImplemented.length} 个未实现的 TC: ${tcImpl.notImplemented.slice(0, 5).join(", ")}${tcImpl.notImplemented.length > 5 ? '...' : ''}`);
  }
  
  if (tcImpl.skipped && tcImpl.skipped.length > 0) {
    recs.push(`移除 ${tcImpl.skipped.length} 个 test.skip 或实现其逻辑: ${tcImpl.skipped.slice(0, 5).join(", ")}${tcImpl.skipped.length > 5 ? '...' : ''}`);
  }
  
  if (testExec.failed && testExec.failed > 0) {
    recs.push(`修复 ${testExec.failed} 个失败的测试`);
  }
  
  if (testExec.skipped && testExec.skipped > 0) {
    recs.push(`处理 ${testExec.skipped} 个运行时跳过的测试: ${testExec.skippedTcs?.slice(0, 5).join(", ") || ''}`);
  }
  
  return recs;
}

// === 辅助函数 ===
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

// === 主逻辑 ===
function main() {
  const { testingDir, acFile, acAssignment, summaryFile, mode, output, activeTypes } = parseArgs();
  
  console.log(`[INFO] AC 测试合规检查 - 模式: ${mode}${activeTypes ? `, 类型: ${activeTypes.join(',')}` : ', 类型: all（未传 --active-types）'}`);
  if (!activeTypes) {
    console.log(`[WARN] 未传递 --active-types 参数，将检查所有类型 AC。如果只执行了部分类型，覆盖率分母可能偏大。`);
  }

  // 加载门禁配置
  const gateConfig = loadGateConfig(testingDir);
  
  // 维度 1: AC 覆盖
  const acCoverage = checkAcCoverage(testingDir, acAssignment, gateConfig, activeTypes);
  console.log(`  AC 覆盖: ${acCoverage.status} (${acCoverage.covered}/${acCoverage.total} = ${acCoverage.rate}%)`);
  if (acCoverage.excludedCount > 0) {
    console.log(`  excluded AC: ${acCoverage.excludedCount} 个`);
  }
  
  // 维度 2: TC 实现
  let tcImpl = { status: "SKIP", totalInCases: 0, implemented: 0, skipped: [], gates: {} };
  if (mode !== "coverage-only") {
    tcImpl = checkTcImplementation(testingDir, gateConfig);
    console.log(`  TC 实现: ${tcImpl.status} (${tcImpl.implemented}/${tcImpl.totalInCases} = ${tcImpl.rate}%)`);
    if (tcImpl.skippedCount > 0) {
      console.log(`  ⚠️ test.skip: ${tcImpl.skippedCount} 个`);
    }
  }
  
  // 维度 3: 测试执行（消费 ac-coverage-matrix.json）
  let testExec = { status: "SKIP", gates: {} };
  if (mode === "post-execution") {
    testExec = checkTestExecution(testingDir, gateConfig);
    if (testExec.status !== "SKIP") {
      console.log(`  测试执行: ${testExec.status} (通过 ${testExec.passed}/${testExec.total} = ${testExec.passRate}%)`);
      if (testExec.failed > 0) console.log(`  ❌ 失败: ${testExec.failed} 个`);
      if (testExec.skipped > 0) console.log(`  ⏭️ 跳过: ${testExec.skipped} 个`);
    }
  }
  
  // 门禁判定
  const gates = determineGates(acCoverage, tcImpl, testExec, mode, gateConfig);
  const overallStatus = determineOverallStatus(gates, gateConfig);
  const recommendations = generateRecommendations(acCoverage, tcImpl, testExec, gates);
  
  // 输出结果
  const result = {
    timestamp: new Date().toISOString(),
    mode,
    gateConfig: {
      acCoverage: gateConfig.acCoverageGate,
      tcImplementation: gateConfig.tcImplementationGate,
      noSkip: gateConfig.noSkipGate,
      testPass: gateConfig.testPassGate
    },
    summary: {
      acCoverage,
      tcImplementation: tcImpl.status !== "SKIP" ? tcImpl : undefined,
      testExecution: testExec.status !== "SKIP" ? testExec : undefined,
    },
    gates,
    overallStatus,
    recommendations,
  };
  
  if (output) {
    const outputDir = path.dirname(output);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(`[OK] 输出: ${output}`);
  }
  
  // 摘要
  console.log(`\n========== 合规检查结果 ==========`);
  console.log(`AC 覆盖门禁: ${gates.acCoverageGate?.passed ? "✅" : "❌"} ${gates.acCoverageGate?.actual || 0}% (阈值: ${gates.acCoverageGate?.threshold || 100}%)`);
  
  if (gates.tcImplementationGate) {
    console.log(`TC 实现门禁: ${gates.tcImplementationGate.passed ? "✅" : "❌"} ${gates.tcImplementationGate.actual}% (阈值: ${gates.tcImplementationGate.threshold}%)`);
  }
  
  if (gates.noSkipGate) {
    console.log(`跳过检测门禁: ${gates.noSkipGate.passed ? "✅" : "❌"} ${gates.noSkipGate.actual} 个跳过 (阈值: ${gates.noSkipGate.threshold})`);
  }
  
  if (gates.testPassGate) {
    console.log(`测试通过门禁: ${gates.testPassGate.passed ? "✅" : "❌"} ${gates.testPassGate.actual}% (阈值: ${gates.testPassGate.threshold}%)`);
  }
  
  if (gates.testSkipGate) {
    console.log(`运行时跳过门禁: ${gates.testSkipGate.passed ? "✅" : "❌"} ${gates.testSkipGate.actual} 个 (阈值: ${gates.testSkipGate.threshold})`);
  }
  
  console.log(`\n综合状态: ${overallStatus === "PASS" ? "✅ 通过" : (overallStatus === "WARN" ? "⚠️ 警告" : "❌ 不通过")}`);
  
  if (recommendations.length > 0) {
    console.log(`\n建议:`);
    for (const rec of recommendations) {
      console.log(`  - ${rec}`);
    }
  }
  
  // exit code: FAIL=1, WARN=0, PASS=0
  process.exit(overallStatus === "FAIL" ? 1 : 0);
}

main();
