#!/usr/bin/env node
/**
 * uninstall.js — 在项目禁用 doc-sentinel
 *
 * 1. 标记 .god/doc-sentinel.json enabled: false（不删，保留 audit）
 * 2. 从 .claude/settings.json 删 SessionStart 钩子段（保留其他钩子）
 * 3. runs/ 历史保留
 *
 * 用法: node uninstall.js <cwd>
 * 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.0 扩展
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { disable } = require('./config');

const HOOK_MARKER = 'doc-sentinel';

function readSettings(cwd) {
  const p = path.join(cwd, '.claude', 'settings.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeSettings(cwd, settings) {
  const p = path.join(cwd, '.claude', 'settings.json');
  fs.writeFileSync(p, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return p;
}

/**
 * 从 settings.json 移除 doc-sentinel SessionStart 钩子
 * @param {string} cwd
 * @returns {{removed: boolean, path: string|null}}
 */
function removeHook(cwd) {
  const settings = readSettings(cwd);
  if (!settings) return { removed: false, path: null };

  if (!Array.isArray(settings.hooks?.SessionStart)) {
    return { removed: false, path: null };
  }

  const before = settings.hooks.SessionStart.length;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    h => !JSON.stringify(h).includes(HOOK_MARKER)
  );
  const removed = settings.hooks.SessionStart.length < before;

  if (!removed) return { removed: false, path: null };

  // 如果 SessionStart 空了，删空数组
  if (settings.hooks.SessionStart.length === 0) {
    delete settings.hooks.SessionStart;
  }
  // 如果 hooks 空了，删空对象
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  const filePath = writeSettings(cwd, settings);
  return { removed: true, path: filePath };
}

/**
 * 完整禁用流程
 * @param {string} cwd
 * @returns {object}
 */
function uninstall(cwd) {
  // 1. 标记 config disabled
  const { config: cfg, path: cfgPath } = disable(cwd);

  // 2. 移除钩子
  const { removed, path: settingsPath } = removeHook(cwd);

  return {
    config: cfg,
    configPath: cfgPath,
    settingsPath,
    hookRemoved: removed,
  };
}

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();

  try {
    const result = uninstall(cwd);
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n✓ doc-sentinel 已禁用`);
    console.log(`  config: ${result.configPath}（enabled=false，保留 audit）`);
    console.log(`  hooks:  ${result.hookRemoved ? result.settingsPath + '（已移除）' : '无 doc-sentinel 钩子'}`);
    console.log(`  runs:   历史保留`);
    process.exit(0);
  } catch (err) {
    console.error('✗', err.message);
    process.exit(1);
  }
}

module.exports = { uninstall, removeHook };