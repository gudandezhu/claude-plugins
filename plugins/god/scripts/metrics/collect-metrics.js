#!/usr/bin/env node
/**
 * collect-metrics.js
 * 从 testing/.cache/ 产物聚合测试可观测性指标到 testing/metrics/metrics.json。
 *
 * 用法：
 *   node collect-metrics.js --testing-dir <path> --stage <gen-test|run-test|both>
 *
 * --stage gen-test: 只采集 genTest 部分（从 gen-test 产物）
 * --stage run-test: 只采集 runTest 部分（从 run-test 产物）+ 跨次对比
 * --stage both:     全量采集（默认）
 *
 * 输出：
 *   testing/metrics/metrics.json     — 主指标文件
 *   testing/metrics/run-history.json — 运行历史（仅 run-test/both 时追加）
 *
 * 数据源（testing/.cache/）：
 *   coverage-check-result.json, merged-review-result.json,
 *   test-summary.json, ac-coverage-matrix.json, gate-result.json,
 *   evaluation-report.json, defect-list.json, classify-error-result.json,
 *   gen-test-state.json, run-test-state.json, ac-assignment.json
 *   test-cases/*.json
 */
"use strict";

const fs = require("fs");
const path = require("path");

// ── CLI ──────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { testingDir: null, stage: "both" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) args.testingDir = argv[++i];
    if (argv[i] === "--stage" && argv[i + 1]) args.stage = argv[++i];
  }
  return args;
}

// ── IO helpers ───────────────────────────────────────

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function safeDiv(a, b) {
  return b > 0 ? Math.round((a / b) * 10000) / 100 : null;
}

// ── Test Case Counting ───────────────────────────────

function countCases(testingDir) {
  const types = ["e2e", "api", "flow"];
  const fileMap = {
    e2e: "test-cases/e2e-test-cases.json",
    api: "test-cases/api-test-cases.json",
    flow: "test-cases/api-flow-test-cases.json",
  };

  const cases = {};
  let totalAll = 0;

  for (const type of types) {
    const data = readJson(path.join(testingDir, fileMap[type]));
    if (!data || !Array.isArray(data.test_cases)) {
      cases[type] = { total: 0 };
      continue;
    }

    const tcs = data.test_cases;
    const dist = { happy_path: 0, negative: 0, edge_case: 0, exception: 0 };
    for (const tc of tcs) {
      const t = tc.type || "happy_path";
      if (dist[t] !== undefined) dist[t]++;
      else dist.happy_path++;
    }

    cases[type] = { total: tcs.length, ...dist };
    totalAll += tcs.length;
  }

  return { cases, totalAll };
}

// ── genTest Metrics ──────────────────────────────────

