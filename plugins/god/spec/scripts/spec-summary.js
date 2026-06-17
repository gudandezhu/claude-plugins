#!/usr/bin/env node
/**
 * spec-summary.js — OPC 验收界面（G8）
 *
 * 用法:
 *   node spec-summary.js gen [project-dir]
 *     读 spec/spec.feature + spec/sources.md → 写 spec/summary.md
 *     project-dir 默认 cwd
 *
 *   node spec-summary.js check [project-dir]
 *     校验 summary.md 存在 + ≤ 100 行 + 不含 Gherkin 关键词
 *     + 末尾含"详细 spec"链接 + 含"不在范围内"段
 *     exit 0 通过 / exit 1 失败
 *
 * 设计依据: docs/rfcs/0002-spec-summary.md
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- 常量 ----------

const TEMPLATE_PATH = path.join(
  __dirname, '..', '..', 'templates', 'spec-summary', 'v0.1.0.md'
);

const GHERKIN_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But', 'Scenario', 'Feature'];
const SC_PATTERN = /\bSC-\d{3}\b/;

const MAX_SUMMARY_LINES = 100;
const MIN_OOS_ITEMS = 3;
const MAX_OOS_ITEMS = 7;

// ---------- 工具函数 ----------

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function findSpecDir(projectDir) {
  // 优先 spec/spec.feature，回退 spec.feature（demo 根目录）
  if (readFileSafe(path.join(projectDir, 'spec', 'spec.feature'))) {
    return path.join(projectDir, 'spec');
  }
  if (readFileSafe(path.join(projectDir, 'spec.feature'))) {
    return projectDir;
  }
  return null;
}

function parseSpecMetadata(specContent) {
  // 找 @spec-version 行号 + Feature: 行号（算行号范围给"详细 spec"链接用）
  const lines = specContent.split('\n');
  let versionLine = null;
  let featureLine = null;
  let featureName = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!versionLine && /^@spec-version\s+/.test(line)) {
      versionLine = i + 1;
    }
    if (!featureLine && /^Feature:\s*/.test(line)) {
      featureLine = i + 1;
      featureName = line.replace(/^Feature:\s*/, '').trim();
    }
  }
  return {
    versionLine: versionLine || 1,
    featureLine: featureLine || 1,
    featureName: featureName || '(unnamed)',
    endLine: lines.length,
  };
}

function parseSources(sourcesContent) {
  // 简单段落解析：从 sources.md 提取目标/角色/边界/不在范围
  // 段头识别：## Goal / ## 目标 / ## 角色 + 核心流程 / ## 边界 / ## Out of Scope
  const sections = {
    goal: '',
    roles: '',
    boundary: '',
    oos: '',
  };
  const lines = sourcesContent.split('\n');
  let currentSection = null;
  let buffer = [];
  const flush = () => {
    if (currentSection) {
      sections[currentSection] = buffer.join('\n').trim();
    }
  };
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      flush();
      buffer = [];
      const header = headerMatch[1].trim().toLowerCase();
      if (/^(goal|目标)$/.test(header)) currentSection = 'goal';
      else if (/(角色|core\s*flow|核心流程)/.test(header)) currentSection = 'roles';
      else if (/(边界|异常)/.test(header)) currentSection = 'boundary';
      else if (/(out\s*of\s*scope|不在范围|不做)/.test(header)) currentSection = 'oos';
      else currentSection = null;
    } else if (currentSection) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

function classifyBoundary(text) {
  // 自动加 ✅ ⚠️ ❌ 标记（基于关键词）
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    if (/^\s*[-*]\s*[❌✗]/.test(line)) return line;
    if (/^\s*[-*]\s*[⚠⚡]/.test(line)) return line;
    if (/^\s*[-*]\s*[✅✓]/.test(line)) return line;
    // 自动判断
    if (/(失败|错误|异常|崩)/.test(line)) return line.replace(/^(\s*[-*]\s*)/, '$1❌ ');
    if (/(边界|临界|刚好|超|刚好)/.test(line)) return line.replace(/^(\s*[-*]\s*)/, '$1⚠️ ');
    return line.replace(/^(\s*[-*]\s*)/, '$1✅ ');
  });
}

// ---------- 占位符 build 函数（v0.5.2 P0 改进：模板只留占位符，实现全在代码里）----------
//
// 改链接 / 改文件名 → 改 buildSpecFileLink() 一处,模板自动跟随
// 改"goal 缺省文案" → 改 buildGoalSentence() 一处
// 加新占位符 → 写一个 buildXxx() + 在 fillTemplate 调一次
//
function buildFeatureName(ctx) { return ctx.featureName; }
function buildSpecFileLink(ctx) {
  return `spec/spec.feature#L${ctx.versionLine}-L${ctx.featureLine}`;
}
function buildSpecSourceFile() { return 'spec/spec.feature'; }
function buildGoalSentence(ctx) { return ctx.goal || '（未提取）'; }
function buildRolesAndFlows(ctx) { return ctx.roles || '（未提取）'; }
function buildBoundaryList(ctx) { return ctx.boundaryLines || '（未提取）'; }
function buildOutOfScopeList(ctx) { return ctx.oosLines || '（未提取）'; }

function fillTemplate(template, ctx) {
  return template
    .replace(/\{feature-name\}/g, buildFeatureName(ctx))
    .replace(/\{spec-file-link\}/g, buildSpecFileLink(ctx))
    .replace(/\{spec-source-file\}/g, buildSpecSourceFile(ctx))
    .replace(/\{goal-sentence\}/g, buildGoalSentence(ctx))
    .replace(/\{roles-and-flows\}/g, buildRolesAndFlows(ctx))
    .replace(/\{boundary-list\}/g, buildBoundaryList(ctx))
    .replace(/\{out-of-scope-list\}/g, buildOutOfScopeList(ctx));
}

