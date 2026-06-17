#!/usr/bin/env node
/**
 * check-demo-trio.js — D1 demo 三件套齐备性检查
 *
 * 检测每个 demo/<name>/ 是否含 DASHBOARD.md + spec/summary.md + spec/state/.trace
 * 不强制含 spec/.archive/，仅报告
 *
 * 用法:
 *   node check-demo-trio.js <仓库根>
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 D1
 * auto-fix: 复制 lead-scoring 模板填占位（agent 仅做机械复制）
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding } = require('./report-format');

const REQUIRED = [
  { rel: 'DASHBOARD.md', desc: '自我监控 dashboard' },
  { rel: 'spec/summary.md', desc: 'spec 人话摘要' },
  { rel: 'spec/state/.trace', desc: 'spec 事件流' },
];

const OPTIONAL = [
  { rel: 'spec/.archive/', desc: 'spec 不可变快照' },
  { rel: 'spec/state/meta.json', desc: 'spec 状态机' },
];

function listDemos(repoRoot) {
  const demosDir = path.join(repoRoot, 'demo');
  if (!fs.existsSync(demosDir)) return [];
  return fs.readdirSync(demosDir)
    .filter(d => {
      const p = path.join(demosDir, d);
      return fs.statSync(p).isDirectory();
    })
    .map(d => path.join(demosDir, d));
}

function findTemplateDemo(repoRoot) {
  // 找含 DASHBOARD.md + spec/summary.md + spec/state/.trace 全配齐的 demo
  const demos = listDemos(repoRoot);
  for (const d of demos) {
    const allExist = REQUIRED.every(r => fs.existsSync(path.join(d, r.rel)));
    if (allExist) return d;
  }
  return null;
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('D1', 'demo 三件套');

  const demos = listDemos(repoRoot);
  if (demos.length === 0) {
    addFinding(check, {
      file: 'demo/',
      issue: 'demo/ 目录不存在或为空',
      fix: '创建 demo/<project>/ 目录',
    });
    check.duration_ms = Date.now() - t0;
    return check;
  }

  const template = findTemplateDemo(repoRoot);

  for (const demo of demos) {
    const name = path.basename(demo);
    const rel = `demo/${name}/`;
    const missing = [];
    for (const r of REQUIRED) {
      if (!fs.existsSync(path.join(demo, r.rel))) {
        missing.push(r);
      }
    }

    if (missing.length > 0) {
      const fixDesc = template
        ? `从 ${path.relative(repoRoot, template)} 复制 ${missing.map(m => m.rel).join(' + ')} 模板到 ${rel}，占位待人工填`
        : `手动创建 ${missing.map(m => m.rel).join(' + ')}（无模板 demo）`;
      addFinding(check, {
        file: rel,
        issue: `缺 demo 三件套: ${missing.map(m => `${m.rel}（${m.desc}）`).join(', ')}`,
        fix: fixDesc,
      });
    }

    // 可选件检测（仅 warn）
    for (const r of OPTIONAL) {
      if (!fs.existsSync(path.join(demo, r.rel))) {
        addFinding(check, {
          file: rel,
          issue: `缺可选件 ${r.rel}（${r.desc}）`,
          fix: '可后续补充（不影响 P0 闭环）',
        });
      }
    }
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

/**
 * 实施 auto-fix: 复制模板 demo 的 DASHBOARD.md / spec/summary.md / spec/state/.trace
 * @param {string} repoRoot
 * @param {string} targetDemo
 * @returns {string[]} 复制的文件路径（相对仓库根）
 */
function autoFix(repoRoot, targetDemo) {
  const template = findTemplateDemo(repoRoot);
  if (!template) return [];
  const target = path.join(repoRoot, 'demo', targetDemo);
  const copied = [];

  for (const r of REQUIRED) {
    const src = path.join(template, r.rel);
    const dst = path.join(target, r.rel);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      copied.push(path.relative(repoRoot, dst));
    }
  }
  return copied;
}

module.exports = { check, autoFix, listDemos, REQUIRED, OPTIONAL };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-demo-trio.js <仓库根> [--fix=<demo-name>]');
    process.exit(1);
  }
  const fixArg = process.argv.find(a => a.startsWith('--fix='));
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));

  if (fixArg && result.findings.length > 0) {
    const { autoFix: fix } = require('./check-demo-trio');
    const targetDemo = fixArg.slice(6);
    const copied = fix(repoRoot, targetDemo);
    console.error(`\n[--fix] 已复制 ${copied.length} 个文件到 demo/${targetDemo}/`);
  }

  process.exit(result.findings.length > 0 ? 1 : 0);
}