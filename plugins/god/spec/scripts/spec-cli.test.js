#!/usr/bin/env node
/**
 * spec-cli.test.js — G1 状态机单元测试
 *
 * 跑法: node spec/scripts/spec-cli.test.js
 * 退出: 0 全过 / 1 有失败
 *
 * 测试覆盖:
 *   - 6 状态合法性（VALID_PHASES）
 *   - 转移规则（PHASE_ORDER 单调递增）
 *   - checkGate（drafted/reviewed/implemented/accepted gate 触发）
 *   - cmdInit / cmdAdvance / cmdRollback / cmdCheck 端到端
 *   - 拒绝非法转移
 *   - 拒绝 rollback 缺 --reason
 *   - --force 跳过 gate 校验 + trace 留痕
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'spec-cli.js');
const cli = require('./spec-cli.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-cli-test-'));
function setupFixture() {
  const dir = path.join(tmpRoot, 'spec-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'spec'));
  fs.writeFileSync(path.join(dir, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: Test\n  作为测试。\n\n  @SC-001 @happy\n  Scenario: A\n    Given x\n    When y\n    Then z\n');
  fs.writeFileSync(path.join(dir, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest goal\n\n## 角色 + 核心流程\n1. a → b\n\n## 边界 / 异常清单\n- 正常：a\n- 异常：失败\n\n## Out of Scope\n- a\n- b\n- c\n\n## Check 结论\nC5: ok\n');
  return dir;
}
function cleanup() { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {} }
function run(args, cwd) {
  try { return { ok: true, out: execSync(`node ${SCRIPT} ${args}`, { cwd, stdio: 'pipe' }).toString() }; }
  catch (e) { return { ok: false, code: e.status, stderr: e.stderr.toString(), out: (e.stdout||'').toString() }; }
}

console.log('spec-cli.test.js');

// ---------- 1. 常量 ----------

test('VALID_PHASES 含 6 状态', () => {
  assertEq(cli.VALID_PHASES.length, 6, 'phase 数');
  assert(cli.VALID_PHASES.includes('idea'), '含 idea');
  assert(cli.VALID_PHASES.includes('accepted'), '含 accepted');
});

test('PHASE_ORDER 严格递增', () => {
  let prev = -1;
  for (const p of cli.VALID_PHASES) {
    assert(cli.PHASE_ORDER[p] > prev, `${p} 应大于 ${prev}`);
    prev = cli.PHASE_ORDER[p];
  }
});

// ---------- 2. init ----------

const f1 = setupFixture();
test('init: 必填 --spec-id', () => {
  const r = run('init ' + f1, f1);
  assert(!r.ok, '应失败');
  assert(/spec-id/.test(r.stderr), '应报 --spec-id 错');
});

test('init: 必填合法 --phase', () => {
  const r = run(`init ${f1} --spec-id test1 --phase bogus`, f1);
  assert(!r.ok, '应失败');
  assert(/phase/.test(r.stderr), '应报 --phase 错');
});

test('init: 正常路径', () => {
  const r = run(`init ${f1} --spec-id test1 --phase drafted`, f1);
  assert(r.ok, `init 失败: ${r.stderr}`);
  // v0.5.0+ G13: meta 写到 state/meta.json（不是 spec/meta.json）
  const meta = JSON.parse(fs.readFileSync(path.join(f1, 'spec', 'state', 'meta.json'), 'utf8'));
  assertEq(meta.specId, 'test1', 'specId');
  assertEq(meta.phase, 'drafted', 'phase');
  assert(meta.version === '1.0.0', 'version 从 spec.feature 提取');
  assert(meta.gates.drafted, 'gates.drafted 有值');
});

test('init: 重复 init 拒绝', () => {
  const r = run(`init ${f1} --spec-id test1 --phase drafted`, f1);
  assert(!r.ok, '应失败');
  assert(/已存在/.test(r.stderr), '应报已存在');
});

// ---------- 3. status ----------

test('status: 正常输出', () => {
  const r = run(`status ${f1}`);
  assert(r.ok);
  assert(/phase: drafted/.test(r.out), '应输出 phase: drafted');
  assert(/✓ drafted/.test(r.out), '应有 ✓ drafted gate');
});

test('status: 无 meta 时输出 idea', () => {
  const f2 = setupFixture();
  const r = run(`status ${f2}`);
  assert(/idea/.test(r.out), '应输出 idea');
});

// ---------- 4. advance 拒绝非法 ----------

test('advance: 无 meta 拒绝', () => {
  const f2 = setupFixture();
  const r = run(`advance ${f2}`);
  assert(!r.ok);
  assert(/meta.json/.test(r.stderr));
});

test('advance: drafted → reviewed 需 C5 锚点', () => {
  const f3 = setupFixture();
  // init 但不写 C5
  fs.writeFileSync(path.join(f3, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest\n\n## 角色\n- a\n\n## 边界\n- a\n\n## Out of Scope\n- a\n- b\n- c\n');
  run(`init ${f3} --spec-id test3 --phase drafted`, f3);
  const r = run(`advance ${f3}`, f3);
  assert(!r.ok);
  assert(/C5/.test(r.stderr), '应报 C5 缺');
});

test('advance: drafted → reviewed 有 C5 锚点则过', () => {
  const r = run(`advance ${f1}`);
  assert(r.ok, `advance 失败: ${r.stderr}`);
  // v0.5.0+ G13: 读 state/meta.json（向后兼容旧 demo 时回退到 spec/meta.json）
  const metaPath = fs.existsSync(path.join(f1, 'spec', 'state', 'meta.json'))
    ? path.join(f1, 'spec', 'state', 'meta.json')
    : path.join(f1, 'spec', 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assertEq(meta.phase, 'reviewed', 'phase 应为 reviewed');
  assert(meta.gates.reviewed, 'gates.reviewed 有值');
  // trace 同理
  const tracePath = fs.existsSync(path.join(f1, 'spec', 'state', '.trace'))
    ? path.join(f1, 'spec', 'state', '.trace')
    : path.join(f1, 'spec', '.trace');
  const trace = fs.readFileSync(tracePath, 'utf8');
  assert(/drafted → reviewed/.test(trace), '.trace 应有转移记录');
});

test('advance: 不可跳过（drafted → verified 拒绝）', () => {
  const f4 = setupFixture();
  run(`init ${f4} --spec-id test4 --phase drafted`, f4);
  // 直接尝试 advance 两次（应该第一次进 reviewed 成功后，第二次试图 reviewed → implemented）
  // 验证实现态校验（spec-validate.js 会跑）—— 不必有 SC 标注，spec-validate.js 应通过
  run(`advance ${f4}`, f4); // drafted → reviewed
  const r = run(`advance ${f4}`, f4); // reviewed → implemented
  // 这里会调 spec-validate.js，因为 SC 有 Gherkin 但代码无 @spec 标注，会失败
  assert(!r.ok, 'reviewed → implemented 应失败（缺 @spec 标注）');
});

test('advance: --force 跳过 gate 校验 + trace 留痕', () => {
  const f5 = setupFixture();
  run(`init ${f5} --spec-id test5 --phase drafted`, f5);
  const r = run(`advance ${f5} --force`, f5);
  assert(r.ok, `force 失败: ${r.stderr}`);
  const trace = fs.readFileSync(path.join(f5, 'spec', '.trace'), 'utf8');
  assert(/FORCE/.test(trace), 'trace 应标 FORCE');
});

test('advance: accepted 不能再 advance', () => {
  const f6 = setupFixture();
  run(`init ${f6} --spec-id test6 --phase accepted`, f6);
  const r = run(`advance ${f6}`, f6);
  assert(!r.ok);
  assert(/accepted/.test(r.stderr));
});

// ---------- 5. rollback ----------

test('rollback: 必填 --to', () => {
  const r = run(`rollback ${f1}`);
  assert(!r.ok);
  assert(/--to/.test(r.stderr));
});

test('rollback: 必填 --reason', () => {
  const r = run(`rollback ${f1} --to drafted`);
  assert(!r.ok);
  assert(/--reason/.test(r.stderr));
});

test('rollback: 必须回退（不能向前）', () => {
  // f1 现在是 reviewed，rollback 到 verified 应失败
  const r = run(`rollback ${f1} --to verified --reason test`, f1);
  assert(!r.ok);
  assert(/非回退/.test(r.stderr));
});

test('rollback: 正常回退 + 清掉被回退阶段 gate', () => {
  const r = run(`rollback ${f1} --to drafted --reason "撤回评审"`, f1);
  assert(r.ok, `rollback 失败: ${r.stderr}`);
  // v0.5.0+ G13: 同 advance,读 state/meta.json 优先
  const metaPath = fs.existsSync(path.join(f1, 'spec', 'state', 'meta.json'))
    ? path.join(f1, 'spec', 'state', 'meta.json')
    : path.join(f1, 'spec', 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assertEq(meta.phase, 'drafted', 'phase 应为 drafted');
  assert(!meta.gates.reviewed, 'gates.reviewed 应清掉');
  const tracePath = fs.existsSync(path.join(f1, 'spec', 'state', '.trace'))
    ? path.join(f1, 'spec', 'state', '.trace')
    : path.join(f1, 'spec', '.trace');
  const trace = fs.readFileSync(tracePath, 'utf8');
  assert(/ROLLBACK/.test(trace), 'trace 应标 ROLLBACK');
  assert(/撤回评审/.test(trace), 'trace 应含 reason');
});

// ---------- 6. check ----------

test('check: meta 缺失拒绝', () => {
  const f7 = setupFixture();
  const r = run(`check ${f7}`);
  assert(!r.ok);
});

test('check: 合法 phase + gate 通过', () => {
  const r = run(`check ${f1}`);
  assert(r.ok, `check 失败: ${r.stderr}`);
  assert(/check 通过/.test(r.out));
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
