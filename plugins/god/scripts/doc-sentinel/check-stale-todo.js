#!/usr/bin/env node
/**
 * check-stale-todo.js — T1 stale TODO / 占位符检查
 *
 * 检测:
 *   - 含 TODO / FIXME / XXX / TBD / 待补充 / 待填充 / 规划中 的行
 *   - 排除 node_modules/ / bdd-gen/ / test-results/ / __tests__/ / .archive/ / runs/
 *   - 排除设计意图的 dev-gen / test-gen 桩（spec/scripts/dev-gen.js:104 等）
 *
 * 用法:
 *   node check-stale-todo.js <仓库根>
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 T1
 * auto-fix: "待填充"换实际内容（若上下文清晰）— 实际由 agent 决策，脚本只报告
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding } = require('./report-format');

const PATTERNS = [
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bXXX\b/,
  /\bTBD\b/,
  /待补充/,
  /待填充/,
  /规划中/,
];

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'bdd-gen', 'test-results', '__tests__',
  '.archive', 'dist', 'build', 'coverage', 'runs',  // runs/ 是 doc-sentinel 自身历史 JSON 报告，TODO 字段是 schema 字段名
]);

// 排除"设计意图 TODO"（dev-gen / test-gen 桩是设计要求保留的）
const EXCLUDE_FILES = [
  /spec\/scripts\/dev-gen\.js$/,
  /spec\/scripts\/test-gen\.js$/,
  /docs\/rfcs\/000[7-8]-/,
  /docs\/incidents\//,  // incidents 里 TODO 是事故描述
  /docs\/doc-sentinel\/runs\//,  // 兜底：JSON 报告历史
];

function listFilesDeep(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) {
        if (/\.(md|js|sh|json|ts)$/.test(entry.name)) out.push(p);
      }
    }
  }
  walk(dir);
  return out;
}

function isExcludedFile(filePath) {
  return EXCLUDE_FILES.some(re => re.test(filePath));
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('T1', 'stale TODO');

  const files = listFilesDeep(repoRoot);
  const seen = new Map();  // file -> count

  for (const f of files) {
    if (isExcludedFile(f)) continue;
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      for (const pat of PATTERNS) {
        if (pat.test(lines[i])) {
          hits.push({ line: i + 1, text: lines[i].trim().slice(0, 80) });
          break;
        }
      }
    }
    if (hits.length > 0) {
      seen.set(f, hits);
    }
  }

  // 按命中数排序，找 stale 风险
  const sorted = [...seen.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [f, hits] of sorted.slice(0, 50)) {  // 上限 50
    const rel = path.relative(repoRoot, f);
    const sample = hits[0];
    addFinding(check, {
      file: rel,
      issue: `${hits.length} 个 TODO/占位符（首例 L${sample.line}: ${sample.text}）`,
      fix: 'agent 决策：上下文清晰则替换；否则保留 + 加 <!-- TODO: 原因 + 日期 -->',
    });
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

module.exports = { check };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-stale-todo.js <仓库根>');
    process.exit(1);
  }
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.findings.length > 0 ? 1 : 0);
}