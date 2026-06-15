#!/usr/bin/env node
/**
 * json-to-md.js
 * 将 JSON 测试案例转为 Markdown 格式（供 verify-case-coverage.js / review-case-quality.js 消费）
 *
 * 用法：
 *   node json-to-md.js --type <e2e|api|flow> --testing-dir <path>
 *
 * 输入：test-cases/{type}-test-cases.json
 * 输出：test-cases/{type}-test-cases.md
 */
"use strict";

const fs = require("fs");
const path = require("path");

const TYPE_TO_JSON = {
  e2e: "test-cases/e2e-test-cases.json",
  api: "test-cases/api-test-cases.json",
  flow: "test-cases/api-flow-test-cases.json",
};

const TYPE_TO_MD = {
  e2e: "test-cases/e2e-test-cases.md",
  api: "test-cases/api-test-cases.md",
  flow: "test-cases/api-flow-test-cases.md",
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { type: null, testingDir: null, mode: "auto" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--type" && argv[i + 1]) args.type = argv[++i];
    if (argv[i] === "--testing-dir" && argv[i + 1]) args.testingDir = argv[++i];
    if (argv[i] === "--mode" && argv[i + 1]) args.mode = argv[++i];
  }
  return args;
}

function esc(s) {
  if (!s) return "";
  return s.replace(/\|/g, "\\|");
}

// ── Validation ──────────────────────────────────────

/**
 * 校验 JSON 结构，返回 { errors: string[], warnings: string[] }
 * errors 非空则阻止转换，warnings 仅提示
 */
function validateJson(data, type) {
  const errors = [];
  const warnings = [];

  // ── 顶层结构 ──
  if (!data || typeof data !== "object") {
    errors.push(
      "JSON 根元素必须是对象，当前不是对象。\n" +
      "  修复：确保文件内容以 { 开头、} 结尾，不要用数组包裹。"
    );
    return { errors, warnings };
  }

  if (!data.test_cases) {
    errors.push(
      '缺少 test_cases 字段。\n' +
      '  修复：JSON 必须包含 "test_cases" 数组，例如：\n' +
      '  { "feature": "模块名", "version": "v1", "test_cases": [...] }'
    );
    return { errors, warnings };
  }

  if (!Array.isArray(data.test_cases)) {
    errors.push(
      'test_cases 必须是数组，当前类型：' + typeof data.test_cases + '。\n' +
      '  修复：改为 "test_cases": [ { ... }, { ... } ]'
    );
    return { errors, warnings };
  }

  if (data.test_cases.length === 0) {
    errors.push(
      'test_cases 数组为空，至少需要 1 条案例。\n' +
      '  修复：case-designer 未生成案例。检查 ac.md 是否存在、PRD 内容是否完整。'
    );
    return { errors, warnings };
  }

  // ── 逐条校验 ──
  const REQUIRED_STRING_FIELDS = {
    e2e: ["id", "title", "priority", "type"],
    api: ["id", "title", "priority", "type"],
    flow: ["id", "title", "priority", "type"],
  };
  const STRING_ARRAY_FIELDS = {
    e2e: ["preconditions", "steps", "expected"],
    api: ["preconditions", "steps", "expected"],
    flow: ["preconditions"],
  };

  const required = REQUIRED_STRING_FIELDS[type] || REQUIRED_STRING_FIELDS.api;
  const strArrays = STRING_ARRAY_FIELDS[type] || STRING_ARRAY_FIELDS.api;

  for (let i = 0; i < data.test_cases.length; i++) {
    const tc = data.test_cases[i];
    const label = tc.id ? `案例 ${tc.id}` : `test_cases[${i}]`;

    // 必填字符串字段
    for (const field of required) {
      if (!tc[field] || typeof tc[field] !== "string") {
        errors.push(
          `${label} 缺少必填字段 "${field}"（当前值：${JSON.stringify(tc[field])}）。\n` +
          `  修复：添加 "${field}": "值"，确保为非空字符串。`
        );
      }
    }

    // id 格式校验
    if (tc.id) {
      const prefixMap = { e2e: "FE-", api: "API-", flow: "FLOW-" };
      const expectedPrefix = prefixMap[type];
      if (expectedPrefix && !tc.id.startsWith(expectedPrefix)) {
        errors.push(
          `${label} 的 id 格式错误：${JSON.stringify(tc.id)}。\n` +
          `  修复：${type} 案例的 id 必须以 "${expectedPrefix}" 开头，如 "${expectedPrefix}MOD-001"。`
        );
      }
    }

    // covers 校验
    if (!tc.covers) {
      warnings.push(
        `${label} 缺少 covers 字段——覆盖率检查将无法识别此案例覆盖了哪些 AC。\n` +
        `  修复：添加 "covers": ["AC-001"] 或 "covers": []。`
      );
    } else if (!Array.isArray(tc.covers)) {
      errors.push(
        `${label} 的 covers 必须是数组，当前类型：${typeof tc.covers}。\n` +
        `  修复：改为 "covers": ["AC-001", "AC-002"]。`
      );
    } else {
      for (const c of tc.covers) {
        if (typeof c !== "string" || (!c.startsWith("AC-") && !c.startsWith("UI-"))) {
          errors.push(
            `${label} 的 covers 中包含非法值：${JSON.stringify(c)}。\n` +
            `  修复：covers 中的每个元素必须以 "AC-" 或 "UI-" 开头，如 "AC-001"、"UI-FORM-002"。`
          );
        }
      }
    }

    // 字符串数组字段
    for (const field of strArrays) {
      if (!tc[field]) {
        errors.push(
          `${label} 缺少 "${field}" 字段。\n` +
          `  修复：添加 "${field}": ["步骤1", "步骤2"]。`
        );
      } else if (!Array.isArray(tc[field])) {
        errors.push(
          `${label} 的 "${field}" 必须是字符串数组，当前类型：${typeof tc[field]}。\n` +
          `  修复：改为 "${field}": ["值1", "值2"]。`
        );
      } else if (tc[field].length === 0) {
        warnings.push(`${label} 的 "${field}" 为空数组，此案例可能不完整。`);
      }
    }

    // Flow 专用校验：steps 必须是对象数组
    if (type === "flow" && tc.steps) {
      if (!Array.isArray(tc.steps)) {
        errors.push(
          `${label} 的 steps 必须是数组。\n` +
          `  修复：Flow 案例的 steps 必须是对象数组，每个对象含 step/tc/action/api/params/uiExpected/apiExpected/dataPass。`
        );
      } else {
        for (let si = 0; si < tc.steps.length; si++) {
          const s = tc.steps[si];
          if (typeof s === "string") {
            errors.push(
              `${label} 的 steps[${si}] 是字符串，Flow 要求对象。\n` +
              `  修复：Flow 的每个 step 必须是对象：\n` +
              `  { "step": "S01", "tc": "${tc.id}-S01", "action": "操作", "api": "METHOD /path",\n` +
              `    "params": "参数", "uiExpected": "UI预期", "apiExpected": "API预期", "dataPass": "—" }`
            );
          } else if (typeof s === "object" && s !== null) {
            const flowStepRequired = ["step", "action", "api"];
            for (const f of flowStepRequired) {
              if (!s[f]) {
                errors.push(
                  `${label} steps[${si}] 缺少必填字段 "${f}"。\n` +
                  `  修复：每个 Flow step 必须包含 ${flowStepRequired.join("/")} 字段。`
                );
              }
            }
          }
        }
      }
    }
  }

  return { errors, warnings };
}

