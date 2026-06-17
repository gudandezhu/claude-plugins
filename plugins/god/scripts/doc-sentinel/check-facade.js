#!/usr/bin/env node
/**
 * check-facade.js — doc-sentinel 巡检统一入口
 *
 * 调用 9 个 check 脚本（V1/N1/D1/F1/T1/P1/G1/C1/M1），
 * 输出统一 Report（report-format.js schema）+ 写 docs/doc-sentinel/runs/<ISO>.json
 *
 * 用法:
 *   node check-facade.js <仓库根>
 *   node check-facade.js <仓库根> --dry-run     # 只输出不写文件
 *   node check-facade.js <仓库根> --check=V1,N1  # 只跑指定 check
 *   node check-facade.js <仓库根> --json        # 输出 JSON（agent 解析用）
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.1
 * 零外部依赖，调用 9 个 check 子模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, summarize, writeRunFile } = require('./report-format');

const CHECKS = [
  { id: 'V1', name: '版本漂移', mod: './check-version-drift' },
  { id: 'N1', name: '编号规约', mod: './check-numbering' },
  { id: 'D1', name: 'demo 三件套', mod: './check-demo-trio' },
  { id: 'F1', name: 'frontmatter status', mod: './check-frontmatter' },
  { id: 'T1', name: 'stale TODO', mod: './check-stale-todo' },
  { id: 'P1', name: '路径引用', mod: './check-path-references' },
  { id: 'G1', name: 'G 状态机', mod: './check-g-state-machine' },
  { id: 'C1', name: 'CHANGELOG 日期', mod: './check-changelog-dates' },
  { id: 'M1', name: '自检', mod: './check-self' },
];

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {
    repoRoot: null,
    dryRun: false,
    checkFilter: null,
    json: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--json') out.json = true;
    else if (a.startsWith('--check=')) out.checkFilter = a.slice(8).split(',');
    else if (!out.repoRoot) out.repoRoot = a;
  }
  return out;
}

function printHelp() {
  console.log(`用法: node check-facade.js <仓库根> [选项]

选项:
  --dry-run            只输出报告不写文件
  --check=V1,N1,...    只跑指定 check（默认全跑 9 类）
  --json               输出 JSON（agent 解析用）

9 类 check:
  V1 版本漂移
  N1 编号规约
  D1 demo 三件套（DASHBOARD/summary/.trace）
  F1 frontmatter status
  T1 stale TODO
  P1 路径引用
  G1 G 状态机一致性
  C1 CHANGELOG 日期
  M1 自检`);
}

async function run(repoRoot, opts) {
  const t0 = Date.now();
  const checks = [];
  const selected = opts.checkFilter || CHECKS.map(c => c.id);

  for (const c of CHECKS) {
    if (!selected.includes(c.id)) continue;
    try {
      const mod = require(c.mod);
      const result = mod.check(repoRoot);
      checks.push(result);
    } catch (err) {
      checks.push({
        id: c.id,
        name: c.name,
        status: 'fail',
        findings: [{
          file: c.mod,
          issue: `check 脚本执行失败: ${err.message}`,
          fix: '查看 stderr 或修复脚本 bug',
          auto_fixed: false,
        }],
        duration_ms: 0,
      });
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - t0,
    checks,
    summary: summarize(checks),
  };

  return report;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const opts = parseArgs();
  if (!opts.repoRoot) {
    console.error('用法: node check-facade.js <仓库根> [选项]');
    printHelp();
    process.exit(1);
  }
  if (!fs.existsSync(opts.repoRoot)) {
    console.error(`✗ 仓库根不存在: ${opts.repoRoot}`);
    process.exit(1);
  }

  const report = await run(opts.repoRoot, opts);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    // 人类可读
    console.log(`\n# doc-sentinel 巡检报告 (${report.timestamp})\n`);
    for (const c of report.checks) {
      const icon = c.status === 'ok' ? '✓' : c.status === 'warn' ? '⚠' : c.status === 'fail' ? '✗' : '⏭';
      console.log(`## ${c.id} ${c.name} [${icon} ${c.status}] (${c.duration_ms}ms)`);
      if (c.findings.length === 0) {
        console.log('  无 finding');
      } else {
        for (const f of c.findings) {
          const fixMark = f.auto_fixed ? ' [已 auto-fix]' : '';
          console.log(`  - ${f.file}: ${f.issue}`);
          console.log(`    修复: ${f.fix}${fixMark}`);
        }
      }
      console.log('');
    }
    const s = report.summary;
    console.log(`# 汇总: ${s.ok} ok / ${s.warn} warn / ${s.fail} fail / ${s.skip} skip / ${s.auto_fixed_count} auto-fixed (总 ${s.total} 类)`);
  }

  if (!opts.dryRun) {
    const written = writeRunFile(report, opts.repoRoot);
    if (!opts.json) console.error(`\n报告写入: ${path.relative(opts.repoRoot, written)}`);
  }

  // 退出码: 有 fail = 2, 有 warn = 1, 全部 ok = 0
  if (report.summary.fail > 0) process.exit(2);
  if (report.summary.warn > 0) process.exit(1);
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('fatal:', err.message);
    process.exit(2);
  });
}

module.exports = { run, CHECKS };