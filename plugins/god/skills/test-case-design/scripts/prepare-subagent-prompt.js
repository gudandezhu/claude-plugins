#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { extractCoverageIds } = require("../../../scripts/lib/coverage-id-extractor");
const { safeReadJson } = require("../../../scripts/lib/safe-json");

const REFERENCE_MAP = {
  e2e: "references/e2e-case-design.md",
  api: "references/api-case-design.md",
  flow: "references/api-flow-case-design.md",
};

const OUTPUT_PATH_MAP = {
  e2e: "testing/test-cases/e2e-test-cases.json",
  api: "testing/test-cases/api-test-cases.json",
  flow: "testing/test-cases/api-flow-test-cases.json",
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {
    type: null,
    workDir: null,
    pluginDir: null,
    mode: "generate",
    businessObjective: "",
    prdPaths: "",
    acFile: "",
    uiPaths: "",
    apiDocPaths: "",
    domProbeSummary: "",
    suggestions: "",
    coverageGaps: "",
    methodologyDir: "",
    userPerspectivesDir: "",
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--type" && argv[i + 1]) args.type = argv[++i];
    else if (argv[i] === "--work-dir" && argv[i + 1]) args.workDir = argv[++i];
    else if (argv[i] === "--plugin-dir" && argv[i + 1]) args.pluginDir = argv[++i];
    else if (argv[i] === "--mode" && argv[i + 1]) args.mode = argv[++i];
    else if (argv[i] === "--business-objective" && argv[i + 1]) args.businessObjective = argv[++i];
    else if (argv[i] === "--prd-paths" && argv[i + 1]) args.prdPaths = argv[++i];
    else if (argv[i] === "--ac-file" && argv[i + 1]) args.acFile = argv[++i];
    else if (argv[i] === "--ui-paths" && argv[i + 1]) args.uiPaths = argv[++i];
    else if (argv[i] === "--api-doc-paths" && argv[i + 1]) args.apiDocPaths = argv[++i];
    else if (argv[i] === "--dom-probe-summary" && argv[i + 1]) args.domProbeSummary = argv[++i];
    else if (argv[i] === "--suggestions" && argv[i + 1]) args.suggestions = argv[++i];
    else if (argv[i] === "--coverage-gaps" && argv[i + 1]) args.coverageGaps = argv[++i];
    else if (argv[i] === "--coverage-gaps-json" && argv[i + 1]) args.coverageGapsJson = argv[++i];
    else if (argv[i] === "--methodology-dir" && argv[i + 1]) args.methodologyDir = argv[++i];
    else if (argv[i] === "--user-perspectives-dir" && argv[i + 1]) args.userPerspectivesDir = argv[++i];
  }
  return args;
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function normalizePath(p) {
  return p.replace(/\\/g, "/");
}

/**
 * 解析逗号分隔的路径列表，相对路径基于 baseDir 解析。
 * 修复：原逻辑 path.resolve(args.prdPaths) 基于 process.cwd()，
 * 传入 "requirement/prd" 时解析为 cwd + "/requirement/prd"（错误），
 * 应基于 workDir 解析为 workDir + "/requirement/prd"。
 */
function resolveRelativePaths(input, baseDir) {
  if (!input) return "";
  return input.split(",")
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => normalizePath(path.resolve(baseDir, p)))
    .join(", ");
}

function fileExistsAndReadable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function extractRelevantAcEntries(acContent, uncoveredIds) {
  const lines = acContent.split("\n");
  const entries = [];
  for (const id of uncoveredIds) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(id)) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        entries.push(...lines.slice(start, end));
      }
    }
  }
  return [...new Set(entries)].join("\n");
}

function extractCaseIds(content, type) {
  const prefix = type === "e2e" ? "FE" : type === "api" ? "API" : "FLOW";
  const regex = new RegExp(`###\\s+(${prefix}-[^\\s]+)`, "g");
  const ids = [];
  let m;
  while ((m = regex.exec(content)) !== null) ids.push(m[1]);
  return ids;
}