// ── Renderers ──────────────────────────────────────

function renderE2e(data) {
  const lines = [];
  lines.push(`# ${data.feature || "E2E"} E2E 测试案例`);
  lines.push("");
  lines.push(`- version: ${data.version || "v1"}`);
  lines.push(`- lastUpdatedBy: case-designer`);
  if (data.businessObjective) {
    lines.push(`- businessObjective: ${data.businessObjective}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const tc of data.test_cases || []) {
    lines.push(`### ${tc.id} ${tc.title || ""}`);
    lines.push("");

    if (tc.covers && tc.covers.length > 0) {
      lines.push(`覆盖AC: ${tc.covers.join(", ")}`);
      lines.push("");
    }

    const testType = mapTestType(tc.type);
    const metaParts = [`优先级: ${tc.priority || "P1"}`, `测试类型: ${testType}`];
    if (tc.testPath) metaParts.push(`测试路径: ${tc.testPath}`);
    lines.push(`- ${metaParts.join(" | ")}`);
    lines.push("");

    lines.push("前置条件：");
    for (const p of tc.preconditions || []) lines.push(`1. ${p}`);
    lines.push("");

    lines.push("测试步骤：");
    for (const s of tc.steps || []) lines.push(`1. ${s}`);
    lines.push("");

    lines.push("预期结果：");
    for (const e of tc.expected || []) lines.push(`1. ${e}`);
    lines.push("");
  }

  return lines.join("\n");
}

function renderApi(data) {
  const lines = [];
  const req = data.requirement || "";
  const ver = data.version || "v1";
  const date = data.generatedAt || new Date().toISOString().slice(0, 10);

  lines.push(`# ${data.feature || "API"} API 测试案例`);
  lines.push("");
  lines.push(`> ${req} | 版本 ${ver} | 生成日期 ${date} | 案例类型 api`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const tc of data.test_cases || []) {
    lines.push(`### ${tc.id} ${tc.title || ""}`);
    lines.push("");

    lines.push("| 项目 | 内容 |");
    lines.push("|------|------|");
    lines.push(`| 用例ID | ${tc.id} |`);
    lines.push(`| 用例描述 | ${esc(tc.title)} |`);
    lines.push(`| 优先级 | ${tc.priority || "P1"} |`);
    lines.push(`| 测试类型 | ${mapTestType(tc.type)} |`);
    lines.push(`| version | ${ver} |`);
    lines.push(`| lastUpdatedBy | case-designer |`);
    if (tc.covers && tc.covers.length > 0) {
      lines.push(`| 覆盖AC | ${tc.covers.join(", ")} |`);
    }
    lines.push("");

    lines.push("前置条件：");
    for (const p of tc.preconditions || []) lines.push(`1. ${p}`);
    lines.push("");

    lines.push("测试步骤：");
    for (const s of tc.steps || []) lines.push(`1. ${s}`);
    lines.push("");

    lines.push("预期结果：");
    for (const e of tc.expected || []) lines.push(`1. ${e}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function renderFlow(data) {
  const lines = [];
  const req = data.requirement || "";
  const date = data.generatedAt || new Date().toISOString().slice(0, 10);

  lines.push(`# API 业务流程测试案例 — ${data.feature || ""}`);
  lines.push("");
  lines.push(`> 需求编号：${req}`);
  lines.push(`> 模块：${data.feature || ""}`);
  lines.push(`> 案例类型：flow（API 业务流程）`);
  if (data.apiPrefix) lines.push(`> API 前缀：${data.apiPrefix}`);
  lines.push(`> 生成日期：${date}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (data.flowOverview && data.flowOverview.length > 0) {
    lines.push("## 流程案例总览");
    lines.push("");
    lines.push("| 编号 | 流程名称 | 流程类型 | 涉及 AC | 涉及接口 |");
    lines.push("|------|---------|---------|---------|---------|");
    for (const f of data.flowOverview) {
      lines.push(`| ${f.id} | ${esc(f.name)} | ${esc(f.flowType)} | ${(f.covers || []).join(", ")} | ${esc((f.apis || []).join(", "))} |`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  for (const tc of data.test_cases || []) {
    const isSubCase = /-[EB]\d+$/.test(tc.id);
    const heading = isSubCase ? `### ${tc.id}: ${tc.title || ""}` : `## ${tc.id}: ${tc.title || ""}`;

    lines.push(heading);
    lines.push("");

    if (tc.covers && tc.covers.length > 0) {
      lines.push(`覆盖AC: ${tc.covers.join(", ")}`);
      lines.push("");
    }

    if (tc.flowType) lines.push(`- 流程类型：${tc.flowType}`);
    if (tc.writeOps && tc.writeOps.length > 0) lines.push(`- 涉及写操作：${tc.writeOps.join("/")}`);
    if (tc.stateTransitions) lines.push(`- 状态转换：${tc.stateTransitions}`);

    if (tc.steps && tc.steps.length > 0 && typeof tc.steps[0] === "object") {
      lines.push("");
      lines.push("| 步骤 | TC 编号 | 操作 | 接口 | 关键参数 | UI 预期结果 | API 预期响应 | 数据传递 |");
      lines.push("|------|---------|------|------|---------|------------|-------------|---------|");
      for (const s of tc.steps) {
        lines.push(
          `| ${s.step || ""} | ${s.tc || ""} | ${esc(s.action)} | ${esc(s.api)} | ${esc(s.params)} | ${esc(s.uiExpected)} | ${esc(s.apiExpected)} | ${esc(s.dataPass)} |`
        );
      }
      lines.push("");
    }

    if (tc.preconditions && tc.preconditions.length > 0) {
      lines.push("**前置条件**：");
      for (const p of tc.preconditions) lines.push(`1. ${p}`);
      lines.push("");
    }

    if (tc.cleanup) {
      lines.push("**清理策略**：");
      lines.push(`- ${tc.cleanup}`);
      lines.push("");
    }

    lines.push(`**version**: ${data.version || "v1"}`);
    lines.push("**lastUpdatedBy**: case-designer");
    lines.push("");
  }

  return lines.join("\n");
}

// ── Helpers ──────────────────────────────────────────
function mapTestType(type) {
  const map = {
    happy_path: "功能测试",
    negative: "异常测试",
    exception: "异常测试",
    edge_case: "边界测试",
    flow_happy: "流程测试",
    flow_exception: "异常中断测试",
    flow_boundary: "边界流程测试",
  };
  return map[type] || "功能测试";
}

/**
 * 单文件模式：读取单个 JSON → 校验 → 渲染 → 写入单个 MD
 */
function convertSingle(args) {
  const jsonPath = path.join(args.testingDir, TYPE_TO_JSON[args.type]);
  const mdPath = path.join(args.testingDir, TYPE_TO_MD[args.type]);

  if (!fs.existsSync(jsonPath)) {
    console.error(
      `[FAIL] JSON 文件不存在：${jsonPath}\n` +
      "  原因：case-designer subagent 未生成 JSON 文件，或文件路径错误。\n" +
      "  修复：\n" +
      `  1. 确认 case-designer 已运行并写入 ${TYPE_TO_JSON[args.type]}\n` +
      "  2. 检查 testing-dir 路径是否正确\n" +
      "  3. 如果 subagent 异常退出，检查分段写入逻辑（内容 > 20000 字符需分段）"
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw); // 让异常自然抛出
  const { errors, warnings } = validateJson(data, args.type);
  for (const w of warnings) console.warn(`[WARN] ${w}`);
  if (errors.length > 0) {
    console.error(
      `[FAIL] JSON 结构校验失败（${errors.length} 个错误）：\n\n` +
      errors.map((e, i) => `${i + 1}. ${e}`).join("\n\n") +
      `\n\n文件：${jsonPath}`
    );
    process.exit(1);
  }

  const md = renderData(data, args.type);
  fs.writeFileSync(mdPath, md, "utf-8");
  const caseCount = data.test_cases.length;
  console.log(`[OK] ${args.type} JSON→MD: ${mdPath} (${caseCount} cases, ${md.length} bytes)`);
  return { type: args.type, files: 1, cases: caseCount };
}

/**
 * Split 模式：glob 目录下所有 JSON → 逐个校验+渲染 → 每个生成同名 MD
 */
function convertSplit(args) {
  const typeDir = path.join(args.testingDir, "test-cases", args.type);
  if (!fs.existsSync(typeDir)) {
    // fallback 到单文件模式
    return convertSingle(args);
  }

  const jsonFiles = fs.readdirSync(typeDir)
    .filter(f => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  if (jsonFiles.length === 0) {
    // fallback 到单文件模式
    return convertSingle(args);
  }

  let totalCases = 0;
  const results = [];

  for (const jsonFile of jsonFiles) {
    const jsonPath = path.join(typeDir, jsonFile);
    const mdFile = jsonFile.replace(/\.json$/, ".md");
    const mdPath = path.join(typeDir, mdFile);

    let data;
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    } catch (e) {
      console.error(`[WARN] 跳过损坏 JSON: ${jsonFile} — ${e.message}`);
      continue;
    }

    const { errors, warnings } = validateJson(data, args.type);
    for (const w of warnings) console.warn(`[WARN] ${w}`);
    if (errors.length > 0) {
      console.error(`[WARN] 跳过校验失败 JSON: ${jsonFile} (${errors.length} errors)`);
      continue;
    }

    const md = renderData(data, args.type);
    fs.writeFileSync(mdPath, md, "utf-8");

    const caseCount = (data.test_cases || []).length;
    totalCases += caseCount;
    results.push({ file: mdFile, cases: caseCount });
    console.log(`[OK] ${args.type}/${mdFile} (${caseCount} cases, ${md.length} bytes)`);
  }

  if (results.length === 0) {
    console.error(`[FAIL] ${args.type}: 无有效 JSON 文件可转换`);
    process.exit(1);
  }

  return { type: args.type, files: results.length, cases: totalCases };
}

function renderData(data, type) {
  switch (type) {
    case "e2e": return renderE2e(data);
    case "api": return renderApi(data);
    case "flow": return renderFlow(data);
    default: return renderApi(data);
  }
}

function main() {
  const args = parseArgs();
  if (!args.type || !TYPE_TO_JSON[args.type]) {
    console.error(
      "[FAIL] 参数错误。\n" +
      "  用法：node json-to-md.js --type <e2e|api|flow> --testing-dir <path> [--mode auto|single|split]"
    );
    process.exit(1);
  }
  if (!args.testingDir) {
    console.error(
      "[FAIL] 缺少 --testing-dir 参数。\n" +
      "  修复：指定 testing 目录路径，如 --testing-dir /path/to/TASK001/testing"
    );
    process.exit(1);
  }

  // auto 模式：检测 split 目录是否存在
  const useSplit = args.mode === "split" ||
    (args.mode === "auto" && fs.existsSync(path.join(args.testingDir, "test-cases", args.type)));

  if (useSplit) {
    const result = convertSplit(args);
    console.log(`[SUMMARY] ${result.type}: ${result.files} files, ${result.cases} cases`);
  } else {
    convertSingle(args);
  }
}

main();
