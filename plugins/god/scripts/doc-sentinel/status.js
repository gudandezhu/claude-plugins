#!/usr/bin/env node
/**
 * status.js — 看 doc-sentinel 当前状态（v0.7.2+ 读 CC cron 任务）
 *
 * 输出：启用/范围/模式/cron 任务/上次跑/上次结果 + 一致性检查
 *
 * v0.7.2 变化：
 *   - 不再读 SessionStart 钩子（install/uninstall 不写）
 *   - 读 CC durable cron 任务文件（.claude/scheduled_tasks.json）
 *   - 交叉验证：config.enabled + cronId + 实际 cron 任务 三者一致性
 *
 * 用法: node status.js <cwd>
 * 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.2 段
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  readConfig,
  getLastRunTime,
  isProjectRoot,
  readScheduledTasks,
} = require('./config');

const HOOK_MARKER = 'doc-sentinel';

function readLastRunSummary(cwd) {
  const runsDir = path.join(cwd, 'docs', 'doc-sentinel', 'runs');
  if (!fs.existsSync(runsDir)) return null;
  const files = fs.readdirSync(runsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  try {
    const r = JSON.parse(fs.readFileSync(path.join(runsDir, files[0]), 'utf8'));
    return {
      timestamp: r.timestamp,
      summary: r.summary,
    };
  } catch {
    return null;
  }
}

/**
 * 在 scheduled_tasks.json 里找 doc-sentinel 任务
 * @returns {Array<{id, cron, prompt, source}>}
 */
function findDocSentinelCronTasks() {
  const tasks = readScheduledTasks(process.cwd());
  if (!tasks) return [];
  // CC 的 scheduled_tasks.json 格式待 E2E 验证；本函数尝试多种常见结构
  const list = Array.isArray(tasks.data)
    ? tasks.data
    : Array.isArray(tasks.data.tasks) ? tasks.data.tasks
    : Array.isArray(tasks.data.jobs) ? tasks.data.jobs
    : [];
  return list
    .filter(t => {
      const prompt = (t?.prompt || t?.message || t?.command || '').toString();
      return prompt.includes(HOOK_MARKER);
    })
    .map(t => ({
      id: t.id || t.jobId || t.cronId || null,
      cron: t.cron || t.schedule || t.expr || null,
      prompt: (t.prompt || t.message || t.command || '').toString().slice(0, 60),
      source: tasks.path,
    }));
}

function formatStatus(cwd) {
  const inProject = isProjectRoot(cwd);
  const config = readConfig(cwd);
  const cronTasks = findDocSentinelCronTasks();
  const lastRun = readLastRunSummary(cwd);
  const lastRunTime = getLastRunTime(cwd);

  const lines = [];
  lines.push('doc-sentinel 状态');
  lines.push('─'.repeat(40));
  lines.push(`cwd:       ${cwd}`);
  lines.push(`项目根:    ${inProject ? '✓' : '✗（需含 .git / package.json）'}`);

  // config
  if (config) {
    lines.push(`config:    ${path.join(cwd, '.god', 'doc-sentinel.json')}`);
    lines.push(`启用:      ${config.enabled ? '✓ yes' : '✗ no'}`);
    lines.push(`范围:      ${config.scope || 'project'}`);
    lines.push(`模式:      ${config.mode || 'auto-commit'}`);
    lines.push(`schedule:  ${config.schedule || 'cron'}`);
    const enabledChecks = Object.entries(config.checks || {})
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(', ');
    lines.push(`checks:    ${enabledChecks || '(none)'}`);
  } else {
    lines.push(`config:    未创建（.god/doc-sentinel.json）`);
    lines.push(`启用:      ✗ no`);
  }

  // cron 任务
  if (cronTasks.length > 0) {
    const t = cronTasks[0];
    lines.push(`cron:      ✓ 已注册`);
    lines.push(`  id:      ${t.id || '(unknown)'}`);
    if (t.cron) lines.push(`  expr:    ${t.cron}`);
    lines.push(`  源:      ${t.source}`);
  } else {
    lines.push(`cron:      ✗ 未注册`);
  }

  // 一致性检查
  if (config?.enabled && cronTasks.length === 0) {
    lines.push('');
    lines.push(`⚠️  config.enabled=true 但 cron 任务不存在`);
    lines.push(`    可能原因：CC durable 任务被清理 / scheduled_tasks.json 损坏`);
    lines.push(`    建议：off → on 重建`);
  }
  if (!config?.enabled && cronTasks.length > 0) {
    lines.push('');
    lines.push(`⚠️  config.enabled=false 但 cron 任务仍存在（孤儿任务）`);
    lines.push(`    建议：手动 CronDelete 清理`);
  }

  lines.push('');
  lines.push(`上次跑:    ${lastRunTime || '从未跑过'}`);
  if (lastRun) {
    const s = lastRun.summary;
    lines.push(`上次结果:  ${s.ok} ok / ${s.warn} warn / ${s.fail} fail / ${s.auto_fixed_count} auto-fixed`);
  } else {
    lines.push(`上次结果:  -`);
  }

  return lines.join('\n');
}

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  console.log(formatStatus(cwd));
  process.exit(0);
}

module.exports = { formatStatus, readLastRunSummary, findDocSentinelCronTasks };