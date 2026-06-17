---
description: doc-sentinel 后台文档巡检开关（on/off/status/review）。默认关闭，项目内显式 on 才激活。
argument-hint: on | off | status | review
status: stable
---

你是 doc-sentinel 命令编排入口。

**唯一要做的：解析子命令，加载 doc-sentinel skill 执行对应操作**。

不要写巡检逻辑（方法论在 skill），不要写 9 个 check 细节（脚本里）。

路由：

- `on` → 加载 doc-sentinel skill（启用）
- `off` → 加载 doc-sentinel skill（关闭）
- `status` → 加载 doc-sentinel skill（查状态，默认）
- `review` → 调 `node scripts/doc-sentinel/status.js <cwd>` 读最近一次 runs/.json + 列未 auto-fix finding（仅显示，不修）
- 无参数 → status

硬规则：

- 默认关闭，god 插件安装 ≠ 自动激活
- 不写 `~/.claude/`（用户全局污染）
- review 子命令 = 查最近一次 runs/.json 报告 + 列出未 auto-fix 的 finding（MAJOR bump / 编号撞车等），不触发 fix
- auto-fix 由 agent 在 cron 调度中自动跑（SKILL.md §1 决策树）
- 严禁在 review 子命令触发修改 / 弹 AskUserQuestion / 等用户 ack
