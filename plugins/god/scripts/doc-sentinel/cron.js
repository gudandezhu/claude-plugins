#!/usr/bin/env node
/**
 * cron.js — doc-sentinel 调度器（CC CronCreate durable）
 *
 * v0.7.2 起：把 on/off 的"调度相关"逻辑封装成纯函数，
 * 让 command（CC agent 上下文）只负责调 CronCreate / CronDelete / CronList。
 *
 * 设计边界：
 *   - cron.js 不调 CC 工具（无 MCP 接入，是 Node 脚本）
 *   - cron.js 只产出 (cronExpr, prompt) 二元组，agent 拿去做 CronCreate
 *
 * 暴露能力（纯函数，可单测）：
 *   - parseOnArgs(argv)        on N min 参数解析 + 区间 [5, 1440] 校验
 *   - buildCronExpr(minutes)   分钟数 → cron 表达式（避 :00/:30 高峰）
 *   - buildPrompt(cwd, pluginRoot)  注入到 cron 任务的 prompt 模板
 *   - parseOffArgs(argv)       off 子命令参数解析（占位）
 *   - parseStatusArgs(argv)    status 子命令参数解析（占位）
 *
 * CLI 模式（agent dry-run 用）：
 *   node cron.js on 30          输出 cron 表达式 + prompt（JSON）
 *   node cron.js on             默认 30 min
 *   node cron.js --help
 *
 * 设计依据：docs/adrs/0012-doc-sentinel.md v0.7.2 段
 * 零外部依赖。
 */

'use strict';

// ──────────────────────────── 参数解析 ────────────────────────────

const DEFAULT_MINUTES = 30;
const MIN_MINUTES = 5;
const MAX_MINUTES = 1440; // 24h
const OFFSET_MIN = 7; // 避 :00/:30 高峰

/**
 * 解析 on 子命令参数
 * @param {string[]} argv e.g. ['30']
 * @returns {number} 校验后的分钟数
 * @throws {Error} 参数非法
 */
function parseOnArgs(argv) {
  const raw = (argv || []).filter(a => !a.startsWith('--'))[0];
  let minutes;
  if (raw === undefined) {
    minutes = DEFAULT_MINUTES;
  } else {
    minutes = Number(raw);
    if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
      throw new Error(`频率必须为整数分钟数，得到: ${raw}`);
    }
  }
  if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    throw new Error(
      `频率必须在 ${MIN_MINUTES}-${MAX_MINUTES} 分钟之间（${MIN_MINUTES}min ~ 24h），得到: ${minutes}`
    );
  }
  return minutes;
}

function parseOffArgs() { return {}; }
function parseStatusArgs() { return {}; }

// ──────────────────────────── cron 表达式 ────────────────────────────

/**
 * 把分钟数转 cron 表达式，偏移 OFFSET_MIN 避 :00/:30 高峰。
 *
 * 策略：
 *   - minutes < 60：每小时 N 次，分钟序列 = OFFSET_MIN, OFFSET_MIN+step, ...
 *     step = 60 / minutes，序列从 OFFSET_MIN 开始，到 59 为止（不跨 60）。
 *   - minutes === 60：每小时一次，OFFSET_MIN 分
 *   - minutes > 60 且 60 % minutes !== 0：尝试找最大公约数
 *     g = gcd(minutes, 60)，每 g 分钟一次（小时字段控制）
 *   - minutes === 1440：每天 OFFSET_MIN 点
 *
 * @param {number} minutes [5, 1440]
 * @returns {string} 5 字段 cron 表达式
 */
function buildCronExpr(minutes) {
  if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    throw new Error(`分钟数非法: ${minutes}（需 [${MIN_MINUTES}, ${MAX_MINUTES}]）`);
  }

  // 每天一次
  if (minutes === 1440) {
    return `${OFFSET_MIN} 0 * * *`;
  }

  // 每小时一次
  if (minutes === 60) {
    return `${OFFSET_MIN} * * * *`;
  }

  // 小于 60：每小时 (60/N) 次（分钟序列）
  if (minutes < 60) {
    // step = N 本身（如 N=30 → 每 30 分一次；N=15 → 每 15 分一次）
    const step = minutes;
    const slotsPerHour = Math.floor((60 - OFFSET_MIN) / step) + 1;
    const minuteSlots = [];
    for (let m = OFFSET_MIN, i = 0; m < 60 && i < slotsPerHour; m += step, i++) {
      minuteSlots.push(m);
    }
    return `${minuteSlots.join(',')} * * * *`;
  }

  // 大于 60 且 60 整除 minutes：每 minutes 分钟一次（小时字段控制）
  if (60 % minutes === 0) {
    // minutes=120, 240, ...
    return `${OFFSET_MIN} */${minutes / 60} * * *`;
  }

  // 大于 60 且不整除：用 gcd 算出合适的小时频率
  const g = gcd(minutes, 60);
  const hourStep = minutes / 60; // 不是整数 → 需要 fallback
  if (Number.isInteger(hourStep)) {
    return `${OFFSET_MIN} */${hourStep} * * *`;
  }

  // 兜底：每小时一次（用 OFFSET_MIN 偏移让多任务错峰）
  // 例：minutes=90 → 每 90 分钟 ≈ 每 1.5 小时 → cron 不支持小数 → 退化为每小时一次
  return `${OFFSET_MIN} * * * *`;
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// ──────────────────────────── prompt 构造 ────────────────────────────

