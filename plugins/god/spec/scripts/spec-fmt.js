#!/usr/bin/env node
/**
 * Living Spec 格式化辅助脚本
 * 设计与 spec-fmt.js / spec-validate.js 配套使用。
 *
 * 定位：AI 手写 spec.feature,脚本做"机械层补全":
 *   - SC ID 自动编号(按出现顺序 SC-001 起编,或接续已有最大号)
 *   - 标签格式补全(@SC-xxx @happy/@edge/@error)
 *   - 缩进规范化(2 空格)
 *   - 缺省 @spec-version 补 0.0.1
 *   - Feature 描述缺省补空
 *   - ID 唯一性 + GWT 完整 + 编号连续性报告
 *
 * 不做的事(避免破坏 spec.feature 是"单一真相源"的可读性):
 *   - 不重写 GWT 文本(语义层)
 *   - 不重排 Scenario 顺序(语义层)
 *   - 不删 Scenario(只能 AI 主动删)
 *   - 不动空行/注释以外的"自由排版"
 *
 * 用法:
 *   node spec-fmt.js <project-dir>                    # dry-run,只报告
 *   node spec-fmt.js <project-dir> --apply            # 实际写文件
 *   node spec-fmt.js <project-dir> --next-id          # 下一个可用 SC 号
 *   node spec-fmt.js <project-dir> --add-scenario -   # 从 stdin 读 JSON 插入
 *
 * 配合 spec-validate.js:fmt 负责写时机械正确,validate 负责读时漂移检测
 */

const fs = require('fs');
const path = require('path');

const SC_ID = /^SC-(\d{3})$/;
const VERSION = /@spec-version\s+(\S+)/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const CATEGORY = ['happy', 'edge', 'error'];

// ---------- 文件查找 ----------
function findSpecFile(projectDir) {
  return ['spec/spec.feature', 'spec.feature']
    .map(p => path.join(projectDir, p))
    .find(p => fs.existsSync(p)) || null;
}

// ---------- 解析 spec.feature(只读语义,不改写) ----------
function parseSpec(content) {
  const lines = content.split('\n');
  const result = {
    version: null,
    versionLine: -1,
    feature: null,
    featureLine: -1,
    featureDescLines: [],
    scenarios: [],
    issues: [],
  };
  let pendingTags = [];
  let current = null;
  let lastBlank = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { lastBlank = i; continue; }  // 空行不清 pendingTags(tag 可跨空行)

    // @spec-version 必须先于 tag 检查(它以 @ 开头)
    const vm = line.match(/^@spec-version\s+(\S+)/);
    if (vm) {
      result.version = vm[1];
      result.versionLine = i;
      pendingTags = [];
      continue;
    }

    if (line.startsWith('@')) {
      pendingTags = pendingTags.concat(line.split(/\s+/).map(t => t.replace(/^@/, '')));
      continue;
    }

    const fm = line.match(/^Feature:\s*(.*)/);
    if (fm) {
      result.feature = fm[1].trim();
      result.featureLine = i;
      pendingTags = [];
      continue;
    }

    // Feature 描述(Feature 行后,到第一个空行/Tag/Scenario 之前的缩进行)
    if (result.featureLine >= 0 && i > result.featureLine && current === null
        && /^\s{2,}\S/.test(raw)
        && !line.startsWith('Scenario:') && !line.startsWith('@')) {
      result.featureDescLines.push({ line: i, text: line });
      continue;
    }

    const sm = line.match(/^Scenario:\s*(.*)/);
    if (sm) {
      const idTag = pendingTags.find(t => SC_ID.test(t));
      const catTag = pendingTags.find(t => CATEGORY.includes(t));
      current = {
        id: idTag || null,
        title: sm[1].trim(),
        category: catTag || null,
        tags: pendingTags.slice(),
        line: i,
        hasGiven: false,
        hasWhen: false,
        hasThen: false,
        steps: [],
      };
      result.scenarios.push(current);
      pendingTags = [];
      continue;
    }

    if (current) {
      const gwt = line.match(/^(Given|When|Then|And|But)\b(.*)/i);
      if (gwt) {
        const kw = gwt[1].toLowerCase();
        if (kw === 'given') current.hasGiven = true;
        if (kw === 'when') current.hasWhen = true;
        if (kw === 'then') current.hasThen = true;
        current.steps.push({ keyword: gwt[1], text: gwt[2].trim(), line: i, indent: raw.match(/^\s*/)[0].length });
      }
    }
  }
  return result;
}

