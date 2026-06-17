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

// NO-VERIFY 分类:
// - "救命" 类（未设 GOD_NOVERIFY_REASON）→ 真实崩点, 计入崩点成本 + 升级档位
// - "演练/rehearsal/破环/test-only/test-fix" 类(显式 reason) → 豁免, 不计入崩点成本 + 不升级档位
//   这些是 hook 拦截演练 / 测试 fixture / demo 自身需要的"破环"动作, 不是真实 bug
//
// 注：必须用 includes() 而不是 \b 边界 regex。
// \b 在 CJK 字符上不工作——中文不是 \w 字符，"演练破环" 中 "演"/"练"/"破"/"环" 任意两字之间都没有 \b。
// 用 substr.includes() 做 CJK 友好的子串匹配，英文按 "词" 在子串里也能命中（substring of word 也算演练意图）。
const REHEARSAL_REASONS = ['演练', '破环', 'rehearsal', 'test-only', 'test-fix', 'exercise'];
function classifyNoVerify(event) {
  return REHEARSAL_REASONS.some(r => event.includes(r)) ? 'rehearsal' : 'real';
}

function countFailures(trace) {
  let noVerify = 0;
  let noVerifyRehearsal = 0;
  let rollbacks = 0;
  // v0.7.0+ G18: S 拒签归因
  let sRejectSpec = 0, sRejectImpl = 0, sRejectOther = 0, sAccept = 0;
  for (const t of trace) {
    if (t.event.includes('NO-VERIFY')) {
      noVerify++;
      if (classifyNoVerify(t.event) === 'rehearsal') noVerifyRehearsal++;
    }
    if (t.event.includes('ROLLBACK')) rollbacks++;
    // S 拒签分类 (v0.7.0+ sign-gate.js 写 trace 格式: "phase → phase (S2 reject-spec)")
    if (/S[123]\s+reject-spec/.test(t.event)) sRejectSpec++;
    else if (/S[123]\s+reject-impl/.test(t.event)) sRejectImpl++;
    else if (/S[123]\s+reject/.test(t.event)) sRejectOther++;
    if (/S[123]\s+accept/.test(t.event)) sAccept++;
  }
  return {
    noVerify, noVerifyRehearsal, noVerifyReal: noVerify - noVerifyRehearsal, rollbacks,
    sRejectSpec, sRejectImpl, sRejectOther, sAccept,
  };
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
  // 4) 崩点修复：NO-VERIFY commit 累计时长(只算"真崩点",演练类豁免) + S reject-impl
  //    v0.7.0+ G18: S reject-impl = spec 对 + 代码跑偏 = 跟 NO-VERIFY 同性质(崩点)
  const noVerifyRealCount = trace.filter(t =>
    t.event.includes('NO-VERIFY') && classifyNoVerify(t.event) === 'real'
  ).length;
  const { sRejectImpl } = countFailures(trace);
  const fixes = (noVerifyRealCount + sRejectImpl) * 15 * 60;  // 假设每次真崩 15 min
  // 5) 翻脸决策：rollback + S 拒签(spec 错)
  //    v0.7.0+ G18: S reject-spec = spec 错 = 跟 ROLLBACK 同性质(翻脸)
  //    修复 Gap 3：S1 reject(无 -spec/-impl 后缀,OPC 主观拒签 spec)也是翻脸,应计入 redo + 升级 L2
  //    旧实现只算 sRejectSpec,漏算 sRejectOther(纯 S1 reject),trace 上有但成本归零
  const rollbackCount = trace.filter(t => t.event.includes('ROLLBACK')).length;
  const { sRejectSpec, sRejectOther } = countFailures(trace);
  const redo = (rollbackCount + sRejectSpec + sRejectOther) * 20 * 60;  // 假设每次翻脸 20 min

  // 档位判断：崩点/翻脸全算
  // 修复 Gap 3：sRejectOther(S1 reject 无后缀)也升级到 L2（OPC 主观拒签 spec = 翻脸）
  const { noVerify, noVerifyReal, noVerifyRehearsal, rollbacks, sRejectImpl: sRI, sRejectSpec: sRS, sRejectOther: sRO } = countFailures(trace);
  let tier = 'L0';
  if (rollbacks >= 1 || sRejectSpec >= 1 || sRejectOther >= 1) tier = 'L2';
  else if (noVerifyReal >= 1 || sRejectImpl >= 1) tier = 'L1';

  const budgetSec = BUDGET[tier];
  const inBudget = total <= budgetSec;

  return {
    total, prd, dev, test, fixes, redo,
    tier, inBudget, budgetSec,
    noVerify, noVerifyReal, noVerifyRehearsal, rollbacks,
    sRejectSpec, sRejectImpl, sRejectOther,
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
  out += `OPC 介入成本归因（${cost.tier}，v0.7.0+ 含 S 事件）：\n`;
  out += `  总介入:  ${fmt(cost.total)}\n`;
  out += `  prd 阶段: ${fmt(cost.prd)}\n`;
  out += `  dev 阶段: ${fmt(cost.dev)}\n`;
  out += `  test 阶段: ${fmt(cost.test)}\n`;
  out += `  崩点修复: ${fmt(cost.fixes)} (${cost.noVerifyReal} NO-VERIFY + ${cost.sRejectImpl || 0} S reject-impl / ${cost.noVerifyRehearsal} 演练豁免)\n`;
  out += `  翻脸决策: ${fmt(cost.redo)} (${cost.rollbacks} ROLLBACK + ${cost.sRejectSpec || 0} S reject-spec + ${cost.sRejectOther || 0} S reject)\n`;
  out += `  预算:    ${fmt(cost.budgetSec)} (${cost.tier})\n`;
  out += `  ${cost.message}\n`;
  return out;
}

function main() {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    const { printHelp } = require('./_lib/help');
    printHelp(__filename);
    process.exit(0);
  }
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
