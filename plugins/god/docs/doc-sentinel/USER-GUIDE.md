---
type: runbook
status: stable
owner: god 维护组
last_reviewed: 2026-06-17
update_rule: pr-required
related: [../../CLAUDE.md, ../../commands/doc-sentinel.md]
---

# doc-sentinel 用户指南

> god 插件 v0.7.2+ 后台文档巡检 agent — **CC CronCreate 调度（durable=true）**，范围限定在**当前项目根**。

---

## 0. 这是什么

doc-sentinel 是 god 插件的**维护期外骨骼**——后台自动巡检项目文档健康度，按 SKILL.md 决策树 auto-fix + git commit（不 push）。

**关键设计**：

- **默认关闭** —— god 插件安装时**不自动激活**，用户在项目里**主动 on** 才生效
- **范围 = 单项目** —— `.god/doc-sentinel.json` 写在项目根，**不污染用户全局**
- **调度 = CC CronCreate（durable=true）** —— 任务到点时 CC 把 prompt 入队到当前 session 队列，agent 自然处理；session 死掉任务不丢，新 session 自动激活
- **不依赖任何 hook** —— v0.7.2 起彻底移除 SessionStart 钩子依赖（含 v0.7.0/v0.7.1 残留的兜底清理）；也不调 `claude -p` 脱机子进程
- **可关闭** —— `/god:doc-sentinel off` 调 CC `CronDelete` 删任务，config 保留 audit

---

## 1. 快速开始

### 1.1 启用（在项目内）

```bash
cd <你的项目>          # 任意含 .git 或 package.json 的项目根
/god:doc-sentinel on
```

执行：

1. 写 `<项目根>/.god/doc-sentinel.json`（默认配置）
2. 清理 v0.7.0/v0.7.1 残留的 SessionStart doc-sentinel 钩子（如有，保留其他钩子）
3. 创建 `<项目根>/docs/doc-sentinel/runs/` 目录
4. 调 `node scripts/doc-sentinel/cron.js on ${N}` 拿 cron 表达式 + prompt
5. 调 CC `CronCreate`（cron 表达式 + durable=true + prompt）
6. 把返回的 cron id 写回 `.god/doc-sentinel.json.cronId`
7. 输出"已启用 + cronId + 下次 ~HH:MM"

**可选频率**：`on 60`（60 分钟）、`on 5`（5 分钟，最小）、`on 1440`（24 小时，最大）。默认 30 分钟。

**之后**：cron 任务到点 → CC 把 prompt 入队当前 session → agent 加载 doc-sentinel skill → 跑 check-facade.js → 写 runs/。

### 1.2 关闭

```bash
/god:doc-sentinel off
```

执行：

1. 调 CC `CronList` 找 doc-sentinel 任务的 id
2. 调 CC `CronDelete` 删任务
3. 标记 `.god/doc-sentinel.json` `enabled: false`（**保留**，作 audit）+ 清 `cronId` 字段
4. 兜底再清一次 SessionStart 钩子（如有残留）
5. runs/ 历史**保留**

### 1.3 看状态

```bash
/god:doc-sentinel status
```

输出：

```
doc-sentinel 状态
────────────────────────────────────────
cwd:       /Users/me/projects/myapp
项目根:    ✓
config:    /Users/me/projects/myapp/.god/doc-sentinel.json
启用:      ✓ yes
范围:      project
模式:      auto-commit
schedule:  cron
checks:    V1, N1, D1, F1, T1, P1, G1, C1, M1
cron:      ✓ 已注册
  id:      abc123
  expr:    7,37 * * * *
  源:      /Users/me/projects/myapp/.claude/scheduled_tasks.json

上次跑:    2026-06-17T10:17:23
上次结果:  7 ok / 2 warn / 0 fail / 1 auto-fixed
```

### 1.4 查看 finding

```bash
/god:doc-sentinel review
```

加载 doc-sentinel skill，解读最近一次 reports/，让用户决定：

- 输入 `fix all` → 批量 auto-fix + commit
- 输入 `fix <ID>` → 修指定 check 的 finding
- 输入 `skip` → 跳过

---

## 2. 配置文件 schema

`<项目根>/.god/doc-sentinel.json`：