function collectGenTestMetrics(testingDir) {
  const cacheDir = path.join(testingDir, ".cache");
  const coverageResult = readJson(path.join(cacheDir, "coverage-check-result.json"));
  const reviewResult = readJson(path.join(cacheDir, "merged-review-result.json"));
  const genState = readJson(path.join(cacheDir, "gen-test-state.json"));

  // Cases
  const { cases } = countCases(testingDir);

  // Coverage
  const coverage = { acRate: null, featureRate: null, acOpRate: null, stateTransitionRate: null, embeddedRuleRate: null };
  if (coverageResult) {
    if (coverageResult.acCoverage && typeof coverageResult.acCoverage.overallRate === "number") {
      coverage.acRate = coverageResult.acCoverage.overallRate;
    }
    // Feature rate: average across checks
    if (Array.isArray(coverageResult.checks)) {
      const rates = coverageResult.checks
        .map(c => c.featureCoverage?.rate)
        .filter(r => typeof r === "number");
      if (rates.length) coverage.featureRate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 100) / 100;

      // AC-OP rate
      const acOpRates = coverageResult.checks
        .map(c => c.acOpCoverage?.rate)
        .filter(r => typeof r === "number");
      if (acOpRates.length) coverage.acOpRate = Math.round(acOpRates.reduce((a, b) => a + b, 0) / acOpRates.length * 100) / 100;

      // State transition rate
      const stRates = coverageResult.checks
        .map(c => c.stateTransitionCoverage?.rate)
        .filter(r => typeof r === "number");
      if (stRates.length) coverage.stateTransitionRate = Math.round(stRates.reduce((a, b) => a + b, 0) / stRates.length * 100) / 100;
    }

    // Embedded rule rate: average across categories
    if (coverageResult.embeddedRuleCoverage?.categories) {
      const catRates = Object.values(coverageResult.embeddedRuleCoverage.categories)
        .map(c => c.rate)
        .filter(r => typeof r === "number");
      if (catRates.length) coverage.embeddedRuleRate = Math.round(catRates.reduce((a, b) => a + b, 0) / catRates.length * 100) / 100;
    }
  }

  // Quality
  const quality = { totalScore: null, action: null, breakdown: null };
  if (reviewResult) {
    quality.totalScore = typeof reviewResult.overall === "number" ? reviewResult.overall : null;
    quality.action = reviewResult.action || null;
    if (reviewResult.breakdown) {
      quality.breakdown = {};
      for (const [k, v] of Object.entries(reviewResult.breakdown)) {
        quality.breakdown[k] = { score: v.score, max: v.maxScore };
      }
    }
  }

  // Process
  const process = { fixRounds: null, gateOverrides: 0, firstPassYield: null };
  if (genState) {
    const waves = genState.completedWaves || [];
    // Wave 2 runs at least once; fix rounds = (wave 2 appearances - 1), but we count gateOverrides as proxy
    process.gateOverrides = (genState.gateOverrides || []).length;
    // firstPassYield: no gate overrides and no fix rounds (Wave 2 appeared at most once)
    process.firstPassYield = process.gateOverrides === 0 && waves.filter(w => w === 2).length <= 1;
  }

  // Duration (from state file timestamps — may not exist yet)
  const duration = { start: null, end: null, totalSeconds: null };
  if (genState?.startedAt) {
    duration.start = genState.startedAt;
    duration.end = coverageResult?.timestamp || reviewResult?.timestamp || null;
    if (duration.start && duration.end) {
      duration.totalSeconds = Math.round((new Date(duration.end) - new Date(duration.start)) / 1000);
    }
  }

  return { duration, cases, coverage, quality, process };
}

// ── runTest Metrics ──────────────────────────────────

