#!/usr/bin/env node
/**
 * spec-render.js — spec → review.md（roadmap G7）
 *
 * 用法:
 *   node spec-render.js <项目目录>
 *     读 spec/spec.feature + spec/sources.md + spec/meta.json
 *     写 spec/review.md（评审者视角的 checklist + D1-D4 自评草稿）
 *
 *   node spec-render.js <项目目录> --dry-run
 *     预览，不写文件
 *
 *   node spec-render.js <项目目录> --force
 *     覆盖已有 spec/review.md 不询问
 *
 * 设计依据: docs/rfcs/0009-spec-render.md
 * 零外部依赖，纯 Node 内置模块。
 * 与 spec-validate.js 行为对齐（不重复校验，只读 + 列状态）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SC_ID = /SC-\d{3}/g;
const VERSION = /@spec-version\s+(\S+)/;
const SC_TAG = /@SC-\d{3}\b/;
const SC_NAME = /^\s*Scenario:\s*(.+)$/;
const GWT = /^\s*(Given|When|Then|And|But)\s+(.+)$/;
const TAG = /@(\w[\w-]*)/g;
const CODE_TAG = /@spec\s+(SC-\d{3}(?:\s*,\s*SC-\d{3})*)/;
const TEST_NAME = /(?:test|it)\s*\(\s*['"`](SC-\d{3})\s*[:：]/;
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function findSpecDir(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'spec', 'spec.feature'))) {
    return path.join(projectDir, 'spec');
  }
  if (fs.existsSync(path.join(projectDir, 'spec.feature'))) {
    return projectDir;
  }
  return null;
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some(ext => full.endsWith(ext))) out.push(full);
  }
  return out;
}

// ---------- 解析 spec.feature ----------
function parseFeatureScenarios(specContent) {
  const lines = specContent.split('\n');
  const scenarios = [];
  let current = null;
  let featureName = '';
  let version = '';
  for (const line of lines) {
    const verMatch = line.match(VERSION);
    if (verMatch) version = verMatch[1];
    const featMatch = line.match(/^\s*Feature:\s*(.+)$/);
    if (featMatch) featureName = featMatch[1].trim();
    if (SC_TAG.test(line)) {
      if (current) scenarios.push(current);
      const idMatch = line.match(SC_ID);
      current = { id: idMatch[0], name: '', gwt: { Given: [], When: [], Then: [] }, tags: extractTags(line) };
    } else if (current) {
      const nameMatch = line.match(SC_NAME);
      if (nameMatch) {
        current.name = nameMatch[1].trim();
        // 抓取 SC 后同行可能存在的额外 tag
        const afterNameTags = line.match(/@\w[\w-]*/g);
        if (afterNameTags) current.tags.push(...afterNameTags.map(t => t.slice(1)));
      } else {
        const gwtMatch = line.match(GWT);
        if (gwtMatch) {
          const key = gwtMatch[1] in current.gwt ? gwtMatch[1] : mapAndBut(gwtMatch[1]);
          if (key && current.gwt[key]) current.gwt[key].push(gwtMatch[2].trim());
        }
      }
    }
  }
  if (current) scenarios.push(current);
  return { featureName, version, scenarios };
}

function mapAndBut(keyword) {
  if (keyword === 'And' || keyword === 'But') return 'Then'; // And/But 跟前面最近的关键字（简化：都归 Then）
  return null;
}

function extractTags(line) {
  const tags = [];
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(line)) !== null) {
    if (m[1] !== 'SC-' && m[1].match(/^SC-/)) continue; // SC-xxx 跳过
    if (m[1] === 'SC-') continue; // 残缺 tag
    tags.push(m[1]);
  }
  return tags.filter(t => !t.match(/^SC-\d{3}$/)); // 去掉 SC-xxx（已被 id 表达）
}

// ---------- 解析 sources.md REQ 表格 ----------
function parseSourcesReqs(sourcesContent) {
  if (!sourcesContent) return [];
  const reqs = [];
  const lines = sourcesContent.split('\n');
  let inReqs = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s*需求清单/.test(line)) { inReqs = true; continue; }
    if (/^##/.test(line)) { inReqs = false; continue; }
    if (inReqs && line.startsWith('|') && !/^\|\s*[-:|\s]+\|$/.test(line)) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 5 && /^REQ-\d+/.test(cells[0])) {
        reqs.push({
          id: cells[0],
          desc: cells[1] || '',
          moscow: cells[3] || '',
          target: cells[5] || '',
        });
      }
    }
  }
  return reqs;
}

// ---------- 扫描代码 @spec 标注 ----------
function scanCode(root) {
  const files = walk(root, ['.js', '.ts', '.jsx', '.tsx', '.mjs']);
  const map = {};
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = line.match(CODE_TAG);
      if (!m) return;
      const ids = m[1].match(SC_ID) || [];
      for (const id of ids) {
        (map[id] = map[id] || []).push(`${path.relative(root, file)}:${i + 1}`);
      }
    });
  }
  return map;
}

