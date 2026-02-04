---
name: agile-start
description: 启动敏捷开发流程
allowed-tools: [Bash, Skill]
---

# Agile Start

启动自动化敏捷开发流程（Web Dashboard + 流程引擎）。

## 执行步骤

### 1. 初始化项目（仅首次）

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/init-project.sh
```

### 2. 启动 Dashboard（每次必执行）

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_CONCURRENT=3
bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/setup-dashboard.sh "$(pwd)"
```

### 3. 启动流程引擎

使用 `Skill` 工具调用 `agile-flow:agile-flow-engine`

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"  # 必需
export MAX_CONCURRENT=3               # 可选，默认3
```

## 服务说明

**重要**：Web Dashboard 和 Observer Agent 作为**独立服务**运行：
- ✅ 不会随 Claude Code 退出而停止
- ✅ 可以持续监控和分析项目
- ⚠️  需要手动停止：`/agile-stop`

## 故障排除

```bash
# 端口占用
lsof -i:3737 | kill -9 <PID>

# 服务器未响应
cat ${AI_DOCS_PATH}/.logs/server.log
PORT=$(cat ${AI_DOCS_PATH}/.logs/server.port)
kill $(cat ${AI_DOCS_PATH}/.logs/server.pid)
cd ${AI_DOCS_PATH} && PORT=$PORT node server.js &

# 停止所有服务
/agile-stop
```
