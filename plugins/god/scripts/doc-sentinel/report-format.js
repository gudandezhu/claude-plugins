'use strict';

/**
 * report-format.js — doc-sentinel 巡检报告统一 schema
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.3
 * 零外部依赖，纯 Node 内置模块。
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} Finding
 * @property {string} file        文件路径（相对仓库根）
 * @property {string} issue       问题描述
 * @property {string} fix         建议修复
 * @property {boolean} auto_fixed 是否已 auto-fix（agent 跑完后回填）
 */

/**
 * @typedef {Object} CheckResult
 * @property {string} id          V1/N1/D1/F1/T1/P1/G1/C1/M1
 * @property {string} name        中文名
 * @property {string} status      ok|warn|fail|skip
 * @property {Finding[]} findings
 * @property {number} duration_ms
 */

/**
 * @typedef {Object} Report
 * @property {string} timestamp         ISO 8601
 * @property {number} duration_ms       总耗时
 * @property {CheckResult[]} checks
 * @property {{total:number, ok:number, warn:number, fail:number, skip:number, auto_fixed_count:number}} summary
 */

/**
 * 创建空 CheckResult
 * @param {string} id
 * @param {string} name
 * @returns {CheckResult}
 */
function newCheck(id, name) {
  return { id, name, status: 'ok', findings: [], duration_ms: 0 };
}

/**
 * 给 CheckResult 添加 finding
 * @param {CheckResult} check
 * @param {Omit<Finding, 'auto_fixed'>} finding
 */
function addFinding(check, finding) {
  check.findings.push({ ...finding, auto_fixed: false });
  if (check.status === 'ok') check.status = 'warn';
}

/**
 * 标记 finding 为 auto_fixed
 * @param {CheckResult} check
 * @param {string} file
 * @param {string} fix
 */
function markAutoFixed(check, file, fix) {
  const f = check.findings.find(x => x.file === file && x.fix === fix);
  if (f) f.auto_fixed = true;
}

/**
 * 计算 summary
 * @param {CheckResult[]} checks
 */
function summarize(checks) {
  const s = { total: checks.length, ok: 0, warn: 0, fail: 0, skip: 0, auto_fixed_count: 0 };
  for (const c of checks) {
    s[c.status]++;
    s.auto_fixed_count += c.findings.filter(f => f.auto_fixed).length;
  }
  return s;
}

/**
 * 写报告到 docs/doc-sentinel/runs/<ISO>.json
 * @param {Report} report
 * @param {string} repoRoot
 * @returns {string} 写入的文件路径
 */
function writeRunFile(report, repoRoot) {
  const runsDir = path.join(repoRoot, 'docs', 'doc-sentinel', 'runs');
  fs.mkdirSync(runsDir, { recursive: true });
  const stamp = report.timestamp.replace(/[:.]/g, '-');
  const filePath = path.join(runsDir, `${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return filePath;
}

/**
 * 列出历次跑报告，按 timestamp 降序
 * @param {string} repoRoot
 * @returns {string[]} 文件路径列表
 */
function listRuns(repoRoot) {
  const runsDir = path.join(repoRoot, 'docs', 'doc-sentinel', 'runs');
  if (!fs.existsSync(runsDir)) return [];
  return fs.readdirSync(runsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => path.join(runsDir, f));
}

/**
 * 读上一次跑的报告
 * @param {string} repoRoot
 * @returns {Report|null}
 */
function readLastRun(repoRoot) {
  const runs = listRuns(repoRoot);
  if (runs.length === 0) return null;
  try {
    return JSON.parse(fs.readFileSync(runs[0], 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  newCheck,
  addFinding,
  markAutoFixed,
  summarize,
  writeRunFile,
  listRuns,
  readLastRun,
};