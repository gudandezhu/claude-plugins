#!/usr/bin/env node
/**
 * status.js — 看 doc-sentinel 当前状态
 *
 * 输出：启用/范围/模式/钩子/上次跑/上次结果
 *
 * 用法: node status.js <cwd>
 * 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.0 扩展
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readConfig, getLastRunTime, hasSessionStartHook, isProjectRoot } = require('./config');

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

function formatStatus(cwd) {
  const inProject = isProjectRoot(cwd);
  const config = readConfig(cwd);
  const hookRegistered = hasSessionStartHook(cwd);
  const lastRun = readLastRunSummary(cwd);
  const lastRunTime = getLastRunTime(cwd);

  const lines = [];
  lines.push('doc-sentinel 状态');
  lines.push('─'.repeat(40));
  lines.push(`cwd:       ${cwd}`);
  lines.push(`项目根:    ${inProject ? '✓' : '✗（需含 .git / package.json）'}`);
  lines.push(`config:    ${config ? path.join(cwd, '.god', 'doc-sentinel.json') : '未创建'}`);
  lines.push(`启用:      ${config?.enabled ? '✓ yes' : '✗ no'}`);
  if (config) {
    lines.push(`范围:      ${config.scope || 'project'}`);
    lines.push(`模式:      ${config.mode || 'auto-commit'}`);
    lines.push(`schedule:  ${config.schedule || 'session-start'}`);
    const enabledChecks = Object.entries(config.checks || {})
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(', ');
    lines.push(`checks:    ${enabledChecks || '(none)'}`);
  }
  lines.push(`钩子:      ${hookRegistered ? '✓ SessionStart 已注册' : '✗ 未注册'}`);
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

module.exports = { formatStatus, readLastRunSummary };