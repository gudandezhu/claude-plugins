#!/usr/bin/env node
/**
 * generate-ac-matrix.js
 * 聚合 AC 覆盖矩阵数据：ac.md + 案例文档 + test-summary.json → ac-coverage-matrix.json
 * 消费方：run-test 步骤四-B → acceptance-report-template.md（test-execution 技能）
 *
 * 用法：node generate-ac-matrix.js \
 *   --ac-file $WORK_DIR/design/ac.md \
 *   --testing-dir $WORK_DIR/testing \
 *   --summary-file $WORK_DIR/testing/.cache/test-summary.json
 * 输出：testing/.cache/ac-coverage-matrix.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("../lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let acFile = null;
  let testingDir = "testing";
  let summaryFile = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ac-file" && argv[i + 1]) acFile = argv[++i];
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--summary-file" && argv[i + 1]) summaryFile = argv[++i];
  }
  if (!summaryFile) summaryFile = path.join(testingDir, ".cache", "test-summary.json");
  return { acFile, testingDir, summaryFile };
}

function readSafe(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

// 从 ac.md 提取所有 AC/UI 编号和描述
function parseAcFile(acContent) {
  const entries = [];
  const AC_PATTERNS = [
    /\b(AC-[A-Z]+-\d+[a-z]?)\b/g,
    /\b(UI-[A-Z]+-\d+)\b/g,
  ];
  const EXCLUDED_PREFIXES = ["AC-NF-"];
  const seen = new Set();
  for (const p of AC_PATTERNS) {
    const pat = new RegExp(p.source, "g");
    let m;
    while ((m = pat.exec(acContent)) !== null) {
      const id = m[1];
      if (seen.has(id)) continue;
      if (id.startsWith("AC-") && EXCLUDED_PREFIXES.some(prefix => id.startsWith(prefix))) continue;
      seen.add(id);
      // 提取描述：找 "| AC-TAB-01 | 描述 |" 格式的定义行（AC 编号作为表格第一列）
      const defLineMatch = acContent.match(new RegExp(`\\|\\s*${id.replace(/[-]/g, "\\-")}\\s*\\|([^\\n]*)`));
      const description = defLineMatch
        ? defLineMatch[1].split("|")[0].trim().slice(0, 80)
        : "";
      entries.push({ acId: id, description });
    }
  }
  return entries;
}

// 从案例文档的"覆盖AC"列聚合 TC → AC 映射
function parseCaseCoverage(casesContent) {
  const tcToAc = {};

  // 按用例块解析（### FE-XXX / ### API-XXX / ### FLOW-XXX）
  const blocks = casesContent.split(/(?=###\s+(?:FE|API|FLOW)-)/);
  for (const block of blocks) {
    // 提取 TC 编号：支持两种格式
    //   1. E2E/API 表格行：用例ID | FE-XXX-001
    //   2. Flow 标题行：### FLOW-XXX-001: 描述
    const tcMatch = block.match(/用例ID\s*[|｜]\s*((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/)
      || block.match(/^###\s+((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)\s*[:：]/m);

    // 提取覆盖AC：支持表格行和独立行（**覆盖AC**: AC-XX）
    const coverMatch = block.match(/覆盖\s*AC\s*[:：]\s*([\w\-.\s,，;；（()）]+)/i);

    if (tcMatch && coverMatch) {
      const tcId = tcMatch[1].trim();
      const acIds = coverMatch[1].split(/[,，;；\s]+/)
        .map(id => id.trim().replace(/[（(].*$/, ""))
        .filter(id => id && /^(AC|UI)-/.test(id));
      if (acIds.length > 0) {
        tcToAc[tcId] = acIds;
      }
    }
  }
  return tcToAc;
}

// 从 test-summary.json 构建 TC 编号 → 执行结果映射
function buildTcResultMap(summaryFile) {
  if (!fs.existsSync(summaryFile)) return { map: {}, skipped: [] };
  const summary = safeReadJson(summaryFile, { fallback: null });
  if (!summary) return { map: {}, skipped: [] };
  const map = {};
  const skipped = [];
  const tcPattern = /^((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/;
  // 支持 { suites: [{ tests: [{ title, status }] }] } 和 { tests: [{ title, status }] }
  const tests = [];
  if (summary.suites) {
    for (const suite of summary.suites) {
      for (const test of suite.tests || []) tests.push(test);
    }
  } else if (summary.tests) {
    tests.push(...summary.tests);
  }
  for (const test of tests) {
    const title = test.title || test.name || "";
    const m = title.match(tcPattern);
    if (m) {
      const status = test.status || "UNKNOWN";
      map[m[1]] = status;
      // 新增: 收集 skipped 测试
      if (status === "skipped") {
        skipped.push(m[1]);
      }
    }
  }
  return { map, skipped };
}

// 读取 skipped-gates.json
function readSkippedGates(testingDir) {
  const filePath = path.join(testingDir, ".cache", "skipped-gates.json");
  if (!fs.existsSync(filePath)) return [];
  return safeReadJson(filePath, { fallback: [] });
}

function main() {
  const { acFile, testingDir, summaryFile } = parseArgs();
  const cacheDir = path.join(testingDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const outputPath = path.join(cacheDir, "ac-coverage-matrix.json");

  // ac.md 不存在时报错（ac.md 是 AC 覆盖率 100% 保障的前提，所有命令已在前置检查中阻塞）
  if (!acFile || !fs.existsSync(acFile)) {
    console.error("[FAIL] ac.md 不存在，AC 覆盖矩阵无法生成。请先执行 /architect 生成 AC 清单。");
    process.exit(1);
  }

  const acContent = readSafe(acFile);
  const acEntries = parseAcFile(acContent);

  // 读取所有案例文档
  const caseFiles = [
    path.join(testingDir, "test-cases/e2e-test-cases.md"),
    path.join(testingDir, "test-cases/api-test-cases.md"),
    path.join(testingDir, "test-cases/api-flow-test-cases.md"),
  ];
  const allCasesContent = caseFiles.map(f => readSafe(f)).join("\n");
  const tcToAc = parseCaseCoverage(allCasesContent);

  // 构建 AC → TC 反向映射
  const acToTcs = {};
  for (const [tcId, acIds] of Object.entries(tcToAc)) {
    for (const acId of acIds) {
      if (!acToTcs[acId]) acToTcs[acId] = [];
      acToTcs[acId].push(tcId);
    }
  }

  // 构建 TC → 执行结果映射
  const { map: tcResultMap, skipped: skippedTcs } = buildTcResultMap(summaryFile);

  // 生成矩阵
  const matrix = acEntries.map(({ acId, description }) => {
    const testCases = acToTcs[acId] || [];
    let result = "UNCOVERED";
    if (testCases.length > 0) {
      const statuses = testCases.map(tc => tcResultMap[tc] || "UNKNOWN");
      if (statuses.every(s => s === "passed")) result = "PASS";
      else if (statuses.some(s => s === "failed")) result = "FAIL";
      else if (statuses.some(s => s === "skipped")) result = "SKIPPED";
      else if (statuses.every(s => s === "UNKNOWN")) result = "UNKNOWN";
      else result = "PARTIAL";
    }
    return { acId, description, testCases, result, note: "" };
  });

  // 快速通道任务
  const skippedGates = readSkippedGates(testingDir);
  const quickPassTasks = skippedGates.map(g => ({
    task: `${g.command}（${g.reason || "快速通道"}）`,
    skippedGates: (g.skippedChecks || []).join(", "),
    acCoverageStatus: `跳过于 ${g.skippedAt || "未知时间"}`,
  }));

  const passed = matrix.filter(m => m.result === "PASS").length;
  const failed = matrix.filter(m => m.result === "FAIL").length;
  const skipped = matrix.filter(m => m.result === "SKIPPED").length;
  const uncovered = matrix.filter(m => m.result === "UNCOVERED").length;
  const unknown = matrix.filter(m => m.result === "UNKNOWN").length;
  const partial = matrix.filter(m => m.result === "PARTIAL").length;

  // 功能覆盖维度矩阵（tree-context.json 存在时）
  let featureMatrix = null;
  let uncoveredFeatures = [];
  const treeContextPath = path.join(testingDir, '.cache', 'tree-context.json');
  
  if (fs.existsSync(treeContextPath)) {
    const treeContext = safeReadJson(treeContextPath, { fallback: null });
    if (treeContext && treeContext.functionTree?.featureIndex) {
        const featureIndex = treeContext.functionTree.featureIndex;
        featureMatrix = [];
        
        for (const [featureId, info] of Object.entries(featureIndex)) {
          // 查找关联的 TC（通过 featureId 匹配案例内容）
          const relatedTcs = Object.keys(tcToAc).filter(tcId => {
            // 检查案例文档中是否包含该功能 ID
            return allCasesContent.includes(featureId);
          });
          
          const tcResults = relatedTcs.map(tc => tcResultMap[tc] || 'UNKNOWN');
          let result = 'UNCOVERED';
          if (relatedTcs.length > 0) {
            if (tcResults.every(s => s === 'passed')) result = 'PASS';
            else if (tcResults.some(s => s === 'failed')) result = 'FAIL';
            else if (tcResults.every(s => s === 'UNKNOWN')) result = 'UNKNOWN';
            else result = 'PARTIAL';
          }
          
          featureMatrix.push({
            featureId,
            featureName: info.name || '',
            page: info.page || '',
            group: info.group || '',
            relatedTcs,
            passed: tcResults.filter(s => s === 'passed').length,
            failed: tcResults.filter(s => s === 'failed').length,
            skipped: tcResults.filter(s => s === 'skipped').length,
            result
          });
          
          if (result === 'UNCOVERED') {
            uncoveredFeatures.push(featureId);
          }
        }
      }
  }

  const output = {
    matrix,
    quickPassTasks,
    summary: { total: matrix.length, passed, failed, skipped, uncovered, unknown, partial },
    // 新增: skipped TC 列表，供 check-ac-test-compliance.js 消费
    skippedTcs,
  };
  
  // 添加功能维度矩阵（存在时）
  if (featureMatrix) {
    output.featureMatrix = featureMatrix;
    output.featureSummary = {
      total: featureMatrix.length,
      covered: featureMatrix.length - uncoveredFeatures.length,
      uncovered: uncoveredFeatures.length
    };
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`[OK] AC 覆盖矩阵生成完成: ${matrix.length} 条 AC，通过 ${passed}，失败 ${failed}，跳过 ${skipped}，未覆盖 ${uncovered}，未知 ${unknown}，部分通过 ${partial}`);
  if (skippedTcs.length > 0) {
    console.log(`[WARN] 跳过的 TC: ${skippedTcs.join(", ")}`);
  }
  if (featureMatrix) {
    console.log(`[OK] 功能覆盖维度: ${featureMatrix.length} 个功能，已覆盖 ${featureMatrix.length - uncoveredFeatures.length}，未覆盖 ${uncoveredFeatures.length}`);
    if (uncoveredFeatures.length > 0 && uncoveredFeatures.length <= 10) {
      console.log(`[WARN] 未覆盖功能: ${uncoveredFeatures.join(', ')}`);
    }
  }
}

main();
