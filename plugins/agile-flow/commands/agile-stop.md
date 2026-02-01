---
name: agile-stop
description: 停止自动化流程
argument-hint: 无需参数
allowed-tools: [Bash]
---

# Agile Stop

停止完全自动化的敏捷开发流程。

## 执行步骤

### 第一步：停止产品观察者 Agent

```bash
# 从项目环境读取路径
OBSERVER_PID_FILE="${AI_DOCS_PATH}/.logs/observer.pid"

# 检查 PID 文件是否存在
if [[ -f "$OBSERVER_PID_FILE" ]]; then
    # 读取 PID
    OBSERVER_PID=$(cat "$OBSERVER_PID_FILE")

    # 检查进程是否运行
    if kill -0 $OBSERVER_PID 2>/dev/null; then
        echo "🛑 停止产品观察者 Agent (PID: $OBSERVER_PID)"
        kill $OBSERVER_PID

        # 等待进程结束
        for i in {1..3}; do
            if ! kill -0 $OBSERVER_PID 2>/dev/null; then
                echo "✅ 产品观察者 Agent 已停止"
                break
            fi
            sleep 1
        done

        # 如果仍未停止，强制终止
        if kill -0 $OBSERVER_PID 2>/dev/null; then
            echo "⚠️  强制终止产品观察者 Agent"
            kill -9 $OBSERVER_PID
        fi
    else
        echo "⚠️  产品观察者 Agent 进程不存在 (PID: $OBSERVER_PID)"
    fi

    # 清理 PID 文件
    rm -f "$OBSERVER_PID_FILE"
else
    # 如果没有 PID 文件，尝试查找并终止进程
    echo "ℹ️  未找到产品观察者 Agent PID 文件"

    # 查找并终止 Python main.py 进程
    if pgrep -f "product-observer.*main.py" > /dev/null; then
        pkill -f "product-observer.*main.py"
        echo "✅ 已终止产品观察者 Agent 进程"
    fi
fi
```

### 第二步：停止 Web Dashboard

```bash
# 读取动态端口
PORT_FILE="${AI_DOCS_PATH}/.logs/server.port"
PID_FILE="${AI_DOCS_PATH}/.logs/server.pid"

# 获取端口（如果存在）
if [[ -f "$PORT_FILE" ]]; then
    PORT=$(cat "$PORT_FILE")
    echo "📍 Dashboard 端口: $PORT"
else
    PORT=3737  # 默认端口
fi

# 检查 PID 文件是否存在
if [[ -f "$PID_FILE" ]]; then
    # 读取 PID
    SERVER_PID=$(cat "$PID_FILE")

    # 检查进程是否运行
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo "🛑 停止 Web Dashboard (PID: $SERVER_PID)"
        kill $SERVER_PID

        # 等待进程结束（最多 5 秒）
        for i in {1..5}; do
            if ! kill -0 $SERVER_PID 2>/dev/null; then
                echo "✅ Web Dashboard 已停止"
                break
            fi
            sleep 1
        done

        # 如果仍未停止，强制终止
        if kill -0 $SERVER_PID 2>/dev/null; then
            echo "⚠️  强制终止 Web Dashboard"
            kill -9 $SERVER_PID
        fi
    else
        echo "⚠️  Web Dashboard 进程不存在 (PID: $SERVER_PID)"
    fi

    # 清理 PID 文件
    rm -f "$PID_FILE"
else
    # 如果没有 PID 文件，尝试查找并终止进程
    echo "⚠️  未找到 PID 文件，尝试查找进程..."

    # 查找并终止 server.js 进程（在项目目录）
    PROJECT_DIR="$(dirname "$AI_DOCS_PATH")"
    if pgrep -f "node.*server.js" -f "$PROJECT_DIR" > /dev/null 2>&1; then
        pkill -f "node.*server.js"
        echo "✅ 已终止 server.js 进程"
    else
        echo "ℹ️  没有运行中的 server.js 进程"
    fi
fi
```

### 第三步：清理端口（如果需要）

