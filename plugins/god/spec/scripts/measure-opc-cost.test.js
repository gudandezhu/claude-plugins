#!/usr/bin/env node
/**
 * measure-opc-cost.test.js — D5 OPC 成本归因单元测试
 *
 * 跑法: node spec/scripts/measure-opc-cost.test.js
 * 退出: 0 全过 / 1 有失败
 *
 * 测试覆盖：
 *   - 3 档判断（L0/L1/L2）
 *   - 5 维拆解
 *   - inBudget 判断
 *   - 边界情况：trace 空 / 仅 INIT
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'measure-opc-cost.js');
const cost = require('./measure-opc-cost.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-opc-cost-test-'));
function setupFixture(traceContent, specContent) {
  const dir = path.join(tmpRoot, 'spec-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'spec'));
  if (traceContent !== null) {
    fs.writeFileSync(path.join(dir, 'spec', '.trace'), traceContent);
  }
  if (specContent) {
    fs.writeFileSync(path.join(dir, 'spec', 'spec.feature'), specContent);
  }
  return dir;
}
function cleanup() { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {} }
function run(args, cwd) {
  try { return { ok: true, out: execSync(`node ${SCRIPT} ${args}`, { cwd, stdio: 'pipe' }).toString() }; }
  catch (e) { return { ok: false, code: e.status, stderr: e.stderr.toString(), out: (e.stdout||'').toString() }; }
}

const SPEC = '@spec-version 1.0.0\nFeature: T\n  @SC-001 @happy\n  Scenario: A\n    Given x\n    When y\n    Then z\n';

console.log('measure-opc-cost.test.js');

// ---------- 1. parseTrace ----------

test('parseTrace: 解析标准 trace 行', () => {
  const trace = cost.parseTrace('2026-07-01T10:00:00Z INIT specId=test\n2026-07-01T10:05:00Z drafted → reviewed\n');
  assertEq(trace.length, 2, 'line count');
  assert(trace[0].event.startsWith('INIT'), 'first event');
  assert(trace[1].event.includes('→'), 'second event has arrow');
});

test('parseTrace: 空文件返回空数组', () => {
  const trace = cost.parseTrace('');
  assertEq(trace.length, 0);
});

test('parseTrace: null 返回空数组', () => {
  const trace = cost.parseTrace(null);
  assertEq(trace.length, 0);
});

// ---------- 2. countFailures ----------

test('countFailures: NO-VERIFY + ROLLBACK 计数', () => {
  const trace = [
    { time: new Date(), event: 'INIT' },
    { time: new Date(), event: 'drafted → reviewed' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=abc' },
    { time: new Date(), event: 'ROLLBACK reviewed → drafted | reason: bad' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=def' },
  ];
  const c = cost.countFailures(trace);
  assertEq(c.noVerify, 2);
  assertEq(c.rollbacks, 1);
});

// ---------- 2.5. Bug #1 fix: NO-VERIFY 演练/真崩点 分类 ----------

test('countFailures: 5 演练 NO-VERIFY + 1 真 NO-VERIFY → noVerifyReal=1, noVerifyRehearsal=5', () => {
  // 第一轮演练真实场景:5 次 NO-VERIFY 是"故意破环→拦截→还原"演练,1 次是真 bug fix
  // 旧算法会算 6 * 15 = 90min 崩点修复(虚高),fix 后只算 1 * 15 = 15min
  const trace = [
    { time: new Date(), event: 'INIT' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=a | reason: 演练破环' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=b | reason: rehearsal: simulate f-03' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=c | reason: test-only: hook fixture' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=d | reason: test-fix: gen stub' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=e | reason: 破环演练' },
    { time: new Date(), event: 'NO-VERIFY commit by user hash=f' },  // 真崩点,无 reason
  ];
  const c = cost.countFailures(trace);
  assertEq(c.noVerify, 6, '总 NO-VERIFY 6');
  assertEq(c.noVerifyReal, 1, '真崩点 1');
  assertEq(c.noVerifyRehearsal, 5, '演练豁免 5');
});

test('computeCost: Bug #1 fix — 5 演练 NO-VERIFY + 1 真崩点 → fixes=15min(非 90min)', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:02:00Z'), event: 'NO-VERIFY commit by user hash=a | reason: 演练破环' },
    { time: new Date('2026-07-01T10:04:00Z'), event: 'NO-VERIFY commit by user hash=b | reason: rehearsal' },
    { time: new Date('2026-07-01T10:06:00Z'), event: 'NO-VERIFY commit by user hash=c | reason: test-only' },
    { time: new Date('2026-07-01T10:08:00Z'), event: 'NO-VERIFY commit by user hash=d | reason: test-fix' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'NO-VERIFY commit by user hash=e | reason: 破环' },
    { time: new Date('2026-07-01T10:12:00Z'), event: 'NO-VERIFY commit by user hash=f' },  // 真崩点
    { time: new Date('2026-07-01T10:20:00Z'), event: 'drafted → reviewed' },
  ];
  const c = cost.computeCost(trace);
  // 旧算法 = 6 * 15min = 5400s = 90min
  // 新算法 = 1 * 15min = 900s = 15min
  assertEq(c.fixes, 15 * 60, 'fixes 应为 15min(只算 1 真崩点)');
  assertEq(c.noVerifyReal, 1, 'tier 判断只看真崩点');
  assertEq(c.noVerifyRehearsal, 5, '5 个演练被豁免');
  assertEq(c.tier, 'L1', 'tier = L1(因 1 真崩��),非 L1(因 6 误算)');
});

test('computeCost: 纯演练无真崩点 → tier=L0', () => {
  // 6 个 NO-VERIFY 全部是演练(不升级档位)
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:02:00Z'), event: 'NO-VERIFY commit by user hash=a | reason: 演练' },
    { time: new Date('2026-07-01T10:04:00Z'), event: 'NO-VERIFY commit by user hash=b | reason: 破环演练' },
    { time: new Date('2026-07-01T10:06:00Z'), event: 'NO-VERIFY commit by user hash=c | reason: rehearsal' },
    { time: new Date('2026-07-01T10:08:00Z'), event: 'NO-VERIFY commit by user hash=d | reason: test-only' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'NO-VERIFY commit by user hash=e | reason: test-fix' },
    { time: new Date('2026-07-01T10:12:00Z'), event: 'NO-VERIFY commit by user hash=f | reason: exercise' },
    { time: new Date('2026-07-01T10:20:00Z'), event: 'drafted → reviewed' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.fixes, 0, '纯演练 = fixes 0min');
  assertEq(c.tier, 'L0', '纯演练 = tier L0(不升级档位)');
  assertEq(c.noVerifyRehearsal, 6);
  assertEq(c.noVerifyReal, 0);
});

test('CLI: --json 含 noVerifyReal/noVerifyRehearsal 字段', () => {
  const traceContent = '2026-07-01T10:00:00Z INIT specId=test\n2026-07-01T10:02:00Z NO-VERIFY commit by user hash=a | reason: 演练\n2026-07-01T10:04:00Z NO-VERIFY commit by user hash=b | reason: 破环\n2026-07-01T10:06:00Z NO-VERIFY commit by user hash=c\n2026-07-01T10:20:00Z drafted → reviewed\n';
  const dir = setupFixture(traceContent, SPEC);
  const r = run(`${dir} --json`);
  assert(r.ok, `cli 应 exit 0: ${r.stderr}`);
  const data = JSON.parse(r.out);
  assertEq(data.noVerify, 3, '总 3');
  assertEq(data.noVerifyReal, 1, '真崩点 1');
  assertEq(data.noVerifyRehearsal, 2, '演练豁免 2');
  assertEq(data.tier, 'L1', 'tier L1');
});

// ---------- 3. computeCost L0 档 ----------

test('computeCost: L0 纯流程（无崩点）', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'drafted → reviewed' },
    { time: new Date('2026-07-01T10:25:00Z'), event: 'reviewed → implemented' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.tier, 'L0', 'tier');
  assert(c.inBudget, 'inBudget');
  assertEq(c.total, 25 * 60, 'total 25min');
});

test('computeCost: L1 含 1 次 NO-VERIFY', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'drafted → reviewed' },
    { time: new Date('2026-07-01T10:11:00Z'), event: 'NO-VERIFY commit by user hash=abc' },
    { time: new Date('2026-07-01T10:30:00Z'), event: 'reviewed → implemented' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.tier, 'L1', 'tier L1');
  assertEq(c.noVerify, 1);
});

test('computeCost: L2 含 1 次 ROLLBACK', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:30:00Z'), event: 'drafted → reviewed' },
    { time: new Date('2026-07-01T11:00:00Z'), event: 'ROLLBACK reviewed → drafted | reason: spec 错' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.tier, 'L2', 'tier L2');
  assertEq(c.rollbacks, 1);
});

test('computeCost: 5 维拆解 sum 到 total', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:15:00Z'), event: 'drafted → reviewed' },
    { time: new Date('2026-07-01T10:45:00Z'), event: 'reviewed → implemented' },
  ];
  const c = cost.computeCost(trace);
  // prd (15min) + dev (30min) + test = total (45min) → test = 0
  assertEq(c.total, 45 * 60, 'total');
  assertEq(c.prd, 15 * 60, 'prd');
  assertEq(c.dev, 30 * 60, 'dev');
  assert(c.test >= 0, 'test non-negative');
});

test('computeCost: trace 空 → L0 + 0', () => {
  const c = cost.computeCost([]);
  assertEq(c.tier, 'L0');
  assertEq(c.total, 0);
  assert(c.inBudget);
});

test('computeCost: 仅 INIT 无 advance → message 提示缺失', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT specId=test' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.tier, 'L0');
  assert(/缺失/.test(c.message), '应提示缺失');
});

// ---------- 4. inBudget 判断 ----------

test('inBudget: L0 + 20min = true', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:20:00Z'), event: 'drafted → reviewed' },
  ];
  const c = cost.computeCost(trace);
  assert(c.inBudget, '20min in L0 30min budget');
});

test('inBudget: L1 + 60min = true（边界）', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:30:00Z'), event: 'NO-VERIFY commit by user hash=a' },
    { time: new Date('2026-07-01T11:00:00Z'), event: 'drafted → reviewed' },
  ];
  const c = cost.computeCost(trace);
  assert(c.inBudget, '60min in L1 60min budget（边界含等）');
});

test('inBudget: L1 + 70min = false', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:05:00Z'), event: 'NO-VERIFY commit by user hash=a' },
    { time: new Date('2026-07-01T11:10:00Z'), event: 'drafted → reviewed' },
  ];
  const c = cost.computeCost(trace);
  assert(!c.inBudget, '70min 超 L1 60min');
});

// ---------- 5. CLI 端到端 ----------

const f1 = setupFixture(
  '2026-07-01T10:00:00Z INIT specId=test phase=drafted\n2026-07-01T10:10:00Z drafted → reviewed\n',
  SPEC
);
test('CLI: 人类可读输出', () => {
  const r = run(f1);
  assert(r.ok);
  assert(/OPC 介入成本归因/.test(r.out), '应有报告标题');
  assert(/L0/.test(r.out), '应有档位');
});

const f2 = setupFixture(
  '2026-07-01T10:00:00Z INIT specId=test phase=drafted\n2026-07-01T10:05:00Z NO-VERIFY commit by u hash=a\n2026-07-01T10:30:00Z drafted → reviewed\n',
  SPEC
);
test('CLI: --json 输出可解析', () => {
  const r = run(`${f2} --json`);
  assert(r.ok);
  const data = JSON.parse(r.out);
  assertEq(data.tier, 'L1', 'tier');
  assertEq(data.noVerify, 1);
});

// ---------- 6. 边界 ----------

test('CLI: 缺项目目录拒绝', () => {
  const r = run('');
  assert(!r.ok);
  assert(/用法/.test(r.stderr));
});

test('CLI: 非 spec 项目拒绝', () => {
  const f3 = path.join(tmpRoot, 'no-spec');
  fs.mkdirSync(f3);
  const r = run(f3);
  assert(!r.ok);
  assert(/spec/.test(r.stderr));
});

// ---------- 7. RFC-0013 G18: S 事件归因 ----------

test('G18: S reject-spec 计入 L2 + 翻脸成本', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'drafted → reviewed' },
    { time: new Date('2026-07-01T10:20:00Z'), event: 'reviewed → implemented (S1 accept)' },
    { time: new Date('2026-07-01T10:30:00Z'), event: 'implemented → drafted (S2 reject-spec)' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.tier, 'L2', 'S2 reject-spec 应升 L2');
  assertEq(c.sRejectSpec, 1, 'sRejectSpec 应记 1');
  // 翻脸成本 = 1 × 20min = 1200s
  assertEq(c.redo, 20 * 60, '翻脸成本应算 1 次');
});

test('G18: S reject-impl 计入 L1 + 崩点成本', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'drafted → reviewed' },
    { time: new Date('2026-07-01T10:20:00Z'), event: 'implemented → reviewed (S2 reject-impl)' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.tier, 'L1', 'S2 reject-impl 应升 L1');
  assertEq(c.sRejectImpl, 1);
  // 崩点成本 = 1 × 15min = 900s
  assertEq(c.fixes, 15 * 60, '崩点成本应算 1 次');
});

test('G18: S reject-spec + NO-VERIFY 累计算翻脸 + 崩点', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'NO-VERIFY commit by user hash=abc' },
    { time: new Date('2026-07-01T10:20:00Z'), event: 'implemented → drafted (S2 reject-spec)' },
  ];
  const c = cost.computeCost(trace);
  assertEq(c.tier, 'L2', 'S reject-spec 决定档位');
  assertEq(c.noVerifyReal, 1);
  assertEq(c.sRejectSpec, 1);
  // 崩点(900s) + 翻脸(1200s) = 2100s
  assertEq(c.fixes, 15 * 60);
  assertEq(c.redo, 20 * 60);
});

test('G18: countFailures 区分 S reject-spec / reject-impl / reject', () => {
  const trace = [
    { time: new Date(), event: 'phase1 → phase2 (S1 reject-spec)' },
    { time: new Date(), event: 'phase2 → phase3 (S2 reject-impl)' },
    { time: new Date(), event: 'phase3 → phase4 (S3 reject)' },
    { time: new Date(), event: 'phase4 → phase5 (S1 accept)' },
  ];
  const r = cost.countFailures(trace);
  assertEq(r.sRejectSpec, 1);
  assertEq(r.sRejectImpl, 1);
  assertEq(r.sRejectOther, 1, 'S3 reject 无后缀应算 other');
  assertEq(r.sAccept, 1);
});

test('G18: formatHuman 输出含 S reject-spec / S reject-impl 段', () => {
  const fakeCost = {
    total: 1500, prd: 300, dev: 600, test: 600,
    fixes: 900, redo: 1200,
    tier: 'L2', inBudget: true, budgetSec: 5400,
    noVerify: 1, noVerifyReal: 1, noVerifyRehearsal: 0, rollbacks: 0,
    sRejectSpec: 1, sRejectImpl: 0, sRejectOther: 0,
    message: '✓ in budget',
  };
  const out = cost.formatHuman(fakeCost);
  assert(/S reject-spec/.test(out), `应含 S reject-spec 段,实际: ${out}`);
  assert(/S reject-impl/.test(out), `应含 S reject-impl 段,实际: ${out}`);
});

// ---------- 8. Gap 3 回归: S1 reject (无 -spec/-impl 后缀) 计入翻脸 ----------
// 旧实现: countFailures 把 "S1 reject" 归 sRejectOther,但 redo 只算 sRejectSpec → 漏算翻脸决策
// 新实现: sRejectOther 也计入 redo + 升级 tier 到 L2
test('Gap 3 回归: S1 reject 计入翻脸决策(redo) + tier L2', () => {
  const trace = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT specId=test' },
    { time: new Date('2026-07-01T10:10:00Z'), event: 'drafted → reviewed' },
    // sign-gate.js 实际写 trace 格式: reviewed (S1 reject) → reviewed (prd 内部处置)
    { time: new Date('2026-07-01T10:20:00Z'), event: 'reviewed (S1 reject) → reviewed (prd 内部处置)' },
  ];
  const c = cost.computeCost(trace);
  // 旧: redo=0, tier=L0 → 漏算翻脸
  // 新: redo=1*20min=1200s, tier=L2(S1 reject = OPC 主观拒签 spec = 翻脸)
  assertEq(c.redo, 20 * 60, 'redo 应含 1 次 S1 reject 翻脸(20min)');
  assertEq(c.tier, 'L2', 'tier 应升 L2(OPC 主观拒签)');
  assertEq(c.sRejectOther, 1, 'sRejectOther 应记 1');
  // 报告输出验证:含"翻脸"关键词 + "1 S reject"
  const fakeCost = { ...c, noVerify: 0, noVerifyReal: 0, noVerifyRehearsal: 0, rollbacks: 0 };
  const out = cost.formatHuman(fakeCost);
  assert(/翻脸/.test(out), `formatHuman 应含"翻脸"段,实际: ${out}`);
  assert(/1 S reject(?!-)/.test(out), `formatHuman 应含 "1 S reject"(无后缀),实际: ${out}`);
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
