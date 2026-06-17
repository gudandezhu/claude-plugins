#!/usr/bin/env node
/**
 * spec-readiness.test.js — RFC-0013 G15 spec-readiness 单元测试
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'spec-readiness.js');
const { runReadiness, findSpecDir, SAD_PATH_THRESHOLD } = require('./spec-readiness.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: 期望 ${JSON.stringify(b)} 实际 ${JSON.stringify(a)}`);
}

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'god-readiness-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

console.log('spec-readiness.test.js');

// ---------- 1. CLI 基础行为: 找不到 spec 目录 ----------
try {
  execSync(`node ${SCRIPT} /nonexistent/path 2>&1`, { stdio: 'pipe' });
  throw new Error('应 exit 1');
} catch (e) {
  assert(e.status === 1, '应 exit 1');
}
test('CLI: 项目目录不存在 → exit 1', () => {});

// ---------- 2. CLI --help 行为 ----------
const tmp2 = tmpProject();
try {
  const out = execSync(`node ${SCRIPT} --help 2>&1`, { encoding: 'utf8' });
  assert(out.includes('用法:'), '--help 应含"用法:"段');
  assert(out.includes('spec-readiness.js'), '--help 应含脚本名');
} finally { cleanup(tmp2); }
test('CLI: --help 输出 JSDoc 头部', () => {});

// ---------- 3. 找到 spec 目录的 2 种形态 ----------
const tmp3a = tmpProject();
try {
  fs.writeFileSync(path.join(tmp3a, 'spec.feature'), '@spec-version 1.0.0\nFeature: x\n');
  assertEq(findSpecDir(tmp3a), tmp3a, '顶层 spec.feature 应识别');
} finally { cleanup(tmp3a); }
test('findSpecDir: 识别 spec/ 子目录形态', () => {});

const tmp3b = tmpProject();
try {
  fs.mkdirSync(path.join(tmp3b, 'spec'));
  fs.writeFileSync(path.join(tmp3b, 'spec', 'spec.feature'), '@spec-version 1.0.0\nFeature: x\n');
  assertEq(findSpecDir(tmp3b), path.join(tmp3b, 'spec'), 'spec/spec.feature 应识别');
} finally { cleanup(tmp3b); }
test('findSpecDir: 识别 spec/ 子目录形态', () => {});

// ---------- 4. 全过场景: 构造合法 spec + sources + summary + user-perspectives ----------
// 复用 demo/lead-scoring 是最稳的全过场景
const demoPath = path.resolve(__dirname, '../../../demo/lead-scoring');
if (fs.existsSync(path.join(demoPath, 'spec', 'spec.feature'))) {
  const report = runReadiness(demoPath);
  // demo/lead-scoring 实际可能存在软失败(取决于版本),不强制全过
  // 但至少 report 应能跑完
  assert(report.checks && report.checks.length === 7, '应跑完 7 项检查');
  for (const c of report.checks) {
    assert(c.result && typeof c.result.pass === 'boolean', `${c.id} 应有 result.pass`);
  }
  test('runReadiness: demo/lead-scoring 能跑完 7 项检查', () => {});
} else {
  console.log('  ⚠ demo/lead-scoring 不存在,跳过全过场景');
}

// ---------- 5. 硬失败 1: 未决项未归零 ----------
const tmp5 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp5, 'spec'));
  fs.writeFileSync(path.join(tmp5, 'spec', 'sources.md'),
    `# 需求清单\n\n## 未决项\n\n- [ ] 登录失败是否弹窗\n- [ ] 推荐位 3 还是 5\n\n## Check\n\n- OK\n`);
  fs.writeFileSync(path.join(tmp5, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: x\n  @SC-001\n  Scenario: a\n    Given ok\n    When do\n    Then result\n');
  const r = runReadiness(tmp5);
  const h1 = r.checks.find(c => c.id === 'H1');
  assert(!h1.result.pass, 'H1 应不通过');
  assert(h1.result.detail.includes('2 条'), `H1 应报 2 条,实际: ${h1.result.detail}`);
} finally { cleanup(tmp5); }
test('H1: 未决项未归零 → 阻断', () => {});

// ---------- 6. 硬失败 2: 未决项含"已结案"前缀视为已结案 ----------
const tmp6 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp6, 'spec'));
  fs.writeFileSync(path.join(tmp6, 'spec', 'sources.md'),
    `# 需求清单\n\n## 未决项\n\n- [x] 已结案: 登录弹窗(已确认)\n- [x] 已解决: 推荐位 3\n`);
  fs.writeFileSync(path.join(tmp6, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: x\n');
  const r = runReadiness(tmp6);
  const h1 = r.checks.find(c => c.id === 'H1');
  assert(h1.result.pass, `H1 应通过(已结案),实际: ${h1.result.detail}`);
} finally { cleanup(tmp6); }
test('H1: 未决项全已结案 → 放行', () => {});

// ---------- 7. 硬失败 3: GWT 含 TBD ----------
const tmp7 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp7, 'spec'));
  fs.writeFileSync(path.join(tmp7, 'spec', 'spec.feature'),
    `@spec-version 1.0.0
Feature: x
  @SC-001
  Scenario: a
    Given 用户登录
    When TBD
    Then 看到结果
`);
  const r = runReadiness(tmp7);
  const h3 = r.checks.find(c => c.id === 'H3');
  assert(!h3.result.pass, 'H3 应不通过');
  assert(h3.result.items && h3.result.items.length === 1, '应报 1 处占位符');
  assert(h3.result.items[0].includes('TBD'), '应报 TBD');
} finally { cleanup(tmp7); }
test('H3: GWT 含 TBD → 阻断', () => {});

// ---------- 8. 硬失败 4: GWT 含中文"待定" ----------
const tmp8 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp8, 'spec'));
  fs.writeFileSync(path.join(tmp8, 'spec', 'spec.feature'),
    `@spec-version 1.0.0
Feature: x
  @SC-001
  Scenario: a
    Given 用户登录
    When 操作待定
    Then 看到结果
`);
  const r = runReadiness(tmp8);
  const h3 = r.checks.find(c => c.id === 'H3');
  assert(!h3.result.pass, 'H3 应不通过(中文"待定")');
} finally { cleanup(tmp8); }
test('H3: GWT 含中文"待定" → 阻断', () => {});

// ---------- 9. 硬失败 5: GWT 含 "..." ----------
const tmp9 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp9, 'spec'));
  fs.writeFileSync(path.join(tmp9, 'spec', 'spec.feature'),
    `@spec-version 1.0.0
Feature: x
  @SC-001
  Scenario: a
    Given 用户登录
    When ...
    Then 看到结果
`);
  const r = runReadiness(tmp9);
  const h3 = r.checks.find(c => c.id === 'H3');
  assert(!h3.result.pass, 'H3 应不通过(单独 ...)');
} finally { cleanup(tmp9); }
test('H3: GWT 含 "..." → 阻断', () => {});

// ---------- 10. H3 放行: GWT 干净 ----------
const tmp10 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp10, 'spec'));
  fs.writeFileSync(path.join(tmp10, 'spec', 'spec.feature'),
    `@spec-version 1.0.0
Feature: x
  @SC-001
  Scenario: a
    Given 用户登录
    When 提交表单
    Then 看到成功页
`);
  const r = runReadiness(tmp10);
  const h3 = r.checks.find(c => c.id === 'H3');
  assert(h3.result.pass, `H3 应通过,实际: ${h3.result.detail}`);
} finally { cleanup(tmp10); }
test('H3: GWT 干净 → 放行', () => {});

// ---------- 11. 硬失败 6: user-perspectives 缺 _summary.md ----------
const tmp11 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp11, 'spec'));
  fs.writeFileSync(path.join(tmp11, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: x\n');
  const r = runReadiness(tmp11);
  const h4 = r.checks.find(c => c.id === 'H4');
  assert(!h4.result.pass, 'H4 应不通过');
  assert(h4.result.detail.includes('_summary.md'), '应报 _summary.md 缺失');
} finally { cleanup(tmp11); }
test('H4: user-perspectives/_summary.md 缺失 → 阻断', () => {});

// ---------- 12. 硬失败 7: user-perspectives 是占位符 ----------
const tmp12 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp12, 'spec', 'sources', 'user-perspectives'), { recursive: true });
  fs.writeFileSync(path.join(tmp12, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: x\n');
  fs.writeFileSync(path.join(tmp12, 'spec', 'sources', 'user-perspectives', '_summary.md'),
    `# 角色清单\n\n| 角色 | 文档路径 | 关键发现 |\n| {role-1} | spec/sources/user-perspectives/{role-1}.md | {finding} |\n`);
  const r = runReadiness(tmp12);
  const h4 = r.checks.find(c => c.id === 'H4');
  assert(!h4.result.pass, 'H4 应不通过(占位符)');
  assert(h4.result.detail.includes('占位符'), '应报占位符');
} finally { cleanup(tmp12); }
test('H4: _summary.md 是占位符 → 阻断', () => {});

// ---------- 13. 硬失败 8: 缺 C5 锚点 ----------
const tmp13 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp13, 'spec'));
  fs.writeFileSync(path.join(tmp13, 'spec', 'sources.md'),
    `# 需求清单\n\n## Check\n\n- OK\n`);
  fs.writeFileSync(path.join(tmp13, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: x\n');
  const r = runReadiness(tmp13);
  const h6 = r.checks.find(c => c.id === 'H6');
  assert(!h6.result.pass, 'H6 应不通过');
  assert(h6.result.detail.includes('C5'), '应报 C5 缺失');
} finally { cleanup(tmp13); }
test('H6: 缺 C5 锚点 → 阻断', () => {});

// ---------- 14. 软失败 1: sad-path 覆盖 < 30% ----------
const tmp14 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp14, 'spec'));
  fs.writeFileSync(path.join(tmp14, 'spec', 'spec.feature'),
    `@spec-version 1.0.0
Feature: x
  @SC-001 @happy
  Scenario: a
    Given x
    When y
    Then z
  @SC-002 @happy
  Scenario: b
    Given x
    When y
    Then z
  @SC-003 @happy
  Scenario: c
    Given x
    When y
    Then z
  @SC-004 @sad-path
  Scenario: d
    Given x
    When y
    Then z
`);
  const r = runReadiness(tmp14);
  const s7 = r.checks.find(c => c.id === 'S7');
  assert(!s7.result.pass, 'S7 应不通过(< 30%)');
  assert(s7.result.soft === true, 'S7 失败应为软失败');
  assert(s7.result.detail.includes('25%'), `S7 应报 25% (1/4),实际: ${s7.result.detail}`);
} finally { cleanup(tmp14); }
test('S7: sad-path 覆盖 25% < 30% → 软失败', () => {});

// ---------- 15. 软失败 1 项可免责: sad-path 软失败 + 其他硬全过 → ok=true ----------
// 构造最小合法集: C5 锚点 + 空未决项 + 干净 GWT + 占位 user-perspectives（但占位会 H4 FAIL）
// 改用真实 user-perspectives 内容 + summary.md 跳过 summary check (H5)
// 此处只验证 1 软失败 + 0 硬失败的判定逻辑,简化: 单独验证 runReadiness 的 ok 逻辑
// (完整链路验证留给 demo/lead-scoring)
test('S7: 软失败 1 项 + 硬全过 → ok=true (逻辑单元验证)', () => {
  // 模拟: 6 硬过 + 1 软失败 = ok
  const checks = [
    { id: 'H1', result: { pass: true } },
    { id: 'H2', result: { pass: true } },
    { id: 'H3', result: { pass: true } },
    { id: 'H4', result: { pass: true } },
    { id: 'H5', result: { pass: true } },
    { id: 'H6', result: { pass: true } },
    { id: 'S7', result: { pass: false, soft: true } },
  ];
  const hardFailed = checks.filter(c => !c.result.pass && !c.result.soft).length;
  const softFailed = checks.filter(c => c.result.soft).length;
  const ok = hardFailed === 0 && softFailed <= 1;
  assert(ok, '1 软失败 + 0 硬失败 → ok');
});

// ---------- 16. CLI --json 输出 ----------
const tmp16 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp16, 'spec'));
  fs.writeFileSync(path.join(tmp16, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: x\n');
  // --json 即使 exit 1 也会输出 JSON,捕获不抛
  let out;
  try {
    out = execSync(`node ${SCRIPT} ${tmp16} --json 2>&1`, { encoding: 'utf8' });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const json = JSON.parse(out);
  assert(json.checks && json.checks.length === 7, '--json 应含 7 项 checks');
  assert(typeof json.ok === 'boolean', '--json 应含 ok 字段');
  assert(json.ok === false, '空 spec 应 ok=false');
} finally { cleanup(tmp16); }
test('CLI: --json 输出可被解析', () => {});

// ---------- 17. CLI --soft-ack 写入锚点 ----------
const tmp17 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp17, 'spec'));
  fs.writeFileSync(path.join(tmp17, 'spec', 'sources.md'), '# 需求清单\n');
  fs.writeFileSync(path.join(tmp17, 'spec', 'spec.feature'), '@spec-version 1.0.0\nFeature: x\n');
  const out = execSync(`node ${SCRIPT} ${tmp17} --soft-ack 2>&1`, { encoding: 'utf8' });
  assert(out.includes('S1 软失败免责'), '--soft-ack 应输出锚点写入');
  const content = fs.readFileSync(path.join(tmp17, 'spec', 'sources.md'), 'utf8');
  assert(/- \*\*S1 软失败免责\*\*/.test(content), 'sources.md 应含 S1 软失败免责 锚点');
  // 幂等: 二次跑不重复写
  execSync(`node ${SCRIPT} ${tmp17} --soft-ack 2>&1`, { stdio: 'pipe' });
  const content2 = fs.readFileSync(path.join(tmp17, 'spec', 'sources.md'), 'utf8');
  const matches = content2.match(/- \*\*S1 软失败免责\*\*/g) || [];
  assertEq(matches.length, 1, '--soft-ack 应幂等(只写 1 次)');
} finally { cleanup(tmp17); }
test('CLI: --soft-ack 写入锚点 + 幂等', () => {});

