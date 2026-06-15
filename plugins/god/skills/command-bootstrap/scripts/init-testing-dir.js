#!/usr/bin/env node
/**
 * init-testing-dir.js
 * 初始化 testing 目录，解决带日期后缀的目录命名问题。
 *
 * 问题背景：
 *   历史上曾出现 testing-20260429-01 这种带日期后缀的目录名，
 *   导致报告路径跑偏、test-config.json 中 workDir 不一致。
 *
 * 正确行为：
 *   - testing/ 目录存在 → 直接使用
 *   - 不存在 → 创建新的 testing/ 目录
 *   - 归档时保留依赖文件和登录信息
 *
 * 用法：
 *   node init-testing-dir.js --work-dir <WORK_DIR> [--scope minimal|full] [--archive]
 *
 * 输出（stdout JSON）：
 *   { "status": "ready" | "archived" | "created", "path": "..." }
 *   { "status": "error", "message": "..." }
 */
"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { workDir: "", archive: false, scope: "full" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--work-dir" && args[i + 1]) result.workDir = args[++i];
    if (args[i] === "--archive") result.archive = true;
    if (args[i] === "--scope" && args[i + 1]) result.scope = args[++i];
  }
  return result;
}

/**
 * 检查目录是否为有效的 testing 目录（包含 test-config.json 或 node_modules）
 */
function isValidTestingDir(dir) {
  if (!fs.existsSync(dir)) return false;
  const hasConfig = fs.existsSync(path.join(dir, "test-config.json"));
  const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));
  return hasConfig || hasNodeModules;
}

/**
 * 归档 testing 目录，保留依赖文件和登录信息
 */
function archiveTestingDir(testingDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const archiveDir = path.join(path.dirname(testingDir), `testing-archive-${timestamp}`);
  
  // 创建归档目录
  fs.mkdirSync(archiveDir, { recursive: true });
  
  // 需要保留的文件/目录（不归档，留在原处）
  const preserveList = new Set([
    "node_modules",
    "package.json",
    "package-lock.json",
    "auth",
    ".gitignore",
  ]);
  
  // 遍历 testing 目录，移动非保留项到归档目录
  const entries = fs.readdirSync(testingDir, { withFileTypes: true });
  for (const entry of entries) {
    if (preserveList.has(entry.name)) continue;
    
    const srcPath = path.join(testingDir, entry.name);
    const destPath = path.join(archiveDir, entry.name);
    
    try {
      fs.renameSync(srcPath, destPath);
    } catch (e) {
      // 跨设备移动失败时使用复制+删除
      if (e.code === "EXDEV") {
        fs.cpSync(srcPath, destPath, { recursive: true });
        fs.rmSync(srcPath, { recursive: true, force: true });
      } else {
        throw e;
      }
    }
  }
  
  return archiveDir;
}

/**
 * gen-test 阶段所需的最小目录集
 */
const GEN_TEST_SUBDIRS = [
  "test-cases",
  ".cache",
  "metrics",
];

/**
 * run-test 阶段额外需要的目录
 */
const RUN_TEST_EXTRA_SUBDIRS = [
  "scripts/api/helpers",
  "screenshots",
  "evidence",
  "reports",
];

/**
 * 创建新的 testing 目录骨架
 * --scope minimal: 仅创建 gen-test 所需目录
 * --scope full:    创建全部目录（默认）
 */
function createTestingDir(testingDir, scope) {
  fs.mkdirSync(testingDir, { recursive: true });

  const subdirs = scope === "minimal"
    ? GEN_TEST_SUBDIRS
    : [...GEN_TEST_SUBDIRS, ...RUN_TEST_EXTRA_SUBDIRS];

  for (const subdir of subdirs) {
    fs.mkdirSync(path.join(testingDir, subdir), { recursive: true });
  }
  
  // 创建 .gitignore
  const gitignorePath = path.join(testingDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, [
      "node_modules/",
      ".cache/",
      "scripts/e2e/test-results/",
      "auth/storage-state.json",
    ].join("\n") + "\n");
  }
  
  // === 新增：创建 node_modules junction 链接到共享依赖 ===
  createJunctionToSharedDeps(testingDir);
}

