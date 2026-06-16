#!/usr/bin/env node
/**
 * dev-gen.test.js — G5 spec → 代码骨架单元测试
 *
 * 跑法: node spec/scripts/dev-gen.test.js
 * 退出: 0 全过 / 1 有失败
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'dev-gen.js');
const dg = require('./dev-gen.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-gen-test-'));
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
    '# Test Feature\n\n## 需求清单\n\n| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |\n|---|---|---|---|---|---|\n| REQ-001 | a | b | c | d | → SC-001 |\n\n## Goal\ntest\n');
  if (opts.meta) {
    fs.writeFileSync(path.join(dir, 'spec', 'meta.json'),
      JSON.stringify({ specId: 'my-feat', version: '1.0.0' }, null, 2));
  }
  if (opts.ts) {
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  }
  return dir;
}
function cleanup() { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {} }
function run(args, cwd) {
  try { return { ok: true, out: execSync(`node ${SCRIPT} ${args}`, { cwd, stdio: 'pipe' }).toString() }; }
  catch (e) { return { ok: false, code: e.status, stderr: e.stderr.toString() }; }
}

console.log('dev-gen.test.js');

// ---------- 1. parseFeatureScenarios ----------

test('parseFeatureScenarios: 解析 2 SC', () => {
  // fixture 内联,避免被 god 自带 demo 演进影响（lead-scoring 演进到 4 SC）
  const fixture = `@spec-version 1.0.0
Feature: Test
  description

  @SC-001 @happy
  Scenario: 健康 lead 显示高分
    Given a
    When b
    Then c

  @SC-002 @sad-path
  Scenario: 30 天未联系 lead 降权
    Given d
    When e
    Then f
`;
  const sc = dg.parseFeatureScenarios(fixture);
  assertEq(sc.length, 2, 'scenario count');
  assertEq(sc[0].id, 'SC-001');
  assertEq(sc[0].name, '健康 lead 显示高分');
  assertEq(sc[0].gwt.length, 3, 'GWT steps');
  assertEq(sc[0].gwt[0].keyword, 'Given');
});

test('parseFeatureScenarios: 空 spec 返回空数组', () => {
  const sc = dg.parseFeatureScenarios('@spec-version 1.0.0\nFeature: Empty\n');
  assertEq(sc.length, 0);
});

test('parseFeatureScenarios: And/But 关键字识别', () => {
  const content = `
@SC-001 @happy
Scenario: Test
  Given x
  And y
  But z
  When w
  Then result
`;
  const sc = dg.parseFeatureScenarios(content);
  assertEq(sc[0].gwt.length, 5);
  assertEq(sc[0].gwt[1].keyword, 'And');
});

// ---------- 2. getFeatureSlug ----------

test('getFeatureSlug: 从 meta.json specId 取', () => {
  const dir = setupProject({ meta: true });
  const specDir = path.join(dir, 'spec');
  const slug = dg.getFeatureSlug(specDir, { specId: 'Lead Scoring' });
  assertEq(slug, 'lead-scoring');
});

test('getFeatureSlug: meta 无时从 sources.md H1 取', () => {
  const dir = setupProject();
  const specDir = path.join(dir, 'spec');
  const slug = dg.getFeatureSlug(specDir, null);
  assertEq(slug, 'test-feature', '从 H1 "Test Feature" 派生');
});

test('getFeatureSlug: 全无时 fallback', () => {
  const dir = setupProject();
  fs.unlinkSync(path.join(dir, 'spec', 'sources.md'));
  const specDir = path.join(dir, 'spec');
  const slug = dg.getFeatureSlug(specDir, null);
  assertEq(slug, 'feature');
});

// ---------- 3. isTypeScriptProject ----------

test('isTypeScriptProject: 有 tsconfig.json = true', () => {
  const dir = setupProject({ ts: true });
  assert(dg.isTypeScriptProject(dir), '应识别为 TS');
});

test('isTypeScriptProject: 无 tsconfig.json = false', () => {
  const dir = setupProject();
  assert(!dg.isTypeScriptProject(dir), '应识别为 JS');
});

// ---------- 4. generateSkeleton ----------

test('generateSkeleton: JS 输出 function 关键字', () => {
  const scenarios = [
    { id: 'SC-001', name: 'Test A', gwt: [{ keyword: 'Given', text: 'x' }] },
  ];
  const { code, ext } = dg.generateSkeleton(scenarios, 'test', false);
  assertEq(ext, 'js');
  assert(code.includes('function sc1()'), '应有 function sc1');
  assert(code.includes('@spec SC-001'), '应有 @spec 标注');
});

test('generateSkeleton: TS 输出 export function', () => {
  const scenarios = [
    { id: 'SC-001', name: 'Test A', gwt: [] },
  ];
  const { code, ext } = dg.generateSkeleton(scenarios, 'test', true);
  assertEq(ext, 'ts');
  assert(code.includes('export function sc1()'), '应有 export function');
});

test('generateSkeleton: 多 SC 输出多函数', () => {
  const scenarios = [
    { id: 'SC-001', name: 'A', gwt: [] },
    { id: 'SC-002', name: 'B', gwt: [] },
    { id: 'SC-003', name: 'C', gwt: [] },
  ];
  const { code } = dg.generateSkeleton(scenarios, 'test', false);
  assert(code.includes('function sc1()'), 'sc1');
  assert(code.includes('function sc2()'), 'sc2');
  assert(code.includes('function sc3()'), 'sc3');
});

test('generateSkeleton: 函数体含 TODO + GWT', () => {
  const scenarios = [
    { id: 'SC-001', name: 'Test', gwt: [
      { keyword: 'Given', text: 'x' },
      { keyword: 'When', text: 'y' },
    ] },
  ];
  const { code } = dg.generateSkeleton(scenarios, 'test', false);
  assert(code.includes('TODO: implement SC-001'), '应有 TODO');
  assert(code.includes('//   Given: x'), '应有 GWT 注释');
  assert(code.includes('//   When: y'));
});

// ---------- 5. CLI 端到端 ----------

test('CLI: 缺项目目录拒绝', () => {
  const r = run('');
  assert(!r.ok);
  assert(/用法/.test(r.stderr));
});

test('CLI: 不存在目录拒绝', () => {
  const r = run('/nonexistent/path');
  assert(!r.ok);
});

test('CLI: 找不到 spec 拒绝', () => {
  const dir = path.join(tmpRoot, 'no-spec');
  fs.mkdirSync(dir);
  const r = run(dir);
  assert(!r.ok);
  assert(/spec/.test(r.stderr));
});

const f1 = setupProject({ meta: true });
test('CLI: 正常路径产 src/<feature>.js', () => {
  const r = run(f1);
  assert(r.ok, `dev-gen 失败: ${r.stderr}`);
  assert(fs.existsSync(path.join(f1, 'src', 'my-feat.js')), '应产出 src/my-feat.js');
});

test('CLI: 默认拒绝覆盖', () => {
  const r = run(f1);
  assert(!r.ok);
  assert(/已存在/.test(r.stderr));
});

test('CLI: --force 覆盖', () => {
  const r = run(`${f1} --force`);
  assert(r.ok, `force 失败: ${r.stderr}`);
});

const f2 = setupProject();
test('CLI: --dry-run 不写文件', () => {
  const r = run(`${f2} --dry-run`);
  assert(r.ok);
  assert(/dry-run/.test(r.out));
  assert(!fs.existsSync(path.join(f2, 'src')), '不应写文件');
});

const f3 = setupProject({ ts: true });
test('CLI: TS 项目产 .ts', () => {
  const r = run(f3);
  assert(r.ok);
  assert(fs.existsSync(path.join(f3, 'src', 'test-feature.ts')), '应产 .ts');
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
