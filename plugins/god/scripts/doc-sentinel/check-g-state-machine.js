#!/usr/bin/env node
/**
 * check-g-state-machine.js — G1 G 编号状态机一致性检查
 *
 * 检测 4 路来源:
 *   - CLAUDE.md §5 已落地 G 列表
 *   - docs/roadmap.md §1 速览表
 *   - spec/scripts/<name>.js 实际文件
 *   - docs/rfcs/ 实际文件
 *
 * 找不一致：4 路中 3 路一致时 fix 第 4 路（agent 决策）
 *
 * 用法:
 *   node check-g-state-machine.js <仓库根>
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 G1
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding } = require('./report-format');

const G_NUM = /\bG(\d+(?:\.\d+)?)\b/;

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function extractGFromClaude(repoRoot) {
  // CLAUDE.md §5 标 ✅ 的 G 编号
  const p = path.join(repoRoot, 'CLAUDE.md');
  const content = readFileSafe(p);
  if (!content) return new Set();
  const out = new Set();
  // 匹配各种形式: G7, G13.1, **G3**, "G1+G2", "G1、G2", "落 G7", "G3 hook"
  const re = /\bG(\d+(?:\.\d+)?)\b/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    out.add(m[1]);
  }
  return out;
}

function extractGFromRoadmap(repoRoot) {
  const p = path.join(repoRoot, 'docs', 'roadmap.md');
  const content = readFileSafe(p);
  if (!content) return new Set();
  const out = new Set();
  const re = /\bG(\d+(?:\.\d+)?)\b/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    out.add(m[1]);
  }
  return out;
}

function extractGFromScripts(repoRoot) {
  const dir = path.join(repoRoot, 'spec', 'scripts');
  if (!fs.existsSync(dir)) return new Set();
  const out = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const content = readFileSafe(path.join(dir, f));
    if (!content) continue;
    const re = /\bG(\d+(?:\.\d+)?)\b/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      out.add(m[1]);
    }
  }
  return out;
}

function extractGFromRFCs(repoRoot) {
  const dir = path.join(repoRoot, 'docs', 'rfcs');
  if (!fs.existsSync(dir)) return new Set();
  const out = new Set();
  for (const f of fs.readdirSync(dir)) {
    const content = readFileSafe(path.join(dir, f));
    if (!content) continue;
    const re = /\bG(\d+(?:\.\d+)?)\b/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      out.add(m[1]);
    }
  }
  return out;
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('G1', 'G 状态机');

  const sources = {
    'CLAUDE.md §5': extractGFromClaude(repoRoot),
    'roadmap.md §1': extractGFromRoadmap(repoRoot),
    'spec/scripts/*.js': extractGFromScripts(repoRoot),
    'docs/rfcs/': extractGFromRFCs(repoRoot),
  };

  // 收集所有 G 编号
  const allG = new Set();
  for (const s of Object.values(sources)) {
    for (const g of s) allG.add(g);
  }

  // 4 路对齐
  for (const g of [...allG].sort()) {
    const present = Object.entries(sources)
      .filter(([_, s]) => s.has(g))
      .map(([name]) => name);
    const missing = Object.entries(sources)
      .filter(([_, s]) => !s.has(g))
      .map(([name]) => name);

    if (missing.length > 0 && missing.length < 4) {
      addFinding(check, {
        file: missing.map(n => n.includes('.md') ? n : n).join(' + '),
        issue: `G${g} 在 ${present.join(' + ')} 出现，缺 ${missing.join(' + ')}`,
        fix: `4 路补齐：CLAUDE.md / roadmap.md / spec/scripts / docs/rfcs 需统一提及 G${g}`,
      });
    }
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

module.exports = { check, extractGFromClaude, extractGFromRoadmap, extractGFromScripts, extractGFromRFCs };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-g-state-machine.js <仓库根>');
    process.exit(1);
  }
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.findings.length > 0 ? 1 : 0);
}