/**
 * 创建 node_modules junction 链接到共享依赖目录
 */
function createJunctionToSharedDeps(testingDir) {
  const JLC_AI_WORKSPACE = process.env.JLC_AI_WORKSPACE || "";
  
  if (!JLC_AI_WORKSPACE) {
    console.error("[WARN] JLC_AI_WORKSPACE 未设置，跳过 junction 创建");
    return;
  }
  
  const sharedDeps = path.join(JLC_AI_WORKSPACE, ".test-deps", "node_modules");
  const linkPath = path.join(testingDir, "node_modules");
  
  // 检查共享依赖是否存在
  if (!fs.existsSync(sharedDeps)) {
    console.error(`[WARN] 共享依赖不存在: ${sharedDeps}`);
    console.error("[INFO] 请先执行: node $CLAUDE_PLUGIN_ROOT/scripts/workspace/init-shared-deps.js");
    return;
  }
  
  // 已存在且指向正确
  if (fs.existsSync(linkPath)) {
    try {
      const realPath = fs.realpathSync(linkPath);
      if (realPath === sharedDeps || realPath === path.resolve(sharedDeps)) {
        console.error(`[OK] node_modules 已链接到共享依赖`);
        return;
      }
    } catch {}
    // 指向错误，删除重建
    fs.rmSync(linkPath, { recursive: true, force: true });
  }
  
  // 创建 junction
  try {
    if (process.platform === "win32") {
      // Windows Junction
      const { execSync } = require("child_process");
      execSync(`mklink /J "${linkPath}" "${sharedDeps}"`, { shell: true, stdio: "pipe" });
    } else {
      // Unix symlink
      fs.symlinkSync(sharedDeps, linkPath, "junction");
    }
    console.error(`[OK] node_modules 已链接到共享依赖`);
  } catch (e) {
    console.error(`[WARN] junction 创建失败: ${e.message}`);
    console.error(`[INFO] 测试执行时可能需要手动安装依赖`);
  }
  
  // 创建最小化 package.json
  const pkgPath = path.join(testingDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    const reqId = path.basename(path.dirname(testingDir)) || "testing";
    const pkg = {
      name: `testing-${reqId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      version: "1.0.0",
      private: true,
      description: "测试目录（依赖通过 junction 共享）"
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  }
}

function main() {
  const { workDir, archive, scope } = parseArgs();
  
  if (!workDir) {
    console.log(JSON.stringify({ status: "error", message: "缺少 --work-dir 参数" }));
    process.exit(1);
  }
  
  const testingDir = path.join(workDir, "testing");
  const exists = fs.existsSync(testingDir);
  
  // 场景 1：testing 目录不存在 → 创建
  if (!exists) {
    createTestingDir(testingDir, scope);
    console.log(JSON.stringify({ status: "created", path: testingDir }));
    console.error(`[OK] testing 目录已创建 (scope=${scope}): ${testingDir}`);
    return;
  }

  // 场景 2：testing 目录存在但无效（空目录）→ 初始化骨架
  if (!isValidTestingDir(testingDir)) {
    createTestingDir(testingDir, scope);
    console.log(JSON.stringify({ status: "created", path: testingDir }));
    console.error(`[OK] testing 目录已初始化 (scope=${scope}): ${testingDir}`);
    return;
  }
  
  // 场景 3：testing 目录存在且有效
  // scope=full 时补全缺失的 run-test 目录
  if (scope === "full") {
    for (const subdir of RUN_TEST_EXTRA_SUBDIRS) {
      fs.mkdirSync(path.join(testingDir, subdir), { recursive: true });
    }
  }

  if (archive) {
    // 归档模式：保留依赖和登录信息，清除测试产物
    const archivePath = archiveTestingDir(testingDir);
    console.log(JSON.stringify({ status: "archived", path: testingDir, archivePath }));
    console.error(`[OK] testing 目录已归档到: ${archivePath}`);
    console.error(`[OK] 保留了 node_modules/, package*.json, auth/`);
  } else {
    // 继续使用模式
    console.log(JSON.stringify({ status: "ready", path: testingDir }));
    console.error(`[OK] testing 目录已存在，继续使用: ${testingDir}`);
  }
}

main();
