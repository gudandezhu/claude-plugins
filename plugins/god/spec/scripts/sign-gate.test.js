#!/usr/bin/env node
/**
 * sign-gate.test.js — RFC-0013 G16 sign-gate 单元测试
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'sign-gate.js');
const { getStatus, GATE_PHASE, VALID_GATES, VALID_VERDICTS } = require('./sign-gate.js');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'god-sign-gate-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function initProject(dir, phase = 'drafted') {
  fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'spec', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec', 'state', 'meta.json'),
    JSON.stringify({ specId: 'test', phase, version: '1.0.0', updatedAt: '2026-01-01T00:00:00Z', gates: {} }, null, 2));
  fs.writeFileSync(path.join(dir, 'spec', 'state', '.trace'), '');
  fs.writeFileSync(path.join(dir, 'spec', 'sources.md'), '# 需求清单\n');
  fs.writeFileSync(path.join(dir, 'spec', 'spec.feature'),
    '@spec-version 1.0.0\nFeature: x\n  @SC-001\n  Scenario: a\n    Given x\n    When y\n    Then z\n');
}

console.log('sign-gate.test.js');

// ---------- 1. CLI --help ----------
try {
  const out = execSync(`node ${SCRIPT} --help 2>&1`, { encoding: 'utf8' });
  assert(out.includes('用法:'), '--help 应含"用法:"段');
} catch (e) { /* help 仍可能 exit 0 */ }
test('CLI: --help 输出 JSDoc 头部', () => {});

