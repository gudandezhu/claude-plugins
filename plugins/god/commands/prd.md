---
description: 需求入口。读 context/feature/state/meta.json 的 phase,加载对应 skill 编排推进。
status: stable
---

读 `context/feature/state/meta.json` 的 `phase`（业务项目）或 `spec/state/meta.json`（god 自身）,加载对应 skill:

| phase | 加载 |
|---|---|
| 无 meta | `prd`（阶段 0 派 `docs-init` subagent 建 `context/`）|
| `drafted` / `reviewed` | `prd` |
| `implemented` | `dev-pipeline` |
| `verified` | `sign-gate`（S3）→ 接受后派 `deploy` subagent（v0.7.4）|
| `accepted` | `prd-edit`（改需求；前置派 `docs-sync` subagent 沉淀到 `context/`）|
| 其他 | `sign-gate`（当前阶段 gate）|

`--mode edit` → `prd-edit`。

## 编排契约（核心铁律）

**主 agent 永远只编排，不干具体活**——读 phase → 加载 skill → 派 subagent → 读 subagent 结果 → 弹 AskUserQuestion（经 ask-user skill）→ 跑 sign-gate。

主 agent 禁：写 spec / 写代码 / 跑测试 / 调 L3 script 改文件。
subagent 禁：弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 `feature/state/meta.json`。
sign-gate 禁：派 subagent / 写 spec / 写代码。

**路径约定**：

- **业务项目**：真相源 = `context/feature/`（活规格）+ `context/domain/D-XXX/`（业务域知识）
- **god 自身**：真相源 = `spec/`（活规格子系统）——保留 `spec/` 作为子系统名
- 业务项目用 `context/`，god 自身用 `spec/`——**目录名只是壳**

**知识库契约**（v0.7.4 新增）：

- **位置**：业务项目根 `context/`（与 `src/` 平级）
- **结构**：`context/feature/` 强校验活规格 + `context/domain/D-XXX/`（README + context + incident）+ `context/{adr,pattern,incident}/` 跨域平铺
- **初始化**：prd 阶段 0 派 `docs-init` subagent 扫项目建库（无 `context/README.md` 时触发）
- **维护**：每个 SC accepted 后派 `docs-sync` subagent 沉淀知识卡到 `context/domain/D-XXX/` 或 `context/{adr,pattern,incident}/`
- **消费**：prd 阶段 0 调研读 `context/README.md` 查历史经验；failure-modes 写 `context/incident/`
- **CLAUDE.md 联动**：业务项目 `CLAUDE.md` 必含 `context/` 索引（业务域 + 跨域 + 找代码）
- **决策类 ADR 必 OPC 显式确认**才写（避免 AI 替 OPC 决策）
- **不在 v0.7.4 范围**：全文检索 / 知识图谱 / 版本控制 / 外部集成 / AI push 通知

**deploy 契约**（v0.7.4 新增）：

- **范围**：**本地 docker compose 即可**（v0.7.4 不涉及 k8s / 云 / GitHub Actions / 监控）
- **触发**：test 阶段末（`phase: verified` 后）派 `deploy` subagent 写 `Dockerfile` + `docker-compose.yml` + `.env.example`
- **不弹 S4 签**：deploy 完成后主 agent 跑回显（产物列表 + OPC 手动 `docker compose up` 步骤）
- **不入用户仓库的产物**：实际部署的 image / volume（用户手动 `docker compose up`）
- **CI/CD**：v0.8.0 路线图，v0.7.4 不实现
- **deploy 阶段只产部署配置**，不改产品代码

子规则：dev / test 启动前必加载 sign-gate；任何 subagent 不能弹签——subagent 完事必回主 agent，由主 agent 弹签；OPC 说"结束会话"→ 跑 session-end hook 写 `feature/<phase>-checkpoint.md` 断点；禁止绕过 prd 改 `feature/*.feature`；禁止在 v0.7.4 范围外加 deploy 产物（k8s / 云 / CI）。