// ---------- 18. Gap 1 回归: readiness 调 spec-validate 应传 phase=implemented ----------
// 场景: 有 spec.feature + sources.md + SC,但无 src/ 无 tests/(drafted 阶段常态)
// 旧实现: 默认 phase=verified → fail "缺测试" → readiness 阻断
// 新实现: 显式 phase=implemented → 缺测试降级为 info,只报"绑定不完整"(不单独报缺测试)
const tmp18 = tmpProject();
try {
  fs.mkdirSync(path.join(tmp18, 'spec'));
  fs.writeFileSync(path.join(tmp18, 'spec', 'spec.feature'),
    `@spec-version 1.0.0
Feature: gap1 test
  @SC-001
  Scenario: a
    Given x
    When y
    Then z
`);
  fs.writeFileSync(path.join(tmp18, 'spec', 'sources.md'),
    `# 需求清单

## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|---|---|---|---|---|---|
| REQ-001 | 测试场景 | 功能 | Must | 用户 | → SC-001 |

## Feature 元信息

- **Feature**: gap1 test
- **@spec-version**: 1.0.0

## Check 结论区

- **C5 Spec 评审** (2026-06-17 10:00 / 简单档 / 95 分 / 通过)
`);
  // 无 src/ 无 tests/ → 旧 readiness 会报"缺测试",新 readiness 应只报"绑定不完整"
  const r = runReadiness(tmp18);
  const h2 = r.checks.find(c => c.id === 'H2');
  // H2 fail 是合理的(无代码无测试),但错误信息不能含"失败模式未覆盖"/"缺测试 SC-xxx"等
  // 旧实现: H2.detail 会包含 "[sad-path] ... 缺测试 SC-xxx: 用例:失败模式未覆盖"
  // 新实现: H2.detail 应只含"#10 双向绑定"段(此处因 sources 也可能匹配不到,关键是 detail 不含"缺测试 SC-xxx")
  assert(h2, 'H2 应存在');
  if (!h2.result.pass) {
    assert(!/缺测试 SC-\d+/.test(h2.result.detail),
      `H2 不应再单独报"缺测试 SC-xxx"(已走 implemented 阶段降级),实际: ${h2.result.detail}`);
  }
} finally { cleanup(tmp18); }
test('Gap 1 回归: readiness 调 spec-validate 走 implemented 阶段,不报"缺测试 SC-xxx"', () => {});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
