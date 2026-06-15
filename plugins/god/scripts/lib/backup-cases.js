#!/usr/bin/env node
/**
 * backup-cases.js
 * 案例文件备份/恢复工具
 *
 * 用法：
 *   备份: node backup-cases.js --testing-dir <dir> --action backup [--type <e2e|api|flow>]
 *   恢复: node backup-cases.js --testing-dir <dir> --action restore [--type <e2e|api|flow>]
 *
 * 不指定 --type 时处理所有案例文件。
 * exit 0 = 成功, exit 1 = 失败
 */
"use strict";

const fs = require("fs");
const path = require("path");

const TYPE_TO_FILE = {
  e2e: "test-cases/e2e-test-cases.md",
  api: "test-cases/api-test-cases.md",
  flow: "test-cases/api-flow-test-cases.md",
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { testingDir: null, action: null, type: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) args.testingDir = argv[++i];
    else if (argv[i] === "--action" && argv[i + 1]) args.action = argv[++i];
    else if (argv[i] === "--type" && argv[i + 1]) args.type = argv[++i];
  }
  return args;
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function getTypes(type) {
  if (type) {
    if (!TYPE_TO_FILE[type]) fail(`无效的 --type: ${type}`);
    return [type];
  }
  return Object.keys(TYPE_TO_FILE);
}

function backup(testingDir, type) {
  const srcRel = TYPE_TO_FILE[type];
  const srcPath = path.join(testingDir, srcRel);

  if (!fs.existsSync(srcPath)) {
    console.log(`[SKIP] ${type}: 源文件不存在 (${srcPath})`);
    return;
  }

  const backupDir = path.join(testingDir, ".cache", "backup");
  fs.mkdirSync(backupDir, { recursive: true });

  const filename = path.basename(srcPath);
  const backupPath = path.join(backupDir, `${filename}.pre-fix.bak`);

  // 保留历史备份
  if (fs.existsSync(backupPath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const historyPath = path.join(backupDir, `${filename}.pre-fix.${ts}.bak`);
    fs.copyFileSync(backupPath, historyPath);
    console.log(`[INFO] ${type}: 历史备份已保存 (${path.basename(historyPath)})`);
  }

  fs.copyFileSync(srcPath, backupPath);
  const size = fs.statSync(backupPath).size;
  console.log(`[OK] backup ${type}: ${filename} -> ${path.basename(backupPath)} (${size} bytes)`);
}

function restore(testingDir, type) {
  const srcRel = TYPE_TO_FILE[type];
  const filename = path.basename(srcRel);
  const backupDir = path.join(testingDir, ".cache", "backup");
  const backupPath = path.join(backupDir, `${filename}.pre-fix.bak`);
  const destPath = path.join(testingDir, srcRel);

  if (!fs.existsSync(backupPath)) {
    fail(`${type}: 备份文件不存在 (${backupPath})`);
  }

  fs.copyFileSync(backupPath, destPath);
  const size = fs.statSync(destPath).size;
  console.log(`[OK] restore ${type}: ${path.basename(backupPath)} -> ${filename} (${size} bytes)`);
}

function main() {
  const args = parseArgs();

  if (!args.testingDir) fail("缺少 --testing-dir 参数");
  if (!args.action || !["backup", "restore"].includes(args.action)) {
    fail("缺少 --action 参数（可选: backup, restore）");
  }

  const types = getTypes(args.type);

  for (const type of types) {
    if (args.action === "backup") {
      backup(args.testingDir, type);
    } else {
      restore(args.testingDir, type);
    }
  }
}

main();
