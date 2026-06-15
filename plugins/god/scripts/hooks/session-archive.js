#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const jlcWorkspace = process.env.JLC_AI_WORKSPACE || "";
const sessionId = process.env.CLAUDE_CODE_SESSION_ID || "";

// Guard: only activate when working inside JLC workspace
if (!jlcWorkspace) process.exit(0);
const cwd = process.cwd().replace(/\\/g, "/");
const ws = jlcWorkspace.replace(/\\/g, "/");
if (cwd !== ws && !cwd.startsWith(ws + "/")) process.exit(0);
if (!sessionId) process.exit(0);

// Encode cwd to match Claude Code's project directory naming
function encodeCwd(p) {
  p = p.replace(/\\/g, "/");
  const m = p.match(/^\/([a-zA-Z])\/(.*)/);
  if (m) return m[1].toUpperCase() + "--" + m[2].replace(/\//g, "-");
  const m2 = p.match(/^([a-zA-Z]):[\/\\](.*)/);
  if (m2) return m2[1].toUpperCase() + "--" + m2[2].replace(/[\/\\]/g, "-");
  return p.replace(/\//g, "-");
}

const projectDir = encodeCwd(cwd);
const sessionFile = path.join(os.homedir(), ".claude/projects", projectDir, `${sessionId}.jsonl`);

if (!fs.existsSync(sessionFile)) process.exit(0);

// Unconditional archive (no threshold)
const archiveDir = path.join(os.homedir(), ".zcode/sessions");
fs.mkdirSync(archiveDir, { recursive: true });
fs.copyFileSync(sessionFile, path.join(archiveDir, `${sessionId}.jsonl`));
