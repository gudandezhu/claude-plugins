#!/usr/bin/env node
/**
 * spec-validate.test.js — spec-validate.js 单元测试（含 Scenario Outline 支持）
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'spec-validate.js');
const sv = require('./spec-validate.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

console.log('spec-validate.test.js');

// ---------- 1. parseSpec 含 Scenario Outline ----------

test('parseSpec: Scenario Outline 被识别为 SC', () => {
  const content = `@spec-version 1.0.0
Feature: Test

  @SC-001 @happy
  Scenario Outline: 短码长度
    Given 长 URL <url>
    When 生成短链
    Then 短码长度 = 6

    Examples:
      | url                |
      | https://a.com/x   |
      | https://a.com/y   |
`;
  const r = sv.parseSpec(content);
  assertEq(r.scenarios.length, 1, '1 SC');
  assertEq(r.scenarios[0].id, 'SC-001');
  assertEq(r.scenarios[0].title, '短码长度');
  assert(r.scenarios[0].isOutline, 'isOutline = true');
  assert(r.scenarios[0].hasGiven, 'hasGiven');
  assert(r.scenarios[0].hasWhen, 'hasWhen');
  assert(r.scenarios[0].hasThen, 'hasThen');
});

// ---------- 2. parseSpec 兼容普通 Scenario ----------

test('parseSpec: 普通 Scenario 不误判为 Outline', () => {
  const content = `@spec-version 1.0.0
Feature: Test
  @SC-001
  Scenario: 普通场景
    Given a
    When b
    Then c
`;
  const r = sv.parseSpec(content);
  assertEq(r.scenarios.length, 1);
  assert(!r.scenarios[0].isOutline, 'isOutline = false');
});

// ---------- 3. parseSpec 混合 Scenario + Outline ----------

test('parseSpec: Scenario + Outline 混合', () => {
  const content = `@spec-version 1.0.0
Feature: T
  @SC-001
  Scenario: A
    Given a
    When b
    Then c

  @SC-002
  Scenario Outline: B
    Given x <v>
    When y
    Then z
    Examples:
      | v |
      | 1 |
`;
  const r = sv.parseSpec(content);
  assertEq(r.scenarios.length, 2);
  assert(!r.scenarios[0].isOutline, 'SC-001 isOutline = false');
  assert(r.scenarios[1].isOutline, 'SC-002 isOutline = true');
});

// ---------- 4. CLI: Scenario Outline 端到端 ----------

const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'god-validate-outline-'));
try {
  const specDir = path.join(tmp1, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, 'spec.feature'), `@spec-version 1.0.0
Feature: T
  @SC-001
  Scenario Outline: A
    Given a <x>
    When b
    Then c
    Examples:
      | x |
      | 1 |
`);
  fs.writeFileSync(path.join(specDir, 'sources.md'), `# T

| REQ-ID | 描述 | MoSCoW | 来源 | 归属 |
|--------|------|--------|------|------|
| REQ-001 | 测试 | Must | M2 | → SC-001 |

## Check 结论

- **C5 Spec 评审** (2026-06-16 / 简单档 / 95 分 / 通过)
`);
  let code = 0, out = '';
  try {
    out = execSync(`node ${SCRIPT} ${tmp1}`, { stdio: 'pipe' }).toString();
  } catch (e) {
    code = e.status;
    out = e.stdout.toString();
  }
  assertEq(code, 0, `应 exit 0,实际 ${code}`);
  assert(out.includes('SC-001'), '输出应含 SC-001');
  assert(out.includes('追溯绑定'), '输出应含追溯绑定');
} finally {
  try { fs.rmSync(tmp1, { recursive: true, force: true }); } catch {}
}
test('CLI: Scenario Outline 端到端通过', () => {});

// ---------- 5. CLI: 缺 C5 锚点仍失败（守门）----------

const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'god-validate-c5-'));
try {
  const specDir = path.join(tmp2, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, 'spec.feature'), `@spec-version 1.0.0
Feature: T
  @SC-001
  Scenario: A
    Given a
    When b
    Then c
`);
  fs.writeFileSync(path.join(specDir, 'sources.md'), `# T

| REQ-ID | 描述 | MoSCoW | 来源 | 归属 |
|--------|------|--------|------|------|
| REQ-001 | 测试 | Must | M2 | → SC-001 |
`);
  let code = 0;
  try { execSync(`node ${SCRIPT} ${tmp2}`, { stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assertEq(code, 1, '缺 C5 应 exit 1');
} finally {
  try { fs.rmSync(tmp2, { recursive: true, force: true }); } catch {}
}
test('CLI: 缺 C5 锚点 exit 1', () => {});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
