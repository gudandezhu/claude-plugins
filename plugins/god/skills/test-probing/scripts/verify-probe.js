#!/usr/bin/env node
"use strict";
/**
 * verify-probe.js
 * 验证 DOM 探测完整性：对比 PRD 功能描述与 dom-probe.md 内容，
 * 检测可能遗漏的交互后探测（弹窗、表单、确认按钮等）。
 *
 * 用法：node verify-probe.js --testing-dir testing/ --prd-dir requirement/prd/
 * 输出：testing/.cache/verify-probe-result.json
 * 退出码：0=无警告，1=有警告
 */
const fs = require("fs");
const path = require("path");

function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = "testing";
  let prdDir = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--prd-dir" && argv[i + 1]) prdDir = argv[++i];
  }
  return { testingDir, prdDir };
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

// ─── PRD 功能关键词提取 ──────────────────────────────────────
// 从 PRD 中提取暗示需要交互后探测的功能关键词
const INTERACTION_KEYWORDS = {
  dialog: [
    "新增",
    "新建",
    "添加",
    "创建",
    "编辑",
    "修改",
    "删除",
    "弹窗",
    "弹框",
    "对话框",
    "modal",
    "dialog",
  ],
  form: [
    "表单",
    "输入",
    "填写",
    "提交",
    "保存",
    "form",
    "input",
    "submit",
  ],
  confirm: [
    "确认",
    "确定",
    "取消",
    "confirm",
    "cancel",
    "审批",
    "审核",
  ],
  dropdown: [
    "下拉",
    "选择",
    "筛选",
    "过滤",
    "select",
    "dropdown",
    "filter",
  ],
  pagination: ["分页", "翻页", "页码", "pagination", "pageSize"],
  upload: ["上传", "导入", "附件", "upload", "import"],
};

// dom-probe.md 中对应的选择器/关键词（按 UI 框架区分）
const FRAMEWORK_PROBE_INDICATORS = {
  "element-plus": {
    dialog: ["el-dialog", ".el-dialog", "el-drawer", ".el-drawer"],
    form: ["el-form", ".el-form", "el-input", ".el-input", "el-form-item"],
    confirm: ["el-button--primary"],
    dropdown: ["el-select", ".el-select", "el-dropdown", ".el-dropdown", "el-option"],
    pagination: ["el-pagination", ".el-pagination"],
    upload: ["el-upload", ".el-upload"],
  },
  "ant-design": {
    dialog: ["ant-modal", ".ant-modal", "ant-drawer", ".ant-drawer"],
    form: ["ant-form", ".ant-form", "ant-input", ".ant-input", "ant-form-item"],
    confirm: ["ant-btn-primary"],
    dropdown: ["ant-select", ".ant-select", "ant-dropdown", ".ant-dropdown"],
    pagination: ["ant-pagination", ".ant-pagination"],
    upload: ["ant-upload", ".ant-upload"],
  },
  "naive-ui": {
    dialog: ["n-modal", ".n-modal", "n-drawer", ".n-drawer"],
    form: ["n-form", ".n-form", "n-input", ".n-input", "n-form-item"],
    confirm: ["n-button--primary"],
    dropdown: ["n-select", ".n-select", "n-dropdown", ".n-dropdown"],
    pagination: ["n-pagination", ".n-pagination"],
    upload: ["n-upload", ".n-upload"],
  },
};

// 通用指标（不依赖 UI 框架）
const GENERIC_INDICATORS = {
  dialog: ["dialog", "modal", "弹窗"],
  form: ["form"],
  confirm: ["确认", "确定", "提交", "保存", "submit", "confirm"],
  dropdown: [],
  pagination: ["pagination"],
  upload: ["upload"],
};

function getProbeIndicators(uiLibrary) {
  const frameworkIndicators = FRAMEWORK_PROBE_INDICATORS[uiLibrary] || {};
  const merged = {};
  for (const category of Object.keys(GENERIC_INDICATORS)) {
    merged[category] = [
      ...(frameworkIndicators[category] || []),
      ...GENERIC_INDICATORS[category],
    ];
  }
  return merged;
}

function extractPrdFeatures(prdContent) {
  const features = {};
  for (const [category, keywords] of Object.entries(INTERACTION_KEYWORDS)) {
    const found = keywords.filter(
      (kw) => prdContent.toLowerCase().includes(kw.toLowerCase())
    );
    if (found.length > 0) {
      features[category] = found;
    }
  }
  return features;
}

