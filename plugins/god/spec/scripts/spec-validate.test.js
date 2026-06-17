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

## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |

## Check 结论

- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)
`);
  // 端到端要带 src + tests,让 SC-001 完整 1:1 绑定
  fs.mkdirSync(path.join(tmp1, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp1, 'src', 't.js'), `// @spec SC-001\nfunction a() { return 'x'; }\nmodule.exports = { a };\n`);
  fs.mkdirSync(path.join(tmp1, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(tmp1, 'tests', 't.spec.js'), `test('SC-001: outline test', () => {});\n`);
  let code = 0, out = '';
  try {
    out = execSync(`node ${SCRIPT} ${tmp1}`, { stdio: 'pipe' }).toString();
  } catch (e) {
    code = e.status;
    out = e.stdout.toString();
  }
  assertEq(code, 0, `应 exit 0,实际 ${code}\n${out}`);
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

## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |
`);
  let code = 0;
  try { execSync(`node ${SCRIPT} ${tmp2}`, { stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assertEq(code, 1, '缺 C5 应 exit 1');
} finally {
  try { fs.rmSync(tmp2, { recursive: true, force: true }); } catch {}
}
test('CLI: 缺 C5 锚点 exit 1', () => {});

// ---------- 6. --phase=implemented 阶段化（v0.5.0+ 修复：允许测试暂缺）----------

const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'god-validate-phase-impl-'));
try {
  const specDir = path.join(tmp3, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  // v0.5.2 P0：必须显式声明 tag 才能降级（capabilities 数据驱动）
  // 无 tag SC 不在 allowMissingTestTags 白名单 → implemented 阶段仍 fail
  fs.writeFileSync(path.join(specDir, 'spec.feature'), `@spec-version 1.0.0
Feature: T
  @SC-001 @happy
  Scenario: A
    Given a
    When b
    Then c
`);
  fs.writeFileSync(path.join(specDir, 'sources.md'), `# T

## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |

## Check 结论

- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)
`);
  // 建 src/ 含 @spec SC-001 标注
  fs.mkdirSync(path.join(tmp3, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp3, 'src', 't.js'), `// @spec SC-001\nfunction a() { return 'x'; }\nmodule.exports = { a };\n`);
  // 注意:不写 tests/，模拟 dev 阶段代码已写但测试未写
  // 显式传 --allow-missing-test-tags=happy,sad-path（v0.5.2 P0：capabilities 真驱动）
  // 显式传空字符串覆盖 v0.5.1 默认，验证"传 cap 即生效"
  let code = 0, out = '';
  try {
    out = execSync(`node ${SCRIPT} --phase=implemented --allow-missing-test-tags=happy,sad-path ${tmp3}`, { stdio: 'pipe' }).toString();
  } catch (e) {
    code = e.status;
    out = e.stdout.toString();
  }
  assertEq(code, 0, `--phase=implemented 应 exit 0（代码 @spec 齐即过），实际 ${code}\n${out}`);
} finally {
  try { fs.rmSync(tmp3, { recursive: true, force: true }); } catch {}
}
test('--phase=implemented: 仅代码 @spec 齐即过（不阻塞 dev 阶段）', () => {});

// ---------- 7. --phase=verified 阶段化（强约束测试 SC 完整绑定）----------

const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'god-validate-phase-ver-'));
try {
  const specDir = path.join(tmp4, 'spec');
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

## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |

## Check 结论

- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)
`);
  fs.mkdirSync(path.join(tmp4, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp4, 'src', 't.js'), `// @spec SC-001\nfunction a() { return 'x'; }\n`);
  // 不建 tests/
  let code = 0;
  try { execSync(`node ${SCRIPT} --phase=verified ${tmp4}`, { stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assertEq(code, 1, '--phase=verified 缺测试应 exit 1');
} finally {
  try { fs.rmSync(tmp4, { recursive: true, force: true }); } catch {}
}
test('--phase=verified: 测试 SC 缺则 fail（强约束）', () => {});

// ---------- 8. --phase=implemented 覆盖 sad-path 缺测试（v0.5.0+ P0 改进）----------

const tmp5 = fs.mkdtempSync(path.join(os.tmpdir(), 'god-validate-phase-impl-sad-'));
try {
  const specDir = path.join(tmp5, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, 'spec.feature'), `@spec-version 1.0.0
Feature: T
  @SC-101 @sad-path
  Scenario: 错误
    Given a
    When b
    Then c
`);
  fs.writeFileSync(path.join(specDir, 'sources.md'), `# T

## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-101 | sad | sad-path | Must | M2 | → SC-101 |

## Check 结论

- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)
`);
  // 代码有 @spec，测试无 SC-101: 标注 (sad-path 缺测试场景)
  fs.mkdirSync(path.join(tmp5, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp5, 'src', 't.js'), `// @spec SC-101\nfunction a() { throw new Error('x'); }\n`);
  fs.mkdirSync(path.join(tmp5, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(tmp5, 'tests', 't.spec.js'), `// 故意没 SC-101 标注\ntest('placeholder', () => {});\n`);
  let code = 0, out = '';
  try {
    out = execSync(`node ${SCRIPT} --phase=implemented ${tmp5}`, { stdio: 'pipe' }).toString();
  } catch (e) {
    code = e.status;
    out = e.stdout.toString();
  }
  assertEq(code, 0, `--phase=implemented 应忽略 sad-path 缺测试（v0.5.0+ 改进），实际 ${code}\n${out}`);
  // v0.5.2 P0：capabilities 数据驱动 → 消息里显式标 "implemented 阶段 sad-path 在 allowMissingTestTags 降级为 info"
  assert(/implemented 阶段.*降级为 info/.test(out), `输出应标"implemented 阶段 ... 降级为 info"，实际：${out.slice(-300)}`);
} finally {
  try { fs.rmSync(tmp5, { recursive: true, force: true }); } catch {}
}
test('--phase=implemented: sad-path 缺测试降级为 info（v0.5.0+ P0 改进）', () => {});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