function collectRunTestMetrics(testingDir, metricsDir) {
  const cacheDir = path.join(testingDir, ".cache");
  const testSummary = readJson(path.join(cacheDir, "test-summary.json"));
  const acMatrix = readJson(path.join(cacheDir, "ac-coverage-matrix.json"));
  const gateResult = readJson(path.join(cacheDir, "gate-result.json"));
  const evalReport = readJson(path.join(cacheDir, "evaluation-report.json"));
  const defectList = readJson(path.join(cacheDir, "defect-list.json"));
  const runState = readJson(path.join(cacheDir, "run-test-state.json"));

  // Pass Rate
  const passRate = { api: { total: 0, passed: 0, failed: 0, skipped: 0, rate: null }, e2e: { total: 0, passed: 0, failed: 0, skipped: 0, rate: null } };
  if (testSummary) {
    for (const section of ["api", "e2e"]) {
      const s = testSummary[section];
      if (!s) continue;
      passRate[section] = {
        total: s.total || 0,
        passed: s.passed || 0,
        failed: s.failed || 0,
        skipped: s.skipped || 0,
        rate: safeDiv(s.passed, s.total),
      };
    }
  }

  // AC Compliance
  const acCompliance = { total: null, passed: null, failed: null, uncovered: null, skipped: null, rate: null };
  if (acMatrix?.summary) {
    const s = acMatrix.summary;
    acCompliance.total = s.total || 0;
    acCompliance.passed = s.passed || 0;
    acCompliance.failed = s.failed || 0;
    acCompliance.uncovered = s.uncovered || 0;
    acCompliance.skipped = s.skipped || 0;
    acCompliance.rate = safeDiv(s.passed, s.total);
  }

  // Gate
  const gate = { total: null, passed: null, failed: null, rate: null };
  if (gateResult?.steps) {
    const steps = Object.entries(gateResult.steps).filter(([k, v]) => typeof v === "object" && v !== null && "passed" in v);
    gate.total = steps.length;
    gate.passed = steps.filter(([, v]) => v.passed === true).length;
    gate.failed = gate.total - gate.passed;
    gate.rate = safeDiv(gate.passed, gate.total);
  }

  // Script Quality
  const scriptQuality = { totalScore: null, verdict: null, breakdown: null };
  if (evalReport) {
    scriptQuality.totalScore = typeof evalReport.overallScore === "number" ? evalReport.overallScore : null;
    scriptQuality.verdict = evalReport.verdict || null;
    if (evalReport.dimensions) {
      scriptQuality.breakdown = {};
      for (const [k, v] of Object.entries(evalReport.dimensions)) {
        scriptQuality.breakdown[k] = { score: v.score, status: v.status };
      }
    }
  }

  // Errors
  const errorTypes = [
    "selector_not_found", "selector_ambiguous", "element_blocked",
    "api_path_error", "assertion_failed", "network_error",
    "browser_crash", "unknown", "framework_error", "config_missing",
  ];
  const errors = {};
  for (const t of errorTypes) errors[t] = 0;

  if (testSummary) {
    for (const section of ["api", "e2e"]) {
      const failures = testSummary[section]?.failures || [];
      for (const f of failures) {
        if (errors[f.errorType] !== undefined) errors[f.errorType]++;
      }
    }
  }

  // Defects
  const defects = { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0 }, byType: { frontend: 0, backend: 0 }, confirmedCount: 0, validRate: null, list: [] };
  if (Array.isArray(defectList)) {
    defects.total = defectList.length;
    for (const d of defectList) {
      if (defects.bySeverity[d.severity] !== undefined) defects.bySeverity[d.severity]++;
      if (defects.byType[d.type] !== undefined) defects.byType[d.type]++;
      defects.list.push({
        id: d.id,
        tcId: d.tcId || null,
        severity: d.severity,
        status: "found",
      });
    }
  }

  // Cross-run defect validation
  const prevMetrics = readJson(path.join(metricsDir, "metrics.json"));
  if (prevMetrics?.runTest?.defects?.list?.length && testSummary) {
    // Build set of passing tcIds from current run
    const passingTcIds = new Set();
    for (const section of ["api", "e2e"]) {
      // Passing = total - failed (no tcId in passed list, so we derive from failures)
      // We check: if a tcId was in previous failures but NOT in current failures → confirmed
    }
    const currentFailTcIds = new Set();
    for (const section of ["api", "e2e"]) {
      const failures = testSummary[section]?.failures || [];
      for (const f of failures) {
        if (f.tcId) currentFailTcIds.add(f.tcId);
      }
    }

    let confirmedCount = 0;
    for (const d of defects.list) {
      // Check if this defect was previously found and now the test passes
      const prevDefect = prevMetrics.runTest.defects.list.find(pd => pd.id === d.id);
      if (prevDefect && d.tcId && !currentFailTcIds.has(d.tcId)) {
        d.status = "confirmed";
        confirmedCount++;
      }
    }
    defects.confirmedCount = confirmedCount;
    defects.validRate = safeDiv(confirmedCount, defects.total);
  }

  // Process
  const process = { gateCheckRounds: null, qualityEvalRounds: null, retryCount: null, gateOverrides: 0, degradations: [] };
  if (runState) {
    process.gateOverrides = (runState.gateOverrides || []).length;
    process.degradations = runState.gateOverrides || [];
  }

  // Duration
  const duration = { start: null, end: null, totalSeconds: null };
  if (runState?.startedAt) {
    duration.start = runState.startedAt;
    duration.end = testSummary?.timestamp || null;
    if (duration.start && duration.end) {
      duration.totalSeconds = Math.round((new Date(duration.end) - new Date(duration.start)) / 1000);
    }
  }

  return { duration, passRate, acCompliance, gate, scriptQuality, errors, defects, process };
}

// ── Derived Metrics ──────────────────────────────────

