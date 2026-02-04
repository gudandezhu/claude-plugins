---
name: agile-start
description: 启动敏捷开发流程（总并发=3，开发固定1个+测试1个+需求2个）
allowed-tools: [Bash, Skill]
---

# Agile Start

启动自动化敏捷开发流程（Web Dashboard + 流程引擎）。

**总并发=3**：开发固定1个，测试最多1个，需求分析填充剩余配额。

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

## 并发策略

```
总并发 = 3
├── 开发: 1 (固定)
├── 测试: 0-1 (动态)
└── 需求: 0-2 (填充剩余)
```

**关键规则**：
- 开发固定1个（避免代码冲突）
- 测试优先于需求
- 任务完成后立即启动同类型的下一个

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"  # 必需
export MAX_CONCURRENT=3               # 可选，默认3
```

## 故障排除

```bash
# 端口占用
lsof -i:3737 | kill -9 <PID>

# 服务器未响应
cat ${AI_DOCS_PATH}/.logs/server.log
PORT=$(cat ${AI_DOCS_PATH}/.logs/server.port)
kill $(cat ${AI_DOCS_PATH}/.logs/server.pid)
cd ${AI_DOCS_PATH} && PORT=$PORT node server.js &
```
