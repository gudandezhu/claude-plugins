#!/usr/bin/env node
"use strict";
/**
 * quality-evaluator.js
 * Agent 3 质量评测引擎 — 6 维度全量评测（Phase 2）
 *
 * 评测维度：
 *   1. 分支覆盖率 — 方法论产物分支 vs 案例覆盖
 *   2. 边界完整性 — 边界条件识别 vs 边界 TC
 *   3. 异常路径覆盖 — 异常路径识别 vs 异常 TC
 *   4. 断言准确性 — 案例预期结果可验证性 + 脚本断言数
 *   5. 脚本可执行性 — gate-result.json 4a-4g 通过率
 *   6. 语义一致性 — 案例步骤关键词 vs 脚本内容匹配
 *
 * 驳回模式：
 *   Type A（分支遗漏/边界缺失/异常缺失）→ Agent 1 补充案例
 *   Type B（断言不准/脚本质量）→ Agent 2 修复脚本
 *   Type C（语义偏差）→ Agent 1 + Agent 2 联合修复
 */
const fs = require("fs");
const path = require("path");

const PHASE = 2;

// ─── 常量 ────────────────────────────────────────────────────
const BOUNDARY_KEYWORDS = /边界|最大|最小|临界|超出|上限|下限|极值|溢出|超限|满额|归零/;
const EXCEPTION_KEYWORDS = /异常|超时|不可用|失败|错误|冲突|中断|拒绝|禁止|无权限|不存在|已删除|已过期|非法|无效/;
const VAGUE_EXPECTED = /^(成功|通过|正常|无异常|正确|执行成功|操作成功|返回成功|处理成功|功能正常|页面正常|跳转正常)$/;

const SCORE_PASS = 95;
const SCORE_WARN = 80;

// ─── 参数解析 ────────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = "";
  let methodologyDir = "";
  let gateResultPath = "";
  let outputPath = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--methodology-dir" && argv[i + 1]) methodologyDir = argv[++i];
    if (argv[i] === "--gate-result" && argv[i + 1]) gateResultPath = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) outputPath = argv[++i];
  }
  if (!outputPath && testingDir) {
    outputPath = path.join(testingDir, ".cache", "evaluation-report.json");
  }
  return { testingDir, methodologyDir, gateResultPath, outputPath };
}

// ─── 工具函数 ────────────────────────────────────────────────
function statusFromScore(score) {
  return score >= SCORE_PASS ? "PASS" : score >= SCORE_WARN ? "WARN" : "FAIL";
}

function findFilesRecursive(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFilesRecursive(full, ext));
      } else if (entry.name.endsWith(ext)) {
        results.push(full);
      }
    }
  } catch (_) { /* ignore */ }
  return results;
}

function readJsonSafe(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch (_) { return null; }
}

function resolveTestingRepoPath(testingDir) {
  const config = readJsonSafe(path.join(testingDir, "test-config.json"));
  if (!config || !config.testingRepo || !config.testingRepo.path) return null;
  const repoBase = config.testingRepo.path.replace(
    /\$JLC_AI_WORKSPACE/g, process.env.JLC_AI_WORKSPACE || ""
  );
  return repoBase;
}

function findScriptFiles(testingDir) {
  const dirs = [
    path.join(testingDir, "scripts/e2e/tests"),
    path.join(testingDir, "scripts/flow"),
    path.join(testingDir, "scripts/api/tests"),
  ];
  const repoPath = resolveTestingRepoPath(testingDir);
  if (repoPath) {
    dirs.push(
      path.join(repoPath, "scripts/e2e/tests"),
      path.join(repoPath, "scripts/flow"),
      path.join(repoPath, "scripts/api/tests")
    );
  }
  const files = new Set();
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const ext of [".spec.ts", ".test.ts"]) {
      for (const f of findFilesRecursive(d, ext)) files.add(f);
    }
  }
  return [...files];
}

function extractBlockContent(fullContent, startIdx) {
  let braceStart = fullContent.indexOf("{", startIdx);
  if (braceStart === -1) return "";
  let depth = 0;
  for (let i = braceStart; i < fullContent.length; i++) {
    if (fullContent[i] === "{") depth++;
    else if (fullContent[i] === "}") { depth--; if (depth === 0) return fullContent.slice(braceStart, i + 1); }
  }
  return fullContent.slice(braceStart);
}

