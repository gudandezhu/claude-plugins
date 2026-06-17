'use strict';
/**
 * check-numbering.test.js — N1 单元测试
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, findDuplicates } = require('./check-numbering');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-sentinel-n1-'));
  setup(dir);
  return dir;
}

console.log('check-numbering.test.js');

test('findDuplicates: 无撞车', () => {
  const items = [
    { num: '0001', file: '0001-x.md' },
    { num: '0002', file: '0002-y.md' },
  ];
  assertEqual(findDuplicates(items), []);
});
test('findDuplicates: 撞车 0009', () => {
  const items = [
    { num: '0009', file: '0009-a.md' },
    { num: '0009', file: '0009-b.md' },
  ];
  const dups = findDuplicates(items);
  assertEqual(dups.length, 1);
  assertEqual(dups[0].num, '0009');
  assertEqual(dups[0].files.length, 2);
});
test('findDuplicates: 多撞车', () => {
  const items = [
    { num: '0009', file: '0009-a.md' },
    { num: '0009', file: '0009-b.md' },
    { num: '0009', file: '0009-c.md' },
  ];
  assertEqual(findDuplicates(items).length, 1);
});

test('check: 真实 god 仓库无编号撞车', () => {
  const result = check('.');
  // v0.7.4 大扫除:0009-spec-render 改 0015,0009 不撞了
  assertEqual(result.findings.length, 0, '清理后 0 编号撞车');
});

test('check: 3 位编号残留', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, 'docs', 'rfcs'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', 'rfcs', '001-old.md'), '# x');
  });
  const result = check(repo);
  const f = result.findings.find(x => x.issue.includes('3 位'));
  assertTrue(f, '应报 3 位编号');
});

test('check: 4 位编号无 finding', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, 'docs', 'rfcs'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', 'rfcs', '0001-x.md'), '# x');
    fs.mkdirSync(path.join(d, 'docs', 'adrs'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', 'adrs', '0002-y.md'), '# y');
  });
  const result = check(repo);
  assertEqual(result.findings.length, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);