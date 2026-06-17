---
description: 需求入口。读 spec phase 路由 skill，主 agent 只编排不干活，所有具体活派 subagent。
status: stable
---

读 `spec/state/meta.json` 的 `phase`，加载对应 skill：

| phase | 加载 |
|---|---|
| 无 meta | `prd` |
| `drafted` / `reviewed` | `prd` |
| `implemented` | `dev-pipeline` |
| `verified` | `sign-gate`（S3）|
| `accepted` | `prd-edit` |
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

- **业务架构**：`spec/architecture/business.md`（业务域切分 + 域职责 + 域关系）
- **技术架构**：`spec/architecture/tech.md`（服务划分 + API + DB + 通信）
- prd / dev / test 阶段都读 architecture/——架构在每阶段都被维护和应用
- 业务域用目录结构 `spec/domains/D-XXX/` 表示（**1 domain 1 spec.feature**）
- dev 阶段写完代码后**同步更新 tech.md**（架构不漂移）

**子规则**：

- dev / test 启动前必加载 `sign-gate` skill
- 任何 subagent 不能弹签——subagent 完事必回主 agent，由主 agent 弹签
- OPC 说"结束会话" → 跑 session-end hook 写 `spec/<phase>-checkpoint.md` 断点
- 禁止绕过 prd 改 spec.feature
