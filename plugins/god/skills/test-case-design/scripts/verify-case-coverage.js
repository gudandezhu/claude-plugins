#!/usr/bin/env node
/**
 * verify-case-coverage.js
 * 结构化覆盖率预检：正则提取 TC 编号、场景类型匹配、功能点/接口/流程覆盖率
 *
 * 用法：node verify-case-coverage.js --testing-dir $WORK_DIR/testing --scope <scope> --threshold 80 [--ac-threshold 100] [--ac-file <path>]
 * 输出：testing/.cache/coverage-check-result.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { loadAcAssignment } = require("../../../scripts/lib/ac-assignment-loader");
const { safeReadJson } = require("../../../scripts/lib/safe-json");
const { extractTcIdsByPrefix, extractTcIdFromTitle } = require("../../../scripts/lib/tc-id-extractor");

function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = "testing";
  let scope = "fullstack";
  let threshold = 80;
  let acFile = null;
  let acThreshold = 100;
  let acAssignment = null;
  let treeContext = null;
  let activeTypes = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--scope" && argv[i + 1]) scope = argv[++i];
    if (argv[i] === "--threshold" && argv[i + 1]) threshold = parseInt(argv[++i], 10);
    if (argv[i] === "--ac-file" && argv[i + 1]) acFile = argv[++i];
    if (argv[i] === "--ac-threshold" && argv[i + 1]) acThreshold = parseInt(argv[++i], 10);
    if (argv[i] === "--ac-assignment" && argv[i + 1]) acAssignment = argv[++i];
    if (argv[i] === "--tree-context" && argv[i + 1]) treeContext = argv[++i];
    if (argv[i] === "--active-types" && argv[i + 1]) {
      activeTypes = argv[++i].split(",").map(t => t.trim()).filter(t => t);
      if (activeTypes.length === 0) activeTypes = null;
    }
  }
  // Auto-discover ac.md from parent of testingDir if not provided
  if (!acFile) {
    const workDir = path.dirname(path.resolve(testingDir));
    const candidates = [
      path.join(workDir, "design", "ac.md"),
      path.join(workDir, "requirement", "ac.md"),
    ];
    acFile = candidates.find(p => fs.existsSync(p)) || null;
  }
  return { testingDir, scope, threshold, acFile, acThreshold, acAssignment, treeContext, activeTypes };
}

function readSafe(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

/**
 * 读取 split 目录下所有 MD 文件内容（排除 _index），fallback 到旧单文件路径。
 */
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
  // fallback 到旧路径
  const fallbackMap = {
    e2e: "test-cases/e2e-test-cases.md",
    api: "test-cases/api-test-cases.md",
    flow: "test-cases/api-flow-test-cases.md",
  };
  return readSafe(path.join(testingDir, fallbackMap[type] || ""));
}

function extractTcIds(content, prefix) {
  return extractTcIdsByPrefix(content, prefix);
}

function checkTcCompleteness(ids) {
  // 检查编号连续性（只检查主编号，不检查 E/B 子编号）
  const mainIds = ids.filter(id => !/-[EB]\d{2}$/.test(id));
  const gaps = [];
  // 按模块分组
  const groups = {};
  for (const id of mainIds) {
    const parts = id.match(/^(\w+-\w+)-(\d{3})/);
    if (parts) {
      const prefix = parts[1];
      const num = parseInt(parts[2], 10);
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(num);
    }
  }
  for (const [prefix, nums] of Object.entries(groups)) {
    nums.sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) {
        for (let n = nums[i - 1] + 1; n < nums[i]; n++) {
          gaps.push(`${prefix}-${String(n).padStart(3, "0")}`);
        }
      }
    }
  }
  return { total: ids.length, mainCount: mainIds.length, gaps };
}

function checkScenarioTypes(content) {
  const types = {
    normal: /正常|Happy\s*Path|功能测试/gi,
    exception: /异常|错误|失败|E\d{2}/gi,
    boundary: /边界|最大|最小|空值|B\d{2}/gi,
  };
  const result = {};
  for (const [type, regex] of Object.entries(types)) {
    const matches = content.match(regex);
    result[type] = matches ? matches.length : 0;
  }
  return result;
}

/**
 * 从案例文档中提取步骤/验证区域的内容（排除"覆盖AC"声明行和流程总览表）。
 * 支持 Flow 步骤表格、E2E/API 编号列表、案例标题行三种格式。
 */
function extractVerificationContent(casesContent) {
  const lines = casesContent.split("\n");
  const stepLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Flow 步骤表格：| S01 | ... 或 | E-S02 | ...
    if (/^\|\s*(S\d|E-?S?\d)/.test(trimmed)) {
      stepLines.push(line);
    }
    // 案例标题行（标记案例边界）
    else if (/^###\s+(FE|API|FLOW)-/.test(trimmed)) {
      stepLines.push(line);
    }
    // 编号列表步骤（E2E/API 格式：1. xxx, 2. xxx）
    else if (/^\d+[.、．]\s+/.test(trimmed)) {
      stepLines.push(line);
    }
    // 流程类型/涉及写操作/状态转换 描述行
    else if (/^\*\*(流程类型|涉及写操作|状态转换)\*\*/.test(trimmed)) {
      stepLines.push(line);
    }
    // E2E 表格步骤/预期结果行（| 测试步骤 | ... | 或 | 预期结果 | ... |）
    else if (/^\|.*(?:测试步骤|操作步骤|预期结果)/.test(trimmed)) {
      stepLines.push(line);
    }
    // 【过渡期兼容】E2E/API 表格数据行（| 1 | 输入xxx | 预期yyy |）
    // 上下文保护：只匹配包含操作/验证关键词的行，避免误匹配无关表格
    else if (/^\|\s*\d+\s*\|/.test(trimmed)) {
      if (!/^\|[\s\-:|]+\|$/.test(trimmed)
        && /(?:输入|点击|选择|验证|确认|检查|切换|填写|操作|预期|应|显示|跳转)/.test(trimmed)) {
        stepLines.push(line);
      }
    }
    // API 步骤描述行（- 请求xxx / - 验证xxx 等列表项）
    else if (/^[-*]\s+(?:请求|验证|检查|确认|调用|发送)/.test(trimmed)) {
      stepLines.push(line);
    }
  }
  return stepLines.join("\n");
}

/**
 * 从 ac.md 中提取 AC-OP-* 编号及其对应的操作语义关键词。
 * 表格格式可能是：
 *   | AC-OP-01 | 前置条件 | 操作 | 预期结果 | 来源 |
 *   | AC-OP-01 | 操作名称 | 描述 |
 * 提取"操作"列（第三列）和"预期结果"列（第四列）作为语义关键词。
 */
function extractAcOpSemantics(acContent) {
  const ops = new Map(); // AC-OP-XX -> [语义关键词]
  const opPattern = /\b(AC-OP-\d+[a-z]?)\b/g;
  let m;
  while ((m = opPattern.exec(acContent)) !== null) ops.set(m[1], []);

  // 从表格行提取语义
  const lines = acContent.split("\n");
  for (const line of lines) {
    // 匹配包含 AC-OP 的表格行，提取所有列
    const cells = line.split("|").map(c => c.trim()).filter(c => c);
    if (cells.length < 3) continue;
    const opIdMatch = cells[0].match(/^(AC-OP-\d+[a-z]?)$/);
    if (!opIdMatch) continue;
    const opId = opIdMatch[1];
    if (!ops.has(opId)) continue;

    const keywords = [];
    // 第三列通常是"操作"（如：点击"编辑"、点击"生成采购单"）
    if (cells[2]) {
      // 提取引号内的操作名称
      const quoted = cells[2].match(/[""「」]([^""「」]+)[""「」]/g);
      if (quoted) {
        quoted.forEach(q => keywords.push(q.replace(/[""「」]/g, '')));
      }
      // 提取中文动词短语（≥2字符）
      const phrases = cells[2].split(/[,，、/／\s]+/).filter(k => k.length >= 2 && /[\u4e00-\u9fa5]/.test(k));
      keywords.push(...phrases);
    }
    // 第四列通常是"预期结果"
    if (cells[3]) {
      const phrases = cells[3].split(/[,，、/／\s]+/).filter(k => k.length >= 2 && /[\u4e00-\u9fa5]/.test(k));
      keywords.push(...phrases);
    }
    // 去重
    ops.set(opId, [...new Set(keywords)]);
  }
  return ops;
}

