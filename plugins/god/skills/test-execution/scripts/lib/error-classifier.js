#!/usr/bin/env node
"use strict";
/**
 * error-classifier.js
 * 共享错误分类模块，供 classify-error.js 和 parse-results.js 使用。
 * 根据 errorType 决定 LLM 应该采取的行动（suggestedAction）。
 */

const SUGGESTED_ACTIONS = {
  selector_not_found: "fix-selector",
  selector_ambiguous: "fix-selector",
  element_blocked: "fix-selector",
  api_path_error: "fix-api-path",
  assertion_failed: "report-defect",
  network_error: "check-environment",
  browser_crash: "retry",
  unknown: "diagnose-with-browser",
};

function getSuggestedAction(errorType) {
  return SUGGESTED_ACTIONS[errorType] || "diagnose-with-browser";
}

function classifyPlaywrightError(message) {
  if (!message) return "unknown";
  if (/browser has been closed|Target page|context or browser has been closed|crashed/i.test(message))
    return "browser_crash";
  if (/cannot navigate to invalid url|invalid url|ERR_INVALID_URL/i.test(message))
    return "network_error";
  // selector_ambiguous 必须在 selector_not_found 之前检查，
  // 因为 strict mode violation 的消息中也包含 "locator...resolved"
  if (/strict mode violation/i.test(message)) return "selector_ambiguous";
  if (/timeout.*selector|waiting for selector|locator.*resolved/i.test(message))
    return "selector_not_found";
  if (/not visible|intercepted|element is not visible|click intercepted|obscured by/i.test(message))
    return "element_blocked";
  if (/expect.*received|tobe|tohave|tocontain|toequal/i.test(message))
    return "assertion_failed";
  if (/net::err_|econnrefused|econnreset|etimedout|fetch failed/i.test(message))
    return "network_error";
  return "unknown";
}

function classifyVitestError(message) {
  if (!message) return "unknown";
  if (/econnrefused|econnreset|etimedout|fetch failed|network/i.test(message))
    return "network_error";
  if (/not valid json|unexpected token/i.test(message)) return "network_error";

  const hasPathKeywords = /\.data\.|\.list\b|\.records\b|\.totalRows\b|\.total\b|\.bizKey\b|\.pageNum\b|\.pageSize\b|\.rows\b|\.items\b|\.content\b|\.result\b/i.test(message);
  const hasTypeError = /cannot read propert|is undefined|is not a function|typeerror/i.test(message);
  const hasAssertionKeywords = /expect.*received|tobe|tohave|tocontain|toequal/i.test(message);

  if (hasTypeError && hasPathKeywords) return "api_path_error";
  if (hasTypeError && /of null|of undefined/i.test(message)) return "api_path_error";
  if (hasAssertionKeywords && hasPathKeywords) return "api_path_error";
  if (/array\.isarray|is not an array|expected.*array|expected.*object/i.test(message)) return "api_path_error";
  if (hasAssertionKeywords) return "assertion_failed";
  if (/status code 404|request failed with status code 404|404 not found/i.test(message)) return "api_path_error";
  return "unknown";
}

module.exports = {
  SUGGESTED_ACTIONS,
  getSuggestedAction,
  classifyPlaywrightError,
  classifyVitestError,
};
