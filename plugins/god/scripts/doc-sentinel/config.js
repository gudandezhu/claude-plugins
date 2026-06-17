'use strict';
/**
 * config.js — 项目级 doc-sentinel 配置管理
 *
 * 路径: <cwd>/.god/doc-sentinel.json（项目级，git tracked）
 * 范围: cwd 必须在 git 仓内或含 package.json 等项目根标记
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.0 扩展
 * 零外部依赖，纯 Node 内置模块。
 */

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = '.god';
const CONFIG_FILE = 'doc-sentinel.json';

const DEFAULT_CONFIG = {
  enabled: true,
  scope: 'project',
  mode: 'auto-commit',
  schedule: 'session-start',
  checks: {
    V1: true, N1: true, D1: true, F1: true, T1: true,
    P1: true, G1: true, C1: true, M1: true,
  },
};

const PROJECT_ROOT_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];

/**
 * 检测 cwd 是否为项目根
 * @param {string} cwd
 * @returns {boolean}
 */
function isProjectRoot(cwd) {
  if (!cwd || !fs.existsSync(cwd)) return false;
  return PROJECT_ROOT_MARKERS.some(m => fs.existsSync(path.join(cwd, m)));
}

/**
 * 读项目级配置
 * @param {string} cwd
 * @returns {object|null} 配置对象；不存在或无效返回 null
 */
function readConfig(cwd) {
  const p = path.join(cwd, CONFIG_DIR, CONFIG_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 写项目级配置（不存在则创建 .god/ 目录）
 * @param {string} cwd
 * @param {object} config
 * @returns {string} 写入的文件路径
 */
function writeConfig(cwd, config) {
  const dir = path.join(cwd, CONFIG_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, CONFIG_FILE);
  fs.writeFileSync(p, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return p;
}

/**
 * 合并默认配置（用户配置 + 默认值）
 * @param {object} userConfig
 * @returns {object}
 */
function mergeDefaults(userConfig) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    checks: { ...DEFAULT_CONFIG.checks, ...(userConfig.checks || {}) },
  };
}

/**
 * 在 cwd 启用 doc-sentinel
 * @param {string} cwd
 * @returns {{config: object, path: string}}
 * @throws {Error} 不在项目根
 */
function enable(cwd) {
  if (!isProjectRoot(cwd)) {
    throw new Error(`cwd 不是项目根: ${cwd}（需含 .git / package.json 等标记）`);
  }
  const existing = readConfig(cwd) || {};
  const config = mergeDefaults({ ...existing, enabled: true });
  const filePath = writeConfig(cwd, config);
  return { config, path: filePath };
}

/**
 * 在 cwd 禁用 doc-sentinel（保留 config 作 audit）
 * @param {string} cwd
 * @returns {{config: object, path: string}}
 */
function disable(cwd) {
  const existing = readConfig(cwd);
  if (!existing) {
    const config = mergeDefaults({ enabled: false });
    const filePath = writeConfig(cwd, config);
    return { config, path: filePath };
  }
  const config = { ...existing, enabled: false };
  const filePath = writeConfig(cwd, config);
  return { config, path: filePath };
}

/**
 * 取最后一次巡检报告时间
 * @param {string} cwd
 * @returns {string|null} ISO 时间戳；无报告返回 null
 */
function getLastRunTime(cwd) {
  const runsDir = path.join(cwd, 'docs', 'doc-sentinel', 'runs');
  if (!fs.existsSync(runsDir)) return null;
  const files = fs.readdirSync(runsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  // 文件名是 <ISO>.json 格式
  return files[0].replace(/\.json$/, '').replace(/-/g, (m, i) => i < 10 || i > 18 ? m : ':').slice(0, -4);
}

/**
 * 判断 SessionStart 钩子是否已注册
 * @param {string} cwd
 * @returns {boolean}
 */
function hasSessionStartHook(cwd) {
  const p = path.join(cwd, '.claude', 'settings.json');
  if (!fs.existsSync(p)) return false;
  try {
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    const hooks = s?.hooks?.SessionStart || [];
    return hooks.some(h => JSON.stringify(h).includes('doc-sentinel'));
  } catch {
    return false;
  }
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  PROJECT_ROOT_MARKERS,
  isProjectRoot,
  readConfig,
  writeConfig,
  mergeDefaults,
  enable,
  disable,
  getLastRunTime,
  hasSessionStartHook,
};