---
name: agile-stop
description: 停止自动化流程
argument-hint: 无需参数
allowed-tools: [Bash]
---

# Agile Stop

停止完全自动化的敏捷开发流程。

## 执行步骤

### 第一步：停止 Web Dashboard

使用 PID 文件优雅停止服务器：

```bash
PID_FILE="${CLAUDE_PLUGIN_ROOT}/web/.logs/server.pid"

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

    # 查找并终止 server.js 进程
    if pgrep -f "node.*server.js" > /dev/null; then
        pkill -f "node.*server.js"
        echo "✅ 已终止 server.js 进程"
    else
        echo "ℹ️  没有运行中的 server.js 进程"
    fi
fi
```

### 第二步：清理端口（如果需要）

```bash
# 检查端口是否仍被占用
if lsof -i:3737 > /dev/null 2>&1; then
    echo "⚠️  端口 3737 仍被占用，强制清理..."

    # 使用 lsof 查找并终止
    lsof -ti:3737 | xargs kill -9 2>/dev/null || true

    sleep 1

    # 再次检查
    if lsof -i:3737 > /dev/null 2>&1; then
        echo "❌ 无法释放端口 3737"
        echo "💡 请手动检查: lsof -i:3737"
    else
        echo "✅ 端口 3737 已释放"
    fi
fi
```

### 第三步：确认停止

```bash
# 验证没有相关进程运行
if pgrep -f "node.*server.js" > /dev/null; then
    echo "⚠️  警告: 仍有 server.js 进程运行"
    pgrep -f "node.*server.js" | head -5
else
    echo "✅ 所有进程已停止"
fi

# 验证端口已释放
if ! lsof -i:3737 > /dev/null 2>&1; then
    echo "✅ 端口 3737 已释放"
fi
```

## 输出结果

### 正常停止
```
🛑 停止 Web Dashboard (PID: 12345)
✅ Web Dashboard 已停止
✅ 端口 3737 已释放
✅ 所有进程已停止

⏹️  Agile Flow 已停止

💡 使用 /agile-start 重新启动
```

### 进程不存在
```
⚠️  Web Dashboard 进程不存在 (PID: 12345)
✅ PID 文件已清理
ℹ️  没有运行中的 server.js 进程

⏹️  Agile Flow 已停止

💡 使用 /agile-start 重新启动
```

### 强制终止
```
⚠️  未找到 PID 文件，尝试查找进程...
✅ 已终止 server.js 进程
✅ 端口 3737 已释放

⏹️  Agile Flow 已停止

💡 使用 /agile-start 重新启动
```

## 注意事项

1. **优雅关闭**：优先使用 PID 文件优雅停止
2. **状态保留**：所有任务状态保留在 `ai-docs/PLAN.md` 中
3. **可恢复**：使用 `/agile-start` 可以随时恢复流程
4. **日志保留**：服务器日志保留在 `web/.logs/server.log`
5. **清理 PID**：停止后自动清理 PID 文件

## 故障排除

### 无法停止进程
```bash
# 查看所有相关进程
ps aux | grep "node.*server.js"

# 手动终止
kill -9 <PID>

# 或使用 pkill
pkill -9 -f "node.*server.js"
```

### 端口无法释放
```bash
# 查看占用端口的进程
lsof -i:3737

# 强制终止
kill -9 <PID>

# 检查防火墙规则
sudo ufw status
```

### PID 文件损坏
```bash
# 删除 PID 文件
rm -f ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.pid

# 手动查找并终止进程
pkill -f "node.*server.js"
```

## 清理选项

如果需要完全清理：

```bash
# 停止所有相关进程
pkill -f "node.*server.js"

# 清理所有文件
rm -f ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.pid
rm -f ${CLAUDE_PLUGIN_ROOT}/web/.logs/server.log

# 确认清理完成
! pgrep -f "node.*server.js"
```
