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

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