// ─── 案例元数据提取（增强版） ─────────────────────────────────
function extractCaseMetadata(testingDir) {
  const caseFiles = [
    path.join(testingDir, "test-cases/e2e-test-cases.md"),
    path.join(testingDir, "test-cases/api-flow-test-cases.md"),
    path.join(testingDir, "test-cases/api-test-cases.md"),
  ];
  const cases = [];
  for (const cf of caseFiles.filter(f => fs.existsSync(f))) {
    const content = fs.readFileSync(cf, "utf-8");
    const blocks = content.split(/(?=###\s+(?:FE|API|FLOW)-)/);
    for (const block of blocks) {
      const tcMatch = block.match(/(?:###\s+|用例ID\s*[|｜]\s*)((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/);
      if (!tcMatch) continue;
      const tcId = tcMatch[1];
      const typeMatch = block.match(/类型\s*[|｜]\s*(\S+)/);
      const methodMatch = block.match(/设计方法\s*[|｜]\s*(\S+)/);
      const stepsMatch = block.match(/步骤[\/|]操作[\s\S]*?(?=预期结果|##|$)/);
      const expectedMatch = block.match(/预期结果[\s\S]*?(?=设计方法|##|$)/);

      const blockText = block.slice(0, 3000);
      const expectedText = expectedMatch ? expectedMatch[0] : "";

      cases.push({
        tcId,
        type: typeMatch ? typeMatch[1] : "",
        designMethod: methodMatch ? methodMatch[1] : "",
        hasSteps: stepsMatch ? stepsMatch[0].split(/\n/).filter(l => l.trim().startsWith("|") || l.trim().startsWith("-") || l.trim().match(/^\d+\./)).length > 1 : false,
        hasExpected: expectedMatch ? expectedMatch[0].length > 20 : false,
        blockText,
        expectedText,
      });
    }
  }
  return cases;
}

// ─── 脚本 test() 块提取 ──────────────────────────────────────
function extractScriptTestBlocks(scriptFiles) {
  const blocks = [];
  for (const file of scriptFiles) {
    let content;
    try { content = fs.readFileSync(file, "utf-8"); } catch (_) { continue; }
    const testRegex = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = testRegex.exec(content)) !== null) {
      const title = match[1];
      const blockContent = extractBlockContent(content, match.index);
      const tcIdMatch = title.match(/((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/);
      const expectCount = (blockContent.match(/expect\s*\(/g) || []).length;
      const comments = (blockContent.match(/\/\/[^\n]*[一-鿿]/g) || []).map(c => c.replace(/\/\/\s*/, ""));
      const strings = (blockContent.match(/['"`][^'"`\n]{2,}[一-鿿][^'"`\n]*['"`]/g) || []).map(s => s.slice(1, -1));
      blocks.push({
        file: path.basename(file),
        title,
        tcId: tcIdMatch ? tcIdMatch[1] : null,
        expectCount,
        comments,
        strings,
        content: blockContent.slice(0, 3000),
      });
    }
  }
  return blocks;
}

// ─── 维度 1：分支覆盖率（方法论驱动） ───────────────────────
function checkBranchCoverage(methodologyDir, cases, testingDir) {
  // Try JSON-based methodology first (backward compatible)
  if (methodologyDir && fs.existsSync(methodologyDir)) {
    const methodFiles = fs.readdirSync(methodologyDir).filter(f => f.endsWith(".json"));
    if (methodFiles.length > 0) {
      return checkBranchCoverageFromJson(methodologyDir, methodFiles, cases);
    }
  }

  // Fallback: parse tech-design.md for state machine / state transition descriptions
  const techDesignResult = checkBranchCoverageFromTechDesign(testingDir, cases);
  if (techDesignResult) return techDesignResult;

  return { score: 80, status: "WARN", details: "无方法论产物且未找到技术设计文档中的状态描述，按默认评估", coverageDetails: [], uncoveredBranches: [] };
}

function checkBranchCoverageFromJson(methodologyDir, methodFiles, cases) {
  const coverageDetails = [];
  let totalBranches = 0;
  let coveredBranches = 0;

  for (const mf of methodFiles) {
    const methodData = readJsonSafe(path.join(methodologyDir, mf));
    if (!methodData) { coverageDetails.push({ file: mf, error: "JSON 解析失败" }); continue; }

    const method = methodData.method || mf.replace(".json", "");

    if (method === "state-machine" || method === "state_transition") {
      const entities = methodData.entities || [];
      for (const entity of entities) {
        for (const t of (entity.transitions || [])) {
          totalBranches++;
          const desc = `${entity.name}: ${t.from} → ${t.to} (${t.trigger})`;
          const covered = cases.some(c => c.hasSteps && c.hasExpected && isTransitionCovered(c, t, entity.name));
          if (covered) coveredBranches++;
          coverageDetails.push({ method: "state-machine", branch: desc, covered });
        }
        for (const t of (entity.invalidTransitions || [])) {
          totalBranches++;
          const desc = `${entity.name}: ${t.from} → ${t.to} (非法迁移)`;
          const covered = cases.some(c => c.hasSteps && isInvalidTransitionCovered(c, t, entity.name));
          if (covered) coveredBranches++;
          coverageDetails.push({ method: "state-machine", branch: desc, covered, isInvalid: true });
        }
      }
    } else if (method === "business-rule-matrix" || method === "decision-table" || method === "decision_table") {
      for (const row of (methodData.matrix || [])) {
        totalBranches++;
        const desc = `${row.role} × ${row.entity} × ${row.operation}`;
        const covered = cases.some(c => c.hasSteps && isMatrixRowCovered(c, row));
        if (covered) coveredBranches++;
        coverageDetails.push({ method, branch: desc, covered });
      }
      for (const gap of (methodData.gaps || [])) {
        totalBranches++;
        const desc = `${gap.role} × ${gap.entity} × ${gap.operation} (未授权)`;
        const covered = cases.some(c => c.hasSteps && isGapCovered(c, gap));
        if (covered) coveredBranches++;
        coverageDetails.push({ method, branch: desc, covered, isGap: true });
      }
    } else if (method === "event-storming" || method === "event_storming") {
      for (const chain of (methodData.chains || [])) {
        totalBranches++;
        const desc = chain.events ? chain.events.join(" → ") : chain.name || "unknown";
        const covered = cases.some(c => c.hasSteps && c.hasExpected && isEventChainCovered(c, chain));
        if (covered) coveredBranches++;
        coverageDetails.push({ method: "event-storming", branch: desc, covered });
      }
    } else {
      const hints = methodData.test_case_hints || [];
      totalBranches += hints.length;
      coveredBranches += hints.length;
      for (const hint of hints) {
        coverageDetails.push({ method, branch: hint.source_artifact || "unknown", covered: true });
      }
    }
  }

  if (totalBranches === 0) {
    return { score: 100, status: "PASS", details: "无方法论分支需要检查", coverageDetails, uncoveredBranches: [] };
  }
  const score = Math.round((coveredBranches / totalBranches) * 100);
  const uncovered = coverageDetails.filter(d => !d.covered).map(d => d.branch);
  return {
    score, status: statusFromScore(score),
    details: `覆盖率 ${score}% (${coveredBranches}/${totalBranches})`,
    coverageDetails, uncoveredBranches: uncovered,
  };
}

function checkBranchCoverageFromTechDesign(testingDir, cases) {
  // Walk up from testing/ to find tech-design.md
  let searchDir = testingDir;
  for (let i = 0; i < 3; i++) {
    const candidate = path.join(searchDir, "tech-design.md");
    if (fs.existsSync(candidate)) {
      return checkBranchCoverageFromTechDesignFile(candidate, cases);
    }
    const parentDir = path.dirname(searchDir);
    if (parentDir === searchDir) break;
    searchDir = parentDir;
  }
  return null;
}

function checkBranchCoverageFromTechDesignFile(techDesignPath, cases) {
  let content;
  try { content = fs.readFileSync(techDesignPath, "utf-8"); } catch (_) { return null; }

  // Look for state machine / state transition sections
  const stateKeywords = /状态机|状态流转|状态图|状态转换|状态迁移|状态定义/i;
  const sections = content.split(/(?=^#{1,3}\s)/m);
  const stateSections = sections.filter(s => stateKeywords.test(s));

  if (stateSections.length === 0) return null;

  // Extract state transitions from text patterns
  // Pattern 1: "A -> B" or "A → B" or "A 转换为 B"
  // Pattern 2: tables with state columns
  const transitions = [];

  for (const section of stateSections) {
    // Arrow-style transitions: "待提交 → 已提交" or "待提交 -> 已提交"
    const arrowPattern = /([一-鿿\w]+)\s*(?:→|->|➡|转换为|转为|变更为|变更为)\s*([一-鿿\w]+)/g;
    let match;
    while ((match = arrowPattern.exec(section)) !== null) {
      const from = match[1].trim();
      const to = match[2].trim();
      // Filter out non-state patterns (like pure numbers or very short strings)
      if (from.length >= 2 && to.length >= 2 && !/^\d+$/.test(from) && !/^\d+$/.test(to)) {
        transitions.push({ from, to, trigger: "" });
      }
    }

    // Table-style transitions: rows with state columns
    const lines = section.split("\n");
    for (const line of lines) {
      if (!line.includes("|") || line.includes("---")) continue;
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      // Look for rows that have state-like values in adjacent cells
      if (cells.length >= 2) {
        for (let i = 0; i < cells.length - 1; i++) {
          const cell = cells[i];
          const nextCell = cells[i + 1];
          if (/待|已|草稿|提交|审核|完成|取消|作废|关闭|退回|拒绝|生效|失效|过期/.test(cell) &&
              /待|已|草稿|提交|审核|完成|取消|作废|关闭|退回|拒绝|生效|失效|过期/.test(nextCell)) {
            if (cell !== nextCell) {
              transitions.push({ from: cell, to: nextCell, trigger: "" });
            }
          }
        }
      }
    }
  }

  // Deduplicate transitions
  const seen = new Set();
  const uniqueTransitions = [];
  for (const t of transitions) {
    const key = `${t.from}|${t.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTransitions.push(t);
    }
  }

  if (uniqueTransitions.length === 0) return null;

  // Check coverage
  const coverageDetails = [];
  let totalBranches = uniqueTransitions.length;
  let coveredBranches = 0;

  for (const t of uniqueTransitions) {
    const desc = `${t.from} → ${t.to}`;
    const covered = cases.some(c =>
      c.hasSteps && c.hasExpected &&
      textContains(c.blockText || "", t.from) &&
      textContains(c.blockText || "", t.to)
    );
    if (covered) coveredBranches++;
    coverageDetails.push({ method: "tech-design-state", branch: desc, covered });
  }

  const score = totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 100;
  const uncovered = coverageDetails.filter(d => !d.covered).map(d => d.branch);
  return {
    score, status: statusFromScore(score),
    details: `从 tech-design.md 提取 ${uniqueTransitions.length} 条状态迁移，覆盖率 ${score}% (${coveredBranches}/${totalBranches})`,
    coverageDetails, uncoveredBranches: uncovered,
  };
}

// ─── 匹配函数（Phase 2 真实关键词匹配） ──────────────────────
function textContains(text, keyword) {
  if (!keyword) return true;
  return (text || "").toLowerCase().includes(keyword.toLowerCase());
}

function isTransitionCovered(tc, transition, entityName) {
  const text = tc.blockText || "";
  const hasEntity = textContains(text, entityName);
  const hasFrom = textContains(text, transition.from);
  const hasTo = textContains(text, transition.to);
  const hasTrigger = textContains(text, transition.trigger);
  return hasEntity && (hasFrom || hasTo || hasTrigger);
}

function isInvalidTransitionCovered(tc, transition, entityName) {
  const isExType = /异常|非法|无效|不允许|negative|exception/i.test(tc.type || "") || tc.tcId.includes("-E");
  if (!isExType) return false;
  const text = tc.blockText || "";
  return textContains(text, entityName) && textContains(text, transition.from);
}

function isMatrixRowCovered(tc, row) {
  const text = tc.blockText || "";
  const hasRole = textContains(text, row.role);
  const hasEntity = textContains(text, row.entity);
  const opMap = { create: "新增|创建", read: "查看|查询|详情", update: "编辑|修改|更新", delete: "删除" };
  const opPattern = opMap[(row.operation || "").toLowerCase()] || row.operation;
  const hasOp = opPattern ? new RegExp(opPattern).test(text) : true;
  return (hasRole || hasEntity) && hasOp;
}

function isGapCovered(tc, gap) {
  const isExType = /异常|无权限|越权|未授权|negative|exception/i.test(tc.type || "") || tc.tcId.includes("-E");
  if (!isExType) return false;
  return isMatrixRowCovered(tc, gap);
}

function isEventChainCovered(tc, chain) {
  const text = tc.blockText || "";
  const events = chain.events || [];
  if (events.length === 0) return false;
  const matchCount = events.filter(e => textContains(text, e)).length;
  return matchCount >= Math.ceil(events.length * 0.5);
}

// ─── 维度 2：边界完整性 ──────────────────────────────────────
function checkBoundaryCompleteness(methodologyDir, cases) {
  if (cases.length === 0) {
    return { score: 100, status: "SKIP", details: "无测试案例", uncoveredBoundaries: [] };
  }

  let totalBoundaries = 0;
  let coveredBoundaries = 0;
  const uncovered = [];

  // 从方法论产物提取边界条件
  if (methodologyDir && fs.existsSync(methodologyDir)) {
    for (const mf of fs.readdirSync(methodologyDir).filter(f => f.endsWith(".json"))) {
      const md = readJsonSafe(path.join(methodologyDir, mf));
      if (!md) continue;
      const method = md.method || mf.replace(".json", "");

      // test_case_hints 中 edge_case/boundary 类型
      const hints = (md.test_case_hints || []).filter(h =>
        h.suggested_type === "edge_case" || h.suggested_type === "boundary" ||
        (h.coverage_tags || []).includes("boundary")
      );
      for (const hint of hints) {
        totalBoundaries++;
        const desc = hint.source_artifact || JSON.stringify(hint).slice(0, 80);
        const covered = cases.some(c => isBoundaryTc(c));
        if (covered) coveredBoundaries++; else uncovered.push(desc);
      }

      // 状态机终态
      if (method === "state-machine" || method === "state_transition") {
        for (const entity of (md.entities || [])) {
          const transitions = entity.transitions || [];
          const allToStates = [...new Set(transitions.map(t => t.to))];
          const terminalStates = allToStates.filter(s =>
            /过期|完成|取消|删除|关闭|回收|结束|终/.test(s)
          );
          for (const state of terminalStates) {
            totalBoundaries++;
            const desc = `${entity.name}: 终态「${state}」`;
            const covered = cases.some(c => c.blockText && c.blockText.includes(state) && isBoundaryTc(c));
            if (covered) coveredBoundaries++; else uncovered.push(desc);
          }
        }
      }

      // 决策表条件边界
      if (method === "decision-table" || method === "decision_table") {
        for (const artifact of (md.artifacts || [])) {
          const conditions = artifact.conditions || [];
          for (const cond of conditions) {
            if (cond.range || cond.boundary || /范围|区间|限制|额度|数量/.test(cond.name || "")) {
              totalBoundaries += 2; // min + max
              const desc = `${cond.name || cond.range || "条件边界"}`;
              const covered = cases.some(c => isBoundaryTc(c));
              if (covered) coveredBoundaries += 2; else uncovered.push(desc);
            }
          }
        }
      }
    }
  }

  // 无方法论产物时回退：检查边界 TC 占比
  if (totalBoundaries === 0) {
    const boundaryTcs = cases.filter(c => isBoundaryTc(c));
    const ratio = boundaryTcs.length / cases.length;
    const score = Math.round(ratio * 100);
    return {
      score, status: ratio >= 0.1 ? "PASS" : ratio >= 0.05 ? "WARN" : "FAIL",
      details: `边界 TC ${boundaryTcs.length}/${cases.length} (${score}%)，无方法论产物，按占比评估`,
      uncoveredBoundaries: [],
    };
  }

  const score = Math.round((coveredBoundaries / totalBoundaries) * 100);
  return {
    score, status: statusFromScore(score),
    details: `边界覆盖率 ${score}% (${coveredBoundaries}/${totalBoundaries})`,
    uncoveredBoundaries: uncovered,
  };
}

function isBoundaryTc(tc) {
  return tc.tcId.includes("-B") || BOUNDARY_KEYWORDS.test(tc.blockText || "");
}

// ─── 维度 3：异常路径覆盖 ────────────────────────────────────
function checkExceptionPathCoverage(methodologyDir, cases) {
  if (cases.length === 0) {
    return { score: 100, status: "SKIP", details: "无测试案例", missingExceptionPaths: [] };
  }

  let totalExceptionPaths = 0;
  let coveredPaths = 0;
  const missing = [];

  if (methodologyDir && fs.existsSync(methodologyDir)) {
    for (const mf of fs.readdirSync(methodologyDir).filter(f => f.endsWith(".json"))) {
      const md = readJsonSafe(path.join(methodologyDir, mf));
      if (!md) continue;
      const method = md.method || mf.replace(".json", "");

      // 非法迁移
      if (method === "state-machine" || method === "state_transition") {
        for (const entity of (md.entities || [])) {
          for (const t of (entity.invalidTransitions || [])) {
            totalExceptionPaths++;
            const desc = `${entity.name}: ${t.from} → ${t.to} (非法迁移)`;
            const covered = cases.some(c => isExceptionTc(c) && textContains(c.blockText, entity.name) && textContains(c.blockText, t.from));
            if (covered) coveredPaths++; else missing.push(desc);
          }
        }
      }

      // 事件风暴错误链
      if (method === "event-storming" || method === "event_storming") {
        for (const chain of (md.chains || [])) {
          if (chain.type === "error" || chain.isError || /失败|异常|错误|拒绝/.test(chain.name || "")) {
            totalExceptionPaths++;
            const desc = chain.events ? chain.events.join(" → ") : chain.name;
            const covered = cases.some(c => isExceptionTc(c) && isEventChainCovered(c, chain));
            if (covered) coveredPaths++; else missing.push(desc);
          }
        }
      }

      // hints 中 error_path/exception 类型
      const hints = (md.test_case_hints || []).filter(h =>
        h.suggested_type === "error_path" || h.suggested_type === "exception" ||
        (h.coverage_tags || []).includes("error_path")
      );
      for (const hint of hints) {
        totalExceptionPaths++;
        const desc = hint.source_artifact || JSON.stringify(hint).slice(0, 80);
        const covered = cases.some(c => isExceptionTc(c));
        if (covered) coveredPaths++; else missing.push(desc);
      }
    }
  }

  // 无方法论产物时回退：检查异常 TC 占比
  if (totalExceptionPaths === 0) {
    const exceptionTcs = cases.filter(c => isExceptionTc(c));
    const ratio = exceptionTcs.length / cases.length;
    const score = Math.round(ratio * 100);
    return {
      score, status: ratio >= 0.15 ? "PASS" : ratio >= 0.08 ? "WARN" : "FAIL",
      details: `异常 TC ${exceptionTcs.length}/${cases.length} (${score}%)，无方法论产物，按占比评估`,
      missingExceptionPaths: [],
    };
  }

  const score = Math.round((coveredPaths / totalExceptionPaths) * 100);
  return {
    score, status: statusFromScore(score),
    details: `异常路径覆盖率 ${score}% (${coveredPaths}/${totalExceptionPaths})`,
    missingExceptionPaths: missing,
  };
}

function isExceptionTc(tc) {
  return tc.tcId.includes("-E") || EXCEPTION_KEYWORDS.test(tc.blockText || "") ||
    /异常|negative|exception|error/i.test(tc.type || "");
}

// ─── 维度 4：断言准确性 ──────────────────────────────────────
function checkAssertionAccuracy(testingDir, cases) {
  if (cases.length === 0) {
    return { score: 100, status: "SKIP", details: "无测试案例", vagueAssertions: [] };
  }

  const vagueAssertions = [];
  let clearCount = 0;

  // 检查每个 TC 的预期结果
  for (const tc of cases) {
    const expText = tc.expectedText || "";
    // 提取「预期结果」表格行中的具体内容
    const expLines = expText.split(/\n/).filter(l => l.trim().startsWith("|") && !l.includes("---"));
    const expValues = expLines.map(l => {
      const cells = l.split("|").map(c => c.trim()).filter(Boolean);
      return cells[cells.length - 1] || cells[0] || "";
    });

    if (expValues.length === 0 || expValues.every(v => !v || v === "预期结果")) {
      // 无预期结果
      if (tc.hasExpected) {
        // 有 hasExpected 但提取不到明确值 — 可能在非表格格式中
        clearCount++;
      } else {
        vagueAssertions.push({ tcId: tc.tcId, reason: "缺少预期结果" });
      }
      continue;
    }

    // 检查每个预期值是否模糊
    const allVague = expValues.every(v => !v || VAGUE_EXPECTED.test(v.trim()) || v.trim().length < 4);
    if (allVague) {
      vagueAssertions.push({ tcId: tc.tcId, reason: `预期结果模糊: ${expValues.join(", ")}` });
    } else {
      clearCount++;
    }
  }

  // 检查脚本中 expect() 数量
  const scriptFiles = findScriptFiles(testingDir);
  const scriptBlocks = extractScriptTestBlocks(scriptFiles);
  const tcExpectMap = {};
  for (const sb of scriptBlocks) {
    if (sb.tcId) {
      tcExpectMap[sb.tcId] = (tcExpectMap[sb.tcId] || 0) + sb.expectCount;
    }
  }

  let noExpectInScript = 0;
  for (const tc of cases) {
    if ((tcExpectMap[tc.tcId] || 0) === 0) {
      noExpectInScript++;
    }
  }

  // 如果有脚本但 TC 在脚本中无断言，扣分
  const hasScripts = scriptBlocks.length > 0;
  if (hasScripts && noExpectInScript > 0) {
    const scriptDeduct = Math.min(noExpectInScript, 5);
    for (let i = 0; i < scriptDeduct; i++) {
      vagueAssertions.push({ tcId: "(脚本)", reason: `${noExpectInScript} 个 TC 在脚本中无 expect() 断言` });
    }
  }

  // 数据一致性断言检查（流程案例，advisory only — 不影响评分）
  const flowCases = cases.filter(c => c.tcId && c.tcId.startsWith("FLOW-"));
  if (hasScripts && flowCases.length > 2) {
    const allScriptText = scriptFiles.map(f => fs.readFileSync(f, "utf-8")).join("\n");
    const consistencyPattern = /(?:before|after|unchanged|不变|守恒|幂等|expect\([\w.]+\.(\w+)\)\.toBe\([\w.]+\.\1\))/i;
    const hasConsistency = consistencyPattern.test(allScriptText);
    if (!hasConsistency) {
      vagueAssertions.push({
        tcId: "(数据一致性)",
        reason: `${flowCases.length} 个流程案例中无数据一致性验证（before/after 对比或幂等检查），建议补充`,
      });
    }
  }

  const score = Math.round((clearCount / cases.length) * 100);
  return {
    score, status: statusFromScore(score),
    details: `断言准确率 ${score}% (${clearCount}/${cases.length})${noExpectInScript > 0 ? `，${noExpectInScript} 个 TC 脚本无断言` : ""}`,
    vagueAssertions,
  };
}

// ─── 维度 5：脚本可执行性 ────────────────────────────────────
function checkScriptExecutability(gateResultPath) {
  if (!gateResultPath || !fs.existsSync(gateResultPath)) {
    return { score: 100, status: "SKIP", details: "gate-result.json 不存在，跳过脚本可执行性检查" };
  }
  const gateResult = readJsonSafe(gateResultPath);
  if (!gateResult) return { score: 0, status: "FAIL", details: "gate-result.json 解析失败" };

  const qualitySteps = ["4a", "4b", "4c", "4d", "4e", "4f", "4g"];
  let passedCount = 0;
  let totalChecked = 0;
  if (gateResult.steps) {
    for (const [key, step] of Object.entries(gateResult.steps)) {
      if (qualitySteps.includes(key)) {
        totalChecked++;
        if (step.passed !== false) passedCount++;
      }
    }
  }
  if (totalChecked === 0) return { score: 100, status: "PASS", details: "无质量步骤数据" };

  const score = Math.round((passedCount / totalChecked) * 100);
  return {
    score, status: statusFromScore(score),
    details: `质量步骤通过率 ${score}% (${passedCount}/${totalChecked})`,
  };
}

// ─── 维度 6：语义一致性（三层验证） ─────────────────────────
function checkSemanticConsistency(testingDir, cases) {
  const scriptFiles = findScriptFiles(testingDir);
  if (scriptFiles.length === 0 || cases.length === 0) {
    return { score: 100, status: "SKIP", details: "无脚本文件或无案例，跳过语义一致性检查", mismatches: [] };
  }

  const scriptBlocks = extractScriptTestBlocks(scriptFiles);

  // 建立 TC → script block 映射
  const tcScriptMap = {};
  for (const sb of scriptBlocks) {
    if (sb.tcId) {
      if (!tcScriptMap[sb.tcId]) tcScriptMap[sb.tcId] = [];
      tcScriptMap[sb.tcId].push(sb);
    }
  }

  let totalPairs = 0;
  let totalWeightedScore = 0;
  const mismatches = [];

  for (const tc of cases) {
    const scripts = tcScriptMap[tc.tcId];
    if (!scripts || scripts.length === 0) continue;

    totalPairs++;
    const blockText = tc.blockText || "";
    const expectedText = tc.expectedText || "";
    const mismatchReasons = [];

    // ── Layer 1: 关键词匹配 (40% 权重) ──
    const tcKeywords = extractKeywords(blockText);
    let layer1Score = 1; // 默认通过
    if (tcKeywords.length > 0) {
      const bestMatch = scripts.some(sb => {
        const scriptText = (sb.comments.join(" ") + " " + sb.strings.join(" ") + " " + sb.title + " " + sb.content).toLowerCase();
        // 提取脚本中的中文词用于双向匹配
        const scriptChineseWords = (scriptText.match(/[一-鿿]{2,6}/g) || []);
        const hitCount = tcKeywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          // 直接包含
          if (scriptText.includes(kwLower)) return true;
          // 反向：关键词包含脚本中的某个中文词（排除短词误匹配）
          return scriptChineseWords.some(sw => sw.length >= 2 && kwLower.includes(sw) && sw.length >= kwLower.length * 0.5);
        });
        return hitCount.length >= Math.ceil(tcKeywords.length * 0.6); // 阈值 60%
      });
      layer1Score = bestMatch ? 1 : 0;
      if (!bestMatch) {
        mismatchReasons.push(`L1关键词未匹配: [${tcKeywords.slice(0, 5).join(", ")}]`);
      }
    }

    // ── Layer 2: 操作动词对齐 (30% 权重) ──
    const tcOperations = extractOperationVerbs(blockText);
    const bestScriptContent = scripts.map(sb => sb.content).join("\n");
    const verbResult = checkVerbAlignment(tcOperations, bestScriptContent);
    const layer2Score = verbResult.score;
    if (layer2Score < 0.5 && tcOperations.length > 0) {
      const opSummary = tcOperations.map(o => `${o.verb}→${Array.isArray(o.httpMethod) ? o.httpMethod.join("/") : o.httpMethod}`).join(", ");
      mismatchReasons.push(`L2操作动词不对齐: ${opSummary}`);
    }

    // ── Layer 3: 预期结果映射 (30% 权重) ──
    const expectedKws = extractExpectedKeywords(expectedText);
    const layer3Result = checkExpectedMapping(expectedKws, bestScriptContent);
    const layer3Score = layer3Result.score;
    if (layer3Score < 0.5 && expectedKws.length > 0) {
      mismatchReasons.push(`L3预期结果未映射: [${expectedKws.slice(0, 5).join(", ")}]`);
    }

    // 加权综合分
    const weightedScore = layer1Score * 0.4 + layer2Score * 0.3 + layer3Score * 0.3;
    totalWeightedScore += weightedScore;

    if (weightedScore < 0.6) {
      mismatches.push({
        tcId: tc.tcId,
        reason: mismatchReasons.length > 0 ? mismatchReasons.join("; ") : `综合语义分 ${Math.round(weightedScore * 100)}%`,
        layerScores: {
          layer1_keyword: Math.round(layer1Score * 100),
          layer2_verb: Math.round(layer2Score * 100),
          layer3_expected: Math.round(layer3Score * 100),
        },
      });
    }
  }

  if (totalPairs === 0) {
    return { score: 100, status: "PASS", details: "无可匹配的 TC-脚本对", mismatches: [] };
  }

  const score = Math.round((totalWeightedScore / totalPairs) * 100);
  return {
    score, status: statusFromScore(score),
    details: `语义一致率 ${score}% (加权 ${totalPairs} 对, L1×0.4 + L2×0.3 + L3×0.3)`,
    mismatches,
  };
}

function extractKeywords(text) {
  // 提取中文领域关键词（2-6 字），过滤停用词
  const stopWords = new Set([
    // 通用虚词
    "的", "了", "是", "在", "和", "与", "或", "不", "为", "中", "对", "将", "被", "到", "从", "按", "以", "及", "等", "请", "可", "需", "要", "应", "该", "能", "会", "已", "且", "但", "而", "如果", "则", "当",
    // 测试文档元数据噪音
    "页面", "系统", "功能", "用户", "按钮", "字段", "输入", "点击", "操作", "测试", "验证", "步骤", "预期",
    "类型", "设计方法", "序号", "正向", "逆向", "边界", "异常",
    "字段名", "字段值", "是否", "备注", "说明", "条件", "前置", "场景", "编号",
    "等价类", "决策表", "状态机", "因果图", "正交", "错误推测",
  ]);
  const matches = text.match(/[一-鿿]{2,6}/g) || [];
  const freq = {};
  for (const m of matches) {
    if (stopWords.has(m) || m.length < 2) continue;
    freq[m] = (freq[m] || 0) + 1;
  }
  return Object.entries(freq)
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// ─── 操作动词提取（Layer 2） ────────────────────────────────
function extractOperationVerbs(text) {
  const verbMap = [
    { verbs: ["新增", "创建", "添加", "录入"], httpMethod: "POST" },
    { verbs: ["编辑", "修改", "更新"], httpMethod: ["PUT", "PATCH"] },
    { verbs: ["删除", "移除"], httpMethod: "DELETE" },
    { verbs: ["查看", "查询", "获取", "搜索", "详情"], httpMethod: "GET" },
  ];
  const results = [];
  for (const { verbs, httpMethod } of verbMap) {
    for (const v of verbs) {
      if (text.includes(v)) {
        results.push({ verb: v, httpMethod });
      }
    }
  }
  return results;
}

// ─── 预期结果关键词提取（Layer 3） ──────────────────────────
function extractExpectedKeywords(expectedText) {
  if (!expectedText) return [];
  // 提取状态词和关键名词（2-8 字中文，过滤常见模糊词）
  const vagueSet = new Set([
    "成功", "通过", "正常", "无异常", "正确", "执行成功", "操作成功",
    "返回成功", "处理成功", "功能正常", "页面正常", "跳转正常",
    "预期", "结果", "应", "该", "能", "会",
    "步骤", "序号", "字段", "值", "说明", "备注", "是否",
    "预期结果", "操作", "返回", "变为", "显示",
    "不存在", "已删除",
  ]);
  const matches = expectedText.match(/[一-鿿]{2,8}/g) || [];
  const seen = new Set();
  const keywords = [];
  for (const m of matches) {
    if (vagueSet.has(m) || seen.has(m)) continue;
    seen.add(m);
    keywords.push(m);
  }
  return keywords.slice(0, 20);
}

// ─── HTTP 方法与操作动词对齐检查（Layer 2） ─────────────────
function checkVerbAlignment(tcOperations, scriptContent) {
  if (tcOperations.length === 0) return { score: 1, details: "无操作动词可校验" };

  // 提取脚本中使用的 HTTP 方法
  const httpMethods = [];
  const apiPatterns = [
    { pattern: /\.get\s*\(/g, method: "GET" },
    { pattern: /\.post\s*\(/g, method: "POST" },
    { pattern: /\.put\s*\(/g, method: "PUT" },
    { pattern: /\.patch\s*\(/g, method: "PATCH" },
    { pattern: /\.delete\s*\(/g, method: "DELETE" },
    // fetch / axios 调用
    { pattern: /['"`]GET['"`]/gi, method: "GET" },
    { pattern: /['"`]POST['"`]/gi, method: "POST" },
    { pattern: /['"`]PUT['"`]/gi, method: "PUT" },
    { pattern: /['"`]PATCH['"`]/gi, method: "PATCH" },
    { pattern: /['"`]DELETE['"`]/gi, method: "DELETE" },
  ];
  for (const { pattern, method } of apiPatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    while (re.exec(scriptContent)) {
      httpMethods.push(method);
    }
  }

  // E2E: 检查 Playwright 操作动词
  const e2ePatterns = [
    { pattern: /\.click\s*\(/g, verb: "点击" },
    { pattern: /\.fill\s*\(/g, verb: "输入" },
    { pattern: /\.selectOption\s*\(/g, verb: "选择" },
    { pattern: /\.check\s*\(/g, verb: "勾选" },
    { pattern: /\.type\s*\(/g, verb: "输入" },
  ];
  const e2eVerbs = [];
  for (const { pattern, verb } of e2ePatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    while (re.exec(scriptContent)) {
      e2eVerbs.push(verb);
    }
  }

  // 判断是否为 E2E 脚本（含 playwright 操作）
  const isE2E = e2eVerbs.length > 0;

  if (isE2E) {
    // E2E: 检查操作动词对齐
    const tcE2EVerbs = tcOperations.filter(op =>
      ["点击", "输入", "选择", "勾选", "新增", "创建", "删除", "编辑", "修改"].includes(op.verb)
    );
    if (tcE2EVerbs.length === 0) return { score: 1, details: "无 E2E 操作动词" };
    let aligned = 0;
    for (const op of tcE2EVerbs) {
      if (e2eVerbs.includes(op.verb) || httpMethods.some(m => matchMethod(op.httpMethod, m))) {
        aligned++;
      }
    }
    const ratio = aligned / tcE2EVerbs.length;
    return { score: ratio, details: `E2E 操作对齐 ${aligned}/${tcE2EVerbs.length}` };
  }

  // API: HTTP 方法对齐
  if (httpMethods.length === 0) return { score: 1, details: "脚本中未检测到 HTTP 方法" };
  let aligned = 0;
  for (const op of tcOperations) {
    const matched = httpMethods.some(m => matchMethod(op.httpMethod, m));
    if (matched) aligned++;
  }
  const ratio = aligned / tcOperations.length;
  return { score: ratio, details: `HTTP 方法对齐 ${aligned}/${tcOperations.length}` };
}

function matchMethod(expected, actual) {
  if (Array.isArray(expected)) return expected.includes(actual);
  return expected === actual;
}

// ─── 预期结果映射检查（Layer 3） ────────────────────────────
function checkExpectedMapping(expectedKeywords, scriptContent) {
  if (expectedKeywords.length === 0) return { score: 1, details: "无预期结果关键词" };

  const scriptLower = scriptContent.toLowerCase();
  // 提取脚本中所有中文词片段（用于子串匹配）
  const scriptChineseWords = [...new Set(scriptLower.match(/[一-鿿]{2,6}/g) || [])];

  // 提取 expect() 断言中的字符串字面量（用于 bonus 评分）
  const expectStringRegex = /(?:expect\s*\(|\.toBe\(|\.toEqual\(|\.toContain\(|\.toMatch\()\s*['"`]([^'"`]+)['"`]/g;
  const expectStrings = [];
  let em;
  while ((em = expectStringRegex.exec(scriptContent)) !== null) {
    expectStrings.push(em[1].toLowerCase());
  }

  let covered = 0;
  for (const kw of expectedKeywords) {
    const kwLower = kw.toLowerCase();
    // 1. 直接包含在脚本文本中
    if (scriptLower.includes(kwLower)) { covered++; continue; }
    // 2. 子串匹配：预期关键词包含脚本中的某个中文片段
    const partialMatch = scriptChineseWords.some(sw =>
      sw.length >= 2 && kwLower.includes(sw)
    );
    if (partialMatch) { covered++; continue; }
    // 3. 反向子串：脚本中的 expect 字符串包含预期关键词的片段
    const reverseMatch = expectStrings.some(es =>
      es.length >= 2 && kwLower.includes(es)
    );
    if (reverseMatch) { covered++; continue; }
  }
  const ratio = covered / expectedKeywords.length;
  return { score: ratio, details: `预期结果映射 ${covered}/${expectedKeywords.length}` };
}

// ─── 驳回项生成 ──────────────────────────────────────────────
function generateRejectionItems(dimensions) {
  const items = [];
  const { branchCoverage, boundaryCompleteness, exceptionPathCoverage, assertionAccuracy, scriptExecutability, semanticConsistency } = dimensions;

  // Type A: 分支遗漏 → Agent 1
  if (branchCoverage.status === "FAIL") {
    items.push({
      type: "A", dimension: "branchCoverage",
      message: `方法论分支覆盖率 ${branchCoverage.score}%，低于 ${SCORE_WARN}% 阈值`,
      targetAgent: "Agent1",
      uncoveredBranches: branchCoverage.uncoveredBranches || [],
    });
  }
  if (boundaryCompleteness.status === "FAIL") {
    items.push({
      type: "A", dimension: "boundaryCompleteness",
      message: `边界完整性 ${boundaryCompleteness.score}%，低于 ${SCORE_WARN}% 阈值`,
      targetAgent: "Agent1",
      uncoveredBoundaries: boundaryCompleteness.uncoveredBoundaries || [],
    });
  }
  if (exceptionPathCoverage.status === "FAIL") {
    items.push({
      type: "A", dimension: "exceptionPathCoverage",
      message: `异常路径覆盖 ${exceptionPathCoverage.score}%，低于 ${SCORE_WARN}% 阈值`,
      targetAgent: "Agent1",
      missingExceptionPaths: exceptionPathCoverage.missingExceptionPaths || [],
    });
  }

  // Type B: 脚本质量 → Agent 2
  if (scriptExecutability.status === "FAIL") {
    items.push({
      type: "B", dimension: "scriptExecutability",
      message: `脚本可执行性 ${scriptExecutability.score}%，低于 ${SCORE_WARN}% 阈值`,
      targetAgent: "Agent2",
    });
  }
  if (assertionAccuracy.status === "FAIL") {
    items.push({
      type: "B", dimension: "assertionAccuracy",
      message: `断言准确性 ${assertionAccuracy.score}%，低于 ${SCORE_WARN}% 阈值`,
      targetAgent: "Agent2",
      vagueAssertions: assertionAccuracy.vagueAssertions || [],
    });
  }

  // Type C: 语义偏差 → Agent 1 + Agent 2
  if (semanticConsistency.status === "FAIL") {
    items.push({
      type: "C", dimension: "semanticConsistency",
      message: `语义一致性 ${semanticConsistency.score}%，低于 ${SCORE_WARN}% 阈值`,
      targetAgent: "Agent1",
      mismatches: semanticConsistency.mismatches || [],
    });
  }

  return items;
}

// ─── 修复指令生成 ────────────────────────────────────────────
function generateFixInstructions(rejectionItems) {
  const agent1Instructions = [];
  const agent2Instructions = [];

  for (const item of rejectionItems) {
    switch (item.dimension) {
      case "branchCoverage":
        agent1Instructions.push(`补充遗漏分支用例: ${(item.uncoveredBranches || []).slice(0, 10).join("; ")}`);
        break;
      case "boundaryCompleteness":
        agent1Instructions.push(`补充边界条件用例: ${(item.uncoveredBoundaries || []).slice(0, 10).join("; ")}`);
        break;
      case "exceptionPathCoverage":
        agent1Instructions.push(`补充异常路径用例: ${(item.missingExceptionPaths || []).slice(0, 10).join("; ")}`);
        break;
      case "scriptExecutability":
        agent2Instructions.push("修复脚本质量问题（参考 gate-result.json 4a-4g 步骤）");
        break;
      case "assertionAccuracy":
        agent2Instructions.push(`修复模糊断言: ${(item.vagueAssertions || []).slice(0, 5).map(v => `${v.tcId}: ${v.reason}`).join("; ")}`);
        break;
      case "semanticConsistency":
        agent1Instructions.push("修复案例步骤与脚本断言的语义偏差");
        agent2Instructions.push("修复脚本步骤以忠实还原用例意图");
        break;
    }
  }

  const instructions = [];
  if (agent1Instructions.length > 0) instructions.push({ targetAgent: "Agent1", instructions: agent1Instructions.join("\n") });
  if (agent2Instructions.length > 0) instructions.push({ targetAgent: "Agent2", instructions: agent2Instructions.join("\n") });
  return instructions;
}

// ─── 主逻辑 ──────────────────────────────────────────────────
function main() {
  const { testingDir, methodologyDir, gateResultPath, outputPath } = parseArgs();
  if (!testingDir) {
    console.error("错误：缺少 --testing-dir 参数");
    process.exit(1);
  }

  // 提取案例元数据
  const cases = extractCaseMetadata(testingDir);
  console.log(`读取到 ${cases.length} 个测试案例`);

  // 6 维度评测
  const branchCoverage = checkBranchCoverage(methodologyDir, cases, testingDir);
  console.log(`维度 1 分支覆盖率: ${branchCoverage.status} (${branchCoverage.score}%) — ${branchCoverage.details}`);

  const boundaryCompleteness = checkBoundaryCompleteness(methodologyDir, cases);
  console.log(`维度 2 边界完整性: ${boundaryCompleteness.status} (${boundaryCompleteness.score}%) — ${boundaryCompleteness.details}`);

  const exceptionPathCoverage = checkExceptionPathCoverage(methodologyDir, cases);
  console.log(`维度 3 异常路径覆盖: ${exceptionPathCoverage.status} (${exceptionPathCoverage.score}%) — ${exceptionPathCoverage.details}`);

  const assertionAccuracy = checkAssertionAccuracy(testingDir, cases);
  console.log(`维度 4 断言准确性: ${assertionAccuracy.status} (${assertionAccuracy.score}%) — ${assertionAccuracy.details}`);

  const scriptExecutability = checkScriptExecutability(gateResultPath);
  console.log(`维度 5 脚本可执行性: ${scriptExecutability.status} (${scriptExecutability.score}%) — ${scriptExecutability.details}`);

  const semanticConsistency = checkSemanticConsistency(testingDir, cases);
  console.log(`维度 6 语义一致性: ${semanticConsistency.status} (${semanticConsistency.score}%) — ${semanticConsistency.details}`);

  const dimensions = { branchCoverage, boundaryCompleteness, exceptionPathCoverage, assertionAccuracy, scriptExecutability, semanticConsistency };

  // 综合判定
  const rejectionItems = generateRejectionItems(dimensions);
  const fixInstructions = generateFixInstructions(rejectionItems);
  const verdict = rejectionItems.length === 0 ? "PASS" : "FAIL";

  // 计算综合分（排除 SKIP 维度）
  const activeDims = Object.values(dimensions).filter(d => d.status !== "SKIP");
  const overallScore = activeDims.length > 0
    ? Math.round(activeDims.reduce((sum, d) => sum + d.score, 0) / activeDims.length)
    : 100;

  // 统计摘要
  const scriptFiles = findScriptFiles(testingDir);
  const moduleMatch = (testingDir || "").match(/([^/\\]+)[/\\]?$/);
  const report = {
    verdict,
    overallScore,
    timestamp: new Date().toISOString(),
    mode: PHASE === 1 ? "light" : "full",
    summary: {
      module: moduleMatch ? moduleMatch[1] : "",
      totalCases: cases.length,
      totalScripts: scriptFiles.length,
      evaluationTime: new Date().toISOString(),
    },
    dimensions,
    rejectionItems,
    fixInstructions,
  };

  // 写入报告
  if (outputPath) {
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n评测报告已写入: ${outputPath}`);
  }

  // 输出摘要
  console.log(`\n══════════════════════════════════════`);
  console.log(`  质量评测结果: [${verdict}] 综合分 ${overallScore}`);
  console.log(`  维度 1 分支覆盖率: ${branchCoverage.status} (${branchCoverage.score}%)`);
  console.log(`  维度 2 边界完整性: ${boundaryCompleteness.status} (${boundaryCompleteness.score}%)`);
  console.log(`  维度 3 异常路径覆盖: ${exceptionPathCoverage.status} (${exceptionPathCoverage.score}%)`);
  console.log(`  维度 4 断言准确性: ${assertionAccuracy.status} (${assertionAccuracy.score}%)`);
  console.log(`  维度 5 脚本可执行性: ${scriptExecutability.status} (${scriptExecutability.score}%)`);
  console.log(`  维度 6 语义一致性: ${semanticConsistency.status} (${semanticConsistency.score}%)`);
  if (rejectionItems.length > 0) {
    console.log(`  驳回项:`);
    for (const item of rejectionItems) {
      console.log(`    [Type ${item.type}] ${item.message}`);
    }
    if (fixInstructions.length > 0) {
      console.log(`  修复指令:`);
      for (const fi of fixInstructions) {
        console.log(`    → ${fi.targetAgent}: ${fi.instructions.split("\n")[0]}`);
      }
    }
  }
  console.log(`══════════════════════════════════════`);
}

main();
