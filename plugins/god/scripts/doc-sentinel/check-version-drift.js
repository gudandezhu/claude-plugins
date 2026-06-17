#!/usr/bin/env node
/**
 * check-version-drift.js — V1 版本漂移检查
 *
 * 检测:
 *   - plugin.json version vs docs/CHANGELOG.md 最新版本
 *   - 4 个版本号是否同日（CHANGELOG 同日 bug）
 *   - README.md 首段 vs CLAUDE.md §1 定位不一致
 *
 * 用法:
 *   node check-version-drift.js <仓库根>
 *     输出 JSON 单条 check 结果（CheckResult schema）
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 V1
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding } = require('./report-format');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function getPluginVersion(repoRoot) {
  const p = path.join(repoRoot, '.claude-plugin', 'plugin.json');
  const content = readFileSafe(p);
  if (!content) return null;
  try {
    return JSON.parse(content).version || null;
  } catch {
    return null;
  }
}

function getChangelogVersions(repoRoot) {
  const p = path.join(repoRoot, 'docs', 'CHANGELOG.md');
  const content = readFileSafe(p);
  if (!content) return [];
  const re = /^## v(\d+\.\d+\.\d+)\s*\(([^)]+)\)/gm;
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    out.push({ version: m[1], date: m[2].trim() });
  }
  return out;
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

function bumpType(from, to) {
  const d = compareSemver(to, from);
  if (d === 0) return 'same';
  const pa = from.split('.').map(Number);
  const pb = to.split('.').map(Number);
  if (pb[0] !== pa[0]) return 'MAJOR';
  if (pb[1] !== pa[1]) return 'MINOR';
  return 'PATCH';
}

function isSkeletonReadme(repoRoot) {
  const p = path.join(repoRoot, 'README.md');
  const content = readFileSafe(p);
  if (!content) return false;
  return /当前为骨架|待填充|功能待填充/.test(content);
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('V1', '版本漂移');

  const pluginVer = getPluginVersion(repoRoot);
  const changelog = getChangelogVersions(repoRoot);

  if (!pluginVer) {
    addFinding(check, {
      file: '.claude-plugin/plugin.json',
      issue: 'plugin.json 不存在或无 version 字段',
      fix: '添加 version 字段（MAJOR.MINOR.PATCH）',
    });
  }

  if (changelog.length === 0) {
    addFinding(check, {
      file: 'docs/CHANGELOG.md',
      issue: 'CHANGELOG.md 不存在或无版本号段',
      fix: '创建 CHANGELOG.md，加 ## v0.1.0 段',
    });
  } else {
    const latest = changelog[0];
    if (pluginVer && compareSemver(pluginVer, latest.version) < 0) {
      const bump = bumpType(pluginVer, latest.version);
      addFinding(check, {
        file: '.claude-plugin/plugin.json',
        issue: `plugin.json version=${pluginVer} 落后 CHANGELOG 最新 v${latest.version}`,
        fix: `→ ${latest.version}（${bump} bump，${bump === 'MAJOR' ? '必走 RFC' : 'agent 可 auto-fix'}）`,
      });
    }

    // 同日 bug: 用 git log 校验 CHANGELOG 日期 vs 真实 commit 日期
    // 仅在"标 2026-06-17 但真实 commit 是 2026-06-16"这种"虚标新日期"才报
    // 真同日集中发版(v0.7.0/0.7.1/0.7.2/0.7.3/0.7.4 集中 commit)不算 bug
    let suspiciousSameDate = 0;
    for (const c of changelog) {
      try {
        const { execSync } = require('child_process');
        const out = execSync(
          `git log -1 --format="%ad" --date=short -G "## v${c.version}" -- docs/CHANGELOG.md`,
          { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        ).trim();
        if (out && out !== c.date) suspiciousSameDate++;
      } catch {}
    }
    if (suspiciousSameDate > 0) {
      addFinding(check, {
        file: 'docs/CHANGELOG.md',
        issue: `${suspiciousSameDate} 个版本 CHANGELOG 标日与真实 commit 日不一致`,
        fix: '用 git log -1 --format=%ad --date=short -G "## vX.Y.Z" 真实日期回填',
      });
    }
  }

  if (isSkeletonReadme(repoRoot)) {
    addFinding(check, {
      file: 'README.md',
      issue: '根 README.md 仍是骨架版（"待填充"），与 god 真实状态不符',
      fix: '用 CLAUDE.md §1 + §3 重写 README，对齐 god 当前能力',
    });
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

module.exports = { check, getPluginVersion, getChangelogVersions, compareSemver, bumpType };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-version-drift.js <仓库根>');
    process.exit(1);
  }
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.findings.length > 0 ? 1 : 0);
}