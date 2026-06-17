#!/usr/bin/env node
/**
 * check-numbering.js — N1 编号规约检查
 *
 * 检测:
 *   - docs/rfcs/ 编号唯一性（4 位补零）
 *   - docs/adrs/ 编号唯一性（4 位补零）
 *   - 3 位编号残留（应改为 4 位）
 *
 * 用法:
 *   node check-numbering.js <仓库根>
 *     输出 JSON 单条 check 结果
 *
 * 设计依据: docs/conventions.md §1.8 + docs/adrs/0012-doc-sentinel.md §3.2 N1
 * 撞车不 auto-fix（破坏外部引用），仅报告
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding } = require('./report-format');

const NUMBER_4 = /^(\d{4})-/;
const NUMBER_3 = /^(\d{3})-[^0-9]/;

function listNumbered(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => NUMBER_4.test(f) || NUMBER_3.test(f))
    .map(f => {
      const m4 = f.match(NUMBER_4);
      if (m4) return { file: f, num: m4[1], format: '4-digit' };
      const m3 = f.match(NUMBER_3);
      return { file: f, num: '0' + m3[1], format: '3-digit' };
    });
}

function findDuplicates(items) {
  const counts = {};
  for (const it of items) {
    counts[it.num] = counts[it.num] || [];
    counts[it.num].push(it.file);
  }
  return Object.entries(counts)
    .filter(([_, files]) => files.length > 1)
    .map(([num, files]) => ({ num, files }));
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('N1', '编号规约');

  const rfcs = listNumbered(path.join(repoRoot, 'docs', 'rfcs'));
  const adrs = listNumbered(path.join(repoRoot, 'docs', 'adrs'));

  // 撞车检测（按 num 而非按 file 名，0009 vs 0009-god-self-monitoring 等）
  const rfcDups = findDuplicates(rfcs);
  for (const dup of rfcDups) {
    addFinding(check, {
      file: 'docs/rfcs/',
      issue: `编号 ${dup.num} 撞车（${dup.files.length} 个文件）：${dup.files.join(', ')}`,
      fix: '人工 RFC：保留 1 个，其余改号或合并（agent 不 auto-fix 改编号）',
    });
  }

  const adrDups = findDuplicates(adrs);
  for (const dup of adrDups) {
    addFinding(check, {
      file: 'docs/adrs/',
      issue: `编号 ${dup.num} 撞车（${dup.files.length} 个文件）：${dup.files.join(', ')}`,
      fix: '人工 RFC：保留 1 个，其余改号或合并',
    });
  }

  // 3 位编号残留
  const legacy3 = [...rfcs, ...adrs].filter(it => it.format === '3-digit');
  for (const it of legacy3) {
    const newName = it.file.replace(/^(\d{3})-/, '0$1-');
    const subDir = rfcs.includes(it) ? 'docs/rfcs/' : 'docs/adrs/';
    addFinding(check, {
      file: subDir + it.file,
      issue: `3 位编号残留（${it.num.slice(1)}），应为 4 位补零`,
      fix: `git mv ${subDir}${it.file} ${subDir}${newName}`,
    });
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

module.exports = { check, listNumbered, findDuplicates };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-numbering.js <仓库根>');
    process.exit(1);
  }
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.findings.length > 0 ? 1 : 0);
}