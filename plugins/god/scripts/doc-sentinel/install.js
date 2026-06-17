#!/usr/bin/env node
/**
 * install.js — 在项目准备 doc-sentinel（v0.7.2+ 不再写 .claude/settings.json 钩子）
 *
 * v0.7.2 起：调度由 CC CronCreate 接管，install.js 只负责：
 *   1. 写 .god/doc-sentinel.json（enable）
 *   2. 清理 v0.7.0/v0.7.1 残留的 SessionStart doc-sentinel 钩子（防御性）
 *   3. 创建 docs/doc-sentinel/runs/ 目录
 *
 * 不再：
 *   - 注册 SessionStart 钩子（命令层做调度，install 不沾）
 *   - 写 .claude/settings.json（CC CronCreate 自管）
 *
 * 用法: node install.js <cwd>
 * 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.2 段
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { enable, isProjectRoot } = require('./config');

const HOOK_MARKER = 'doc-sentinel';

/**
 * 清理 v0.7.0/v0.7.1 残留的 SessionStart doc-sentinel 钩子
 * （保留其他钩子；找不到 / settings.json 不存在都不报错）
 *
 * @param {string} cwd
 * @returns {{removed: boolean, path: string|null, remaining: number}}
 */
function cleanupLegacyHook(cwd) {
  const settingsPath = path.join(cwd, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return { removed: false, path: null, remaining: 0 };

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return { removed: false, path: settingsPath, remaining: 0 };
  }

  if (!Array.isArray(settings.hooks?.SessionStart)) {
    return { removed: false, path: settingsPath, remaining: 0 };
  }

  const before = settings.hooks.SessionStart.length;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    h => !JSON.stringify(h).includes(HOOK_MARKER)
  );
  const removed = settings.hooks.SessionStart.length < before;
  const remaining = settings.hooks.SessionStart.length;

  if (!removed) return { removed: false, path: settingsPath, remaining };

  // 清理空数组 / 空对象（与 uninstall.js 一致）
  if (settings.hooks.SessionStart.length === 0) {
    delete settings.hooks.SessionStart;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return { removed: true, path: settingsPath, remaining };
}

/**
 * 在 cwd 创建 runs/ 目录 + .gitkeep
 */
function ensureRunsDir(cwd) {
  const dir = path.join(cwd, 'docs', 'doc-sentinel', 'runs');
  fs.mkdirSync(dir, { recursive: true });
  const gitkeep = path.join(dir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '', 'utf8');
  }
  return dir;
}

/**
 * 完整启用流程（不含 CC CronCreate，由 command 负责）
 *
 * @param {string} cwd
 * @param {string} [_pluginRoot] 保留参数兼容性（v0.7.0 调用传 pluginRoot；v0.7.2+ 不再使用）
 * @returns {object}
 */
function install(cwd, _pluginRoot) {
  if (!isProjectRoot(cwd)) {
    throw new Error(`cwd 不是项目根: ${cwd}（需含 .git / package.json 等标记）`);
  }

  // 1. 写 .god/doc-sentinel.json
  const { config: cfg, path: cfgPath } = enable(cwd);

  // 2. 清理 v0.7.0/v0.7.1 残留的 SessionStart doc-sentinel 钩子（防御性）
  const cleanup = cleanupLegacyHook(cwd);

  // 3. 创建 runs/ 目录
  const runsDir = ensureRunsDir(cwd);

  return {
    config: cfg,
    configPath: cfgPath,
    runsDir,
    legacyHookCleanup: cleanup,
  };
}

// CLI
if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  try {
    const result = install(cwd);
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n✓ doc-sentinel 已准备`);
    console.log(`  config: ${result.configPath}`);
    if (result.legacyHookCleanup.removed) {
      console.log(`  钩子:   ${result.legacyHookCleanup.path}（v0.7.0/v0.7.1 残留 SessionStart 已清理）`);
    } else {
      console.log(`  钩子:   无 v0.7.0/v0.7.1 残留`);
    }
    console.log(`  runs:   ${result.runsDir}`);
    console.log(`\n下一步：command 会调 CC CronCreate 创建定时任务`);
    process.exit(0);
  } catch (err) {
    console.error('✗', err.message);
    process.exit(1);
  }
}

module.exports = { install, cleanupLegacyHook, ensureRunsDir };