```bash
# 清理动态端口
if [[ -f "$PORT_FILE" ]]; then
    PORT=$(cat "$PORT_FILE")

    if lsof -i:$PORT > /dev/null 2>&1; then
        echo "⚠️  端口 $PORT 仍被占用，强制清理..."

        # 使用 lsof 查找并终止
        lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

        sleep 1

        # 再次检查
        if lsof -i:$PORT > /dev/null 2>&1; then
            echo "❌ 无法释放端口 $PORT"
            echo "💡 请手动检查: lsof -i:$PORT"
        else
            echo "✅ 端口 $PORT 已释放"
        fi
    fi

    # 清理端口文件
    rm -f "$PORT_FILE"
fi
```

### 第四步：确认停止

```bash
# 验证没有相关进程运行
PROJECT_DIR="$(dirname "$AI_DOCS_PATH")"
if pgrep -f "node.*server.js" -f "$PROJECT_DIR" > /dev/null 2>&1 || pgrep -f "product-observer.*main.py" > /dev/null; then
    echo "⚠️  警告: 仍有进程运行"
    pgrep -f "node.*server.js\|product-observer.*main.py" | head -5
else
    echo "✅ 所有进程已停止"
fi

# 验证端口已释放
if [[ -f "$PORT_FILE" ]]; then
    PORT=$(cat "$PORT_FILE")
    if ! lsof -i:$PORT > /dev/null 2>&1; then
        echo "✅ 端口 $PORT 已释放"
    fi
fi
```

## 输出结果

### 正常停止
```
🛑 停止产品观察者 Agent (PID: 54321)
✅ 产品观察者 Agent 已停止
📍 Dashboard 端口: 3738
🛑 停止 Web Dashboard (PID: 12345)
✅ Web Dashboard 已停止
✅ 端口 3738 已释放
✅ 所有进程已停止

⏹️  Agile Flow 已停止

💡 使用 /agile-start 重新启动
```

### 进程不存在
```
ℹ️  未找到产品观察者 Agent PID 文件
📍 Dashboard 端口: 3737
⚠️  Web Dashboard 进程不存在 (PID: 12345)
✅ PID 文件已清理
ℹ️  没有运行中的进程

⏹️  Agile Flow 已停止

💡 使用 /agile-start 重新启动
```

### 强制终止
```
⚠️  未找到 PID 文件，尝试查找进程...
✅ 已终止 server.js 进程
📍 Dashboard 端口: 3739
✅ 端口 3739 已释放

⏹️  Agile Flow 已停止

💡 使用 /agile-start 重新启动
```

## 注意事项

1. **优雅关闭**：优先使用 PID 文件优雅停止
2. **状态保留**：所有任务状态保留在 `ai-docs/PLAN.md` 中
3. **可恢复**：使用 `/agile-start` 可以随时恢复流程
4. **多项目支持**：每个项目独立运行，互不影响
5. **日志保留**：服务器日志保留在 `ai-docs/.logs/server.log`
6. **日志保留**：产品观察者日志保留在 `ai-docs/.logs/observer.log`
7. **动态端口**：自动清理 `ai-docs/.logs/server.port`

## 故障排除

### 无法停止进程
```bash
# 查看所有相关进程
ps aux | grep -E "node.*server.js|product-observer.*main.py"

# 手动终止
kill -9 <PID>

# 或使用 pkill
pkill -9 -f "node.*server.js"
pkill -9 -f "product-observer.*main.py"
```

### 端口无法释放
```bash
# 查看端口文件中的端口
cat ai-docs/.logs/server.port

# 查看占用端口的进程
lsof -i:<端口>

# 强制终止
kill -9 <PID>
```

### PID 文件损坏
```bash
# 删除 PID 文件
rm -f ai-docs/.logs/server.pid
rm -f ai-docs/.logs/observer.pid

# 手动查找并终止进程
pkill -f "node.*server.js"
pkill -f "product-observer.*main.py"
```

## 清理选项

如果需要完全清理：

```bash
# 停止所有相关进程
pkill -f "node.*server.js"
pkill -f "product-observer.*main.py"

# 清理所有文件
rm -f ai-docs/.logs/server.pid
rm -f ai-docs/.logs/server.port
rm -f ai-docs/.logs/server.log
rm -f ai-docs/.logs/observer.pid
rm -f ai-docs/.logs/observer.log

# 确认清理完成
! pgrep -f "node.*server.js|product-observer.*main.py"
```
