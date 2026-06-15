#!/usr/bin/env node
"use strict";
/**
 * write-manifest.js — T3.6
 * 原子写入 workspace-manifest.json（先写 .tmp 再 rename）。
 * 防止 run-test 中途失败导致部分写入状态。
 *
 * 用法:
 *   node write-manifest.js --repo <testing-repo-path> --data '<JSON string>'
 *   node write-manifest.js --repo <testing-repo-path> --file <data.json>
 *
 * 原子写入策略：
 *   1. 写入 .workspace-manifest.json.tmp
 *   2. rename 替换正式文件（原子操作）
 *   3. 中途失败时正式文件保持上次完整状态
 *   4. 启动时检测 .tmp 文件存在则自动清理
 */
const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("../lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let repo = "", data = "", file = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo" && argv[i + 1]) repo = argv[++i];
    if (argv[i] === "--data" && argv[i + 1]) data = argv[++i];
    if (argv[i] === "--file" && argv[i + 1]) file = argv[++i];
  }
  if (!repo) { console.error("[FAIL] --repo is required"); process.exit(1); }
  if (!data && !file) { console.error("[FAIL] --data or --file is required"); process.exit(1); }
  return { repo, data, file };
}

function main() {
  const { repo, data, file } = parseArgs();

  const manifestPath = path.join(repo, "workspace-manifest.json");
  const tmpPath = manifestPath + ".tmp";

  // Cleanup stale .tmp file from previous failed run
  if (fs.existsSync(tmpPath)) {
    console.log("[WARN] Stale .tmp file detected, cleaning up");
    fs.unlinkSync(tmpPath);
  }

  // Parse manifest data
  let manifestData;
  if (file) {
    manifestData = safeReadJson(file);
  } else {
    try {
      manifestData = JSON.parse(data);
    } catch (e) {
      console.error(`[FAIL] --data JSON 解析失败: ${e.message}`);
      process.exit(1);
    }
  }

  // Add baseCommitHash if not present
  if (!manifestData.baseCommitHash) {
    try {
      const { execSync } = require("child_process");
      manifestData.baseCommitHash = execSync("git rev-parse HEAD", {
        cwd: repo, encoding: "utf-8"
      }).trim();
    } catch (e) {
      manifestData.baseCommitHash = "unknown";
    }
  }

  // Atomic write: tmp → rename
  const content = JSON.stringify(manifestData, null, 2);
  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, manifestPath);

  console.log(`[OK] workspace-manifest.json written atomically (${content.length} bytes)`);
}

main();
