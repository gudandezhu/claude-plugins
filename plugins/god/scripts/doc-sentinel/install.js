#!/usr/bin/env node
/**
 * install.js — 在项目启用 doc-sentinel
 *
 * 1. 写 .god/doc-sentinel.json
 * 2. 写/合并 .claude/settings.json SessionStart 钩子
 * 3. 创建 docs/doc-sentinel/runs/ 目录
 *
 * 用法: node install.js <cwd>
 * 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.0 扩展
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { enable, isProjectRoot, hasSessionStartHook, DEFAULT_CONFIG } = require('./config');

const HOOK_MARKER = 'doc-sentinel';
const HOOK_COMMAND_TEMPLATE = (pluginRoot) =>
  `claude -p "你是 doc-sentinel agent。任务：巡检当前项目（cwd）文档健康度。\\n1. cd 到 cwd\\n2. 跑 ${pluginRoot}/scripts/doc-sentinel/check-facade.js .\\n3. 读 JSON 报告\\n4. 按 ${pluginRoot}/skills/doc-sentinel/SKILL.md 决策树分类每个 finding\\n5. auto-fix 类直接改文件 + git commit（按 .god/doc-sentinel.json mode）\\n6. 写 docs/doc-sentinel/runs/<ISO>.json\\n7. exit\\n不 git push。" --plugin-dir "${pluginRoot}"`;

function ensureRunsDir(cwd) {
  const dir = path.join(cwd, 'docs', 'doc-sentinel', 'runs');
  fs.mkdirSync(dir, { recursive: true });
  const gitkeep = path.join(dir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '', 'utf8');
  }
  return dir;
}

function readSettings(cwd) {
  const p = path.join(cwd, '.claude', 'settings.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(cwd, settings) {
  const dir = path.join(cwd, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return p;
}

/**
 * 在 settings.json 注册 SessionStart 钩子（不覆盖既有钩子）
 * @param {string} cwd
 * @param {string} pluginRoot
 * @returns {{added: boolean, path: string}}
 */
function installHook(cwd, pluginRoot) {
  const settings = readSettings(cwd);
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];

  // 检查是否已有 doc-sentinel 钩子
  const exists = settings.hooks.SessionStart.some(h =>
    JSON.stringify(h).includes(HOOK_MARKER)
  );

  if (!exists) {
    settings.hooks.SessionStart.push({
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: HOOK_COMMAND_TEMPLATE(pluginRoot),
        },
      ],
    });
  }

  const filePath = writeSettings(cwd, settings);
  return { added: !exists, path: filePath };
}

/**
 * 完整启用流程
 * @param {string} cwd
 * @param {string} pluginRoot
 * @returns {object}
 */
function install(cwd, pluginRoot) {
  if (!isProjectRoot(cwd)) {
    throw new Error(`cwd 不是项目根: ${cwd}`);
  }

  // 1. 写 .god/doc-sentinel.json
  const { config: cfg, path: cfgPath } = enable(cwd);

  // 2. 注册 SessionStart 钩子
  const { added: hookAdded, path: settingsPath } = installHook(cwd, pluginRoot);

  // 3. 创建 runs 目录
  const runsDir = ensureRunsDir(cwd);

  return {
    config: cfg,
    configPath: cfgPath,
    settingsPath,
    runsDir,
    hookAdded,
  };
}

// CLI
if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..', '..');

  try {
    const result = install(cwd, pluginRoot);
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n✓ doc-sentinel 已启用`);
    console.log(`  config: ${result.configPath}`);
    console.log(`  hooks:  ${result.settingsPath}${result.hookAdded ? '（新增）' : '（已存在）'}`);
    console.log(`  runs:   ${result.runsDir}`);
    process.exit(0);
  } catch (err) {
    console.error('✗', err.message);
    process.exit(1);
  }
}

module.exports = { install, installHook, ensureRunsDir, readSettings, writeSettings };