function computeDerived(genTestMetrics, runTestMetrics, testingDir) {
  const derived = {
    testEffectiveness: null,
    defectDensity: null,
    realDefectRatio: null,
    envErrorRatio: null,
    negativeCaseRatio: null,
    firstPassYield: null,
    e2eDuration: null,
  };

  // testEffectiveness = confirmed defects / total cases
  const { totalAll } = countCases(testingDir);
  const confirmedDefects = runTestMetrics.defects.confirmedCount || 0;
  if (totalAll > 0 && confirmedDefects > 0) {
    derived.testEffectiveness = Math.round((confirmedDefects / totalAll) * 10000) / 10000;
  }

  // defectDensity = defects / AC count
  const cacheDir = path.join(testingDir, ".cache");
  const acAssignment = readJson(path.join(cacheDir, "ac-assignment.json"));
  if (acAssignment?.coverable && runTestMetrics.defects.total > 0) {
    const acCount = acAssignment.coverable.length || 1;
    derived.defectDensity = Math.round((runTestMetrics.defects.total / acCount) * 100) / 100;
  }

  // realDefectRatio = assertion_failed / total failures
  const errors = runTestMetrics.errors;
  const totalFailures = Object.values(errors).reduce((a, b) => a + b, 0);
  if (totalFailures > 0) {
    derived.realDefectRatio = safeDiv(errors.assertion_failed, totalFailures);
  }

  // envErrorRatio
  const envTypes = ["selector_not_found", "selector_ambiguous", "element_blocked",
    "network_error", "browser_crash", "config_missing", "framework_error"];
  const envCount = envTypes.reduce((sum, t) => sum + (errors[t] || 0), 0);
  if (totalFailures > 0) {
    derived.envErrorRatio = safeDiv(envCount, totalFailures);
  }

  // negativeCaseRatio
  const { cases } = countCases(testingDir);
  let totalCases = 0;
  let negCases = 0;
  for (const type of ["e2e", "api"]) {
    if (cases[type]) {
      totalCases += cases[type].total || 0;
      negCases += (cases[type].negative || 0) + (cases[type].edge_case || 0) + (cases[type].exception || 0);
    }
  }
  if (totalCases > 0) {
    derived.negativeCaseRatio = safeDiv(negCases, totalCases);
  }

  // firstPassYield
  derived.firstPassYield = genTestMetrics.process.firstPassYield;

  // e2eDuration
  const genDur = genTestMetrics.duration.totalSeconds;
  const runDur = runTestMetrics.duration.totalSeconds;
  if (genDur != null && runDur != null) {
    derived.e2eDuration = genDur + runDur;
  }

  return derived;
}

// ── Leak Defects ─────────────────────────────────────

function readLeakDefects(metricsDir, defectTotal) {
  const leak = { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0 }, leakRate: null, dre: null, list: [] };
  const leakData = readJson(path.join(metricsDir, "leak-defects.json"));
  if (leakData?.defects) {
    leak.total = leakData.defects.length;
    for (const d of leakData.defects) {
      if (leak.bySeverity[d.severity] !== undefined) leak.bySeverity[d.severity]++;
      leak.list.push(d);
    }
    // leakRate = escaped / total defects (target <5%)
    // dre = defects found before release / total defects (target >95%)
    const totalDefects = defectTotal + leak.total;
    if (totalDefects > 0) {
      leak.leakRate = safeDiv(leak.total, totalDefects);
      leak.dre = safeDiv(defectTotal, totalDefects);
    }
  }
  return leak;
}

// ── Run History ──────────────────────────────────────

function appendRunHistory(metricsDir, runTestMetrics) {
  const historyPath = path.join(metricsDir, "run-history.json");
  let history = readJson(historyPath) || { version: "1.0", runs: [] };

  const runId = (history.runs.length || 0) + 1;
  history.runs.push({
    runId,
    timestamp: new Date().toISOString(),
    passRate: {
      api: runTestMetrics.passRate.api.rate,
      e2e: runTestMetrics.passRate.e2e.rate,
    },
    defects: runTestMetrics.defects.list.map(d => ({
      id: d.id,
      tcId: d.tcId,
      status: d.status,
    })),
  });

  writeJson(historyPath, history);
}

// ── Main ─────────────────────────────────────────────

