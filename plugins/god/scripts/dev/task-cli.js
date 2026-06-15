#!/usr/bin/env node
/**
 * task-cli.js — 任务管理 CLI
 * 获取任务、更新状态、重置、查看总览、初始化
 *
 * 用法：
 *   node task-cli.js get    --req <需求编号> [--role backend|frontend|infra] [--all]
 *   node task-cli.js update --req <需求编号> --task <id> --phase <dev|selfTest> --value <done|pending|->
 *   node task-cli.js reset  --req <需求编号> [--task <id>] [--phase <dev|selfTest>] [--all]
 *   node task-cli.js status --req <需求编号>
 *   node task-cli.js add    --req <需求编号> --it <迭代> --task '<json>'  或 --file <json文件>
 *   node task-cli.js init   --req <需求编号> --it <迭代> [--file <json文件>]
 */
"use strict";

const fs = require("fs");
const path = require("path");

// === 参数解析 ===
function parseArgs() {
  const argv = process.argv.slice(2);

  // --help / -h
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    console.log(`task-cli.js — 任务管理 CLI

用法:
  node task-cli.js <命令> --req <需求编号[/迭代]> [选项]

命令:
  get     获取所有可执行任务
  update  更新任务的阶段状态
  reset   重置任务状态
  status  查看所有任务总览
  add     追加新任务到指定迭代

get 选项:
  --role <backend|frontend|infra>  按角色过滤
  --phase <dev|selfTest>     获取阶段（默认 dev）
  --one                      只返回第一个可执行任务
  --force                    忽略依赖检查，强制返回未完成任务

update 选项:
  --task <id>                任务 ID（必填）
  --phase <dev|selfTest>     阶段（必填）
  --value <done|pending|->   新值（必填）
  --report <path>            测试报告路径（selfTest 阶段必填，文件必须存在且有内容）

reset 选项:
  --task <id>                重置指定任务（不传 --phase 则重置全部阶段）
  --phase <dev|selfTest>     只重置指定阶段
  --all                      重置所有任务

add 选项:
  --it <迭代编号>            目标迭代（必填）
  --task '<json>'            单条或多条任务 JSON（与 --file 二选一）
  --file <json文件>          从文件读取任务数组（与 --task 二选一）
  自动计算 seq，不修改已有任务的 phase。

通用:
  --req <需求编号[/迭代]>    定位 task-list.json（必填，指定迭代则只查该迭代）
  -h, --help                 显示帮助

注意:
  update/reset 同 ID 跨迭代存在歧义时，必须用 --req <需求编号>/<迭代> 指定迭代
`);
    process.exit(0);
  }

  const cmd = argv[0];
  if (!["get", "update", "reset", "status", "init", "add"].includes(cmd)) {
    console.error("[ERROR] 命令必须是 get | update | reset | status | add | init");
    process.exit(1);
  }

  let req = null, it = null, role = null, all = false, one = false, force = false, getPhase = "dev";
  let task = null, phase = null, value = null, inputFile = null, report = null;
  let addTaskJson = null;

  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--req" && argv[i + 1]) {
      const raw = argv[++i];
      const slashIdx = raw.lastIndexOf("/");
      if (slashIdx !== -1) {
        req = raw.substring(0, slashIdx);
        it = raw.substring(slashIdx + 1);
      } else {
        req = raw;
      }
    }
    if (argv[i] === "--role" && argv[i + 1]) role = argv[++i];
    if (argv[i] === "--all") all = true;
    if (argv[i] === "--one") one = true;
    if (argv[i] === "--force") force = true;
    if (argv[i] === "--task" && argv[i + 1]) {
      if (cmd === "add") {
        addTaskJson = argv[++i];
      } else {
        task = argv[++i];
      }
    }
    if (argv[i] === "--phase" && argv[i + 1]) {
      if (cmd === "get") {
        getPhase = argv[++i];
      } else {
        phase = argv[++i];
      }
    }
    if (argv[i] === "--value" && argv[i + 1]) value = argv[++i];
    if (argv[i] === "--file" && argv[i + 1]) inputFile = argv[++i];
    if (argv[i] === "--it" && argv[i + 1]) it = argv[++i];
    if (argv[i] === "--report" && argv[i + 1]) report = argv[++i];
  }

  if (!req) {
    console.error("[ERROR] --req 需求编号必填");
    process.exit(1);
  }
  if (role && !["backend", "frontend", "infra"].includes(role)) {
    console.error("[ERROR] --role 必须是 backend, frontend 或 infra");
    process.exit(1);
  }
  if (getPhase && !["dev", "selfTest"].includes(getPhase)) {
    console.error("[ERROR] get --phase 必须是 dev 或 selfTest");
    process.exit(1);
  }
  if (cmd === "update" && (!task || !phase || !value)) {
    console.error("[ERROR] update 需要 --task, --phase, --value");
    process.exit(1);
  }
  if (cmd === "update" && phase === "selfTest") {
    if (!report) {
      console.error("[ERROR] selfTest 阶段必须传 --report <测试报告路径>");
      process.exit(1);
    }
    if (!fs.existsSync(report)) {
      console.error("[ERROR] 测试报告文件不存在: " + report);
      process.exit(1);
    }
    const content = fs.readFileSync(report, "utf-8").trim();
    if (!content) {
      console.error("[ERROR] 测试报告文件为空: " + report);
      process.exit(1);
    }
  }
  if (phase && !["dev", "selfTest"].includes(phase)) {
    console.error("[ERROR] --phase 必须是 dev 或 selfTest");
    process.exit(1);
  }
  if (cmd === "reset" && !task && !all) {
    console.error("[ERROR] reset 需要 --task <id> 或 --all");
    process.exit(1);
  }

  if (cmd === "init" && (!req || !it)) {
    console.error("[ERROR] init 需要 --req <需求编号> --it <迭代编号>");
    process.exit(1);
  }

  if (cmd === "add") {
    if (!req || !it) {
      console.error("[ERROR] add 需要 --req <需求编号> --it <迭代编号>");
      process.exit(1);
    }
    if (!addTaskJson && !inputFile && process.stdin.isTTY) {
      console.error("[ERROR] add 需要 --task '<json>' 或 --file <json文件> 或 stdin 管道");
      process.exit(1);
    }
  }

  return { cmd, req, it, role, all, one, force, getPhase, task, phase, value, inputFile, report, addTaskJson };
}

