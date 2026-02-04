---
name: agile-start
description: 启动完全自动化的敏捷开发流程（支持串行和并行模式）
argument-hint: [parallel] - 可选，添加 'parallel' 参数启动并行模式
allowed-tools: [Bash, Skill]
---

# Agile Start

启动完全自动化的敏捷开发流程，包括 Web Dashboard 和自动流程引擎。

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

#### 模式选择

**默认模式（串行）**：
```
使用 Skill 工具调用 agile-flow:agile-flow-engine
```
- `skill`: `agile-flow:agile-flow-engine`
- 适合：小型项目、需要顺序执行的任务

**并行模式**（高性能）：
```
使用 Skill 工具调用 agile-flow:agile-flow-engine-parallel
```
- `skill`: `agile-flow:agile-flow-engine-parallel`
- 适合：中型/大型项目、任务可并行执行
- 性能提升：约 2-3 倍（MAX_PARALLEL=3）

**如何选择**：
- 如果命令参数包含 `parallel`，使用并行模式
- 否则使用默认的串行模式

**重要**：
- ✅ 必须使用 Skill 工具调用
- ✅ 不要跳过此步骤
- ✅ Skill 会持续运行直到所有任务完成
- ✅ 使用 `/agile-stop` 停止流程

#### 性能对比

| 模式 | 10个任务 (每个10分钟) | 适用场景 |
|------|----------------------|----------|
| 串行 | 100分钟 | 小型项目、顺序依赖 |
| 并行(3) | ~35分钟 | 中型项目、独立任务 |

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
