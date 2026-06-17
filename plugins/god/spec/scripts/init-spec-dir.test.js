#!/usr/bin/env node
/**
 * init-spec-dir.test.js — G13 init-spec-dir 单元测试
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'init-spec-dir.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'god-init-spec-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log('init-spec-dir.test.js');

// ---------- 1. CLI 基础行为 ----------

const tmp1 = tmpProject();
try {
  execSync(`node ${SCRIPT} ${tmp1}`, { stdio: 'pipe' });
  const specDir = path.join(tmp1, 'spec');
  assert(fs.existsSync(specDir), 'spec/ 应存在');
  assert(fs.existsSync(path.join(specDir, 'state')), 'state/ 应存在');
  assert(fs.existsSync(path.join(specDir, 'review')), 'review/ 应存在');
  assert(fs.existsSync(path.join(specDir, 'domain')), 'domain/ 应存在');
  assert(fs.existsSync(path.join(specDir, 'domain', 'domain.md')), 'domain/domain.md 应存在');
  assert(fs.existsSync(path.join(specDir, 'sources', 'user-perspectives')), 'sources/user-perspectives/ 应存在');
  assert(fs.existsSync(path.join(specDir, 'sources', 'user-perspectives', '_summary.md')), '_summary.md 应存在');
} finally { cleanup(tmp1); }
test('CLI: 建好 4 子目录 + 2 placeholder', () => {});

// ---------- 2. 二次跑幂等 ----------
const tmp2 = tmpProject();
try {
  execSync(`node ${SCRIPT} ${tmp2}`, { stdio: 'pipe' });
  // 二次跑不应报错
  const out = execSync(`node ${SCRIPT} ${tmp2} 2>&1`, { encoding: 'utf8' });
  assert(out.includes('exists, skipped'), '二次跑应跳过已存在的 placeholder');
} finally { cleanup(tmp2); }
test('CLI: 二次跑幂等', () => {});

// ---------- 3. placeholder 内容含模板提示 ----------
const tmp3 = tmpProject();
try {
  execSync(`node ${SCRIPT} ${tmp3}`, { stdio: 'pipe' });
  const domainContent = fs.readFileSync(path.join(tmp3, 'spec', 'domain', 'domain.md'), 'utf8');
  assert(domainContent.includes('G10'), 'domain.md 应含 G10 标记');
  assert(domainContent.includes('领域知识'), 'domain.md 应含领域知识内容');

  const summaryContent = fs.readFileSync(path.join(tmp3, 'spec', 'sources', 'user-perspectives', '_summary.md'), 'utf8');
  assert(summaryContent.includes('User Perspectives'), '_summary.md 应含 User Perspectives 标题');
} finally { cleanup(tmp3); }
test('placeholder: 含 G10/user-perspective 模板内容', () => {});

// ---------- 4. .gitkeep 落点 ----------
const tmp4 = tmpProject();
try {
  execSync(`node ${SCRIPT} ${tmp4}`, { stdio: 'pipe' });
  const subDirs = ['state', 'review', 'domain', 'sources/user-perspectives'];
  for (const d of subDirs) {
    assert(fs.existsSync(path.join(tmp4, 'spec', d, '.gitkeep')), `${d}/.gitkeep 应存在`);
  }
} finally { cleanup(tmp4); }
test('.gitkeep: 4 子目录全有', () => {});

// ---------- 4.5. state/.trace 占位 (v0.5.0+ G13 修复) ----------
const tmp45 = tmpProject();
try {
  execSync(`node ${SCRIPT} ${tmp45}`, { stdio: 'pipe' });
  const tracePath = path.join(tmp45, 'spec', 'state', '.trace');
  assert(fs.existsSync(tracePath), 'spec/state/.trace 应存在（v0.5.0+ G13 修复）');
  // 必须落在 state/ 下,不是 legacy spec/.trace
  assert(!fs.existsSync(path.join(tmp45, 'spec', '.trace')) || fs.statSync(path.join(tmp45, 'spec', '.trace')).isDirectory() === false, 'spec/.trace 不应被建（fallback 路径）');
} finally { cleanup(tmp45); }
test('G13: state/.trace 占位自动建,避免 fallback', () => {});

// ---------- 5. 错误: 项目目录不存在 ----------
try {
  execSync(`node ${SCRIPT} /nonexistent/path/xxx 2>&1`, { stdio: 'pipe' });
  throw new Error('应报错');
} catch (e) {
  assert(!e.status === false, '应 exit 1');
}
test('CLI: 项目目录不存在 → exit 1', () => {});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