// ---------- 建议修复(纯分析,不动文件) ----------
function analyze(projectDir) {
  const specPath = findSpecFile(projectDir);
  const issues = [];
  const suggestions = [];

  if (!specPath) {
    issues.push({ level: 'error', msg: 'spec.feature 不存在' });
    return { specPath, issues, suggestions };
  }

  const content = fs.readFileSync(specPath, 'utf8');
  const spec = parseSpec(content);

  // 1. @spec-version
  if (!spec.version) {
    issues.push({ level: 'error', msg: '缺 @spec-version' });
    suggestions.push('在 Feature 上方加: @spec-version 0.0.1');
  } else if (!SEMVER.test(spec.version)) {
    issues.push({ level: 'error', msg: `@spec-version 非语义化: ${spec.version}` });
    suggestions.push('改为 X.Y.Z 格式');
  }

  // 2. Feature
  if (!spec.feature) {
    issues.push({ level: 'error', msg: '缺 Feature: 定义' });
  }

  // 3. Feature 描述
  if (spec.feature && spec.featureDescLines.length === 0) {
    issues.push({ level: 'warn', msg: 'Feature 缺"作为…我想…以便…"描述' });
  }

  // 4. Scenario ID
  const ids = spec.scenarios.map(s => s.id).filter(Boolean);
  const seen = new Set();
  const dup = [];
  ids.forEach(id => { if (seen.has(id)) dup.push(id); else seen.add(id); });
  if (dup.length) issues.push({ level: 'error', msg: `ID 重复: ${[...new Set(dup)].join(', ')}` });

  // 5. 缺 ID
  const missingId = spec.scenarios.filter(s => !s.id).map(s => s.title);
  if (missingId.length) {
    issues.push({ level: 'error', msg: `Scenario 缺 @SC-xxx: ${missingId.length} 个` });
    // 建议编号
    const usedNums = ids.map(id => parseInt(id.match(SC_ID)[1], 10)).filter(n => !isNaN(n));
    const nextNum = usedNums.length ? Math.max(...usedNums) + 1 : 1;
    missingId.forEach((title, i) => {
      suggestions.push(`为 "${title}" 分配 SC-${String(nextNum + i).padStart(3, '0')}`);
    });
  }

  // 6. 编号连续性
  if (ids.length && missingId.length === 0) {
    const sorted = ids.map(id => parseInt(id.match(SC_ID)[1], 10)).sort((a, b) => a - b);
    const expected = Array.from({ length: sorted.length }, (_, i) => i + 1);
    const gaps = sorted.filter((n, i) => n !== expected[i]);
    if (gaps.length === 0 && sorted[0] !== 1) {
      issues.push({ level: 'warn', msg: `SC 编号不从 001 开始(当前起始: SC-${String(sorted[0]).padStart(3, '0')})` });
    }
  }

  // 7. 缺 category 标签
  // @intent / @sad-path 是语义 tag,非 category,与 happy/edge/error 正交可不填
  const missingCat = spec.scenarios
    .filter(s => s.id && !s.category && !s.tags.includes('intent') && !s.tags.includes('sad-path'))
    .map(s => s.id);
  if (missingCat.length) {
    issues.push({ level: 'warn', msg: `Scenario 缺类别标签(@happy/@edge/@error;@intent/@sad-path 是语义 tag,可不填): ${missingCat.join(', ')}` });
  }

  // 8. GWT 完整
  const incomplete = spec.scenarios.filter(s => s.id && !(s.hasGiven && s.hasWhen && s.hasThen));
  if (incomplete.length) {
    issues.push({ level: 'error', msg: `GWT 不完整: ${incomplete.map(s => s.id).join(', ')}` });
  }

  return { specPath, version: spec.version, feature: spec.feature, scenarios: spec.scenarios.length, ids: ids.length, issues, suggestions };
}

