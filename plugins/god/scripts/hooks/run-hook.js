#!/usr/bin/env node
"use strict";

const path = require("path");
const { execFileSync } = require("child_process");

const scriptName = process.argv[2];
if (!scriptName) {
  console.error("Usage: run-hook.js <script-name> [args...]");
  process.exit(1);
}

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..", "..");
const scriptPath = path.join(pluginRoot, "hooks", scriptName).replace(/\\/g, "/");

try {
  execFileSync("bash", [scriptPath], { stdio: "inherit", env: process.env });
} catch (e) {
  process.exit(e.status || 1);
}
