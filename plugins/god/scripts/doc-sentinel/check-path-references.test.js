'use strict';
/**
 * check-path-references.test.js — P1 单元测试
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, extractMdRefs, extractCodePaths } = require('./check-path-references');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-sentinel-p1-'));
  setup(dir);
  return dir;
}

console.log('check-path-references.test.js');

test('extractMdRefs: 提取 .md 引用', () => {
  const refs = extractMdRefs('see [foo](docs/x.md) and [bar](y.md)');
  assertEqual(refs.sort(), ['docs/x.md', 'y.md']);
});
test('extractMdRefs: 跳过 http:// 链接', () => {
  const refs = extractMdRefs('see [foo](https://example.com/x.md) and [bar](y.md)');
  assertEqual(refs, ['y.md']);
});
test('extractMdRefs: 跳过 # 锚点', () => {
  const refs = extractMdRefs('see [foo](#section)');
  assertEqual(refs, []);
});

test('extractCodePaths: 提取 scripts/ 路径', () => {
  const refs = extractCodePaths('see scripts/foo.js and spec/scripts/bar.js');
  assertEqual(refs.sort(), ['scripts/foo.js', 'spec/scripts/bar.js']);
});

test('check: 真实 god 仓库检测失效路径', () => {
  const result = check('.');
  assertTrue(result.findings.length > 0, '应报 ≥1 个失效路径');
});

test('check: 全部路径有效无 finding', () => {
  const repo = makeTmpRepo((d) => {
    fs.writeFileSync(path.join(d, 'a.md'), 'see [b](b.md)');
    fs.writeFileSync(path.join(d, 'b.md'), 'see [a](a.md)');
  });
  const result = check(repo);
  assertEqual(result.findings.length, 0);
});

test('check: 单向失效被报', () => {
  const repo = makeTmpRepo((d) => {
    fs.writeFileSync(path.join(d, 'a.md'), 'see [b](b.md)');
  });
  const result = check(repo);
  const f = result.findings.find(x => x.issue.includes('b.md'));
  assertTrue(f, '应报 b.md 失效');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);