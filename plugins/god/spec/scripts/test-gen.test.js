#!/usr/bin/env node
/**
 * test-gen.test.js — G6 spec → 测试桩单元测试
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'test-gen.js');
const tg = require('./test-gen.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-gen-test-'));
function setupProject(opts = {}) {
  const dir = path.join(tmpRoot, 'proj-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'spec'));
  fs.writeFileSync(path.join(dir, 'spec', 'spec.feature'),
    `@spec-version 1.0.0
Feature: Test
  作为测试。

  @SC-001 @happy
  Scenario: 健康 lead 显示高分
    Given lead 7 天内被联系
    When 计算健康分
    Then 分数 >= 80

  @SC-002 @sad-path
  Scenario: 30 天未联系 lead 降权
    Given lead 30 天内未被联系
    When 计算健康分
    Then 分数 <= 50
`);
  fs.writeFileSync(path.join(dir, 'spec', 'sources.md'),
    '# Test Feature\n\n## 需求清单\n\n| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |\n|---|---|---|---|---|---|\n| REQ-001 | a | b | c | d | → SC-001 |\n');
  if (opts.meta) {
    fs.writeFileSync(path.join(dir, 'spec', 'meta.json'),
      JSON.stringify({ specId: 'my-feat', version: '1.0.0' }, null, 2));
  }
  if (opts.ts) fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  if (opts.framework) {
    if (opts.framework === 'vitest') fs.writeFileSync(path.join(dir, 'vitest.config.js'), 'export default {}');
    if (opts.framework === 'jest') fs.writeFileSync(path.join(dir, 'jest.config.js'), 'module.exports = {}');
  }
  return dir;
}
function cleanup() { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {} }
function run(args, cwd) {
  try { return { ok: true, out: execSync(`node ${SCRIPT} ${args}`, { cwd, stdio: 'pipe' }).toString() }; }
  catch (e) { return { ok: false, code: e.status, stderr: e.stderr.toString() }; }
}

console.log('test-gen.test.js');

// ---------- 1. parseScenarios ----------

test('parseScenarios: 解析 SC + tags + GWT', () => {
  const sc = tg.parseScenarios(fs.readFileSync('demo/lead-scoring/spec/spec.feature', 'utf8'));
  assertEq(sc.length, 2);
  assertEq(sc[0].id, 'SC-001');
  assert(sc[0].tags.includes('happy'), '应含 happy');
  assert(!sc[0].tags.includes('sad-path'), '不应含 sad-path');
  assert(sc[1].tags.includes('sad-path'), 'SC-002 应含 sad-path');
  assertEq(sc[0].gwt.length, 3);
});

// ---------- 2. detectFramework ----------

test('detectFramework: vitest.config.js 优先', () => {
  const dir = setupProject({ framework: 'vitest' });
  assertEq(tg.detectFramework(dir), 'vitest');
});

test('detectFramework: jest.config.js', () => {
  const dir = setupProject({ framework: 'jest' });
  assertEq(tg.detectFramework(dir), 'jest');
});

test('detectFramework: package.json devDependencies', () => {
  const dir = setupProject();
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
  assertEq(tg.detectFramework(dir), 'vitest');
});

test('detectFramework: 无配置默认 vitest', () => {
  const dir = setupProject();
  assertEq(tg.detectFramework(dir), 'vitest');
});

// ---------- 3. generateTestStub ----------

test('generateTestStub: vitest 用 import', () => {
  const sc = [{ id: 'SC-001', tags: ['happy'], name: 'A', gwt: [{ keyword: 'Given', text: 'x' }] }];
  const { code } = tg.generateTestStub(sc, 'feat', 'vitest', false);
  assert(code.includes("from 'vitest'"), '应有 vitest import');
  assert(code.includes("import * as feat"), '应有 feat import');
  assert(code.includes("it('SC-001: A'"), '应有 it 调用');
  assert(code.includes("describe('feat'"), '应有 describe');
});

test('generateTestStub: jest 用 require', () => {
  const sc = [{ id: 'SC-001', tags: ['happy'], name: 'A', gwt: [] }];
  const { code } = tg.generateTestStub(sc, 'feat', 'jest', false);
  assert(code.includes("require('@jest/globals')"), '应 require jest globals');
  assert(code.includes("require('../src/feat.js')"), '应 require feat');
});

test('generateTestStub: @sad-path 用 it.todo', () => {
  const sc = [
    { id: 'SC-001', tags: ['happy'], name: 'Normal', gwt: [] },
    { id: 'SC-002', tags: ['sad-path'], name: 'Sad', gwt: [] },
  ];
  const { code } = tg.generateTestStub(sc, 'feat', 'vitest', false);
  assert(code.includes("it('SC-001: Normal'"), 'normal 用 it');
  assert(code.includes("it.todo('SC-002: Sad'"), 'sad-path 用 it.todo');
});

test('generateTestStub: 多 SC 顺序输出', () => {
  const sc = [
    { id: 'SC-001', tags: ['happy'], name: 'A', gwt: [] },
    { id: 'SC-002', tags: ['happy'], name: 'B', gwt: [] },
    { id: 'SC-003', tags: ['happy'], name: 'C', gwt: [] },
  ];
  const { code } = tg.generateTestStub(sc, 'feat', 'vitest', false);
  const a = code.indexOf('SC-001');
  const b = code.indexOf('SC-002');
  const c = code.indexOf('SC-003');
  assert(a < b && b < c, 'SC 顺序应保持');
});

test('generateTestStub: GWT 注释注入函数体', () => {
  const sc = [{ id: 'SC-001', tags: ['happy'], name: 'T', gwt: [
    { keyword: 'Given', text: 'x' },
    { keyword: 'Then', text: 'y' },
  ] }];
  const { code } = tg.generateTestStub(sc, 'feat', 'vitest', false);
  assert(code.includes('//   Given: x'));
  assert(code.includes('//   Then: y'));
});

// ---------- 4. CLI 端到端 ----------

test('CLI: 缺项目目录拒绝', () => {
  const r = run('');
  assert(!r.ok);
  assert(/用法/.test(r.stderr));
});

test('CLI: 不存在目录拒绝', () => {
  const r = run('/nonexistent');
  assert(!r.ok);
});

test('CLI: 找不到 spec 拒绝', () => {
  const dir = path.join(tmpRoot, 'no-spec-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir);
  const r = run(dir);
  assert(!r.ok);
  assert(/spec/.test(r.stderr));
});

const f1 = setupProject({ meta: true });
test('CLI: 正常路径产 tests/<feature>.spec.js', () => {
  const r = run(f1);
  assert(r.ok, `test-gen 失败: ${r.stderr}`);
  assert(fs.existsSync(path.join(f1, 'tests', 'my-feat.spec.js')), '应产 spec.js');
});

test('CLI: 默认拒绝覆盖', () => {
  const r = run(f1);
  assert(!r.ok);
  assert(/已存在/.test(r.stderr));
});

test('CLI: --force 覆盖', () => {
  const r = run(`${f1} --force`);
  assert(r.ok);
});

const f2 = setupProject();
test('CLI: --dry-run 不写文件', () => {
  const r = run(`${f2} --dry-run`);
  assert(r.ok);
  assert(/dry-run/.test(r.out));
  assert(!fs.existsSync(path.join(f2, 'tests')), '不应写文件');
});

const f3 = setupProject();
test('CLI: --framework jest 强制', () => {
  const r = run(`${f3} --framework jest --force`);
  assert(r.ok);
  const code = fs.readFileSync(path.join(f3, 'tests', 'test-feature.spec.js'), 'utf8');
  assert(code.includes('require(\'@jest/globals\')'), '应用 jest');
});

const f4 = setupProject({ ts: true });
test('CLI: TS 项目产 .spec.ts', () => {
  const r = run(f4);
  assert(r.ok);
  assert(fs.existsSync(path.join(f4, 'tests', 'test-feature.spec.ts')), '应产 .spec.ts');
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
