#!/usr/bin/env node
/**
 * install-hooks.js — 把 god hooks 装到项目侧
 *
 * 用法: node spec/scripts/install-hooks.js <项目目录>
 *
 * 行为：
 *   1. 复制 templates/hooks/pre-commit.sh → <项目>/.git/hooks/pre-commit
 *   2. 复制 templates/hooks/session-end.sh → <项目>/.git/hooks/session-end
 *   3. 复制 templates/hooks/post-commit-no-verify.sh → <项目>/.git/hooks/post-commit
 *   4. 合并（或创建）<项目>/.claude/settings.json 的 hooks 段
 *   5. **不覆盖**已有 hook（追加到现有命令链）
 *   6. chmod +x 所有 hook
 *
 * 救命场景：用户可用 --force 覆盖（不推荐；写一行到 god 自身 .trace）
 *
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATES_DIR = path.join(PLUGIN_ROOT, 'templates', 'hooks');

const HOOKS = [
  { src: 'pre-commit.sh', dest: 'pre-commit', event: 'PreToolUse' },
  { src: 'post-commit-no-verify.sh', dest: 'post-commit', event: 'PostToolUse' },
  { src: 'session-end.sh', dest: 'session-end', event: 'SessionEnd' },
];

function copyHook(projectDir, hook, opts) {
  const srcPath = path.join(TEMPLATES_DIR, hook.src);
  const destDir = path.join(projectDir, '.git', 'hooks');
  const destPath = path.join(destDir, hook.dest);

  if (!fs.existsSync(srcPath)) {
    console.error(`✗ 模板不存在 ${srcPath}`);
    return false;
  }
  if (!fs.existsSync(destDir)) {
    if (opts.allowMkdirGit) {
      fs.mkdirSync(destDir, { recursive: true });
    } else {
      console.error(`✗ .git/hooks/ 不存在（项目 ${projectDir} 不是 git 仓库？）`);
      return false;
    }
  }
  if (fs.existsSync(destPath) && !opts.force) {
    // 不覆盖：追加 god 标记的 wrapper
    const existing = fs.readFileSync(destPath, 'utf8');
    if (existing.includes('# god-hook-marker')) {
      console.log(`  ✓ ${hook.dest} 已含 god hook（跳过）`);
      return true;
    }
    // 追加 wrapper：在现有 hook 末尾追加 god 逻辑
    const godSnippet = `\n# god-hook-marker\n# god hook appended by install-hooks.js (--force 覆盖模式未启用)\n${fs.readFileSync(srcPath, 'utf8')}\n`;
    fs.appendFileSync(destPath, godSnippet);
    fs.chmodSync(destPath, 0o755);
    console.log(`  ✓ ${hook.dest} 已追加 god 逻辑`);
  } else {
    fs.copyFileSync(srcPath, destPath);
    fs.chmodSync(destPath, 0o755);
    console.log(`  ✓ ${hook.dest} 已复制`);
  }
  return true;
}

function mergeSettingsJson(projectDir, hook, opts) {
  const settingsPath = path.join(projectDir, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      console.error(`✗ .claude/settings.json 解析失败：${e.message}`);
      return false;
    }
  }
  settings.hooks = settings.hooks || {};
  settings.hooks[hook.event] = settings.hooks[hook.event] || [];

  // 检查是否已含 god hook（用 marker 标识）
  const godMarker = '# god-hook-marker';
  const hasGod = settings.hooks[hook.event].some(entry =>
    JSON.stringify(entry).includes(godMarker)
  );
  if (hasGod && !opts.force) {
    console.log(`  ✓ .claude/settings.json ${hook.event} 已含 god hook（跳过）`);
    return true;
  }

  // 追加 god hook 段
  const godHookEntry = {
    hooks: [{
      type: 'command',
      command: `${path.join(projectDir, '.git', 'hooks', hook.dest)}`,
      _comment: godMarker,
    }],
  };
  settings.hooks[hook.event].push(godHookEntry);

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log(`  ✓ .claude/settings.json ${hook.event} 段已更新`);
  return true;
}

function main() {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    const { printHelp } = require('./_lib/help');
    printHelp(__filename);
    process.exit(0);
  }
  const projectDir = process.argv[2];
  if (!projectDir) {
    console.error('用法: node install-hooks.js <项目目录> [--force] [--allow-mkdir-git]');
    process.exit(1);
  }
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }
  const opts = {
    force: process.argv.includes('--force'),
    allowMkdirGit: process.argv.includes('--allow-mkdir-git'),
  };

  console.log(`[install-hooks] 项目: ${projectDir}`);
  console.log(`[install-hooks] 模式: ${opts.force ? 'FORCE 覆盖' : '安全追加'}`);

  let allOk = true;
  for (const hook of HOOKS) {
    if (!copyHook(projectDir, hook, opts)) allOk = false;
    if (!mergeSettingsJson(projectDir, hook, opts)) allOk = false;
  }

  if (allOk) {
    console.log('\n[install-hooks] ✓ 全部 hook 安装完成');
    console.log('[install-hooks] 验证：git commit 看 pre-commit 输出');
    console.log('[install-hooks] 救命：git commit --no-verify（写 .trace 留痕）');
  } else {
    console.error('\n[install-hooks] ✗ 部分 hook 安装失败');
    process.exit(1);
  }
}

if (require.main !== module) {
  module.exports = { HOOKS, copyHook, mergeSettingsJson };
} else {
  main();
}