function checkAcOpCoverage(acFilePath, casesContent) {
  if (!acFilePath || !fs.existsSync(acFilePath)) {
    return { passed: false, message: "ac.md 不存在，AC-OP 覆盖检查无法执行" };
  }
  const acContent = fs.readFileSync(acFilePath, "utf-8");
  const opSemantics = extractAcOpSemantics(acContent);
  if (opSemantics.size === 0) return { rate: "N/A", message: "ac.md 中无 AC-OP 条目" };

  // 提取步骤表格区域内容（排除"覆盖AC"声明）
  const stepContent = extractVerificationContent(casesContent);

  const coveredOps = [];
  const uncoveredOps = [];
  const declaredOnlyOps = []; // 仅在"覆盖AC"中声明但步骤中无实际操作

  for (const [op, keywords] of opSemantics) {
    // 检查 AC-OP 编号是否在步骤区域出现
    const inSteps = stepContent.includes(op);
    // 检查语义关键词是否在步骤区域出现（至少一个关键词匹配）
    const semanticMatch = keywords.length > 0 && keywords.some(kw => stepContent.includes(kw));

    if (inSteps || semanticMatch) {
      coveredOps.push(op);
    } else {
      // 检查是否仅在"覆盖AC"声明中出现
      const inFullContent = casesContent.includes(op);
      if (inFullContent) {
        declaredOnlyOps.push(op);
      }
      uncoveredOps.push(op);
    }
  }
  const rate = Math.round((coveredOps.length / opSemantics.size) * 100);
  return {
    total: opSemantics.size,
    covered: coveredOps.length,
    uncovered: uncoveredOps,
    declaredOnly: declaredOnlyOps,
    rate,
    passed: uncoveredOps.length === 0,
    message: declaredOnlyOps.length > 0
      ? `${declaredOnlyOps.length} 个 AC-OP 仅在"覆盖AC"中声明但步骤中无实际操作: ${declaredOnlyOps.join(", ")}`
      : undefined,
  };
}

function checkStateTransitionCoverage(acFilePath, casesContent) {
  if (!acFilePath || !fs.existsSync(acFilePath)) {
    return { passed: false, message: "ac.md 不存在，状态转换覆盖检查无法执行" };
  }
  const acContent = fs.readFileSync(acFilePath, "utf-8");
  // 提取 AC-STS-* 中的状态语义
  const stateKeywords = [];
  const stsPattern = /AC-STS-\d+[a-z]?\s*\|\s*[^|]+\|\s*([^|]+)\|/g;
  let sm;
  while ((sm = stsPattern.exec(acContent)) !== null) {
    const state = sm[1].trim();
    if (state && state !== '--') stateKeywords.push(state);
  }
  if (stateKeywords.length === 0) return { rate: "N/A", message: "未提取到状态关键词" };

  // 只在步骤表格区域和流程描述区域内匹配状态关键词
  const stepContent = extractVerificationContent(casesContent);

  const covered = stateKeywords.filter(s => stepContent.includes(s));
  const uncovered = stateKeywords.filter(s => !stepContent.includes(s));
  // 补充检查：在全文中出现但不在步骤中的状态（仅声明未验证）
  const declaredOnly = uncovered.filter(s => casesContent.includes(s));
  const rate = Math.round((covered.length / stateKeywords.length) * 100);
  return {
    total: stateKeywords.length,
    covered: covered.length,
    uncoveredStates: uncovered,
    declaredOnlyStates: declaredOnly,
    rate,
    passed: uncovered.length === 0,
    message: declaredOnly.length > 0
      ? `${declaredOnly.length} 个状态仅在声明/描述中出现但步骤中未验证: ${declaredOnly.join(", ")}`
      : undefined,
  };
}

function checkFeatureCoverage(cacheDir, caseType, casesContent) {
  const candidates = [
    path.join(cacheDir, `${caseType}-case-design-summary.json`),
    path.join(cacheDir, "case-design-summary.json"),
  ];
  const summaryPath = candidates.find(p => fs.existsSync(p));
  if (!summaryPath) {
    return { rate: "N/A", message: "case-design-summary.json 不存在，跳过功能点覆盖检查" };
  }
  const summary = safeReadJson(summaryPath, { fallback: {} });
  const definedFeatures = summary.featureCoverage || {};
  const total = Object.keys(definedFeatures).length;
  if (total === 0) return { rate: "N/A", message: "无功能点定义" };

  // 解析文档结构：建立二级标题（接口分组）与案例的映射关系
  // API 案例结构：## 1. POST /inventory/xxx（接口分组） -> ### API-SM-001 xxx（案例）
  const lines = casesContent.split("\n");
  const sectionToCases = new Map(); // 接口分组 -> 案例ID列表
  const caseToSection = new Map();  // 案例ID -> 接口分组
  let currentSection = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // 二级标题：接口分组（如 "## 1. POST /inventory/purchaseRequisition/summaryPage"）
    if (trimmed.startsWith("## ")) {
      // 提取接口路径（支持格式：## 1. POST /path 或 ## POST /path）
      const sectionMatch = trimmed.match(/^##\s+(?:\d+\.?\s*)?(.+)$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        if (!sectionToCases.has(currentSection)) {
          sectionToCases.set(currentSection, []);
        }
      }
    }
    // 三级标题：案例（如 "### API-SM-001 汇总模式默认查询"）
    else if (trimmed.startsWith("### ")) {
      const caseId = extractTcIdFromTitle(trimmed.replace(/^###\s+/, ''));
      if (caseId && currentSection) {
        caseToSection.set(caseId, currentSection);
        sectionToCases.get(currentSection).push(caseId);
      }
    }
  }

  // 提取所有案例标题行和全文内容（用于匹配）
  const titleLines = lines.filter(l => l.trim().startsWith("###"));
  const fullContent = casesContent;

  let covered = 0;
  const uncovered = [];
  const shortKeywordSkipped = [];

  for (const [feature] of Object.entries(definedFeatures)) {
    const keyword = feature.replace(/[()（）\[\]【】]/g, "");
    if (keyword.length < 4) {
      shortKeywordSkipped.push(feature);
      continue;
    }
    
    // 策略1：在案例标题中直接匹配关键词
    const hasInTitle = titleLines.some(line => line.includes(keyword));
    
    // 策略2：在全文中匹配接口路径（适用于 API 案例）
    // feature 格式：POST /inventory/purchaseRequisition/summaryPage
    const hasInContent = fullContent.includes(keyword);
    
    // 策略3：检查二级标题（接口分组）是否匹配
    let hasInSection = false;
    for (const [section] of sectionToCases) {
      if (section.includes(keyword)) {
        hasInSection = true;
        break;
      }
    }
    
    if (hasInTitle || hasInContent || hasInSection) {
      covered++;
    } else {
      uncovered.push(feature);
    }
  }

  const reliableTotal = total - shortKeywordSkipped.length;
  const rate = reliableTotal > 0 ? Math.round((covered / reliableTotal) * 100) : "N/A";
  return { rate, total, covered, uncovered, shortKeywordSkipped, sectionsFound: sectionToCases.size };
}

function checkApiCoverage(apiSummaryPath, casesContent) {
  if (!fs.existsSync(apiSummaryPath)) {
    return { rate: "N/A", message: "api-probe-summary.json 不存在，跳过接口覆盖检查" };
  }
  const apiSummary = safeReadJson(apiSummaryPath, { fallback: {} });
  const endpoints = apiSummary.endpoints || [];
  if (endpoints.length === 0) return { rate: "N/A", message: "无接口定义" };

  let covered = 0;
  const uncovered = [];
  for (const ep of endpoints) {
    const pathKey = ep.path.replace(/\{[^}]+\}/g, "");
    if (casesContent.includes(pathKey) || casesContent.includes(ep.summary)) {
      covered++;
    } else {
      uncovered.push(`${ep.method} ${ep.path}`);
    }
  }
  const rate = Math.round((covered / endpoints.length) * 100);
  return { rate, total: endpoints.length, covered, uncovered };
}