/**
 * 构造注入 cron 任务的 prompt。
 *
 * 硬规则（来自 SKILL.md §5）：
 *   - 不 git push
 *   - 禁改 spec/spec.feature / spec/sources.md（真相源保护）
 *   - 禁改 docs/adrs/*.md 编号（破坏外部引用）
 *   - 禁改 commands/*.md（commands 上限 3 强约束）
 *   - 禁改 spec/scripts/*.js（spec 子系统自身，需走 PR）
 *   - 不加 Co-Authored-By: Claude
 *   - 跑超 30 min 强制终止
 *
 * @param {string} cwd 当前工作目录（巡检根）
 * @param {string} pluginRoot god 插件根目录
 * @returns {string}
 */
function buildPrompt(cwd, pluginRoot) {
  return `你是 doc-sentinel。当前 session 调起你。

任务：巡检 ${cwd} 项目文档健康度，按决策树 auto-fix 后 git commit（不 push）。

执行步骤（机械顺序，不要跳）：
1. cd 到工作目录：cd ${cwd}
2. 跑统一入口：node ${pluginRoot}/scripts/doc-sentinel/check-facade.js .
3. 读返回的 JSON 报告
4. 按 ${pluginRoot}/skills/doc-sentinel/SKILL.md 决策树分类每个 finding
5. 对 auto-fix 类的 finding 直接改文件
6. 按检查项分类 git add + git commit（commit message 见 SKILL.md §commit 规范）
7. 写本次跑报告：${cwd}/docs/doc-sentinel/runs/<ISO 时间戳>.json（facade 自动写）
8. ❌ 不 git push
9. exit 0

禁止：
- 改 spec/spec.feature / spec/sources.md（真相源保护）
- 改 docs/adrs/*.md 的编号（破坏外部引用）
- 改 commands/*.md（commands 上限 3 强约束）
- 改 spec/scripts/*.js（spec 子系统自身，需走 PR）
- 自动 bump MAJOR 版本（必走 RFC）
- 加 Co-Authored-By: Claude（与人工 commit 区分）
- 跑超过 30 分钟（防止 agent 跑飞）

如决策树判定某 finding 需人工 RFC（如 N1 撞车 / MAJOR 版本漂移），写入 runs/<ISO>.json 的 findings 字段但不 auto-fix，给用户 1 行决策建议（"建议: off → 手工 RFC → on"）。`;
}

// ──────────────────────────── CLI ────────────────────────────

function printHelp() {
  console.log(`用法: node cron.js <子命令> [参数]

子命令:
  on [N]      解析 on 子命令参数，N=分钟数（默认 30，范围 5-1440）
  off         off 子命令（占位）
  status      status 子命令（占位）
  --help      打印此帮助

dry-run 模式（agent 验证用）：
  node cron.js on 30
  → 输出 JSON: { minutes, cronExpr, prompt }

设计：cron.js 只产 cron 表达式 + prompt，不调 CC 工具（分层边界）。
CC CronCreate / CronDelete 由 agent 在 commands/doc-sentinel.md 上下文调。`);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const sub = argv[0];
  if (sub === 'on') {
    try {
      const minutes = parseOnArgs(argv.slice(1));
      const cwd = process.env.DOC_SENTINEL_CWD || process.cwd();
      const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
      const cronExpr = buildCronExpr(minutes);
      const prompt = buildPrompt(cwd, pluginRoot);
      console.log(JSON.stringify({ minutes, cronExpr, prompt }, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
    }
  }
  if (sub === 'off') {
    console.log(JSON.stringify(parseOffArgs(argv.slice(1)), null, 2));
    process.exit(0);
  }
  if (sub === 'status') {
    console.log(JSON.stringify(parseStatusArgs(argv.slice(1)), null, 2));
    process.exit(0);
  }
  console.error(`✗ 未知子命令: ${sub}`);
  printHelp();
  process.exit(1);
}

module.exports = {
  parseOnArgs,
  parseOffArgs,
  parseStatusArgs,
  buildCronExpr,
  buildPrompt,
  // 常量导出供测试 / 上层使用
  DEFAULT_MINUTES,
  MIN_MINUTES,
  MAX_MINUTES,
  OFFSET_MIN,
};