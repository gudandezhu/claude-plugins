'use strict';
/**
 * config.js — 项目级 doc-sentinel 配置管理
 *
 * 路径: <cwd>/.god/doc-sentinel.json（项目级，git tracked）
 * 范围: cwd 必须在 git 仓内或含 package.json 等项目根标记
 *
 * v0.7.2 扩展：
 *   - 新增 cronId 字段（CC CronCreate 返回的任务 ID）
 *   - 新增 recordCronId() / clearCronId() 写盘接口
 *   - hasSessionStartHook() 保留供 off 兜底用
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.2 段
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
  schedule: 'cron',  // v0.7.2+：固定为 cron（CC CronCreate）
  cronId: null,       // v0.7.2+：CC CronCreate 返回的任务 ID
  checks: {
    V1: true, N1: true, D1: true, F1: true, T1: true,
    P1: true, G1: true, C1: true, M1: true,
  },
};

const PROJECT_ROOT_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];

/**
 * 检测 cwd 是否为项目根
 */
function isProjectRoot(cwd) {
  if (!cwd || !fs.existsSync(cwd)) return false;
  return PROJECT_ROOT_MARKERS.some(m => fs.existsSync(path.join(cwd, m)));
}

/**
 * 读项目级配置
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
 * v0.7.2+：强制刷新 schedule='cron'（v0.7.0/v0.7.1 残留的 'session-start' 必须被覆盖）
 */
function enable(cwd) {
  if (!isProjectRoot(cwd)) {
    throw new Error(`cwd 不是项目根: ${cwd}（需含 .git / package.json 等标记）`);
  }
  const existing = readConfig(cwd) || {};
  const config = mergeDefaults({
    ...existing,
    enabled: true,
    schedule: 'cron',
  });
  const filePath = writeConfig(cwd, config);
  return { config, path: filePath };
}

/**
 * 在 cwd 禁用 doc-sentinel（保留 config 作 audit）
 * v0.7.2+：同步清 cronId（off 配套操作）
 */
function disable(cwd) {
  const existing = readConfig(cwd);
  const baseConfig = existing || {};
  const config = mergeDefaults({ ...baseConfig, enabled: false, cronId: null });
  const filePath = writeConfig(cwd, config);
  return { config, path: filePath };
}

/**
 * v0.7.2+：记录 CC CronCreate 返回的任务 ID
 */
function recordCronId(cwd, cronId) {
  const existing = readConfig(cwd) || {};
  const config = mergeDefaults({ ...existing, cronId: cronId || null });
  const filePath = writeConfig(cwd, config);
  return { config, path: filePath };
}

/**
 * v0.7.2+：清空 cronId（off 时与 disable 配套；或 cron 任务异常丢失时）
 */
function clearCronId(cwd) {
  return recordCronId(cwd, null);
}

/**
 * 取最后一次巡检报告时间
 */
function getLastRunTime(cwd) {
  const runsDir = path.join(cwd, 'docs', 'doc-sentinel', 'runs');
  if (!fs.existsSync(runsDir)) return null;
  const files = fs.readdirSync(runsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return files[0].replace(/\.json$/, '').replace(/-/g, (m, i) => i < 10 || i > 18 ? m : ':').slice(0, -4);
}

/**
 * 判断 SessionStart 钩子是否已注册（v0.7.2+ 仅供 off 兜底用）
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

/**
 * v0.7.2+：读 CC 的 durable cron 任务文件
 *
 * 路径策略（按假设优先级，E2E 验证后再固化）：
 *   1. 项目级 <cwd>/.claude/scheduled_tasks.json
 *   2. 用户级 ~/.claude/scheduled_tasks.json
 *
 * 实际存放路径由 CC 平台决定；本函数读存在的那个。
 *
 * @param {string} cwd
 * @returns {object|null} 解析后的对象（CC 格式），或 null
 */
function readScheduledTasks(cwd) {
  const candidates = [
    path.join(cwd, '.claude', 'scheduled_tasks.json'),
    path.join(require('os').homedir(), '.claude', 'scheduled_tasks.json'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
    } catch {
      // 解析失败继续尝试下一个
      continue;
    }
  }
  return null;
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
  recordCronId,
  clearCronId,
  getLastRunTime,
  hasSessionStartHook,
  readScheduledTasks,
};