#!/usr/bin/env node
/**
 * gate-check-flow.js
 * API 流程测试门禁检查（5 项）
 *
 * 支持 testingRepo 模式：当传入 --testing-repo 时，
 * 从集中测试仓库的 flows/FLOW/api/ 或 tests/api/flows/ 目录收集脚本文件。
 *
 * 用法：node gate-check-flow.js --testing-dir testing/ [--testing-repo <path>]
 * 输出：testing/.cache/gate-flow-result.json
 */
"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = "testing";
  let testingRepo = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--testing-repo" && argv[i + 1]) testingRepo = argv[++i];
  }
  return { testingDir, testingRepo };
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

function extractTcIds(content, prefix) {
  const pattern = new RegExp(
    `\\b(${prefix}-[A-Z]+-\\d{3}(?:-\\d{2})?(?:-[SEB]\\d{2})?)\\b`, "g"
  );
  const ids = new Set();
  let m;
  while ((m = pattern.exec(content)) !== null) ids.add(m[1]);
  return [...ids];
}

/**
 * 从 testingRepo 收集 flow API 测试脚本
 * testingRepo 结构: {testingRepo}/flows/{flowId}/api/*.flow.api.test.ts
 */
function collectFlowScriptsFromRepo(testingRepo) {
  const root = testingRepo;
  const files = [];

  // 方案 C 优先：tests/api/flows/
  const newApiFlowsDir = path.join(root, "tests", "api", "flows");
  if (fs.existsSync(newApiFlowsDir)) {
    files.push(...findFiles(newApiFlowsDir, /flow\.api\.test\.ts$/));
  } else {
    // v1 旧结构 fallback
    const flowsDir = path.join(root, "flows");
    if (fs.existsSync(flowsDir)) {
      for (const d of fs.readdirSync(flowsDir, { withFileTypes: true })) {
        if (d.isDirectory()) {
          const apiDir = path.join(flowsDir, d.name, "api");
          if (fs.existsSync(apiDir)) {
            files.push(...findFiles(apiDir, /flow\.api\.test\.ts$/));
          }
        }
      }
    }

    const apiTestsDir = path.join(root, "api-tests");
    if (fs.existsSync(apiTestsDir)) {
      files.push(...findFiles(apiTestsDir, /flow\.api\.test\.ts$/));
    }
  }

  return files;
}

/**
 * 定位 flow 案例文档
 * 案例文档始终在本地 testing/test-cases/ 目录中（由 gen-test 生成），
 * testingRepo 只存储测试脚本，不存储案例文档。
 */
function findFlowCasesFile(testingDir) {
  return path.join(testingDir, "test-cases/api-flow-test-cases.md");
}

