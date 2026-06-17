'use strict';
/**
 * help.js — 共享 --help 工具（v0.5.2 P0）
 *
 * 用法:
 *   const { printHelp } = require('./_lib/help');
 *   if (process.argv.includes('--help') || process.argv.includes('-h')) {
 *     printHelp(__filename);
 *     process.exit(0);
 *   }
 *
 * 设计:
 *   - 自动读 caller 文件顶部 JSDoc 注释块(/** ... *\/)
 *   - 解析"用法:"开头的段作为主说明
 *   - 解析"设计依据: ... 零外部依赖"等尾段作为附注
 *   - caller 缺头部 JSDoc 用法时,fallback 到 callSiteName 兜底
 *
 * 零外部依赖。
 */

const fs = require('fs');
const path = require('path');

/**
 * 从 caller 源文件提取 /** ... *\/ 注释块
 * @param {string} filePath 绝对路径
 * @returns {string} 注释全文(去 /* 和 *\/ 包裹)
 */
function extractJsdoc(filePath) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
  // 匹配 /*\* ... *\/ 块(开头两个 *)
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return '';
  return m[1]
    .split('\n')
    // 去掉行首的 * 缩进(常见格式: " * xxx")
    .map(line => line.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim();
}

/**
 * 从 JSDoc 文本提取"用法:"段(到下一个空行/段头之间)
 */
function extractUsageSection(jsdoc) {
  if (!jsdoc) return '';
  const lines = jsdoc.split('\n');
  const startIdx = lines.findIndex(l => /^\s*用法[:：]/.test(l));
  if (startIdx < 0) return '';
  const buf = [];
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    // 段头识别: "设计依据:" / "行为:" / "监控维度:" / "约束:" / "错误示例:" / "救命场景:" / "覆盖范围:" / "工具:" / "OPC 注意力预算" 等
    if (i > startIdx && /^\s*(设计依据|行为|监控维度|约束|错误示例|救命场景|覆盖范围|工具|OPC|5\s*维)/.test(l)) break;
    buf.push(l);
  }
  return buf.join('\n').trim();
}

/**
 * 打印帮助
 * @param {string} callerFile caller 源文件绝对路径(用 __filename 传)
 * @param {object} [opts]
 * @param {string} [opts.scriptName] 脚本名(默认从 callerFile basename 推)
 * @param {string[]} [opts.notes] 追加的兜底说明行(用法段解析失败时用)
 */
function printHelp(callerFile, opts = {}) {
  const scriptName = opts.scriptName || path.basename(callerFile);
  const jsdoc = extractJsdoc(callerFile);
  const usage = extractUsageSection(jsdoc);

  console.log(`用法: node ${scriptName} --help|-h`);
  console.log(`      (本说明来自 ${scriptName} 源文件顶部 JSDoc,代码与文档同源)`);
  console.log(``);

  if (usage) {
    console.log(usage);
  } else {
    console.log(`(本脚本未在源文件顶部声明"用法:"段,详情见 JSDoc 头部)`);
    if (opts.notes && opts.notes.length) {
      console.log(``);
      for (const n of opts.notes) console.log(n);
    }
  }

  console.log(``);
  console.log(`全局选项:`);
  console.log(`  --help, -h   打印本说明并 exit 0`);
  console.log(`  --json       部分脚本支持(以脚本内说明为准)`);
}

/**
 * 在 main() 入口插入一行即可启用 --help
 * 用法:
 *   const { handleHelp } = require('./_lib/help');
 *   function main() {
 *     if (handleHelp(__filename)) return;
 *     // ... 正常逻辑
 *   }
 *
 * v0.5.2 P0 修复：只看自己命令后的 argv（slice(2)），不检查父进程 argv
 * 原因：当父进程（test 文件）带 --help 启动并 require 本模块时，整个进程的 process.argv 都含 --help，
 *      原代码用 process.argv.includes('--help') 会误命中并 process.exit(0) 杀子进程
 * 修复：用 slice(2) 只看脚本自己收到的参数；子进程 require 触发时这条路径根本不会走
 *      （main() 仅在 require.main === module 时跑，require 时只导出符号表）
 */
function handleHelp(callerFile, opts) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp(callerFile, opts);
    process.exit(0);
  }
}

module.exports = { printHelp, handleHelp, extractJsdoc, extractUsageSection };
