#!/usr/bin/env node
/**
 * spec-lint.test.js — G13 spec/ 结构守门单元测试
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'spec-lint.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'god-lint-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log('spec-lint.test.js');

// ---------- 1. 空目录 ----------
const tmp1 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp1, 'spec'), { recursive: true });
  let code = 0;
  try { execSync(`node ${SCRIPT} ${tmp1}`, { stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assertEq(code, 0, '空 spec/ 应通过');
} finally { cleanup(tmp1); }
test('空 spec/ 通过', () => {});

// ---------- 2. 完整结构通过 ----------
const tmp2 = tmpProject();
try {
  execSync(`node ${path.join(__dirname, 'init-spec-dir.js')} ${tmp2}`, { stdio: 'pipe' });
  let code = 0;
  try { execSync(`node ${SCRIPT} ${tmp2}`, { stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assertEq(code, 0, 'init 后的结构应通过');
} finally { cleanup(tmp2); }
test('init 后结构通过', () => {});

// ---------- 3. 顶层违规文件 ----------
const tmp3 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp3, 'spec'), { recursive: true });
  fs.writeFileSync(path.join(tmp3, 'spec', 'meta.json'), '{}');
  fs.writeFileSync(path.join(tmp3, 'spec', '.trace'), '');
  fs.writeFileSync(path.join(tmp3, 'spec', 'review.md'), '');
  fs.writeFileSync(path.join(tmp3, 'spec', 'domain.md'), '');
  fs.writeFileSync(path.join(tmp3, 'spec', 'sources-lead-tag.md'), '');
  let stderr = '';
  try { execSync(`node ${SCRIPT} ${tmp3}`, { stdio: 'pipe' }); }
  catch (e) { stderr = e.stderr.toString(); }
  // 5 个违规
  const violations = (stderr.match(/✗ spec\//g) || []).length;
  assertEq(violations, 5, `5 违规（meta.json/.trace/review.md/domain.md/sources-lead-tag.md）`);
} finally { cleanup(tmp3); }
test('顶层违规 5 文件全报', () => {});

// ---------- 4. state/ 内违规 ----------
const tmp4 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp4, 'spec', 'state'), { recursive: true });
  fs.writeFileSync(path.join(tmp4, 'spec', 'state', 'extra.json'), '{}');
  let stderr = '';
  try { execSync(`node ${SCRIPT} ${tmp4}`, { stdio: 'pipe' }); }
  catch (e) { stderr = e.stderr.toString(); }
  assert(stderr.includes('state/extra.json'), '应报 state/extra.json');
} finally { cleanup(tmp4); }
test('state/ 内多余文件报错', () => {});

// ---------- 5. domain/ 内违规 ----------
const tmp5 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp5, 'spec', 'domain'), { recursive: true });
  fs.writeFileSync(path.join(tmp5, 'spec', 'domain', 'lead-scoring.md'), '');
  let stderr = '';
  try { execSync(`node ${SCRIPT} ${tmp5}`, { stdio: 'pipe' }); }
  catch (e) { stderr = e.stderr.toString(); }
  assert(stderr.includes('domain/lead-scoring.md'), '应报 domain/lead-scoring.md');
} finally { cleanup(tmp5); }
test('domain/ 内多余文件报错（AI 误建 feature-level）', () => {});

// ---------- 6. review/ 允许任意日期文件 ----------
const tmp6 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp6, 'spec', 'review'), { recursive: true });
  fs.writeFileSync(path.join(tmp6, 'spec', 'review', 'review-2026-06-15.md'), '');
  fs.writeFileSync(path.join(tmp6, 'spec', 'review', 'review-2026-06-16.md'), '');
  let code = 0;
  try { execSync(`node ${SCRIPT} ${tmp6}`, { stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assertEq(code, 0, 'review/ 多个 review-<date>.md 应通过');
} finally { cleanup(tmp6); }
test('review/ 任意日期文件通过', () => {});

// ---------- 7. 子目录嵌套禁止 ----------
const tmp7 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp7, 'spec', 'review', 'subdir'), { recursive: true });
  let stderr = '';
  try { execSync(`node ${SCRIPT} ${tmp7}`, { stdio: 'pipe' }); }
  catch (e) { stderr = e.stderr.toString(); }
  assert(stderr.includes('禁止嵌套子目录'), '应报 review/ 下嵌套');
} finally { cleanup(tmp7); }
test('review/ 下嵌套子目录报错', () => {});

// ---------- 8. spec/ 不存在 ----------
const tmp8 = tmpProject();
try {
  let stderr = '';
  try { execSync(`node ${SCRIPT} ${tmp8}`, { stdio: 'pipe' }); }
  catch (e) { stderr = e.stderr.toString(); }
  assert(stderr.includes('spec/ 目录不存在'), '应报 spec/ 不存在');
} finally { cleanup(tmp8); }
test('spec/ 不存在报错', () => {});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}
