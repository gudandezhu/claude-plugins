---
name: agile-start
description: 启动敏捷开发流程
allowed-tools: [Bash, Task, Skill]
---

# Agile Start

启动自动化敏捷开发流程（Web Dashboard + 流程引擎 + Observer）。

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

### 3. 启动 Observer Agent（后台 subagent）

使用 `Task` 工具启动 Observer 作为后台 subagent：

- subagent_type: general-purpose
- description: Product Observer
- prompt: |
  运行产品观察者 Agent，持续监控项目并分析改进建议。

  使用 Bash 工具执行以下命令启动 Observer：

  ```bash
  export AI_DOCS_PATH="$(pwd)/ai-docs"
  export CLAUDE_PID=$$
  export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-${ANTHROPIC_AUTH_TOKEN}}
  cd ${CLAUDE_PLUGIN_ROOT}/agents/product-observer
  nohup python3 agent.py > ai-docs/.logs/observer.log 2>&1 &
  echo $! > ai-docs/.logs/observer.pid
  echo "✓ Observer Agent 已启动 (PID: $(cat ai-docs/.logs/observer.pid))"
  ```

  启动后立即结束（Observer 作为独立进程运行）
- run_in_background: true

### 4. 启动流程引擎

使用 `Skill` 工具调用 `agile-flow:agile-flow-engine`

## 服务说明

**Web Dashboard**：
- 独立运行（nohup），随时可访问
- 需要手动停止：`/agile-stop`

**Observer Agent**：
- 作为后台 subagent 运行
- 生命周期绑定 Claude Code 会话
- Claude Code 退出时自动停止

## 故障排除

```bash
# 端口占用
lsof -i:3737 | kill -9 <PID>

# 停止 Web Dashboard
/agile-stop
```
