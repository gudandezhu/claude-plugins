'use strict';
/**
 * cron.test.js — cron.js 单元测试
 *
 * 覆盖：
 *   - parseOnArgs 边界 + 非法
 *   - buildCronExpr 各档位 + 避高峰
 *   - buildPrompt 必含关键串（cd / check-facade / 不 push / 禁改 spec）
 */

const {
  parseOnArgs,
  buildCronExpr,
  buildPrompt,
  DEFAULT_MINUTES,
  MIN_MINUTES,
  MAX_MINUTES,
} = require('./cron');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    fail++;
  }
}
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg || 'assertTrue failed');
}
function assertThrows(fn, pattern, msg) {
  let caught = null;
  try { fn(); } catch (e) { caught = e; }
  if (!caught) throw new Error(`${msg || 'assertThrows'}: 没抛错`);
  if (pattern && !pattern.test(caught.message)) {
    throw new Error(`${msg || 'assertThrows'}: 错误信息不匹配 ${pattern}, got: ${caught.message}`);
  }
}

console.log('cron.test.js');

// ──────────────────────────── parseOnArgs ────────────────────────────

test('parseOnArgs: 空参数 = 默认 30', () => {
  assertEqual(parseOnArgs([]), 30);
  assertEqual(parseOnArgs(undefined), 30);
});

test('parseOnArgs: ["30"] = 30', () => {
  assertEqual(parseOnArgs(['30']), 30);
});

test('parseOnArgs: 边界值 5 = 5', () => {
  assertEqual(parseOnArgs(['5']), MIN_MINUTES);
});

test('parseOnArgs: 边界值 1440 = 1440', () => {
  assertEqual(parseOnArgs(['1440']), MAX_MINUTES);
});

test('parseOnArgs: 4 抛错（小于下限）', () => {
  assertThrows(() => parseOnArgs(['4']), /5-1440|范围/, '<5 抛错');
});

test('parseOnArgs: 1441 抛错（大于上限）', () => {
  assertThrows(() => parseOnArgs(['1441']), /5-1440|范围/, '>1440 抛错');
});

test('parseOnArgs: "abc" 抛错（非数字）', () => {
  assertThrows(() => parseOnArgs(['abc']), /整数|非法/, '非数字抛错');
});

test('parseOnArgs: "3.5" 抛错（小数）', () => {
  assertThrows(() => parseOnArgs(['3.5']), /整数|非法/, '小数抛错');
});

test('parseOnArgs: DEFAULT_MINUTES 导出 = 30', () => {
  assertEqual(DEFAULT_MINUTES, 30);
});

// ──────────────────────────── buildCronExpr ────────────────────────────

test('buildCronExpr: 30 → "7,37 * * * *"（避 :00/:30）', () => {
  assertEqual(buildCronExpr(30), '7,37 * * * *');
});

test('buildCronExpr: 60 → "7 * * * *"（每小时偏移 7 分）', () => {
  assertEqual(buildCronExpr(60), '7 * * * *');
});

test('buildCronExpr: 15 → "7,22,37,52 * * * *"（每小时 4 次）', () => {
  assertEqual(buildCronExpr(15), '7,22,37,52 * * * *');
});

test('buildCronExpr: 120 → "7 */2 * * *"（每 2 小时）', () => {
  assertEqual(buildCronExpr(120), '7 */2 * * *');
});

test('buildCronExpr: 1440 → "7 0 * * *"（每天）', () => {
  assertEqual(buildCronExpr(1440), '7 0 * * *');
});

test('buildCronExpr: 0 抛错', () => {
  assertThrows(() => buildCronExpr(0), /非法|\[5/, '0 抛错');
});

test('buildCronExpr: 1441 抛错', () => {
  assertThrows(() => buildCronExpr(1441), /非法|\[5/, '1441 抛错');
});

test('buildCronExpr: 7 → 至少 8 次/小时（不撞 :00/:30）', () => {
  const expr = buildCronExpr(7);
  assertTrue(expr.includes('* * * *'), '含 * * * *');
  // 偏移起始 = 7
  assertTrue(expr.startsWith('7,'), '起始偏移 7');
});

test('buildCronExpr: 偏移永不撞 :00', () => {
  for (const m of [5, 10, 12, 15, 20, 30, 60]) {
    const expr = buildCronExpr(m);
    assertTrue(!expr.startsWith('0'), `${m}min 表达式不以 0 开头（撞 :00）`);
  }
});

test('buildCronExpr: 偏移永不撞 :30', () => {
  for (const m of [5, 10, 12, 15, 20, 30, 60]) {
    const expr = buildCronExpr(m);
    assertTrue(!expr.includes(',30,'), `${m}min 表达式不含 ',30,'（撞 :30）`);
    assertTrue(!expr.endsWith('30 * * * *'), `${m}min 表达式不以 ',30 * * * *' 结尾（撞 :30）`);
  }
});

// ──────────────────────────── buildPrompt ────────────────────────────

test('buildPrompt: 含 cd 目标 cwd', () => {
  const p = buildPrompt('/path/to/proj', '/path/to/plugin');
  assertTrue(p.includes('cd /path/to/proj'), '含 cd 目标');
});

test('buildPrompt: 含 check-facade.js 路径', () => {
  const p = buildPrompt('/proj', '/plugin');
  assertTrue(p.includes('/plugin/scripts/doc-sentinel/check-facade.js'), '含 check-facade 路径');
});

test('buildPrompt: 含"不 git push"约束', () => {
  const p = buildPrompt('/proj', '/plugin');
  assertTrue(p.includes('不 git push') || p.includes('❌ 不 git push'), '含不 push');
});

test('buildPrompt: 含"禁止改 spec/spec.feature"', () => {
  const p = buildPrompt('/proj', '/plugin');
  assertTrue(p.includes('spec/spec.feature'), '含 spec/spec.feature');
  assertTrue(p.includes('禁止'), '含禁止段');
});

test('buildPrompt: 含 SKILL.md 决策树引用', () => {
  const p = buildPrompt('/proj', '/plugin');
  assertTrue(p.includes('SKILL.md'), '含 SKILL.md 引用');
});

test('buildPrompt: 含 runs/<ISO>.json 路径', () => {
  const p = buildPrompt('/proj', '/plugin');
  assertTrue(p.includes('docs/doc-sentinel/runs/'), '含 runs/ 路径');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);