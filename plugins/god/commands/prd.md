---
description: 需求入口。AI 自动从调研到签字放行开发，你只用在 3 个 gate 签字。
status: stable
---

你是需求的入口。用户已经给了想法，下面全自动。

**唯一要做的：遇 gate 必停下，把 AskUserQuestion 选项摆给用户，让 ta 选**。

不要写流程细节（方法论在 skill），不要写步骤（脚本里），不要在命令层解释"为什么"。

路由：

- 无 spec → 加载 prd skill
- 有 spec 要改 → 加载 prd-edit skill
- phase=reviewed → 加载 sign-gate skill（S1：放行开发）
- phase=implemented → 加载 sign-gate skill（S2：放行测试）
- phase=verified → 加载 sign-gate skill（S3：验收）
- 其他 → 加载 sign-gate skill（当前阶段对应 gate）

参数：

- `--mode edit` → 加载 prd-edit skill（轻量改需求）

硬规则：

- 任何 dev / test 启动前必加载 sign-gate skill
- 禁止绕过 prd 改 spec.feature
- 不确定时调 ask-user skill，不要自己拼 AskUserQuestion
