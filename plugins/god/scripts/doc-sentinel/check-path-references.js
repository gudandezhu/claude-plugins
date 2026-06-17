#!/usr/bin/env node
/**
 * check-path-references.js — P1 代码与文档漂移检查
 *
 * 检测 CLAUDE.md / docs/*.md 内引用的相对路径是否真实存在
 *
 * 用法:
 *   node check-path-references.js <仓库根>
 *     输出 JSON 单条 check 结果
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 P1
 * auto-fix: 删失效引用 / 改路径
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding } = require('./report-format');

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'bdd-gen', 'test-results', '__tests__']);
const SCAN_DOCS = [
  'CLAUDE.md',
  'README.md',
  'docs/architecture.md',
  'docs/roadmap.md',
  'docs/spec-directory.md',
  'docs/conventions.md',
  'docs/failure-modes.md',
  'docs/human-ai-contract.md',
  'docs/CHANGELOG.md',
];

function listMarkdownFilesDeep(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(p);
    }
  }
  walk(dir);
  return out;
}

function extractMdRefs(content) {
  // 匹配 (./xxx.md) 或 (xxx.md) 形式相对路径（不含 http/git）
  const re = /\]\((?!https?:\/\/|\/\/|#)([^)#]+\.md)\)/g;
  const refs = [];
  let m;
  while ((m = re.exec(content)) !== null) refs.push(m[1]);
  return refs;
}

function extractCodePaths(content) {
  // 匹配 scripts/xxx.js, spec/scripts/xxx.js, templates/xxx.sh, etc.
  const re = /(?<![\w/])(scripts\/[a-zA-Z0-9_/-]+\.(?:js|sh)|spec\/scripts\/[a-zA-Z0-9_/-]+\.js|templates\/[a-zA-Z0-9_/-]+\.(?:sh|md|json)|hooks\/[a-zA-Z0-9_/-]+\.sh)/g;
  const refs = [];
  let m;
  while ((m = re.exec(content)) !== null) refs.push(m[1]);
  return refs;
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('P1', '路径引用');

  // 优先扫 EXCLUDE_DIRS 之外的 .md 文件
  const mdFiles = listMarkdownFilesDeep(repoRoot);
  const seenIssues = new Set();  // 去重: file|missing

  for (const f of mdFiles) {
    const rel = path.relative(repoRoot, f);
    const content = fs.readFileSync(f, 'utf8');
    const dir = path.dirname(f);

    // .md 引用
    for (const ref of extractMdRefs(content)) {
      // 移除锚点
      const cleanRef = ref.split('#')[0];
      if (!cleanRef) continue;

      const target = path.resolve(dir, cleanRef);
      if (!fs.existsSync(target)) {
        const key = `${rel}|${ref}`;
        if (!seenIssues.has(key)) {
          seenIssues.add(key);
          addFinding(check, {
            file: rel,
            issue: `引用失效 (${ref})`,
            fix: `删除该引用行或修正路径（target 不存在: ${path.relative(repoRoot, target)}）`,
          });
        }
      }
    }

    // 代码路径引用
    for (const ref of extractCodePaths(content)) {
      const target = path.resolve(repoRoot, ref);
      if (!fs.existsSync(target)) {
        const key = `${rel}|${ref}`;
        if (!seenIssues.has(key)) {
          seenIssues.add(key);
          addFinding(check, {
            file: rel,
            issue: `代码路径失效 (${ref})`,
            fix: `删除该引用行或修正路径（target 不存在: ${path.relative(repoRoot, target)}）`,
          });
        }
      }
    }
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

module.exports = { check, extractMdRefs, extractCodePaths };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-path-references.js <仓库根>');
    process.exit(1);
  }
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.findings.length > 0 ? 1 : 0);
}