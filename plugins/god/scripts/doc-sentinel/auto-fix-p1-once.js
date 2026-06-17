#!/usr/bin/env node
/**
 * auto-fix-p1-once.js — 一次性 P1 auto-fix（清库用）
 *
 * 对每个 finding 找包含 ref 的 md 行,删除整行(空行保留)。
 * 保护: spec/spec.feature / spec/sources.md / commands/*.md / docs/adrs/* / spec/scripts/*.js
 * 写报告 docs/doc-sentinel/runs/<ISO>-p1-autofix.json
 * 零外部依赖。
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { check } = require('./check-path-references');

const repoRoot = process.argv[2] || process.cwd();
const PROTECT_FILES = [
  /^spec\/spec\.feature$/,
  /^spec\/sources\.md$/,
  /^commands\/.+\.md$/,
  /^docs\/adrs\/.+$/,
  /^spec\/scripts\/.+\.js$/,
];

const result = check(repoRoot);
const findings = result.findings || [];
const stats = { total: findings.length, fixed: 0, skipped: 0, byFile: {} };

for (const f of findings) {
  const fp = path.join(repoRoot, f.file);
  if (!fs.existsSync(fp)) {
    stats.skipped++;
    continue;
  }
  if (PROTECT_FILES.some(re => re.test(f.file))) {
    stats.skipped++;
    continue;
  }
  const refMatch = f.issue.match(/\(([^)]+)\)/);
  if (!refMatch) {
    stats.skipped++;
    continue;
  }
  const ref = refMatch[1];
  const content = fs.readFileSync(fp, 'utf8');
  const lines = content.split('\n');
  const newLines = lines.filter(line => {
    // 删包含 ref 的非注释行
    if (line.includes(ref) && !line.trimStart().startsWith('<!--')) return false;
    return true;
  });
  fs.writeFileSync(fp, newLines.join('\n'), 'utf8');
  stats.fixed++;
  stats.byFile[f.file] = (stats.byFile[f.file] || 0) + 1;
}

const reportDir = path.join(repoRoot, 'docs/doc-sentinel/runs');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
const reportFile = path.join(reportDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-p1-autofix.json`);
const report = { ...stats, timestamp: new Date().toISOString() };
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\n报告写入: ${path.relative(repoRoot, reportFile)}`);
