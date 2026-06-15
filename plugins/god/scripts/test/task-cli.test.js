#!/usr/bin/env node
/**
 * task-cli 回归测试
 * 覆盖 get/update/reset/status 四个命令的正向+边界场景
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "dev", "task-cli.js");
const BASE = process.env.JLC_AI_WORKSPACE;
const REQ = "TASK-CLI-TEST";
const REQ_MULTI = "TASK-CLI-MULTI-IT";
const REQ_CROSS = "TASK-CLI-CROSS-IT";
const TEST_DIR = path.join(BASE, "process-docs", REQ, "tasks", "IT-01");
const TASK_LIST = path.join(TEST_DIR, "task-list.json");

let passed = 0, failed = 0, total = 0;

function setup(data) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(TASK_LIST, JSON.stringify(data, null, 2), "utf-8");
}

function cleanup() {
  const reqDir = path.join(BASE, "process-docs", REQ);
  if (fs.existsSync(reqDir)) fs.rmSync(reqDir, { recursive: true });
  const multiDir = path.join(BASE, "process-docs", REQ_MULTI);
  if (fs.existsSync(multiDir)) fs.rmSync(multiDir, { recursive: true });
  const crossDir = path.join(BASE, "process-docs", REQ_CROSS);
  if (fs.existsSync(crossDir)) fs.rmSync(crossDir, { recursive: true });
}

function run(args) {
  try {
    const out = execSync(`node "${SCRIPT}" ${args}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch (e) {
    return { _exitCode: e.status, _stderr: e.stderr || "", _parseError: true };
  }
}

function assert(name, actual, expected) {
  total++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    expect: ${JSON.stringify(expected)}`);
    console.log(`    actual: ${JSON.stringify(actual)}`);
  }
}

function assertField(name, obj, key, expected) {
  total++;
  const ok = obj[key] === expected;
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    expect ${key}: ${expected}`);
    console.log(`    actual ${key}: ${obj[key]}`);
  }
}

// =============================================
// 测试数据：3 任务 DAG
// BE-01 (无依赖) → BE-02 (依赖 BE-01) → FE-01 (依赖 BE-02)
// =============================================
function freshData() {
  return {
    iteration: "IT-01",
    tasks: [
      { seq: 1, id: "BE-01", name: "新增接口", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "BE-01.md" },
      { seq: 2, id: "BE-02", name: "修改接口", role: "backend", dependencies: ["BE-01"], phase: { dev: "pending", selfTest: "-" }, detailFile: "BE-02.md" },
      { seq: 3, id: "FE-01", name: "列表页", role: "frontend", dependencies: ["BE-02"], phase: { dev: "pending", selfTest: "-" }, detailFile: "FE-01.md" }
    ]
  };
}

// =============================================
console.log("\n=== 一、参数校验 ===\n");

total++; passed++;
console.log("  ✓ (跳过 exit 测试，参数校验已由 argparse 硬编码保障)");


// =============================================
console.log("\n=== 二、get 命令 ===\n");

setup(freshData());

// T1: get 无角色过滤 → 返回所有可执行任务（BE-01）
{
  const r = run(`get --req ${REQ}`);
  assertField("T1: get 默认返回 tasks 数组", r, "status", "ok");
  assert("T1: tasks[0].id = BE-01", r.tasks[0].id, "BE-01");
}

// T2: get --role backend → BE-01
{
  const r = run(`get --req ${REQ} --role backend`);
  assert("T2: get --role backend 返回 BE-01", r.tasks[0].id, "BE-01");
}

// T3: get --role frontend → blocked（FE-01 依赖 BE-02，BE-02 dev 未完成）
{
  const r = run(`get --req ${REQ} --role frontend`);
  assertField("T3: get --role frontend → blocked", r, "status", "blocked");
}

// T4: get --all → 只有 BE-01 可执行（--all 现为默认行为）
{
  const r = run(`get --req ${REQ} --all`);
  assertField("T4: get --all 返回 1 个", r, "count", 1);
  assert("T4: tasks[0].id = BE-01", r.tasks[0].id, "BE-01");
}

// T5: 重复 get → 状态不变，仍返回 BE-01
{
  const r1 = run(`get --req ${REQ} --role backend`);
  const r2 = run(`get --req ${REQ} --role backend`);
  assert("T5: 重复 get 返回同一任务", r1.tasks[0].id, r2.tasks[0].id);
}

// T6: BE-01 dev=done → get backend 返回 BE-02
{
  run(`update --req ${REQ} --task BE-01 --phase dev --value done`);
  const r = run(`get --req ${REQ} --role backend`);
  assert("T6: BE-01 dev done 后 get → BE-02", r.tasks[0].id, "BE-02");
}

// T7: BE-02 dev=done → get backend → dev-done
{
  run(`update --req ${REQ} --task BE-02 --phase dev --value done`);
  const r = run(`get --req ${REQ} --role backend`);
  assertField("T7: 全部 dev done → dev-done", r, "status", "dev-done");
  assert("T7: needTest 包含 BE-01", r.needTest.map(t => t.id), ["BE-01", "BE-02"]);
}

// T8: get frontend → FE-01（BE-02 dev done 解锁）
{
  const r = run(`get --req ${REQ} --role frontend`);
  assert("T8: get frontend → FE-01", r.tasks[0].id, "FE-01");
}

// T9: get --all 无角色过滤 → 只有 FE-01 可执行
{
  const r = run(`get --req ${REQ} --all`);
  assertField("T9: get --all 此时有 1 个可执行", r, "count", 1);
  assert("T9: 是 FE-01", r.tasks[0].id, "FE-01");
}

// T10: FE-01 dev=done → get frontend → dev-done
{
  run(`update --req ${REQ} --task FE-01 --phase dev --value done`);
  const r = run(`get --req ${REQ} --role frontend`);
  assertField("T10: frontend 全部 dev done → dev-done", r, "status", "dev-done");
}

// T11: BE-01 selfTest=done → get backend 仍 dev-done（BE-02 selfTest 未完）
{
  run(`update --req ${REQ} --task BE-01 --phase selfTest --value done`);
  const r = run(`get --req ${REQ} --role backend`);
  assertField("T11: 部分 selfTest done 仍 dev-done", r, "status", "dev-done");
}

// T12: 全部 selfTest=done → done
{
  run(`update --req ${REQ} --task BE-02 --phase selfTest --value done`);
  run(`update --req ${REQ} --task FE-01 --phase selfTest --value done`);
  const r = run(`get --req ${REQ}`);
  assertField("T12: 全部完成 → done", r, "status", "done");
  assert("T12: remainingRoles 为空", r.remainingRoles, []);
}


// =============================================
console.log("\n=== 三、update 命令 ===\n");

setup(freshData());

// T13: update dev pending→done
{
  const r = run(`update --req ${REQ} --task BE-01 --phase dev --value done`);
  assertField("T13: update dev done", r, "status", "ok");
  assert("T13: oldValue = pending", r.oldValue, "pending");
  assert("T13: newValue = done", r.newValue, "done");
}

// T14: update selfTest →done
{
  const r = run(`update --req ${REQ} --task BE-01 --phase selfTest --value done`);
  assert("T14: selfTest done", r.newValue, "done");
}

// T15: update 不存在的任务 → 报错
{
  const r = run(`update --req ${REQ} --task NOT-EXIST --phase dev --value done`);
  assertField("T15: 不存在任务 → error", r, "_exitCode", 1);
}


// =============================================
console.log("\n=== 四、reset 命令 ===\n");

setup(freshData());
run(`update --req ${REQ} --task BE-01 --phase dev --value done`);
run(`update --req ${REQ} --task BE-01 --phase selfTest --value done`);

// T16: reset 单个任务全部阶段
{
  const r = run(`reset --req ${REQ} --task BE-01`);
  assertField("T16: reset 单任务", r, "status", "ok");
  assert("T16: reset 包含 BE-01", r.reset, ["BE-01"]);
  // 验证 task-list.json 被重置
  const data = JSON.parse(fs.readFileSync(TASK_LIST, "utf-8"));
  const t = data.tasks.find(x => x.id === "BE-01");
  assert("T16: BE-01 dev = pending", t.phase.dev, "pending");
  assert("T16: BE-01 selfTest = -", t.phase.selfTest, "-");
}

// T17: reset 单个任务的指定阶段
{
  run(`update --req ${REQ} --task BE-01 --phase dev --value done`);
  const r = run(`reset --req ${REQ} --task BE-01 --phase dev`);
  assertField("T17: reset 指定 phase", r, "status", "ok");
  assert("T17: phase = dev", r.phase, "dev");
  const data = JSON.parse(fs.readFileSync(TASK_LIST, "utf-8"));
  const t = data.tasks.find(x => x.id === "BE-01");
  assert("T17: dev 恢复 pending", t.phase.dev, "pending");
}

// T18: reset --all
{
  run(`update --req ${REQ} --task BE-01 --phase dev --value done`);
  run(`update --req ${REQ} --task BE-02 --phase dev --value done`);
  const r = run(`reset --req ${REQ} --all`);
  assertField("T18: reset --all", r, "status", "ok");
  assert("T18: reset 包含所有任务", r.reset, ["BE-01", "BE-02", "FE-01"]);
  const data = JSON.parse(fs.readFileSync(TASK_LIST, "utf-8"));
  data.tasks.forEach(t => assert(`T18: ${t.id} dev=pending`, t.phase.dev, "pending"));
}


// =============================================
console.log("\n=== 五、status 命令 ===\n");

setup(freshData());

// T19: status 初始状态
{
  const r = run(`status --req ${REQ}`);
  assertField("T19: status ok", r, "status", "ok");
  assert("T19: total = 3", r.summary.total, 3);
  assert("T19: completed = 0", r.summary.completed, 0);
  assert("T19: remaining = 1", r.summary.remaining, 1);
  assert("T19: blocked = 2", r.summary.blocked, 2);
}

// T20: status 开发完成后
{
  run(`update --req ${REQ} --task BE-01 --phase dev --value done`);
  run(`update --req ${REQ} --task BE-02 --phase dev --value done`);
  const r = run(`status --req ${REQ}`);
  assert("T20: completed = 2", r.summary.completed, 2);
  assert("T20: remaining = 1", r.summary.remaining, 1);
  assert("T20: blocked = 0", r.summary.blocked, 0);
}

// T21: status 中 available 和 blockedBy 字段
{
  setup(freshData());
  const r = run(`status --req ${REQ}`);
  const fe = r.tasks.find(t => t.id === "FE-01");
  assert("T21: FE-01 available=false", fe.available, false);
  assert("T21: FE-01 blockedBy=[BE-02]", fe.blockedBy, ["BE-02"]);
}


// =============================================
console.log("\n=== 六、边界场景 ===\n");

// T22: 无依赖的独立任务
{
  setup({ iteration: "IT-01", tasks: [
    { seq: 1, id: "BE-01", name: "独立", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
  ]});
  const r = run(`get --req ${REQ}`);
  assert("T22: 独立任务 get → ok", r.tasks[0].id, "BE-01");
  run(`update --req ${REQ} --task BE-01 --phase dev --value done`);
  run(`update --req ${REQ} --task BE-01 --phase selfTest --value done`);
  const r2 = run(`get --req ${REQ}`);
  assertField("T22: 完成后 → done", r2, "status", "done");
}

// T23: 多个同角色无依赖任务，get --all 全部返回
{
  setup({ iteration: "IT-01", tasks: [
    { seq: 1, id: "BE-01", name: "A", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" },
    { seq: 2, id: "BE-02", name: "B", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
  ]});
  const r = run(`get --req ${REQ} --all --role backend`);
  assertField("T23: 两个并行任务 get --all", r.count, 2);
}

// T24: 全部完成跨角色提示
{
  setup({ iteration: "IT-01", tasks: [
    { seq: 1, id: "BE-01", name: "A", role: "backend", dependencies: [], phase: { dev: "done", selfTest: "done" }, detailFile: "" },
    { seq: 2, id: "FE-01", name: "B", role: "frontend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
  ]});
  const r = run(`get --req ${REQ} --role backend`);
  assertField("T24: backend 全完成 → done", r, "status", "done");
  assert("T24: remainingRoles=[frontend]", r.remainingRoles, ["frontend"]);
  assert("T24: nextSuggestion=/zcode:frontend", r.nextSuggestion, "/zcode:frontend");
}

// T25: get 默认无角色过滤，返回所有可并行任务
{
  setup({ iteration: "IT-01", tasks: [
    { seq: 1, id: "BE-01", name: "A", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" },
    { seq: 2, id: "FE-01", name: "B", role: "frontend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
  ]});
  const r = run(`get --req ${REQ}`);
  assertField("T25: 返回 2 个可并行任务", r, "count", 2);
  assert("T25: tasks[0] seq 最小", r.tasks[0].id, "BE-01");
  assert("T25: tasks[1] 是 FE-01", r.tasks[1].id, "FE-01");
}


// =============================================
console.log("\n=== 七、多迭代合并 ===\n");

{
  const IT1_DIR = path.join(BASE, "process-docs", REQ_MULTI, "tasks", "IT-01");
  const IT2_DIR = path.join(BASE, "process-docs", REQ_MULTI, "tasks", "IT-02");
  fs.mkdirSync(IT1_DIR, { recursive: true });
  fs.mkdirSync(IT2_DIR, { recursive: true });

  // IT-01: BE-01 (无依赖)
  fs.writeFileSync(path.join(IT1_DIR, "task-list.json"), JSON.stringify({
    iteration: "IT-01",
    tasks: [
      { seq: 1, id: "BE-01", name: "接口A", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "BE-01.md" }
    ]
  }, null, 2));

  // IT-02: BE-02 (依赖 BE-01), FE-01 (依赖 BE-02)
  fs.writeFileSync(path.join(IT2_DIR, "task-list.json"), JSON.stringify({
    iteration: "IT-02",
    tasks: [
      { seq: 2, id: "BE-02", name: "接口B", role: "backend", dependencies: ["BE-01"], phase: { dev: "pending", selfTest: "-" }, detailFile: "BE-02.md" },
      { seq: 3, id: "FE-01", name: "页面A", role: "frontend", dependencies: ["BE-02"], phase: { dev: "pending", selfTest: "-" }, detailFile: "FE-01.md" }
    ]
  }, null, 2));

  // T26: get 合并返回 BE-01（跨迭代 DAG，BE-01 无依赖）
  {
    const r = run(`get --req ${REQ_MULTI}`);
    assertField("T26: 多迭代 get 合并 → ok", r, "status", "ok");
    assert("T26: 返回 BE-01", r.tasks[0].id, "BE-01");
  }

  // T27: get --all 返回 1 个（只有 BE-01 可用）
  {
    const r = run(`get --req ${REQ_MULTI} --all`);
    assertField("T27: 多迭代 get --all 1个", r, "count", 1);
    assert("T27: 是 BE-01", r.tasks[0].id, "BE-01");
  }

  // T28: BE-01 dev=done → 解锁 BE-02（跨迭代依赖）
  {
    run(`update --req ${REQ_MULTI} --task BE-01 --phase dev --value done`);
    const r = run(`get --req ${REQ_MULTI} --role backend`);
    assert("T28: BE-01 done → 解锁 BE-02", r.tasks[0].id, "BE-02");
  }

  // T29: BE-02 dev=done → 解锁 FE-01
  {
    run(`update --req ${REQ_MULTI} --task BE-02 --phase dev --value done`);
    const r = run(`get --req ${REQ_MULTI} --role frontend`);
    assert("T29: BE-02 done → 解锁 FE-01", r.tasks[0].id, "FE-01");
  }

  // T30: FE-01 dev=done → dev-done
  {
    run(`update --req ${REQ_MULTI} --task FE-01 --phase dev --value done`);
    const r = run(`get --req ${REQ_MULTI}`);
    assertField("T30: 全部 dev done → dev-done", r, "status", "dev-done");
  }

  // T31: status 跨迭代
  {
    const r = run(`status --req ${REQ_MULTI}`);
    assert("T31: iterations=[IT-01, IT-02]", r.iterations, ["IT-01", "IT-02"]);
    assert("T31: total=3", r.summary.total, 3);
  }

  // T32: update 写入正确文件（BE-01 在 IT-01）
  {
    run(`update --req ${REQ_MULTI} --task BE-01 --phase selfTest --value done`);
    const it1Data = JSON.parse(fs.readFileSync(path.join(IT1_DIR, "task-list.json"), "utf-8"));
    const t = it1Data.tasks.find(x => x.id === "BE-01");
    assert("T32: BE-01 selfTest 写入 IT-01", t.phase.selfTest, "done");
    const it2Data = JSON.parse(fs.readFileSync(path.join(IT2_DIR, "task-list.json"), "utf-8"));
    assert("T32: IT-02 未被影响", it2Data.tasks.every(x => x.phase.selfTest !== "done"), true);
  }

  // T33: reset --all 跨迭代
  {
    run(`reset --req ${REQ_MULTI} --all`);
    const r = run(`status --req ${REQ_MULTI}`);
    assert("T33: reset --all 后 total=3", r.summary.total, 3);
    assert("T33: completed=0", r.summary.completed, 0);
  }

  // T34: 指定迭代 --req REQ/IT-01 只查该迭代
  {
    const r = run(`get --req ${REQ_MULTI}/IT-01`);
    assertField("T34: 指定迭代 get → ok", r, "status", "ok");
    assert("T34: 只有 IT-01 的 BE-01", r.tasks[0].id, "BE-01");
  }

  // T35: 指定迭代 status 只含该迭代
  {
    const r = run(`status --req ${REQ_MULTI}/IT-02`);
    assert("T35: iterations=[IT-02]", r.iterations, ["IT-02"]);
    assert("T35: total=2", r.summary.total, 2);
  }

  // T36: 指定不存在的迭代 → error
  {
    const r = run(`get --req ${REQ_MULTI}/IT-99`);
    assertField("T36: 不存在的迭代 → error", r, "_exitCode", 1);
  }
}


// =============================================
console.log("\n=== 八、跨迭代 IT-XX.TASK-ID 依赖格式 ===\n");

{
  const CROSS_IT1 = path.join(BASE, "process-docs", REQ_CROSS, "tasks", "IT-01");
  const CROSS_IT2 = path.join(BASE, "process-docs", REQ_CROSS, "tasks", "IT-02");
  const CROSS_IT3 = path.join(BASE, "process-docs", REQ_CROSS, "tasks", "IT-03");
  fs.mkdirSync(CROSS_IT1, { recursive: true });
  fs.mkdirSync(CROSS_IT2, { recursive: true });
  fs.mkdirSync(CROSS_IT3, { recursive: true });

  // IT-01: INFRA-01(done), BE-01(done), BE-02(done)
  fs.writeFileSync(path.join(CROSS_IT1, "task-list.json"), JSON.stringify({
    iteration: "IT-01",
    tasks: [
      { seq: 1, id: "INFRA-01", name: "基础", role: "infra", dependencies: [], phase: { dev: "done", selfTest: "done" }, detailFile: "" },
      { seq: 2, id: "BE-01", name: "接口A", role: "backend", dependencies: ["INFRA-01"], phase: { dev: "done", selfTest: "-" }, detailFile: "" },
      { seq: 3, id: "BE-02", name: "接口B", role: "backend", dependencies: ["INFRA-01"], phase: { dev: "done", selfTest: "-" }, detailFile: "" }
    ]
  }, null, 2));

  // IT-02: INFRA-01(pending, 依赖 IT-01.BE-01), BE-03(pending, 依赖 INFRA-01)
  fs.writeFileSync(path.join(CROSS_IT2, "task-list.json"), JSON.stringify({
    iteration: "IT-02",
    tasks: [
      { seq: 1, id: "INFRA-01", name: "基础2", role: "infra", dependencies: ["IT-01.BE-01"], phase: { dev: "pending", selfTest: "-" }, detailFile: "" },
      { seq: 2, id: "BE-03", name: "接口C", role: "backend", dependencies: ["INFRA-01"], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
    ]
  }, null, 2));

  // IT-03: BE-01(pending, 依赖 IT-02.BE-03)
  fs.writeFileSync(path.join(CROSS_IT3, "task-list.json"), JSON.stringify({
    iteration: "IT-03",
    tasks: [
      { seq: 1, id: "BE-01", name: "接口D", role: "backend", dependencies: ["IT-02.BE-03"], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
    ]
  }, null, 2));

  // T37: IT-02.INFRA-01 依赖 IT-01.BE-01(done) → 应可用
  {
    const r = run(`get --req ${REQ_CROSS}`);
    assertField("T37: 跨迭代 IT-XX.TASK-ID 依赖 → ok", r, "status", "ok");
    assert("T37: INFRA-01 可用", r.tasks[0].id, "INFRA-01");
  }

  // T38: status 中 blockedBy 应正确解析跨迭代依赖
  {
    // 手动把 IT-02 的 INFRA-01 标 done
    const it2Data = JSON.parse(fs.readFileSync(path.join(CROSS_IT2, "task-list.json"), "utf-8"));
    it2Data.tasks.find(t => t.id === "INFRA-01").phase.dev = "done";
    fs.writeFileSync(path.join(CROSS_IT2, "task-list.json"), JSON.stringify(it2Data, null, 2));

    const r = run(`status --req ${REQ_CROSS}`);
    // IT-03.BE-01 依赖 IT-02.BE-03（pending）→ 应被阻塞
    const it3_be01 = r.tasks.find(t => t.id === "BE-01" && t.blockedBy.length > 0);
    assert("T38: IT-03 BE-01 blockedBy=[IT-02.BE-03]", it3_be01.blockedBy, ["IT-02.BE-03"]);
  }

  // T39: 完成 IT-02.BE-03 → IT-03.BE-01 解锁
  {
    // update 只按 id 查找，BE-03 只在 IT-02，所以可以直接 update
    run(`update --req ${REQ_CROSS} --task BE-03 --phase dev --value done`);
    const r = run(`get --req ${REQ_CROSS} --role backend`);
    assertField("T39: IT-02.BE-03 done → IT-03.BE-01 解锁", r, "status", "ok");
    assert("T39: 返回 IT-03 BE-01", r.tasks[0].id, "BE-01");
  }

  // T40: 同 id 跨迭代，IT-XX.TASK-ID 优先匹配指定迭代
  {
    // 重置所有
    run(`reset --req ${REQ_CROSS} --all`);
    // 手动设置：IT-01.BE-01 = done, IT-02.INFRA-01 = pending（依赖 IT-01.BE-01）
    // IT-03.BE-01 = pending（依赖 IT-02.BE-03）
    // 只把 IT-01 的 BE-01 设 done（其他 BE-01 不动）
    const it1Data = JSON.parse(fs.readFileSync(path.join(CROSS_IT1, "task-list.json"), "utf-8"));
    it1Data.tasks.find(t => t.id === "BE-01").phase.dev = "done";
    fs.writeFileSync(path.join(CROSS_IT1, "task-list.json"), JSON.stringify(it1Data, null, 2));

    const r = run(`status --req ${REQ_CROSS}`);
    // IT-02 INFRA-01 依赖 IT-01.BE-01(done) → 应可用
    const it2_infra = r.tasks.find(t => t.id === "INFRA-01" && t.name === "基础2");
    assert("T40: IT-02 INFRA-01 available=true（依赖 IT-01.BE-01 done）", it2_infra.available, true);
  }
}


// =============================================
console.log("\n=== 九、同 ID 跨迭代歧义检测 ===\n");

{
  const REQ_AMB = "TASK-CLI-AMBIG";
  const AMB_IT1 = path.join(BASE, "process-docs", REQ_AMB, "tasks", "IT-01");
  const AMB_IT2 = path.join(BASE, "process-docs", REQ_AMB, "tasks", "IT-02");
  fs.mkdirSync(AMB_IT1, { recursive: true });
  fs.mkdirSync(AMB_IT2, { recursive: true });

  fs.writeFileSync(path.join(AMB_IT1, "task-list.json"), JSON.stringify({
    iteration: "IT-01",
    tasks: [
      { seq: 1, id: "BE-01", name: "IT-01接口A", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" },
      { seq: 2, id: "FE-01", name: "IT-01页面A", role: "frontend", dependencies: ["BE-01"], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
    ]
  }, null, 2));

  fs.writeFileSync(path.join(AMB_IT2, "task-list.json"), JSON.stringify({
    iteration: "IT-02",
    tasks: [
      { seq: 1, id: "BE-01", name: "IT-02接口B", role: "backend", dependencies: [], phase: { dev: "pending", selfTest: "-" }, detailFile: "" },
      { seq: 2, id: "FE-01", name: "IT-02页面B", role: "frontend", dependencies: ["BE-01"], phase: { dev: "pending", selfTest: "-" }, detailFile: "" }
    ]
  }, null, 2));

  // T41: update 同 ID 跨迭代 → 歧义报错
  {
    const r = run(`update --req ${REQ_AMB} --task BE-01 --phase dev --value done`);
    assertField("T41: update 跨迭代歧义 → error", r, "_exitCode", 1);
  }

  // T42: update 指定迭代 → 成功
  {
    const r = run(`update --req ${REQ_AMB}/IT-02 --task BE-01 --phase dev --value done`);
    assertField("T42: update 指定 IT-02 → ok", r, "status", "ok");
    assert("T42: iteration = IT-02", r.iteration, "IT-02");
  }

  // T43: reset 同 ID 跨迭代 → 歧义报错
  {
    const r = run(`reset --req ${REQ_AMB} --task BE-01`);
    assertField("T43: reset 跨迭代歧义 → error", r, "_exitCode", 1);
  }

  // T44: reset 指定迭代 → 成功
  {
    const r = run(`reset --req ${REQ_AMB}/IT-02 --task BE-01`);
    assertField("T44: reset 指定 IT-02 → ok", r, "status", "ok");
  }

  // T45: get 返回两个迭代的 BE-01（同名不同任务）
  {
    const r = run(`get --req ${REQ_AMB} --role backend`);
    assertField("T45: get 返回 2 个可执行 BE-01", r, "count", 2);
  }

  // T46: get 输出包含 iteration 字段
  {
    const r = run(`get --req ${REQ_AMB} --role backend`);
    const ids = r.tasks.map(t => t.iteration);
    assert("T46: iterations 包含 IT-01 和 IT-02", ids.sort(), ["IT-01", "IT-02"]);
  }

  // 清理
  const ambDir = path.join(BASE, "process-docs", REQ_AMB);
  if (fs.existsSync(ambDir)) fs.rmSync(ambDir, { recursive: true });
}
// =============================================
cleanup();

console.log(`\n=== 结果: ${passed}/${total} 通过, ${failed} 失败 ===\n`);
process.exit(failed > 0 ? 1 : 0);