```json
{
  "enabled": true,                // 总开关
  "scope": "project",             // 范围（project | god）
  "mode": "auto-commit",          // 模式（auto-commit | pr | report-only）
  "schedule": "cron",             // 触发方式（v0.7.2+ 固定为 cron）
  "cronId": "abc123",             // CC CronCreate 返回的任务 ID（off 时清空）
  "checks": {                     // 9 类 check 独立开关
    "V1": true, "N1": true, "D1": true, "F1": true, "T1": true,
    "P1": true, "G1": true, "C1": true, "M1": true
  }
}
```

| 字段 | 含义 | 默认 |
|---|---|---|
| `enabled` | 总开关 | `true`（on 时） |
| `scope` | 范围 | `project` |
| `mode` | 修复模式 | `auto-commit`（直接 commit）/ `pr`（开 PR）/ `report-only`（只报告）|
| `schedule` | 触发方式 | `cron`（CC CronCreate）|
| `cronId` | CC cron 任务 ID | `null`（on 时写入）|
| `checks` | 9 类 check 独立开关 | 全部 `true` |

**修改**：

```bash
# 关闭 T1 stale TODO（设计意图误判多）
cat > /tmp/cfg.json <<EOF
{
  "enabled": true,
  "scope": "project",
  "mode": "auto-commit",
  "checks": { "V1": true, "N1": true, "D1": true, "F1": true, "T1": false,
              "P1": true, "G1": true, "C1": true, "M1": true }
}
EOF
# 手动编辑
```

---

## 3. 工作机制

### 3.1 触发链路

```
用户 on → command 调 install.js（写 config + 清理旧钩子）
       → command 调 cron.js 拿 cron 表达式 + prompt
       → command 调 CC CronCreate（durable=true）
       → .claude/scheduled_tasks.json（CC 自管）
       → 命令层把 cron id 写回 .god/doc-sentinel.json

（到点）
.claude/scheduled_tasks.json
  → CC 把 prompt 入队到当前 session 队列
  → 当前 session agent 加载 doc-sentinel skill
  → 跑 check-facade.js <cwd>（纯 Node.js 脚本，零 LLM 介入）
  → 写 docs/doc-sentinel/runs/<ISO>.json
  → exit
```

### 3.2 session 队列调度原理

CC 平台串行处理消息队列。cron 任务到点时 CC 把 prompt **排在用户消息后面**等空闲——agent 跑巡检时用户其他操作正常排队，agent 跑完（一般 30s-2min）队列恢复。

**体感**：
- 用户在主 cc 输入 `> foo` → 排队
- cron 任务到点 prompt 也排在同一队列 → 排在 `foo` 后面（看时序）
- agent 处理 cron prompt → 跑 check-facade → 输出 `docs/doc-sentinel/runs/<ISO>.json` + 可能 auto-fix + commit
- 接着处理 `foo`（用户消息）

**为什么不像 `claude -p` 脱机跑那么"无感"**：`claude -p` 是独立子进程完全不影响主 cc；CC CronCreate 是主 session 内的 agent 跑，**会**占用一段队列。但 check-facade.js 本身是纯 Node.js 脚本（零 LLM 介入），实际体感 = 偶尔看到 runs/ 多 1 个 json + 偶尔 1-2 个 auto-fix commit。

### 3.3 跨 session 续期

durable 任务存 `.claude/scheduled_tasks.json`（CC 平台行为，**待 E2E 验证项目级 vs 用户级**），session 关闭 / 死掉任务**不丢**：

- 当前有活跃 session → CC 把到点 prompt 入队到该 session
- 无活跃 session → CC 挂起等待
- 新 session 启动 → CC 自动扫描 durable 任务，到点入队到新 session

**用户最关心**："我关了 cc 再开会自动续吗？" → 是，durable 任务跨 session 存活。

### 3.4 不污染用户全局

**关键约束**（**不**写 `~/.claude/`）：

- `.god/doc-sentinel.json` → 项目根
- `docs/doc-sentinel/runs/` → 项目根

durable 任务文件（`.claude/scheduled_tasks.json`）由 CC 平台自管，god 命令**不**直接写。

**多项目隔离**：
- 项目 A 启用 ≠ 项目 B 启用
- 每个项目独立 config

---

## 4. 9 类 check 速查

