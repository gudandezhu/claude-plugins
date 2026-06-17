---
description: 需求入口。读 spec phase 路由 skill，主 agent 只编排不干活，所有具体活派 subagent。
status: stable
---

读 `spec/state/meta.json` 的 `phase`，加载对应 skill：

| phase | 加载 |
|---|---|
| 无 meta | `prd`（阶段 0 派 `knowledge-init` subagent 建 knowledge/）|
| `drafted` / `reviewed` | `prd` |
| `implemented` | `dev-pipeline` |
| `verified` | `sign-gate`（S3）→ 接受后派 `deploy` subagent（v0.7.4）|
| `accepted` | `prd-edit`（改需求；前置派 `knowledge-sync` subagent 沉淀知识卡）|
| 其他 | `sign-gate`（当前阶段 gate）|

`--mode edit` → `prd-edit`。

## 编排契约（核心铁律）

**主 agent 永远只编排，不干具体活**——这是 god 的第一性原则。

| 角色 | 能做 | 不能做 |
|---|---|---|
| **主 agent** | 读 phase → 加载 skill → 派 subagent → 读 subagent 结果 → 弹 AskUserQuestion（经 ask-user skill）→ 跑 sign-gate | 写 spec / 写代码 / 跑测试 / 调 L3 script 改文件 |
| **subagent** | 独立 session 干"具体活"，写产物（spec.feature / 代码 / 测试），跑 L3 script 校验 | 弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 spec.state.meta.json |
| **sign-gate skill** | 弹签选项 + 推进 phase + 写锚点 | 派 subagent / 写 spec / 写代码 |

**架构文档契约**（横切关注点）：

- **业务架构**：**真相源 = `spec/domains/D-XXX/README.md`**（每域职责在本域 README），`spec/architecture/business.md` 由 `arch-summary.js` 自动汇总生成（**不手写**）
- **技术架构**：`spec/architecture/tech.md`（服务划分 + API + DB + 通信）——手写，dev 阶段后同步
- prd / dev / test 阶段都读 architecture/——架构在每阶段都被维护和应用
- 业务域用目录结构 `spec/domains/D-XXX/` 表示（**1 domain 1 spec.feature + 1 README**）
- **新业务域 = 新建 `spec/domains/D-XXX/README.md` + spec.feature**（不直接改 business.md）
- dev 阶段写完代码后**同步更新 tech.md**（架构不漂移）

**知识库契约**（v0.7.4 新增）：

- **位置**：项目根 `knowledge/`（与 `spec/` 平级）
- **初始化**：prd 阶段 0 派 `knowledge-init` subagent 扫项目建 `knowledge/INDEX.md` + 分类目录
- **维护**：每个 SC accepted 后派 `knowledge-sync` subagent 自动沉淀知识卡到 `knowledge/<topic>/`
- **消费**：prd 阶段 0 调研读 `knowledge/` 历史经验；failure-modes 写 `knowledge/incidents/`
- OPC 查知识库 = 看 `knowledge/INDEX.md`（不直接遍历 `knowledge/`）

**deploy 契约**（v0.7.4 新增）：

- **范围**：**本地 docker compose 即可**（v0.7.4 不涉及 k8s / 云 / GitHub Actions）
- **阶段**：test 阶段末（`phase: verified` 后）派 `deploy` subagent 写 `Dockerfile` + `docker-compose.yml` + `.env.example`
- **不入用户仓库的产物**：实际部署的 image / volume（用户手动 `docker compose up`）
- **CI/CD**：v0.8.0 路线图，v0.7.4 不实现
- **S4 签**：v0.7.4 不加 S4（deploy 不必签字，OPC 看 `docker compose up` 跑通就 OK）

**子规则**：

- dev / test 启动前必加载 `sign-gate` skill
- 任何 subagent 不能弹签——subagent 完事必回主 agent，由主 agent 弹签
- OPC 说"结束会话" → 跑 session-end hook 写 `spec/<phase>-checkpoint.md` 断点
- 禁止绕过 prd 改 spec.feature
- 禁止在 v0.7.4 范围外加 deploy 产物（k8s / 云 / CI）
