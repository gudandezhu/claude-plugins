#!/usr/bin/env node
/**
 * install-hooks.test.js — hooks 集成单元测试
 *
 * 跑法: node spec/scripts/install-hooks.test.js
 * 退出: 0 全过 / 1 有失败
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'install-hooks.js');
const ih = require('./install-hooks.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'install-hooks-test-'));
function setupProject() {
  const dir = path.join(tmpRoot, 'proj-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.git', 'hooks'), { recursive: true });
  return dir;
}
function cleanup() { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {} }
function run(args, cwd) {
  try { return { ok: true, out: execSync(`node ${SCRIPT} ${args}`, { cwd, stdio: 'pipe' }).toString() }; }
  catch (e) { return { ok: false, code: e.status, stderr: e.stderr.toString() }; }
}

console.log('install-hooks.test.js');

// ---------- 1. 正常安装 ----------

const f1 = setupProject();
test('正常安装：复制 3 个 hook + 合并 settings.json', () => {
  const r = run(f1);
  assert(r.ok, `install 失败: ${r.stderr}`);
  assert(fs.existsSync(path.join(f1, '.git', 'hooks', 'pre-commit')), 'pre-commit 应存在');
  assert(fs.existsSync(path.join(f1, '.git', 'hooks', 'post-commit')), 'post-commit 应存在');
  assert(fs.existsSync(path.join(f1, '.git', 'hooks', 'session-end')), 'session-end 应存在');
  assert(fs.existsSync(path.join(f1, '.claude', 'settings.json')), 'settings.json 应存在');
});

// ---------- 2. 权限位 ----------

test('复制后 hook 有 +x 权限', () => {
  const stat = fs.statSync(path.join(f1, '.git', 'hooks', 'pre-commit'));
  assert((stat.mode & 0o111) !== 0, 'pre-commit 应可执行');
});

test('hook 内容含 god 标识', () => {
  const content = fs.readFileSync(path.join(f1, '.git', 'hooks', 'pre-commit'), 'utf8');
  assert(content.includes('god pre-commit'), '应含 god 标识');
});

// ---------- 3. settings.json 合并 ----------

test('settings.json 含 hooks.PreToolUse 段', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(f1, '.claude', 'settings.json'), 'utf8'));
  assert(settings.hooks, '应有 hooks 段');
  assert(Array.isArray(settings.hooks.PreToolUse), 'PreToolUse 应是数组');
  assert(settings.hooks.PreToolUse.length === 1, '应有 1 个 entry');
  assert(settings.hooks.PreToolUse[0].hooks[0].command.includes('pre-commit'), 'command 应指 pre-commit');
});

test('settings.json 含 PostToolUse + SessionEnd 段', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(f1, '.claude', 'settings.json'), 'utf8'));
  assert(settings.hooks.PostToolUse, '应有 PostToolUse');
  assert(settings.hooks.SessionEnd, '应有 SessionEnd');
});

// ---------- 4. 不覆盖用户已有 hook ----------

const f2 = setupProject();
fs.writeFileSync(path.join(f2, '.git', 'hooks', 'pre-commit'), '#!/bin/bash\n# 用户已有 hook\necho "user hook"\n');
fs.chmodSync(path.join(f2, '.git', 'hooks', 'pre-commit'), 0o755);

test('不覆盖：保留用户 hook + 追加 god 逻辑', () => {
  const r = run(f2);
  assert(r.ok, `install 失败: ${r.stderr}`);
  const content = fs.readFileSync(path.join(f2, '.git', 'hooks', 'pre-commit'), 'utf8');
  assert(content.includes('user hook'), '用户 hook 应保留');
  assert(content.includes('god-hook-marker'), 'god 标识应追加');
  assert(content.includes('god pre-commit'), 'god 逻辑应追加');
});

// ---------- 5. 重复安装：去重 ----------

test('重复安装：检测已含 god hook 跳过', () => {
  const r = run(f1);
  assert(r.ok);
  const stat = fs.statSync(path.join(f1, '.git', 'hooks', 'pre-commit'));
  const mtimeBefore = stat.mtimeMs;
  // 等 100ms 保证 mtime 能区分
  setTimeout(() => {
    const r2 = run(f1);
    assert(r2.ok);
    const stat2 = fs.statSync(path.join(f1, '.git', 'hooks', 'pre-commit'));
    // 第二次不应该重写（mtime 不变）
    assert(stat2.mtimeMs === mtimeBefore, '重复 install 不应重写 hook');
  }, 100);
});

// ---------- 6. 现有 settings.json 合并 ----------

const f3 = setupProject();
fs.mkdirSync(path.join(f3, '.claude'), { recursive: true });
fs.writeFileSync(path.join(f3, '.claude', 'settings.json'),
  JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'user-cmd' }] }] } })
);

test('合并：保留用户已有 PreToolUse 段 + 追加 god', () => {
  const r = run(f3);
  assert(r.ok, `install 失败: ${r.stderr}`);
  const settings = JSON.parse(fs.readFileSync(path.join(f3, '.claude', 'settings.json'), 'utf8'));
  assert(settings.hooks.PreToolUse.length === 2, '应有 2 个 entry（用户 + god）');
  assert(settings.hooks.PreToolUse[0].hooks[0].command === 'user-cmd', '用户 entry 保留');
  assert(settings.hooks.PreToolUse[1].hooks[0].command.includes('pre-commit'), 'god entry 追加');
});

// ---------- 7. --force 覆盖 ----------

const f4 = setupProject();
fs.writeFileSync(path.join(f4, '.git', 'hooks', 'pre-commit'), '#!/bin/bash\n# 用户旧 hook\n');
fs.chmodSync(path.join(f4, '.git', 'hooks', 'pre-commit'), 0o755);

test('--force 覆盖用户 hook', () => {
  const r = run(`${f4} --force`);
  assert(r.ok, `install 失败: ${r.stderr}`);
  const content = fs.readFileSync(path.join(f4, '.git', 'hooks', 'pre-commit'), 'utf8');
  assert(!content.includes('用户旧 hook'), '旧 hook 应被覆盖');
  assert(content.includes('god pre-commit'), 'god hook 应写入');
});

// ---------- 8. 非 git 目录 ----------

const f5 = path.join(tmpRoot, 'no-git-' + Math.random().toString(36).slice(2, 8));
fs.mkdirSync(f5);

test('非 git 目录默认拒绝（不自动建 .git/）', () => {
  const r = run(f5);
  assert(!r.ok, '应失败');
  assert(/\.git\/hooks\//.test(r.stderr), '应报 .git/hooks/ 缺');
});

test('--allow-mkdir-git 允许建 .git/hooks/', () => {
  const r = run(`${f5} --allow-mkdir-git`);
  assert(r.ok, `install 失败: ${r.stderr}`);
  assert(fs.existsSync(path.join(f5, '.git', 'hooks', 'pre-commit')), 'pre-commit 应存在');
});

// ---------- 9. 缺项目目录 ----------

test('缺项目目录拒绝', () => {
  const r = run('/nonexistent/path');
  assert(!r.ok);
  assert(/不存在/.test(r.stderr));
});

test('无参数显示用法', () => {
  const r = run('');
  assert(!r.ok);
  assert(/用法/.test(r.stderr));
});

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