// ---------- 扫描测试 SC-xxx: 用例 ----------
function scanTests(root) {
  const files = walk(root, ['.spec.js', '.spec.ts', '.test.js', '.test.ts']);
  const map = {};
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const m of content.matchAll(new RegExp(TEST_NAME.source, 'g'))) {
      const id = m[1];
      (map[id] = map[id] || []).push(path.relative(root, file));
    }
  }
  return map;
}

// ---------- 生成 review.md ----------
function generateReview(parsed, reqs, codeMap, testMap, today) {
  const { featureName, version, scenarios } = parsed;
  const scList = scenarios.map(s => s.id);

  let md = '';
  md += `# ${featureName || 'Feature'} — 评审 checklist（spec-render 产物）\n\n`;
  md += `> Auto-generated by god spec-render ${today}。评审者在每段打分（✅/⚠️/❌ + 扣分）。\n`;
  md += `> 评审契约 → \`skills/spec-review/SKILL.md\`\n`;
  md += `> 不修改本文件——只评分。spec 变更需重新 render。\n\n`;
  md += `---\n\n`;

  // D1 需求完整性
  md += `## D1 需求完整性\n\n`;
  md += `> 每条 REQ 是否有 SC 覆盖？\n\n`;
  md += `| REQ | 描述 | 覆盖 SC | 状态 |\n`;
  md += `|-----|------|---------|------|\n`;
  let covered = 0;
  for (const r of reqs) {
    const scMatch = r.target.match(SC_ID);
    const hasSc = scMatch && scList.includes(scMatch[0]);
    if (hasSc) covered++;
    const scCell = hasSc ? scMatch[0] : (r.target.includes('Out of Scope') ? 'Out of Scope' : '—');
    const status = hasSc ? '✅' : (r.target.includes('Out of Scope') ? '🚫' : '❌');
    md += `| ${r.id} | ${r.desc} | ${scCell} | ${status} |\n`;
  }
  md += `\n- REQ 总数: ${reqs.length}\n`;
  md += `- 已覆盖: ${covered}\n`;
  md += `- 漏覆盖: ${reqs.length - covered}\n\n`;
  md += `---\n\n`;

  // D2 用户视角 + 边界
  md += `## D2 用户视角 + 边界\n\n`;
  md += `> SC 按 tag 分类（happy / edge / sad-path / intent）\n\n`;
  md += `| 类别 | SC | 描述 |\n`;
  md += `|------|-----|------|\n`;
  const counts = { '@happy': 0, '@edge': 0, '@sad-path': 0, '@intent': 0, 'untagged': 0 };
  for (const sc of scenarios) {
    let cat = 'untagged';
    if (sc.tags.includes('intent')) cat = '@intent';
    else if (sc.tags.includes('sad-path')) cat = '@sad-path';
    else if (sc.tags.includes('edge')) cat = '@edge';
    else if (sc.tags.includes('happy')) cat = '@happy';
    counts[cat]++;
    md += `| ${cat} | ${sc.id} | ${sc.name} |\n`;
  }
  md += `\n- @happy: ${counts['@happy']}\n`;
  md += `- @sad-path: ${counts['@sad-path']}（必测失败用例）\n`;
  md += `- @intent: ${counts['@intent']}（豁免代码+测试）\n`;
  md += `- @edge: ${counts['@edge']}\n`;
  md += `- untagged: ${counts['untagged']}\n\n`;
  md += `---\n\n`;

  // D3 GWT 可验证性
  md += `## D3 GWT 可验证性\n\n`;
  md += `> Given/When/Then 三段是否齐全 + 字段非空\n\n`;
  md += `| SC | Given | When | Then | 可验证 |\n`;
  md += `|-----|-------|------|------|--------|\n`;
  let gwtOk = 0;
  for (const sc of scenarios) {
    const g = sc.gwt.Given.length > 0;
    const w = sc.gwt.When.length > 0;
    const t = sc.gwt.Then.length > 0;
    const ok = g && w && t;
    if (ok) gwtOk++;
    const check = (b) => b ? '✓' : '✗';
    md += `| ${sc.id} | ${check(g)} | ${check(w)} | ${check(t)} | ${ok ? '✅' : '❌'} |\n`;
  }
  md += `\n- GWT 完整: ${gwtOk}/${scenarios.length}\n`;
  md += `- 字段空值: ${scenarios.length - gwtOk}\n`;
  md += `- 可测试: ${scenarios.length ? Math.round((gwtOk / scenarios.length) * 100) : 0}%\n\n`;
  md += `---\n\n`;

  // D4 双向绑定矩阵
  md += `## D4 双向绑定矩阵\n\n`;
  md += `> SC ↔ 代码 ↔ 测试 三方映射\n\n`;
  md += `| SC | 代码 | 测试 | 状态 |\n`;
  md += `|-----|------|------|------|\n`;
  let full = 0, missingCode = 0, missingTest = 0, orphan = 0;
  // 检测孤儿（代码有但 spec 无）
  const orphanIds = Object.keys(codeMap).filter(id => !scList.includes(id));
  orphan = orphanIds.length;
  for (const sc of scenarios) {
    const id = sc.id;
    const code = codeMap[id] ? codeMap[id].join(', ') : '—';
    const test = testMap[id] ? testMap[id].join(', ') : '—';
    const ok = codeMap[id] && testMap[id];
    if (ok) full++;
    else if (!codeMap[id]) missingCode++;
    else if (!testMap[id]) missingTest++;
    md += `| ${id} | ${code} | ${test} | ${ok ? '✅ 完整' : '❌ 缺' + (!codeMap[id] ? '代码' : '测试')} |\n`;
  }
  if (orphanIds.length > 0) {
    md += `\n**孤儿标注**（代码有但 spec 无）：${orphanIds.join(', ')}\n`;
  }
  md += `\n- 完整: ${full}/${scenarios.length}\n`;
  md += `- 缺代码: ${missingCode}\n`;
  md += `- 缺测试: ${missingTest}\n`;
  md += `- 孤儿: ${orphan}\n\n`;
  md += `---\n\n`;

  // 评审草稿分
  md += `## 评审草稿分（spec-review skill 自动填）\n\n`;
  md += `> 此段由 spec-review 跑完填，spec-render 不写。\n\n`;
  md += `- D1: __ / 25\n`;
  md += `- D2: __ / 25\n`;
  md += `- D3: __ / 25\n`;
  md += `- D4: __ / 25\n`;
  md += `- **总分: __ / 100**（≥90 通过）\n`;

  return md;
}