function main() {
  const { testingDir, testingRepo } = parseArgs();
  const cacheDir = path.join(testingDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  const steps = [];
  let passed = true;

  // Step 1: 文件完整性
  const casesFile = findFlowCasesFile(testingDir);

  // 收集 flow API 测试脚本：优先从 testingRepo，回退到本地 testing 目录
  let scriptFiles;
  if (testingRepo) {
    scriptFiles = collectFlowScriptsFromRepo(testingRepo);
    console.log(`[REPO] testing-repo 模式: ${testingRepo}`);
    console.log(`[REPO] 找到 ${scriptFiles.length} 个 flow API 脚本`);
  } else {
    scriptFiles = findFiles(
      path.join(testingDir, "scripts/api/tests"),
      /flow\.api\.test\.ts$/
    );
  }

  const step1 = { step: 1, name: "文件完整性", level: "block", passed: true, details: [] };
  if (!fs.existsSync(casesFile)) {
    step1.passed = false;
    step1.details.push("api-flow-test-cases.md 不存在");
  }
  if (scriptFiles.length === 0) {
    step1.passed = false;
    step1.details.push("无 *-flow.api.test.ts 脚本文件");
  } else {
    step1.details.push(`${scriptFiles.length} 个 flow API 脚本`);
  }
  if (!step1.passed) passed = false;
  steps.push(step1);

  // Step 2: TC 覆盖率
  const casesContent = readSafe(casesFile);
  let allScriptContent = "";
  for (const f of scriptFiles) allScriptContent += fs.readFileSync(f, "utf-8") + "\n";

  const caseIds = extractTcIds(casesContent, "FLOW");
  const scriptIds = extractTcIds(allScriptContent, "FLOW");
  const missing = caseIds.filter(id => !scriptIds.includes(id));

  const step2 = {
    step: 2, name: "TC 覆盖率", level: "block", passed: missing.length === 0,
    details: missing.length > 0 ? [`缺失 ${missing.length} 个 TC: ${missing.join(", ")}`] : [],
  };
  if (!step2.passed) passed = false;
  steps.push(step2);

  // Step 3: 数据传递检查（let 变量声明）
  const hasLetDecl = /\blet\s+\w+.*:/.test(allScriptContent);
  const step3 = {
    step: 3, name: "数据传递检查", level: "warn", passed: hasLetDecl,
    details: hasLetDecl ? [] : ["未发现 let 变量声明，步骤间可能无数据传递"],
  };
  steps.push(step3);

  // Step 4: 清理逻辑检查（afterAll 存在）
  const hasAfterAll = /afterAll/.test(allScriptContent);
  const step4 = {
    step: 4, name: "清理逻辑检查", level: "warn", passed: hasAfterAll,
    details: hasAfterAll ? [] : ["未发现 afterAll，测试数据可能未清理"],
  };
  steps.push(step4);

  // Step 5: 步骤连续性（S01→S02→S03）
  const step5 = { step: 5, name: "步骤连续性", level: "block", passed: true, details: [] };
  const stepNums = [...allScriptContent.matchAll(/FLOW-\w+-\d{3}-S(\d{2})/g)]
    .map(m => parseInt(m[1], 10));
  if (stepNums.length > 0) {
    const sorted = [...new Set(stepNums)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 1) {
        step5.passed = false;
        step5.details.push(`步骤不连续: S${String(sorted[i - 1]).padStart(2, "0")} → S${String(sorted[i]).padStart(2, "0")}`);
      }
    }
  }
  if (!step5.passed) passed = false;
  steps.push(step5);

  // Step 6: 数据变更验证覆盖率（warn 级，不阻塞）
  const writeStepPattern = /FLOW-\w+-\d{3}-S\d{2}[^)]*(?:创建|编辑|修改|删除|提交|撤回|作废|审批|update|create|delete|put|post|del)/i;
  const snapshotPattern = /(?:before|after|unchanged|不变|expect\([\w.]+\.(\w+)\)\.toBe\([\w.]+\.\1\))/i;
  const step6 = { step: 6, name: "数据变更验证覆盖率", level: "warn", passed: true, details: [] };
  const writeStepsInScript = allScriptContent.match(/test\s*\([^)]*FLOW-\w+-\d{3}-S\d{2}[^)]*(?:创建|编辑|修改|删除|提交|审批)/gi) || [];
  if (writeStepsInScript.length > 0) {
    const hasSnapshotAssert = snapshotPattern.test(allScriptContent);
    if (!hasSnapshotAssert) {
      step6.passed = false;
      step6.details.push(`${writeStepsInScript.length} 个写操作步骤未发现数据快照断言（before/after 对比），建议参照 api-flow-case-writing.md 补充`);
    }
  }
  steps.push(step6);

  const result = { passed, steps, timestamp: new Date().toISOString() };
  const outputPath = path.join(cacheDir, "gate-flow-result.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`流程测试门禁: ${passed ? "[OK] 通过" : "[FAIL] 未通过"}`);
  for (const s of steps) {
    const icon = s.passed ? "[OK]" : (s.level === "block" ? "[FAIL]" : "[WARN]");
    console.log(`  ${icon} 步骤 ${s.step}: ${s.name}`);
    for (const d of s.details) console.log(`     ${d}`);
  }

  process.exit(passed ? 0 : 1);
}

main();
