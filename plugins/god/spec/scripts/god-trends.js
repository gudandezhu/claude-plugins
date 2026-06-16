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
  for (const t of trace) {
    if (t.event.includes('NO-VERIFY')) noVerify++;
    if (t.event.includes('ROLLBACK')) rollbacks++;
  }
  return { noVerify, rollbacks };
}

function computeFeatureCost(trace) {
  if (trace.length === 0) return { total: 0, tier: 'L0', noVerify: 0, rollbacks: 0 };
  const init = trace.find(t => t.event.startsWith('INIT'));
  const lastAdvance = [...trace].reverse().find(t => t.event.includes('→'));
  const accepted = trace.find(t => t.event.includes('accepted'));
  if (!init || !lastAdvance) return { total: 0, tier: 'L0', noVerify: 0, rollbacks: 0 };
  const endTime = (accepted || lastAdvance).time;
  const total = Math.max(0, Math.floor((endTime - init.time) / 1000));
  const { noVerify, rollbacks } = countFailures(trace);
  let tier = 'L0';
  if (rollbacks >= 1) tier = 'L2';
  else if (noVerify >= 1) tier = 'L1';
  return { total, tier, noVerify, rollbacks };
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
    if ((f.noVerify + f.rollbacks) >= 2) tierDist.L3++;
  }

  const noVerifyTotal = features.reduce((s, f) => s + f.noVerify, 0);
  const rollbacksTotal = features.reduce((s, f) => s + f.rollbacks, 0);

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

  return { count: features.length, avg, median, min, max, tierDist, noVerifyTotal, rollbacksTotal, trend };
}

function formatHuman(s) {
  if (s.count === 0) return 'god 趋势报告：\n  无 feature 数据（trace 为空）\n';
  const fmt = (sec) => {
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}min`;
  };
  let out = '';
  out += `god 趋势报告（v0.4.0+ 自我监控）：\n`;
  out += `  feature 数:    ${s.count}\n`;
  out += `  OPC 介入时长:  avg=${fmt(s.avg)}  median=${fmt(s.median)}  min=${fmt(s.min)}  max=${fmt(s.max)}\n`;
  out += `  档位分布:      L0=${s.tierDist.L0}  L1=${s.tierDist.L1}  L2=${s.tierDist.L2}  L3=${s.tierDist.L3 || 0}\n`;
  out += `  NO-VERIFY:     ${s.noVerifyTotal} 次（救命场景累计）\n`;
  out += `  ROLLBACK:      ${s.rollbacksTotal} 次（翻脸决策累计）\n`;
  out += `  趋势（最近 3）: ${s.trend}\n`;
  out += `\n  解读：\n`;
  out += `    L3 ≥ 1  → 系统失败信号，需 root cause\n`;
  out += `    L2 ≥ 1  → OPC 主观不满意，建议 ADR 落档原因\n`;
  out += `    trend ↑  → 介入时长恶化，关注 hooks/dev-gen 自动化\n`;
  out += `    trend ↓  → 自动化生效，god v0.4.0+ 工具链正反馈\n`;
  return out;
}

function main() {
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

  const traceContent = readFileSafe(path.join(specDir, '.trace'));
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
