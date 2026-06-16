#!/usr/bin/env node
/**
 * spec-summary.test.js — G8 单元测试
 *
 * 跑法: node spec/scripts/spec-summary.test.js
 * 退出: 0 全过 / 1 有失败
 *
 * 测试覆盖：
 *   - parseSpecMetadata（行号提取 + Feature 名）
 *   - parseSources（4 段提取）
 *   - classifyBoundary（自动打标 ✅ ⚠️ ❌）
 *   - cmdCheck（4 项校验规则）
 *   - end-to-end gen（用临时 fixture）
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'spec-summary.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

// 直接 require 主脚本拿内部函数（暴露端口）
const summary = require('./spec-summary.js');
const { parseSpecMetadata, parseSources, classifyBoundary, fillTemplate } = summary;

// 临时目录
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-summary-test-'));

function setupFixture(specContent, sourcesContent) {
  const dir = path.join(tmpRoot, 'spec-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'spec'));
  fs.writeFileSync(path.join(dir, 'spec', 'spec.feature'), specContent);
  fs.writeFileSync(path.join(dir, 'spec', 'sources.md'), sourcesContent);
  return dir;
}

function cleanup() {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
}

const SAMPLE_SPEC = `@spec-version 1.0.0
Feature: Lead Scoring
  作为销售，我想看到每个 lead 的健康分，以便优先跟进。

  @SC-001 @happy
  Scenario: 健康 lead 显示高分
    Given lead 7 天内被联系
    When 计算健康分
    Then 分数 >= 80
`;

const SAMPLE_SOURCES = `# Lead Scoring 需求

## Goal
OPC 想让销售看到 lead 健康分，优先跟进高价值 lead。

## 角色 + 核心流程
1. 销售 → 打开 lead 列表 → 看健康分
2. 销售 → 点击 lead → 看历史联系记录
3. 系统 → 计算健康分 → 实时更新

## 边界 / 异常清单
- 正常情况：lead 7 天内有联系 → 分数 >= 80
- 边界情况：lead 30 天未联系 → 分数 50 ± 10
- 异常情况：联系记录为空 → 分数 0

## Out of Scope
- 不做 lead 标签自动分类
- 不做邮件自动发送
- 不做 CRM 集成
- 不做移动端 push
- 不做预测性分数（ML 模型）
`;

console.log('spec-summary.test.js');

// ---------- 1. parseSpecMetadata ----------

test('parseSpecMetadata: 提取 @spec-version 行号', () => {
  const m = parseSpecMetadata(SAMPLE_SPEC);
  assertEq(m.versionLine, 1, 'versionLine');
  assertEq(m.featureLine, 2, 'featureLine');
  assertEq(m.featureName, 'Lead Scoring', 'featureName');
});

// ---------- 2. parseSources 4 段 ----------

test('parseSources: 提取 4 段', () => {
  const s = parseSources(SAMPLE_SOURCES);
  assert(s.goal.includes('健康分'), 'goal 应含"健康分"');
  assert(s.roles.includes('销售'), 'roles 应含"销售"');
  assert(s.boundary.includes('30 天未联系'), 'boundary 应含"30 天未联系"');
  assert(s.oos.includes('CRM 集成'), 'oos 应含"CRM 集成"');
});

// ---------- 3. classifyBoundary ----------

test('classifyBoundary: 自动打 ✅ ⚠️ ❌', () => {
  const input = `- 正常情况：xxx
- 边界情况：yyy
- 异常情况：失败
`;
  const lines = classifyBoundary(input);
  assert(lines.some(l => l.includes('✅')), '应有 ✅ 标记');
  assert(lines.some(l => l.includes('⚠️')), '应有 ⚠️ 标记');
  assert(lines.some(l => l.includes('❌')), '应有 ❌ 标记');
});

// ---------- 4. cmdCheck: 4 项校验规则 ----------

function runCheck(dir) {
  try {
    execSync(`node ${SCRIPT} check ${dir}`, { stdio: 'pipe' });
    return { ok: true, code: 0 };
  } catch (e) {
    return { ok: false, code: e.status, stderr: e.stderr.toString() };
  }
}

function runGen(dir) {
  try {
    execSync(`node ${SCRIPT} gen ${dir}`, { stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, stderr: e.stderr.toString() };
  }
}

const fixture1 = setupFixture(SAMPLE_SPEC, SAMPLE_SOURCES);

test('end-to-end gen: 产出 summary.md', () => {
  const r = runGen(fixture1);
  assert(r.ok, `gen 失败: ${r.stderr}`);
  assert(fs.existsSync(path.join(fixture1, 'spec', 'summary.md')), 'summary.md 应存在');
});

test('end-to-end check: 4 项全过', () => {
  const r = runCheck(fixture1);
  assert(r.ok, `check 失败: ${r.stderr}`);
});

test('check: summary.md 不含 Gherkin 关键词', () => {
  const summary = fs.readFileSync(path.join(fixture1, 'spec', 'summary.md'), 'utf8');
  assert(!/\bGiven\b/.test(summary), '不应有 Given');
  assert(!/\bWhen\b/.test(summary), '不应有 When');
  assert(!/\bThen\b/.test(summary), '不应有 Then');
  assert(!/\bScenario\b/.test(summary), '不应有 Scenario');
  assert(!/SC-\d{3}/.test(summary), '不应有 SC-xxx');
});

test('check: summary.md 末尾含"详细 spec"链接', () => {
  const summary = fs.readFileSync(path.join(fixture1, 'spec', 'summary.md'), 'utf8');
  assert(/>\s*详细 spec：/.test(summary), '应有"详细 spec"链接');
});

test('check: summary.md 行数 ≤ 100', () => {
  const summary = fs.readFileSync(path.join(fixture1, 'spec', 'summary.md'), 'utf8');
  const lineCount = summary.split('\n').length;
  assert(lineCount <= 100, `行数 ${lineCount} > 100`);
});

// ---------- 5. 负面用例：故意带 Gherkin 应失败 ----------

const fixture2 = setupFixture(SAMPLE_SPEC, SAMPLE_SOURCES);
fs.writeFileSync(
  path.join(fixture2, 'spec', 'summary.md'),
  '# Bad Summary\n\nGiven xxx when yyy then zzz\nSC-001 SC-002 SC-003\n## 不在范围内\n- a\n- b\n- c\n- d\n'
);

test('check: 含 Gherkin 关键词应被拒', () => {
  const r = runCheck(fixture2);
  assert(!r.ok, '应失败但通过');
  assert(/Gherkin/.test(r.stderr), '应报 Gherkin 错误');
});

const fixture3 = setupFixture(SAMPLE_SPEC, SAMPLE_SOURCES);
fs.writeFileSync(
  path.join(fixture3, 'spec', 'summary.md'),
  '# No Link\n\n## 不在范围内\n- a\n- b\n- c\n- d\n'
);

test('check: 缺"详细 spec"链接应被拒', () => {
  const r = runCheck(fixture3);
  assert(!r.ok, '应失败但通过');
  assert(/详细 spec/.test(r.stderr), '应报"详细 spec"错误');
});

const fixture4 = setupFixture(SAMPLE_SPEC, SAMPLE_SOURCES);
fs.writeFileSync(
  path.join(fixture4, 'spec', 'summary.md'),
  '# No OOS\n\n> 详细 spec：spec/SPEC-FORMAT.md#L1-L2\n'
);

test('check: 缺"不在范围内"段应被拒', () => {
  const r = runCheck(fixture4);
  assert(!r.ok, '应失败但通过');
  assert(/不在范围内/.test(r.stderr), '应报"不在范围内"错误');
});

// ---------- 清理 ----------

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
