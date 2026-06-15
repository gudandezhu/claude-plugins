#!/usr/bin/env node
/**
 * lib.js
 * Forensic 脚本共享工具库。
 * Port from forensic/helpers.go + forensic/types.go。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ── Types (port from types.go) ────────────────────────

// 返回空的 extractResult 结构
function createExtractResult(jsonlPath) {
  return {
    file: jsonlPath,
    lines: 0,
    model: "",
    gitBranch: "",
    thinking: [],
    toolCalls: [],
    toolResults: [],
    userMsgs: [],
    skillsUsed: [],
    hooks: [],
    filesEdited: [],
    summary: {
      totalThinking: 0,
      totalToolCalls: 0,
      totalToolResults: 0,
      totalUserMsgs: 0,
      llmTurns: 0,
      toolBreakdown: {},
      filesRead: [],
      filesWritten: [],
      grepPatterns: [],
      agentsSpawned: [],
      commands: [],
      hookBreakdown: [],
      hookFailures: 0,
      compactCount: 0,
      planModeCount: 0,
      stopReasons: {},
      skillInvocations: [],
      subagentCount: 0,
      startTime: "",
      endTime: "",
      duration: "",
      topSlowest: [],
      timingByTool: [],
      totalToolMs: 0,
      thinkingTurns: [],
      totalThinkingMs: 0,
      tokens: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheCreation: 0,
        cacheHitRate: null,
      },
      wallSeconds: null,
      toolToThinkingRatio: null,
    },
  };
}

// ── Helpers (port from helpers.go) ────────────────────

function parseTimestamp(s) {
  return new Date(s).getTime();
}

function computeDurationMs(startTS, endTS) {
  const t1 = parseTimestamp(startTS);
  const t2 = parseTimestamp(endTS);
  if (isNaN(t1) || isNaN(t2)) return -1;
  return t2 - t1;
}

function truncate(s, max) {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max) + "...";
}

function isAlphaNumeric(c) {
  return (c >= "a" && c <= "z") || (c >= "0" && c <= "9");
}

/**
 * Extract user text content from a JSONL entry.
 * Port from helpers.go extractUserContent.
 */
function extractUserContent(entry) {
  const msg = entry.message;
  if (!msg || msg.role !== "user") return "";

  // Try content blocks first
  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "text" && block.text) return block.text;
    }
  }
  // Try raw string content
  if (typeof msg.content === "string" && msg.content) return msg.content;
  // Fallback to entry-level content
  if (entry.content) return entry.content;
  return "";
}

/**
 * Detect skill invocations from user message content.
 * Port from helpers.go detectSkills.
 */
function detectSkills(content, skillsUsed) {
  if (!content || typeof content !== "string") return;
  const lower = content.toLowerCase();
  const prefixes = ["/forge:", "<command-name>/", "<command-name>"];

  for (const prefix of prefixes) {
    let searchFrom = 0;
    while (searchFrom < lower.length) {
      const idx = lower.indexOf(prefix, searchFrom);
      if (idx === -1) break;
      const start = idx + prefix.length;
      let end = start;
      while (end < lower.length && (isAlphaNumeric(lower[end]) || lower[end] === "-" || lower[end] === "_")) {
        end++;
      }
      if (end > start) {
        const name = lower.slice(start, end);
        if (!skillsUsed.includes(name)) {
          skillsUsed.push(name);
        }
      }
      searchFrom = end;
    }
  }
}

/**
 * Copy file best-effort. Port from helpers.go copyFile.
 */
function copyFile(src, dst) {
  try {
    fs.copyFileSync(src, dst);
  } catch {
    // Best-effort; don't fail the extract
  }
}

/**
 * Aggregate tool-specific details into summary.
 * Port from helpers.go aggregateToolInput.
 */
