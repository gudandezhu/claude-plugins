---
name: agile-flow-engine
description: 极简敏捷开发流程引擎：启动并监控4个持续运行的subagent（需求+设计+开发+测试）
version: 6.0.0
---

# Agile Flow Engine

启动并监控 4 个持续运行的 subagent。

## 环境变量（必须设置）

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export CLAUDE_PLUGIN_ROOT="/data/project/claude-plugins/plugins/agile-flow"
```

## 4 个 Subagent

| Subagent | 职责 | 核心逻辑 |
|----------|------|----------|
| 需求分析 | 监控 PRD，创建用户故事级任务 | 读取 PRD.md → 调用 agile-product-analyze |
| 技术设计 | 拆分用户故事为技术任务 | 读取 PRD.md → 调用 agile-tech-design |
| TDD 开发 | 处理 pending 任务 | 获取 pending 任务 → 调用 agile-develop-task |
| E2E 测试 | 处理 testing 任务 | 获取 testing 任务 → 调用 agile-e2e-test |

## 执行步骤

### 步骤 0：初始化

1. 检查 `ai-docs/run/.engine.lock`，防止重复启动
2. 创建引擎锁文件：`echo $$ > ai-docs/run/.engine.lock`
3. 初始化 `ai-docs/run/.subagents.json`：`echo "{}" > ai-docs/run/.subagents.json`

### 步骤 1：启动 4 个 Subagent

使用 `Task` 工具启动（后台运行）：

**Requirement Agent**：
```
- subagent_type: agile-flow:requirement-agent
- run_in_background: true
- description: 需求分析 Agent
```

**Design Agent**：
```
- subagent_type: agile-flow:design-agent
- run_in_background: true
- description: 技术设计 Agent
```

**Develop Agent**：
```
- subagent_type: agile-flow:develop-agent
- run_in_background: true
- description: TDD 开发 Agent
```

**Test Agent**：
```
- subagent_type: agile-flow:test-agent
- run_in_background: true
- description: E2E 测试 Agent
```

记录 agentId 到 `.subagents.json`：
```json
{
  "requirement": {"agentId": "xxx", "startTime": 1234567890},
  "design": {"agentId": "xxx", "startTime": 1234567890},
  "develop": {"agentId": "xxx", "startTime": 1234567890},
  "test": {"agentId": "xxx", "startTime": 1234567890}
}
```

### 步骤 2：启动 Observer

使用 `Task` 工具启动 Observer（后台运行）：
```
- subagent_type: general-purpose
- run_in_background: true
- description: Observer Agent
- prompt: |
  export AI_DOCS_PATH="{AI_DOCS_PATH}"
  cd {CLAUDE_PLUGIN_ROOT}/agents/product-observer
  python3 agent.py
```

### 步骤 3：监控循环（永不退出，必须执行）

**重要**：你必须进入无限循环，持续监控 subagent 状态，直到用户停止或会话结束。

每 10 秒执行一次：

1. 使用 `Read` 工具读取 `ai-docs/run/.subagents.json`
2. 对每个 subagent，使用 `TaskGet` 工具检查状态
3. 如果某个 subagent 状态不是 `running`（如 completed/error/failed）：
   - 使用 `Task` 工具重新启动该 subagent（使用对应的 subagent_type）
   - 更新 `.subagents.json` 中的 agentId
4. 输出状态（如 `✓ 4 subagents 运行中`）
5. 使用 `Bash` 工具执行 `sleep 10`
6. **返回步骤1，永不退出**

**循环终止条件**：
- 用户手动停止（Ctrl+C）
- Claude Code 会话结束

## 停止条件

引擎永不退出，停止方式：
- 用户执行 `/agile-stop`
- Claude Code 会话结束

停止时清理锁文件。

## 输出要求

- 简洁输出（如 `✓ 启动 4 个 subagents`）
- 最多 20 字
