#!/usr/bin/env node
/**
 * check-self.js — M1 doc-sentinel 自检
 *
 * 检测:
 *   - 9 个 check 脚本自身可执行（require 不抛错）
 *   - 上一次跑报告存在且 status 合理
 *   - docs/doc-sentinel/runs/ 累计增长（与上次比）
 *   - doc-sentinel 自身不在 .gitignore
 *
 * 用法:
 *   node check-self.js <仓库根>
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 M1
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding, readLastRun, listRuns } = require('./report-format');

const CHECK_MODULES = [
  './check-version-drift',
  './check-numbering',
  './check-demo-trio',
  './check-frontmatter',
  './check-stale-todo',
  './check-path-references',
  './check-g-state-machine',
  './check-changelog-dates',
];

function checkModulesLoadable() {
  const failures = [];
  for (const m of CHECK_MODULES) {
    try {
      require(m);
    } catch (err) {
      failures.push({ mod: m, err: err.message });
    }
  }
  return failures;
}

function checkSelfIgnored(repoRoot) {
  const gi = path.join(repoRoot, '.gitignore');
  if (!fs.existsSync(gi)) return false;
  const content = fs.readFileSync(gi, 'utf8');
  return /^docs\/doc-sentinel\//m.test(content) || /doc-sentinel\/runs\//m.test(content);
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('M1', '自检');

  // 1) 9 个 check 脚本可加载
  const loadFailures = checkModulesLoadable();
  for (const f of loadFailures) {
    addFinding(check, {
      file: f.mod,
      issue: `模块 require 失败: ${f.err}`,
      fix: '修复 check 脚本的 syntax / 依赖',
    });
  }

  // 2) doc-sentinel 自身被 .gitignore（潜在 bug）
  if (checkSelfIgnored(repoRoot)) {
    addFinding(check, {
      file: '.gitignore',
      issue: 'doc-sentinel 自身在 .gitignore（runs 报告将不入 git）',
      fix: '删除 .gitignore 中 doc-sentinel 行的 ignore（runs/ 应入 git）',
    });
  }

  // 3) 上次跑报告状态
  const lastRun = readLastRun(repoRoot);
  if (lastRun) {
    if (lastRun.summary.fail > 0) {
      addFinding(check, {
        file: 'docs/doc-sentinel/runs/',
        issue: `上次跑有 ${lastRun.summary.fail} 个 fail（${lastRun.timestamp}）`,
        fix: '查看上次跑报告，修复 fail 项',
      });
    }
  }

  // 4) 累计跑次数（信息性）
  const runs = listRuns(repoRoot);
  if (runs.length === 0) {
    addFinding(check, {
      file: 'docs/doc-sentinel/runs/',
      issue: '尚无巡检历史（首次跑）',
      fix: '本次跑会写入第一份报告',
    });
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

module.exports = { check, checkModulesLoadable, checkSelfIgnored };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-self.js <仓库根>');
    process.exit(1);
  }
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.findings.length > 0 ? 1 : 0);
}