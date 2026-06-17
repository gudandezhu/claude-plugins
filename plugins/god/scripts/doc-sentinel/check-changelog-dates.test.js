'use strict';
/**
 * check-changelog-dates.test.js — C1 单元测试
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, parseVersions } = require('./check-changelog-dates');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-sentinel-c1-'));
  setup(dir);
  return dir;
}

console.log('check-changelog-dates.test.js');

test('parseVersions: 多版本解析', () => {
  const content = `## v0.1.0 (2026-06-15)
- a
## v0.2.0 (2026-06-16)
- b`;
  const vs = parseVersions(content);
  assertEqual(vs.length, 2);
  assertEqual(vs[0].version, '0.1.0');
  assertEqual(vs[0].date, '2026-06-15');
});

test('parseVersions: 无版本号返回空', () => {
  const vs = parseVersions('# nothing');
  assertEqual(vs, []);
});

test('check: CHANGELOG 不存在', () => {
  const repo = makeTmpRepo(() => {});
  const result = check(repo);
  const f = result.findings.find(x => x.issue.includes('不存在'));
  assertTrue(f);
});

test('check: 单版本无 finding', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', 'CHANGELOG.md'), '## v0.1.0 (2026-06-16)\n');
  });
  const result = check(repo);
  assertEqual(result.findings.length, 0);
});

test('check: 真实 god 仓库 CHANGELOG 同日但不报（git log 真实日期就是同日）', () => {
  const result = check('.');
  // 真实情况: 5 个版本都标 2026-06-16 但 git log 真实日期也是 2026-06-16
  // C1 不应该报（与 plan 阶段预期 "C1 3 finding" 不同的真实情况）
  assertTrue(result.findings.length === 0, `真实 god 仓应 0 finding，实际 ${result.findings.length}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);