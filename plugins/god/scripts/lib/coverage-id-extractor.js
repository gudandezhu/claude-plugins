/**
 * coverage-id-extractor.js
 * 从案例文档中提取 覆盖AC 标注的 AC/UI ID 列表（共享函数）
 *
 * 正则逻辑与 verify-case-coverage.js 的 coverPatterns 保持一致。
 *
 * 用法（路径因调用方位置而异）：
 *   const { extractCoverageIds } = require("../../../scripts/lib/coverage-id-extractor");
 *   // 或从 plugins/zcode/scripts/ 下：
 *   const { extractCoverageIds } = require("./lib/coverage-id-extractor");
 *   const ids = extractCoverageIds(fileContent);
 */
"use strict";

// 覆盖AC 标注正则（与 verify-case-coverage.js 一致）
const COVER_PATTERNS = [
  /\*{0,2}覆盖\s*AC\*{0,2}\s*[:：]\s*([\w\-.\s,，;；（()）]+)/gi,
  /\|\s*\*{0,2}覆盖\s*AC\*{0,2}\s*\|\s*([\w\-.\s,，;；（()）]+?)\s*\|/gi,
];

/**
 * 从文本中提取所有 覆盖AC 标注的 ID
 * @param {string} content - 案例文档全文
 * @returns {string[]} 去重排序后的 AC/UI ID 数组
 */
function extractCoverageIds(content) {
  if (!content) return [];

  const ids = new Set();

  for (const pattern of COVER_PATTERNS) {
    const re = new RegExp(pattern.source, "gi");
    let cm;
    while ((cm = re.exec(content)) !== null) {
      cm[1].split(/[,，;；\s]+/).forEach(id => {
        const cleaned = id.trim().replace(/[（(].*$/, "");
        if (cleaned) ids.add(cleaned);
      });
    }
  }

  return [...ids].sort();
}

module.exports = { extractCoverageIds, COVER_PATTERNS };
