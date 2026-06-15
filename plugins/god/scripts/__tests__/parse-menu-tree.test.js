#!/usr/bin/env node
"use strict";
/**
 * parse-menu-tree-ascii.js 单元测试
 *
 * 运行: node scripts/__tests__/parse-menu-tree.test.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PARSER = path.resolve(__dirname, "..", "workspace", "parse-tree.js");
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log("  ✓ " + message);
  } else {
    failed++;
    console.error("  ✗ " + message);
  }
}

function runTest(name, fn) {
  console.log("\n--- " + name + " ---");
  fn();
}

function parseTestContent(content) {
  const tmpFile = path.join(__dirname, "_tmp_test_" + Date.now() + ".md");
  try {
    fs.writeFileSync(tmpFile, content, "utf-8");
    const result = execSync('node "' + PARSER + '" --file "' + tmpFile + '"', { encoding: "utf-8" });
    return JSON.parse(result);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// --- Test Suite ---

runTest("parse page definition (L3: name [zone])", () => {
  const input = "L3: 请购申请列表 [C区 100%×100%]";
  const result = parseTestContent(input);
  assert(result.pages.length === 1, "1 page parsed");
  assert(result.pages[0].id === "L3", "page id is L3");
  assert(result.pages[0].name === "请购申请列表", "page name correct");
  assert(result.pages[0].zone === "C区", "zone is C区");
});

runTest("parse 6 zone types", () => {
  const zones = ["C区", "F区", "E区", "D区", "S区", "T区"];
  for (const zone of zones) {
    const input = "L3: 测试页面 [" + zone + " 100%×100%]";
    const result = parseTestContent(input);
    assert(result.pages[0].zone === zone, "zone " + zone + " parsed correctly");
  }
});

runTest("parse interaction node", () => {
  const input = [
    "L3: 请购申请列表 [C区 100%×100%]",
    "│",
    "├── 布局: 操作栏",
    "│   ├── PRQL-ACT-CRTE  click [创建请购需求] → L4: 请购单创建表单 [F区 100%×100%]",
    "│   │   transition: slide-left 300ms",
  ].join("\n");
  const result = parseTestContent(input);
  assert(result.pages[0].interactions.length >= 1, "at least 1 interaction");
  const inter = result.pages[0].interactions[0];
  assert(inter.featureId === "PRQL-ACT-CRTE", "featureId correct");
  assert(inter.action === "click [创建请购需求]", "action correct");
  assert(inter.target && inter.target.includes("请购单创建表单"), "target correct");
  assert(inter.zone === "F区", "target zone correct");
  assert(inter.transition === "slide-left 300ms", "transition correct");
});

runTest("parse fail object", () => {
  const input = [
    "L3: 测试页面 [C区]",
    "│",
    "├── 布局: 操作栏",
    "│   ├── PRQL-ACT-DEL  click [删除] → L4: 删除确认弹窗 [D区]",
    "│   │   fail: { timeout: toast(\"操作超时\"), 500: toast(\"删除失败\") }",
  ].join("\n");
  const result = parseTestContent(input);
  const inter = result.pages[0].interactions[0];
  assert(inter.fail !== null, "fail parsed (got: " + JSON.stringify(inter.fail) + ")");
  assert(typeof inter.fail === "object", "fail is object");
  assert(inter.fail.timeout && inter.fail.timeout.message === "操作超时", "timeout fail correct");
  assert(inter.fail["500"] && inter.fail["500"].message === "删除失败", "500 fail correct");
});

runTest("parse state object", () => {
  const input = [
    "L3: 测试页面 [C区]",
    "│",
    "├── 布局: 列表",
    "│   state: {",
    "│     loading: skeleton(10行表格骨架),",
    "│     empty: \"暂无数据\" + click [新建],",
    "│     error: \"加载失败\" + click [重试]",
    "│   }",
  ].join("\n");
  const result = parseTestContent(input);
  const states = result.pages[0].states;
  assert(states.loading !== undefined, "loading state exists");
  assert(states.empty !== undefined, "empty state exists");
  assert(states.error !== undefined, "error state exists");
});

runTest("parse precondition field", () => {
  const input = [
    "L3: 测试页面 [C区]",
    "│",
    "├── 布局: 表单",
    "│   ├── PRQL-SBMT-SAVE  click [保存] → L5: toast(\"保存成功\")",
    "│   │   precondition: 必填字段已填写 | :disabled",
  ].join("\n");
  const result = parseTestContent(input);
  const inter = result.pages[0].interactions[0];
  assert(inter.precondition === "必填字段已填写 | :disabled", "precondition correct");
});

runTest("parse expect field", () => {
  const input = [
    "L3: 测试页面 [C区]",
    "│",
    "├── 布局: 操作栏",
    "│   ├── PRQL-SBMT-PURC  click [提交至采购] → L4: 提交确认弹窗 [D区]",
    "│   │   expect: 请购单进入采购环节",
  ].join("\n");
  const result = parseTestContent(input);
  const inter = result.pages[0].interactions[0];
  assert(inter.expect === "请购单进入采购环节", "expect correct");
});

runTest("parse toast target", () => {
  const input = [
    "L3: 测试页面 [C区]",
    "│",
    "├── 布局: 操作栏",
    "│   ├── PRQL-AI-GENR  click [AI请购] → L5: toast(\"AI分析中...\")",
    "│       fail: { timeout: toast(\"分析超时\"), 500: toast(\"分析失败\") }",
  ].join("\n");
  const result = parseTestContent(input);
  const inter = result.pages[0].interactions[0];
  assert(inter.target === "AI分析中...", "toast target correct (got: " + inter.target + ")");
});

runTest("full sample parsing", () => {
  const input = [
    "L3: 请购申请列表 [C区 100%×100%]",
    "│",
    "├── 布局: 操作栏",
    "│   ├── PRQL-ACT-REF  click [刷新] → 重新加载列表",
    "│   │   fail: { timeout: toast(\"刷新超时\") }",
    "│   │",
    "│   ├── PRQL-ACT-CRTE  click [创建请购需求] → L4: 请购单创建表单 [F区 100%×100%]",
    "│   │   transition: slide-left 300ms",
    "│   │",
    "│   └── PRQL-AI-GENR  click [AI请购] → L5: toast(\"AI分析中...\")",
    "│       fail: { timeout: toast(\"分析超时\"), 500: toast(\"分析失败\") }",
    "│       expect: 系统自动生成请购建议",
    "│",
    "├── 布局: 请购单列表表格",
    "│   state: {",
    "│     loading: skeleton(10行表格骨架),",
    "│     empty: \"暂无请购单\" + click [创建请购需求],",
    "│     error: \"加载失败\" + click [重试]",
    "│   }",
    "│   │",
    "│   ├── 行操作区:",
    "│   │   ├── PRQL-SBMT-PURC  click [提交至采购] → L4: 提交确认弹窗 [D区 400×200px]",
    "│   │   │   expect: 请购单进入采购环节",
    "│   │   │",
    "│   │   └── PRQL-ACT-DEL  click [删除] → L4: 删除确认弹窗 [D区 400×200px]",
  ].join("\n");
  const result = parseTestContent(input);
  assert(result.pages.length === 1, "1 page");
  const page = result.pages[0];
  assert(page.interactions.length >= 5, "at least 5 interactions, got " + page.interactions.length);
  assert(page.states.loading !== undefined, "states.loading exists");
  assert(page.states.empty !== undefined, "states.empty exists");
  assert(page.states.error !== undefined, "states.error exists");

  const refInter = page.interactions.find(function(i) { return i.featureId === "PRQL-ACT-REF"; });
  assert(refInter && refInter.fail !== null, "PRQL-ACT-REF fail parsed");
});

runTest("empty file returns empty array", () => {
  const input = "";
  const result = parseTestContent(input);
  assert(result.pages.length === 0, "0 pages for empty file");
});

runTest("malformed format does not block parsing", () => {
  const input = [
    "L3: 测试页面 [C区]",
    "│",
    "├── 布局: 操作栏",
    "│   ├── SOME-FEATURE  unknown_action",
    "│   ├── VALID-FEATURE  click [有效操作] → L4: 目标 [F区]",
    "some garbage line",
    "another invalid line",
    "│   ├── ANOTHER  click [另一个]",
  ].join("\n");
  const result = parseTestContent(input);
  assert(result.pages.length === 1, "page still parsed");
  assert(result.pages[0].interactions.length >= 1, "at least 1 valid interaction");
});

// --- Summary ---

console.log("\n" + "=".repeat(40));
console.log("Results: " + passed + " passed, " + failed + " failed");
if (failed > 0) {
  console.error("\n❌ Some tests failed");
  process.exit(1);
} else {
  console.log("\n✅ All tests passed");
}
