/**
 * safe-json.js
 * JSON 安全读取公共函数，统一错误处理
 *
 * 用法：
 *   const { safeReadJson } = require("./lib/safe-json");
 *   const data = safeReadJson("path/to/file.json");
 *   const data = safeReadJson("path/to/file.json", { fallback: {} });
 */

"use strict";

const fs = require("fs");

function stripBom(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

/**
 * 安全读取并解析 JSON 文件
 * @param {string} filePath - JSON 文件路径
 * @param {object} [options] - 选项
 * @param {*} [options.fallback] - 解析失败时的降级值（设置后不会 exit）
 * @param {boolean} [options.silent] - 为 true 时不输出错误信息
 * @returns {*} 解析后的 JSON 对象
 */
function safeReadJson(filePath, options = {}) {
  const { fallback, silent = false } = options;
  const hasFallback = "fallback" in options;

  if (!fs.existsSync(filePath)) {
    if (hasFallback) return fallback;
    if (!silent) console.error(`[FAIL] 文件不存在: ${filePath}`);
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    if (hasFallback) return fallback;
    if (!silent) console.error(`[FAIL] 文件读取失败: ${filePath} - ${err.message}`);
    process.exit(1);
  }

  raw = stripBom(raw);

  try {
    return JSON.parse(raw);
  } catch (err) {
    if (hasFallback) return fallback;
    if (!silent) console.error(`[FAIL] ${filePath} JSON 解析失败: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { safeReadJson, stripBom };
