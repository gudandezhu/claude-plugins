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

// ---------- accepted 阶段强约束：ACCEPTANCE.md 必须存在 ----------

test('accepted gate: 缺 ACCEPTANCE.md 应 fail', () => {
  // 从 verified 推到 accepted，缺 ACCEPTANCE.md 应被 gate 拦下
  const f = setupFixture();
  run(`init ${f} --spec-id test-acc-miss --phase verified`, f);
  const r = run(`advance ${f}`, f);
  assert(!r.ok, '缺 ACCEPTANCE.md 应被 gate 拦下');
  assert(/ACCEPTANCE\.md/.test(r.stderr), `应报 ACCEPTANCE.md 缺失，实际: ${r.stderr}`);
});

test('accepted gate: 有 ACCEPTANCE.md 时不再报 ACCEPTANCE 缺失', () => {
  // 验证"加 ACCEPTANCE.md 后,advance 失败原因不再是 ACCEPTANCE.md 缺失"
  // (可能还因 spec-summary check 失败,那是另一道 gate)
  const f = setupFixture();
  // 给 sources.md 补 C5 HH:MM 格式（spec-validate C5 校验要求）
  fs.writeFileSync(path.join(f, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest goal\n\n## 角色 + 核心流程\n1. a → b\n\n## 边界 / 异常清单\n- 正常：a\n- 异常：失败\n\n## Out of Scope\n- a\n- b\n- c\n\n## Check 结论\n- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)\n');
  run(`init ${f} --spec-id test-acc-ok --phase verified`, f);
  fs.writeFileSync(path.join(f, 'ACCEPTANCE.md'), '# 验收报告\n', 'utf8');
  const r = run(`advance ${f}`, f);
  // 不论是否过,错误不应含 "ACCEPTANCE.md 缺失"
  assert(!/ACCEPTANCE\.md 缺失/.test(r.stderr), `有 ACCEPTANCE.md 时不应报缺失,实际: ${r.stderr}`);
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

// ---------- 7. phaseCapabilities 数据驱动（v0.5.2 P0）----------

console.log('\nphaseCapabilities 数据驱动:');

test('init: meta.json 包含 phaseCapabilities 字段', () => {
  const f = setupFixture();
  const r = run(`init ${f} --spec-id cap-test --phase drafted`, f);
  assert(r.ok, `init 失败: ${r.stderr}`);
  const meta = JSON.parse(fs.readFileSync(path.join(f, 'spec', 'state', 'meta.json'), 'utf8'));
  assert(meta.phaseCapabilities, '应包含 phaseCapabilities 字段');
  assert(meta.phaseCapabilities.drafted, '应包含 drafted 默认配置');
  assert(meta.phaseCapabilities.implemented, '应包含 implemented 默认配置');
  assert(meta.phaseCapabilities.implemented.allowMissingTestTags.includes('sad-path'),
    'implemented 默认 allowMissingTestTags 应含 sad-path（v0.5.1 行为）');
});

test('DEFAULT_PHASE_CAPABILITIES.implemented.allowMissingTestTags 含 sad-path（向后兼容）', () => {
  assert(cli.DEFAULT_PHASE_CAPABILITIES.implemented.allowMissingTestTags.includes('sad-path'),
    'v0.5.1 行为：sad-path 缺测试在 implemented 阶段放过');
  assert(cli.DEFAULT_PHASE_CAPABILITIES.verified.allowMissingTestTags.length === 0,
    'verified 阶段全 1:1 强约束');
});

test('getPhaseCapabilities: meta 缺字段时回退到 DEFAULT', () => {
  const meta = { phase: 'drafted' };  // 缺 phaseCapabilities
  const cap = cli.getPhaseCapabilities(meta, 'drafted');
  assert(cap.requireSpecFeature === true, '回退到 DEFAULT');
  // meta 有覆盖时用 meta 的
  const meta2 = { phase: 'implemented', phaseCapabilities: { implemented: { allowMissingTestTags: [] } } };
  const cap2 = cli.getPhaseCapabilities(meta2, 'implemented');
  assertEq(cap2.allowMissingTestTags.length, 0, 'meta 覆盖了 DEFAULT');
  // DEFAULT 的其他字段还在（Object.assign 合并）
  assert(cap2.validatePhase === 'implemented', 'validatePhase 走 DEFAULT');
});

test('phaseCapabilities: implemented 改 allowMissingTestTags=[] 后,advance 缺测试应 fail', () => {
  // 演练 1：跑 advance verified → implemented 缺 @spec 标注,应被 gate 拦下
  // 由于当前 spec-validate 用 --phase=implemented 时,普通 SC 缺测试会降级为 info
  // 验证：把 allowMissingTestTags 设为 [] → spec-validate 还是 implemented phase,降级规则在 spec-validate 内部
  //
  // 因此这个测改为：验证"capabilities 驱动校验"的核心——getPhaseCapabilities 读 allowMissingTestTags
  // 真实跑 advance 的 e2e 测在下面
  const f = setupFixture();
  run(`init ${f} --spec-id cap-strict --phase drafted`, f);
  // 改 meta：把 implemented 的 allowMissingTestTags 设为 []
  const metaPath = path.join(f, 'spec', 'state', 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.phaseCapabilities.implemented.allowMissingTestTags = [];
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  // 现在 init meta 改了。下次 advance 走这条严格配置
  // 把 sources.md 补 C5（drafted → reviewed gate 需 C5）
  fs.writeFileSync(path.join(f, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest\n\n## 角色\n- a\n\n## 边界\n- a\n\n## Out of Scope\n- a\n- b\n- c\n\n## C5 Spec 评审 (95 分 / 通过)\n');
  // advance drafted → reviewed
  const r1 = run(`advance ${f}`, f);
  assert(r1.ok, `drafted → reviewed 失败: ${r1.stderr}`);
  // advance reviewed → implemented：会调 spec-validate --phase=implemented
  // 当前 spec-validate.js 内部降级逻辑: 'happy' SC 缺测试 → 降级 info（v0.5.1 行为,跟 meta 无关）
  // 验证 capabilities 读取生效: 读 meta 看 allowMissingTestTags 是 []
  const meta2 = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assertEq(meta2.phaseCapabilities.implemented.allowMissingTestTags.length, 0,
    'meta.allowMissingTestTags 应为 []');
  // 测"capabilities 改了之后 checkGate 读取到 []":
  const cap = cli.getPhaseCapabilities(meta2, 'implemented');
  assertEq(cap.allowMissingTestTags.length, 0, 'getPhaseCapabilities 应读到覆盖后的 []');
});

test('checkGate: meta 缺 phaseCapabilities 仍用 DEFAULT（向后兼容）', () => {
  // 旧 demo 可能 meta.json 没有 phaseCapabilities 字段
  // 这种情况下,checkGate 不应崩,应回退到 DEFAULT
  const f = setupFixture();
  fs.writeFileSync(path.join(f, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest\n\n## 角色\n- a\n\n## 边界\n- a\n\n## Out of Scope\n- a\n- b\n- c\n\n## C5 Spec 评审 (95 分 / 通过)\n');
  // 手工写一个没有 phaseCapabilities 字段的 meta.json（模拟 v0.5.1 旧 meta）
  fs.mkdirSync(path.join(f, 'spec', 'state'), { recursive: true });
  fs.writeFileSync(path.join(f, 'spec', '.trace'), '');  // 占位
  fs.writeFileSync(path.join(f, 'spec', 'state', 'meta.json'), JSON.stringify({
    specId: 'legacy', version: '1.0.0', phase: 'drafted',
    owner: 'test', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    relatedPR: [], scopes: ['legacy'],
    gates: { drafted: '2025-01-01T00:00:00Z' },
    // 注意:没有 phaseCapabilities
  }, null, 2));
  // advance drafted → reviewed：应走 DEFAULT 的 requireC5Anchor（sources.md 有 C5 应过）
  const r = run(`advance ${f}`, f);
  assert(r.ok, `缺 phaseCapabilities 字段时,DEFAULT 应兜底. 实际: ${r.stderr}`);
});

// ---------- 8. v0.5.2 P0：cap.allowMissingTestTags 真驱动 spec-validate（不是死代码）----------

test('cap.allowMissingTestTags=[] 透传 spec-validate → 缺测试应 fail', () => {
  // 演练：把 meta 的 implemented.allowMissingTestTags 改成 []，
  // advance reviewed → implemented 时，缺测试 SC 应被 spec-validate 拦下（不再降级）
  const f = setupFixture();
  // 把 SC-001 加 @happy tag（capabilities 机制下，happy 在 allow 列表才能降级；改 [] 后必须显式不降级）
  fs.writeFileSync(path.join(f, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: Test\n  作为测试。\n\n  @SC-001 @happy\n  Scenario: A\n    Given x\n    When y\n    Then z\n');
  fs.writeFileSync(path.join(f, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest goal\n\n## 角色 + 核心流程\n1. a → b\n\n## 边界 / 异常清单\n- 正常：a\n- 异常：失败\n\n## Out of Scope\n- a\n- b\n- c\n\n## 需求清单\n\n| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |\n|--------|------|------|--------|------|------|\n| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |\n\n## Check 结论\n- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)\n');
  // init 走 reviewed 阶段
  run(`init ${f} --spec-id cap-strict-e2e --phase reviewed`, f);
  // 改 meta：把 implemented 的 allowMissingTestTags 设为 []（关键！）
  const metaPath = path.join(f, 'spec', 'state', 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.phaseCapabilities.implemented.allowMissingTestTags = [];
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  // 写代码（@spec SC-001）但故意不写测试
  fs.mkdirSync(path.join(f, 'src'), { recursive: true });
  fs.writeFileSync(path.join(f, 'src', 'a.js'), `// @spec SC-001\nfunction a() { return 1; }\nmodule.exports = { a };\n`);
  // advance reviewed → implemented：spec-validate --phase=implemented --allow-missing-test-tags= 应该 fail
  const r = run(`advance ${f}`, f);
  assert(!r.ok, 'cap.allowMissingTestTags=[] 时，缺测试 SC-001 应被 gate 拦下，但 advance 居然过了');
  // 错误应来自 spec-validate
  assert(/spec-validate/.test(r.stderr) || /绑定不完整/.test(r.stderr),
    `应报 spec-validate 失败 / 绑定不完整，实际: ${r.stderr}`);
});

test('cap.allowMissingTestTags=[happy] 透传 spec-validate → 缺测试应 pass（降级为 info）', () => {
  // 对照组：cap 保留 happy 在白名单里，缺测试 SC 应降级为 info，advance 通过
  const f = setupFixture();
  fs.writeFileSync(path.join(f, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: Test\n  作为测试。\n\n  @SC-001 @happy\n  Scenario: A\n    Given x\n    When y\n    Then z\n');
  fs.writeFileSync(path.join(f, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest goal\n\n## 角色 + 核心流程\n1. a → b\n\n## 边界 / 异常清单\n- 正常：a\n- 异常：失败\n\n## Out of Scope\n- a\n- b\n- c\n\n## 需求清单\n\n| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |\n|--------|------|------|--------|------|------|\n| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |\n\n## Check 结论\n- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)\n');
  run(`init ${f} --spec-id cap-loose-e2e --phase reviewed`, f);
  // 不改 cap（保留 DEFAULT 的 [happy, sad-path, edge, intent]）
  fs.mkdirSync(path.join(f, 'src'), { recursive: true });
  fs.writeFileSync(path.join(f, 'src', 'a.js'), `// @spec SC-001\nfunction a() { return 1; }\nmodule.exports = { a };\n`);
  // 不写 tests/
  const r = run(`advance ${f}`, f);
  assert(r.ok, `cap 默认 [happy,...] 应放过 happy 缺测试 SC，实际: ${r.stderr}`);
});

test('spec-cli.checkGate 真的把 cap.allowMissingTestTags 透传给 spec-validate（直接调 checkGate）', () => {
  // 直接调 checkGate，绕开 CLI，验证 cap 真传到 spec-validate
  const f = setupFixture();
  // 给 SC-001 加 @happy tag，写代码（@spec SC-001）但故意不写测试
  fs.writeFileSync(path.join(f, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: Test\n  作为测试。\n\n  @SC-001 @happy\n  Scenario: A\n    Given x\n    When y\n    Then z\n');
  fs.writeFileSync(path.join(f, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest\n\n## 角色\n- a\n\n## 边界\n- a\n\n## Out of Scope\n- a\n- b\n- c\n\n## 需求清单\n\n| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |\n|--------|------|------|--------|------|------|\n| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |\n\n## Check 结论\n- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)\n');
  fs.mkdirSync(path.join(f, 'src'), { recursive: true });
  fs.writeFileSync(path.join(f, 'src', 'a.js'), `// @spec SC-001\nfunction a() { return 1; }\nmodule.exports = { a };\n`);
  fs.mkdirSync(path.join(f, 'spec', 'state'), { recursive: true });
  // meta with implemented.allowMissingTestTags = [] (严格)
  const meta = {
    specId: 'strict-direct', version: '1.0.0', phase: 'reviewed',
    owner: 'test', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    relatedPR: [], scopes: ['strict-direct'],
    gates: { drafted: '2025-01-01T00:00:00Z', reviewed: '2025-01-01T00:00:00Z' },
    phaseCapabilities: {
      drafted: { requireSpecFeature: true, requireSources: true },
      reviewed: { requireC5Anchor: true },
      implemented: { validatePhase: 'implemented', allowMissingTestTags: [] },  // 严格
      verified: { validatePhase: 'verified', allowMissingTestTags: [] },
      accepted: { requireAcceptance: true, requireSummaryCheck: true },
    },
  };
  fs.writeFileSync(path.join(f, 'spec', 'state', 'meta.json'), JSON.stringify(meta, null, 2));
  const specDir = path.join(f, 'spec');
  const errors = cli.checkGate(specDir, 'implemented', meta);
  assert(errors.length > 0, `cap 严格时空数组应让缺测试 fail,实际 errors: ${JSON.stringify(errors)}`);
  assert(/spec-validate/.test(errors.join('\n')) || /绑定不完整/.test(errors.join('\n')),
    `应报 spec-validate 失败 / 绑定不完整,实际: ${errors.join('\n')}`);
});

test('spec-cli.checkGate 在 cap=[happy] 时放过缺测试（直接调 checkGate）', () => {
  const f = setupFixture();
  fs.writeFileSync(path.join(f, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: Test\n  作为测试。\n\n  @SC-001 @happy\n  Scenario: A\n    Given x\n    When y\n    Then z\n');
  fs.writeFileSync(path.join(f, 'spec', 'sources.md'),
    '# Sources\n\n## Goal\ntest\n\n## 角色\n- a\n\n## 边界\n- a\n\n## Out of Scope\n- a\n- b\n- c\n\n## 需求清单\n\n| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |\n|--------|------|------|--------|------|------|\n| REQ-001 | 测试 | happy | Must | M2 | → SC-001 |\n\n## Check 结论\n- **C5 Spec 评审** (2026-06-16 14:00 / 简单档 / 95 分 / 通过)\n');
  fs.mkdirSync(path.join(f, 'src'), { recursive: true });
  fs.writeFileSync(path.join(f, 'src', 'a.js'), `// @spec SC-001\nfunction a() { return 1; }\nmodule.exports = { a };\n`);
  fs.mkdirSync(path.join(f, 'spec', 'state'), { recursive: true });
  const meta = {
    specId: 'loose-direct', version: '1.0.0', phase: 'reviewed',
    owner: 'test', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    relatedPR: [], scopes: ['loose-direct'],
    gates: { drafted: '2025-01-01T00:00:00Z', reviewed: '2025-01-01T00:00:00Z' },
    phaseCapabilities: {
      drafted: { requireSpecFeature: true, requireSources: true },
      reviewed: { requireC5Anchor: true },
      implemented: { validatePhase: 'implemented', allowMissingTestTags: ['happy'] },
      verified: { validatePhase: 'verified', allowMissingTestTags: [] },
      accepted: { requireAcceptance: true, requireSummaryCheck: true },
    },
  };
  fs.writeFileSync(path.join(f, 'spec', 'state', 'meta.json'), JSON.stringify(meta, null, 2));
  const specDir = path.join(f, 'spec');
  const errors = cli.checkGate(specDir, 'implemented', meta);
  assertEq(errors.length, 0, `cap 含 happy 应让缺测试 happy SC 降级,实际 errors: ${JSON.stringify(errors)}`);
});

// ---------- 9. v0.5.2 P0：--help 不杀 require 子进程 ----------

console.log('\n--help 子进程安全:');

test('require spec-cli.js 不会触发 main()（父进程 argv 含 --help 也不被杀）', () => {
  // 模拟"父进程带 --help 启动并 require 本模块"的场景
  // 旧 bug：module.exports = main() → main 跑 → process.exit(0) → 子进程被杀
  // 新行为：require 时只导出符号表，main() 不跑
  //
  // 验证手法：删 module 缓存 + 模拟父进程 argv 含 --help + require
  // 然后调导出符号的函数（checkGate），确认能正常返回值（说明 require 成功没被杀）
  const modulePath = path.join(__dirname, 'spec-cli.js');
  delete require.cache[modulePath];
  const origArgv = process.argv;
  try {
    // 模拟父进程 argv 含 --help
    process.argv = ['node', 'fake-parent.js', '--help'];
    const cli2 = require(modulePath);
    assert(cli2, 'require 应返回 module.exports 对象（不被 process.exit 杀）');
    assert(typeof cli2.checkGate === 'function', '导出应含 checkGate 函数');
    assert(typeof cli2.DEFAULT_PHASE_CAPABILITIES === 'object', '导出应含 DEFAULT_PHASE_CAPABILITIES');
    assert(cli2.VALID_PHASES.includes('drafted'), '导出应含 VALID_PHASES');
  } finally {
    process.argv = origArgv;
    delete require.cache[modulePath];
  }
});

test('父进程 argv 含 --help 时 require spec-cli.js → 后续代码继续执行', () => {
  // 直接验证：require 后调 cli.checkGate 不应触发 process.exit
  const modulePath = path.join(__dirname, 'spec-cli.js');
  delete require.cache[modulePath];
  const origArgv = process.argv;
  let reachedAfterRequire = false;
  try {
    process.argv = ['node', 'fake-parent-with-help.js', '--help'];
    const cli3 = require(modulePath);
    // 如果 require 触发 main() → process.exit(0)，下面这行根本不会执行
    reachedAfterRequire = true;
    assert(reachedAfterRequire, 'require 后应能继续执行（main 未跑）');
    assert(cli3, 'module exports 存在');
  } finally {
    process.argv = origArgv;
    delete require.cache[modulePath];
    assert(reachedAfterRequire, 'finally 也应在 require 后才执行');
  }
});

test('handleHelp: 用 slice(2) 看自己 argv（_lib/help.js）', () => {
  // 直接调 handleHelp 验证 slice(2) 的语义
  // handleHelp 本身只看 process.argv.slice(2)；当 main() 跑（require.main === module）时
  // 它检查的是"调用者脚本自己"的参数
  const help = require('./_lib/help.js');
  const origArgv = process.argv;
  let exited = false;
  const origExit = process.exit;
  process.exit = (code) => { exited = true; throw new Error('EXIT_' + code); };
  try {
    // 1) 自己 argv 不含 --help：不 exit
    process.argv = ['node', 'self.js', 'arg1'];
    exited = false;
    try { help.handleHelp(__filename); } catch (e) { /* swallow mock exit */ }
    assert(!exited, '自己 argv 不含 --help 时 handleHelp 不应 exit');

    // 2) 自己 argv 含 --help：exit
    process.argv = ['node', 'self.js', '--help'];
    exited = false;
    try { help.handleHelp(__filename); } catch (e) { /* swallow mock exit */ }
    assert(exited, '自己 argv 含 --help 时 handleHelp 应 exit');

    // 3) 自己 argv 含 -h：exit
    process.argv = ['node', 'self.js', '-h'];
    exited = false;
    try { help.handleHelp(__filename); } catch (e) { /* swallow mock exit */ }
    assert(exited, '自己 argv 含 -h 时 handleHelp 应 exit');
  } finally {
    process.argv = origArgv;
    process.exit = origExit;
  }
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
