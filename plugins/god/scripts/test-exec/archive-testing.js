#!/usr/bin/env node
"use strict";
/**
 * archive-testing.js
 * 跨平台归档 testing/ 目录产物，替代 bash tar + find 命令。
 *
 * 模式（--mode）：
 *   all    — 默认，归档+清除全部产物（向后兼容）
 *   case   — 只归档+清除 test-cases/ 和评审缓存（gen-test 重新生成时使用）
 *   script - 只归档+清除 scripts 下的 tests 目录和门禁缓存（run-test 重新生成时使用）
 *
 * 用法: node archive-testing.js --work-dir <WORK_DIR> [--mode all|case|script]
 * 输出: $WORK_DIR/archive/testing-{timestamp}.tar.gz 或目录复制
 */
const fs = require("fs");
const { safeReadJson } = require("../lib/safe-json");
const path = require("path");
const { execSync } = require("child_process");

function parseArgs() {
  const argv = process.argv.slice(2);
  let workDir = "";
  let mode = "all";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--work-dir" && argv[i + 1]) workDir = argv[++i];
    if (argv[i] === "--mode" && argv[i + 1]) mode = argv[++i];
  }
  if (!workDir) {
    console.error("[FAIL] 必须指定 --work-dir 参数");
    process.exit(1);
  }
  if (!["all", "case", "script"].includes(mode)) {
    console.error(`[FAIL] --mode 参数无效: ${mode}（可选: all, case, script）`);
    process.exit(1);
  }
  return { workDir, mode };
}

const PRESERVE = new Set([
  "node_modules",
  "auth",
  "auth-login.js",
  "package.json",
  "package-lock.json",
  "test-config.json",
  "dom-probe.md",
  "api-probe.md",
  ".gitignore",
  ".cache",
]);

// 评审缓存文件（gen-test 产物）
const CASE_CACHE_FILES = new Set([
  "coverage-check-result.json",
  "coverage-check-summary.json",
  "biz-review-result.json",
  "tech-review-result.json",
  "merged-review-result.json",
  "review-check-summary.json",
  "case-design-summary.json",
  "e2e-case-design-summary.json",
  "api-case-design-summary.json",
  "flow-case-design-summary.json",
]);

// 门禁缓存文件（run-test 产物）
const SCRIPT_CACHE_FILES = new Set([
  "gate-result.json",
  "gate-flow-result.json",
  "audit-result.json",
  "script-generation-summary.json",
]);

// 案例相关 progress 字段
const CASE_PROGRESS_KEYS = new Set([
  "e2eCases", "apiCases", "apiFlowCases",
]);

// 脚本相关 progress 字段
const SCRIPT_PROGRESS_KEYS = new Set([
  "e2eScripts", "apiScripts", "apiFlowScripts", "gate",
]);

function archiveAndCleanCaseMode(testingDir, archiveDir, timestamp) {
  const casesDir = path.join(testingDir, "test-cases");
  if (!fs.existsSync(casesDir)) {
    console.log("[WARN] test-cases/ 不存在，无需归档");
    return;
  }

  // 归档 test-cases/
  const archiveDest = path.join(archiveDir, `test-cases-${timestamp}`);
  fs.mkdirSync(archiveDest, { recursive: true });
  copyDirExclude(casesDir, archiveDest, new Set());
  console.log(`[OK] test-cases/ 已归档到 archive/test-cases-${timestamp}/`);

  // 清除 test-cases/
  fs.rmSync(casesDir, { recursive: true, force: true });
  console.log("[OK] test-cases/ 已清除");

  // 清除评审缓存
  cleanCacheFiles(testingDir, CASE_CACHE_FILES);

  // 重置案例相关 progress
  resetProgress(testingDir, CASE_PROGRESS_KEYS);
}

function archiveAndCleanScriptMode(testingDir, archiveDir, timestamp) {
  const archiveDest = path.join(archiveDir, `scripts-${timestamp}`);
  fs.mkdirSync(archiveDest, { recursive: true });

  // 归档+清除 scripts/e2e/tests/ 和 scripts/api/tests/
  const scriptDirs = [
    { src: path.join(testingDir, "scripts/e2e/tests"), dest: path.join(archiveDest, "e2e-tests") },
    { src: path.join(testingDir, "scripts/api/tests"), dest: path.join(archiveDest, "api-tests") },
  ];

  let archived = false;
  for (const { src, dest } of scriptDirs) {
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      copyDirExclude(src, dest, new Set());
      fs.rmSync(src, { recursive: true, force: true });
      archived = true;
    }
  }

  if (archived) {
    console.log(`[OK] scripts/*/tests/ 已归档到 archive/scripts-${timestamp}/`);
    console.log("[OK] scripts/*/tests/ 已清除（保留 playwright.config.ts、vitest.config.ts、fixtures.ts）");
  } else {
    console.log("[WARN] scripts/*/tests/ 不存在，无需归档");
  }

  // 清除门禁缓存
  cleanCacheFiles(testingDir, SCRIPT_CACHE_FILES);

  // 重置脚本相关 progress
  resetProgress(testingDir, SCRIPT_PROGRESS_KEYS);
}

