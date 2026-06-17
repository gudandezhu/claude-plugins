# doc-sentinel 用户指南

> god 插件 v0.7.0+ 后台文档巡检 agent — **项目级 on/off 开关**，范围限定在**当前项目根**。

---

## 0. 这是什么

doc-sentinel 是 god 插件的**维护期外骨骼**——后台自动巡检项目文档健康度，按 SKILL.md 决策树 auto-fix + git commit（不 push）。

**关键设计**：
- **默认关闭** —— god 插件安装时**不自动激活**，用户在项目里**主动 on** 才生效
- **范围 = 单项目** —— `.god/doc-sentinel.json` + `.claude/settings.json` 写在项目根，**不污染用户全局**
- **不占 cc 窗口** —— SessionStart 钩子调 `claude -p` **脱机后台**跑，巡检时用户正常用 cc
- **可关闭** —— `/god:doc-sentinel off` 删钩子，config 保留 audit

---

## 1. 快速开始

### 1.1 启用（在项目内）

```bash
cd <你的项目>          # 任意含 .git 或 package.json 的项目根
/god:doc-sentinel on
```

执行：
1. 写 `<项目根>/.god/doc-sentinel.json`（默认配置）
2. 注册 `<项目根>/.claude/settings.json` 的 SessionStart 钩子
3. 创建 `<项目根>/docs/doc-sentinel/runs/` 目录
4. 输出"已启用"

之后**每次打开 cc** → SessionStart 钩子自动触发 → `claude -p` 脱机跑巡检 → 结果落 runs/。

### 1.2 关闭

```bash
/god:doc-sentinel off
```

执行：
1. 标记 `.god/doc-sentinel.json` `enabled: false`（**保留**，作 audit）
2. 从 `.claude/settings.json` 删 SessionStart 钩子段（**保留其他钩子**）
3. runs/ 历史**保留**

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
schedule:  session-start
checks:    V1, N1, D1, F1, T1, P1, G1, C1, M1
钩子:      ✓ SessionStart 已注册
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
  "schedule": "session-start",    // 触发（session-start | cron）
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
| `schedule` | 触发方式 | `session-start`（开 cc 时）/ `cron`（系统 cron）|
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
用户打开 cc（任意项目）
  ↓
cc 检查该项目 .claude/settings.json
  ↓
发现 SessionStart 钩子
  ↓
跑命令: claude -p "你是 doc-sentinel..." --plugin-dir ${CLAUDE_PLUGIN_ROOT}
  ↓
claude -p 独立进程（不占主 cc）
  ↓
加载 god 插件 → 加载 doc-sentinel skill
  ↓
跑 check-facade.js <项目根>（纯 Node.js 脚本，零 LLM 介入）
  ↓
写 docs/doc-sentinel/runs/<ISO>.json
  ↓
exit
```

### 3.2 不占 cc 窗口的关键

`claude -p` 是 **prompt-driven single-shot**：
- 不进入 TUI（不会弹出 chat 界面）
- 跑完即退
- stdout 写到 runs/ 报告
- 用户在主 cc 里**完全无感**

### 3.3 去重机制

`scripts/doc-sentinel/run-headless.sh` 内置 4h 去重：
- 距上次跑 < 4h → 跳过
- 避免每次开 cc 都跑（巡检成本约 30s）

### 3.4 不污染用户全局

**关键约束**（**不**写 `~/.claude/`）：
- `.god/doc-sentinel.json` → 项目根
- `.claude/settings.json` → 项目根
- `docs/doc-sentinel/runs/` → 项目根

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

1. `cat .claude/settings.json` 看 SessionStart 钩子（v0.7.0+ 主线）
2. 手动跑：`bash ${CLAUDE_PLUGIN_ROOT}/scripts/doc-sentinel/run-headless.sh .`
3. 看 runs/ 是否有 `<ISO>.json`

### 5.2 占 cc 窗口？

**不会**。`claude -p` 是脱机模式，独立进程，stdout 落 runs/。如果看到 cc 被占，检查 `~/.claude/settings.json`（**不**应该是 doc-sentinel 引起的）。

### 5.3 改了项目，巡检会覆盖吗？

不会。doc-sentinel 改的是 `docs/` 和 SKILL.md/commands.md，**不**改你的业务代码（除非开了 P1 路径引用 auto-fix，且发现失效路径——极罕见）。

### 5.4 误关后恢复？

再 on 即可。`off` 只标记 `enabled: false`，config 保留。可直接 `/god:doc-sentinel on` 复用。

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

### 6.2 钩子被破坏

```bash
# 1. 看当前 settings.json
cat .claude/settings.json

# 2. 手动重写或重 on
/god:doc-sentinel off
/god:doc-sentinel on
```

### 6.3 跑飞（agent 卡住）

`claude -p` 默认超时由 cc 决定（一般 5-10 分钟）。如卡住：
```bash
# 找并 kill
ps aux | grep "claude -p" | grep doc-sentinel
kill <pid>
```

---

## 7. 与其他文档的关系

| 章节 | 详细在哪 |
|---|---|
| §2 config schema | [`../../scripts/doc-sentinel/config.js`](../../scripts/doc-sentinel/config.js) |
| §3 触发机制 | [`../../scripts/doc-sentinel/install.js`](../../scripts/doc-sentinel/install.js) |
| §3.3 去重 | [`../../scripts/doc-sentinel/run-headless.sh`](../../scripts/doc-sentinel/run-headless.sh) |
| §4 check 速查 | [`../../skills/doc-sentinel/SKILL.md`](../../skills/doc-sentinel/SKILL.md) |
| 设计依据 | [`../adrs/0012-doc-sentinel.md`](../adrs/0012-doc-sentinel.md) |
| 启用 incident | [`./incidents/0001-doc-sentinel-onboard.md`](./incidents/0001-doc-sentinel-onboard.md) |