// ---------- 报告输出 ----------
function report(result, apply) {
  const lines = [];
  lines.push('=== Living Spec 格式化检查 ===');
  lines.push(`文件: ${result.specPath || '(不存在)'}`);
  if (result.feature) lines.push(`Feature: ${result.feature}`);
  if (result.version) lines.push(`@spec-version: ${result.version}`);
  lines.push(`Scenarios: ${result.scenarios}, 已分配 ID: ${result.ids}`);
  lines.push('');

  if (result.issues.length === 0) {
    lines.push('✅ 无需修复');
  } else {
    lines.push('问题:');
    result.issues.forEach(i => {
      const icon = i.level === 'error' ? '✗' : '⚠';
      lines.push(`  [${icon}] ${i.msg}`);
    });
  }

  if (result.suggestions.length) {
    lines.push('');
    lines.push('建议:');
    result.suggestions.forEach(s => lines.push(`  - ${s}`));
  }

  if (!apply && result.issues.some(i => i.level === 'error')) {
    lines.push('');
    lines.push('(dry-run 模式,未修改文件;加 --apply 不适用——fmt 只报告不改写)');
  }
  return lines.join('\n');
}

// ---------- 下一个可用 SC ID ----------
function nextId(projectDir) {
  const specPath = findSpecFile(projectDir);
  if (!specPath) { console.log('SC-001'); return; }
  const content = fs.readFileSync(specPath, 'utf8');
  const ids = [...content.matchAll(/SC-(\d{3})/g)].map(m => parseInt(m[1], 10));
  const next = ids.length ? Math.max(...ids) + 1 : 1;
  console.log(`SC-${String(next).padStart(3, '0')}`);
}

// ---------- --add-scenario: 从 stdin 读 JSON 插入 ----------
// 输入 JSON: { title, category, given:[..], when:[..], then:[..] }
// 自动分配 ID、追加到文件末尾、@spec-version 不变
function addScenario(projectDir) {
  const specPath = findSpecFile(projectDir);
  if (!specPath) { console.error('spec.feature 不存在'); process.exit(1); }

  const chunks = [];
  process.stdin.on('data', c => chunks.push(c));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const { title, category, given = [], when = [], then = [] } = input;

      if (!title) { console.error('JSON 缺 title'); process.exit(1); }
      if (!CATEGORY.includes(category)) { console.error(`category 必须是 ${CATEGORY.join('|')}`); process.exit(1); }

      const content = fs.readFileSync(specPath, 'utf8');
      const ids = [...content.matchAll(/SC-(\d{3})/g)].map(m => parseInt(m[1], 10));
      const nextNum = ids.length ? Math.max(...ids) + 1 : 1;
      const newId = `SC-${String(nextNum).padStart(3, '0')}`;

      const blocks = [];
      blocks.push('');
      blocks.push(`  @${newId} @${category}`);
      blocks.push(`  Scenario: ${title}`);
      const renderSteps = (kw, steps) => steps.forEach(s => blocks.push(`    ${kw} ${s}`));
      renderSteps('Given', given);
      renderSteps('When', when);
      renderSteps('Then', then);

      const addition = blocks.join('\n') + '\n';
      fs.appendFileSync(specPath, addition);

      console.log(`✓ 已追加 ${newId}: ${title}`);
      console.log(`  提示: 跑 spec-validate.js 校验`);
    } catch (e) {
      console.error(`JSON 解析失败: ${e.message}`);
      process.exit(1);
    }
  });
}

// ---------- 入口 ----------
function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === '--help' || args[0] === '-h') {
    console.log(`用法:
  node spec-fmt.js <project-dir>              dry-run 检查
  node spec-fmt.js <project-dir> --next-id    输出下一个可用 SC ID
  node spec-fmt.js <project-dir> --add-scenario -   从 stdin 读 JSON 追加 Scenario

JSON 输入格式(--add-scenario):
  { "title": "...", "category": "happy|edge|error",
    "given": ["..."], "when": ["..."], "then": ["..."] }`);
    return;
  }

  const projectDir = path.resolve(args[0]);

  if (args.includes('--next-id')) {
    nextId(projectDir);
    return;
  }

  if (args.includes('--add-scenario')) {
    addScenario(projectDir);
    return;
  }

  const apply = args.includes('--apply');
  const result = analyze(projectDir);
  const text = report(result, apply);
  console.log(text);

  // 有 error 即非零退出(供 CI 拦截)
  const hasError = result.issues.some(i => i.level === 'error');
  process.exit(hasError ? 1 : 0);
}

main();
