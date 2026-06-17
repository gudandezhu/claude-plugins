#!/usr/bin/env node
/**
 * init-spec-dir.js — 一次性建好 spec/ 子目录结构（v0.5.0+ G13 落地）
 *
 * 用法:
 *   node init-spec-dir.js <项目目录>
 *
 * 行为:
 *   建好 spec/ 下 4 个子目录 + 必要的占位文件（让 AI 不会乱放产物）：
 *     state/      meta.json 占位（让 spec-cli init 能找到路径）
 *     review/     空目录（spec-render 会写 review-<date>.md）
 *     domain/     domain.md 占位（让 prd 阶段 0 有加载目标）
 *     sources/user-perspectives/  占位 _summary.md（让 user-perspective-analyzer 有写入目标）
 *
 *   同时在每个子目录放一个 .gitkeep，git 提交时保留目录结构。
 *
 * 设计依据: docs/spec-directory.md v0.5.0 §1
 * 零外部依赖。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SUBDIRS = [
  { dir: 'state', placeholder: null },
  { dir: 'review', placeholder: null },
  { dir: 'domain', placeholder: 'domain/domain.md', template: 'domain.md' },
  { dir: 'sources/user-perspectives', placeholder: 'sources/user-perspectives/_summary.md' },
];

const PLACEHOLDER_CONTENT = {
  'domain/domain.md': `# {feature-name} — 领域知识入口

> god v0.5.0+ G10 落地。prd 阶段 0 自动加载本文件,brainstorm / build-spec / spec-review 共享术语表。
> 模板: \${CLAUDE_PLUGIN_ROOT}/templates/domain.md v0.1.0
> 修改请直接覆写本文件,不要新建 \`spec/domain/<feature>.md\`(多 feature 项目用 \`spec/<feature>/domain.md\` 扩展,**预留,未实现**)。

## 业务背景（≤ 3 句）

{domain-brief}

## 核心术语表

| 术语 | 业务定义 | 误用警告 |
|------|----------|----------|
| {term-1} | {business-def} | {avoid-confusing-with-X} |
| ... | ... | ... |

## 角色清单

| 角色 | 业务定位 | 关心什么 |
|------|----------|----------|
| {role-1} | {role-brief} | {role-concerns} |

## 业务流程骨架

1. {step-1}: {actor} → {action} → {outcome}
2. ...

## 反模式

- ❌ {anti-pattern-1}: {why-bad}
- ...

## 关联文档

- 需求清单: spec/sources.md
- 行为规格: spec/spec.feature
- 一页纸摘要: spec/summary.md
- 评审产物: spec/review/
`,
  'sources/user-perspectives/_summary.md': `# User Perspectives — 汇总

> god v0.5.0+ 落地。prd 阶段 1 M3 C2 通过后由 user-perspective-analyzer 产出。
> 各角色文档: \`spec/sources/user-perspectives/{role}.md\`
> 模板: \${CLAUDE_PLUGIN_ROOT}/templates/user-perspective.md(待建)

## 角色清单

| 角色 | 文档路径 | 关键发现 |
|------|----------|----------|
| {role-1} | spec/sources/user-perspectives/{role-1}.md | {finding} |
| ... | ... | ... |

## 跨角色冲突

- {conflict-1}: {role-a} 想 X,{role-b} 想 Y — 解决方案: {resolution}

## 隐性需求

- {hidden-need-1}: {why}
- ...
`,
};

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writePlaceholder(p, content) {
  if (fs.existsSync(p)) return false;  // 已存在不覆盖
  fs.writeFileSync(p, content, 'utf8');
  return true;
}

function writeGitkeep(dir) {
  const g = path.join(dir, '.gitkeep');
  if (!fs.existsSync(g)) fs.writeFileSync(g, '', 'utf8');
}

function writeEmptyTrace(specDir) {
  // v0.5.0+ G13: 强制 .trace 写到 spec/state/.trace（旧 fallback spec/.trace 已废弃）
  // 空文件占位让 spec-cli.js 的 tracePath() 命中新路径
  const t = path.join(specDir, 'state', '.trace');
  if (!fs.existsSync(t)) fs.writeFileSync(t, '', 'utf8');
}

function main() {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    const { printHelp } = require('./_lib/help');
    printHelp(__filename);
    process.exit(0);
  }
  const projectDir = process.argv[2] || process.cwd();
  const specDir = path.join(projectDir, 'spec');
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }
  ensureDir(specDir);

  const created = [];
  for (const { dir, placeholder, template } of SUBDIRS) {
    const fullDir = path.join(specDir, dir);
    ensureDir(fullDir);
    writeGitkeep(fullDir);
    created.push(dir);
    if (placeholder) {
      const fullPath = path.join(specDir, placeholder);
      const content = PLACEHOLDER_CONTENT[placeholder];
      if (content) {
        if (writePlaceholder(fullPath, content)) {
          created.push(`${placeholder} (placeholder)`);
        } else {
          created.push(`${placeholder} (exists, skipped)`);
        }
      }
    }
  }

  // v0.5.0+ G13: 建好空 state/.trace 占位,避免 spec-cli tracePath() 落到 legacy spec/.trace
  // 必须在 for 循环后,state/ 已建
  writeEmptyTrace(specDir);

  console.log(`✓ spec/ 子目录结构已建（v0.5.0+ G13）`);
  for (const c of created) console.log(`  + ${c}`);
  console.log(``);
  console.log(`结构:`);
  console.log(`  spec/`);
  console.log(`  ├── sources.md       (build-spec 阶段 AI 写)`);
  console.log(`  ├── spec.feature     (build-spec 阶段 AI 写)`);
  console.log(`  ├── summary.md       (spec-summary.js 自动)`);
  console.log(`  ├── state/`);
  console.log(`  │   ├── meta.json    (spec-cli.js 自动)`);
  console.log(`  │   └── .trace       (spec-cli.js 自动)`);
  console.log(`  ├── review/`);
  console.log(`  │   └── review-YYYY-MM-DD.md  (spec-render.js 自动)`);
  console.log(`  ├── domain/`);
  console.log(`  │   └── domain.md    (prd 阶段 0 AI 填,模板已就位)`);
  console.log(`  └── sources/`);
  console.log(`      └── user-perspectives/`);
  console.log(`          ├── _summary.md  (user-perspective-analyzer 自动)`);
  console.log(`          └── {role}.md    (user-perspective-analyzer 自动)`);
}

if (require.main === module) main();