| ID | 名称 | 检查什么 | auto-fix? |
|---|---|---|---|
| V1 | 版本漂移 | plugin.json vs CHANGELOG | 半（PATCH/MINOR 是）|
| N1 | 编号规约 | RFC/ADR 编号撞车 | 半（撞车否）|
| D1 | demo 三件套 | DASHBOARD/summary/.trace | 是 |
| F1 | frontmatter | SKILL.md/commands.md 缺 status | 是 |
| T1 | stale TODO | TODO/占位符 | 半（设计意图跳）|
| P1 | 路径引用 | .md 引用失效路径 | 是 |
| G1 | G 状态机 | G 编号 4 路对齐 | 半 |
| C1 | CHANGELOG 日期 | 真实 commit 日期 | 是 |
| M1 | 自检 | doc-sentinel 自身健康 | 否 |

详细 → [`../../skills/doc-sentinel/SKILL.md`](../../skills/doc-sentinel/SKILL.md)

---

## 5. 常见问题

### 5.1 启用后没跑？

1. `cat .god/doc-sentinel.json` 看 `cronId` 是否有值
2. 调 CC `CronList` 看任务是否存在
3. 看 `status` 输出（如有 ⚠️ 警告，按建议重建）
4. 等到点观察 `docs/doc-sentinel/runs/` 是否有新文件

### 5.2 agent 跑得久怎么办？

CC 队列串行处理，agent 跑巡检时用户其他消息排队，但 agent 跑完（一般 30s-2min）就恢复。`check-facade.js` 本身是纯 Node.js 脚本（零 LLM 介入），实际体感 = 偶尔看到 runs/ 多 1 个 json + 偶尔 1-2 个 auto-fix commit。

如担心跑飞：off → 调整 config checks 减少范围 → on。

### 5.3 改了项目，巡检会覆盖吗？

不会。doc-sentinel 改的是 `docs/` 和 SKILL.md/commands.md，**不**改你的业务代码（除非开了 P1 路径引用 auto-fix，且发现失效路径——极罕见）。

### 5.4 误关后恢复？

再 on 即可。`off` 只标记 `enabled: false` + 清 `cronId`，config 保留。可直接 `/god:doc-sentinel on` 复用。

### 5.5 多项目同时启用？

每个项目独立 on，互相不影响。`.god/doc-sentinel.json` 各自一份。

### 5.6 God 插件自身能用吗？

**能用**。god 自身仓 `/Users/puyifan/project/github/claude-plugins/plugins/god` 也是项目根，`/god:doc-sentinel on` 直接启用。`isProjectRoot()` 检查通过（`package.json` + `.git/` 同时存在），`install.js` 流程与其他项目一致。dogfooding = 插件在自身仓跑巡检 = 任何回归立刻被自己抓到。

---

## 6. 恢复方式

### 6.1 误关后恢复

```bash
/god:doc-sentinel on   # config 已有，直接复用
```

### 6.2 cron 任务丢了

```bash
# 1. 看 status 是否 ⚠️
/god:doc-sentinel status
# → ⚠️ config.enabled=true 但 cron 任务不存在

# 2. 重建
/god:doc-sentinel off   # 清 config
/god:doc-sentinel on    # 重建 cron 任务
```

### 6.3 跑飞（agent 卡住）

CC 队列串行调度，agent 跑巡检超时（默认 30 min）由 CC 平台强制终止：

```bash
# 如手动要 kill（罕见）
ps aux | grep "check-facade" | grep -v grep
kill <pid>
```

---

## 7. 与其他文档的关系

| 章节 | 详细在哪 |
|---|---|
| §2 config schema | [`../../scripts/doc-sentinel/config.js`](../../scripts/doc-sentinel/config.js) |
| §3 触发机制 | [`../../commands/doc-sentinel.md`](../../commands/doc-sentinel.md) |
| §3.1 cron 表达式 + prompt 模板 | [`../../scripts/doc-sentinel/cron.js`](../../scripts/doc-sentinel/cron.js) |
| §4 check 速查 | [`../../skills/doc-sentinel/SKILL.md`](../../skills/doc-sentinel/SKILL.md) |
| 设计依据 | [`../adrs/0012-doc-sentinel.md`](../adrs/0012-doc-sentinel.md) |
| 启用 incident | [`./incidents/0001-doc-sentinel-onboard.md`](./incidents/0001-doc-sentinel-onboard.md) |