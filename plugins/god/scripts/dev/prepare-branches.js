#!/usr/bin/env node
/**
 * prepare-branches.js — 扫描任务详情，为涉及的项目仓库创建 feature 分支
 *
 * 固化 backend.md / frontend.md Phase 0 分支准备逻辑：
 *   1. 读取 task-list.json 获取任务列表
 *   2. 按角色过滤，读取任务详情 frontmatter 提取项目标识
 *   3. 去重 + 路径白名单校验（必须在 $JLC_AI_WORKSPACE/projects/ 下）
 *   4. 逐项目调用 git-feature-branch.sh 创建/切换分支
 *
 * 用法：
 *   node prepare-branches.js --req <需求编号> --role <backend|frontend>
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// === 角色映射：CLI 参数 → task-list.json 中的 role 值 ===
const ROLE_MAP = {
  backend: ["backend", "infra"],
  frontend: ["frontend"],
};

// === 参数解析 ===
function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    console.log(`prepare-branches.js — 自动为项目仓库创建 feature 分支

用法:
  node prepare-branches.js --req <需求编号> --role <backend|frontend>

选项:
  --req <需求编号>      需求编号（必填）
  --role <角色>         backend 或 frontend（必填）
  --dry-run             仅输出将要操作的目录，不执行 git 操作
  -h, --help            显示帮助

输出:
  JSON 结构 { status, branches, unresolved }
  - branches:  成功/失败的项目目录列表
  - unresolved: 无法推导项目目录的任务（前端需 AskUserQuestion 兜底）`);
    process.exit(0);
  }

  let req = null, role = null, dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--req" && argv[i + 1]) req = argv[++i];
    if (argv[i] === "--role" && argv[i + 1]) role = argv[++i];
    if (argv[i] === "--dry-run") dryRun = true;
  }

  if (!req) { console.error("[ERROR] --req 需求编号必填"); process.exit(1); }
  if (!role || !ROLE_MAP[role]) { console.error("[ERROR] --role 必须是 backend 或 frontend"); process.exit(1); }

  return { req, role, dryRun };
}

// === 简易 YAML frontmatter 解析 ===
function parseFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      let val = kv[2].trim();
      // 去引号
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // 去模板占位符花括号
      if (val.startsWith("{") && val.endsWith("}")) {
        val = val.slice(1, -1).trim();
      }
      fm[kv[1]] = val;
    }
  }
  return fm;
}

// === 定位 task-list.json（复用 task-cli.js 逻辑）===
function findAllTaskLists(req) {
  const base = process.env.JLC_AI_WORKSPACE;
  if (!base) {
    console.error("[ERROR] 环境变量 JLC_AI_WORKSPACE 未设置");
    process.exit(1);
  }
  const tasksDir = path.join(base, "process-docs", req, "tasks");
  if (!fs.existsSync(tasksDir)) {
    console.error(`[ERROR] 目录不存在: ${tasksDir}`);
    process.exit(1);
  }
  const itDirs = fs.readdirSync(tasksDir).filter(d =>
    fs.statSync(path.join(tasksDir, d)).isDirectory()
  );
  if (itDirs.length === 0) {
    console.error(`[ERROR] 未找到迭代目录: ${tasksDir}`);
    process.exit(1);
  }
  const sources = [];
  for (const it of itDirs) {
    const target = path.join(tasksDir, it, "task-list.json");
    if (!fs.existsSync(target)) {
      console.error(`[ERROR] task-list.json 不存在: ${target}`);
      process.exit(1);
    }
    sources.push({ taskListPath: target, tasksDir: path.join(tasksDir, it), iteration: it });
  }
  return sources;
}

// === 提取项目目录 ===
function extractProjectDirs(sources, roleFilter) {
  const base = process.env.JLC_AI_WORKSPACE;
  const projectsRoot = path.join(base, "projects");
  const targetRoles = ROLE_MAP[roleFilter];
  const seen = new Map(); // normalized path → { source, taskIds }
  const unresolved = [];

  for (const src of sources) {
    const data = JSON.parse(fs.readFileSync(src.taskListPath, "utf-8"));
    for (const t of (data.tasks || [])) {
      if (!targetRoles.includes(t.role)) continue;

      // 必须有 detailFile 才能读 frontmatter
      if (!t.detailFile) {
        unresolved.push({ taskId: t.id, reason: "no detailFile in task-list.json" });
        continue;
      }

      const detailPath = path.join(src.tasksDir, t.detailFile);
      if (!fs.existsSync(detailPath)) {
        unresolved.push({ taskId: t.id, reason: `detail file not found: ${detailPath}` });
        continue;
      }

      const fm = parseFrontmatter(detailPath);

      // project-dir 优先（绝对路径或相对路径）
      let projectDir = null;
      let source = null;

      if (fm["project-dir"] && fm["project-dir"] !== "") {
        projectDir = fm["project-dir"];
        source = "project-dir";
      }

      // microservice 次选 → 推导为 $JLC_AI_WORKSPACE/projects/{microservice}/
      if (!projectDir && fm["microservice"] && fm["microservice"] !== "") {
        projectDir = path.join(projectsRoot, fm["microservice"]);
        source = "microservice";
      }

      if (!projectDir) {
        unresolved.push({
          taskId: t.id,
          taskName: t.name,
          role: t.role,
          reason: "no project-dir or microservice in frontmatter",
        });
        continue;
      }

      // 归一化为绝对路径
      if (!path.isAbsolute(projectDir)) {
        projectDir = path.resolve(projectDir);
      }

      // 白名单校验：必须在 projects/ 下
      const normalized = path.normalize(projectDir);
      const normalizedRoot = path.normalize(projectsRoot);
      if (!normalized.startsWith(normalizedRoot + path.sep) && normalized !== normalizedRoot) {
        console.error(`[WARN] 跳过非法路径: ${normalized} (不在 ${normalizedRoot} 下)`);
        unresolved.push({
          taskId: t.id,
          taskName: t.name,
          role: t.role,
          reason: `path outside projects/: ${normalized}`,
        });
        continue;
      }

      if (seen.has(normalized)) {
        seen.get(normalized).taskIds.push(t.id);
      } else {
        seen.set(normalized, { source, taskIds: [t.id] });
      }
    }
  }

  return { dirs: seen, unresolved };
}

// === 调用 git-feature-branch.sh ===
function createBranch(projectDir, reqNum, dryRun) {
  const scriptPath = path.join(__dirname, "git-feature-branch.sh");

  if (dryRun) {
    return { projectDir, status: "dry-run", message: "skipped (dry-run)" };
  }

  try {
    const output = execSync(
      `bash "${scriptPath}" -d "${projectDir}" -r "${reqNum}"`,
      { encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] }
    );
    // 提取最后一行 [OK] 信息
    const lines = output.trim().split(/\r?\n/);
    const okLine = lines.reverse().find(l => l.startsWith("[OK]")) || lines[0];
    return { projectDir, status: "ok", message: okLine.trim() };
  } catch (err) {
    const stderr = (err.stderr || "").trim();
    return { projectDir, status: "error", message: stderr || err.message };
  }
}

// === main ===
function main() {
  const args = parseArgs();
  const sources = findAllTaskLists(args.req);
  const { dirs, unresolved } = extractProjectDirs(sources, args.role);

  if (dirs.size === 0 && unresolved.length === 0) {
    console.log(JSON.stringify({
      status: "ok",
      message: "无匹配任务",
      branches: [],
      unresolved: [],
    }, null, 2));
    return;
  }

  // 逐项目创建分支
  const branches = [];
  for (const [projectDir, info] of dirs) {
    console.error(`[INFO] ${info.source} → ${projectDir} (tasks: ${info.taskIds.join(", ")})`);
    const result = createBranch(projectDir, args.req, args.dryRun);
    result.taskIds = info.taskIds;
    branches.push(result);
  }

  // 汇总
  const okCount = branches.filter(b => b.status === "ok").length;
  const errorCount = branches.filter(b => b.status === "error").length;
  const overallStatus = errorCount > 0 ? "partial" : "ok";

  const output = {
    status: overallStatus,
    summary: { total: branches.length, ok: okCount, error: errorCount, unresolved: unresolved.length },
    branches,
    unresolved,
  };

  console.log(JSON.stringify(output, null, 2));

  // 有错误时 exit code ≠ 0
  if (errorCount > 0) process.exit(1);
}

main();
