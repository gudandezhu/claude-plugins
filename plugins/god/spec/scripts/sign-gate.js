#!/usr/bin/env node
/**
 * sign-gate.js — S1/S2/S3 签字 Gate 统一管理（RFC-0013 落地，v0.7.0 G16）
 *
 * 用法:
 *   node sign-gate.js <项目目录> --gate S1 --verdict accept
 *     S1 放行: 写锚点 + 推 phase reviewed → implemented
 *
 *   node sign-gate.js <项目目录> --gate S1 --verdict reject --reason "..."
 *     S1 拒签: 写锚点 + 保留 phase (spec 错) / 回 prd 阶段 1 (prd 自动处置)
 *
 *   node sign-gate.js <项目目录> --gate S2 --verdict reject-spec --reason "..."
 *     S2 拒签 + 归因 spec 错: 写锚点 + 回 prd 阶段 1 + @spec-version MAJOR bump
 *
 *   node sign-gate.js <项目目录> --gate S2 --verdict reject-impl --reason "..."
 *     S2 拒签 + 归因 实现错: 写锚点 + 回 phase reviewed (重做 dev)
 *
 *   node sign-gate.js <项目目录> --gate S3 --verdict accept
 *     S3 放行: 写锚点 + 推 phase accepted + 触发 measure-opc-cost.js
 *
 *   node sign-gate.js <项目目录> --gate S1
 *     status: 显示当前阶段 + 校验条件 + 阻塞原因
 *
 * Gate 映射:
 *   S1 (Prd 出口):  阶段 reviewed → implemented
 *     前置: spec-readiness.js 通过
 *   S2 (Dev 出口):  阶段 implemented → verified
 *     前置: spec-validate.js (phase=verified) 校验全过
 *   S3 (Test 出口): 阶段 verified → accepted
 *     前置: spec-validate.js (phase=verified) 校验全过（verify 已在 S2 完成，S3 复用即可）
 *
 * 设计依据: docs/rfcs/0013-prd-pipeline.md §3.4
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { handleHelp } = require('./_lib/help');

// ---------- 常量 ----------

const VALID_GATES = ['S1', 'S2', 'S3'];
const VALID_VERDICTS = ['accept', 'reject', 'reject-spec', 'reject-impl'];

// S1/S2/S3 阶段映射
const GATE_PHASE = {
  S1: { from: 'reviewed', to: 'implemented' },
  S2: { from: 'implemented', to: 'verified' },
  S3: { from: 'verified', to: 'accepted' },
};

// 前置校验：每个 gate 跑哪个脚本
const GATE_PREREQ = {
  S1: (projectDir) => {
    // 跑 spec-readiness.js,exit 0 才放行
    try {
      execSync(`node ${path.join(__dirname, 'spec-readiness.js')} ${projectDir} 2>&1`, { stdio: 'pipe' });
      return { pass: true };
    } catch (e) {
      return { pass: false, reason: 'spec-readiness.js 阻断' };
    }
  },
  S2: (projectDir) => {
    try {
      execSync(`node ${path.join(__dirname, 'spec-validate.js')} ${projectDir} --phase=verified 2>&1`, { stdio: 'pipe' });
      return { pass: true };
    } catch (e) {
      return { pass: false, reason: 'spec-validate.js 校验失败（dev→test 条件未达）' };
    }
  },
  S3: (projectDir) => {
    // S3 是 test→accepted 验收签字，verify 阶段校验已在 S2 完成（dev→test 1:1 强校验）。
    // S3 复用 phase=verified 即可（accepted 是签字结果，不是新的校验阶段；spec-validate 也未定义 accepted phase）。
    // 修复 Gap 2：原代码传 --phase=accepted 会触发 spec-validate 的 "非法 phase" 报错，迫使 sign-gate --force escape。
    try {
      execSync(`node ${path.join(__dirname, 'spec-validate.js')} ${projectDir} --phase=verified 2>&1`, { stdio: 'pipe' });
      return { pass: true };
    } catch (e) {
      return { pass: false, reason: 'spec-validate.js 校验失败（test→accepted 条件未达）' };
    }
  },
};

// ---------- 工具函数 ----------

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
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
function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
function metaPath(specDir) {
  if (fs.existsSync(path.join(specDir, 'state', 'meta.json'))) {
    return path.join(specDir, 'state', 'meta.json');
  }
  return path.join(specDir, 'meta.json');
}
function tracePath(specDir) {
  if (fs.existsSync(path.join(specDir, 'state', '.trace'))) {
    return path.join(specDir, 'state', '.trace');
  }
  return path.join(specDir, '.trace');
}

function readArg(name) {
  const flag = `--${name}=`;
  const eq = process.argv.find(a => a.startsWith(flag));
  if (eq) return eq.slice(flag.length);
  // 兼容 --name <value>
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return null;
}

// ---------- 核心逻辑 ----------

function getStatus(projectDir) {
  const specDir = findSpecDir(projectDir);
  if (!specDir) return { error: '找不到 spec 目录' };
  const meta = readJson(metaPath(specDir));
  if (!meta) return { error: 'meta.json 不存在（未 init）', phase: 'idea' };

  // 判断当前可签的 gate
  let currentGate = null;
  for (const g of VALID_GATES) {
    if (meta.phase === GATE_PHASE[g].from) {
      currentGate = g;
      break;
    }
  }

  const result = {
    specId: meta.specId,
    phase: meta.phase,
    version: meta.version,
    currentGate,
    gates: meta.gates || {},
  };

  if (currentGate) {
    const prereq = GATE_PREREQ[currentGate](projectDir);
    result.prereq = prereq;
  }
  return result;
}

function appendGateAnchor(specDir, gate, verdict, reason) {
  const sourcesPath = path.join(specDir, 'sources.md');
  if (!fs.existsSync(sourcesPath)) {
    // sources.md 缺失时建一个最小骨架（罕见）
    fs.writeFileSync(sourcesPath, '# 需求清单\n\n## S 锚点区\n\n', 'utf8');
  }
  const content = fs.readFileSync(sourcesPath, 'utf8');
  const tag = {
    S1: 'S1 Prd 出口签字',
    S2: 'S2 Dev 出口签字',
    S3: 'S3 Test 出口签字',
  }[gate];
  const verdictText = {
    accept: 'accept',
    reject: 'reject',
    'reject-spec': 'reject-spec(回 prd)',
    'reject-impl': 'reject-impl(回 dev)',
  }[verdict];
  const reasonText = reason || '-';
  const line = `\n- **${tag}** (${nowIso()} / ${verdictText} / ${reasonText})\n`;
  if (new RegExp(`- \\*\\*${tag}\\*\\*`).test(content)) {
    // 已有同类锚点,追加（不覆盖历史）
    fs.appendFileSync(sourcesPath, line, 'utf8');
  } else {
    fs.appendFileSync(sourcesPath, line, 'utf8');
  }
  return line.trim();
}

function advancePhase(specDir, fromPhase, toPhase, gate) {
  const metaFile = metaPath(specDir);
  const meta = readJson(metaFile);
  if (!meta) throw new Error('meta.json 不存在');
  if (meta.phase !== fromPhase) {
    throw new Error(`当前 phase = ${meta.phase},期望 ${fromPhase} 才能 advance 到 ${toPhase}`);
  }
  meta.phase = toPhase;
  meta.updatedAt = nowIso();
  meta.gates = meta.gates || {};
  meta.gates[toPhase] = nowIso();
  writeJson(metaFile, meta);
  // 写 trace（v0.7.0+ G18: S 锚点写 trace 给 god-trends / measure-opc-cost 归因）
  const trace = tracePath(specDir);
  const gateTag = gate ? ` (${gate} accept)` : ' (sign-gate)';
  fs.appendFileSync(trace, `${nowIso()} ${fromPhase} → ${toPhase}${gateTag}\n`, 'utf8');
}

function rollbackPhase(specDir, toPhase, gate, verdict) {
  const metaFile = metaPath(specDir);
  const meta = readJson(metaFile);
  if (!meta) throw new Error('meta.json 不存在');
  const oldPhase = meta.phase;
  meta.phase = toPhase;
  meta.updatedAt = nowIso();
  writeJson(metaFile, meta);
  // v0.7.0+ G18: S 拒签归因写 trace,格式: "S2 reject-spec",god-trends 分类
  const trace = tracePath(specDir);
  let tag;
  if (gate && verdict) {
    tag = ` (${gate} ${verdict})`;
  } else {
    tag = ' (sign-gate rollback)';
  }
  fs.appendFileSync(trace, `${nowIso()} ${oldPhase} → ${toPhase}${tag}\n`, 'utf8');
  return { from: oldPhase, to: toPhase };
}

function bumpVersion(specDir, kind) {
  const metaFile = metaPath(specDir);
  const meta = readJson(metaFile);
  if (!meta) return;
  const [maj, min, pat] = (meta.version || '1.0.0').split('.').map(Number);
  let next;
  if (kind === 'MAJOR') next = `${maj + 1}.0.0`;
  else if (kind === 'MINOR') next = `${maj}.${min + 1}.0`;
  else next = `${maj}.${min}.${pat + 1}`;
  meta.version = next;
  meta.updatedAt = nowIso();
  writeJson(metaFile, meta);
  return next;
}

function processAccept(projectDir, gate) {
  const specDir = findSpecDir(projectDir);
  const { from, to } = GATE_PHASE[gate];
  // 前置校验
  const prereq = GATE_PREREQ[gate](projectDir);
  if (!prereq.pass) {
    return { ok: false, error: `${gate} 前置校验未过: ${prereq.reason}` };
  }
  // 推 phase
  advancePhase(specDir, from, to, gate);
  // 写锚点
  const anchor = appendGateAnchor(specDir, gate, 'accept', `phase ${from} → ${to}`);
  // S3 额外触发 measure-opc-cost
  let costNote = '';
  if (gate === 'S3') {
    try {
      const out = execSync(`node ${path.join(__dirname, 'measure-opc-cost.js')} ${projectDir} --json 2>&1`, { encoding: 'utf8' });
      costNote = `\nOPC 成本归因: ${out.split('\n')[0] || '(json)'}`;
    } catch (e) {
      costNote = `\nOPC 成本归因: 跑失败 (${e.message.slice(0, 80)})`;
    }
  }
  return { ok: true, anchor, from, to, costNote };
}

function processReject(projectDir, gate, verdict, reason) {
  const specDir = findSpecDir(projectDir);
  if (!reason) {
    return { ok: false, error: 'reject 必须带 --reason "<拒签原因>"' };
  }
  const anchor = appendGateAnchor(specDir, gate, verdict, reason);

  // 回退 phase
  let rollback = null;
  let versionBump = null;
  if (gate === 'S1' && verdict === 'reject') {
    // S1 拒签: 保留 phase reviewed,prd 阶段内部处置
    rollback = { from: 'reviewed', to: 'reviewed', note: 'prd 阶段内部处置' };
    // v0.7.0+ G18: S1 拒签仍写 trace(phase 不动,但事件要记)
    const trace = tracePath(specDir);
    fs.appendFileSync(trace, `${nowIso()} reviewed (S1 reject)  → reviewed (prd 内部处置)\n`, 'utf8');
  } else if (gate === 'S2' && verdict === 'reject-spec') {
    rollback = rollbackPhase(specDir, 'drafted', gate, verdict);
    versionBump = bumpVersion(specDir, 'MAJOR');
  } else if (gate === 'S2' && verdict === 'reject-impl') {
    rollback = rollbackPhase(specDir, 'reviewed', gate, verdict);
  } else if (gate === 'S2' && verdict === 'reject') {
    rollback = rollbackPhase(specDir, 'reviewed', gate, verdict);
  } else if (gate === 'S3' && verdict === 'reject-spec') {
    rollback = rollbackPhase(specDir, 'drafted', gate, verdict);
    versionBump = bumpVersion(specDir, 'MAJOR');
  } else if (gate === 'S3' && verdict === 'reject-impl') {
    rollback = rollbackPhase(specDir, 'implemented', gate, verdict);
  } else if (gate === 'S3' && verdict === 'reject') {
    rollback = rollbackPhase(specDir, 'implemented', gate, verdict);
  }
  return { ok: true, anchor, rollback, versionBump };
}

function formatStatus(status) {
  const lines = [];
  lines.push(`sign-gate status`);
  lines.push(`  spec-id: ${status.specId || '(未初始化)'}`);
  lines.push(`  phase:   ${status.phase}`);
  lines.push(`  @spec-version: ${status.version || '(unknown)'}`);
  if (status.currentGate) {
    lines.push(`  当前可签: ${status.currentGate}`);
    if (status.prereq) {
      lines.push(`  前置校验: ${status.prereq.pass ? '✓ 通过' : '✗ ' + (status.prereq.reason || '未过')}`);
    }
  } else {
    lines.push(`  当前可签: 无（phase = ${status.phase} 不在签字点）`);
  }
  return lines.join('\n');
}

function main() {
  if (handleHelp(__filename)) return;
  const projectDir = process.argv[2] || process.cwd();
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }

  const gate = readArg('gate');
  const verdict = readArg('verdict');
  const reason = readArg('reason');

  // status 模式: 没 --gate 时显示状态
  if (!gate) {
    const status = getStatus(projectDir);
    if (status.error) {
      console.error(`✗ ${status.error}`);
      process.exit(1);
    }
    console.log(formatStatus(status));
    process.exit(0);
  }

  if (!VALID_GATES.includes(gate)) {
    console.error(`✗ --gate 必须是 ${VALID_GATES.join('|')}`);
    process.exit(1);
  }
  if (!VALID_VERDICTS.includes(verdict)) {
    console.error(`✗ --verdict 必须是 ${VALID_VERDICTS.join('|')}`);
    process.exit(1);
  }

  let result;
  try {
    if (verdict === 'accept') {
      result = processAccept(projectDir, gate);
    } else {
      result = processReject(projectDir, gate, verdict, reason);
    }
  } catch (e) {
    console.error(`✗ ${e.message || e}`);
    process.exit(1);
  }
  if (!result.ok) {
    console.error(`✗ ${result.error}`);
    process.exit(1);
  }
  console.log(`✓ ${gate} ${verdict}`);
  console.log(`  锚点: ${result.anchor}`);
  if (result.rollback) {
    if (result.rollback.note) {
      console.log(`  回退: ${result.rollback.note}`);
    } else {
      console.log(`  回退: phase ${result.rollback.from} → ${result.rollback.to}`);
    }
  }
  if (result.versionBump) {
    console.log(`  版本: @spec-version → ${result.versionBump} (MAJOR)`);
  }
  if (result.costNote) {
    console.log(result.costNote);
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = { getStatus, processAccept, processReject, GATE_PHASE, VALID_GATES, VALID_VERDICTS };
