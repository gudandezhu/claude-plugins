#!/usr/bin/env node
/**
 * search.js
 * 搜索 ~/.claude/history.jsonl，按 project/keyword/skill/session 过滤。
 * Port from forensic/search.go。
 *
 * 用法：
 *   node search.js [--project-dir <path>] [--keyword <kw>] [--session <id>] [--skill <name>] [--last <N>]
 */
"use strict";

const fs = require("fs");
const {
  getHistoryJsonlPath,
  truncate,
  parseArgs,
  readJsonlSync,
} = require("./lib");

// ── CLI ──────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  const projectDir = args.projectDir || args._positional?.[0] || "";
  const keyword = args.keyword || "";
  const session = args.session || "";
  const skill = args.skill || "";
  const last = parseInt(args.last || "20", 10);

  const histPath = getHistoryJsonlPath();
  if (!fs.existsSync(histPath)) {
    console.error(`[ERROR] history.jsonl 不存在: ${histPath}`);
    process.exit(1);
  }

  const sessions = {};

  readJsonlSync(histPath, (entry) => {
    if (!entry.sessionId) return;

    // Filter by project path
    if (projectDir && !entry.project.includes(projectDir)) return;

    // Filter by session ID prefix
    if (session && !entry.sessionId.startsWith(session)) return;

    // Filter by keyword
    if (keyword && !entry.display.toLowerCase().includes(keyword.toLowerCase())) return;

    // Filter by skill name
    if (skill) {
      const lower = entry.display.toLowerCase();
      if (!lower.includes("/" + skill.toLowerCase()) && !lower.includes("forge:" + skill.toLowerCase())) {
        return;
      }
    }

    let ss = sessions[entry.sessionId];
    if (!ss) {
      ss = {
        sessionId: entry.sessionId,
        project: entry.project,
        dateTime: "",
        msgCount: 0,
        firstMsg: "",
      };
      sessions[entry.sessionId] = ss;
    }

    ss.msgCount++;

    if (entry.timestamp > 0) {
      const d = new Date(entry.timestamp);
      const pad = (n) => String(n).padStart(2, "0");
      const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      if (!ss.dateTime || ts > ss.dateTime) {
        ss.dateTime = ts;
      }
    }

    if (!ss.firstMsg) {
      ss.firstMsg = truncate(entry.display, 80);
    }
  });

  // Sort by dateTime descending, take top N
  const sorted = Object.values(sessions)
    .sort((a, b) => (b.dateTime || "").localeCompare(a.dateTime || ""))
    .slice(0, last);

  console.log(JSON.stringify(sorted, null, 2));
}

module.exports = { main };

if (require.main === module) {
  main();
}
