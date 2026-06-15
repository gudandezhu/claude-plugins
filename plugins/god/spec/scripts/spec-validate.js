#!/usr/bin/env node
/**
 * Living Spec 验证器
 * 校验 spec.feature 与代码/测试的三者绑定一致性（zero-drift）。
 *
 * 用法: node spec-validate.js [project-dir]
 *   project-dir 默认 cwd；在其中找 spec/spec.feature 或 spec.feature
 *
 * 设计依据: plugins/god/spec/SPEC-FORMAT.md
 * 零外部依赖，纯 Node，不耦合任何特定工具链。
 */

const fs = require('fs');
const path = require('path');

const SC_ID = /SC-\d{3}/g;
const SC_SINGLE = /^SC-\d{3}$/;
const VERSION = /@spec-version\s+(\S+)/;
const CODE_TAG = /@spec\s+(SC-\d{3}(?:\s*,\s*SC-\d{3})*)/;
const TEST_NAME = /(?:test|it)\s*\(\s*['"`](SC-\d{3})\s*[:：]/;
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

// ---------- 文件遍历 ----------
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
function parseSpec(content) {
  const result = { version: null, feature: null, scenarios: [] };
  const lines = content.split('\n');
  let pendingTags = [];
  let current = null;

  const versionMatch = content.match(VERSION);
  if (versionMatch) result.version = versionMatch[1];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { pendingTags = []; continue; }
    if (line.startsWith('@')) {
      pendingTags = pendingTags.concat(line.split(/\s+/).map(t => t.replace(/^@/, '')));
      continue;
    }
    const fm = line.match(/^Feature:\s*(.*)/);
    if (fm) { result.feature = fm[1].trim(); pendingTags = []; continue; }
    const sm = line.match(/^Scenario:\s*(.*)/);
    if (sm) {
      const id = pendingTags.find(t => SC_SINGLE.test(t));
      current = {
        id, title: sm[1].trim(), tags: pendingTags.slice(),
        hasGiven: false, hasWhen: false, hasThen: false,
      };
      result.scenarios.push(current);
      pendingTags = [];
      continue;
    }
    if (current) {
      if (/^Given\b/i.test(line)) current.hasGiven = true;
      if (/^When\b/i.test(line)) current.hasWhen = true;
      if (/^Then\b/i.test(line)) current.hasThen = true;
    }
  }
  return result;
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

// ---------- 校验 ----------
function validate(projectDir) {
  const specPath = ['spec/spec.feature', 'spec.feature']
    .map(p => path.join(projectDir, p))
    .find(p => fs.existsSync(p));

  const checks = [];
  const errors = [];

  function pass(msg) { checks.push({ ok: true, msg }); }
  function fail(msg) { checks.push({ ok: false, msg }); errors.push(msg); }

  // 1. spec 存在
  if (!specPath) {
    fail('spec.feature 不存在（找过 spec/spec.feature 与 spec.feature）');
    return { checks, errors, matrix: [], counts: { sc: 0, ok: 0 } };
  }
  pass(`spec.feature 存在：${path.relative(projectDir, specPath)}`);

  const spec = parseSpec(fs.readFileSync(specPath, 'utf8'));

  // 2. Feature
  spec.feature ? pass(`Feature 定义：${spec.feature}`) : fail('缺少 Feature: 定义');

  // 3. 版本
  const semver = /^\d+\.\d+\.\d+$/;
  spec.version && semver.test(spec.version)
    ? pass(`版本：${spec.version}`)
    : fail('缺少 @spec-version 或非语义化版本(X.Y.Z)');

  // 4.5. ID + 唯一
  const ids = spec.scenarios.map(s => s.id).filter(Boolean);
  spec.scenarios.filter(s => !s.id).forEach(s => fail(`Scenario 缺 @SC-xxx ID：${s.title}`));
  if (spec.scenarios.some(s => s.id)) pass(`Scenario ID：${ids.length} 个`);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  [...new Set(dup)].forEach(id => fail(`ID 重复：${id}`));
  if (!dup.length && ids.length) pass('ID 唯一');

  // 6. GWT 结构
  spec.scenarios.forEach(s => {
    if (s.id && !(s.hasGiven && s.hasWhen && s.hasThen))
      fail(`${s.id} 缺 Given/When/Then`);
  });
  if (!errors.some(e => e.includes('Given/When/Then'))) pass('GWT 结构完整');

  // 7.8.9. 绑定一致性（漂移检测）
  const codeMap = scanCode(projectDir);
  const testMap = scanTests(projectDir);
  const matrix = [];
  let boundCount = 0;
  const uniqueIds = [...new Set(ids)];
  for (const id of uniqueIds) {
    const code = codeMap[id] || [];
    const test = testMap[id] || [];
    const ok = code.length > 0 && test.length > 0;
    if (ok) boundCount++;
    else fail(`${id} 绑定不完整（代码${code.length}处 / 测试${test.length}处）`);
    matrix.push({ id, code, test, ok });
  }
  if (matrix.length && matrix.every(m => m.ok)) pass('所有 SC 已实现且已测试');
  if (matrix.length) pass(`追溯绑定：${boundCount}/${matrix.length} SC 完整`);

  // 孤儿代码标注（代码标了 spec 没有的 SC）
  const orphanCode = Object.keys(codeMap).filter(id => !uniqueIds.includes(id));
  orphanCode.forEach(id => fail(`孤儿代码标注：${id} 在代码有 @spec 但 spec 无此 Scenario`));
  if (!orphanCode.length) pass('无孤儿代码标注');

  return { checks, errors, matrix, counts: { sc: uniqueIds.length, ok: boundCount }, version: spec.version, feature: spec.feature };
}

// ---------- 报告输出 ----------
function report(result, projectDir) {
  const lines = [];
  lines.push('=== Living Spec 校验报告 ===');
  lines.push(`项目: ${projectDir}`);
  if (result.feature) lines.push(`Feature: ${result.feature}`);
  if (result.version) lines.push(`spec-version: ${result.version}`);
  lines.push('');

  if (result.matrix.length) {
    lines.push('追溯矩阵:');
    for (const m of result.matrix) {
      const code = m.code.join(';') || '(缺失)';
      const test = m.test.join(';') || '(缺失)';
      lines.push(`  ${m.id}  代码:${code.padEnd(24).slice(0, 24)} 测试:${test.padEnd(28).slice(0, 28)} ${m.ok ? '✓' : '✗ 漂移'}`);
    }
    lines.push('');
  }

  lines.push('校验项:');
  for (const c of result.checks) lines.push(`  [${c.ok ? '✓' : '✗'}] ${c.msg}`);
  lines.push('');

  const passed = result.errors.length === 0;
  lines.push(`结果: ${passed ? '通过 ✅' : '失败 ❌'} (${result.counts.ok}/${result.counts.sc} SC 完整绑定)`);
  if (result.errors.length) {
    lines.push('错误:');
    result.errors.forEach(e => lines.push(`  - ${e}`));
  }
  return { text: lines.join('\n'), passed };
}

// ---------- 入口 ----------
function main() {
  const projectDir = path.resolve(process.argv[2] || process.cwd());
  const result = validate(projectDir);
  const { text, passed } = report(result, projectDir);
  console.log(text);
  process.exit(passed ? 0 : 1);
}

main();
