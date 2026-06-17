#!/usr/bin/env node
/**
 * god-trends.js — god 自我监控（plan.md §4 Week 4 E）
 *
 * 用法:
 *   node god-trends.js <项目目录>
 *     读 spec/.trace 累计 → 输出跨 feature 趋势报告
 *
 *   node god-trends.js <项目目录> --json
 *     输出 JSON 给 dashboard 消费
 *
 * 监控维度（v0.4.0+ 起步）：
 *   - OPC 介入时长：avg / median / min / max
 *   - L 档分布：L0 / L1 / L2 / L3 各占多少
 *   - 崩点率：NO-VERIFY commit 次数 / feature
 *   - 翻脸率：ROLLBACK 次数 / feature
 *   - 档位趋势：连续 N 档升级 / 降级
 *
 * 设计依据: docs/plan.md §4 Week 4 E
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
  return traceContent.split('\n')
    .filter(l => l.trim())
    .map(line => {
      const m = line.match(/^(\S+)\s+(.+)$/);
      return m ? { time: new Date(m[1]), event: m[2] } : null;
    })
    .filter(Boolean);
}

function countFailures(trace) {
  let noVerify = 0, rollbacks = 0;
  // v0.7.0+ G18: S 拒签分类 — 计入崩点(L1)/ 翻脸(L2) 档位
  let sRejectSpec = 0, sRejectImpl = 0, sRejectOther = 0;
  let sAccept = 0, softAck = 0;
  for (const t of trace) {
    if (t.event.includes('NO-VERIFY')) noVerify++;
    if (t.event.includes('ROLLBACK')) rollbacks++;
    // S 拒签归因 (v0.7.0+ sign-gate.js 写 trace 格式: "phase → phase (S2 reject-spec)")
    if (/S[123]\s+reject-spec/.test(t.event)) sRejectSpec++;
    else if (/S[123]\s+reject-impl/.test(t.event)) sRejectImpl++;
    else if (/S[123]\s+reject/.test(t.event)) sRejectOther++;
    // S 签字通过
    if (/S[123]\s+accept/.test(t.event)) sAccept++;
    // 软失败免责
    if (t.event.includes('soft-ack')) softAck++;
  }
  return { noVerify, rollbacks, sRejectSpec, sRejectImpl, sRejectOther, sAccept, softAck };
}

function computeFeatureCost(trace) {
  if (trace.length === 0) return { total: 0, tier: 'L0', noVerify: 0, rollbacks: 0 };
  const init = trace.find(t => t.event.startsWith('INIT'));
  const lastAdvance = [...trace].reverse().find(t => t.event.includes('→'));
  const accepted = trace.find(t => t.event.includes('accepted'));
  if (!init || !lastAdvance) return { total: 0, tier: 'L0', noVerify: 0, rollbacks: 0 };
  const endTime = (accepted || lastAdvance).time;
  const total = Math.max(0, Math.floor((endTime - init.time) / 1000));
  const { noVerify, rollbacks, sRejectSpec, sRejectImpl, sRejectOther } = countFailures(trace);
  // 档位判断（v0.7.0+ 改）:
  //   L0 纯流程     = 无 NO-VERIFY + 无 ROLLBACK + 无 S 拒签
  //   L1 含 1 崩     = 1 次崩点 (NO-VERIFY OR S reject-impl) — 实现错
  //   L2 含 1 翻脸   = 1 次 S reject-spec OR 1 次 S reject — spec 错
  //   L2 也含 1 ROLLBACK(原语义保留)
  //   L3 ≥ 2 次累计
  const sRejects = sRejectSpec + sRejectImpl + sRejectOther;
  let tier = 'L0';
  if ((rollbacks || 0) >= 1 || sRejectSpec >= 1) tier = 'L2';
  else if ((noVerify || 0) >= 1 || sRejectImpl >= 1) tier = 'L1';
  return { total, tier, noVerify, rollbacks, sRejects, sRejectSpec, sRejectImpl };
}

function aggregateFeatures(traceContent) {
  // 1 个 trace 可含多个 feature（按 INIT 划分）
  const all = parseTrace(traceContent);
  const features = [];
  let current = [];
  for (const t of all) {
    current.push(t);
    if (t.event.startsWith('INIT')) {
      // 新 feature 开始，先结算上一个
      if (current.length > 1) {
        const prev = current.slice(0, -1);
        features.push(computeFeatureCost(prev));
      }
      current = [t];
    }
  }
  if (current.length > 0) features.push(computeFeatureCost(current));
  return features;
}

function summarize(features) {
  if (features.length === 0) {
    return {
      count: 0,
      avg: 0, median: 0, min: 0, max: 0,
      tierDist: { L0: 0, L1: 0, L2: 0, L3: 0 },
      noVerifyTotal: 0, rollbacksTotal: 0,
      trend: '无数据',
    };
  }

  const totals = features.map(f => f.total).sort((a, b) => a - b);
  const avg = Math.floor(totals.reduce((s, v) => s + v, 0) / totals.length);
  const median = totals[Math.floor(totals.length / 2)];
  const min = totals[0];
  const max = totals[totals.length - 1];

  const tierDist = { L0: 0, L1: 0, L2: 0, L3: 0 };
  for (const f of features) {
    tierDist[f.tier] = (tierDist[f.tier] || 0) + 1;
    // v0.7.0+ G18: S 拒签 + NO-VERIFY + ROLLBACK 累计 ≥ 2 算 L3
    // 兼容老 fixture: sRejects 缺省视为 0
    const fSum = (f.noVerify || 0) + (f.rollbacks || 0) + (f.sRejects || 0);
    if (fSum >= 2) tierDist.L3++;
  }

  const noVerifyTotal = features.reduce((s, f) => s + f.noVerify, 0);
  const rollbacksTotal = features.reduce((s, f) => s + f.rollbacks, 0);
  const sRejectSpecTotal = features.reduce((s, f) => s + (f.sRejectSpec || 0), 0);
  const sRejectImplTotal = features.reduce((s, f) => s + (f.sRejectImpl || 0), 0);

  // 趋势：看最近 3 feature 的档位
  let trend = '平稳';
  if (features.length >= 3) {
    const last3 = features.slice(-3).map(f => f.tier);
    const tierVal = { L0: 0, L1: 1, L2: 2, L3: 3 };
    const v0 = tierVal[last3[0]] || 0;
    const v1 = tierVal[last3[1]] || 0;
    const v2 = tierVal[last3[2]] || 0;
    if (v0 < v1 && v1 < v2) trend = '↑ 升级';
    else if (v0 > v1 && v1 > v2) trend = '↓ 降级';
  }

  return {
    count: features.length, avg, median, min, max, tierDist,
    noVerifyTotal, rollbacksTotal, sRejectSpecTotal, sRejectImplTotal, trend,
  };
}

function formatHuman(s) {
  if (s.count === 0) return 'god 趋势报告：\n  无 feature 数据（trace 为空）\n';
  const fmt = (sec) => {
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}min`;
  };
  let out = '';
  out += `god 趋势报告（v0.7.0+ 自我监控，RFC-0013 G18）：\n`;
  out += `  feature 数:    ${s.count}\n`;
  out += `  OPC 介入时长:  avg=${fmt(s.avg)}  median=${fmt(s.median)}  min=${fmt(s.min)}  max=${fmt(s.max)}\n`;
  out += `  档位分布:      L0=${s.tierDist.L0}  L1=${s.tierDist.L1}  L2=${s.tierDist.L2}  L3=${s.tierDist.L3 || 0}\n`;
  out += `  NO-VERIFY:     ${s.noVerifyTotal} 次（救命场景累计）\n`;
  out += `  ROLLBACK:      ${s.rollbacksTotal} 次（翻脸决策累计）\n`;
  out += `  S reject-spec: ${s.sRejectSpecTotal || 0} 次（spec 错翻脸，v0.7.0+）\n`;
  out += `  S reject-impl: ${s.sRejectImplTotal || 0} 次（实现错崩点，v0.7.0+）\n`;
  out += `  趋势（最近 3）: ${s.trend}\n`;
  out += `\n  解读：\n`;
  out += `    L3 ≥ 1  → 系统失败信号，需 root cause\n`;
  out += `    L2 ≥ 1  → OPC 主观不满意（或 S reject-spec），建议 ADR 落档原因\n`;
  out += `    S reject-spec ≥ 1 → spec 错漏，建议回 prd 阶段 1/2 重 brainstorm\n`;
  out += `    S reject-impl ≥ 1 → 实现没跟 spec，建议重读 spec.feature 修代码\n`;
  out += `    trend ↑  → 介入时长恶化，关注 hooks/dev-gen 自动化\n`;
  out += `    trend ↓  → 自动化生效，god v0.7.0+ 工具链正反馈\n`;
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
    console.error('用法: node god-trends.js <项目目录> [--json]');
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
  const features = aggregateFeatures(traceContent);
  const summary = summarize(features);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatHuman(summary));
  }
}

if (require.main !== module) {
  module.exports = { aggregateFeatures, summarize, parseTrace, countFailures, computeFeatureCost };
} else {
  main();
}
