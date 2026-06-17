#!/usr/bin/env node
/**
 * check-changelog-dates.js — C1 CHANGELOG 时间戳真实性检查
 *
 * 检测:
 *   - CHANGELOG.md 中版本日期是否与该版本首次出现 commit 的真实日期一致
 *
 * 用法:
 *   node check-changelog-dates.js <仓库根>
 *     输出 JSON 单条 check 结果
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 C1
 * auto-fix: 用 commit 真实日期回填（仅当 commit hash 已知时）
 * 零外部依赖，调用 git CLI。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { newCheck, addFinding } = require('./report-format');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function gitLog(repoRoot, file, version) {
  // 找该版本号首次在 CHANGELOG.md 中出现的 commit（不依赖 diff-filter=A）
  try {
    const out = execSync(
      `git log --format="%ad|%H" -G "## v${version}" --date=short -- "${file}"`,
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const lines = out.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    // 取最后一行(最旧一次出现 = 首次引入)
    const [date, hash] = lines[lines.length - 1].split('|');
    return { date, hash };
  } catch {
    return null;
  }
}

function parseVersions(content) {
  const re = /^## v(\d+\.\d+\.\d+)\s*\(([^)]+)\)/gm;
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    out.push({ version: m[1], date: m[2].trim(), index: m.index, full: m[0] });
  }
  return out;
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('C1', 'CHANGELOG 日期');

  const p = path.join(repoRoot, 'docs', 'CHANGELOG.md');
  const content = readFileSafe(p);
  if (!content) {
    addFinding(check, {
      file: 'docs/CHANGELOG.md',
      issue: 'CHANGELOG.md 不存在',
      fix: '创建 CHANGELOG.md',
    });
    check.duration_ms = Date.now() - t0;
    return check;
  }

  const versions = parseVersions(content);
  if (versions.length < 2) {
    check.duration_ms = Date.now() - t0;
    return check;
  }

  // 同日 bug: 多版本同日期
  const dateCounts = {};
  for (const v of versions) {
    dateCounts[v.date] = (dateCounts[v.date] || 0) + 1;
  }
  const dupDates = Object.entries(dateCounts).filter(([_, c]) => c >= 2);

  if (dupDates.length === 0) {
    check.duration_ms = Date.now() - t0;
    return check;
  }

  // 对每个版本尝试找真实日期
  for (const v of versions) {
    const log = gitLog(repoRoot, 'docs/CHANGELOG.md', v.version);
    if (log && log.date !== v.date) {
      addFinding(check, {
        file: 'docs/CHANGELOG.md',
        issue: `v${v.version} 标 ${v.date}，真实 commit 日期 ${log.date}（commit ${log.hash.slice(0, 7)}）`,
        fix: `改为 (${log.date})`,
      });
    }
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

/**
 * 实施 auto-fix: 用 commit 真实日期回填
 * @param {string} repoRoot
 * @returns {{fixed: number, remaining: number}}
 */
function autoFix(repoRoot) {
  const p = path.join(repoRoot, 'docs', 'CHANGELOG.md');
  let content = readFileSafe(p);
  if (!content) return { fixed: 0, remaining: 0 };

  const versions = parseVersions(content);
  const dateCounts = {};
  for (const v of versions) dateCounts[v.date] = (dateCounts[v.date] || 0) + 1;
  const dupDates = Object.entries(dateCounts).filter(([_, c]) => c >= 2);
  if (dupDates.length === 0) return { fixed: 0, remaining: 0 };

  let fixed = 0;
  let remaining = 0;
  for (const v of versions) {
    const log = gitLog(repoRoot, 'docs/CHANGELOG.md', v.version);
    if (log && log.date !== v.date) {
      const newHeader = `## v${v.version} (${log.date})`;
      const oldHeader = `## v${v.version} (${v.date})`;
      if (content.includes(oldHeader)) {
        content = content.replace(oldHeader, newHeader);
        fixed++;
      } else {
        remaining++;
      }
    }
  }

  if (fixed > 0) {
    fs.writeFileSync(p, content, 'utf8');
  }
  return { fixed, remaining };
}

module.exports = { check, autoFix, parseVersions, gitLog };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-changelog-dates.js <仓库根> [--fix]');
    process.exit(1);
  }
  const dryRun = !process.argv.includes('--fix');
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));

  if (!dryRun && result.findings.length > 0) {
    const { autoFix: fix } = require('./check-changelog-dates');
    const { fixed, remaining } = fix(repoRoot);
    console.error(`\n[--fix] 已回填 ${fixed} 个版本（${remaining} 个需人工）`);
  }

  process.exit(result.findings.length > 0 ? 1 : 0);
}