function main() {
  const { testingDir, stage } = parseArgs();

  if (!testingDir) {
    console.log(JSON.stringify({ status: "error", message: "缺少 --testing-dir 参数" }));
    process.exit(1);
  }

  if (!fs.existsSync(testingDir)) {
    console.log(JSON.stringify({ status: "error", message: `testing 目录不存在: ${testingDir}` }));
    process.exit(1);
  }

  const metricsDir = path.join(testingDir, "metrics");
  const metricsPath = path.join(metricsDir, "metrics.json");

  // Load existing metrics (for merge)
  const existing = readJson(metricsPath) || {};

  let genTestMetrics = existing.genTest || { duration: { start: null, end: null, totalSeconds: null }, cases: {}, coverage: {}, quality: { totalScore: null, action: null, breakdown: null }, process: { fixRounds: null, gateOverrides: 0, firstPassYield: null } };
  let runTestMetrics = existing.runTest || { duration: { start: null, end: null, totalSeconds: null }, passRate: { api: { total: 0, passed: 0, failed: 0, skipped: 0, rate: null }, e2e: { total: 0, passed: 0, failed: 0, skipped: 0, rate: null } }, acCompliance: { total: null, passed: null, failed: null, uncovered: null, skipped: null, rate: null }, gate: { total: null, passed: null, failed: null, rate: null }, scriptQuality: { totalScore: null, verdict: null, breakdown: null }, errors: {}, defects: { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0 }, byType: { frontend: 0, backend: 0 }, confirmedCount: 0, validRate: null, list: [] }, process: { gateCheckRounds: null, qualityEvalRounds: null, retryCount: null, gateOverrides: 0, degradations: [] } };

  if (stage === "gen-test" || stage === "both") {
    genTestMetrics = collectGenTestMetrics(testingDir);
    console.error("[OK] gen-test 指标采集完成");
  }

  if (stage === "run-test" || stage === "both") {
    runTestMetrics = collectRunTestMetrics(testingDir, metricsDir);
    console.error("[OK] run-test 指标采集完成");
  }

  // Derived
  const derived = computeDerived(genTestMetrics, runTestMetrics, testingDir);

  // Leak defects
  const leakDefects = readLeakDefects(metricsDir, runTestMetrics.defects.total);

  // Requirement from state file
  const cacheDir = path.join(testingDir, ".cache");
  const genState = readJson(path.join(cacheDir, "gen-test-state.json"));
  const runState = readJson(path.join(cacheDir, "run-test-state.json"));
  const requirement = genState?.requirement || runState?.requirement || existing.requirement || null;

  // Efficiency from session JSONL (if available)
  let efficiency = existing.efficiency || null;
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
  if (sessionId) {
    try {
      const { runExtract } = require("../forensic/extract.js");
      const { findSessionJsonl } = require("../forensic/lib.js");
      const jsonlPath = findSessionJsonl(sessionId, process.cwd());
      if (jsonlPath) {
        const result = runExtract(jsonlPath, null, null);  // no output to disk
        const s = result.summary;
        efficiency = {
          command: null,
          wallClock: {
            start: s.startTime,
            end: s.endTime,
            totalSeconds: s.wallSeconds,
          },
          llmTurns: s.llmTurns,
          tokens: {
            input: s.tokens.input,
            output: s.tokens.output,
            cacheRead: s.tokens.cacheRead,
            cacheCreation: s.tokens.cacheCreation,
            cacheHitRate: s.tokens.cacheHitRate,
          },
          timing: {
            totalToolMs: s.totalToolMs,
            totalThinkingMs: s.totalThinkingMs,
            toolToThinkingRatio: s.toolToThinkingRatio,
            byTool: s.timingByTool.map(t => ({ tool: t.tool, count: t.count, totalMs: Math.round(t.total * 1000), avgMs: Math.round(t.average * 1000), maxMs: Math.round(t.max * 1000) })),
            topSlowest: s.topSlowest.slice(0, 10),
          },
          toolCalls: s.toolBreakdown,
          subagents: {
            count: s.subagentCount,
            byType: s.agentsSpawned.reduce((acc, a) => { acc[a.name] = a.count; return acc; }, {}),
          },
        };
        console.error("[OK] 效率指标从 session JSONL 采集完成");
      }
    } catch (e) {
      console.error(`[WARN] 效率指标采集跳过: ${e.message}`);
    }
  }

  // Build final metrics
  const metrics = {
    version: "1.0",
    requirement,
    collectedAt: new Date().toISOString(),
    genTest: genTestMetrics,
    runTest: runTestMetrics,
    derived,
    leakDefects,
    efficiency,
  };

  writeJson(metricsPath, metrics);
  console.log(JSON.stringify({ status: "ok", path: metricsPath, requirement }));

  // Append run history (only when run-test stage)
  if (stage === "run-test" || stage === "both") {
    appendRunHistory(metricsDir, runTestMetrics);
    console.error("[OK] run-history.json 已更新");
  }

  // Summary to stderr
  console.error(`[SUMMARY] 需求: ${requirement || "未知"}`);
  if (stage === "gen-test" || stage === "both") {
    const gq = genTestMetrics.quality;
    const gc = genTestMetrics.coverage;
    console.error(`  gen-test: 质量评分=${gq.totalScore ?? "-"} AC覆盖率=${gc.acRate ?? "-"}%`);
  }
  if (stage === "run-test" || stage === "both") {
    const rp = runTestMetrics.passRate;
    const rd = runTestMetrics.defects;
    console.error(`  run-test: API通过率=${rp.api.rate ?? "-"}% E2E通过率=${rp.e2e.rate ?? "-"}% 缺陷=${rd.total}(已确认=${rd.confirmedCount})`);
  }
}

main();
