/**
 * tc-id-extractor.js
 * TC 编号提取公共函数，统一提取逻辑
 * 
 * 用法：
 *   const { extractTcIds, TC_ID_PATTERN } = require("./lib/tc-id-extractor");
 */

"use strict";

// TC 编号正则（统一格式，\b 词边界匹配）
const TC_ID_PATTERN = /\b((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)\b/;

// 从文本中提取所有 TC 编号
function extractTcIds(content, options = {}) {
  const { unique = true, includePosition = false } = options;
  const ids = [];
  const pattern = new RegExp(TC_ID_PATTERN.source, "gm");
  let m;
  
  while ((m = pattern.exec(content)) !== null) {
    const id = m[1];
    if (includePosition) {
      ids.push({ id, index: m.index });
    } else {
      ids.push(id);
    }
  }
  
  return unique ? [...new Set(ids)] : ids;
}

// 从案例文档标题行提取 TC 编号
function extractTcIdsFromCaseFile(content) {
  const ids = new Set();
  
  // 模式 1: ### FE-XXX-001: 描述
  const titlePattern = /^###\s+((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)\s*[:：]/gm;
  let m;
  while ((m = titlePattern.exec(content)) !== null) {
    ids.add(m[1]);
  }
  
  // 模式 2: 表格行 | FE-XXX-001 | ...
  const tablePattern = /\|\s*((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)\s*\|/g;
  while ((m = tablePattern.exec(content)) !== null) {
    ids.add(m[1]);
  }
  
  return [...ids];
}

// 从测试脚本提取 TC 编号（包括 test.skip / it.skip）
function extractTcIdsFromScript(content) {
  const ids = new Set();
  const skippedIds = new Set();
  
  // 匹配 test()/it() 和 test.skip()/it.skip()
  const pattern = /(?:test|it)(?:\.skip)?\s*\(\s*['"`]((?:FE|API|FLOW)-[A-Z]+-\d{3}[^'"`]*)/g;
  let m;
  
  while ((m = pattern.exec(content)) !== null) {
    const tcIdMatch = m[1].match(TC_ID_PATTERN);
    if (tcIdMatch) {
      const id = tcIdMatch[1];
      ids.add(id);
      if (m[0].includes(".skip")) {
        skippedIds.add(id);
      }
    }
  }
  
  return { ids: [...ids], skippedIds: [...skippedIds] };
}

// 从测试标题中提取单个 TC 编号（用于 Playwright spec.title 等场景）
function extractTcIdFromTitle(title) {
  const m = title.match(TC_ID_PATTERN);
  return m ? m[1] : null;
}

// 按前缀提取 TC 编号（用于 verify-case-coverage 等需要按类型过滤的场景）
function extractTcIdsByPrefix(content, prefix) {
  const pattern = new RegExp(
    `\\b(${prefix}-[A-Z]+-\\d{3}(?:-\\d{2})?(?:-[EB]\\d{2})?)\\b`, "g"
  );
  const ids = new Set();
  let m;
  while ((m = pattern.exec(content)) !== null) ids.add(m[1]);
  return [...ids];
}

// 检查是否为有效的 TC 编号
function isValidTcId(id) {
  return TC_ID_PATTERN.test(id);
}

module.exports = {
  TC_ID_PATTERN,
  extractTcIds,
  extractTcIdsFromCaseFile,
  extractTcIdsFromScript,
  extractTcIdFromTitle,
  extractTcIdsByPrefix,
  isValidTcId,
};
