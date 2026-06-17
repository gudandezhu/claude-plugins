#!/usr/bin/env node
/**
 * spec-readiness.js — spec 清晰度校验（RFC-0013 落地，v0.7.0 G15）
 *
 * 用法:
 *   node spec-readiness.js <项目目录>
 *     输出 7 项指标 + 阻断/放行 + 软失败清单
 *     exit 0 = 放行 / exit 1 = 阻断
 *
 *   node spec-readiness.js <项目目录> --json
 *     输出 JSON 给 sign-gate.js 消费
 *
 *   node spec-readiness.js <项目目录> --soft-ack
 *     标记软失败已 OPC ack（写免责锚点到 sources.md）
 *
 * 7 项指标（RFC-0013 §3.3）:
 *   硬 1: 未决项归零       (sources.md 无未决项)
 *   硬 2: REQ 全有 SC       (spec-validate #10 0 FAIL)
 *   硬 3: GWT 无 TBD        (spec.feature 无 TBD|待定|...|等等)
 *   硬 4: user-perspectives (sources/user-perspectives/_summary.md 存在 + 非空)
 *   硬 5: summary.md 合规   (spec-summary check 4 项全过)
 *   硬 6: C5 锚点           (sources.md 含 C5 行)
 *   软 7: sad-path 覆盖     (@sad-path SC / SC 总数 >= 30%)
 *
 * 设计依据: docs/rfcs/0013-prd-pipeline.md §3.3
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { handleHelp } = require('./_lib/help');

// ---------- 常量 ----------

const SAD_PATH_THRESHOLD = 0.30;  // 30%

const TBD_PATTERNS = [
  /\bTBD\b/i,
  /待定/,
  /待补充/,
  /\bTODO\b/,
  /(?<![.一-龥])\.\.\.(?![.一-龥])/,  // 单独的 ... （避免误伤 "1.2.3" / "等等" 中的点）
  /等等/,
  /稍后/,
];

// ---------- 工具函数 ----------

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
function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }

// ---------- 7 项指标检测 ----------

/** 硬 1: 未决项归零 */
function checkNoOpenItems(sourcesContent) {
  if (!sourcesContent) return { pass: false, detail: 'sources.md 不存在' };
  // 找"未决项"段,统计列表项（- / * / 数字. 开头）
  const m = sourcesContent.match(/(?:未决项|未结案项|Open\s*Items)[\s\S]*?(?=\n##|\n\*\*|$)/i);
  if (!m) return { pass: true, detail: '无未决项段(默认视为已结案)' };
  const section = m[0];
  const openLines = section.split('\n').filter(l => /^\s*[-*]\s+\S/.test(l) || /^\s*\d+\.\s+\S/.test(l));
  // 过滤"已结案/已解决"开头的行
  const realOpen = openLines.filter(l => !/(已结案|已解决|已确认|结案)/.test(l));
  if (realOpen.length === 0) {
    return { pass: true, detail: '未决项 0 条' };
  }
  return { pass: false, detail: `未决项 ${realOpen.length} 条未结案`, items: realOpen };
}

/** 硬 2: REQ 全有 SC（调 spec-validate #10）*/
function checkReqScBinding(projectDir) {
  const validateScript = path.join(__dirname, 'spec-validate.js');
  try {
    // readiness 是 S1 前置（spec 写完，dev/test 还没全跑）
    // 显式传 --phase=implemented 走"允许测试暂缺"模式，避免默认 verified 阶段永远 fail 缺测试
    execSync(`node ${validateScript} ${projectDir} --phase=implemented 2>&1`, { stdio: 'pipe' });
    return { pass: true, detail: 'REQ ↔ SC 双向绑定通过' };
  } catch (e) {
    const stderr = (e.stderr || e.stdout || Buffer.from('')).toString();
    const m = stderr.match(/#10[\s\S]*?(?=#\d|$)/);
    return { pass: false, detail: m ? m[0].trim() : 'spec-validate 失败（#10 双向绑定）' };
  }
}

/** 硬 3: GWT 无 TBD */
function checkGwtComplete(specFeatureContent) {
  if (!specFeatureContent) return { pass: false, detail: 'spec.feature 不存在' };
  const lines = specFeatureContent.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // 只检查 Given/When/Then 行,避免误伤注释
    if (!/^\s*(Given|When|Then|And|But)\s/.test(l)) continue;
    for (const pat of TBD_PATTERNS) {
      if (pat.test(l)) {
        hits.push(`L${i + 1}: ${l.trim()}`);
        break;
      }
    }
  }
  if (hits.length === 0) return { pass: true, detail: 'GWT 无 TBD/待定/.../等等' };
  return { pass: false, detail: `GWT 含 ${hits.length} 处占位符`, items: hits };
}

/** 硬 4: user-perspectives 存在 */
function checkUserPerspectives(specDir) {
  const p = path.join(specDir, 'sources', 'user-perspectives', '_summary.md');
  if (!fs.existsSync(p)) return { pass: false, detail: 'user-perspectives/_summary.md 不存在' };
  const content = readFileSafe(p) || '';
  if (content.length < 50) return { pass: false, detail: 'user-perspectives/_summary.md 几乎为空(< 50 字符)' };
  // 检查是否还是占位符（init-spec-dir.js 写的模板含 {role-1} 等）
  if (/\{role-1\}/.test(content)) {
    return { pass: false, detail: 'user-perspectives/_summary.md 还是占位符(未填实际内容)' };
  }
  return { pass: true, detail: 'user-perspectives 已就位' };
}

/** 硬 5: summary.md 合规（调 spec-summary check）*/
function checkSummary(projectDir) {
  const summaryScript = path.join(__dirname, 'spec-summary.js');
  try {
    execSync(`node ${summaryScript} check ${projectDir} 2>&1`, { stdio: 'pipe' });
    return { pass: true, detail: 'summary.md 合规' };
  } catch (e) {
    return { pass: false, detail: 'summary.md 不合规(跑 spec-summary check)' };
  }
}

/** 硬 6: C5 锚点 */
function checkC5Anchor(sourcesContent) {
  if (!sourcesContent) return { pass: false, detail: 'sources.md 不存在' };
  if (!/C5\s*Spec\s*评审/.test(sourcesContent) && !/^\s*-\s+\*\*C5/m.test(sourcesContent)) {
    return { pass: false, detail: '缺 C5 Spec 评审 锚点' };
  }
  return { pass: true, detail: 'C5 锚点存在' };
}

/** 软 7: sad-path 覆盖 */
function checkSadPathRatio(specFeatureContent) {
  if (!specFeatureContent) return { pass: false, detail: 'spec.feature 不存在' };
  const scMatches = specFeatureContent.match(/@SC-\d+/g) || [];
  const total = scMatches.length;
  if (total === 0) return { pass: false, detail: 'SC 总数为 0' };
  const sadPathMatches = specFeatureContent.match(/@SC-\d+[^\n]*@sad-path|@sad-path[^\n]*@SC-\d+/g) || [];
  const ratio = sadPathMatches.length / total;
  if (ratio >= SAD_PATH_THRESHOLD) {
    return { pass: true, detail: `sad-path 覆盖 ${(ratio * 100).toFixed(0)}% (${sadPathMatches.length}/${total})` };
  }
  return { pass: false, soft: true, detail: `sad-path 覆盖 ${(ratio * 100).toFixed(0)}% (${sadPathMatches.length}/${total}) < ${SAD_PATH_THRESHOLD * 100}%` };
}

// ---------- 主流程 ----------

function runReadiness(projectDir) {
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    return { ok: false, error: '找不到 spec 目录', projectDir };
  }
  const sources = readFileSafe(path.join(specDir, 'sources.md'));
  const specFeature = readFileSafe(path.join(specDir, 'spec.feature'));

  const checks = [
    { id: 'H1', name: '未决项归零', result: checkNoOpenItems(sources) },
    { id: 'H2', name: 'REQ 全有 SC', result: checkReqScBinding(projectDir) },
    { id: 'H3', name: 'GWT 无 TBD', result: checkGwtComplete(specFeature) },
    { id: 'H4', name: 'user-perspectives', result: checkUserPerspectives(specDir) },
    { id: 'H5', name: 'summary.md 合规', result: checkSummary(projectDir) },
    { id: 'H6', name: 'C5 锚点', result: checkC5Anchor(sources) },
    { id: 'S7', name: 'sad-path 覆盖', result: checkSadPathRatio(specFeature) },
  ];

  const hardFailed = checks.filter(c => !c.result.pass && !c.result.soft);
  const softFailed = checks.filter(c => c.result.soft);
  const ok = hardFailed.length === 0 && softFailed.length <= 1;

  return {
    ok,
    projectDir,
    specDir,
    hardPassed: checks.length - hardFailed.length - softFailed.length,
    softPassed: softFailed.length === 0 ? checks.length - hardFailed.length : checks.length - hardFailed.length - 1,
    hardFailed: hardFailed.length,
    softFailed: softFailed.length,
    checks,
  };
}

function formatHuman(report) {
  const lines = [];
  lines.push(`spec-readiness (${report.projectDir})`);
  lines.push(``);
  for (const c of report.checks) {
    const tag = c.result.soft ? '软' : '硬';
    const mark = c.result.pass ? '✓' : (c.result.soft ? '⚠' : '✗');
    lines.push(`  [${tag}] ${mark} ${c.id} ${c.name}: ${c.result.detail}`);
  }
  lines.push(``);
  if (report.ok) {
    lines.push(`✓ 放行 (硬 ${report.hardPassed}/6 过,软 ${report.softFailed} 项未过${report.softFailed > 0 ? '≤1 可免责' : ''})`);
  } else {
    const reason = report.hardFailed > 0 ? `硬失败 ${report.hardFailed} 项(不可免责)` : `软失败 ${report.softFailed} 项(>1 不可免责)`;
    lines.push(`✗ 阻断 (${reason})`);
  }
  return lines.join('\n');
}

function writeSoftAck(projectDir) {
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const sourcesPath = path.join(specDir, 'sources.md');
  if (!fs.existsSync(sourcesPath)) {
    console.error('✗ sources.md 不存在');
    process.exit(1);
  }
  const content = fs.readFileSync(sourcesPath, 'utf8');
  const ackLine = `\n- **S1 软失败免责** (${nowIso()} / OPC ack / 软失败 1 项已确认)\n`;
  if (/- \*\*S1 软失败免责\*\*/.test(content)) {
    console.log('⚠ S1 软失败免责 锚点已存在(幂等)');
    return;
  }
  fs.appendFileSync(sourcesPath, ackLine, 'utf8');
  console.log(`✓ S1 软失败免责 锚点已写入 sources.md`);
  console.log(`  锚点: S1 软失败免责 (${nowIso()} / OPC ack / 软失败 1 项已确认)`);
}

function main() {
  if (handleHelp(__filename)) return;
  const projectDir = process.argv[2] || process.cwd();
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }
  if (process.argv.includes('--soft-ack')) {
    writeSoftAck(projectDir);
    process.exit(0);
  }
  const json = process.argv.includes('--json');
  const report = runReadiness(projectDir);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatHuman(report));
  }
  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { runReadiness, findSpecDir, SAD_PATH_THRESHOLD, TBD_PATTERNS };
