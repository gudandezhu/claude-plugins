#!/usr/bin/env node
/**
 * setup-junction.js
 * 为测试目录创建 node_modules 的 junction 链接。
 *
 * 功能：
 * - 检测共享依赖目录是否存在
 * - 创建 junction（Windows）或 symlink（Unix）
 * - 处理跨盘符情况（使用复制作为 fallback）
 * - 创建最小化 package.json
 *
 * 用法：
 *   node setup-junction.js --target <目标目录>
 *
 * 输出（stdout JSON）：
 *   { "status": "linked" | "exists" | "copied" | "error", "target": "...", "source": "..." }
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { targetDir: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) result.targetDir = args[++i];
  }
  return result;
}

/**
 * 检测是否跨盘符（Windows）
 */
function isCrossDrive(path1, path2) {
  if (process.platform !== "win32") return false;

  const drive1 = path.parse(path.resolve(path1)).root;
  const drive2 = path.parse(path.resolve(path2)).root;

  return drive1.toLowerCase() !== drive2.toLowerCase();
}

/**
 * 创建 junction 或 symlink
 */
function createJunction(source, targetDir) {
  const linkPath = path.join(targetDir, "node_modules");

  // 已存在且指向正确目标
  if (fs.existsSync(linkPath)) {
    try {
      const stats = fs.lstatSync(linkPath);

      // Windows junction 或 Unix symlink
      if (stats.isSymbolicLink() || (process.platform === "win32" && stats.isDirectory())) {
        const realPath = fs.realpathSync(linkPath);
        if (realPath === source || realPath === path.resolve(source)) {
          return { status: "exists", source, target: linkPath };
        }
      }
    } catch (e) {
      // 无法解析，继续创建
    }

    // 指向错误目标或损坏，删除重建
    console.error(`[INFO] 删除旧的 node_modules 链接...`);
    fs.rmSync(linkPath, { recursive: true, force: true });
  }

  // 跨盘符检测
  if (isCrossDrive(source, targetDir)) {
    console.error(`[WARN] 跨盘符检测，使用复制模式`);
    console.error(`       源: ${source}`);
    console.error(`       目标: ${targetDir}`);
    console.error(`       这将占用额外磁盘空间约 200MB`);

    try {
      fs.cpSync(source, linkPath, { recursive: true });
      return { status: "copied", source, target: linkPath };
    } catch (e) {
      return { status: "error", message: `复制失败: ${e.message}` };
    }
  }

  // 创建链接
  try {
    if (process.platform === "win32") {
      // Windows Junction（不需要管理员权限）
      execSync(`mklink /J "${linkPath}" "${source}"`, {
        shell: true,
        stdio: "pipe"
      });
    } else {
      // Unix symlink
      fs.symlinkSync(source, linkPath, "junction");
    }

    return { status: "linked", source, target: linkPath };
  } catch (e) {
    // Junction 失败，尝试复制
    console.error(`[WARN] Junction 创建失败: ${e.message}`);
    console.error(`[INFO] 尝试复制模式...`);

    try {
      fs.cpSync(source, linkPath, { recursive: true });
      return { status: "copied", source, target: linkPath };
    } catch (copyError) {
      return { status: "error", message: `复制失败: ${copyError.message}` };
    }
  }
}

/**
 * 创建最小化 package.json（npm 需要）
 */
function createMinimalPackageJson(targetDir) {
  const pkgPath = path.join(targetDir, "package.json");

  if (fs.existsSync(pkgPath)) return;

  const dirName = path.basename(targetDir);
  const pkg = {
    name: `testing-${dirName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    version: "1.0.0",
    private: true,
    description: "测试目录（依赖通过 junction 共享）"
  };

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.error(`[INFO] 创建最小化 package.json`);
}

/**
 * 确保目标目录存在
 */
function ensureTargetDir(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.error(`[INFO] 创建目录: ${targetDir}`);
  }
}

function main() {
  const { targetDir } = parseArgs();
  const JLC_AI_WORKSPACE = process.env.JLC_AI_WORKSPACE || "";

  if (!targetDir) {
    const result = { status: "error", message: "缺少 --target 参数" };
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  if (!JLC_AI_WORKSPACE) {
    const result = { status: "error", message: "JLC_AI_WORKSPACE 环境变量未设置" };
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  const sharedDeps = path.join(JLC_AI_WORKSPACE, ".test-deps", "node_modules");

  // 检查共享依赖是否存在
  if (!fs.existsSync(sharedDeps)) {
    const result = {
      status: "error",
      message: `共享依赖不存在: ${sharedDeps}`,
      hint: "请先执行: node $CLAUDE_PLUGIN_ROOT/scripts/workspace/init-shared-deps.js"
    };
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  // 确保目标目录存在
  ensureTargetDir(targetDir);

  // 创建 junction
  const result = createJunction(sharedDeps, targetDir);

  if (result.status === "error") {
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  // 创建最小化 package.json
  createMinimalPackageJson(targetDir);

  // 输出结果
  console.log(JSON.stringify(result));

  // 日志输出
  const statusMessages = {
    linked: `[OK] junction 创建成功`,
    exists: `[OK] junction 已存在`,
    copied: `[OK] 依赖复制成功（跨盘符模式）`
  };
  console.error(statusMessages[result.status] || `[OK] 完成`);
  console.error(`     目标: ${result.target}`);
  console.error(`     源: ${result.source}`);
}

main();
