---
name: agile-start
description: 启动完全自动化的敏捷开发流程
argument-hint: 无需参数
allowed-tools: [Bash, Skill]
---

# Agile Start

启动完全自动化的敏捷开发流程，包括 Web Dashboard 和自动流程引擎。

## 执行步骤

### 第一步：初始化项目（首次）

如果 `ai-docs/` 目录不存在：

1. 运行初始化脚本：
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/init-project.sh
   ```

2. 这将创建：
   - `ai-docs/` 目录
   - 文档模板（PLAN.md, ACCEPTANCE.md, BUGS.md, PRD.md 等）

### 第二步：启动 Web Dashboard

1. 设置并启动 Dashboard：
   ```bash
   # 设置 Dashboard
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/init/setup-dashboard.sh

   # 启动服务器（后台运行，记录 PID）
   cd ${CLAUDE_PLUGIN_ROOT}/web
   mkdir -p .logs
   nohup node server.js > .logs/server.log 2>&1 &
   SERVER_PID=$!
   echo $SERVER_PID > .logs/server.pid

   # 等待服务器启动
   sleep 2

   # 验证服务器运行
   if kill -0 $SERVER_PID 2>/dev/null; then
       echo "✅ Web Dashboard 已启动 (PID: $SERVER_PID)"
   else
       echo "❌ Web Dashboard 启动失败"
       exit 1
   fi
   ```

3. Dashboard 将运行在：http://localhost:3737

### 第三步：验证服务状态

```bash
# 检查服务器健康状态
curl -s http://127.0.0.1:3737/health || echo "⚠️ Dashboard 未响应"

# 显示访问信息
echo "🌐 Dashboard: http://localhost:3737"
echo "📊 健康检查: http://localhost:3737/health"
```

### 第四步：启动自动流程引擎

使用 Skill 工具调用 `agile-flow-engine` agent：

```
启动 agile-flow-engine agent 开始自动化流程
```

Agent 将：
- 读取需求池（PRD.md）
- 自动评估优先级
- 转换为任务
- 持续执行任务流转
- 自动测试验收
- 循环处理下一个任务

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

🔄 Agent 正在自动处理任务...
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

1. **完全自动化**：启动后 Agent 将持续运行，无需人工干预
2. **Web Dashboard**：用户通过 Web 界面提交需求和查看进度
3. **Agent 持续运行**：Agent 会自动循环处理所有任务
4. **PID 管理**：使用 PID 文件管理服务器进程
5. **日志记录**：服务器日志保存在 `web/.logs/server.log`
6. **使用 /agile-stop**：停止整个流程（Dashboard + Agent）

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