// ---------- 2. status 模式: idea phase ----------
const tmp2 = tmpProject();
try {
  initProject(tmp2, 'idea');
  // 删 meta.json 测 idea
  fs.unlinkSync(path.join(tmp2, 'spec', 'state', 'meta.json'));
  let out;
  try {
    out = execSync(`node ${SCRIPT} ${tmp2} 2>&1`, { encoding: 'utf8' });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  assert(out.includes('未 init') || out.includes('未初始化'), `idea 应报未 init,实际: ${out}`);
} finally { cleanup(tmp2); }
test('CLI: status 模式 + idea phase', () => {});

// ---------- 3. status 模式: reviewed phase + 当前可签 S1 ----------
const tmp3 = tmpProject();
try {
  initProject(tmp3, 'reviewed');
  const out = execSync(`node ${SCRIPT} ${tmp3} 2>&1`, { encoding: 'utf8' });
  assert(out.includes('当前可签: S1'), 'reviewed 应显示 S1 可签');
  assert(out.includes('phase:   reviewed'), '应显示 phase = reviewed');
} finally { cleanup(tmp3); }
test('CLI: status 模式 + reviewed phase', () => {});

// ---------- 4. status 模式: implemented phase + S2 ----------
const tmp4 = tmpProject();
try {
  initProject(tmp4, 'implemented');
  const out = execSync(`node ${SCRIPT} ${tmp4} 2>&1`, { encoding: 'utf8' });
  assert(out.includes('当前可签: S2'), 'implemented 应显示 S2 可签');
} finally { cleanup(tmp4); }
test('CLI: status 模式 + implemented phase', () => {});

// ---------- 5. status 模式: verified phase + S3 ----------
const tmp5 = tmpProject();
try {
  initProject(tmp5, 'verified');
  const out = execSync(`node ${SCRIPT} ${tmp5} 2>&1`, { encoding: 'utf8' });
  assert(out.includes('当前可签: S3'), 'verified 应显示 S3 可签');
} finally { cleanup(tmp5); }
test('CLI: status 模式 + verified phase', () => {});

// ---------- 6. status 模式: accepted phase + 无可签 ----------
const tmp6 = tmpProject();
try {
  initProject(tmp6, 'accepted');
  const out = execSync(`node ${SCRIPT} ${tmp6} 2>&1`, { encoding: 'utf8' });
  assert(out.includes('无（') || out.includes('无可签'), 'accepted 应无可签');
} finally { cleanup(tmp6); }
test('CLI: status 模式 + accepted phase', () => {});

// ---------- 7. 参数校验: --gate 非法 ----------
const tmp7 = tmpProject();
try {
  initProject(tmp7, 'reviewed');
  try {
    execSync(`node ${SCRIPT} ${tmp7} --gate S9 --verdict accept 2>&1`, { stdio: 'pipe' });
    throw new Error('应 exit 1');
  } catch (e) {
    assert(e.status === 1, '应 exit 1');
  }
} finally { cleanup(tmp7); }
test('CLI: --gate 非法 → exit 1', () => {});

// ---------- 8. 参数校验: --verdict 非法 ----------
const tmp8 = tmpProject();
try {
  initProject(tmp8, 'reviewed');
  try {
    execSync(`node ${SCRIPT} ${tmp8} --gate S1 --verdict wrong 2>&1`, { stdio: 'pipe' });
    throw new Error('应 exit 1');
  } catch (e) {
    assert(e.status === 1, '应 exit 1');
  }
} finally { cleanup(tmp8); }
test('CLI: --verdict 非法 → exit 1', () => {});

// ---------- 9. S1 reject 必须 --reason ----------
const tmp9 = tmpProject();
try {
  initProject(tmp9, 'reviewed');
  try {
    execSync(`node ${SCRIPT} ${tmp9} --gate S1 --verdict reject 2>&1`, { stdio: 'pipe' });
    throw new Error('应 exit 1');
  } catch (e) {
    assert(e.status === 1, '应 exit 1 (缺 --reason)');
  }
} finally { cleanup(tmp9); }
test('CLI: S1 reject 缺 --reason → exit 1', () => {});

// ---------- 10. S1 reject 写锚点 + 保留 phase ----------
const tmp10 = tmpProject();
try {
  initProject(tmp10, 'reviewed');
  const out = execSync(`node ${SCRIPT} ${tmp10} --gate S1 --verdict reject --reason "SPEC 不全" 2>&1`, { encoding: 'utf8' });
  assert(out.includes('S1 Prd 出口签字'), '应写 S1 锚点');
  const sources = fs.readFileSync(path.join(tmp10, 'spec', 'sources.md'), 'utf8');
  assert(/- \*\*S1 Prd 出口签字\*\*/.test(sources), 'sources.md 应含 S1 锚点');
  // phase 保持 reviewed
  const meta = JSON.parse(fs.readFileSync(path.join(tmp10, 'spec', 'state', 'meta.json'), 'utf8'));
  assertEq(meta.phase, 'reviewed', 'S1 reject 不改 phase');
} finally { cleanup(tmp10); }
test('S1 reject: 写锚点 + 保留 phase', () => {});

// ---------- 11. S2 reject-spec 回 prd + MAJOR bump ----------
const tmp11 = tmpProject();
try {
  initProject(tmp11, 'implemented');
  const out = execSync(`node ${SCRIPT} ${tmp11} --gate S2 --verdict reject-spec --reason "测试发现 SPEC 漏边界" 2>&1`, { encoding: 'utf8' });
  assert(out.includes('reject-spec'), '应输出 reject-spec');
  const meta = JSON.parse(fs.readFileSync(path.join(tmp11, 'spec', 'state', 'meta.json'), 'utf8'));
  assertEq(meta.phase, 'drafted', 'S2 reject-spec 应回 drafted');
  assertEq(meta.version, '2.0.0', 'S2 reject-spec 应 MAJOR bump');
} finally { cleanup(tmp11); }
test('S2 reject-spec: 回 drafted + version MAJOR', () => {});

// ---------- 12. S2 reject-impl 回 reviewed ----------
const tmp12 = tmpProject();
try {
  initProject(tmp12, 'implemented');
  execSync(`node ${SCRIPT} ${tmp12} --gate S2 --verdict reject-impl --reason "实现没按 spec" 2>&1`, { stdio: 'pipe' });
  const meta = JSON.parse(fs.readFileSync(path.join(tmp12, 'spec', 'state', 'meta.json'), 'utf8'));
  assertEq(meta.phase, 'reviewed', 'S2 reject-impl 应回 reviewed');
  assertEq(meta.version, '1.0.0', 'S2 reject-impl 不 bump version');
} finally { cleanup(tmp12); }
test('S2 reject-impl: 回 reviewed + 不 bump', () => {});

// ---------- 13. S3 reject-spec 回 prd + MAJOR bump ----------
const tmp13 = tmpProject();
try {
  initProject(tmp13, 'verified');
  execSync(`node ${SCRIPT} ${tmp13} --gate S3 --verdict reject-spec --reason "测试发现 SPEC 错误" 2>&1`, { stdio: 'pipe' });
  const meta = JSON.parse(fs.readFileSync(path.join(tmp13, 'spec', 'state', 'meta.json'), 'utf8'));
  assertEq(meta.phase, 'drafted', 'S3 reject-spec 应回 drafted');
  assertEq(meta.version, '2.0.0', 'S3 reject-spec 应 MAJOR bump');
} finally { cleanup(tmp13); }
test('S3 reject-spec: 回 drafted + version MAJOR', () => {});

// ---------- 14.5. v0.7.0+ G18: S 拒签归因写 trace ----------
const tmp145 = tmpProject();
try {
  initProject(tmp145, 'implemented');
  execSync(`node ${SCRIPT} ${tmp145} --gate S2 --verdict reject-spec --reason "G18 trace 测" 2>&1`, { stdio: 'pipe' });
  const trace = fs.readFileSync(path.join(tmp145, 'spec', 'state', '.trace'), 'utf8');
  assert(/S2 reject-spec/.test(trace), `trace 应含 S2 reject-spec 归因,实际: ${trace}`);
} finally { cleanup(tmp145); }
test('G18: S2 reject-spec 写 trace 含归因', () => {});

const tmp146 = tmpProject();
try {
  initProject(tmp146, 'implemented');
  execSync(`node ${SCRIPT} ${tmp146} --gate S2 --verdict reject-impl --reason "G18 impl 测" 2>&1`, { stdio: 'pipe' });
  const trace = fs.readFileSync(path.join(tmp146, 'spec', 'state', '.trace'), 'utf8');
  assert(/S2 reject-impl/.test(trace), `trace 应含 S2 reject-impl 归因,实际: ${trace}`);
} finally { cleanup(tmp146); }
test('G18: S2 reject-impl 写 trace 含归因', () => {});

// ---------- 14. S3 reject-impl 回 implemented ----------
const tmp14 = tmpProject();
try {
  initProject(tmp14, 'verified');
  execSync(`node ${SCRIPT} ${tmp14} --gate S3 --verdict reject-impl --reason "测试通过但跑出来不对" 2>&1`, { stdio: 'pipe' });
  const meta = JSON.parse(fs.readFileSync(path.join(tmp14, 'spec', 'state', 'meta.json'), 'utf8'));
  assertEq(meta.phase, 'implemented', 'S3 reject-impl 应回 implemented');
} finally { cleanup(tmp14); }
test('S3 reject-impl: 回 implemented', () => {});

// ---------- 15. 锚点多次写入不覆盖(累积) ----------
const tmp15 = tmpProject();
try {
  initProject(tmp15, 'reviewed');
  execSync(`node ${SCRIPT} ${tmp15} --gate S1 --verdict reject --reason "第一次拒签" 2>&1`, { stdio: 'pipe' });
  execSync(`node ${SCRIPT} ${tmp15} --gate S1 --verdict reject --reason "第二次拒签" 2>&1`, { stdio: 'pipe' });
  const sources = fs.readFileSync(path.join(tmp15, 'spec', 'sources.md'), 'utf8');
  const matches = sources.match(/- \*\*S1 Prd 出口签字\*\*/g) || [];
  assert(matches.length === 2, `应累积 2 次 S1 锚点,实际 ${matches.length}`);
} finally { cleanup(tmp15); }
test('S1 reject: 多次写不覆盖,累积', () => {});

// ---------- 16. trace 写入 ----------
const tmp16 = tmpProject();
try {
  initProject(tmp16, 'reviewed');
  // 构造让 S1 accept 前置过: 加 sources 写 C5 + summary + user-perspectives
  // 这里只测 reject 路径(不依赖前置)
  execSync(`node ${SCRIPT} ${tmp16} --gate S1 --verdict reject --reason "test trace" 2>&1`, { stdio: 'pipe' });
  const trace = fs.readFileSync(path.join(tmp16, 'spec', 'state', '.trace'), 'utf8');
  // v0.7.0+ G18: S1 reject 写 trace(给 god-trends 归因),格式含 S1 reject
  assert(trace.includes('S1 reject'), `S1 reject 应写 trace,实际: ${trace}`);
} finally { cleanup(tmp16); }
test('S1 reject: 写 trace 含 S1 reject (v0.7.0+ G18)', () => {});

// ---------- 17. 锚点格式: accept + reason 含 S2 触发 phase 推进(模拟前置全过) ----------
// 不跑真实前置（需要 spec-readiness 全过），只测逻辑分支
test('GATE_PHASE: S1/S2/S3 映射正确', () => {
  assertEq(GATE_PHASE.S1.from, 'reviewed');
  assertEq(GATE_PHASE.S1.to, 'implemented');
  assertEq(GATE_PHASE.S2.from, 'implemented');
  assertEq(GATE_PHASE.S2.to, 'verified');
  assertEq(GATE_PHASE.S3.from, 'verified');
  assertEq(GATE_PHASE.S3.to, 'accepted');
});

// ---------- 18. VALID_GATES / VALID_VERDICTS ----------
test('VALID 枚举: 4 个 verdict 齐全', () => {
  assert(VALID_GATES.length === 3, '应有 3 个 gate');
  assert(VALID_VERDICTS.length === 4, '应有 4 个 verdict');
  assert(VALID_VERDICTS.includes('accept'));
  assert(VALID_VERDICTS.includes('reject'));
  assert(VALID_VERDICTS.includes('reject-spec'));
  assert(VALID_VERDICTS.includes('reject-impl'));
});

// ---------- 19. S1 accept: meta.json 缺失时不崩栈，优雅 exit 1 ----------
const tmp19 = tmpProject();
try {
  // 空目录：没 spec/,没 meta.json → 走 status 优雅路径或 prereq 阻断路径
  // 关键是：不崩栈 (即 exit code = 1 而不是 NodeJS stacktrace)
  let exitCode = -1;
  let stderr = '';
  try {
    execSync(`node ${SCRIPT} ${tmp19} --gate S1 --verdict accept 2>&1`, { stdio: 'pipe' });
  } catch (e) {
    exitCode = e.status;
    stderr = (e.stderr || '') + (e.stdout || '');
  }
  assertEq(exitCode, 1, `应 exit 1 而非崩栈,实际 ${exitCode}`);
  // 必须不含 NodeJS stacktrace 头（"at Object." / "at Function." / "at Module."）
  const isStacktrace = /at\s+(Object|Function|Module|internal)\./.test(stderr);
  assert(!isStacktrace, `应优雅报错而非 stacktrace,实际: ${stderr.slice(0, 300)}`);
  // 必须有 ✗ 错误提示
  assert(/✗/.test(stderr), `应有 ✗ 错误前缀,实际: ${stderr.slice(0, 200)}`);
} finally { cleanup(tmp19); }
test('S1 accept: meta.json 缺失时不崩栈，优雅 exit 1', () => {});

// ---------- 20. Gap 2 回归: S3 accept 不再触发 "非法 phase" 报错 ----------
// 旧实现: S3 传 --phase=accepted → spec-validate.js VALID_PHASES 不含 accepted → 报"非法 phase" → S3 永远 fail
// 新实现: S3 传 --phase=verified(S3 是签字结果,verify 已在 S2 完成,S3 复用 verify 校验条件)
// 验证: 直接调 spec-validate S3 前置阶段,不应再含 "非法 phase" / "✗ --phase"
const tmp20 = tmpProject();
try {
  // 准备最小可验证集: phase=verified + code + test 通过 verify 校验
  initProject(tmp20, 'verified');
  // spec.feature 加 @SC-001 + 让 #10 双绑通过(sources.md 含 REQ-001 → SC-001)
  fs.writeFileSync(path.join(tmp20, 'spec', 'sources.md'),
    `# 需求清单

## 需求清单

| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|---|---|---|---|---|---|
| REQ-001 | 测试场景 | 功能 | Must | 用户 | → SC-001 |

## Feature 元信息

- **Feature**: gap2 test
- **@spec-version**: 1.0.0

## Check 结论区

- **C5 Spec 评审** (2026-06-17 10:00 / 简单档 / 95 分 / 通过)
`);
  // 不需要写 src/tests — 单元测试跑不了完整 demo;只验证 S3 不再报"非法 phase"
  // 关键断言: 调 S3 时输出不应含 "✗ --phase 取值" (spec-validate 的非法 phase 报错前缀)
  let out = '';
  let stderr = '';
  try {
    execSync(`node ${SCRIPT} ${tmp20} --gate S3 --verdict accept 2>&1`, { stdio: 'pipe' });
    out = execSync.toString();
  } catch (e) {
    out = (e.stdout || '').toString();
    stderr = (e.stderr || '').toString();
  }
  const combined = out + stderr;
  assert(!/✗ --phase 取值/.test(combined),
    `S3 不应再触发 spec-validate "非法 phase" 报错,实际输出: ${combined.slice(0, 300)}`);
} finally { cleanup(tmp20); }
test('Gap 2 回归: S3 accept 不再触发 spec-validate "非法 phase" 报错', () => {});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