function checkFlowCoverage(casesContent) {
  const flowIds = extractTcIds(casesContent, "FLOW");
  const hasNormalFlow = flowIds.some(id => !/-[EB]\d{2}$/.test(id));
  const hasExceptionFlow = flowIds.some(id => /-E\d{2}$/.test(id));

  // 只在步骤表格区域内检测写操作关键词
  const stepContent = extractVerificationContent(casesContent);
  const writeOps = ['创建', '新增', '编辑', '修改', '删除', '提交', '撤回', '作废', '生成', '保存', '重置'];
    const writeApiMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const coveredWriteOps = writeOps.filter(op => stepContent.includes(op));
    if (coveredWriteOps.length < writeOps.length) {
      coveredWriteOps.push(...writeApiMethods.filter(m => stepContent.includes(m)));
    }
  const onlyQueryFlows = coveredWriteOps.length === 0;

  // 流程类型多样性检查（在步骤区域+流程标题区域检查）
  const hasCrudFlow = /CRUD|创建.*查询.*修改.*删除|创建.*编辑.*删除/i.test(stepContent) ||
    /CRUD/i.test(casesContent);
  const hasStateFlow = /状态流转|状态变更|待提交.*已提交|草稿.*提交/i.test(stepContent) ||
    /状态流转/i.test(casesContent);
  const hasLinkageFlow = /业务联动|联动|生成采购|关联/i.test(stepContent) ||
    /业务联动/i.test(casesContent);

  // 检查是否有"仅查询"的伪流程（所有步骤都是 GET/查询/列表）
  const stepLines = stepContent.split("\n").filter(l => /^\|\s*(S\d|E-?S?\d)/.test(l.trim()));
  const queryOnlyStepCount = stepLines.filter(l => /GET|查询|列表|汇总|筛选/i.test(l) && !/POST|PUT|DELETE|创建|新增|编辑|修改|删除|提交|撤回|作废/i.test(l)).length;
  const totalStepCount = stepLines.length;
  const queryRatio = totalStepCount > 0 ? queryOnlyStepCount / totalStepCount : 0;

  // 检查是否有端到端链路流程（跨多个业务实体的完整路径）
  const hasEndToEndFlow = /端到端|FLOW-COMPLETE|请购.*采购|采购.*到货|创建.*提交.*生成/i.test(stepContent) ||
    /端到端链路/i.test(casesContent);

  return {
    totalFlowCases: flowIds.length,
    hasNormalFlow,
    hasExceptionFlow,
    writeOpCoverage: {
      total: writeOps.length,
      covered: coveredWriteOps.length,
      coveredOps: coveredWriteOps,
      onlyQueryFlows,
    },
    flowTypeDiversity: {
      hasCrudFlow,
      hasStateFlow,
      hasLinkageFlow,
      hasEndToEndFlow,
    },
    queryRatio: Math.round(queryRatio * 100),
    passed: hasNormalFlow && flowIds.length >= 2 && !onlyQueryFlows && queryRatio < 0.8,
  };
}

