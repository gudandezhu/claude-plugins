#!/usr/bin/env node
/**
 * spec-cli.js — spec 状态机 CLI（roadmap G1）
 *
 * 用法:
 *   node spec-cli.js status [project-dir]
 *     读 spec/meta.json，打印 phase + 5 gate 状态
 *     project-dir 默认 cwd
 *
 *   node spec-cli.js advance [project-dir] [--force]
 *     推进到下一状态；前置 gate 没过则拒绝（exit 1）
 *     --force = 跳过 gate 校验（写一条 --force 到 .trace）
 *
 *   node spec-cli.js rollback [project-dir] --to <phase> [--reason "<text>"]
 *     回滚到指定 phase；强制要求 --reason
 *
 *   node spec-cli.js check [project-dir]
 *     跑 spec-validate.js + 状态机合法性双校验
 *
 *   node spec-cli.js init [project-dir] --spec-id <id> --phase <phase>
 *     初始化 meta.json（首次进入 drafted 时）
 *
 * 设计依据: docs/rfcs/0001-spec-cli-state-machine.md
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------- 常量 ----------

const VALID_PHASES = ['idea', 'drafted', 'reviewed', 'implemented', 'verified', 'accepted'];

// ---------- spec/ 子目录布局（v0.5.0+ G13 落地）
//
// spec/                  ← 项目根的 spec 目录（OPC 直接看）
// ├── sources.md         ← 母本（不变）
// ├── spec.feature       ← 真相源（不变）
// ├── summary.md         ← OPC 验收 1 页纸（顶层，OPC 看的主产物）
// ├── state/             ← 机器数据（meta + trace 收这里）
// │   ├── meta.json
// │   └── .trace
// ├── review/            ← 评审产物独立目录
// │   └── review-YYYY-MM-DD.md
// ├── domain/            ← 领域知识
// │   └── domain.md
// └── archive/           ← 历史快照
//     └── spec-1.0.0/...
//
const PATHS = {
  sources: 'sources.md',
  feature: 'spec.feature',
  summary: 'summary.md',
  stateDir: 'state',
  meta: 'state/meta.json',
  trace: 'state/.trace',
  reviewDir: 'review',
  domainDir: 'domain',
  domainFile: 'domain/domain.md',
  archiveDir: 'archive',
};
const PHASE_ORDER = {
  idea: 0, drafted: 1, reviewed: 2, implemented: 3, verified: 4, accepted: 5,
};
const GATE_NAMES = {
  drafted: 'spec.feature + sources.md 完整 + 双向绑定通过',
  reviewed: 'spec-review ≥ 90 分 或 显式跳过 + C5 锚点',
  implemented: '每个 SC 在源码有 @spec SC-xxx 标注',
  verified: '每个 SC 在测试有 SC-xxx: 用例',
  accepted: '/god:test 验收报告 + 用户签字',
};

// ---------- phaseCapabilities（v0.5.2 P0 改进：阶段化校验数据驱动）----------
//
// 改一处 → 改 DEFAULT_PHASE_CAPABILITIES 即可,不会忘改 if-else
// 旧 demo 不带 phaseCapabilities 字段 → 自动回退到 DEFAULT（向后兼容）
//
const DEFAULT_PHASE_CAPABILITIES = {
  drafted: {
    requireSpecFeature: true,
    requireSources: true,
  },
  reviewed: {
    requireC5Anchor: true,
  },
  implemented: {
    validatePhase: 'implemented',
    // 允许"缺测试"放过的 SC tag 列表
    // 当前策略：所有 tag 都允许在 implemented 阶段放过（测试在 verified 阶段才强约束）
    // v0.5.1: 普通 SC + sad-path SC 都降级为 info
    allowMissingTestTags: ['happy', 'sad-path', 'edge', 'intent'],
  },
  verified: {
    validatePhase: 'verified',
    allowMissingTestTags: [],  // verified 阶段全 1:1 强约束
  },
  accepted: {
    requireAcceptance: true,
    requireSummaryCheck: true,
  },
};

/**
 * 拿当前阶段的能力配置：meta.phaseCapabilities[phase] ?? DEFAULT
 * （meta 缺字段时静默回退,保持 v0.5.1 旧 demo 行为不变）
 */
function getPhaseCapabilities(meta, targetPhase) {
  const fromMeta = (meta && meta.phaseCapabilities || {})[targetPhase];
  const def = DEFAULT_PHASE_CAPABILITIES[targetPhase] || {};
  return Object.assign({}, def, fromMeta || {});
}

// ---------- 工具函数 ----------

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
function findSpecDir(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'spec', 'spec.feature'))) {
    return path.join(projectDir, 'spec');
  }
  if (fs.existsSync(path.join(projectDir, 'spec.feature'))) {
    return projectDir;
  }
  return null;
}

