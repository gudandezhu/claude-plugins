---
name: agile-flow-engine
description: 极简敏捷开发流程引擎：启动并监控4个持续运行的subagent（需求+设计+开发+测试）
version: 6.0.0
---

# Agile Flow Engine

启动并监控 4 个持续运行的 subagent。

## 4 个 Subagent

| Subagent | 文件 | 处理任务 |
|----------|------|----------|
| 需求分析 | `agents/requirement-agent.md` | PRD 中未处理的需求 |
| 技术设计 | `agents/design-agent.md` | PRD 中的用户故事 |
| TDD 开发 | `agents/develop-agent.md` | pending 状态的任务 |
| E2E 测试 | `agents/test-agent.md` | testing 状态的任务 |

## 执行步骤

### 步骤 0：初始化

1. 检查 `ai-docs/run/.engine.lock`，防止重复启动
2. 创建引擎锁文件
3. 初始化 `ai-docs/run/.subagents.json`

### 步骤 1：启动 4 个 Subagent

使用 `Task` 工具启动（后台运行）：
- `agile-flow:requirement-agent`
- `agile-flow:design-agent`
- `agile-flow:develop-agent`
- `agile-flow:test-agent`

记录 agentId 到 `.subagents.json`。

### 步骤 2：启动 Observer

使用 `Task` 工具启动 Observer subagent（后台运行）。

### 步骤 3：监控循环（永不退出）

每 10 秒执行一次：

1. 读取 `.subagents.json`
2. 使用 `TaskGet` 检查每个 agent 状态
3. 如果停止，重新拉起
4. 输出状态（如 `✓ 4 subagents 运行中`）
5. 等待 10 秒，重复

## 停止条件

引擎永不退出，停止方式：
- 用户执行 `/agile-stop`
- Claude Code 会话结束

停止时清理锁文件。

## 输出要求

- 简洁输出（如 `✓ 启动 4 个 subagents`）
- 最多 20 字
