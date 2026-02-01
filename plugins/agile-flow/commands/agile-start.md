---
name: agile-start
description: 启动完全自动化的敏捷开发流程
argument-hint: 无需参数
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
- 文档模板（PLAN.md, ACCEPTANCE.md, BUGS.md, PRD.md 等）

**如果目录已存在，跳过此步骤。**

---

### 第二步：启动 Web Dashboard（每次必执行）

**重要：无论 session 是否恢复，每次执行 /agile-start 都必须执行此步骤！**

1. 检查并启动 Dashboard：
   ```bash
   # 设置 AI_DOCS_PATH 环境变量
   export AI_DOCS_PATH=$(pwd)/ai-docs

   # 进入 Web 目录
   cd ${CLAUDE_PLUGIN_ROOT}/web
   mkdir -p .logs

   # 检查是否已有运行中的服务
   if [ -f .logs/server.pid ]; then
       EXISTING_PID=$(cat .logs/server.pid)
       if kill -0 $EXISTING_PID 2>/dev/null; then
           echo "ℹ️ Web Dashboard 已在运行 (PID: $EXISTING_PID)"
       else
           echo "⚠️ 旧的 PID 文件存在，但进程已停止，清理中..."
           rm -f .logs/server.pid
       fi
   fi

   # 如果没有运行中的服务，则启动
   if [ ! -f .logs/server.pid ] || ! kill -0 $(cat .logs/server.pid) 2>/dev/null; then
       echo "🚀 正在启动 Web Dashboard..."

       # 检查端口是否被占用
       if lsof -i:3737 >/dev/null 2>&1; then
           echo "⚠️ 端口 3737 已被占用，尝试终止旧进程..."
           pkill -f "node.*server.js" || true
           sleep 1
       fi

       # 启动服务器（后台运行，记录 PID）
       nohup node server.js > .logs/server.log 2>&1 &
       SERVER_PID=$!
       echo $SERVER_PID > .logs/server.pid

       # 等待服务器启动
       sleep 2

       # 验证服务器运行
       if kill -0 $SERVER_PID 2>/dev/null; then
           echo "✅ Web Dashboard 已启动 (PID: $SERVER_PID)"
       else
           echo "❌ Web Dashboard 启动失败，查看日志："
           cat .logs/server.log
           exit 1
       fi
   fi

   # 设置全局环境变量（供后续流程使用）
   echo "export AI_DOCS_PATH=$AI_DOCS_PATH" >> ~/.bashrc
   ```

2. Dashboard 将运行在：http://localhost:3737
3. 服务器将读取 `ai-docs/TASKS.json` 作为数据源

**每次执行 /agile-start 时，必须确保完成此步骤才能继续！**

### 第三步：验证服务状态

```bash
# 检查服务器健康状态
curl -s http://127.0.0.1:3737/health || echo "⚠️ Dashboard 未响应"

# 显示访问信息
echo "🌐 Dashboard: http://localhost:3737"
echo "📊 健康检查: http://localhost:3737/health"
```

### 第四步：启动自动化流程引擎

**从现在开始，你将直接执行以下自动化流程（不要使用 Skill 工具或 Task 工具）：**

#### 自动化循环

```
需求池 → 任务选择 → 开发 → 测试 → 验收 → 下一个任务
   ↑                                      ↓
   └────────────── 自动循环 ←──────────────┘
```

#### 执行步骤

**步骤 1：检查需求池**

从 `ai-docs/PRD.md` 读取新需求：
```bash
# 评估优先级
bash ${CLAUDE_PLUGIN_ROOT}/scripts/utils/priority-evaluator.sh

# 添加任务（示例）
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add P0 "实现用户登录功能"
```

**步骤 2：选择下一个任务**

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-next
```

优先级：BUG > 进行中 > 待测试 > 已测试 > 待办（P0→P3）

如果没有待处理任务，等待 5 秒后返回步骤 1。

**步骤 3：执行任务**

```bash
# 更新状态为进行中
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <TASK-ID> inProgress

# 根据任务类型选择执行方式：
# - TypeScript: 在回复中直接实现代码
# - Python: 在回复中直接实现代码
# - Shell: 在回复中直接实现脚本

# 提交代码
git add .
git commit -m "feat: 实现任务描述"

# 更新状态为待测试
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <TASK-ID> testing
```

**步骤 4：自动测试**

```bash
# 1. 生成并运行单元测试
# TypeScript: npm run test:unit -- --coverage
# Python: pytest --cov

# 2. 启动项目验证
# 检查日志是否有 error

# 3. 处理结果
# - 有 Bug: 记录到 BUGS.md，状态改为 bug
# - 通过: 状态改为 tested
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <TASK-ID> tested
```

**步骤 5：验收**

```bash
# 1. 总结到 ai-docs/ACCEPTANCE.md（200字）
# 2. 更新 ai-docs/CONTEXT.md（50字）
# 3. API 变更记录到 ai-docs/API.md
# 4. 标记完成
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <TASK-ID> completed
```

**步骤 6：继续循环**

返回步骤 1，处理下一个任务。

#### 停止条件

- 用户执行 `/agile-stop`
- 所有任务完成且无新需求
- 遇到无法自动解决的阻塞（记录到 BUGS.md）

#### 关键规则

- **完全自动化**：不需要暂停，持续循环
- **不使用 AskUserQuestion**：自动处理所有情况
- **直接执行**：不使用 Skill 工具启动子流程
- **输出进度**：清晰显示当前任务和状态

## 输出结果

### 首次启动
```
✅ 项目结构已创建
✅ 文档模板已创建
✅ Web Dashboard 已启动 (PID: 12345)

🌐 Dashboard: http://localhost:3737
📊 健康检查: http://localhost:3737/health
🚀 自动化流程已启动

💡 提示：
  - 在 Dashboard 提交需求
  - 流程自动运行，无需暂停
  - 使用 /agile-stop 停止流程
  - 日志文件: ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.log
```

### 已有项目
```
🌐 Dashboard: http://localhost:3737
🚀 自动化流程已恢复

📊 当前进度:
  - 迭代: 1
  - 待办: 3 个
  - 进行中: 1 个
  - 已完成: 5 个

🔄 自动化流程正在运行...
```

### 启动失败
```
❌ 启动失败

📋 诊断步骤：
1. 检查端口: lsof -i:3737
2. 查看日志: cat ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.log
3. 检查进程: ps aux | grep "node.*server.js"

💡 如需清理：
   pkill -f "node.*server.js"
   rm -f ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.pid
```

## 注意事项

1. **完全自动化**：启动后 skill 将持续运行，无需人工干预
2. **Web Dashboard**：用户通过 Web 界面提交需求和查看进度
3. **Skill 驱动**：流程由 agile-flow-engine skill 管理
4. **PID 管理**：使用 PID 文件管理服务器进程
5. **日志记录**：服务器日志保存在 `web/.logs/server.log`
6. **使用 /agile-stop**：停止整个流程（Dashboard + 自动化流程）

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
cat ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.log

# 重启服务器
kill $(cat ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.pid)
cd ${CLAUDE_PLUGIN_ROOT}/web && node server.js &
```
