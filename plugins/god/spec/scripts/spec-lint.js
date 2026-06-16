#!/usr/bin/env node
/**
 * spec-lint.js — spec/ 目录结构守门（v0.5.0+ G13 落地）
 *
 * 用法:
 *   node spec-lint.js <项目目录>
 *
 * 行为:
 *   校验 spec/ 目录是否符合 docs/spec-directory.md v0.5.0 §1 规范。
 *   - 顶层只允许 3 个文件: sources.md / spec.feature / summary.md
 *   - 子目录: state/ review/ domain/ .archive/ sources/
 *   - sources/ 下只允许 user-perspectives/
 *   - 任何不在白名单的文件/目录都报错
 *
 * 错误示例:
 *   ✗ spec/sources-lead-tag.md（AI 误建的多 feature sources,应放 spec/sources/ 或合并到 spec/sources.md）
 *   ✗ spec/domain/lead-scoring.md（AI 误建的 feature-level domain,应放 spec/<feature>/domain.md,**预留,未实现** → 合并到 domain/domain.md）
 *   ✗ spec/review.md（应放 spec/review/review-<date>.md）
 *   ✗ spec/meta.json（应放 spec/state/meta.json）
 *   ✗ spec/.trace（应放 spec/state/.trace）
 *
 * 设计依据: docs/spec-directory.md v0.5.0 §1
 * 零外部依赖。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 顶层白名单
const TOP_ALLOWED = new Set([
  'sources.md',
  'spec.feature',
  'summary.md',
  'state',
  'review',
  'domain',
  'archive',
  '.archive',
  'sources',
]);

// 子目录白名单
const SUBDIR_ALLOWED = {
  'state': new Set(['meta.json', '.trace']),
  'review': null,  // 任意 review-*.md 允许
  'domain': new Set(['domain.md']),
  'sources': new Set(['user-perspectives']),
  'sources/user-perspectives': null,  // 任意 {role}.md + _summary.md 允许
  'archive': null,
  '.archive': null,
};

function walkSpec(specDir, violations) {
  if (!fs.existsSync(specDir)) {
    violations.push(`✗ spec/ 目录不存在: ${specDir}`);
    return;
  }
  const entries = fs.readdirSync(specDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;  // 隐藏文件 (.gitkeep, .DS_Store) 忽略
    if (!TOP_ALLOWED.has(e.name)) {
      violations.push(`✗ spec/${e.name}（不在顶层白名单。允许：sources.md / spec.feature / summary.md / state / review / domain / archive / sources）`);
    }
    // 进入子目录校验
    if (e.isDirectory() && SUBDIR_ALLOWED[e.name] !== undefined) {
      walkSub(specDir, e.name, SUBDIR_ALLOWED[e.name], violations);
    }
  }
}

function walkSub(specDir, rel, allowed, violations) {
  const full = path.join(specDir, rel);
  const entries = fs.readdirSync(full, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (allowed === null) {
      // 任意文件名允许（review/ archive/ user-perspectives/）
      // 但禁止子目录下再嵌套子目录
      if (e.isDirectory()) {
        violations.push(`✗ spec/${rel}/${e.name}/（${rel}/ 下禁止嵌套子目录）`);
      }
      continue;
    }
    if (!allowed.has(e.name)) {
      violations.push(`✗ spec/${rel}/${e.name}（不在 ${rel}/ 白名单: ${[...allowed].join(', ')}）`);
    }
  }
}

function main() {
  const projectDir = process.argv[2] || process.cwd();
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }
  const specDir = path.join(projectDir, 'spec');
  const violations = [];
  walkSpec(specDir, violations);

  if (violations.length === 0) {
    console.log(`✓ spec/ 目录结构合规（v0.5.0+ G13）`);
    console.log(`  项目: ${projectDir}`);
    process.exit(0);
  } else {
    console.error(`✗ spec/ 目录结构违规（${violations.length} 项）:`);
    for (const v of violations) console.error(`  ${v}`);
    console.error(``);
    console.error(`规范: docs/spec-directory.md v0.5.0 §1`);
    console.error(`修复: 运行 node spec/scripts/init-spec-dir.js <项目> 建好结构,然后把违规文件移到正确位置。`);
    process.exit(1);
  }
}

if (require.main === module) main();
