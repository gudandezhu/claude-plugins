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
    const som = line.match(/^Scenario\s+Outline:\s*(.*)/);
    const scenarioMatch = sm || som;
    if (scenarioMatch) {
      const id = pendingTags.find(t => SC_SINGLE.test(t));
      current = {
        id, title: scenarioMatch[1].trim(), tags: pendingTags.slice(),
        hasGiven: false, hasWhen: false, hasThen: false,
        steps: [],
        isOutline: !!som,
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
        current.steps.push({ keyword: gwt[1], text: gwt[2].trim() });
      }
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

// ---------- 解析 sources.md ----------
// 需求清单（spec.feature 的母本）。每条 REQ 必填：REQ-ID、描述、类别、MoSCoW、来源、归属
// 归属：→ SC-xxx（已翻译为 Scenario）或 Out of Scope（显式不做）
function parseSources(content) {
  const result = { meta: {}, reqs: [], openIssues: [] };
  const lines = content.split('\n');
  let inReqs = false;
  let inOpen = false;
  let inMeta = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Feature 元信息
    if (/^##\s*Feature\s*元信息/.test(line)) { inMeta = true; inReqs = false; inOpen = false; continue; }
    if (/^##\s*需求清单/.test(line)) { inMeta = false; inReqs = true; inOpen = false; continue; }
    if (/^##\s*未决项区/.test(line) || /^##\s*未决项/.test(line)) { inMeta = false; inReqs = false; inOpen = true; continue; }
    if (/^##/.test(line)) { inMeta = false; inReqs = false; inOpen = false; continue; }

    if (inMeta && /^-\s*\*\*(.+?)\*\*\s*[:：]\s*(.+)/.test(line)) {
      const m = line.match(/^-\s*\*\*(.+?)\*\*\s*[:：]\s*(.+)/);
      result.meta[m[1]] = m[2].trim();
      continue;
    }

    // 需求清单表格行（跳过表头/分隔行）
    if (inReqs && line.startsWith('|')) {
      if (/^\|\s*[-:|\s]+\|$/.test(line)) continue;  // 分隔行 |---|---|
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      // 期望: REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属
      if (cells.length >= 5 && /^REQ-\d+/.test(cells[0])) {
        result.reqs.push({
          id: cells[0],
          desc: cells[1] || '',
          category: cells[2] || '',
          moscow: cells[3] || '',
          source: cells[4] || '',
          target: cells[5] || '',  // → SC-xxx 或 Out of Scope 或留空
        });
      } else if (cells.length >= 1 && /^REQ-\d+/.test(cells[0])) {
        // 表格行格式不完整
        result.reqs.push({ id: cells[0], desc: cells[1] || '', category: '', moscow: '', source: '', target: '' });
      }
      continue;
    }

    // 未决项区
    if (inOpen && /^\s*-\s*\[\s*\]/.test(line)) {
      result.openIssues.push(line.replace(/^\s*-\s*\[\s*\]\s*/, '').trim());
    }
  }
  return result;
}

// ---------- 校验 C5 锚点 ----------
// 规范定义见 plugins/god/skills/spec-review/SKILL.md"评审产物归档"节。
// 两种合法格式:
//   通过:  - **C5 Spec 评审** (YYYY-MM-DD HH:MM / 简单档|复杂档 / XX 分 / 通过)
//   未跑:  - **C5 Spec 评审** (YYYY-MM-DD HH:MM / 未跑 / 免责确认:<短摘要>)
// 该锚点是 spec 生命周期"评审发生过"的唯一证据,缺失或格式错 = 评审缺失。
function validateC5Anchor(sourcesContent) {
  const checks = [];
  const errors = [];
  function pass(msg) { checks.push({ ok: true, msg }); }
  function fail(msg) { checks.push({ ok: false, msg }); errors.push(msg); }

  if (!sourcesContent) {
    fail('C5 锚点缺失:sources.md 不存在,无法校验 spec 评审证据(见 spec-review/SKILL.md)');
    return { checks, errors };
  }

  const PASS_RE = /-\s*\*\*C5\s*Spec\s*评审\*\*\s*\(\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\/\s*(简单档|复杂档)\s*\/\s*(\d+)\s*分\s*\/\s*通过\s*\)/;
  const SKIP_RE = /-\s*\*\*C5\s*Spec\s*评审\*\*\s*\(\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\/\s*未跑\s*\/\s*免责确认:[^)]+\)/;
  // 兜底:抓取所有 C5 行,供"格式错"诊断
  const ANY_C5 = /-\s*\*\*C5\s*Spec\s*评审\*\*\s*\([^)]+\)/g;
  const allC5 = sourcesContent.match(ANY_C5) || [];

  if (allC5.length === 0) {
    fail('C5 锚点缺失:sources.md 的 Check 结论区必须含 `- **C5 Spec 评审** (...)` 行(通过/未跑二选一,见 spec-review/SKILL.md 阶段 4)');
    return { checks, errors };
  }

  const passMatch = sourcesContent.match(PASS_RE);
  const skipMatch = sourcesContent.match(SKIP_RE);

  if (!passMatch && !skipMatch) {
    fail(`C5 锚点格式错:找到 ${allC5.length} 行 C5,但均不符合两种合法格式之一。期望: - **C5 Spec 评审** (YYYY-MM-DD HH:MM / 简单档|复杂档 / XX 分 / 通过) 或 ... / 未跑 / 免责确认:...。实际: ${allC5[0]}`);
    return { checks, errors };
  }

  if (passMatch) {
    const [, ts, level, score] = passMatch;
    const scoreNum = parseInt(score, 10);
    pass(`C5 锚点(通过):${ts} / ${level} / ${scoreNum} 分`);
    if (scoreNum < 90) {
      fail(`C5 锚点矛盾:锚点写"通过"但得分 ${scoreNum} < 90(见 spec-review/SKILL.md 阶段 2 阈值)`);
    }
  } else if (skipMatch) {
    pass(`C5 锚点(未跑/免责跳过):${skipMatch[1]}`);
  }

  return { checks, errors };
}

// ---------- 校验 C6 Intent 反述锚点 ----------
// 锚点位置: spec/sources.md 的 Check 结论区,跟 C5 一个地方。
// 触发条件: spec.feature 含 @intent SC → 必须有 C6 锚点 + Given/Then 形态合规
// 锚点格式: - **C6 Intent 反述** (YYYY-MM-DD HH:MM / SC-xxx[,SC-yyy] / 用户原话:<短摘>)
// 反述约束: @intent SC 的 Given 必须含 "原话" 关键词(用户原话引用),Then 必须含 "确认理解" / "acknowledge"
function validateIntentAnchor(sourcesContent, intentScenarios, specScenarios) {
  const checks = [];
  const errors = [];
  function pass(msg) { checks.push({ ok: true, msg }); }
  function fail(msg) { checks.push({ ok: false, msg }); errors.push(msg); }

  if (!intentScenarios || intentScenarios.length === 0) return { checks, errors };

  // 1. 抓所有 C6 行(支持多 SC 共享一锚点,用逗号分隔)
  const C6_RE = /-\s*\*\*C6\s*Intent\s*反述\*\*\s*\(\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\/\s*((?:SC-\d{3}(?:\s*,\s*SC-\d{3})*))\s*\/\s*用户原话:[^)]+\)/g;
  const allC6 = sourcesContent ? [...sourcesContent.matchAll(C6_RE)] : [];
  const anchoredIds = new Set();
  allC6.forEach(m => {
    (m[2].match(/SC-\d{3}/g) || []).forEach(id => anchoredIds.add(id));
  });

  intentScenarios.forEach(intentSc => {
    // 2. 必须有 C6 锚点
    if (!anchoredIds.has(intentSc.id)) {
      fail(`C6 Intent 锚点缺失:${intentSc.id} 带 @intent tag,但 sources.md 无 \`- **C6 Intent 反述** (... / ${intentSc.id} / 用户原话:...)\` 行(见 SPEC-FORMAT.md §3.4)`);
      return;
    }
    pass(`C6 Intent 锚点存在:${intentSc.id}`);

    // 3. 机械校验 Given/Then 形态(强约束,不靠 reviewer 人工核)
    const fullSc = specScenarios.find(s => s.id === intentSc.id);
    if (!fullSc || !fullSc.steps) return;
    const givenStep = fullSc.steps.find(s => /^given$/i.test(s.keyword));
    const thenStep  = fullSc.steps.find(s => /^then$/i.test(s.keyword));

    if (!givenStep || !/原话/.test(givenStep.text)) {
      fail(`@intent ${intentSc.id} Given 必须含"原话"关键词(应引用用户原话),实际:"${givenStep ? givenStep.text : '(无 Given)'}"`);
    } else {
      pass(`@intent ${intentSc.id} Given 含"原话":✓`);
    }

    if (!thenStep || !/确认理解|acknowledge/i.test(thenStep.text)) {
      fail(`@intent ${intentSc.id} Then 必须含"确认理解"关键词,实际:"${thenStep ? thenStep.text : '(无 Then)'}"`);
    } else {
      pass(`@intent ${intentSc.id} Then 含"确认理解":✓`);
    }
  });

  return { checks, errors };
}

// ---------- 校验 @sad-path SC 必有失败模式覆盖 ----------
// 复用现有 codeMap/testMap,跟普通 SC 一视同仁。
// 唯一加强: 错误消息前缀标 "[sad-path]",让"该 SC 失败但测试漏了"在报告中一眼可见
// 阶段化（v0.5.2 P0）：phase=implemented + sad-path tag 在 allowMissingTestTags → 缺测试降级为 info
function validateSadPathBinding(sadPathScenarios, codeMap, testMap, options = {}) {
  const phase = options.phase || 'verified';
  const allowMissingTestTags = options.allowMissingTestTags || [];
  const checks = [];
  const errors = [];
  function pass(msg) { checks.push({ ok: true, msg }); }
  function fail(msg) { checks.push({ ok: false, msg }); errors.push(msg); }

  if (!sadPathScenarios || sadPathScenarios.length === 0) return { checks, errors };

  sadPathScenarios.forEach(s => {
    const code = codeMap[s.id] || [];
    const test = testMap[s.id] || [];
    if (code.length === 0) fail(`[sad-path] ${s.id} 缺代码 @spec 标注:失败模式未实现`);
    // 缺测试降级判断（v0.5.2 P0：capabilities 数据驱动）
    // 条件：phase=implemented + 代码已写 + SC 至少一个 tag 在 allowMissingTestTags 列表
    const canDowngrade = phase === 'implemented'
      && code.length > 0
      && s.tags.some(t => allowMissingTestTags.includes(t));
    if (test.length === 0) {
      if (canDowngrade) {
        pass(`[sad-path] ${s.id} 缺测试（${phase} 阶段 sad-path 在 allowMissingTestTags 降级为 info）`);
      } else {
        fail(`[sad-path] ${s.id} 缺测试 SC-xxx: 用例:失败模式未覆盖`);
      }
    }
    if (code.length > 0 && test.length > 0) pass(`[sad-path] ${s.id} 失败模式有实现+覆盖`);
  });

  return { checks, errors };
}

// ---------- 校验 sources ↔ feature 双向绑定 ----------
function validateSourcesBinding(sourcesPath, specScenarios) {
  const checks = [];
  const errors = [];
  function pass(msg) { checks.push({ ok: true, msg }); }
  function fail(msg) { checks.push({ ok: false, msg }); errors.push(msg); }

  if (!fs.existsSync(sourcesPath)) {
    fail(`sources.md 不存在（${path.relative(path.dirname(sourcesPath), sourcesPath)}）— build-spec 必须基于 sources.md`);
    return { checks, errors };
  }
  pass(`sources.md 存在`);

  const sources = parseSources(fs.readFileSync(sourcesPath, 'utf8'));

  if (!sources.reqs.length) {
    fail('sources.md 需求清单为空 — 至少 1 条 REQ');
    return { checks, errors };
  }
  pass(`sources.md 含 ${sources.reqs.length} 条 REQ`);

  // 1. 每条 REQ 必须有归属
  const SC_TARGET = /→\s*SC-\d{3}/;
  const OOS_TARGET = /Out\s*of\s*Scope/i;
  const unbound = sources.reqs.filter(r => !r.target || (!SC_TARGET.test(r.target) && !OOS_TARGET.test(r.target)));
  unbound.forEach(r => fail(`${r.id} 无归属：必须在"归属"列填 → SC-xxx 或 Out of Scope`));
  if (!unbound.length) pass('所有 REQ 都有归属（→ SC-xxx 或 Out of Scope）');

  // 2. 提取所有 REQ 引用的 SC ID，校验 spec.feature 中都存在
  const referencedScIds = new Set();
  sources.reqs.forEach(r => {
    const m = r.target.match(/SC-\d{3}/g);
    if (m) m.forEach(id => referencedScIds.add(id));
  });
  const specScIds = new Set(specScenarios.map(s => s.id).filter(Boolean));
  const orphanRefs = [...referencedScIds].filter(id => !specScIds.has(id));
  orphanRefs.forEach(id => fail(`sources.md 引用了 ${id}，但 spec.feature 不存在此 Scenario`));
  if (!orphanRefs.length && referencedScIds.size) pass('sources.md 引用 SC 全部存在于 spec.feature');

  // 3. spec.feature 的每个 SC 必须在 sources.md 找到对应 REQ（防凭空多写）
  const orphanSc = [...specScIds].filter(id => !referencedScIds.has(id));
  orphanSc.forEach(id => fail(`spec.feature 含 ${id}，但 sources.md 无对应 REQ — 禁止凭空多写`));
  if (!orphanSc.length && specScIds.size) pass('spec.feature 每个 SC 都能追溯到 sources.md');

  return { checks, errors, sources };
}

// ---------- 校验 ----------
//
// 阶段化 + 缺测试降级：
// - phase=implemented: 允许"代码有 @spec / 测试无 SC-xxx: 用例"的 SC 降级为 info，前提是 SC 至少有一个 tag 在 allowMissingTestTags 列表里
// - phase=verified: 全 1:1 强约束（allowMissingTestTags 列表不生效）
//
// 设计：validate() 内部对每个 SC 计算 `missingTestEligible`（是否在当前 allowMissingTestTags 配置下可降级），
// 然后根据 phase 决定是否生成"绑定不完整"错误。这样 capabilities 真的驱动校验，不是死代码。
function validate(projectDir, options = {}) {
  const phase = options.phase || 'verified';
  const allowMissingTestTags = options.allowMissingTestTags || [];

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

  // 6.5. sources.md ↔ spec.feature 双向绑定（防需求遗漏 / 凭空多写）
  const sourcesPath = path.join(path.dirname(specPath), 'sources.md');
  const sourcesResult = validateSourcesBinding(sourcesPath, spec.scenarios);
  checks.push(...sourcesResult.checks);
  errors.push(...sourcesResult.errors);

  // 6.6. C5 Spec 评审锚点（防绕过 spec-review）
  // 必须有合法锚点(通过/未跑二选一),见 spec-review/SKILL.md 阶段 4
  // 此项是 prd 阶段 3a 机械门禁,LLM 偷不了懒
  const sourcesContent = fs.existsSync(sourcesPath)
    ? fs.readFileSync(sourcesPath, 'utf8')
    : '';
  const c5Result = validateC5Anchor(sourcesContent);
  checks.push(...c5Result.checks);
  errors.push(...c5Result.errors);

  // 6.7. C6 Intent 反述锚点(防需求漂移被绕过)
  // 收集带 @intent 的 SC,对照 sources.md 的 C6 锚点 + 强约束 Given/Then 形态
  const intentScenarios = spec.scenarios.filter(s => s.tags.includes('intent'));
  const intentResult = validateIntentAnchor(sourcesContent, intentScenarios, spec.scenarios);
  checks.push(...intentResult.checks);
  errors.push(...intentResult.errors);

  // 7.8.9. 绑定一致性（漂移检测）
  const codeMap = scanCode(projectDir);
  const testMap = scanTests(projectDir);

  // 6.8. @sad-path 强化绑定检查(基于已有 codeMap/testMap,零额外扫描)
  // 跟普通 SC 同要求,仅错误前缀加 [sad-path] 让失败模式无覆盖一眼可见
  // v0.5.2 P0：传 options 让 sad-path 也走 capabilities 数据驱动
  const sadPathScenarios = spec.scenarios.filter(s => s.tags.includes('sad-path'));
  const sadPathResult = validateSadPathBinding(sadPathScenarios, codeMap, testMap, { phase, allowMissingTestTags });
  checks.push(...sadPathResult.checks);
  errors.push(...sadPathResult.errors);
  const matrix = [];
  let boundCount = 0;
  const uniqueIds = [...new Set(ids)];
  // 收集"降级为 info"的 check/msg（不动 errors）
  const downgradedMsgs = new Set();
  for (const id of uniqueIds) {
    const code = codeMap[id] || [];
    const test = testMap[id] || [];
    const scObj = spec.scenarios.find(s => s.id === id);
    // @intent SC 是"反述意图"被人类确认,不是被测对象——豁免代码+测试绑定
    // C6 锚点已确保意图被锁,validator 7.8.9 不再要求
    const isIntent = scObj?.tags.includes('intent');
    const isSadPath = scObj?.tags.includes('sad-path');
    const hasCode = code.length > 0;
    const hasTest = test.length > 0;

    // 计算"在当前 allowMissingTestTags 下,这个 SC 缺测试可不可降级"
    // 条件：phase=implemented + 测试缺 + 代码有 + SC 至少一个 tag 在 allow 列表里
    const scTags = scObj?.tags || [];
    const tagAllowed = scTags.some(t => allowMissingTestTags.includes(t));
    const missingTestEligible =
      phase === 'implemented' && !hasTest && hasCode && tagAllowed;

    if (isIntent) {
      // @intent 不要求代码+测试绑定
      boundCount++;
    } else if (hasCode && hasTest) {
      boundCount++;
    } else if (missingTestEligible) {
      // implemented 阶段 + 缺测试 + 在 allowMissingTestTags 里 → 降级为 info,不计入 errors
      const tagLabel = scTags.filter(t => allowMissingTestTags.includes(t)).join('/');
      const prefix = isSadPath ? `[sad-path] ` : '';
      downgradedMsgs.add(`${prefix}${id} 绑定不完整（代码${code.length}处 / 测试${test.length}处） — ${tagLabel} 在 ${phase} 阶段缺测试降级为 info`);
    } else {
      // 真正的绑定不完整（无论 implemented 还是 verified）→ 计入 errors
      const prefix = isSadPath ? `[sad-path] ` : '';
      fail(`${prefix}${id} 绑定不完整（代码${code.length}处 / 测试${test.length}处）`);
    }
    matrix.push({ id, code, test, ok: isIntent || (hasCode && hasTest) || missingTestEligible });
  }
  // 把降级为 info 的消息加进 checks（不计入 errors，让 OPC 看到"哪些被放过"）
  for (const msg of downgradedMsgs) {
    checks.push({ ok: true, msg });
  }
  if (matrix.length && matrix.every(m => m.ok)) pass('所有 SC 已实现且已测试');
  if (matrix.length) pass(`追溯绑定：${boundCount}/${matrix.length} SC 完整${downgradedMsgs.size ? `（+${downgradedMsgs.size} 缺测试降级）` : ''}`);

  // 孤儿代码标注（代码标了 spec 没有的 SC）
  const orphanCode = Object.keys(codeMap).filter(id => !uniqueIds.includes(id));
  orphanCode.forEach(id => fail(`孤儿代码标注：${id} 在代码有 @spec 但 spec 无此 Scenario`));
  if (!orphanCode.length) pass('无孤儿代码标注');

  return { checks, errors, matrix, counts: { sc: uniqueIds.length, ok: boundCount }, version: spec.version, feature: spec.feature, phase, allowMissingTestTags, downgraded: downgradedMsgs.size };
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
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    const { printHelp } = require('./_lib/help');
    printHelp(__filename);
    process.exit(0);
  }
  // 支持 --phase=implemented|verified 阶段化校验
  // implemented: 只查代码 @spec 标注（#7），允许测试暂缺
  // verified: 查代码 + 测试 SC 完整绑定（#7 #8 full 1:1）
  // 默认 = verified（向后兼容）
  //
  // 支持 --allow-missing-test-tags=tag1,tag2 透传 capabilities.allowMissingTestTags
  // （v0.5.2 P0 改进：capabilities 字段是数据驱动的真信号，不再死代码）
  // 在 implemented 阶段：测试缺 + 代码有 + SC 至少一个 tag 在 allow 列表里 → 降级为 info
  // verified 阶段忽略此参数（全 1:1 强约束）
  //
  // 向后兼容：未传 --allow-missing-test-tags 时，implemented 阶段回退 v0.5.1 默认 ['happy','sad-path']。
  // 显式传空字符串（"--allow-missing-test-tags="）时，使用 []，即"什么也不放过"（spec-cli 透传 cap 的语义）。
  let phase = 'verified';
  let allowMissingTestTags;
  let allowTagsExplicitlySet = false;
  let dirArg = null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--phase=')) {
      phase = arg.slice('--phase='.length);
      if (!['implemented', 'verified'].includes(phase)) {
        console.error(`✗ --phase 取值只能是 implemented | verified，收到: ${phase}`);
        process.exit(2);
      }
    } else if (arg.startsWith('--allow-missing-test-tags=')) {
      allowMissingTestTags = arg.slice('--allow-missing-test-tags='.length)
        .split(',').map(s => s.trim()).filter(Boolean);
      allowTagsExplicitlySet = true;
    } else if (!arg.startsWith('--')) {
      dirArg = arg;
    }
  }
  // 未显式传参 → 回退 v0.5.1 默认（保持向后兼容）
  if (!allowTagsExplicitlySet) {
    allowMissingTestTags = ['happy', 'sad-path'];
  }
  const projectDir = path.resolve(dirArg || process.cwd());
  const result = validate(projectDir, { phase, allowMissingTestTags });
  const { text, passed } = report(result, projectDir);
  console.log(text);
  process.exit(passed ? 0 : 1);
}

if (require.main === module) main();
module.exports = { main, validate, parseSpec, parseSources, scanCode, scanTests, walk };