function checkAcCoverage(acFilePath, allCasesContent, acThreshold, acAssignmentPath, activeTypes) {
  // acThreshold: overall AC coverage threshold (default 100)
  // Scaling: AC类 min(acThreshold+5, 100), UI类 max(acThreshold-10, 60)
  if (acThreshold === undefined || acThreshold === null) acThreshold = 100;
  const acRateThreshold = Math.min(acThreshold + 5, 100);
  const uiRateThreshold = Math.max(acThreshold - 10, 60);
  try {
    if (!acFilePath || !fs.existsSync(acFilePath)) {
      return { passed: false, overallRate: 0, message: "ac.md 不存在，AC 覆盖率检查无法执行（ac.md 是 AC 覆盖率 100% 保障的前提）" };
    }
    const acContent = fs.readFileSync(acFilePath, "utf-8");

    // 从案例文档的"覆盖AC"列提取已覆盖的 AC 编号
    // 支持两种格式 + Markdown 加粗格式：
    //   冒号格式：覆盖AC: AC-001, AC-002
    //   加粗格式：**覆盖AC**: AC-001, AC-002
    //   Markdown 表格格式：| 覆盖AC | AC-001, AC-002 |
    //   加粗表格格式：| **覆盖AC** | AC-001, AC-002 |
    const coveredAcIds = new Set();
    const coverPatterns = [
      /\*{0,2}覆盖\s*AC\*{0,2}\s*[:：]\s*([\w\-.\s,，;；（()）]+)/gi,
      /\|\s*\*{0,2}覆盖\s*AC\*{0,2}\s*\|\s*([\w\-.\s,，;；（()）]+?)\s*\|/gi,
    ];
    for (const coverPattern of coverPatterns) {
      let cm;
      while ((cm = coverPattern.exec(allCasesContent)) !== null) {
        cm[1].split(/[,，;；\s]+/).forEach(id => {
          const t = id.trim().replace(/[（(].*$/, "");
          if (t) coveredAcIds.add(t);
        });
      }
    }

    // 格式异常检测
    if (coveredAcIds.size === 0 && allCasesContent.length > 500) {
      console.warn("[WARN] 案例文档中未提取到任何 AC 编号，可能是格式不符（期望格式：覆盖AC: AC-XXX）");
    }

    const assignment = loadAcAssignment(acAssignmentPath);
    let acOnlyIds, uiOnlyIds, excludedIds;

    if (assignment) {
      // ── v2.0 全量共享：coverable.ids 是全局覆盖池 ──
      acOnlyIds = new Set(assignment.assignment.coverable?.ids || []);
      uiOnlyIds = new Set(assignment.ui?.ids || []);
      excludedIds = new Set(assignment.assignment.excluded?.ids || []);
    } else {
      // ── 兼容旧流程：现有逻辑，但 EXCLUDED_PREFIXES 增加新前缀 ──
      const AC_PATTERNS = [
        /\b(G-\d+)\b/g,
        /\b(AC-[A-Z]+-\d+[a-z]?)\b/g,
        /\b(UI-[A-Z]+-\d+)\b/g,
      ];
      const EXCLUDED_PREFIXES = [
        "AC-RULE-", "AC-NF-",                          // 新前缀
        "AC-STS-", "AC-CALC-", "AC-FMT-", "AC-PERM-",  // 旧前缀
      ];
      acOnlyIds = new Set();
      uiOnlyIds = new Set();
      for (const p of AC_PATTERNS) {
        let m;
        const pat = new RegExp(p.source, "g");
        while ((m = pat.exec(acContent)) !== null) {
          const id = m[1];
          if (id.startsWith("AC-")) {
            if (!EXCLUDED_PREFIXES.some(prefix => id.startsWith(prefix))) {
              acOnlyIds.add(id);
            }
          } else if (id.startsWith("UI-")) {
            // UI-ELEM-* 不计入覆盖分母
            if (!id.startsWith("UI-ELEM-")) {
              uiOnlyIds.add(id);
            }
          }
          // G- 类不计入覆盖率分母
        }
      }
      // 统计被排除的 AC 编号（遍历所有 EXCLUDED_PREFIXES）
      const allExcludedPrefixes = ["AC-RULE-", "AC-NF-", "AC-STS-", "AC-CALC-", "AC-FMT-", "AC-PERM-"];
      excludedIds = new Set();
      for (const prefix of allExcludedPrefixes) {
        const escapedPrefix = prefix.replace(/-/g, "\\-");
        const pat = new RegExp(`\\b(${escapedPrefix}\\w*\\d+[a-z]?)\\b`, "g");
        let em;
        while ((em = pat.exec(acContent)) !== null) excludedIds.add(em[1]);
      }
    }

    const acCovered = [...acOnlyIds].filter(id => coveredAcIds.has(id)).length;
    const uiCovered = [...uiOnlyIds].filter(id => coveredAcIds.has(id)).length;
    const acRate = acOnlyIds.size > 0 ? Math.round((acCovered / acOnlyIds.size) * 100) : 100;
    const uiRate = uiOnlyIds.size > 0 ? Math.round((uiCovered / uiOnlyIds.size) * 100) : 100;
    const requiredTotal = acOnlyIds.size + uiOnlyIds.size;
    const requiredCovered = acCovered + uiCovered;
    const overallRate = requiredTotal > 0 ? Math.round((requiredCovered / requiredTotal) * 100) : 100;
    const uncoveredAc = [...acOnlyIds].filter(id => !coveredAcIds.has(id));
    const uncoveredUi = [...uiOnlyIds].filter(id => !coveredAcIds.has(id));

    return {
      totalInAcFile: acOnlyIds.size + uiOnlyIds.size + excludedIds.size,
      excludedCount: excludedIds.size,
      excludedIds: [...excludedIds],
      total: requiredTotal,
      covered: requiredCovered,
      uncoveredCount: uncoveredAc.length + uncoveredUi.length,
      acRate,
      uiRate,
      overallRate,
      uncovered: [...uncoveredAc, ...uncoveredUi],
      acPassed: acRate >= acRateThreshold,
      uiPassed: uiRate >= uiRateThreshold,
      passed: overallRate >= acThreshold,
      acThreshold,
      acRateThreshold,
      uiRateThreshold,
      coveredAcIds: [...coveredAcIds],
    };
  } catch (err) {
    console.warn(`[WARN] AC 覆盖检查异常，跳过: ${err.message}`);
    return { rate: "N/A", message: `AC 覆盖检查异常: ${err.message}` };
  }
}

/**
 * 脚本化嵌入规则覆盖检查（AC-STS-/AC-CALC-/AC-FMT- 已纳入覆盖率分母，此检查验证它们是否在案例步骤中被实际验证而非仅声明覆盖）
 * 检查这些规则定义类 AC 的关键词是否在案例步骤区域中出现
 */
function checkEmbeddedRuleCoverage(acFilePath, allCasesContent, activeTypes) {
  // 纯 API 模式无 UI/流程步骤，嵌入规则检查无意义
  if (activeTypes && !activeTypes.includes('e2e') && !activeTypes.includes('flow')) {
    return { skipped: true, passed: true, message: "纯 API 模式跳过嵌入规则检查" };
  }
  if (!acFilePath || !fs.existsSync(acFilePath)) {
    return { skipped: false, passed: false, message: "ac.md 不存在，嵌入规则覆盖检查无法执行" };
  }
  const acContent = fs.readFileSync(acFilePath, "utf-8");
  const stepContent = extractVerificationContent(allCasesContent);

  const categories = {
    sts: { pattern: /\b(AC-STS-\d+[a-z]?)\b/g, label: "状态枚举", ids: new Map() },
    calc: { pattern: /\b(AC-CALC-\d+[a-z]?)\b/g, label: "计算规则", ids: new Map() },
    fmt: { pattern: /\b(AC-FMT-\d+[a-z]?)\b/g, label: "格式规范", ids: new Map() },
    perm: { pattern: /\b(AC-PERM-\d+[a-z]?)\b/g, label: "权限模型", ids: new Map() },
    rule: { pattern: /\b(AC-RULE-\d+[a-z]?)\b/g, label: "全局规则（新前缀）", ids: new Map() },
  };

  // 从 ac.md 提取各类规则 AC 编号及其描述关键词
  for (const [, cat] of Object.entries(categories)) {
    let m;
    while ((m = cat.pattern.exec(acContent)) !== null) {
      const id = m[1];
      if (cat.ids.has(id)) continue;
      // 提取同行的描述关键词
      const lineMatch = acContent.match(new RegExp(`\\|\\s*${id.replace(/[-]/g, "\\-")}\\s*\\|([^\\n]*)`));
      const keywords = [];
      if (lineMatch) {
        const cells = lineMatch[1].split("|").map(c => c.trim()).filter(c => c);
        for (const cell of cells) {
          const phrases = cell.split(/[,，、/／\s]+/).filter(k => k.length >= 2 && /[\u4e00-\u9fa5]/.test(k));
          keywords.push(...phrases);
          // 增强：提取状态转换描述的多种格式
          const statePatterns = [
            /(?:状态|变更|变为|转为|改为|设为)\s*[：:""]?\s*([\u4e00-\u9fa5]{2,})/g,
            /([\u4e00-\u9fa5]{2,})\s*[→➜\->]+\s*([\u4e00-\u9fa5]{2,})/g,
            /从\s*["“”]?([\u4e00-\u9fa5]{2,})["“”]?\s*到\s*["“”]?([\u4e00-\u9fa5]{2,})/g,
            /由\s*["“”]?([\u4e00-\u9fa5]{2,})["“”]?\s*变为\s*["“”]?([\u4e00-\u9fa5]{2,})/g,
          ];
          for (const sp of statePatterns) {
            let sm;
            while ((sm = sp.exec(cell)) !== null) {
              for (let gi = 1; gi < sm.length; gi++) {
                if (sm[gi] && sm[gi].length >= 2 && !keywords.includes(sm[gi])) {
                  keywords.push(sm[gi]);
                }
              }
            }
          }
        }
      }
      // 同义词扩展
      const synonymMap = {
        "待提交": ["待审核提交", "未提交"],
        "已审核": ["审核通过", "审核完成"],
        "已驳回": ["驳回", "审核驳回"],
        "已作废": ["作废", "已废弃"],
        "已生效": ["生效", "已启用"],
        "已停用": ["停用", "已禁用"],
      };
      const expanded = [];
      for (const kw of keywords) {
        if (synonymMap[kw]) {
          for (const syn of synonymMap[kw]) {
            if (!keywords.includes(syn) && !expanded.includes(syn)) expanded.push(syn);
          }
        }
      }
      keywords.push(...expanded);
      cat.ids.set(id, keywords);
    }
  }

  const result = {};
  let allPassed = true;

  for (const [key, cat] of Object.entries(categories)) {
    const total = cat.ids.size;
    if (total === 0) {
      result[key] = { total: 0, embedded: 0, uncovered: [], passed: true, label: cat.label };
      continue;
    }
    const embedded = [];
    const uncovered = [];
    for (const [id, keywords] of cat.ids) {
      // 检查 AC 编号是否在步骤区域出现
      const idInSteps = stepContent.includes(id);
      // 检查关键词是否在步骤区域出现（精确匹配 → 子串降级）
      let kwInSteps = false;
      let matchedBy = null;
      if (keywords.length > 0) {
        // 精确匹配
        kwInSteps = keywords.some(kw => stepContent.includes(kw));
        if (kwInSteps) {
          matchedBy = "exact";
        } else {
          // 降级：关键词子串匹配（≥3字符的关键词，检查是否作为子串出现）
          kwInSteps = keywords.filter(kw => kw.length >= 3).some(kw => {
            return stepContent.includes(kw.slice(0, -1)) || stepContent.includes(kw.slice(1));
          });
          if (kwInSteps) matchedBy = "substring-fallback";
        }
      }
      // 检查是否在案例全文中出现（包括"覆盖AC"声明）
      const inFullContent = allCasesContent.includes(id);

      if (idInSteps || kwInSteps) {
        embedded.push(id);
      } else {
        uncovered.push({ id, declaredOnly: inFullContent, suggestedKeywords: keywords.slice(0, 3) });
      }
    }
    const rate = Math.round((embedded.length / total) * 100);
    const passed = rate >= 100; // 嵌入覆盖率阈值 100%（AC-STS-/AC-CALC-/AC-FMT- 已纳入覆盖率分母，嵌入检查同步要求 100%）
    if (!passed) allPassed = false;
    result[key] = {
      total,
      embedded: embedded.length,
      uncovered: uncovered.map(u => u.id),
      uncoveredDetail: uncovered.map(u => ({ id: u.id, declaredOnly: u.declaredOnly, suggestedKeywords: u.suggestedKeywords })),
      declaredOnly: uncovered.filter(u => u.declaredOnly).map(u => u.id),
      rate,
      passed,
      label: cat.label,
    };
  }

  return { skipped: false, passed: allPassed, categories: result };
}

/**
 * 脚本化语义检查（替代 AI 主观的 Step 2b）
 * 检查 PRD 异常场景表覆盖、业务目标覆盖、案例重复检测
 */
function checkSemanticCoverage(testingDir, allCasesContent, acFilePath) {
  const issues = [];

  // 1. PRD 异常场景表覆盖检查
  const workDir = path.dirname(path.resolve(testingDir));
  const prdDirs = [
    path.join(workDir, "requirement", "prd"),
    path.join(workDir, "design"),
  ];
  let prdContent = "";
  for (const dir of prdDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".md"));
    for (const f of files) {
      prdContent += fs.readFileSync(path.join(dir, f), "utf-8") + "\n";
    }
  }
  if (prdContent) {
    // 预处理：移除 Mermaid/代码块，避免提取流程图节点作为异常关键词
    const cleanedPrd = prdContent.replace(/```[\w]*\n[\s\S]*?```/g, (match) => {
      return /mermaid|flowchart|graph/i.test(match) ? "" : match;
    });
    // 提取异常场景表中的关键词（"异常"/"错误"/"失败" 相关行）
    const exceptionLines = cleanedPrd.split("\n").filter(l => {
      if (!/\|/.test(l)) return false;
      if (/^\|[\s\-:|]+\|$/.test(l.trim())) return false;
      const firstCell = l.split("|").map(c => c.trim()).filter(c => c)[0] || '';
      if (/^(序号|场景|编号|#|异常场景|触发条件|预期结果)$/.test(firstCell)) return false;
      return /异常|错误|失败|报错|超时|不存在|重复|冲突/.test(l);
    });
    const uncoveredExceptions = [];
    for (const line of exceptionLines) {
      const cells = line.split("|").map(c => c.trim()).filter(c => c);
      // 优先取"场景描述"列（通常第3列），回退取第一个有意义的单元格
      let keyword = "";
      if (cells.length >= 3) {
        const sceneCell = cells[2];
        if (sceneCell && sceneCell.length >= 4 && /[一-龥]/.test(sceneCell)) {
          keyword = sceneCell;
        }
      }
      if (!keyword) {
        keyword = cells.find(c => c.length >= 4 && /[一-龥]/.test(c)) || "";
      }
      if (!keyword) continue;
      // 剥离 Mermaid 节点格式前缀（如 D[、F[、J[ 等 单字母+方括号）
      keyword = keyword.replace(/^[A-Z]\[/, "").replace(/\]$/, "");
      // 提取核心关键词：取前12字符匹配，同时取 ≥4字符的中文子串做辅助匹配
      const coreKeyword = keyword.slice(0, Math.min(keyword.length, 12));
      const shortKeywords = keyword.match(/[一-龥]{2,}/g) || [];
      // Generate 4-char sliding window substrings from longer Chinese sequences for better matching
      const matchTokens = [];
      for (const sk of shortKeywords) {
        if (sk.length >= 4) {
          matchTokens.push(sk);
        }
        if (sk.length > 4) {
          for (let i = 0; i <= sk.length - 4; i++) {
            matchTokens.push(sk.substring(i, i + 4));
          }
        }
      }
      const anyMatch = allCasesContent.includes(coreKeyword)
        || matchTokens.some(tk => allCasesContent.includes(tk));
      if (!anyMatch) {
        uncoveredExceptions.push(keyword.slice(0, 30));
      }
    }
    if (uncoveredExceptions.length > 0) {
      issues.push({
        check: "prd-exception-coverage",
        passed: false,
        message: `PRD 异常场景表中 ${uncoveredExceptions.length} 个场景未在案例中覆盖`,
        uncovered: uncoveredExceptions.slice(0, 10),
      });
    } else {
      issues.push({ check: "prd-exception-coverage", passed: true, message: "PRD 异常场景表已覆盖" });
    }
  }

  // 2. 业务目标覆盖检查（从 test-config.json 读取 businessObjective）
  const configPath = path.join(testingDir, "test-config.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const bo = config.businessObjective || "";
      if (bo) {
        const goals = bo.split(";").map(g => g.trim()).filter(g => g);
        const uncoveredGoals = [];
        for (const goal of goals) {
          // 提取 G-N 后面的关键词
          const desc = goal.replace(/^G-\d+:\s*/, "").trim();
          const keywords = desc.split(/[（）—–，、,\s\(\)\-]+/).filter(k => k.length >= 2 && /[一-龥a-zA-Z]/.test(k));
          const covered = keywords.some(kw => allCasesContent.includes(kw));
          if (!covered) uncoveredGoals.push(goal);
        }
        if (uncoveredGoals.length > 0) {
          issues.push({
            check: "business-objective-coverage",
            passed: false,
            message: `${uncoveredGoals.length} 个业务目标未在案例中体现`,
            uncovered: uncoveredGoals,
          });
        } else {
          issues.push({ check: "business-objective-coverage", passed: true, message: "业务目标已覆盖" });
        }
      }
    } catch (e) { /* ignore */ }
  }

  // 3. 案例重复检测（相同的测试步骤描述出现多次）
  const tcBlocks = allCasesContent.split(/(?=###\s+(?:FE|API|FLOW)-)/);
  const stepSignatures = new Map(); // signature -> [tcId]
  for (const block of tcBlocks) {
    const tcMatch = block.match(/###\s+((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/);
    if (!tcMatch) continue;
    const tcId = tcMatch[1];
    // 提取步骤文本作为签名（去除编号和空白）
    const steps = block.match(/(?:测试步骤|操作步骤)[^|]*\|([^|]+)/g);
    if (steps) {
      const sig = steps.map(s => s.replace(/\d+\.\s*/g, "").trim()).join("|").slice(0, 200);
      if (sig.length > 20) {
        if (!stepSignatures.has(sig)) stepSignatures.set(sig, []);
        stepSignatures.get(sig).push(tcId);
      }
    }
  }
  const duplicates = [...stepSignatures.entries()].filter(([, ids]) => ids.length > 1);
  if (duplicates.length > 0) {
    issues.push({
      check: "duplicate-detection",
      passed: false,
      message: `检测到 ${duplicates.length} 组重复案例`,
      duplicates: duplicates.slice(0, 5).map(([, ids]) => ids),
    });
  } else {
    issues.push({ check: "duplicate-detection", passed: true, message: "无重复案例" });
  }

  return {
    passed: issues.every(i => i.passed),
    issues,
  };
}

/**
 * 计算分项覆盖率（按 subagent 类型）
 */
/**
 * API/Flow 去重检查
 */
function checkApiFlowOverlap(apiCases, flowCases) {
  const extractIds = (content) => {
    const ids = new Set();
    const patterns = [
      /\*{0,2}覆盖\s*AC\*{0,2}\s*[:：]\s*([\w\-.\s,，;；（()）]+)/gi,
      /\|\s*\*{0,2}覆盖\s*AC\*{0,2}\s*\|\s*([\w\-.\s,，;；（()）]+?)\s*\|/gi,
    ];
    for (const p of patterns) {
      let m;
      while ((m = p.exec(content)) !== null) {
        m[1].split(/[,，;；\s]+/).forEach(id => {
          const t = id.trim().replace(/[（(].*$/, "");
          if (t && t.startsWith("AC-")) ids.add(t);
        });
      }
    }
    return ids;
  };
  const apiAcIds = extractIds(apiCases);
  const flowAcIds = extractIds(flowCases);
  const overlap = [...apiAcIds].filter(id => flowAcIds.has(id));
  return {
    overlapCount: overlap.length,
    overlapIds: overlap,
    message: overlap.length > 0
      ? `${overlap.length} 个 AC 在 API 和 Flow 案例中重复覆盖（INFO，不扣分）`
      : "无重复覆盖",
  };
}

/**
 * 功能维度覆盖率检查（tree-context.json 存在时，非阻塞警告级别）
 */
function checkTreeFeatureCoverage(allCasesContent, treeContextPath) {
  if (!treeContextPath || !fs.existsSync(treeContextPath)) {
    return { skipped: true, message: "tree-context.json 不存在，跳过功能维度覆盖检查" };
  }
  try {
    const ctx = JSON.parse(fs.readFileSync(treeContextPath, "utf-8"));
    if (!ctx.functionTree || !ctx.functionTree.featureIndex) {
      return { skipped: true, message: "tree-context.json 无功能树数据" };
    }

    const featureIds = Object.keys(ctx.functionTree.featureIndex);
    if (featureIds.length === 0) {
      return { skipped: true, message: "功能树 featureIndex 为空" };
    }

    const coveredFeatures = new Set();
    for (const featId of featureIds) {
      // Method 1: feature ID appears in case descriptions
      if (allCasesContent.includes(featId)) {
        coveredFeatures.add(featId);
        continue;
      }
      // Method 2: feature name keyword appears in case titles
      const info = ctx.functionTree.featureIndex[featId];
      const pageData = ctx.functionTree.pages[info.page];
      if (pageData && pageData.groups && pageData.groups[info.group]) {
        const groupFeats = pageData.groups[info.group].features;
        // Check if any feature in this group's ID pattern appears
        if (groupFeats && groupFeats.some(f => allCasesContent.includes(f))) {
          coveredFeatures.add(featId);
        }
      }
    }

    const uncovered = featureIds.filter(id => !coveredFeatures.has(id));
    const rate = Math.round((coveredFeatures.size / featureIds.length) * 100);

    return {
      skipped: false,
      total: featureIds.length,
      covered: coveredFeatures.size,
      uncovered,
      rate,
      passed: uncovered.length === 0,
      message: uncovered.length > 0
        ? `功能维度覆盖：${coveredFeatures.size}/${featureIds.length}（${rate}%），未覆盖功能：${uncovered.join(", ")}`
        : `功能维度覆盖：${coveredFeatures.size}/${featureIds.length}（100%）`,
    };
  } catch (err) {
    return { skipped: true, message: "tree-context.json 解析失败: " + err.message };
  }
}

/**
 * 从 ac.md 中提取嵌入规则 ID 对应的关联关键词（状态值、计算描述等）。
 * 回退匹配策略：表格行 → 标题行 → 加粗行。
 */
function extractEmbeddedRuleKeywords(acFilePath, uncoveredIds) {
  const keywordMap = new Map();
  try {
    const acContent = fs.readFileSync(acFilePath, "utf-8");
    const lines = acContent.split("\n");
    for (const id of uncoveredIds) {
      const keywords = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes(id)) continue;
        // 表格行：提取第三列及之后的内容作为关键词
        if (line.trim().startsWith("|")) {
          const cells = line.split("|").map(c => c.trim()).filter(c => c);
          if (cells.length >= 3) {
            for (let ci = 2; ci < cells.length; ci++) {
              const kw = cells[ci].replace(/[""「」]/g, "").trim();
              if (kw && kw.length >= 2 && kw !== "--") keywords.push(kw);
            }
          }
        }
        // 标题行：提取标题文本
        else if (/^#{1,4}\s+/.test(line)) {
          const title = line.replace(/^#{1,4}\s+/, "").trim();
          if (title.length >= 4) keywords.push(title);
        }
        // 加粗行：提取加粗内容
        else {
          const boldMatches = line.match(/\*\*([^*]+)\*\*/g);
          if (boldMatches) {
            for (const bm of boldMatches) {
              const text = bm.replace(/\*\*/g, "").trim();
              if (text.length >= 4 && !text.startsWith("AC-")) keywords.push(text);
            }
          }
        }
      }
      keywordMap.set(id, [...new Set(keywords)].slice(0, 5));
    }
  } catch {
    // best-effort extraction
  }
  return keywordMap;
}

function main() {
  const { testingDir, scope, threshold, acFile, acThreshold, acAssignment, treeContext, activeTypes } = parseArgs();
  const cacheDir = path.join(testingDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  const checks = [];
  let overallRate = 0;
  let checkCount = 0;

  // 收集所有案例内容（用于 AC 覆盖检查）
  const allCasesContents = [];

  // 活跃类型（默认全部，与旧流程兼容）
  const types = activeTypes || ['e2e', 'api', 'flow'];

  // E2E 案例检查
  if (types.includes('e2e')) {
    const e2eCases = readTypeMdDir(testingDir, "e2e");
    if (e2eCases) {
      allCasesContents.push(e2eCases);
      const feIds = extractTcIds(e2eCases, "FE");
      const completeness = checkTcCompleteness(feIds);
      const scenarios = checkScenarioTypes(e2eCases);
      const featureCov = checkFeatureCoverage(cacheDir, "e2e", e2eCases);

      checks.push({
        type: "e2e",
        tcCount: feIds.length,
        tcCompleteness: completeness,
        scenarioTypes: scenarios,
        featureCoverage: featureCov,
      });

      if (typeof featureCov.rate === "number") {
        overallRate += featureCov.rate;
        checkCount++;
      }
    }
  }

  // API 案例检查
  if (types.includes('api')) {
    const apiCases = readTypeMdDir(testingDir, "api");
    if (apiCases) {
      allCasesContents.push(apiCases);
      const apiIds = extractTcIds(apiCases, "API");
      const completeness = checkTcCompleteness(apiIds);
      const scenarios = checkScenarioTypes(apiCases);
      const apiSummaryPath = path.join(cacheDir, "api-probe-summary.json");
      const apiCov = checkApiCoverage(apiSummaryPath, apiCases);
      const featureCov = checkFeatureCoverage(cacheDir, "api", apiCases);

      checks.push({
        type: "api",
        tcCount: apiIds.length,
        tcCompleteness: completeness,
        scenarioTypes: scenarios,
        apiCoverage: apiCov,
        featureCoverage: featureCov,
      });

      if (typeof apiCov.rate === "number") {
        overallRate += apiCov.rate;
        checkCount++;
      }
      if (typeof featureCov.rate === "number") {
        overallRate += featureCov.rate;
        checkCount++;
      }
    }
  }

  // 流程案例检查
  if (types.includes('flow')) {
    const flowCases = readTypeMdDir(testingDir, "flow");
    if (flowCases) {
      allCasesContents.push(flowCases);
      const flowIds = extractTcIds(flowCases, "FLOW");
      const completeness = checkTcCompleteness(flowIds);
      const flowCov = checkFlowCoverage(flowCases);
      const featureCov = checkFeatureCoverage(cacheDir, "flow", flowCases);
      const acOpCov = checkAcOpCoverage(acFile, flowCases);
      const stateTransCov = checkStateTransitionCoverage(acFile, flowCases);

      checks.push({
        type: "flow",
        tcCount: flowIds.length,
        tcCompleteness: completeness,
        flowCoverage: flowCov,
        featureCoverage: featureCov,
        acOpCoverage: acOpCov,
        stateTransitionCoverage: stateTransCov,
      });

      if (typeof featureCov.rate === "number") {
        overallRate += featureCov.rate;
        checkCount++;
      }
    }
  }

  const avgRate = checkCount > 0 ? Math.round(overallRate / checkCount) : 100;
  const featurePassed = checkCount > 0 ? avgRate >= threshold : true;

  // AC 覆盖率检查（try-catch 隔离，不影响功能点覆盖检查）
  const allCasesContent = allCasesContents.join("\n");
  const acCoverage = checkAcCoverage(acFile, allCasesContent, acThreshold, acAssignment, activeTypes);

  // 嵌入规则覆盖检查（AC-STS-/AC-CALC-/AC-FMT- 必须作为验证点嵌入案例步骤）
  const embeddedRuleCoverage = checkEmbeddedRuleCoverage(acFile, allCasesContent, activeTypes);

  // 脚本化语义检查（替代 AI 主观的 Step 2b）
  const semanticCheck = checkSemanticCoverage(testingDir, allCasesContent, acFile);

  // 功能维度覆盖检查（tree-context.json 存在时，非阻塞警告级别）
  const treeFeatureCoverage = checkTreeFeatureCoverage(allCasesContent, treeContext);

  // AC-OP 操作语义覆盖检查（从 flow checks 中提取）
  let acOpDeclaredOnlyGap = false;
  let stateTransitionGap = false;
  for (const check of checks) {
    if (check.acOpCoverage?.declaredOnly?.length > 0) acOpDeclaredOnlyGap = true;
    if (check.acOpCoverage?.uncovered?.length > 0) acOpDeclaredOnlyGap = true;
    if (check.stateTransitionCoverage?.uncoveredStates?.length > 0) stateTransitionGap = true;
    if (check.stateTransitionCoverage?.declaredOnlyStates?.length > 0) stateTransitionGap = true;
  }

  // 嵌入规则覆盖缺口
  const embeddedRuleGap = !embeddedRuleCoverage.skipped && !embeddedRuleCoverage.passed;

  // 决策逻辑：独立收集所有失败维度（不再互斥）
  let apiFlowOverlap = null;

  // API/Flow 去重检查
  if (types.includes('api') && types.includes('flow')) {
    const apiCasesForOverlap = readTypeMdDir(testingDir, "api");
    const flowCasesForOverlap = readTypeMdDir(testingDir, "flow");
    if (apiCasesForOverlap && flowCasesForOverlap) {
      apiFlowOverlap = checkApiFlowOverlap(apiCasesForOverlap, flowCasesForOverlap);
    }
  }

  // Phase 1: 独立收集所有失败维度（不再互斥）
  const actions = [];
  const allGaps = {
    acCoverage: null,
    acOp: null,
    stateTransition: null,
    embeddedRules: null,
    featureCoverage: null,
    semantic: null,
  };

  if (acCoverage.passed === false && typeof acCoverage.overallRate === "number") {
    actions.push("ac-coverage-gap");
    allGaps.acCoverage = {
      uncovered: acCoverage.uncovered || [],
      rate: acCoverage.overallRate,
    };
  }

  if (acOpDeclaredOnlyGap) {
    actions.push("ac-op-gap");
    allGaps.acOp = checks
      .filter(c => c.acOpCoverage?.uncovered?.length > 0 || c.acOpCoverage?.declaredOnly?.length > 0)
      .map(c => ({
        type: c.type,
        uncovered: c.acOpCoverage.uncovered,
        declaredOnly: c.acOpCoverage.declaredOnly,
      }));
  }

  if (stateTransitionGap) {
    actions.push("state-transition-gap");
    allGaps.stateTransition = checks
      .filter(c => c.stateTransitionCoverage?.uncoveredStates?.length > 0
        || c.stateTransitionCoverage?.declaredOnlyStates?.length > 0)
      .map(c => ({
        type: c.type,
        uncoveredStates: c.stateTransitionCoverage.uncoveredStates,
        declaredOnlyStates: c.stateTransitionCoverage.declaredOnlyStates,
      }));
  }

  if (embeddedRuleGap) {
    actions.push("embedded-rule-gap");
    const enrichedCategories = {};
    for (const [catKey, cat] of Object.entries(embeddedRuleCoverage.categories)) {
      enrichedCategories[catKey] = { ...cat };
      if (cat.uncovered?.length > 0 && acFile && fs.existsSync(acFile)) {
        const keywordMap = extractEmbeddedRuleKeywords(acFile, cat.uncovered);
        enrichedCategories[catKey].uncoveredWithKeywords = cat.uncovered.map(id => ({
          id,
          keywords: keywordMap.get(id) || [],
        }));
      }
    }
    allGaps.embeddedRules = enrichedCategories;
  }

  if (!featurePassed) {
    actions.push("coverage-gap");
    allGaps.featureCoverage = checks
      .filter(c => c.featureCoverage?.uncovered?.length > 0)
      .map(c => ({
        type: c.type,
        uncovered: c.featureCoverage.uncovered,
        rate: c.featureCoverage.rate,
      }));
  }

  if (!semanticCheck.passed) {
    actions.push("semantic-gap");
    allGaps.semantic = semanticCheck;
  }

  // Phase 2: 向后兼容的单一 action 值
  const action = actions[0] || "continue";

  const overallPassed = featurePassed && (acCoverage.passed !== false) && semanticCheck.passed
    && !acOpDeclaredOnlyGap && !stateTransitionGap && !embeddedRuleGap;
  const result = {
    passed: overallPassed,
    overallPassed,
    overallCoverageRate: avgRate,
    threshold,
    checks,
    acCoverage,
    embeddedRuleCoverage,
    semanticCheck,
    apiFlowOverlap: apiFlowOverlap || null,
    treeFeatureCoverage: treeFeatureCoverage || null,
    action,
    actions,
    allGaps,
    coverageGaps: [],
    timestamp: new Date().toISOString(),
  };

  // 收集覆盖缺口
  for (const check of checks) {
    if (check.featureCoverage?.uncovered?.length > 0) {
      result.coverageGaps.push(...check.featureCoverage.uncovered.map(f => ({
        type: check.type, gap: "feature", name: f,
      })));
    }
    if (check.apiCoverage?.uncovered?.length > 0) {
      result.coverageGaps.push(...check.apiCoverage.uncovered.map(f => ({
        type: check.type, gap: "api", name: f,
      })));
    }
    if (check.scenarioTypes) {
      if (check.scenarioTypes.exception === 0) {
        result.coverageGaps.push({ type: check.type, gap: "scenario", name: "异常场景缺失" });
      }
      if (check.scenarioTypes.boundary === 0) {
        result.coverageGaps.push({ type: check.type, gap: "scenario", name: "边界值缺失" });
      }
    }
    // 流程完整性缺口
    if (check.flowCoverage?.writeOpCoverage?.onlyQueryFlows) {
      result.coverageGaps.push({ type: check.type, gap: "flow-completeness", name: "仅有查询流程，缺少写操作流程（创建/编辑/删除/状态变更）" });
    }
    if (check.flowCoverage?.queryRatio >= 80) {
      result.coverageGaps.push({ type: check.type, gap: "flow-completeness", name: `查询步骤占比过高（${check.flowCoverage.queryRatio}%），流程案例应以写操作为主` });
    }
    if (check.acOpCoverage?.uncovered?.length > 0) {
      result.coverageGaps.push(...check.acOpCoverage.uncovered.map(op => ({
        type: check.type, gap: "ac-op", name: `AC操作未覆盖: ${op}`,
      })));
    }
    if (check.acOpCoverage?.declaredOnly?.length > 0) {
      result.coverageGaps.push(...check.acOpCoverage.declaredOnly.map(op => ({
        type: check.type, gap: "ac-op-declared-only", name: `AC操作仅声明未在步骤中执行: ${op}`,
      })));
    }
    if (check.stateTransitionCoverage?.uncoveredStates?.length > 0) {
      result.coverageGaps.push(...check.stateTransitionCoverage.uncoveredStates.map(s => ({
        type: check.type, gap: "state-transition", name: `状态未覆盖: ${s}`,
      })));
    }
    if (check.stateTransitionCoverage?.declaredOnlyStates?.length > 0) {
      result.coverageGaps.push(...check.stateTransitionCoverage.declaredOnlyStates.map(s => ({
        type: check.type, gap: "state-declared-only", name: `状态仅声明未在步骤中验证: ${s}`,
      })));
    }
  }

  const outputPath = path.join(cacheDir, "coverage-check-result.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  // --- 精简摘要文件（供 agent 直接透传，避免读大 JSON 触发 retry）---
  const summary = {
    score: avgRate,
    action: action,
    missingAc: (acCoverage.uncovered || []).slice(0, 20),
    details: [
      acCoverage.passed === false && `AC coverage: ${acCoverage.overallRate}%`,
      !featurePassed && `Feature coverage: ${avgRate}% (threshold: ${threshold}%)`,
      !semanticCheck.passed && `Semantic: ${semanticCheck.issues.filter(i => !i.passed).map(i => i.check).join(',')}`,
      embeddedRuleGap && 'Embedded rules gap',
      acOpDeclaredOnlyGap && 'AC-OP gap',
      stateTransitionGap && 'State transition gap',
    ].filter(Boolean).join('; ') || 'All checks passed',
  };
  fs.writeFileSync(path.join(cacheDir, "coverage-check-summary.json"), JSON.stringify(summary, null, 2));

  console.log(`覆盖率预检: ${featurePassed ? "[OK]" : "[FAIL]"} (${avgRate}% >= ${threshold}%)`);
  if (acCoverage.total !== undefined) {
    console.log(`AC 覆盖率: ${acCoverage.passed ? "[OK]" : "[FAIL]"} 综合 ${acCoverage.overallRate}% >= ${acCoverage.acThreshold}% (AC: ${acCoverage.acRate}% >= ${acCoverage.acRateThreshold}%, UI: ${acCoverage.uiRate}% >= ${acCoverage.uiRateThreshold}%) | 总数 ${acCoverage.totalInAcFile}, 排除 ${acCoverage.excludedCount}, 计入分母 ${acCoverage.total}, 已覆盖 ${acCoverage.covered}, 未覆盖 ${acCoverage.uncoveredCount}`);
  } else if (acCoverage.message) {
    console.log(`AC 覆盖率: [INFO] ${acCoverage.message}`);
  }
  if (result.coverageGaps.length > 0) {
    console.log(`覆盖缺口: ${result.coverageGaps.length} 项`);
    for (const gap of result.coverageGaps.slice(0, 10)) {
      console.log(`  - [${gap.type}] ${gap.gap}: ${gap.name}`);
    }
    if (result.coverageGaps.length > 10) {
      console.log(`  ... 另有 ${result.coverageGaps.length - 10} 项缺口`);
    }
  }
  // 流程完整性检查结果
  for (const check of checks) {
    if (check.type === "flow") {
      if (check.flowCoverage?.writeOpCoverage?.onlyQueryFlows) {
        console.log(`[WARN] 流程案例仅有查询流程，缺少写操作流程（创建/编辑/删除/状态变更）`);
      }
      if (check.flowCoverage?.queryRatio >= 80) {
        console.log(`[WARN] 查询步骤占比过高（${check.flowCoverage.queryRatio}%），流程案例应以写操作为主`);
      }
      if (check.acOpCoverage?.uncovered?.length > 0) {
        console.log(`[WARN] AC-OP 未覆盖: ${check.acOpCoverage.uncovered.join(", ")}`);
      }
      if (check.acOpCoverage?.declaredOnly?.length > 0) {
        console.log(`[WARN] AC-OP 仅声明未在步骤中执行: ${check.acOpCoverage.declaredOnly.join(", ")}`);
      }
      if (check.stateTransitionCoverage?.uncoveredStates?.length > 0) {
        console.log(`[WARN] 状态未覆盖: ${check.stateTransitionCoverage.uncoveredStates.join(", ")}`);
      }
      if (check.stateTransitionCoverage?.declaredOnlyStates?.length > 0) {
        console.log(`[WARN] 状态仅声明未在步骤中验证: ${check.stateTransitionCoverage.declaredOnlyStates.join(", ")}`);
      }
    }
  }
  if (action === "ac-coverage-gap") {
    console.log(`[WARN] AC 覆盖率不足（${acCoverage.overallRate}% < 100%），跳过评审直接修正`);
  }
  if (action === "ac-op-gap") {
    console.log(`[WARN] AC-OP 操作未在步骤中实际执行或未覆盖，跳过评审直接修正`);
  }
  if (action === "state-transition-gap") {
    console.log(`[WARN] 状态转换路径未完整覆盖（< 90%），跳过评审直接修正`);
  }
  if (action === "embedded-rule-gap") {
    console.log(`[WARN] 嵌入规则覆盖不足（AC-STS-/AC-CALC-/AC-FMT- 未在案例步骤中验证），跳过评审直接修正`);
  }
  if (actions.length > 1) {
    console.log(`多维度缺口: ${actions.join(", ")} (合并修复)`);
  }
  // API/Flow 去重检查结果
  if (apiFlowOverlap && apiFlowOverlap.overlapCount > 0) {
    console.log(`[INFO] ${apiFlowOverlap.message}`);
  }
  // 嵌入规则覆盖检查结果
  if (!embeddedRuleCoverage.skipped) {
    const erIcon = embeddedRuleCoverage.passed ? "[OK]" : "[FAIL]";
    console.log(`嵌入规则覆盖: ${erIcon}`);
    for (const [key, cat] of Object.entries(embeddedRuleCoverage.categories || {})) {
      if (cat.total > 0) {
        console.log(`  ${cat.label}: ${cat.embedded}/${cat.total} (${cat.rate}%)${cat.uncovered.length > 0 ? ' 未覆盖: ' + cat.uncovered.join(', ') : ''}`);
        // 加入 coverageGaps
        for (const id of cat.uncovered) {
          result.coverageGaps.push({ type: "embedded-rule", gap: `${key}-uncovered`, name: `${cat.label}未嵌入验证: ${id}` });
        }
        for (const id of (cat.declaredOnly || [])) {
          result.coverageGaps.push({ type: "embedded-rule", gap: `${key}-declared-only`, name: `${cat.label}仅声明未在步骤中验证: ${id}` });
        }
      }
    }
  }
  // 语义检查结果
  if (!semanticCheck.passed) {
    console.log(`语义检查: [FAIL]`);
    for (const issue of semanticCheck.issues.filter(i => !i.passed)) {
      console.log(`  - ${issue.check}: ${issue.message}`);
    }
  } else {
    console.log(`语义检查: [OK]`);
  }
  // 功能维度覆盖检查结果（非阻塞，警告级别）
  if (treeFeatureCoverage && !treeFeatureCoverage.skipped) {
    const tfIcon = treeFeatureCoverage.passed ? "[OK]" : "[WARN]";
    console.log(`功能维度覆盖: ${tfIcon} ${treeFeatureCoverage.message}`);
    if (treeFeatureCoverage.uncovered && treeFeatureCoverage.uncovered.length > 0) {
      console.log(`  提示：请检查 AC 是否覆盖了所有功能树列出的功能`);
    }
  }
  // 语义缺口加入 coverageGaps
  for (const issue of semanticCheck.issues.filter(i => !i.passed)) {
    if (issue.uncovered) {
      result.coverageGaps.push(...issue.uncovered.map(u => ({
        type: "semantic", gap: issue.check, name: u,
      })));
    }
    if (issue.duplicates) {
      result.coverageGaps.push(...issue.duplicates.map(d => ({
        type: "semantic", gap: "duplicate", name: `重复案例: ${d.join(", ")}`,
      })));
    }
  }

  // 格式自检：检测非规范格式（表格数据行）
  for (const content of allCasesContents) {
    const allLines = content.split("\n");
    const tableDataLines = allLines.filter(l => {
      const t = l.trim();
      return /^\|\s*\d+\s*\|/.test(t) && !/^\|[\s\-:|]+\|$/.test(t);
    });
    if (tableDataLines.length > 0) {
      result.formatWarning = `发现 ${tableDataLines.length} 行表格数据格式（E2E/API 应为编号列表格式），脚本已兼容提取。长期目标：通过格式约束消除不规范格式后此告警应不再触发`;
      break;
    }
  }
  // 重新写入（语义缺口已追加）
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  // 决策摘要由 gen-test Wave 3 生成 case-gen-report.md，此处不再单独生成 summary.txt
  console.error(`[OK] 覆盖率结果: ${outputPath}`);
  process.exit(result.passed ? 0 : 1);
}

main();