// === 定位所有迭代的 task-list.json ===
function findAllTaskLists(req, it) {
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
  ).filter(d => !it || d === it);
  if (it && itDirs.length === 0) {
    console.error(`[ERROR] 迭代目录不存在: ${path.join(tasksDir, it)}`);
    process.exit(1);
  }
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

// === 兼容：status → phase ===
function normalizeTaskPhase(t) {
  if (!t.phase && t.status) {
    console.error(`[WARN] 任务 ${t.id} 使用了 status 字段，应改为 phase。已自动兼容。`);
    t.phase = t.status;
    delete t.status;
  }
}

// === 合并所有迭代的任务 ===
function loadAllTasks(sources) {
  let allTasks = [];
  for (const src of sources) {
    const data = JSON.parse(fs.readFileSync(src.taskListPath, "utf-8"));
    for (const t of (data.tasks || [])) {
      normalizeTaskPhase(t);
      t._source = { taskListPath: src.taskListPath, tasksDir: src.tasksDir };
      allTasks.push(t);
    }
  }
  allTasks.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  return allTasks;
}

// === 提取迭代编号 ===
function getIteration(t) {
  if (!t._source || !t._source.tasksDir) return null;
  return t._source.tasksDir.split(/[\\/]/).pop();
}

// === 依赖解析：支持 "IT-XX.TASK-ID" 跨迭代 + "IT-XX" 迭代级依赖 ===
function resolveDep(depId, allTasks, sourceIteration) {
  // "IT-XX.TASK-ID" 格式 → 精确匹配指定迭代
  const dotIdx = depId.indexOf(".");
  if (dotIdx !== -1) {
    const itId = depId.substring(0, dotIdx);
    const taskId = depId.substring(dotIdx + 1);
    let dep = allTasks.find(x => x.id === taskId && getIteration(x) === itId);
    if (dep) return dep;
    dep = allTasks.find(x => x.id === taskId);
    return dep || null;
  }
  // "IT-XX" 迭代级依赖 → 该迭代所有 task 的 dev 均为 done 才算完成
  const itTasks = allTasks.filter(x => getIteration(x) === depId);
  if (itTasks.length > 0) {
    const allDone = itTasks.every(x => x.phase.dev === "done");
    return { id: depId, phase: { dev: allDone ? "done" : "pending" }, _isIteration: true };
  }
  // 纯 task ID → 优先匹配同迭代，再回退任意匹配
  if (sourceIteration) {
    let dep = allTasks.find(x => x.id === depId && getIteration(x) === sourceIteration);
    if (dep) return dep;
  }
  let dep = allTasks.find(x => x.id === depId);
  return dep || null;
}

