#!/usr/bin/env node
/**
 * measure-opc-cost.js — OPC 介入时长 5 维归因
 *
 * 用法:
 *   node spec/scripts/measure-opc-cost.js <项目目录>
 *     输出人类可读的归因报告
 *
 *   node spec/scripts/measure-opc-cost.js <项目目录> --json
 *     输出 JSON 给验收报告脚本消费
 *
 * 设计依据: docs/rfcs/0005-opc-cost-tiered.md
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BUDGET = {
  L0: 30 * 60,  // 纯流程
  L1: 60 * 60,  // 含 1 崩点
  L2: 90 * 60,  // 含 1 翻脸
};

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
function findSpecDir(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'spec', 'spec.feature'))) {
    return path.join(projectDir, 'spec');
  }
  if (fs.existsSync(path.join(projectDir, 'spec.feature'))) {
    return projectDir;
  }
  return null;
}

function parseTrace(traceContent) {
  if (!traceContent) return [];
  const lines = traceContent.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (!m) return null;
    return { time: new Date(m[1]), event: m[2] };
  }).filter(Boolean);
}

function countFailures(trace) {
  let noVerify = 0;
  let rollbacks = 0;
  for (const t of trace) {
    if (t.event.includes('NO-VERIFY')) noVerify++;
    if (t.event.includes('ROLLBACK')) rollbacks++;
  }
  return { noVerify, rollbacks };
}

function computeCost(trace) {
  if (trace.length === 0) {
    return {
      total: 0, prd: 0, dev: 0, test: 0, fixes: 0, redo: 0,
      tier: 'L0', inBudget: true, message: 'trace 为空',
    };
  }

  // 找关键时间锚点
  const init = trace.find(t => t.event.startsWith('INIT'));
  const firstAdvance = trace.find(t => t.event.includes('→'));
  const lastAdvance = [...trace].reverse().find(t => t.event.includes('→'));
  const accepted = trace.find(t => t.event.includes('accepted'));

  if (!init || !lastAdvance) {
    return {
      total: 0, prd: 0, dev: 0, test: 0, fixes: 0, redo: 0,
      tier: 'L0', inBudget: true, message: 'INIT 或 advance 缺失',
    };
  }

  const initTime = init.time;
  const endTime = (accepted || lastAdvance).time;
  const total = Math.max(0, Math.floor((endTime - initTime) / 1000));

  // 拆分 5 维（粗算：按阶段时间戳差）
  // 1) prd 介入：init → first advance（含 C1/C2/C3/C4 gates）
  const prd = firstAdvance
    ? Math.max(0, Math.floor((firstAdvance.time - initTime) / 1000))
    : 0;
  // 2) dev 介入：first advance → last advance（不含 rollback 时间）
  const dev = firstAdvance && lastAdvance && firstAdvance !== lastAdvance
    ? Math.max(0, Math.floor((lastAdvance.time - firstAdvance.time) / 1000))
    : 0;
  // 3) test 介入：last advance 之后 OPC 看 demo + 签字（粗算 = total - prd - dev）
  const test = Math.max(0, total - prd - dev);
  // 4) 崩点修复：NO-VERIFY commit 累计时长
  const noVerifyCount = trace.filter(t => t.event.includes('NO-VERIFY')).length;
  const fixes = noVerifyCount * 15 * 60;  // 假设每次救命 15 min（保守估计）
  // 5) 翻脸决策：rollback 次数 × 平均决策时长
  const rollbackCount = trace.filter(t => t.event.includes('ROLLBACK')).length;
  const redo = rollbackCount * 20 * 60;  // 假设每次翻脸 20 min

  // 档位判断
  const { noVerify, rollbacks } = countFailures(trace);
  let tier = 'L0';
  if (rollbacks >= 1) tier = 'L2';
  else if (noVerify >= 1) tier = 'L1';

  const budgetSec = BUDGET[tier];
  const inBudget = total <= budgetSec;

  return {
    total, prd, dev, test, fixes, redo,
    tier, inBudget, budgetSec,
    noVerify, rollbacks,
    message: inBudget
      ? `✓ 在 ${tier} 预算内（${total}s / ${budgetSec}s）`
      : `✗ 超 ${tier} 预算（${total}s / ${budgetSec}s，超 ${total - budgetSec}s）`,
  };
}

function formatHuman(cost) {
  const fmt = (s) => {
    if (s < 60) return `${s}s`;
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return sec === 0 ? `${min}min` : `${min}min${sec}s`;
  };
  let out = '';
  out += `OPC 介入成本归因（${cost.tier}）：\n`;
  out += `  总介入:  ${fmt(cost.total)}\n`;
  out += `  prd 阶段: ${fmt(cost.prd)}\n`;
  out += `  dev 阶段: ${fmt(cost.dev)}\n`;
  out += `  test 阶段: ${fmt(cost.test)}\n`;
  out += `  崩点修复: ${fmt(cost.fixes)} (${cost.noVerify} 次 NO-VERIFY)\n`;
  out += `  翻脸决策: ${fmt(cost.redo)} (${cost.rollbacks} 次 ROLLBACK)\n`;
  out += `  预算:    ${fmt(cost.budgetSec)} (${cost.tier})\n`;
  out += `  ${cost.message}\n`;
  return out;
}

function main() {
  const projectDir = process.argv[2];
  if (!projectDir) {
    console.error('用法: node measure-opc-cost.js <项目目录> [--json]');
    process.exit(1);
  }
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }

  // v0.5.0+ G13: trace 在 state/ 下;兼容旧路径
  const tracePathNew = path.join(specDir, 'state', '.trace');
  const tracePathOld = path.join(specDir, '.trace');
  const traceContent = readFileSafe(fs.existsSync(tracePathNew) ? tracePathNew : tracePathOld);
  const trace = parseTrace(traceContent);
  const cost = computeCost(trace);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(cost, null, 2));
  } else {
    console.log(formatHuman(cost));
  }

  process.exit(cost.inBudget ? 0 : 1);
}

if (require.main !== module) {
  module.exports = { computeCost, parseTrace, countFailures, BUDGET, formatHuman };
} else {
  main();
}