// 兼容旧路径: stateDir 不存在时回退到 spec 顶层
function metaPath(specDir) {
  if (fs.existsSync(path.join(specDir, PATHS.meta))) {
    return path.join(specDir, PATHS.meta);
  }
  // 旧路径: spec/meta.json（读路径时回退,init 时不用）
  return path.join(specDir, 'meta.json');
}
// init 时强制新路径,不回退（让 G13 结构固化）
function metaPathForWrite(specDir) {
  return path.join(specDir, PATHS.meta);
}
function tracePath(specDir) {
  if (fs.existsSync(path.join(specDir, PATHS.trace))) {
    return path.join(specDir, PATHS.trace);
  }
  return path.join(specDir, '.trace');
}

// ---------- Gate 校验（v0.5.2 P0：数据驱动）----------

function checkGate(specDir, targetPhase, meta) {
  // 数据驱动：capabilities 决定校验规则，不再 if-else 字符串比对
  // meta 缺 phaseCapabilities → 用 DEFAULT_PHASE_CAPABILITIES（向后兼容）
  const cap = getPhaseCapabilities(meta, targetPhase);
  const errors = [];

  // 1. 顶层文件存在
  if (cap.requireSpecFeature && !fs.existsSync(path.join(specDir, 'spec.feature'))) {
    errors.push('缺 spec.feature');
  }
  if (cap.requireSources && !fs.existsSync(path.join(specDir, 'sources.md'))) {
    errors.push('缺 sources.md');
  }

  // 2. C5 锚点（reviewed 阶段）
  if (cap.requireC5Anchor) {
    const sources = fs.readFileSync(path.join(specDir, 'sources.md'), 'utf8');
    if (!/C5\s*Spec\s*评审/.test(sources) && !/C5\s*[:：]/.test(sources)) {
      errors.push('缺 C5 锚点（spec-validate.js #11）');
    }
  }

  // 3. spec-validate 跑（implemented / verified 阶段）
  if (cap.validatePhase) {
    try {
      const validateScript = path.join(__dirname, 'spec-validate.js');
      const phaseArg = `--phase=${cap.validatePhase}`;
      // v0.5.2 P0：把 cap.allowMissingTestTags 真透传给 spec-validate.js
      // （之前是死代码——spec-validate 自己硬编码降级规则）
      // 容错：cap.allowMissingTestTags 缺字段时传空数组（保守：实现态什么也不放过）
      const allowTags = Array.isArray(cap.allowMissingTestTags) ? cap.allowMissingTestTags : [];
      const allowArg = `--allow-missing-test-tags=${allowTags.join(',')}`;
      execSync(`node ${validateScript} ${phaseArg} ${allowArg} ${path.dirname(specDir)}`, { stdio: 'pipe' });
    } catch (e) {
      // 把"缺测试"是否降级,交给 spec-validate.js 看 allowMissingTestTags
      // 这里只透传它的报错（v0.5.1 行为）
      const stage = cap.validatePhase === 'implemented' ? '代码 @spec 标注' : '代码+测试 SC 完整绑定';
      errors.push(`spec-validate.js 失败（${stage}未达标）`);
    }
  }

  // 4. 验收报告（accepted 阶段）
  if (cap.requireSummaryCheck) {
    try {
      const summaryScript = path.join(__dirname, 'spec-summary.js');
      execSync(`node ${summaryScript} check ${path.dirname(specDir)}`, { stdio: 'pipe' });
    } catch (e) {
      errors.push('spec-summary check 失败（summary.md 不合格）');
    }
  }
  if (cap.requireAcceptance) {
    // ACCEPTANCE.md 强约束：演练/真实项目必写验收报告（v0.5.0+ P0）
    const acceptancePath = path.join(path.dirname(specDir), 'ACCEPTANCE.md');
    if (!fs.existsSync(acceptancePath)) {
      errors.push('ACCEPTANCE.md 缺失（演练/真实项目必写验收报告，含流程时间线/真跑证据/OPC 成本归因/反蒙混自检）');
    }
  }
  return errors;
}

function appendTrace(specDir, line) {
  fs.appendFileSync(tracePath(specDir), `${nowIso()} ${line}\n`, 'utf8');
}

// ---------- 子命令 ----------

