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
bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/setup-dashboard.sh "$(pwd)"
```

### 3. 启动流程引擎（会自动启动 Observer）

使用 `Skill` 工具调用 `agile-flow:agile-flow-engine`

引擎会自动启动 Observer subagent，无需手动启动。
