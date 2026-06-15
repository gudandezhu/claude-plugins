/**
 * ac-assignment-loader.js
 * 共享模块：加载 ac-assignment.json，供 verify-case-coverage.js 和 gate-check.js 复用
 */
"use strict";

const fs = require("fs");
const { safeReadJson } = require("./safe-json");

function loadAcAssignment(acAssignmentPath) {
  if (!acAssignmentPath || !fs.existsSync(acAssignmentPath)) return null;
  const data = safeReadJson(acAssignmentPath, { fallback: null });
  if (data && data.version && data.assignment) return data;
  return null;
}

module.exports = { loadAcAssignment };
