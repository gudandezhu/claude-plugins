---
name: agile-start
description: 启动敏捷开发流程
allowed-tools: [Bash, Task, Skill]
---

# Agile Start

启动自动化敏捷开发流程（Web Dashboard + 流程引擎）。

## 执行步骤

### 1. 初始化项目（仅首次）

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/init-project.sh
```

### 2. 启动 Web Dashboard（每次必执行）

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_CONCURRENT=3
bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/setup-dashboard.sh "$(pwd)"
```

### 3. 启动流程引擎（会自动启动 Observer）

使用 `Skill` 工具调用 `agile-flow:agile-flow-engine`

引擎会自动启动 Observer subagent，无需手动启动。

## 服务说明

**Web Dashboard**：
- 独立运行（nohup），随时可访问
- 需要手动停止：`/agile-stop`

**Observer Agent**：
- 由引擎自动启动作为 subagent
- 生命周期绑定 Claude Code 会话
- Claude Code 退出时自动停止

## 故障排除

```bash
# 端口占用
lsof -i:3737 | kill -9 <PID>

# 停止 Web Dashboard
/agile-stop
```
