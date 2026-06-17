#!/usr/bin/env node
/**
 * spec-render.test.js — G7 spec-render 单元测试
 *
 * 设计依据: docs/rfcs/0009-spec-render.md §4 验收
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  parseFeatureScenarios,
  parseSourcesReqs,
  scanCode,
  scanTests,
  generateReview,
} = require('./spec-render.js');

// ---------- 辅助 ----------
function tmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-spec-render-'));
  fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
  return dir;
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

// ---------- 测试 parseFeatureScenarios ----------
const specBasic = `@spec-version 1.0.0
Feature: 猜数字
  作为玩家，我想猜数字

  @SC-001 @happy
  Scenario: 猜对
    Given 目标是 50
    When 猜 50
    Then 显示 "猜对了"

  @SC-002 @sad-path
  Scenario: 非数字
    Given 目标是 50
    When 猜 "abc"
    Then 显示 "请输入数字"
`;

assert.doesNotThrow(() => {
  const r = parseFeatureScenarios(specBasic);
  assert.strictEqual(r.featureName, '猜数字');
  assert.strictEqual(r.version, '1.0.0');
  assert.strictEqual(r.scenarios.length, 2);
  assert.strictEqual(r.scenarios[0].id, 'SC-001');
  assert.deepStrictEqual(r.scenarios[0].tags, ['happy']);
  assert.strictEqual(r.scenarios[0].gwt.Given[0], '目标是 50');
  assert.strictEqual(r.scenarios[0].gwt.When[0], '猜 50');
  assert.strictEqual(r.scenarios[1].tags.includes('sad-path'), true);
}, 'parseFeatureScenarios: 解析基本 Gherkin');

assert.doesNotThrow(() => {
  const r = parseFeatureScenarios('');
  assert.strictEqual(r.scenarios.length, 0);
  assert.strictEqual(r.featureName, '');
}, 'parseFeatureScenarios: 空字符串不抛');

assert.doesNotThrow(() => {
  const r = parseFeatureScenarios(`@spec-version 0.5.0
Feature: Demo
  @SC-001
  Scenario: x
    Given a
    And b
    When c
    But d
    Then e
`);
  // And/But 都归 Then
  assert.strictEqual(r.scenarios[0].gwt.Then.length, 3); // And b + But d + Then e
}, 'parseFeatureScenarios: And/But 关键字归 Then');

// ---------- 测试 parseSourcesReqs ----------
const sourcesBasic = `# Demo
## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-001 | 健康 lead 评分 | 功能 | Must | brainstorm | → SC-001 |
| REQ-002 | 失联降权 | 功能 | Must | brainstorm | → SC-002 |
| REQ-003 | 邮件推送 | 功能 | Won't | PM | Out of Scope |
| REQ-004 | 无主条目 | - | - | - | |

## Goal
`;

assert.doesNotThrow(() => {
  const reqs = parseSourcesReqs(sourcesBasic);
  assert.strictEqual(reqs.length, 4);
  assert.strictEqual(reqs[0].id, 'REQ-001');
  assert.strictEqual(reqs[0].target, '→ SC-001');
  assert.strictEqual(reqs[2].target.includes('Out of Scope'), true);
  assert.strictEqual(reqs[3].target, '');
}, 'parseSourcesReqs: 解析 REQ 表格');

assert.doesNotThrow(() => {
  const reqs = parseSourcesReqs(null);
  assert.deepStrictEqual(reqs, []);
}, 'parseSourcesReqs: null 输入空数组');

// ---------- 测试 scanCode + scanTests ----------
assert.doesNotThrow(() => {
  const dir = tmpProject();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.js'),
    `// @spec SC-001,SC-002\nfunction foo() {}\n// @spec SC-003\nfunction bar() {}`);
  const codeMap = scanCode(dir);
  assert.deepStrictEqual(codeMap['SC-001'].length, 1);
  assert.deepStrictEqual(codeMap['SC-002'].length, 1);
  assert.deepStrictEqual(codeMap['SC-003'].length, 1);
  rmrf(dir);
}, 'scanCode: 扫描 @spec 标注');

assert.doesNotThrow(() => {
  const dir = tmpProject();
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tests', 'a.test.js'),
    `test('SC-001: 猜对', () => {});\ntest('SC-002: 猜错', () => {});`);
  const testMap = scanTests(dir);
  assert.strictEqual(testMap['SC-001'][0].endsWith('a.test.js'), true);
  assert.strictEqual(testMap['SC-002'][0].endsWith('a.test.js'), true);
  rmrf(dir);
}, 'scanTests: 扫描 SC-xxx: 用例');

// ---------- 测试 generateReview ----------
assert.doesNotThrow(() => {
  const parsed = parseFeatureScenarios(specBasic);
  const reqs = parseSourcesReqs(sourcesBasic);
  const md = generateReview(parsed, reqs, {}, {}, '2026-06-16');
  assert.ok(md.includes('## D1 需求完整性'));
  assert.ok(md.includes('## D2 用户视角 + 边界'));
  assert.ok(md.includes('## D3 GWT 可验证性'));
  assert.ok(md.includes('## D4 双向绑定矩阵'));
  assert.ok(md.includes('## 评审草稿分'));
  assert.ok(md.includes('REQ-001'));
  assert.ok(md.includes('@sad-path'));
  assert.ok(md.includes('SC-001'));
  assert.ok(md.includes('2026-06-16'));
}, 'generateReview: 4 段 + REQ + SC + 日期全包含');

assert.doesNotThrow(() => {
  const parsed = parseFeatureScenarios(specBasic);
  const reqs = parseSourcesReqs(sourcesBasic);
  const codeMap = { 'SC-001': ['src/a.js:1'], 'SC-002': [] };
  const testMap = { 'SC-001': ['tests/a.test.js'] };
  const md = generateReview(parsed, reqs, codeMap, testMap, '2026-06-16');
  assert.ok(md.includes('src/a.js:1'));
  assert.ok(md.includes('缺测试'), 'SC-002 缺测试应显示');
}, 'generateReview: 缺测/D4 状态正确');

assert.doesNotThrow(() => {
  const specOrphan = `@spec-version 1.0.0
Feature: x
  @SC-001
  Scenario: 唯一
    Given a
    When b
    Then c
`;
  const parsed = parseFeatureScenarios(specOrphan);
  const codeMap = { 'SC-001': [], 'SC-999': ['src/orphan.js:1'] }; // 孤儿
  const testMap = {};
  const md = generateReview(parsed, [], codeMap, testMap, '2026-06-16');
  assert.ok(md.includes('孤儿'));
  assert.ok(md.includes('SC-999'));
  assert.ok(md.includes('代码'));
}, 'generateReview: 孤儿标注');

// ---------- CLI 测试 ----------
const CLI = path.join(__dirname, 'spec-render.js');
// v0.7.x demo/lead-scoring 已收缩成 demo/_template(单 demo 占位)。
// 测试用 tmpdir 临时建一个 fake lead-scoring demo,跑完清理。
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'god-spec-render-'));
const DEMO = path.join(TMP, 'lead-scoring');
fs.mkdirSync(path.join(DEMO, 'spec'), { recursive: true });
fs.writeFileSync(path.join(DEMO, 'spec', 'spec.feature'), '@spec-version 0.4.0\nFeature: Lead Scoring\n');
fs.writeFileSync(path.join(DEMO, 'spec', 'sources.md'), '# sources\n');
fs.writeFileSync(path.join(DEMO, 'spec', 'summary.md'), '# Lead Scoring summary\n');

function runCli(args) {
  try {
    const out = execSync(`node ${CLI} ${args} 2>&1`, { encoding: 'utf8' });
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: (e.stdout || '') + (e.stderr || '') };
  }
}

try {
  const r = runCli('');
  assert.fail('应报错（无参数）');
} catch (e) {
  // 不会到这里
}
const noArg = runCli('');
assert.strictEqual(noArg.ok, false);
assert.ok(noArg.output.includes('用法'), `无参数: ${noArg.output}`);
console.log('  ✓ CLI: 无参数显示用法');

const noDir = runCli('/nonexistent/path');
assert.strictEqual(noDir.ok, false);
assert.ok(noDir.output.includes('不存在'), `不存在: ${noDir.output}`);
console.log('  ✓ CLI: 不存在目录拒绝');

const noSpecDir = tmpProject();
const noSpec = runCli(noSpecDir);
assert.strictEqual(noSpec.ok, false);
assert.ok(noSpec.output.includes('找不到 spec 目录'), `找不到: ${noSpec.output}`);
rmrf(noSpecDir);
console.log('  ✓ CLI: 找不到 spec 拒绝');

assert.doesNotThrow(() => {
  const out = execSync(`node ${CLI} ${DEMO} --dry-run 2>&1`, { encoding: 'utf8' });
  assert.ok(out.includes('[dry-run]'));
  assert.ok(out.includes('Lead Scoring'));
}, 'CLI: --dry-run 不写文件');

// 真实写
assert.doesNotThrow(() => {
  const out = execSync(`node ${CLI} ${DEMO} --force 2>&1`, { encoding: 'utf8' });
  assert.ok(out.includes('spec-render 完成'));
  // v0.5.0+ G13: review.md 移到 review/ 子目录 + 日期
  const reviewDir = path.join(DEMO, 'spec', 'review');
  assert.ok(fs.existsSync(reviewDir), 'review/ 目录应存在');
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(fs.existsSync(path.join(reviewDir, `review-${today}.md`)), 'review-<date>.md 应存在');
}, 'CLI: --force 写入 review/<date>.md');

const exists = runCli(DEMO);
assert.strictEqual(exists.ok, false);
assert.ok(exists.output.includes('已存在'), `已存在: ${exists.output}`);
console.log('  ✓ CLI: 默认拒绝覆盖');

// 清理 demo 里的 review/（不入仓）
const reviewDir = path.join(DEMO, 'spec', 'review');
if (fs.existsSync(reviewDir)) fs.rmSync(reviewDir, { recursive: true, force: true });

// 清理 tmpdir
if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n✅ 全部通过');
