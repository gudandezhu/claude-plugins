#!/usr/bin/env node
/**
 * init-shared-deps.js
 * 初始化共享测试依赖目录。
 *
 * 功能：
 * - 创建 $JLC_AI_WORKSPACE/.test-deps/ 目录
 * - 生成 package.json（如果不存在）
 * - 执行 npm install
 *
 * 用法：
 *   node init-shared-deps.js
 *   node init-shared-deps.js --force  # 强制重新安装
 *
 * 输出：
 *   成功：[OK] 共享依赖已安装: {path}
 *   失败：[FAIL] {error message}
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    force: args.includes("--force")
  };
}

function main() {
  const { force } = parseArgs();
  const JLC_AI_WORKSPACE = process.env.JLC_AI_WORKSPACE || "";

  if (!JLC_AI_WORKSPACE) {
    console.error("[FAIL] JLC_AI_WORKSPACE 环境变量未设置");
    process.exit(1);
  }

  const depsDir = path.join(JLC_AI_WORKSPACE, ".test-deps");
  const pkgPath = path.join(depsDir, "package.json");
  const nodeModulesPath = path.join(depsDir, "node_modules");

  // 1. 创建目录
  fs.mkdirSync(depsDir, { recursive: true });
  console.log(`[INFO] 共享依赖目录: ${depsDir}`);

  // 2. 创建 package.json（如果不存在）
  if (!fs.existsSync(pkgPath)) {
    const pkg = {
      name: "test-deps-shared",
      version: "1.0.0",
      private: true,
      description: "共享测试依赖 - 所有测试项目共用",
      devDependencies: {
        "vitest": "1.2.0",
        "@playwright/test": "1.40.0",
        "axios": "1.6.0"
      }
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log("[INFO] package.json 已创建");
  }

  // 3. 检查是否需要安装
  const needsInstall = force || !fs.existsSync(nodeModulesPath);

  if (!needsInstall) {
    // 验证 node_modules 完整性
    const vitestPath = path.join(nodeModulesPath, "vitest");
    const playwrightPath = path.join(nodeModulesPath, "@playwright", "test");

    if (!fs.existsSync(vitestPath) || !fs.existsSync(playwrightPath)) {
      console.log("[INFO] node_modules 不完整，重新安装...");
    } else {
      console.log("[OK] 共享依赖已存在，跳过安装");
      console.log(`     如需重新安装，请使用: node init-shared-deps.js --force`);
      return;
    }
  }

  // 4. 安装依赖
  console.log("[INFO] 安装共享测试依赖（首次安装约需 2-5 分钟）...");
  try {
    execSync("npm install --prefer-offline", {
      cwd: depsDir,
      stdio: "inherit"
    });
    console.log(`\n[OK] 共享依赖已安装: ${depsDir}`);
    console.log(`     node_modules 大小: ${getDirSize(nodeModulesPath)}`);
  } catch (e) {
    console.error(`[FAIL] 依赖安装失败: ${e.message}`);
    process.exit(1);
  }
}

/**
 * 获取目录大小（简化版，返回 MB）
 */
function getDirSize(dir) {
  if (!fs.existsSync(dir)) return "0 MB";
  try {
    // Windows 使用 dir 命令
    if (process.platform === "win32") {
      const output = execSync(`dir /s "${dir}" 2>nul | findstr "File(s)"`, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024
      });
      const match = output.match(/([\d,]+)\s+bytes/);
      if (match) {
        const bytes = parseInt(match[1].replace(/,/g, ""), 10);
        return `${Math.round(bytes / 1024 / 1024)} MB`;
      }
    }
    return "~200 MB（估计值）";
  } catch {
    return "~200 MB（估计值）";
  }
}

main();