function checkProbeCompleteness(probeContent, prdFeatures, uiLibrary) {
  const warnings = [];
  const probeLower = probeContent.toLowerCase();
  const indicators = getProbeIndicators(uiLibrary);

  for (const [category, prdKeywords] of Object.entries(prdFeatures)) {
    const categoryIndicators = indicators[category] || [];
    const hasProbe = categoryIndicators.some((ind) =>
      probeLower.includes(ind.toLowerCase())
    );

    if (!hasProbe) {
      warnings.push({
        category,
        severity: category === "dialog" || category === "form" ? "high" : "medium",
        prdKeywords,
        message: getWarningMessage(category, prdKeywords),
      });
    }
  }

  return warnings;
}

function getWarningMessage(category, keywords) {
  const msgs = {
    dialog: `PRD 中包含 [${keywords.join(", ")}] 相关功能，但 dom-probe.md 中未发现弹窗/对话框选择器。可能遗漏了交互后探测（点击"新增/编辑"按钮后的弹窗）。`,
    form: `PRD 中包含 [${keywords.join(", ")}] 相关功能，但 dom-probe.md 中未发现表单选择器。可能遗漏了表单元素探测。`,
    confirm: `PRD 中包含 [${keywords.join(", ")}] 相关功能，但 dom-probe.md 中未发现确认按钮文字记录。建议探测确认/提交按钮的文字和选择器。`,
    dropdown: `PRD 中包含 [${keywords.join(", ")}] 相关功能，但 dom-probe.md 中未发现下拉选择器。可能遗漏了下拉框选项探测。`,
    pagination: `PRD 中包含 [${keywords.join(", ")}] 相关功能，但 dom-probe.md 中未发现分页选择器。`,
    upload: `PRD 中包含 [${keywords.join(", ")}] 相关功能，但 dom-probe.md 中未发现上传组件选择器。`,
  };
  return msgs[category] || `PRD 中包含 [${keywords.join(", ")}] 但 dom-probe.md 中未找到对应探测结果。`;
}

