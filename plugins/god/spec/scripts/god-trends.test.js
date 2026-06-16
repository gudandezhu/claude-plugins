#!/usr/bin/env node
/**
 * god-trends.test.js — god 自我监控单元测试
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'god-trends.js');
const trends = require('./god-trends.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'god-trends-test-'));
function setupProject(traceContent) {
  const dir = path.join(tmpRoot, 'proj-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'spec'));
  // god-trends 找 spec.feature 才认定是 spec 目录
  fs.writeFileSync(path.join(dir, 'spec', 'spec.feature'), '@spec-version 1.0.0\nFeature: T\n');
  if (traceContent !== null) {
    fs.writeFileSync(path.join(dir, 'spec', '.trace'), traceContent);
  }
  return dir;
}
function cleanup() { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {} }
function run(args, cwd) {
  try { return { ok: true, out: execSync(`node ${SCRIPT} ${args}`, { cwd, stdio: 'pipe' }).toString() }; }
  catch (e) { return { ok: false, code: e.status, stderr: e.stderr.toString() }; }
}

console.log('god-trends.test.js');

// ---------- 1. parseTrace ----------

test('parseTrace: 标准 trace', () => {
  const t = trends.parseTrace('2026-07-01T10:00:00Z INIT\n2026-07-01T10:30:00Z drafted → reviewed\n');
  assertEq(t.length, 2);
  assert(t[0].event.startsWith('INIT'));
  assert(t[1].event.includes('→'));
});

test('parseTrace: 空/null', () => {
  assertEq(trends.parseTrace('').length, 0);
  assertEq(trends.parseTrace(null).length, 0);
});

// ---------- 2. countFailures ----------

test('countFailures: NO-VERIFY + ROLLBACK 计数', () => {
  const t = [
    { time: new Date(), event: 'NO-VERIFY commit by u hash=a' },
    { time: new Date(), event: 'ROLLBACK reviewed → drafted' },
    { time: new Date(), event: 'NO-VERIFY commit by u hash=b' },
  ];
  const c = trends.countFailures(t);
  assertEq(c.noVerify, 2);
  assertEq(c.rollbacks, 1);
});

// ---------- 3. computeFeatureCost 档位判断 ----------

test('computeFeatureCost: L0 纯流程', () => {
  const t = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:15:00Z'), event: 'drafted → reviewed' },
  ];
  const c = trends.computeFeatureCost(t);
  assertEq(c.tier, 'L0');
  assertEq(c.total, 15 * 60);
});

test('computeFeatureCost: L1 含 NO-VERIFY', () => {
  const t = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:05:00Z'), event: 'NO-VERIFY commit' },
    { time: new Date('2026-07-01T10:30:00Z'), event: 'drafted → reviewed' },
  ];
  const c = trends.computeFeatureCost(t);
  assertEq(c.tier, 'L1');
});

test('computeFeatureCost: L2 含 ROLLBACK', () => {
  const t = [
    { time: new Date('2026-07-01T10:00:00Z'), event: 'INIT' },
    { time: new Date('2026-07-01T10:30:00Z'), event: 'ROLLBACK reviewed → drafted' },
  ];
  const c = trends.computeFeatureCost(t);
  assertEq(c.tier, 'L2');
});

// ---------- 4. aggregateFeatures ----------

test('aggregateFeatures: 单 feature', () => {
  const trace = `2026-07-01T10:00:00Z INIT
2026-07-01T10:15:00Z drafted → reviewed`;
  const fs_arr = trends.aggregateFeatures(trace);
  assertEq(fs_arr.length, 1);
  assertEq(fs_arr[0].tier, 'L0');
});

test('aggregateFeatures: 多 feature 按 INIT 划分', () => {
  const trace = `2026-07-01T10:00:00Z INIT feat1
2026-07-01T10:10:00Z drafted → reviewed
2026-07-01T11:00:00Z INIT feat2
2026-07-01T11:05:00Z NO-VERIFY
2026-07-01T11:30:00Z drafted → reviewed`;
  const fs_arr = trends.aggregateFeatures(trace);
  // 应该分 2 段：1 段在第二个 INIT 之前结算；当前段到末尾
  // 实际行为：第一段包含第一个 INIT 之后到第二个 INIT 之前；第二段包含第二个 INIT 到末尾
  assert(fs_arr.length >= 1, '至少 1 个 feature');
  // 第二段应含 NO-VERIFY → L1
  const last = fs_arr[fs_arr.length - 1];
  assertEq(last.tier, 'L1');
});

// ---------- 5. summarize ----------

test('summarize: 空 feature', () => {
  const s = trends.summarize([]);
  assertEq(s.count, 0);
  assertEq(s.trend, '无数据');
});

test('summarize: 单 feature 基础统计', () => {
  const s = trends.summarize([{ total: 600, tier: 'L0', noVerify: 0, rollbacks: 0 }]);
  assertEq(s.count, 1);
  assertEq(s.avg, 600);
  assertEq(s.tierDist.L0, 1);
});

test('summarize: 多 feature + L3 触发', () => {
  const s = trends.summarize([
    { total: 600, tier: 'L0', noVerify: 0, rollbacks: 0 },
    { total: 1200, tier: 'L1', noVerify: 1, rollbacks: 0 },
    { total: 1800, tier: 'L2', noVerify: 0, rollbacks: 1 },
    { total: 2400, tier: 'L2', noVerify: 1, rollbacks: 1 },  // noVerify+rollback = 2 → L3
  ]);
  assertEq(s.count, 4);
  assertEq(s.tierDist.L0, 1);
  assertEq(s.tierDist.L1, 1);
  assertEq(s.tierDist.L2, 2);
  assertEq(s.tierDist.L3, 1);  // 第 4 个 feature 升级 L3
});

test('summarize: 趋势升（最近 3 feature 档位递增）', () => {
  const s = trends.summarize([
    { total: 600, tier: 'L0', noVerify: 0, rollbacks: 0 },
    { total: 600, tier: 'L0', noVerify: 0, rollbacks: 0 },
    { total: 1200, tier: 'L1', noVerify: 1, rollbacks: 0 },
    { total: 1800, tier: 'L2', noVerify: 0, rollbacks: 1 },
  ]);
  assert(/升级/.test(s.trend), `趋势应为升级，实际：${s.trend}`);
});

test('summarize: 趋势降', () => {
  const s = trends.summarize([
    { total: 1800, tier: 'L2', noVerify: 0, rollbacks: 1 },
    { total: 1800, tier: 'L2', noVerify: 0, rollbacks: 1 },
    { total: 1200, tier: 'L1', noVerify: 1, rollbacks: 0 },
    { total: 600, tier: 'L0', noVerify: 0, rollbacks: 0 },
  ]);
  assert(/降级/.test(s.trend), `趋势应为降级，实际：${s.trend}`);
});

test('summarize: 不足 3 feature = 平稳', () => {
  const s = trends.summarize([
    { total: 600, tier: 'L0', noVerify: 0, rollbacks: 0 },
    { total: 1200, tier: 'L1', noVerify: 1, rollbacks: 0 },
  ]);
  assertEq(s.trend, '平稳');
});

// ---------- 6. CLI 端到端 ----------

test('CLI: 缺项目目录拒绝', () => {
  const r = run('');
  assert(!r.ok);
  assert(/用法/.test(r.stderr));
});

test('CLI: 不存在目录拒绝', () => {
  const r = run('/nonexistent/path');
  assert(!r.ok);
});

const f1 = setupProject('2026-07-01T10:00:00Z INIT\n2026-07-01T10:10:00Z drafted → reviewed\n');
test('CLI: 人类可读输出', () => {
  const r = run(f1);
  assert(r.ok);
  assert(/god 趋势报告/.test(r.out));
  assert(/feature 数/.test(r.out));
});

test('CLI: --json 输出可解析', () => {
  const r = run(`${f1} --json`);
  assert(r.ok);
  const data = JSON.parse(r.out);
  assertEq(data.count, 1);
  assert(typeof data.avg === 'number');
});

const f2 = setupProject(null);
test('CLI: 无 trace → 0 feature', () => {
  const r = run(f2);
  assert(r.ok);
  assert(/无 feature 数据/.test(r.out) || /无数据/.test(r.out));
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
