---
description: 需求入口。读 context/feature/state/meta.json 的 phase,加载对应 skill 编排推进。
status: stable
---
读 `context/feature/state/meta.json` 的 `phase`（业务项目）或 `spec/state/meta.json`（god 自身）,加载对应 skill:

| phase | 加载 |
|---|---|
| 无 meta | `prd`(阶段 0 派 `docs-init` subagent 建 `context/`)|
| `drafted` / `reviewed` | `prd` |
| `implemented` | `dev-pipeline` |
| `verified` | `sign-gate`(S3)→ 派 `deploy` subagent(v0.7.4)|
| `accepted` | `prd-edit`(前置 `docs-sync` subagent)|
| 其他 | `sign-gate`(当前阶段 gate)|

`--mode edit` → `prd-edit`。
## 编排契约(核心铁律)
**主 agent 永远只编排,不干具体活** —— 读 phase → 加载 skill → 派 subagent → 读 subagent 结果 → 弹 AskUserQuestion(经 ask-user skill) → 跑 sign-gate。
主 agent 禁:写 spec / 写代码 / 跑测试 / 调 L3 script 改文件。subagent 禁:弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 meta.json。sign-gate 禁:派 subagent / 写 spec / 写代码。
**路径约定**:业务项目用 `context/feature/`(活规格)+ `context/domain/D-XXX/`(业务域);god 自身保留 `spec/`(子系统名)。
**知识库契约**(v0.7.4):位置 = `context/`(与 `src/` 平级);`context/feature/` 强校验活规格 + `context/domain/D-XXX/` 业务域档案;prd 阶段 0 派 `docs-init` subagent 扫项目建库;SC accepted 后派 `docs-sync` subagent 沉淀;决策类 ADR 必 OPC 显式确认。
**deploy 契约**(v0.7.4):test 阶段末(`phase: verified`)派 `deploy` subagent 写 `Dockerfile` + `docker-compose.yml` + `.env.example`;**本地 docker compose 即可**(不涉及 k8s/云/CI);不弹 S4 签;deploy 只产部署配置,不改产品代码。
**路径不一致说明**（v0.7.4 已知）:业务项目用 `context/feature/main.feature`(feature 单独子目录),god 自身用 `spec/spec.feature`(顶层)。**subagent 派发时主 agent 必显式传绝对路径**,避免路径错配。v0.8.0 统一为 `feature/main.feature`。

子规则:dev/test 启动前必加载 sign-gate;subagent 完事必回主 agent 弹签;OPC 说"结束会话" → session-end hook 写 `<phase>-checkpoint.md` 断点;禁止绕过 prd 改 `*.feature`。