function archiveAndCleanAllMode(testingDir, archiveDir, timestamp) {
  const archiveName = `testing-${timestamp}.tar.gz`;
  const archivePath = path.join(archiveDir, archiveName);

  try {
    const excludes = PRESERVE;
    const excludeArgs = [...excludes].map((e) => `--exclude='${e}'`).join(" ");
    execSync(
      `tar -czf "${archivePath}" ${excludeArgs} .`,
      { cwd: testingDir, stdio: "pipe" }
    );
    console.log(`[OK] 已归档到 archive/${archiveName}`);
  } catch {
    const fallbackDir = path.join(archiveDir, `testing-${timestamp}`);
    fs.mkdirSync(fallbackDir, { recursive: true });
    copyDirExclude(testingDir, fallbackDir, PRESERVE);
    console.log(`[OK] 已归档到 archive/testing-${timestamp}/（tar 不可用，使用目录复制）`);
  }

  // 清空产物但保留 PRESERVE 中的项
  const entries = fs.readdirSync(testingDir);
  for (const entry of entries) {
    if (PRESERVE.has(entry)) continue;
    const fullPath = path.join(testingDir, entry);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
  console.log("[OK] testing/ 产物已清空（保留 node_modules、auth、package.json、test-config.json、探测报告）");

  // 重置全部 progress
  resetProgress(testingDir, null);

  // 清理 .cache 中的非探测缓存
  const cacheDir = path.join(testingDir, ".cache");
  if (fs.existsSync(cacheDir)) {
    const CACHE_PRESERVE = new Set([
      "api-skeleton.json",
      "routes.json",
      "dom-probe-skeleton.json",
      "swagger-probe-result.json",
    ]);
    const cacheEntries = fs.readdirSync(cacheDir);
    for (const entry of cacheEntries) {
      if (CACHE_PRESERVE.has(entry)) continue;
      fs.rmSync(path.join(cacheDir, entry), { recursive: true, force: true });
    }
    console.log("[OK] .cache/ 已清理（保留探测缓存）");
  }
}

function cleanCacheFiles(testingDir, fileSet) {
  const cacheDir = path.join(testingDir, ".cache");
  if (!fs.existsSync(cacheDir)) return;
  let cleaned = 0;
  for (const entry of fs.readdirSync(cacheDir)) {
    if (fileSet.has(entry)) {
      fs.rmSync(path.join(cacheDir, entry), { force: true });
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[OK] .cache/ 已清理 ${cleaned} 个缓存文件`);
  }
}

function resetProgress(testingDir, keySet) {
  const configPath = path.join(testingDir, "test-config.json");
  if (!fs.existsSync(configPath)) return;
  const config = safeReadJson(configPath, { fallback: null });
  if (!config || !config.progress) return;
  let resetCount = 0;
  for (const key of Object.keys(config.progress)) {
    // keySet=null means reset all
    if (keySet === null || keySet.has(key)) {
      config.progress[key] = "pending";
      resetCount++;
    }
  }
  if (resetCount > 0) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    console.log(`[OK] test-config.json progress 已重置 ${resetCount} 个字段为 pending`);
  }
}

function copyDirExclude(src, dest, excludeSet) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeSet.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirExclude(srcPath, destPath, new Set());
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  const { workDir, mode } = parseArgs();
  const testingDir = path.join(workDir, "testing");

  if (!fs.existsSync(testingDir)) {
    console.log("[WARN] testing/ 目录不存在，无需归档");
    process.exit(0);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "").substring(0, 14);
  const archiveDir = path.join(workDir, "archive");
  fs.mkdirSync(archiveDir, { recursive: true });

  console.log(`归档模式: ${mode}`);

  switch (mode) {
    case "case":
      archiveAndCleanCaseMode(testingDir, archiveDir, timestamp);
      break;
    case "script":
      archiveAndCleanScriptMode(testingDir, archiveDir, timestamp);
      break;
    case "all":
    default:
      archiveAndCleanAllMode(testingDir, archiveDir, timestamp);
      break;
  }
}

main();
