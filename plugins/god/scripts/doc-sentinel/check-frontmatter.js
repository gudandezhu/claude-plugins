#!/usr/bin/env node
/**
 * check-frontmatter.js — F1 frontmatter status 缺失检查
 *
 * 检测:
 *   - 所有 skills/<name>/SKILL.md 是否含 status: 字段
 *   - 所有 commands/<name>.md 是否含 status: 字段
 *
 * 用法:
 *   node check-frontmatter.js <仓库根>
 *     输出 JSON 单条 check 结果
 *
 * 设计依据: docs/adrs/0012-doc-sentinel.md §3.2 F1
 * auto-fix: 加 status: stable（除非文件内容是骨架版）
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { newCheck, addFinding } = require('./report-format');

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(p);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(p);
      }
    }
  }
  walk(dir);
  return out;
}

function parseFrontmatter(content) {
  // 匹配 ---\n...\n---\n 形式
  const m = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return null;
  const body = m[1];
  const fields = {};
  for (const line of body.split('\n')) {
    const fm = line.match(/^([a-zA-Z_-]+)\s*:\s*(.+?)\s*$/);
    if (fm) fields[fm[1]] = fm[2].replace(/^["']|["']$/g, '');
  }
  return { fields, raw: m[0], bodyEnd: m[0].length };
}

function isSkeletonContent(content) {
  return /当前为骨架|待填充|功能待填充|TODO\s*[:：]\s*实现/.test(content);
}

function checkSkillFile(filePath, repoRoot) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(content);
  const rel = path.relative(repoRoot, filePath);

  if (fm && fm.fields.status) return null;
  if (isSkeletonContent(content)) return null;  // 骨架跳过

  return {
    file: rel,
    issue: 'frontmatter 缺 status: 字段（无法区分草稿/稳定态）',
    fix: '在顶部 --- 段加 status: stable',
  };
}

function check(repoRoot) {
  const t0 = Date.now();
  const check = newCheck('F1', 'frontmatter status');

  const skillsDir = path.join(repoRoot, 'skills');
  const commandsDir = path.join(repoRoot, 'commands');

  // SKILL.md
  const skillFiles = listMarkdownFiles(skillsDir)
    .filter(f => path.basename(f) === 'SKILL.md');
  for (const f of skillFiles) {
    const finding = checkSkillFile(f, repoRoot);
    if (finding) addFinding(check, finding);
  }

  // commands/*.md
  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir)) {
      if (!f.endsWith('.md')) continue;
      const finding = checkSkillFile(path.join(commandsDir, f), repoRoot);
      if (finding) addFinding(check, finding);
    }
  }

  check.duration_ms = Date.now() - t0;
  return check;
}

/**
 * 实施 auto-fix: 给指定文件加 status: stable frontmatter
 * @param {string} filePath
 * @returns {boolean} 是否成功修改
 */
function autoFix(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(content);
  if (fm && fm.fields.status) return false;  // 已有 status

  const fmBlock = `---\nstatus: stable\n---\n\n`;
  let newContent;
  if (fm) {
    // 已有 frontmatter 但无 status: 插入 status 行
    const lines = fm.raw.split('\n');
    lines.splice(1, 0, 'status: stable');
    newContent = content.replace(fm.raw, lines.join('\n'));
  } else {
    // 无 frontmatter: 顶部插入
    newContent = fmBlock + content;
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

module.exports = { check, parseFrontmatter, autoFix };

if (require.main === module) {
  const repoRoot = process.argv[2];
  if (!repoRoot) {
    console.error('用法: node check-frontmatter.js <仓库根> [--fix]');
    process.exit(1);
  }
  const dryRun = !process.argv.includes('--fix');
  const result = check(repoRoot);
  console.log(JSON.stringify(result, null, 2));

  if (!dryRun && result.findings.length > 0) {
    const { autoFix } = require('./check-frontmatter');
    let fixed = 0;
    for (const f of result.findings) {
      const p = path.join(repoRoot, f.file);
      if (autoFix(p)) fixed++;
    }
    console.error(`\n[--fix] 已 auto-fix ${fixed}/${result.findings.length} 个文件`);
    process.exit(0);
  }

  process.exit(result.findings.length > 0 ? 1 : 0);
}