// === zcode 工作流 command 顺序（仅用户可执行的入口）===
const WORKFLOW = [
  { role: "backend", command: "/zcode:backend" },
  { role: "infra", command: "/zcode:backend" },
  { role: "frontend", command: "/zcode:frontend" },
  { command: "/zcode:gen-test" },
  { command: "/zcode:run-test" },
  { command: "/zcode:run-test" }
];

function getNextSuggestion(allTasks) {
  const remaining = allTasks.filter(t => !isTaskDone(t));
  for (const step of WORKFLOW) {
    if (step.role && remaining.some(t => t.role === step.role)) return step.command;
  }
  // 所有角色任务完成 → 指向工作流下一步
  return WORKFLOW.find(s => !s.role).command;
}

// === 判断任务是否已完成（dev=done 且 selfTest=done 或 selfTest="-"）===
function isTaskDone(t) {
  return t.phase.dev === "done" && (t.phase.selfTest === "done" || t.phase.selfTest === "-");
}

// === DAG: 判断任务是否可执行 ===
function isAvailable(t, allTasks, mode, force) {
  if (mode === "selfTest") {
    return t.phase.dev === "done" && t.phase.selfTest !== "done";
  }
  // dev 模式：dev 已完成 → 不可用
  if (t.phase.dev === "done") return false;
  // --force: 跳过依赖检查
  if (force) return true;
  // 检查依赖：只需要 dev 完成，不要求 selfTest
  const srcIt = getIteration(t);
  for (const depId of (t.dependencies || [])) {
    const dep = resolveDep(depId, allTasks, srcIt);
    if (!dep) return false;
    if (dep.phase.dev !== "done") return false;
  }
  return true;
}

// === 构建任务输出 ===
function buildTaskOutput(t) {
  const tasksDir = (t._source && t._source.tasksDir) || "";
  const detailPath = t.detailFile
    ? path.join(tasksDir, t.detailFile)
    : null;
  return {
    id: t.id,
    iteration: getIteration(t),
    name: t.name,
    role: t.role,
    dependencies: t.dependencies || [],
    phase: t.phase,
    detailFile: t.detailFile || "",
    detailPath: detailPath || ""
  };
}

