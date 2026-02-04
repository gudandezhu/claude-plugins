---
name: agile-start
description: 启动完全自动化的敏捷开发流程（默认并行，需求/设计/开发/测试同时执行）
argument-hint: 无需参数，默认并行模式
allowed-tools: [Bash, Skill]
---

# Agile Start

启动完全自动化的敏捷开发流程，包括 Web Dashboard 和自动流程引擎。

**默认支持并行执行**：需求分析、技术设计、TDD 开发、E2E 测试可以同时进行！

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
export MAX_PARALLEL=3  # 每个阶段最多并行数
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

### 默认并行策略

**多个阶段的任务同时执行**：

```
📋 需求分析 subagent ──┐
🎨 技术设计 subagent ──┼──> 同时运行
💻 TDD 开发 subagent  ──┤
🧪 E2E 测试 subagent  ──┘
```

### 性能提升

| 场景 | 串行 | 并行(3) | 提升 |
|------|------|---------|------|
| 12个任务（各阶段3个） | 120分钟 | 40分钟 | **3倍** |
| 20个任务（各阶段5个） | 200分钟 | 70分钟 | **约3倍** |

**关键**：
- 每个阶段（需求/设计/开发/测试）最多同时运行 3 个 subagent
- 不同阶段的任务完全独立，可以并行执行
- 使用 `run_in_background=True` 实现真正的并行

### 输出示例

```
🚀 并行敏捷开发流程 (MAX_PARALLEL=3)

📋 待处理任务: 12 个
  - 需求分析: 3 个
  - 技术设计: 3 个
  - TDD 开发: 3 个
  - E2E 测试: 3 个

🚀 启动并行 subagent (12 个)
  📋 启动需求分析: REQ-001
  📋 启动需求分析: REQ-002
  📋 启动需求分析: REQ-003
  🎨 启动技术设计: DES-001
  🎨 启动技术设计: DES-002
  🎨 启动技术设计: DES-003
  💻 启动TDD开发: TASK-001
  💻 启动TDD开发: TASK-002
  💻 启动TDD开发: TASK-003
  🧪 启动E2E测试: TEST-001
  🧪 启动E2E测试: TEST-002
  🧪 启动E2E测试: TEST-003

⏳ 等待任务完成...
  📋 完成: REQ-001
  💻 完成: TASK-002
  🎨 完成: DES-001
  🧪 完成: TEST-001
  ...

📊 批次完成，继续下一批...
```

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"  # 必需：文档目录
export MAX_PARALLEL=3                 # 可选：每个阶段最多并行数（默认3）
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

### 并行任务过多

如果觉得并行太多，可以降低并行度：

```bash
export MAX_PARALLEL=2  # 每个阶段最多2个并行任务
/agile-start
```

## 注意事项

1. **完全自动化**：流程会持续运行直到所有任务完成
2. **上下文隔离**：每个 subagent 独立运行，上下文自动清理
3. **状态同步**：任务状态实时更新到 TASKS.json
4. **冲突检测**：任务拆分时避免文件重叠
5. **端口分配**：动态端口分配（3000-3010），避免冲突