function main() {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    const { printHelp } = require('./_lib/help');
    printHelp(__filename);
    process.exit(0);
  }
  const projectDir = process.argv[2];
  if (!projectDir) {
    console.error('用法: node spec-render.js <项目目录> [--dry-run] [--force]');
    process.exit(1);
  }
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }
  const opts = {
    dryRun: process.argv.includes('--dry-run'),
    force: process.argv.includes('--force'),
  };

  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const specContent = readFileSafe(path.join(specDir, 'spec.feature'));
  if (!specContent) {
    console.error('✗ 找不到 spec.feature');
    process.exit(1);
  }
  const sourcesContent = readFileSafe(path.join(specDir, 'sources.md'));
  const metaContent = readFileSafe(path.join(specDir, 'meta.json'));
  const meta = metaContent ? JSON.parse(metaContent) : null;

  const parsed = parseFeatureScenarios(specContent);
  const reqs = parseSourcesReqs(sourcesContent);
  const codeMap = scanCode(projectDir);
  const testMap = scanTests(projectDir);

  const today = new Date().toISOString().slice(0, 10);
  const md = generateReview(parsed, reqs, codeMap, testMap, today);
  // v0.5.0+ G13 落地: review.md 移到 review/ 子目录,带日期避免覆盖
  const reviewDir = path.join(specDir, 'review');
  if (!fs.existsSync(reviewDir)) fs.mkdirSync(reviewDir, { recursive: true });
  const outPath = path.join(reviewDir, `review-${today}.md`);

  if (opts.dryRun) {
    console.log(`[dry-run] 将写：${outPath}\n`);
    console.log('--- 预览 ---');
    console.log(md);
    return;
  }

  if (fs.existsSync(outPath) && !opts.force) {
    console.error(`✗ ${outPath} 已存在（用 --force 覆盖）`);
    process.exit(1);
  }

  let backup = null;
  if (fs.existsSync(outPath)) {
    backup = fs.readFileSync(outPath, 'utf8');
  }
  try {
    fs.writeFileSync(outPath, md, 'utf8');
  } catch (e) {
    if (backup !== null) fs.writeFileSync(outPath, backup);
    throw e;
  }

  console.log(`✓ spec-render 完成：${outPath}`);
  console.log(`  feature: ${parsed.featureName}`);
  console.log(`  version: ${parsed.version || '?'}`);
  console.log(`  scenarios: ${parsed.scenarios.length}`);
  console.log(`  reqs: ${reqs.length} (covered: ${reqs.filter(r => {
    const m = r.target.match(SC_ID);
    return m && parsed.scenarios.some(s => s.id === m[0]);
  }).length})`);
  console.log(`  size: ${(md.length / 1024).toFixed(1)} KB`);
  console.log(`\n下一步：跑 spec-review skill 填 D1-D4 评分`);
}

if (require.main !== module) {
  module.exports = {
    parseFeatureScenarios,
    parseSourcesReqs,
    scanCode,
    scanTests,
    generateReview,
  };
} else {
  main();
}
