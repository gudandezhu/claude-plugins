#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..", "..");
const jlcWorkspace = process.env.JLC_AI_WORKSPACE || "";

// Guard: only activate when working inside JLC workspace
if (!jlcWorkspace) process.exit(0);
const cwd = process.cwd().replace(/\\/g, "/");
const ws = jlcWorkspace.replace(/\\/g, "/");
if (cwd !== ws && !cwd.startsWith(ws + "/")) process.exit(0);

// Read skill content
const skillFile = path.join(pluginRoot, "skills/using-zcode/SKILL.md");
let skillContent = "";
if (fs.existsSync(skillFile)) {
  skillContent = fs.readFileSync(skillFile, "utf-8");
}

function escapeJson(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

const ctx = `**zcode 插件已加载。** 以下是 zcode 技能使用指南：\n\n${escapeJson(skillContent)}`;

if (process.env.CLAUDE_PLUGIN_ROOT) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: ctx
    }
  }));
} else {
  console.log(JSON.stringify({ additional_context: ctx }));
}
