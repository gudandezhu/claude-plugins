#!/usr/bin/env node
/**
 * subagents.js
 * 列出会话子 agent 的 meta 信息。
 * Port from forensic/subagents.go。
 *
 * 用法：
 *   node subagents.js <session-dir-path>
 */
"use strict";

const fs = require("fs");
const path = require("path");

function main() {
  const argv = process.argv.slice(2);
  const sessionDir = argv.find((a) => !a.startsWith("--"));

  if (!sessionDir) {
    console.error("用法: node subagents.js <session-dir-path>");
    process.exit(1);
  }

  const subDir = path.join(sessionDir, "subagents");

  if (!fs.existsSync(subDir)) {
    console.error(`[ERROR] 无 subagents 目录: ${subDir}`);
    process.exit(1);
  }

  const agents = [];

  for (const entry of fs.readdirSync(subDir)) {
    if (!entry.endsWith(".meta.json")) continue;
    const metaPath = path.join(subDir, entry);
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    } catch {
      // Skip malformed meta
    }

    const base = entry.replace(/\.meta\.json$/, "");
    const transcriptPath = path.join(subDir, `${base}.jsonl`);

    agents.push({
      agentId: base.replace(/^agent-/, ""),
      agentType: meta.agentType || "",
      transcript: transcriptPath,
    });
  }

  console.log(JSON.stringify(agents, null, 2));
}

main();
