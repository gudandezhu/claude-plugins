---
name: agile-start
description: 启动完全自动化的敏捷开发流程（总并发=3，开发固定1个+测试1个+需求2个）
argument-hint: 无需参数，默认持续并发模式
allowed-tools: [Bash, Skill]
---

# Agile Start

启动完全自动化的敏捷开发流程，包括 Web Dashboard 和自动流程引擎。

**总并发限制=3**：开发固定1个，测试最多1个，需求分析填充剩余配额。

## 执行步骤

### 第一步：初始化项目（仅首次）

**如果 `ai-docs/` 目录不存在**，运行初始化脚本：

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/init-project.sh
```

这将创建：
- `ai-docs/` 目录
- 文档模板（PLAN.md, BUGS.md, PRD.md 等）

**如果目录已存在，跳过此步骤。**

---

### 第二步：启动 Web Dashboard（每次必执行）

**重要：无论 session 是否恢复，每次执行 /agile-start 都必须执行此步骤！**

1. **设置环境变量**（必需）：
```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_CONCURRENT=3  # 总并发限制（开发1 + 测试1 + 需求2）
```

2. 检查并启动 Dashboard：
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/setup-dashboard.sh "$(pwd)"
```
3. Dashboard 将根据可用端口动态分配（默认 3737）
4. 服务器将读取 `ai-docs/TASKS.json` 作为数据源

**每次执行 /agile-start 时，必须确保完成此步骤才能继续！**

### 第三步：验证服务状态

```bash
# 检查服务器健康状态
curl -s http://127.0.0.1:3737/health || echo "⚠️ Dashboard 未响应"

# 显示访问信息
echo "🌐 Dashboard: http://localhost:3737"
echo "📊 健康检查: http://localhost:3737/health"
```

### 第四步：启动自动化流程引擎（核心步骤）

**必须执行！使用 Skill 工具启动自动化流程：**

立即调用 `agile-flow:agile-flow-engine` skill：

```
使用 Skill 工具调用 agile-flow:agile-flow-engine
```

**执行方式**：在工具调用中使用 `Skill` 工具，参数为：
- `skill`: `agile-flow:agile-flow-engine`

**重要**：
- ✅ 必须使用 Skill 工具调用
- ✅ 不要跳过此步骤
- ✅ Skill 会持续运行直到所有任务完成
- ✅ 使用 `/agile-stop` 停止流程
- ✅ **默认并行模式**：需求、设计、开发、测试同时执行

## 并行执行说明

### 持续运行策略

**总并发限制 = 3**（严格遵守 API 限制）：

```
总并发 = 3
├── 开发: 1 (固定)
├── 测试: 0-1 (动态)
└── 需求: 0-2 (动态填充剩余配额)
```

**关键规则**：
- 开发固定保持 1 个（避免代码冲突）
- 测试优先级高于需求
- 需求分析填充剩余配额
- 任务完成后立即启动同类型的下一个

### 性能提升

| 场景 | 串行 | 持续并发(3) | 提升 |
|------|------|-------------|------|
| 12个任务 | 90分钟 | 40分钟 | **2.25倍** |

**关键**：
- 总共最多 3 个 subagent 同时运行
- 不是批次模式，而是持续运行
- 某个阶段任务完成后，立即启动该阶段的下一个

### 输出示例

```
🚀 敏捷开发流程 (总并发=3)

🔄 运行中: 3/3
   开发: 1, 测试: 1, 需求: 1

💻 启动开发: TASK-001
🧪 启动测试: TEST-005
📋 启动需求: REQ-003

[5秒后]
💻 完成: TASK-001
🔄 运行中: 2/3
   开发: 0, 测试: 1, 需求: 1

💻 启动开发: TASK-002
🔄 运行中: 3/3
   开发: 1, 测试: 1, 需求: 1
...
```

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"  # 必需：文档目录
export MAX_CONCURRENT=3               # 可选：总并发限制（默认3）
```

## 故障排除

### 端口已被占用
```bash
# 查看占用端口的进程
lsof -i:3737

# 强制终止
kill -9 <PID>

# 或使用 /agile-stop
```

### 服务器未响应
```bash
# 检查服务器状态
cat ${AI_DOCS_PATH}/.logs/server.log

# 读取动态端口
PORT=$(cat ${AI_DOCS_PATH}/.logs/server.port)

# 重启服务器
kill $(cat ${AI_DOCS_PATH}/.logs/server.pid)
cd ${AI_DOCS_PATH} && PORT=$PORT node server.js &
```

### 并发限制调整

如果 API 支持更多并发，可以提高限制：

```bash
export MAX_CONCURRENT=5  # 总共5个并发（开发1 + 测试1 + 需求3）
/agile-start
```

如果 API 支持更少并发，可以降低限制：

```bash
export MAX_CONCURRENT=2  # 总共2个并发（开发1 + 测试1）
/agile-start
```

## 注意事项

1. **总并发限制 = 3**：严格遵守 API 并发限制
2. **开发固定 1 个**：避免代码仓库冲突
3. **完全自动化**：流程会持续运行直到所有任务完成
4. **上下文隔离**：每个 subagent 独立运行，上下文自动清理
5. **状态同步**：任务状态实时更新到 TASKS.json
6. **动态分配**：任务完成后立即启动同类型的下一个