// === get ===
function cmdGet(args, sources) {
  const allTasks = loadAllTasks(sources);
  let tasks = [...allTasks];

  if (args.role) {
    tasks = tasks.filter(t => t.role === args.role);
  }

  const mode = args.getPhase || "dev";
  const force = args.force || false;
  const available = tasks.filter(t => isAvailable(t, allTasks, mode, force));

  // --force 时输出 WARN
  if (force && available.length > 0) {
    const skippedDeps = [];
    for (const t of available) {
      if (t.dependencies && t.dependencies.length > 0) {
        skippedDeps.push({ id: t.id, dependencies: t.dependencies });
      }
    }
    if (skippedDeps.length > 0) {
      console.error(`[WARN] --force 模式：以下任务跳过了依赖检查:`);
      for (const s of skippedDeps) {
        console.error(`  ${s.id}: dependencies=${JSON.stringify(s.dependencies)}`);
      }
    }
  }

  if (available.length === 0) {
    const filtered = args.role ? allTasks.filter(t => t.role === args.role) : allTasks;
    const roleLabel = args.role ? (args.role === "backend" ? "后端" : args.role === "frontend" ? "前端" : "基础设施") : null;

    if (mode === "selfTest") {
      const fullyDone = filtered.filter(t => isTaskDone(t));
      if (fullyDone.length === filtered.length && filtered.length > 0) {
        const remaining = allTasks.filter(t => !isTaskDone(t));
        const remainingRoles = [...new Set(remaining.map(t => t.role))];
        console.log(JSON.stringify({
          status: "done",
          message: args.role
            ? `所有${roleLabel}任务已完成`
            : "所有任务已完成",
          remainingRoles,
          nextSuggestion: getNextSuggestion(allTasks)
        }, null, 2));
        return;
      }
    } else {
      const fullyDone = filtered.filter(t => isTaskDone(t));
      const needTest = filtered.filter(t => t.phase.dev === "done" && t.phase.selfTest !== "done" && t.phase.selfTest !== "-");
      const blocked = filtered.filter(t => t.phase.dev !== "done" && !isAvailable(t, allTasks, "dev", force));

      if (fullyDone.length === filtered.length && filtered.length > 0) {
        const remaining = allTasks.filter(t => !isTaskDone(t));
        const remainingRoles = [...new Set(remaining.map(t => t.role))];
        console.log(JSON.stringify({
          status: "done",
          message: args.role
            ? `所有${roleLabel}任务已完成`
            : "所有任务已完成",
          remainingRoles,
          nextSuggestion: getNextSuggestion(allTasks)
        }, null, 2));
        return;
      }

      if (needTest.length > 0 && blocked.length === 0) {
        console.log(JSON.stringify({
          status: "dev-done",
          message: args.role
            ? `${roleLabel}任务开发全部完成，待测试`
            : "所有任务开发完成，待测试",
          needTest: needTest.map(t => ({ id: t.id, name: t.name }))
        }, null, 2));
        return;
      }

      if (blocked.length > 0) {
        console.log(JSON.stringify({
          status: "blocked",
          message: args.role
            ? `${roleLabel}无可用任务，存在阻塞`
            : "无可用任务，存在阻塞",
          blocked: blocked.map(t => ({
            id: t.id,
            blockedBy: (t.dependencies || []).filter(depId => {
              const dep = resolveDep(depId, allTasks, getIteration(t));
              return !dep || dep.phase.dev !== "done";
            })
          }))
        }, null, 2));
        return;
      }
    }
  }

  // 默认返回全部可执行任务，--one 只返回第一个
  if (args.one) {
    const result = {
      status: "ok",
      task: buildTaskOutput(available[0])
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = {
    status: "ok",
    count: available.length,
    tasks: available.map(t => buildTaskOutput(t))
  };
  console.log(JSON.stringify(result, null, 2));
}

// === 检查任务 ID 是否跨迭代歧义 ===
function checkAmbiguous(taskId, sources) {
  const matchedIt = [];
  for (const src of sources) {
    const data = JSON.parse(fs.readFileSync(src.taskListPath, "utf-8"));
    if ((data.tasks || []).some(x => x.id === taskId)) {
      matchedIt.push(src.iteration);
    }
  }
  if (matchedIt.length > 1) {
    console.error(`[ERROR] 任务 ${taskId} 存在于多个迭代: ${matchedIt.join(", ")}。请用 --req <需求编号>/<迭代编号> 指定迭代`);
    process.exit(1);
  }
  return matchedIt.length === 1;
}

// === update ===
function cmdUpdate(args, sources) {
  if (sources.length > 1) checkAmbiguous(args.task, sources);
  for (const src of sources) {
    const data = JSON.parse(fs.readFileSync(src.taskListPath, "utf-8"));
    const t = (data.tasks || []).find(x => x.id === args.task);
    if (!t) continue;
    normalizeTaskPhase(t);
    if (!(args.phase in t.phase)) {
      console.error(`[ERROR] 任务 ${args.task} 没有 phase.${args.phase}`);
      process.exit(1);
    }
    const oldValue = t.phase[args.phase];
    t.phase[args.phase] = args.value;
    fs.writeFileSync(src.taskListPath, JSON.stringify(data, null, 2), "utf-8");

    console.log(JSON.stringify({
      status: "ok",
      task: args.task,
      iteration: src.iteration,
      phase: args.phase,
      oldValue,
      newValue: args.value
    }, null, 2));
    return;
  }
  console.error(`[ERROR] 任务不存在: ${args.task}`);
  process.exit(1);
}

// === reset ===
function cmdReset(args, sources) {
  const initialPhase = { dev: "pending", selfTest: "-" };
  let resetIds = [];

  if (args.all) {
    for (const src of sources) {
      const data = JSON.parse(fs.readFileSync(src.taskListPath, "utf-8"));
      for (const t of (data.tasks || [])) {
        normalizeTaskPhase(t);
        t.phase = { ...initialPhase };
        resetIds.push(t.id);
      }
      fs.writeFileSync(src.taskListPath, JSON.stringify(data, null, 2), "utf-8");
    }
  } else if (args.task) {
    if (sources.length > 1) checkAmbiguous(args.task, sources);
    for (const src of sources) {
      const data = JSON.parse(fs.readFileSync(src.taskListPath, "utf-8"));
      const t = (data.tasks || []).find(x => x.id === args.task);
      if (!t) continue;
      normalizeTaskPhase(t);
      if (args.phase) {
        t.phase[args.phase] = args.phase === "dev" ? "pending" : "-";
        resetIds = [t.id];
      } else {
        t.phase = { ...initialPhase };
        resetIds = [t.id];
      }
      fs.writeFileSync(src.taskListPath, JSON.stringify(data, null, 2), "utf-8");
      break;
    }
    if (resetIds.length === 0) {
      console.error(`[ERROR] 任务不存在: ${args.task}`);
      process.exit(1);
    }
  }

  console.log(JSON.stringify({
    status: "ok",
    reset: resetIds,
    phase: args.phase || "all"
  }, null, 2));
}

// === status ===
function cmdStatus(sources) {
  const tasks = loadAllTasks(sources);
  let completed = 0, blocked = 0, remaining = 0;

  const items = tasks.map(t => {
    const avail = isAvailable(t, tasks, "dev", false);
    const done = t.phase.dev === "done";
    const blockedBy = !avail && !done
      ? (t.dependencies || []).filter(depId => {
          const dep = resolveDep(depId, tasks, getIteration(t));
          return !dep || dep.phase.dev !== "done";
        })
      : [];

    if (done) completed++;
    else if (blockedBy.length > 0) blocked++;
    else remaining++;

    return {
      id: t.id,
      role: t.role,
      name: t.name,
      dependencies: t.dependencies || [],
      phase: t.phase,
      available: avail,
      blockedBy
    };
  });

  console.log(JSON.stringify({
    status: "ok",
    iterations: sources.map(s => s.iteration),
    tasks: items,
    summary: { total: tasks.length, completed, remaining, blocked }
  }, null, 2));
}

// === init: 创建 task-list.json（供 breakdown-tasks 使用）===
function cmdInit(args) {
  const base = process.env.JLC_AI_WORKSPACE;
  if (!base) {
    console.error("[ERROR] 环境变量 JLC_AI_WORKSPACE 未设置");
    process.exit(1);
  }

  // 读取 JSON: --file 或 stdin
  let raw;
  if (args.inputFile) {
    if (!fs.existsSync(args.inputFile)) {
      console.error(`[ERROR] 文件不存在: ${args.inputFile}`);
      process.exit(1);
    }
    raw = fs.readFileSync(args.inputFile, "utf-8");
  } else {
    raw = fs.readFileSync(0, "utf-8");
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("[ERROR] JSON 解析失败:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(data.tasks)) {
    console.error("[ERROR] JSON 必须包含 tasks 数组");
    process.exit(1);
  }

  // schema 校验：每个 task 必须有 phase 字段
  const PHASE_REQUIRED = ["dev", "selfTest"];
  for (const t of data.tasks) {
    if (!t.phase) {
      const hint = t.status ? `（检测到 status 字段，应改为 phase）` : "";
      console.error(`[ERROR] 任务 ${t.id || "(未知)"} 缺少 phase 字段${hint}`);
      process.exit(1);
    }
    for (const key of PHASE_REQUIRED) {
      if (!(key in t.phase)) {
        console.error(`[ERROR] 任务 ${t.id} 的 phase 缺少 ${key} 字段`);
        process.exit(1);
      }
    }
  }

  // 确保 iteration 字段一致
  if (!data.iteration) data.iteration = args.it;

  const tasksDir = path.join(base, "process-docs", args.req, "tasks", args.it);
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  const target = path.join(tasksDir, "task-list.json");
  fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf-8");

  console.log(JSON.stringify({
    status: "ok",
    iteration: args.it,
    taskCount: data.tasks.length,
    path: target
  }, null, 2));
}

// === add: 追加新任务到指定迭代的 task-list.json ===
function cmdAdd(args) {
  const base = process.env.JLC_AI_WORKSPACE;
  if (!base) {
    console.error("[ERROR] 环境变量 JLC_AI_WORKSPACE 未设置");
    process.exit(1);
  }

  // 解析新任务 JSON：--task 或 --file 或 stdin
  let raw;
  if (args.inputFile) {
    if (!fs.existsSync(args.inputFile)) {
      console.error(`[ERROR] 文件不存在: ${args.inputFile}`);
      process.exit(1);
    }
    raw = fs.readFileSync(args.inputFile, "utf-8");
  } else if (args.addTaskJson) {
    raw = args.addTaskJson;
  } else {
    raw = fs.readFileSync(0, "utf-8");
  }

  let newTasks;
  try {
    const parsed = JSON.parse(raw);
    newTasks = Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error("[ERROR] 任务 JSON 解析失败:", e.message);
    process.exit(1);
  }

  // 校验每条任务的基本字段
  for (const t of newTasks) {
    if (!t.id) {
      console.error("[ERROR] 任务缺少 id 字段");
      process.exit(1);
    }
    if (!t.phase) {
      console.error(`[ERROR] 任务 ${t.id} 缺少 phase 字段`);
      process.exit(1);
    }
  }

  // 定位目标 task-list.json
  const taskListPath = path.join(base, "process-docs", args.req, "tasks", args.it, "task-list.json");
  if (!fs.existsSync(taskListPath)) {
    console.error(`[ERROR] task-list.json 不存在: ${taskListPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(taskListPath, "utf-8"));
  const existingTasks = data.tasks || [];

  // ID 唯一性检查
  const existingIds = new Set(existingTasks.map(t => t.id));
  for (const t of newTasks) {
    if (existingIds.has(t.id)) {
      console.error(`[ERROR] 任务 ID ${t.id} 已存在`);
      process.exit(1);
    }
  }

  // 记录已有任务的 phase 快照（防篡改）
  const phaseSnapshot = new Map();
  for (const t of existingTasks) {
    phaseSnapshot.set(t.id, JSON.stringify(t.phase));
  }

  // 计算 seq
  const maxSeq = existingTasks.reduce((max, t) => Math.max(max, t.seq || 0), 0);
  newTasks.forEach((t, i) => {
    if (!t.seq) t.seq = maxSeq + i + 1;
  });

  // 追加
  data.tasks = [...existingTasks, ...newTasks];

  // 更新 summary
  if (data.summary) {
    const roleCounts = {};
    for (const t of data.tasks) {
      const r = t.role || "unknown";
      roleCounts[r] = (roleCounts[r] || 0) + 1;
    }
    data.summary = {
      total: data.tasks.length,
      ...roleCounts,
    };
  }

  // 更新 updatedAt
  data.updatedAt = new Date().toISOString().split("T")[0];

  // 写入
  fs.writeFileSync(taskListPath, JSON.stringify(data, null, 2), "utf-8");

  // 验证：确认已有任务的 phase 未被修改
  const written = JSON.parse(fs.readFileSync(taskListPath, "utf-8"));
  for (const t of written.tasks) {
    if (phaseSnapshot.has(t.id)) {
      if (JSON.stringify(t.phase) !== phaseSnapshot.get(t.id)) {
        console.error(`[ERROR] 已有任务 ${t.id} 的 phase 被意外修改，已回滚`);
        // 回滚
        data.tasks = existingTasks;
        fs.writeFileSync(taskListPath, JSON.stringify(data, null, 2), "utf-8");
        process.exit(1);
      }
    }
  }

  console.log(JSON.stringify({
    status: "ok",
    iteration: args.it,
    added: newTasks.map(t => ({ id: t.id, seq: t.seq, role: t.role || "" })),
    totalTasks: written.tasks.length,
    path: taskListPath
  }, null, 2));
}

// === main ===
function main() {
  const args = parseArgs();
  if (args.cmd === "init") { cmdInit(args); return; }
  if (args.cmd === "add") { cmdAdd(args); return; }

  const sources = findAllTaskLists(args.req, args.it);

  switch (args.cmd) {
    case "get":    cmdGet(args, sources); break;
    case "update": cmdUpdate(args, sources); break;
    case "reset":  cmdReset(args, sources); break;
    case "status": cmdStatus(sources); break;
  }
}

main();
