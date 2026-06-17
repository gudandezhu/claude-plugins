'use strict';
/**
 * report-format.test.js — 巡检报告 schema 单元测试
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { newCheck, addFinding, markAutoFixed, summarize, writeRunFile, listRuns, readLastRun } = require('./report-format');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); fail++; }
}
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(cond, msg) { if (!cond) throw new Error(msg || 'assertTrue failed'); }

function makeTmpRepo(setup) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-sentinel-rf-'));
  setup(dir);
  return dir;
}

console.log('report-format.test.js');

test('newCheck: 默认 status=ok, findings=[]', () => {
  const c = newCheck('X1', 'test');
  assertEqual(c.id, 'X1');
  assertEqual(c.name, 'test');
  assertEqual(c.status, 'ok');
  assertEqual(c.findings, []);
});

test('addFinding: status 自动 ok → warn', () => {
  const c = newCheck('X1', 'test');
  addFinding(c, { file: 'a.md', issue: 'x', fix: 'y' });
  assertEqual(c.status, 'warn');
  assertEqual(c.findings.length, 1);
  assertEqual(c.findings[0].auto_fixed, false);
});

test('markAutoFixed: 标记 finding 已修复', () => {
  const c = newCheck('X1', 'test');
  addFinding(c, { file: 'a.md', issue: 'x', fix: 'y' });
  markAutoFixed(c, 'a.md', 'y');
  assertTrue(c.findings[0].auto_fixed);
});

test('summarize: 统计 ok/warn/fail/skip/auto_fixed', () => {
  const c1 = newCheck('A', 'a');
  const c2 = newCheck('B', 'b');
  addFinding(c2, { file: 'x', issue: 'i', fix: 'f' });
  markAutoFixed(c2, 'x', 'f');
  const c3 = newCheck('C', 'c');
  c3.status = 'fail';
  const s = summarize([c1, c2, c3]);
  assertEqual(s.total, 3);
  assertEqual(s.ok, 1);
  assertEqual(s.warn, 1);
  assertEqual(s.fail, 1);
  assertEqual(s.auto_fixed_count, 1);
});

test('writeRunFile + readLastRun: 写读报告', () => {
  const repo = makeTmpRepo(() => {});
  const report = {
    timestamp: '2026-06-16T10:00:00.000Z',
    duration_ms: 100,
    checks: [newCheck('V1', 'v')],
    summary: { total: 1, ok: 1, warn: 0, fail: 0, skip: 0, auto_fixed_count: 0 },
  };
  const filePath = writeRunFile(report, repo);
  assertTrue(fs.existsSync(filePath));
  const last = readLastRun(repo);
  assertEqual(last.timestamp, '2026-06-16T10:00:00.000Z');
});

test('listRuns: 多报告降序', () => {
  const repo = makeTmpRepo(() => {});
  for (const ts of ['2026-06-16T10:00:00Z', '2026-06-16T11:00:00Z', '2026-06-16T12:00:00Z']) {
    const report = {
      timestamp: ts,
      duration_ms: 0,
      checks: [],
      summary: { total: 0, ok: 0, warn: 0, fail: 0, skip: 0, auto_fixed_count: 0 },
    };
    writeRunFile(report, repo);
  }
  const runs = listRuns(repo);
  assertEqual(runs.length, 3);
  assertTrue(runs[0].includes('12-00-00'), '最新应排第一');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);