'use strict';
/**
 * check-frontmatter.test.js — F1 单元测试
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, parseFrontmatter, autoFix } = require('./check-frontmatter');

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-sentinel-f1-'));
  setup(dir);
  return dir;
}

console.log('check-frontmatter.test.js');

test('parseFrontmatter: 标准格式', () => {
  const fm = parseFrontmatter('---\nname: foo\nstatus: stable\n---\n# body');
  assertEqual(fm.fields.name, 'foo');
  assertEqual(fm.fields.status, 'stable');
});
test('parseFrontmatter: 无 frontmatter', () => {
  assertEqual(parseFrontmatter('# body'), null);
});
test('parseFrontmatter: 引号 strip', () => {
  const fm = parseFrontmatter('---\nname: "foo bar"\n---\n');
  assertEqual(fm.fields.name, 'foo bar');
});

test('check: 真实 god 仓库检测 41+ 个缺 status', () => {
  const result = check('.');
  // v0.7.1 已批量给所有 SKILL.md/commands.md 加 status: stable
  // v0.7.2 又给 USER-GUIDE.md / commands/doc-sentinel.md 加 frontmatter
  // 真实期望：能跑通；finding 数因文档增长会漂移，不锁死
  // "应有 finding" 路径由 tmpRepo 场景（缺 frontmatter 的 SKILL.md）覆盖
  assertTrue(Array.isArray(result.findings), 'result.findings 应是数组');
  assertTrue(result.findings.length < 100, `finding 数应 <100（防全仓扫错），实际 ${result.findings.length}`);
});

test('check: 已有 status 不报', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, 'skills', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(d, 'skills', 'foo', 'SKILL.md'), '---\nname: foo\nstatus: stable\n---\n# body');
  });
  const result = check(repo);
  assertEqual(result.findings.length, 0);
});

test('check: 骨架文件跳过', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, 'skills', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(d, 'skills', 'foo', 'SKILL.md'),
      '---\nname: foo\n---\n# 当前为骨架，待填充');
  });
  const result = check(repo);
  assertEqual(result.findings.length, 0);
});

test('autoFix: 给无 frontmatter 文件加 status', () => {
  const repo = makeTmpRepo((d) => {
    fs.mkdirSync(path.join(d, 'skills', 'foo'), { recursive: true });
    const f = path.join(d, 'skills', 'foo', 'SKILL.md');
    fs.writeFileSync(f, '---\nname: foo\n---\n# body');
    return f;
  });
  const skillFile = path.join(repo, 'skills', 'foo', 'SKILL.md');
  assertTrue(autoFix(skillFile));
  const content = fs.readFileSync(skillFile, 'utf8');
  assertTrue(/status:\s*stable/.test(content));
});

test('autoFix: 给有 frontmatter 但缺 status 的文件加 status', () => {
  const repo = makeTmpRepo(() => {});
  const f = path.join(repo, 'test.md');
  fs.writeFileSync(f, '---\nname: x\n---\n# body');
  assertTrue(autoFix(f));
  const content = fs.readFileSync(f, 'utf8');
  assertTrue(/status:\s*stable/.test(content), '应含 status: stable');
  assertTrue(/name: x/.test(content), '应保留 name: x');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);