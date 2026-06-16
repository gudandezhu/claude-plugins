// Step definitions — verify god pipeline behavior end-to-end via real child-process runs.
const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { Given, When, Then } = require('../fixtures');

const FEATURE_TWO_SC = `@spec-version 1.0.0
Feature: BddDemo
  god bdd 闭环 demo：双 SC 覆盖（含 sad-path）。

  @SC-001 @happy
  Scenario: 第一步成功
    Given 一个空状态
    When 执行操作
    Then 结果为 true

  @SC-002 @sad-path
  Scenario: 输入非法被拒
    Given 一个空状态
    When 输入 "非法"
    Then 返回错误 "INVALID"
`;

// ---------- shared Given ----------
Given('干净的临时项目 {string}', ({ api }, name) => {
  api.TMP_ROOT = `/tmp/god-bdd-${name}`;
  fs.rmSync(api.TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(api.TMP_ROOT, 'spec'), { recursive: true });
  fs.mkdirSync(path.join(api.TMP_ROOT, 'src'), { recursive: true });
  fs.mkdirSync(path.join(api.TMP_ROOT, 'tests'), { recursive: true });
});

Given('写入 feature 含 2 个 SC', ({ api }) => {
  fs.writeFileSync(path.join(api.TMP_ROOT, 'spec/spec.feature'), FEATURE_TWO_SC);
});

Given('删除 spec 目录', ({ api }) => {
  fs.rmSync(path.join(api.TMP_ROOT, 'spec'), { recursive: true, force: true });
});

// ---------- shared When ----------
When('跑 dev-gen', ({ api }) => {
  api.devGenResult = api.runScript('dev-gen', [api.TMP_ROOT, '--force'], api.TMP_ROOT);
});

When('跑 test-gen', ({ api }) => {
  api.testGenResult = api.runScript('test-gen', [api.TMP_ROOT, '--force'], api.TMP_ROOT);
});

When('跑 spec-validate', ({ api }) => {
  api.validateResult = api.runScript('spec-validate', [api.TMP_ROOT], api.TMP_ROOT);
});

When('跑 spec-render', ({ api }) => {
  api.renderResult = api.runScript('spec-render', [api.TMP_ROOT, '--force'], api.TMP_ROOT);
});

When('顺序跑 dev-gen + test-gen + spec-validate', ({ api }) => {
  api.devGenResult = api.runScript('dev-gen', [api.TMP_ROOT, '--force'], api.TMP_ROOT);
  api.testGenResult = api.runScript('test-gen', [api.TMP_ROOT, '--force'], api.TMP_ROOT);
  api.validateResult = api.runScript('spec-validate', [api.TMP_ROOT], api.TMP_ROOT);
});

// ---------- shared Then ----------
const lastResult = (api) => api.devGenResult || api.testGenResult || api.validateResult || api.renderResult;

Then('退出码为 0', ({ api }) => {
  const last = lastResult(api);
  expect(last.exitCode, `stderr: ${last.stderr}\nstdout: ${last.stdout}`).toBe(0);
});

Then('退出码非 0', ({ api }) => {
  const last = lastResult(api);
  expect(last.exitCode).not.toBe(0);
});

Then('输出含 {string}', ({ api }, needle) => {
  const last = lastResult(api);
  expect(last.stdout + last.stderr).toContain(needle);
});

// ---------- product-level assertions (avoid path chars in step text) ----------
Then('源代码骨架文件含 2 个 @spec 标注', ({ api }) => {
  const src = api.readFile(path.join(api.TMP_ROOT, 'src/feature.js'));
  expect(src, 'src/feature.js should exist').not.toBeNull();
  const matches = src.match(/@spec SC-\d+/g) || [];
  expect(matches.length).toBe(2);
});

Then('源代码骨架文件含 @spec 标注', ({ api }) => {
  const src = api.readFile(path.join(api.TMP_ROOT, 'src/feature.js'));
  expect(src, 'src/feature.js should exist').not.toBeNull();
  expect(src).toMatch(/@spec SC-\d+/);
});

Then('测试桩文件含 SC-001 和 SC-002 命名', ({ api }) => {
  const src = api.readFile(path.join(api.TMP_ROOT, 'tests/feature.spec.js'));
  expect(src, 'tests/feature.spec.js should exist').not.toBeNull();
  expect(src).toMatch(/SC-001/);
  expect(src).toMatch(/SC-002/);
});

Then('测试桩文件含 SC 命名', ({ api }) => {
  const src = api.readFile(path.join(api.TMP_ROOT, 'tests/feature.spec.js'));
  expect(src, 'tests/feature.spec.js should exist').not.toBeNull();
  expect(src).toMatch(/SC-\d+/);
});

Then('评审报告含 D1 D2 D3 D4 四节', ({ api }) => {
  const src = api.readFile(path.join(api.TMP_ROOT, 'spec/review.md'));
  expect(src, 'spec/review.md should exist').not.toBeNull();
  expect(src).toContain('D1');
  expect(src).toContain('D2');
  expect(src).toContain('D3');
  expect(src).toContain('D4');
});

Then('全部退出码为 0', ({ api }) => {
  expect(api.devGenResult.exitCode, `dev-gen: ${api.devGenResult.stderr}`).toBe(0);
  expect(api.testGenResult.exitCode, `test-gen: ${api.testGenResult.stderr}`).toBe(0);
  expect(api.validateResult.exitCode, `validate: ${api.validateResult.stderr}`).toBe(0);
});