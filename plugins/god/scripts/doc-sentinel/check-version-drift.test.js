'use strict';
/**
 * check-version-drift.test.js — V1 单元测试
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, compareSemver, bumpType } = require('./check-version-drift');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    fail++;
  }
}
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg || 'assertTrue failed');
}

function makeTmpRepo(setup) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-sentinel-v1-'));
  setup(dir);
  return dir;
}

console.log('check-version-drift.test.js');

test('compareSemver: 0.1.0 < 0.4.1', () => {
  assertTrue(compareSemver('0.1.0', '0.4.1') < 0);
});
test('compareSemver: 1.0.0 > 0.9.9', () => {
  assertTrue(compareSemver('1.0.0', '0.9.9') > 0);
});
test('compareSemver: 0.5.0 == 0.5.0', () => {
  assertEqual(compareSemver('0.5.0', '0.5.0'), 0);
});

test('bumpType: 0.1.0 → 0.4.1 = MINOR', () => {
  assertEqual(bumpType('0.1.0', '0.4.1'), 'MINOR');
});
test('bumpType: 0.1.0 → 0.1.1 = PATCH', () => {
  assertEqual(bumpType('0.1.0', '0.1.1'), 'PATCH');
});
test('bumpType: 0.1.0 → 1.0.0 = MAJOR', () => {
  assertEqual(bumpType('0.1.0', '1.0.0'), 'MAJOR');
});

test('check: 空仓库报 plugin.json 缺失', () => {
  const repo = makeTmpRepo(() => {});
  const result = check(repo);
  const f = result.findings.find(x => x.file === '.claude-plugin/plugin.json');
  assertTrue(f, '应报 plugin.json 缺失');
});

test('check: 落后版本报 warning', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(d, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '0.1.0' }));
    fs.mkdirSync(path.join(d, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', 'CHANGELOG.md'), '## v0.4.1 (2026-06-16)\n');
  });
  const result = check(repo);
  const f = result.findings.find(x => x.file === '.claude-plugin/plugin.json' && x.issue.includes('落后'));
  assertTrue(f, '应报 plugin.json 落后');
});

test('check: README 骨架被识别', () => {
  const repo = makeTmpRepo((d) => {
    fs.writeFileSync(path.join(d, 'README.md'), '当前为骨架，功能待填充。');
  });
  const result = check(repo);
  const f = result.findings.find(x => x.file === 'README.md' && x.issue.includes('骨架'));
  assertTrue(f, '应报 README 骨架');
});

test('check: 多版本同日被识别', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', 'CHANGELOG.md'),
      '## v0.1.0 (2026-06-16)\n## v0.2.0 (2026-06-16)\n## v0.3.0 (2026-06-16)\n');
  });
  const result = check(repo);
  const f = result.findings.find(x => x.issue.includes('同日'));
  assertTrue(f, '应报同日');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);