function cmdStatus(projectDir) {
  projectDir = projectDir || process.cwd();
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const meta = readJson(metaPath(specDir));
  if (!meta) {
    console.log('phase: idea (meta.json 不存在)');
    console.log('提示：首次进入 drafted 时跑 `spec-cli init --spec-id <id> --phase drafted`');
    return;
  }
  console.log(`spec-id: ${meta.specId}`);
  console.log(`phase: ${meta.phase}`);
  console.log(`@spec-version: ${meta.version}`);
  console.log(`relatedPR: [${(meta.relatedPR || []).join(', ')}]`);
  console.log(`updatedAt: ${meta.updatedAt}`);
  console.log(`\ngates:`);
  for (const phase of ['drafted', 'reviewed', 'implemented', 'verified', 'accepted']) {
    const passed = (meta.gates || {})[phase];
    const mark = passed ? '✓' : (PHASE_ORDER[phase] <= PHASE_ORDER[meta.phase] ? '✗' : '○');
    console.log(`  ${mark} ${phase}`);
  }
}

function cmdAdvance(projectDir, opts) {
  projectDir = projectDir || process.cwd();
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const metaFile = metaPath(specDir);
  let meta = readJson(metaFile);
  if (!meta) {
    console.error('✗ meta.json 不存在，先跑 `spec-cli init`');
    process.exit(1);
  }
  const currentIdx = PHASE_ORDER[meta.phase];
  if (currentIdx >= PHASE_ORDER.accepted) {
    console.error(`✗ 已在 accepted 状态，无法 advance`);
    process.exit(1);
  }
  const nextPhase = VALID_PHASES[currentIdx + 1];

  // gate 校验（v0.5.2 P0：传 meta 供 phaseCapabilities 读取）
  if (!opts.force) {
    const errors = checkGate(specDir, nextPhase, meta);
    if (errors.length) {
      console.error(`✗ ${meta.phase} → ${nextPhase} 失败：`);
      errors.forEach(e => console.error(`  - ${e}`));
      console.error(`\n提示：用 --force 跳过 gate 校验（写 trace 留痕）`);
      process.exit(1);
    }
  } else {
    console.warn(`⚠ --force 跳过 gate 校验（写 trace 留痕）`);
  }

  const prevPhase = meta.phase;
  meta.phase = nextPhase;
  meta.updatedAt = nowIso();
  meta.gates = meta.gates || {};
  meta.gates[nextPhase] = nowIso();
  writeJson(metaFile, meta);
  const flag = opts.force ? ' [FORCE]' : '';
  appendTrace(specDir, `${prevPhase} → ${nextPhase}${flag}`);
  console.log(`✓ ${prevPhase} → ${nextPhase}`);
  console.log(`  state/meta.json.updatedAt = ${meta.updatedAt}`);
  console.log(`  state/.trace 追加 1 行`);
}

function cmdRollback(projectDir, opts) {
  projectDir = projectDir || process.cwd();
  if (!opts.to) {
    console.error('✗ rollback 必填 --to <phase>');
    process.exit(1);
  }
  if (!VALID_PHASES.includes(opts.to)) {
    console.error(`✗ 非法 phase "${opts.to}"，合法：${VALID_PHASES.join(' / ')}`);
    process.exit(1);
  }
  if (!opts.reason) {
    console.error('✗ rollback 必填 --reason "<原因>"');
    process.exit(1);
  }
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const metaFile = metaPath(specDir);
  const meta = readJson(metaFile);
  if (!meta) {
    console.error('✗ meta.json 不存在');
    process.exit(1);
  }
  if (PHASE_ORDER[opts.to] >= PHASE_ORDER[meta.phase]) {
    console.error(`✗ rollback 必须回退（当前 ${meta.phase} → ${opts.to} 非回退）`);
    process.exit(1);
  }
  const prevPhase = meta.phase;
  meta.phase = opts.to;
  meta.updatedAt = nowIso();
  // 回退时清掉被回退阶段的 gate 时间戳
  if (meta.gates) {
    for (const phase of Object.keys(meta.gates)) {
      if (PHASE_ORDER[phase] > PHASE_ORDER[opts.to]) {
        delete meta.gates[phase];
      }
    }
  }
  writeJson(metaFile, meta);
  appendTrace(specDir, `ROLLBACK ${prevPhase} → ${opts.to} | reason: ${opts.reason}`);
  console.log(`✓ ROLLBACK ${prevPhase} → ${opts.to}`);
  console.log(`  reason: ${opts.reason}`);
}

function cmdCheck(projectDir) {
  projectDir = projectDir || process.cwd();
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const meta = readJson(metaPath(specDir));
  if (!meta) {
    console.error('✗ meta.json 不存在');
    process.exit(1);
  }
  if (!VALID_PHASES.includes(meta.phase)) {
    console.error(`✗ phase "${meta.phase}" 非法`);
    process.exit(1);
  }
  // 跑 spec-validate.js 双校验（v0.5.2 P0：传 meta）
  const errors = checkGate(specDir, meta.phase, meta);
  if (errors.length) {
    console.error('✗ check 失败：');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`✓ check 通过（phase = ${meta.phase}）`);
}