// ─── 选择器唯一性检测 ────────────────────────────────────────
const MULTI_INSTANCE_COMPONENTS = [
  { pattern: /\.el-table[\s"'`>]/g, selector: ".el-table", recommendation: "Use .last() or :visible" },
  { pattern: /\.el-tabs__item/g, selector: ".el-tabs__item", recommendation: "Use .nth() with text match" },
  { pattern: /\.el-dialog__wrapper/g, selector: ".el-dialog__wrapper", recommendation: "Use .last() or :visible" },
  { pattern: /\.el-form[\s"'`>.(]/g, selector: ".el-form", recommendation: "Use parent container scoping" },
  { pattern: /\.el-tabs[\s"'`>.(]/g, selector: ".el-tabs", recommendation: "Use parent container scoping" },
];

function checkSelectorUniqueness(probeContent) {
  const warnings = [];
  if (!probeContent) return warnings;

  // 检查"多实例元素说明"章节是否存在
  const hasMultiInstanceSection = /多实例元素说明/.test(probeContent);

  // 从选择器表格中提取已知多实例组件
  const selectorTableRegex = /\|\s*`([^`]+)`\s*\|\s*(?:verified|inferred)\s*\|/g;
  const allSelectors = [];
  let sm;
  while ((sm = selectorTableRegex.exec(probeContent)) !== null) {
    allSelectors.push(sm[1]);
  }

  for (const component of MULTI_INSTANCE_COMPONENTS) {
    // 计算选择器在 dom-probe.md 中出现的次数（排除代码块计数）
    const matches = probeContent.match(component.pattern);
    const count = matches ? matches.length : 0;

    // 检查是否有选择器表格条目包含此组件
    const hasSelectorEntry = allSelectors.some(s => s.includes(component.selector.replace('.', '')));

    if ((count > 2 || hasSelectorEntry) && !hasMultiInstanceSection) {
      warnings.push({
        category: "uniqueness",
        severity: "medium",
        selector: component.selector,
        count,
        message: `${component.selector} 在 dom-probe.md 中出现但"多实例元素说明"章节未记录。${component.recommendation}。Element Plus 组件可能产生影子/重复 DOM 节点。`,
      });
    }
  }

  // 如果有"多实例元素说明"章节，检查是否覆盖了所有多实例组件
  if (hasMultiInstanceSection) {
    const sectionMatch = probeContent.match(/多实例元素说明[\s\S]*?(?=###|####|$)/);
    const sectionContent = sectionMatch ? sectionMatch[0] : "";
    for (const component of MULTI_INSTANCE_COMPONENTS) {
      const matches = probeContent.match(component.pattern);
      const count = matches ? matches.length : 0;
      if (count > 2 && !sectionContent.includes(component.selector.replace('.', ''))) {
        warnings.push({
          category: "uniqueness",
          severity: "low",
          selector: component.selector,
          count,
          message: `${component.selector} 出现 ${count} 次，但"多实例元素说明"章节未覆盖。建议补充。`,
        });
      }
    }
  }

  return warnings;
}

// ─── 主流程 ─────────────────────────────────────────────────
function main() {
  const { testingDir, prdDir } = parseArgs();
  const cacheDir = path.join(testingDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  // 读取 dom-probe.md（优先根目录，fallback 到 .cache/）
  let probePath = path.join(testingDir, "dom-probe.md");
  let probeContent = readSafe(probePath);
  if (!probeContent) {
    const cacheProbePath = path.join(testingDir, ".cache", "dom-probe.md");
    const cacheContent = readSafe(cacheProbePath);
    if (cacheContent) {
      // 自动复制到正确位置
      fs.writeFileSync(probePath, cacheContent, "utf-8");
      probeContent = cacheContent;
      console.log(`[WARN] dom-probe.md 位于 .cache/ 而非 testing/ 根目录（已自动复制）。探测步骤三应直接写入 testing/dom-probe.md`);
    }
  }
  if (!probeContent) {
    console.log("[WARN] dom-probe.md 不存在（testing/ 和 .cache/ 均未找到），跳过探测完整性验证");
    const result = {
      timestamp: new Date().toISOString(),
      passed: true,
      skipped: true,
      reason: "dom-probe.md 不存在",
    };
    fs.writeFileSync(
      path.join(cacheDir, "verify-probe-result.json"),
      JSON.stringify(result, null, 2)
    );
    process.exit(0);
  }

  // 读取 PRD 内容
  let prdContent = "";
  if (prdDir && fs.existsSync(prdDir)) {
    const prdFiles = findFiles(prdDir, /\.(md|txt)$/);
    prdContent = prdFiles.map((f) => readSafe(f)).join("\n");
  }

  // 也读取 test-plan 作为补充（test-plan 是 PRD 的结构化摘要）
  const testPlanPath = path.join(testingDir, "test-plan/test-plan.md");
  const testPlanContent = readSafe(testPlanPath);
  prdContent = prdContent + "\n" + testPlanContent;

  if (!prdContent.trim()) {
    console.log("[WARN] PRD 目录为空且测试计划不存在，跳过探测完整性验证");
    const result = {
      timestamp: new Date().toISOString(),
      passed: true,
      skipped: true,
      reason: "无 PRD 内容可对比",
    };
    fs.writeFileSync(
      path.join(cacheDir, "verify-probe-result.json"),
      JSON.stringify(result, null, 2)
    );
    process.exit(0);
  }

  // 从 test-config.json 读取 UI 框架
  const configPath = path.join(testingDir, "test-config.json");
  let uiLibrary = "";
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      uiLibrary = config.techStack?.uiLibrary || "";
    } catch {}
  }

  // 提取 PRD 功能特征
  const prdFeatures = extractPrdFeatures(prdContent);

  // 检查探测完整性
  const warnings = checkProbeCompleteness(probeContent, prdFeatures, uiLibrary);

  // 检查选择器唯一性
  const uniquenessWarnings = checkSelectorUniqueness(probeContent);
  warnings.push(...uniquenessWarnings);

  const highWarnings = warnings.filter((w) => w.severity === "high");
  const result = {
    timestamp: new Date().toISOString(),
    passed: highWarnings.length === 0,
    prdFeatures,
    warnings,
    summary: {
      total: warnings.length,
      high: highWarnings.length,
      medium: warnings.filter((w) => w.severity === "medium").length,
      uniqueness: uniquenessWarnings.length,
    },
  };

  fs.writeFileSync(
    path.join(cacheDir, "verify-probe-result.json"),
    JSON.stringify(result, null, 2)
  );

  // 输出
  if (warnings.length === 0) {
    console.log("[OK] DOM 探测完整性验证通过");
  } else {
    console.log(
      `[WARN] DOM 探测完整性验证发现 ${warnings.length} 个潜在遗漏：`
    );
    console.log("");
    for (const w of warnings) {
      const icon = w.severity === "high" ? "🔴" : "🟡";
      console.log(`  ${icon} [${w.category}] ${w.message}`);
    }
    console.log("");
    if (highWarnings.length > 0) {
      console.log(
        "[INFO] 高优先级警告需要补充交互后探测，否则生成的脚本可能缺少关键场景。"
      );
      process.exit(1);
    } else {
      console.log("[INFO] 以上为中优先级警告，建议补充探测但不阻塞流程。");
    }
  }
}

main();