function extractTargetCaseSections(content, allGaps) {
  const targetKeywords = [];
  if (allGaps.embeddedRules) {
    for (const [, cat] of Object.entries(allGaps.embeddedRules)) {
      if (cat.uncovered) targetKeywords.push(...cat.uncovered);
      if (cat.uncoveredWithKeywords) {
        for (const item of cat.uncoveredWithKeywords) {
          if (item.keywords) targetKeywords.push(...item.keywords);
        }
      }
    }
  }
  if (allGaps.acOp) {
    for (const op of allGaps.acOp) {
      if (op.uncovered) targetKeywords.push(...op.uncovered);
      if (op.declaredOnly) targetKeywords.push(...op.declaredOnly);
    }
  }
  if (allGaps.stateTransition) {
    for (const st of allGaps.stateTransition) {
      if (st.uncoveredStates) targetKeywords.push(...st.uncoveredStates);
      if (st.declaredOnlyStates) targetKeywords.push(...st.declaredOnlyStates);
    }
  }

  if (targetKeywords.length === 0) return "";

  const sections = content.split(/(?=^###\s+(?:FE|API|FLOW)-)/m);
  const targetSections = sections.filter(s =>
    targetKeywords.some(kw => s.includes(kw))
  ).slice(0, 10);
  return targetSections.join("\n\n---\n\n");
}

/**
 * 过滤 API 文档：只保留 API 主责 AC 对应的接口文档，避免 context 爆炸。
 * 不依赖 filtered-api-docs.json（该文件因 filter-swagger.js 参数不匹配从未成功生成）。
 * 直接从 ac-assignment.json + ac.md 提取关键词匹配。
 */
function filterApiDocs(apiDocPaths, cacheDir, workDir) {
  if (!apiDocPaths) return apiDocPaths;

  const pathParts = apiDocPaths.split(",").map(p => p.trim()).filter(Boolean);
  const apiDirs = [];
  const apiFiles = [];
  for (const p of pathParts) {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) apiDirs.push(p);
    else apiFiles.push(p);
  }
  if (apiDirs.length === 0) return apiDocPaths;

  const allMdFiles = [];
  for (const dir of apiDirs) {
    try {
      for (const entry of fs.readdirSync(dir)) {
        if (entry.endsWith(".md")) allMdFiles.push(path.join(dir, entry));
      }
    } catch { return apiDocPaths; }
  }
  if (allMdFiles.length <= 10) return apiDocPaths;

  // 构建匹配关键词
  const matchKeywords = new Set();
  const acAssignFile = path.join(cacheDir, "ac-assignment.json");
  let apiAcIds = [];

  if (fileExistsAndReadable(acAssignFile)) {
    try {
      const asgn = JSON.parse(fs.readFileSync(acAssignFile, "utf-8"));
      apiAcIds = (asgn.assignment && asgn.assignment.coverable && asgn.assignment.coverable.ids) || [];
    } catch { /* ignore */ }
  }

  // 源 1：从 ac.md 提取 API 主责 AC 附近的中文/英文关键词
  const acPath = ["design/ac.md", "requirement/ac.md"]
    .map(p => path.join(workDir, p))
    .find(p => fileExistsAndReadable(p));
  if (acPath) {
    try {
      const acContent = fs.readFileSync(acPath, "utf-8");
      const lines = acContent.split("\n");
      for (const acId of apiAcIds) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(acId)) {
            const s = Math.max(0, i - 2), e = Math.min(lines.length, i + 3);
            for (let j = s; j < e; j++) {
              for (const w of (lines[j].match(/[一-龥]{2,8}/g) || [])) {
                if (w.length >= 2) matchKeywords.add(w);
              }
              for (const w of (lines[j].match(/[a-zA-Z]{3,}/g) || [])) {
                const lower = w.toLowerCase();
                if (!["and","the","for","not","all","has","can"].includes(lower)) matchKeywords.add(lower);
              }
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // 源 2（可选）：filtered-api-docs.json endpoints
  const filteredApiFile = path.join(cacheDir, "filtered-api-docs.json");
  if (fileExistsAndReadable(filteredApiFile)) {
    try {
      const filtered = JSON.parse(fs.readFileSync(filteredApiFile, "utf-8"));
      for (const ep of (filtered.endpoints || [])) {
        if (Array.isArray(ep.tags)) for (const t of ep.tags) matchKeywords.add(t.toLowerCase());
        if (ep.summary) for (const w of (ep.summary.match(/[一-龥]{2,8}/g) || [])) if (w.length >= 2) matchKeywords.add(w);
        if (ep.operationId) matchKeywords.add(ep.operationId.toLowerCase());
        if (ep.path) for (const seg of ep.path.split("/").filter(s => s && !s.startsWith("{") && s.length >= 3)) matchKeywords.add(seg.toLowerCase());
      }
    } catch { /* ignore */ }
  }

  // 停用词
  for (const sw of ["api","v1","v2","v3","query","list","get","create","update","delete","add","remove","save","find","search","page","detail","info","config","manage","index","edit","new","batch","export","import","download","upload","submit","cancel","confirm","enable","disable","check","verify","count","status","type","id"]) {
    matchKeywords.delete(sw);
  }

  if (matchKeywords.size === 0) {
    console.log("[WARN] filterApiDocs: 无匹配关键词，降级截断");
    if (allMdFiles.length > 15) return [...apiFiles, ...allMdFiles.slice(0, 15)].map(p => normalizePath(p)).join(", ");
    return apiDocPaths;
  }
  console.log("[INFO] filterApiDocs: " + matchKeywords.size + " 个关键词");

  const matchedFiles = [];
  for (const filePath of allMdFiles) {
    const basename = path.basename(filePath, ".md").toLowerCase();
    const segs = basename.split(/[-_\s]+/).filter(s => s.length >= 2);
    let isMatch = segs.some(s => matchKeywords.has(s)) || matchKeywords.has(basename);

    if (!isMatch) {
      try {
        const fd = fs.openSync(filePath, "r");
        const buf = Buffer.alloc(4096);
        const n = fs.readSync(fd, buf, 0, 4096, 0);
        fs.closeSync(fd);
        const head = buf.toString("utf-8", 0, n);
        // frontmatter tags
        const fmMatch = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          const tagsMatch = fmMatch[1].match(/tags?\s*:\s*\[([^\]]*)\]/i);
          if (tagsMatch) {
            for (const t of tagsMatch[1].split(/[,，]/).map(t => t.trim().replace(/["']/g, "").toLowerCase()).filter(Boolean)) {
              if (matchKeywords.has(t)) { isMatch = true; break; }
            }
          }
        }
        // API paths
        if (!isMatch) {
          for (const pm of (head.match(/\/api\/[^\s<>"')\]]+/g) || [])) {
            for (const seg of pm.split("/").filter(s => s && !s.startsWith("{") && s.length >= 2)) {
              if (matchKeywords.has(seg.toLowerCase())) { isMatch = true; break; }
            }
            if (isMatch) break;
          }
        }
        // 中文关键词
        if (!isMatch) {
          for (const w of (head.match(/[一-龥]{2,8}/g) || [])) {
            if (matchKeywords.has(w)) { isMatch = true; break; }
          }
        }
      } catch { isMatch = true; }
    }
    if (isMatch) matchedFiles.push(filePath);
  }

  if (matchedFiles.length === 0) {
    if (allMdFiles.length > 15) {
      console.log("[WARN] filterApiDocs: 无匹配，截断前 15 个");
      return [...apiFiles, ...allMdFiles.slice(0, 15)].map(p => normalizePath(p)).join(", ");
    }
    return apiDocPaths;
  }

  console.log("[OK] filterApiDocs: " + allMdFiles.length + " → " + matchedFiles.length + " 个（API AC: " + apiAcIds.join(", ") + "）");
  return [...apiFiles, ...matchedFiles].map(p => normalizePath(p)).join(", ");
}


function main() {
  const args = parseArgs();

  if (!args.type || !REFERENCE_MAP[args.type]) {
    fail(`无效的 --type 参数: ${args.type}（可选: e2e, api, flow）`);
  }
  if (!args.workDir) fail("缺少 --work-dir 参数");
  if (!args.pluginDir) fail("缺少 --plugin-dir 参数");
  if (!args.businessObjective) fail("缺少 --business-objective 参数");
  if (!args.prdPaths && args.mode !== "fix") fail("缺少 --prd-paths 参数");

  const workDir = normalizePath(path.resolve(args.workDir));
  const pluginDir = normalizePath(path.resolve(args.pluginDir));
  const cacheDir = `${workDir}/testing/.cache`;

  const templatePath = path.resolve(args.pluginDir, "skills/test-case-design/prompts/case-designer.md");
  if (!fileExistsAndReadable(templatePath)) {
    fail(`模板文件不存在: ${templatePath}`);
  }
  let template = fs.readFileSync(templatePath, "utf-8");

  const caseDesignReferencePath = normalizePath(
    path.resolve(args.pluginDir, "skills/test-case-design", REFERENCE_MAP[args.type])
  );

  let inputDigestPath = "";
  const digestFile = path.join(cacheDir, "input-digest.json");
  if (fileExistsAndReadable(digestFile)) {
    try {
      const digest = JSON.parse(fs.readFileSync(digestFile, "utf-8"));
      if (digest.splitRequired === true) {
        inputDigestPath = normalizePath(digestFile);
      }
    } catch {
      console.log("[WARN] input-digest.json 解析失败，跳过");
    }
  }

  let flowIdentificationPath = "";
  if (args.type === "flow") {
    const flowFile = path.join(cacheDir, "flow-identification.json");
    if (fileExistsAndReadable(flowFile)) {
      flowIdentificationPath = normalizePath(flowFile);
    } else {
      console.log("[INFO] flow-identification.json 不存在，flowIdentificationPath 为空");
    }
  }

  let acAssignmentPath = "";
  const acAssignFile = path.join(cacheDir, "ac-assignment.json");
  if (fileExistsAndReadable(acAssignFile)) {
    acAssignmentPath = normalizePath(acAssignFile);
  }

  let acFilePath = "";
  if (args.acFile && fileExistsAndReadable(args.acFile)) {
    acFilePath = normalizePath(path.resolve(args.acFile));
  } else if (args.acFile) {
    console.log(`[WARN] ac-file 不存在: ${args.acFile}，acFilePath 设为空`);
  }

  let domProbeSummaryPath = "";
  if (args.domProbeSummary && fileExistsAndReadable(path.resolve(workDir, args.domProbeSummary))) {
    domProbeSummaryPath = normalizePath(path.resolve(workDir, args.domProbeSummary));
  }

  // Fix 模式下隔离上下文：清空与修正无关的文件路径
  const isFixMode = args.mode === "fix";

  const vars = {
    mode: args.mode,
    caseType: args.type,
    businessObjective: args.businessObjective,
    acFilePath,
    acAssignmentPath,
    prdPaths: isFixMode ? "" : resolveRelativePaths(args.prdPaths, workDir),
    inputDigestPath: isFixMode ? "" : inputDigestPath,
    uiPrototypePaths: isFixMode ? "" : (args.uiPaths ? resolveRelativePaths(args.uiPaths, workDir) : ""),
    apiDocPaths: isFixMode ? "" : (() => {
      if (!args.apiDocPaths) return "";
      const rawPaths = resolveRelativePaths(args.apiDocPaths, workDir);
      // 仅 api + generate 模式下执行过滤
      if (args.type === "api" && args.mode === "generate") {
        return filterApiDocs(rawPaths, cacheDir, workDir);
      }
      return rawPaths;
    })(),
    domProbeSummaryPath: isFixMode ? "" : domProbeSummaryPath,
    flowIdentificationPath,
    caseDesignReferencePath,
    e2eCasesOutputPath: normalizePath(path.join(workDir, OUTPUT_PATH_MAP.e2e)),
    apiCasesOutputPath: normalizePath(path.join(workDir, OUTPUT_PATH_MAP.api)),
    flowCasesOutputPath: normalizePath(path.join(workDir, OUTPUT_PATH_MAP.flow)),
    workDir,
    suggestions: args.suggestions || "",
    coverageGaps: args.coverageGaps || "",
    existingCoverageList: (() => {
      if (!isFixMode) return "";
      const targetRel = OUTPUT_PATH_MAP[args.type];
      const targetPath = path.join(workDir, targetRel);
      if (!fs.existsSync(targetPath)) return "(目标文件不存在)";
      try {
        const ids = extractCoverageIds(fs.readFileSync(targetPath, "utf-8"));
        return ids.length > 0 ? ids.join(", ") : "(当前文件无覆盖标注)";
      } catch {
        return "(读取覆盖标注失败)";
      }
    })(),
    treeContextPath: isFixMode ? "" : (() => {
      const tcp = path.join(cacheDir, "tree-context.json");
      if (fileExistsAndReadable(tcp)) {
        try {
          const ctx = JSON.parse(fs.readFileSync(tcp, "utf-8"));
          if (ctx.status === "OK") return normalizePath(tcp);
        } catch { /* ignore */ }
      }
      return "";
    })(),
    methodologyDir: (() => {
      if (!args.methodologyDir) return "";
      const mp = path.resolve(args.methodologyDir);
      if (fs.existsSync(mp) && fs.readdirSync(mp).some(f => f.endsWith(".json"))) {
        return normalizePath(mp);
      }
      return "";
    })(),
    userPerspectivesDir: (() => {
      if (!args.userPerspectivesDir) return "";
      const up = path.resolve(args.userPerspectivesDir);
      if (fs.existsSync(up) && fs.readdirSync(up).some(f => f.endsWith(".md") && !f.startsWith("_"))) {
        return normalizePath(up);
      }
      return "";
    })(),
  };

  let replacedCount = 0;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{${key}\\}`, "g");
    const matches = template.match(pattern);
    if (matches) {
      replacedCount += matches.length;
      template = template.replace(pattern, value);
    }
  }

  // Fix 模式上下文精简：根据缺口类型决定上下文策略
  if (isFixMode && args.coverageGapsJson && fileExistsAndReadable(args.coverageGapsJson)) {
    const gapsData = safeReadJson(args.coverageGapsJson, { fallback: {} });
    const allGaps = gapsData.allGaps || {};
    const gapActions = gapsData.actions || [];

    const MODIFICATION_ACTIONS = ["embedded-rule-gap", "ac-op-gap", "state-transition-gap"];
    const isModifyFix = gapActions.some(a => MODIFICATION_ACTIONS.includes(a));
    const isAppendFix = gapActions.some(a => !MODIFICATION_ACTIONS.includes(a));

    // 1. AC 文件按需提取：只提取未覆盖 AC 的条目
    if (allGaps.acCoverage?.uncovered?.length > 0 && acFilePath && fs.existsSync(acFilePath)) {
      const acContent = fs.readFileSync(acFilePath, "utf-8");
      const relevantEntries = extractRelevantAcEntries(acContent, allGaps.acCoverage.uncovered);
      template += `\n\n### 需覆盖的 AC 条目（从 ac.md 提取）\n${relevantEntries}`;
      // 清空路径变量，禁止 subagent 读取完整 ac.md
      template = template.replace(new RegExp(acFilePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
      if (acAssignmentPath) {
        template = template.replace(new RegExp(acAssignmentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
      }
    }

    // 2. 修改型修复：提取目标案例段落
    if (isModifyFix) {
      const existingCasesPath = path.join(workDir, OUTPUT_PATH_MAP[args.type]);
      if (fs.existsSync(existingCasesPath)) {
        const casesContent = fs.readFileSync(existingCasesPath, "utf-8");
        const targetSections = extractTargetCaseSections(casesContent, allGaps);
        if (targetSections) {
          template += `\n\n### 需修改的目标案例段落\n\`\`\`markdown\n${targetSections}\n\`\`\``;
          template += `\n\n⚠️ 本次修正所需的案例上下文已嵌入上方。完整案例文件路径已清空（变量替换为空字符串），你无法也无需读取完整案例文件。只修改上述目标案例，其他案例保持不变。`;
        }
      }
    }

    // 3. 追加型修复：传末尾 200 行作为格式参考
    if (isAppendFix) {
      const existingCasesPath = path.join(workDir, OUTPUT_PATH_MAP[args.type]);
      if (fs.existsSync(existingCasesPath)) {
        const casesContent = fs.readFileSync(existingCasesPath, "utf-8");
        const lines = casesContent.split("\n");
        const tail = lines.slice(-200).join("\n");
        template += `\n\n### 已有案例格式参考（文件末尾 200 行）\n\`\`\`markdown\n${tail}\n\`\`\``;
        template += `\n\n已有案例 ID 列表（避免重复编号）：${extractCaseIds(casesContent, args.type).join(", ")}`;
        template += `\n\n⚠️ 本次修正所需的案例上下文已嵌入上方。完整案例文件路径已清空（变量替换为空字符串），你无法也无需读取完整案例文件。请使用 Python 追加模式写入新案例。`;
      }
    }

    // 4. 嵌入规则缺口直接嵌入 prompt
    if (allGaps.embeddedRules) {
      const ruleGaps = [];
      for (const [, cat] of Object.entries(allGaps.embeddedRules)) {
        if (cat.uncovered?.length > 0) {
          ruleGaps.push(`- ${cat.label}：${cat.uncovered.join(", ")}`);
        }
      }
      if (ruleGaps.length > 0) {
        template += `\n\n### 嵌入规则缺口（需在已有案例步骤中补充验证点）\n${ruleGaps.join("\n")}`;
      }
    }

    // 5. 修改型+追加型重叠时明确优先级
    if (isModifyFix && isAppendFix) {
      template += `\n\n⚠️ 本次修正同时包含修改型和追加型缺口。执行优先级：先修改已有案例（补充验证点），再追加新案例。`;
    }
  }

  if (!isFixMode && inputDigestPath) {
    try {
      const digest = JSON.parse(fs.readFileSync(digestFile, "utf-8"));
      const instruction = `\n\n⚠️ PRD 文档较大（${digest.totalChars} chars），已预处理为模块摘要。请先读取 ${inputDigestPath} 获取全局视图，再按模块精读原始 PRD（通过 sourceFile + sourceLines 定位），禁止一次性读取全部 PRD 文件。`;
      template += instruction;
    } catch {
      // digest already validated above
    }
  }

  // AC-OP 格式预注入：从 ac.md 提取 AC-OP 操作，追加到 prompt 末尾
  // AC-STS 状态值预注入：从 ac.md 提取 AC-STS 状态值，追加到 prompt 末尾
  if (acFilePath && fs.existsSync(acFilePath)) {
    try {
      const acContent = fs.readFileSync(acFilePath, "utf-8");

      // AC-OP 操作预注入
      const opLines = acContent.split("\n").filter(l => /\|\s*(AC-OP-\d+[a-z]?)\s*\|/.test(l));
      if (opLines.length > 0) {
        const opItems = [];
        for (const line of opLines) {
          const cells = line.split("|").map(c => c.trim()).filter(c => c);
          if (cells.length < 3) continue;
          const opId = cells[0];
          const quoted = cells[2] ? (cells[2].match(/[""「」]([^""「」]+)[""「」]/g) || []) : [];
          const cleanKw = quoted.map(q => q.replace(/[""「」]/g, ""));
          const phrases = cells[2] ? cells[2].split(/[,，、/／\s]+/).filter(k => k.length >= 2 && /[一-龥]/.test(k)) : [];
          const keywords = [...new Set([...cleanKw, ...phrases])].filter(k => k.length >= 2)
            .map(k => k.replace(/[""「」]/g, ""));
          if (keywords.length > 0) {
            const bestKw = keywords.reduce((a, b) => a.length >= b.length ? a : b, keywords[0]);
            opItems.push(`- ${opId}: 步骤表格区域必须包含"${bestKw}"操作（不能仅在"覆盖AC"中声明）`);
          }
        }
        if (opItems.length > 0) {
          template += `\n\n⚠️ AC-OP 操作格式强制要求（verify-case-coverage.js 会检查步骤区域，"覆盖AC"声明不计入覆盖）：\n${opItems.join("\n")}`;
        }
      }

      // AC-STS 状态值预注入（仅 flow 和 e2e 类型）
      if (args.type === "flow" || args.type === "e2e") {
        const stsPattern = /AC-STS-\d+[a-z]?\s*\|\s*[^|]+\|\s*([^|]+)\|/g;
        const stateValues = new Set();
        let sm;
        while ((sm = stsPattern.exec(acContent)) !== null) {
          const state = sm[1].trim();
          if (state && state !== "--") stateValues.add(state);
        }
        if (stateValues.size > 0) {
          const stsItems = [...stateValues].map(s => `- 状态"${s}"必须在某个步骤的预期结果中出现（不能仅在描述或标题中提到）`);
          template += `\n\n⚠️ AC-STS 状态值格式强制要求（verify-case-coverage.js 会检查步骤区域的状态值）：\n${stsItems.join("\n")}`;
        }
      }

      // 嵌入规则 AC 动态注入（AC-CALC、AC-FMT、AC-VAL 等，不硬编码类型列表）
      const allAcPattern = /\|\s*(AC-([A-Z]+)-\d+[a-z]?)\s*\|\s*([^|]*)\|\s*([^|]*)\|/g;
      const embeddedRules = new Map(); // prefix -> [{id, description, keyword}]
      let acMatch;
      while ((acMatch = allAcPattern.exec(acContent)) !== null) {
        const acId = acMatch[1];
        const prefix = acMatch[2];
        if (prefix === "OP" || prefix === "STS") continue; // 已有专门处理
        const desc = acMatch[3].trim();
        const keyword = acMatch[4].trim();
        if (!embeddedRules.has(prefix)) embeddedRules.set(prefix, []);
        const bestKeyword = keyword && keyword !== "--" ? keyword : desc;
        if (bestKeyword) {
          embeddedRules.get(prefix).push({ id: acId, keyword: bestKeyword });
        }
      }
      if (embeddedRules.size > 0) {
        const ruleItems = [];
        for (const [prefix, rules] of embeddedRules) {
          for (const { id, keyword } of rules) {
            const shortKw = keyword.length > 30 ? keyword.slice(0, 30) + "..." : keyword;
            ruleItems.push(`- ${id} (AC-${prefix}): 步骤预期结果中必须体现"${shortKw}"的验证`);
          }
        }
        if (ruleItems.length > 0) {
          template += `\n\n⚠️ 嵌入规则覆盖要求（以下 AC 必须在案例步骤的预期结果列中体现，不能仅在"覆盖AC"中声明）：\n${ruleItems.join("\n")}`;
        }
      }
    } catch {
      // AC-OP/AC-STS extraction is best-effort, don't fail the prompt generation
    }
  }

  // JSON 输出自检指令追加（防止 subagent 输出格式错误）
  const jsonSelfCheckInstruction = `

---
## JSON 输出自检（必须遵守）

**你只输出 JSON 文件，不输出 Markdown 文件。** Markdown 由主会话的 json-to-md.js 脚本从 JSON 自动生成。

在写入 JSON 前必须执行以下自检：
1. 所有字符串值中的双引号必须转义为 \\"
2. 不允许尾部逗号（最后一个元素后不加逗号）
3. 不允许使用 markdown 代码块包裹 JSON 内容
4. 输出前用 JSON.parse() 验证格式正确性
5. 每个 test_case 必须包含 covers 数组（AC 覆盖标注）
6. 禁止写入 .md 文件——只写入 .json 文件
`;

  // 仅对可能输出 JSON 的 prompt 追加自检指令
  if (args.type === "e2e" || args.type === "api" || args.type === "flow" || isFixMode) {
    template += jsonSelfCheckInstruction;
  }

  // 输出到 stdout（主会话捕获），日志消息输出到 stderr
  console.error(`[OK] subagent prompt 已生成 (${Buffer.byteLength(template, "utf-8")} bytes, 变量展开 ${replacedCount} 处)`);
  process.stdout.write(template);
  process.exit(0);
}

main();