function aggregateToolInput(tool, input, summary) {
  if (!input || typeof input !== "object") return;

  switch (tool) {
    case "Read":
      if (input.file_path) appendUniq(summary.filesRead, input.file_path);
      break;
    case "Edit":
    case "Write":
      if (input.file_path) appendUniq(summary.filesWritten, input.file_path);
      break;
    case "Grep":
      if (input.pattern) appendUniq(summary.grepPatterns, input.pattern);
      break;
    case "Bash":
      if (input.command) appendUniq(summary.commands, truncate(input.command, 200));
      break;
    case "Agent": {
      const name = input.subagent_type || "unknown";
      const existing = summary.agentsSpawned.find((a) => a.name === name);
      if (existing) {
        existing.count++;
      } else {
        summary.agentsSpawned.push({ name, count: 1 });
      }
      break;
    }
  }
}

function appendUniq(arr, val) {
  if (!arr.includes(val)) arr.push(val);
  return arr;
}

function addToAgg(entries, name) {
  const existing = entries.find((e) => e.name === name);
  if (existing) {
    existing.count++;
  } else {
    entries.push({ name, count: 1 });
  }
}

// ── Duration formatting ───────────────────────────────

function formatDurationMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSec(s) {
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  return `${s.toFixed(1)}s`;
}

function formatDuration(ms) {
  const sec = ms / 1000;
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)}min`;
  return `${(sec / 3600).toFixed(1)}h`;
}

// ── JSONL line reader (streaming) ─────────────────────

/**
 * Read JSONL file line by line, calling handler for each parsed entry.
 * @param {string} jsonlPath - Path to JSONL file
 * @param {(entry: object, lineNum: number) => void} handler - Called per line
 * @returns {Promise<number>} Total line count
 */
async function readJsonl(jsonlPath, handler) {
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      handler(entry, lineNum);
    } catch {
      // Skip malformed lines
    }
  }
  return lineNum;
}

/**
 * Synchronous JSONL reader for smaller files.
 * @param {string} jsonlPath - Path to JSONL file
 * @param {(entry: object, lineNum: number) => void} handler - Called per line
 * @returns {number} Total line count
 */
function readJsonlSync(jsonlPath, handler) {
  const content = fs.readFileSync(jsonlPath, "utf-8");
  const lines = content.split("\n");
  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    if (!line.trim()) continue;
    try {
      handler(JSON.parse(line), lineNum);
    } catch {
      // Skip malformed lines
    }
  }
  return lineNum;
}

// ── CLI arg parser ────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && argv[i + 1]) {
      const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[++i];
    }
  }
  // Positional args (non --prefixed)
  args._positional = argv.filter((a) => !a.startsWith("--"));
  return args;
}

// ── Session JSONL finder ──────────────────────────────

function findSessionJsonl(sessionId, projectDir) {
  const home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
  const projectsDir = path.join(home, ".claude", "projects");
  if (!fs.existsSync(projectsDir)) return null;

  // If projectDir given, derive encoded name
  if (projectDir) {
    const normalized = projectDir.replace(/\\/g, "/").replace(/\/$/, "");
    const drive = normalized.match(/^([A-Za-z]):\//);
    let encodedDir;
    if (drive) {
      encodedDir = drive[1].toUpperCase() + "--" + normalized.slice(3).replace(/\//g, "-");
    } else {
      encodedDir = normalized.replace(/\//g, "-");
    }
    const direct = path.join(projectsDir, encodedDir, `${sessionId}.jsonl`);
    if (fs.existsSync(direct)) return direct;
  }

  // Fallback: scan all project dirs
  for (const dir of fs.readdirSync(projectsDir)) {
    const candidate = path.join(projectsDir, dir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function getHistoryJsonlPath() {
  const home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
  return path.join(home, ".claude", "history.jsonl");
}

module.exports = {
  createExtractResult,
  parseTimestamp,
  computeDurationMs,
  truncate,
  extractUserContent,
  detectSkills,
  copyFile,
  aggregateToolInput,
  appendUniq,
  addToAgg,
  formatDurationMs,
  formatSec,
  formatDuration,
  readJsonl,
  readJsonlSync,
  parseArgs,
  findSessionJsonl,
  getHistoryJsonlPath,
};