function cmdInit(projectDir, opts) {
  projectDir = projectDir || process.cwd();
  if (!opts.specId) {
    console.error('✗ init 必填 --spec-id <id>');
    process.exit(1);
  }
  if (!opts.phase || !VALID_PHASES.includes(opts.phase)) {
    console.error(`✗ init 必填合法 --phase (${VALID_PHASES.join('/')})`);
    process.exit(1);
  }
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  // init 时强制写新路径,先确保 state/ 存在
  const stateDir = path.join(specDir, PATHS.stateDir);
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
  const metaFile = metaPathForWrite(specDir);
  if (fs.existsSync(metaFile)) {
    console.error('✗ meta.json 已存在，无需 init');
    process.exit(1);
  }
  // 读 spec.feature 拿 version
  const specContent = fs.readFileSync(path.join(specDir, 'spec.feature'), 'utf8');
  const versionMatch = specContent.match(/^@spec-version\s+(\S+)/m);
  const version = versionMatch ? versionMatch[1] : '0.0.0';

  const meta = {
    specId: opts.specId,
    version,
    phase: opts.phase,
    owner: process.env.USER || 'unknown',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    relatedPR: [],
    scopes: [opts.specId],
    gates: { [opts.phase]: nowIso() },
    // v0.5.2 P0：阶段化校验数据驱动（每 phase 一份 capabilities,可被 advance 时覆盖）
    phaseCapabilities: JSON.parse(JSON.stringify(DEFAULT_PHASE_CAPABILITIES)),
  };
  writeJson(metaFile, meta);
  appendTrace(specDir, `INIT specId=${opts.specId} phase=${opts.phase}`);
  console.log(`✓ meta.json 已创建（phase = ${opts.phase}）`);
}

// ---------- 参数解析 ----------

function parseArgs(argv) {
  const args = argv.slice(2);
  const subcmd = args[0];
  const opts = { positional: [] };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--force') opts.force = true;
    else if (a === '--to') opts.to = args[++i];
    else if (a === '--reason') opts.reason = args[++i];
    else if (a === '--spec-id') opts.specId = args[++i];
    else if (a === '--phase') opts.phase = args[++i];
    else if (a.startsWith('--')) opts[a.slice(2)] = true;
    else opts.positional.push(a);
  }
  opts.projectDir = opts.positional[0];
  return { subcmd, opts };
}

function main() {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    const { printHelp } = require('./_lib/help');
    printHelp(__filename);
    process.exit(0);
  }
  const { subcmd, opts } = parseArgs(process.argv);
  if (subcmd === 'status') cmdStatus(opts.projectDir);
  else if (subcmd === 'advance') cmdAdvance(opts.projectDir, opts);
  else if (subcmd === 'rollback') cmdRollback(opts.projectDir, opts);
  else if (subcmd === 'check') cmdCheck(opts.projectDir);
  else if (subcmd === 'init') cmdInit(opts.projectDir, opts);
  else if (subcmd === '__test_export__') {
    return {
      VALID_PHASES, PHASE_ORDER, GATE_NAMES,
      DEFAULT_PHASE_CAPABILITIES, getPhaseCapabilities,
      checkGate, appendTrace,
      readJson, writeJson, findSpecDir,
    };
  }
  else if (require.main !== module) {
    return {
      VALID_PHASES, PHASE_ORDER, GATE_NAMES,
      DEFAULT_PHASE_CAPABILITIES, getPhaseCapabilities,
      checkGate, appendTrace,
      readJson, writeJson, findSpecDir,
    };
  }
  else {
    console.error('用法: node spec-cli.js <status|advance|rollback|check|init> [project-dir] [options]');
    process.exit(1);
  }
}

// v0.5.2 P0 修复：require 时不跑 main()，避免父进程 argv 含 --help 时子进程被 process.exit(0) 杀
// 旧代码 `module.exports = main();` 在 require 时无条件跑 main；main() 顶部检查 process.argv 的 --help，
// 当父进程（如 spec-cli.test.js --help）require 本模块时，process.argv 含 '--help'，main 跑 → exit(0) → 子进程被杀
// 修复：仅 require.main === module 时跑 main()；被 require 时只导出符号表
if (require.main === module) {
  main();
} else {
  module.exports = {
    VALID_PHASES, PHASE_ORDER, GATE_NAMES,
    DEFAULT_PHASE_CAPABILITIES, getPhaseCapabilities,
    checkGate, appendTrace,
    readJson, writeJson, findSpecDir,
  };
}