// ---------- 子命令 ----------

function cmdGen(projectDir) {
  projectDir = projectDir || process.cwd();
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec.feature（在 spec/ 或项目根目录）');
    process.exit(1);
  }

  const specContent = readFileSafe(path.join(specDir, 'spec.feature'));
  const sourcesContent = readFileSafe(path.join(specDir, 'sources.md'));
  if (!sourcesContent) {
    console.error('✗ 找不到 sources.md（spec-summary 需要 sources.md 提取目标/角色/边界/不在范围）');
    process.exit(1);
  }

  const meta = parseSpecMetadata(specContent);
  const sections = parseSources(sourcesContent);
  const boundaryLines = classifyBoundary(sections.boundary).join('\n');
  const oosLines = sections.oos.split('\n').filter(l => l.trim()).join('\n');

  const template = readFileSafe(TEMPLATE_PATH);
  if (!template) {
    console.error(`✗ 找不到模板 ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  const summary = fillTemplate(template, {
    featureName: meta.featureName,
    versionLine: meta.versionLine,
    featureLine: meta.featureLine,
    endLine: meta.endLine,
    goal: sections.goal,
    roles: sections.roles,
    boundaryLines,
    oosLines,
  });

  // 剥掉模板的占位符说明段（以 `> 模板占位符说明` 开头）
  const finalSummary = summary.split('\n> 模板占位符说明')[0].trimEnd() + '\n';

  const outPath = path.join(specDir, 'summary.md');
  fs.writeFileSync(outPath, finalSummary, 'utf8');

  const lineCount = finalSummary.split('\n').length;
  console.log(`✓ spec/summary.md 已生成（${lineCount} 行）`);
  if (lineCount > MAX_SUMMARY_LINES) {
    console.warn(`⚠ 超过 ${MAX_SUMMARY_LINES} 行上限（${lineCount}），建议精简`);
  }
}

function cmdCheck(projectDir) {
  projectDir = projectDir || process.cwd();
  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const summaryPath = path.join(specDir, 'summary.md');
  const content = readFileSafe(summaryPath);
  if (!content) {
    console.error('✗ summary.md 不存在');
    process.exit(1);
  }

  const errors = [];

  // 校验 1: 行数
  const lines = content.split('\n');
  if (lines.length > MAX_SUMMARY_LINES) {
    errors.push(`行数 ${lines.length} > ${MAX_SUMMARY_LINES}`);
  }

  // 校验 2: 不含 Gherkin 关键词
  for (const kw of GHERKIN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'm').test(content)) {
      errors.push(`含 Gherkin 关键词 "${kw}"`);
    }
  }
  if (SC_PATTERN.test(content)) {
    errors.push('含 SC-xxx 引用');
  }

  // 校验 3: 末尾含"详细 spec"链接
  if (!/>\s*详细 spec：/.test(content)) {
    errors.push('末尾缺"详细 spec"链接（防假签字反模式）');
  }

  // 校验 4: 含"不在范围内"段
  const oosMatch = content.match(/##\s*不在范围内[\s\S]*?(?=\n##\s|\n---|\n$)/);
  if (!oosMatch) {
    errors.push('缺"## 不在范围内"段');
  } else {
    const oosItemCount = (oosMatch[0].match(/^\s*[-*]\s+/gm) || []).length;
    if (oosItemCount < MIN_OOS_ITEMS) {
      errors.push(`"不在范围内"项数 ${oosItemCount} < ${MIN_OOS_ITEMS}`);
    }
    if (oosItemCount > MAX_OOS_ITEMS) {
      errors.push(`"不在范围内"项数 ${oosItemCount} > ${MAX_OOS_ITEMS}`);
    }
  }

  if (errors.length) {
    console.error('✗ summary.md 校验失败：');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('✓ summary.md 校验通过');
}

function main() {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    const { printHelp } = require('./_lib/help');
    printHelp(__filename);
    process.exit(0);
  }
  const [, , subcmd, projectArg] = process.argv;
  if (subcmd === 'gen') cmdGen(projectArg);
  else if (subcmd === 'check') cmdCheck(projectArg);
  else if (subcmd === '__test_export__') {
    return {
      parseSpecMetadata, parseSources, classifyBoundary, fillTemplate,
      buildFeatureName, buildSpecFileLink, buildSpecSourceFile,
      buildGoalSentence, buildRolesAndFlows, buildBoundaryList, buildOutOfScopeList,
    };
  }
  else {
    // 被 require 时不报错（测试场景）
    if (require.main !== module) {
      return {
        parseSpecMetadata, parseSources, classifyBoundary, fillTemplate,
        buildFeatureName, buildSpecFileLink, buildSpecSourceFile,
        buildGoalSentence, buildRolesAndFlows, buildBoundaryList, buildOutOfScopeList,
      };
    }
    console.error('用法: node spec-summary.js <gen|check> [project-dir]');
    process.exit(1);
  }
}

// v0.5.2 P0 修复：require 时不跑 main()（避免父进程 --help 杀子进程）
// 旧 `module.exports = main();` 在 require 时无条件跑 main → 父进程 argv 含 --help 时子进程被 exit(0)
if (require.main === module) {
  main();
} else {
  module.exports = {
    parseSpecMetadata, parseSources, classifyBoundary, fillTemplate,
    buildFeatureName, buildSpecFileLink, buildSpecSourceFile,
    buildGoalSentence, buildRolesAndFlows, buildBoundaryList, buildOutOfScopeList,
  };
}
