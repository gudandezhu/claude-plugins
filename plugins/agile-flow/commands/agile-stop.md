---
name: agile-stop
description: 停止自动化流程
argument-hint: 无需参数
allowed-tools: [Bash]
---

# Agile Stop

停止自动化敏捷开发流程（Web Dashboard）。

## 快速停止

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/stop/stop-services.sh
```

## 如果脚本失败

手动执行以下步骤：

### 1. 停止 Web Dashboard

```bash
WEB_PID_FILE="${AI_DOCS_PATH}/run/server.pid"
if [[ -f "$WEB_PID_FILE" ]]; then
    WEB_PID=$(cat "$WEB_PID_FILE")
    kill $WEB_PID 2>/dev/null || true
    sleep 1
    kill -9 $WEB_PID 2>/dev/null || true
    rm -f "$WEB_PID_FILE"
fi
```

### 2. 清理端口

```bash
PORT_FILE="${AI_DOCS_PATH}/run/server.port"
if [[ -f "$PORT_FILE" ]]; then
    PORT=$(cat "$PORT_FILE")
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    rm -f "$PORT_FILE"
fi
```

## 预期输出

```
⏹️  停止 Agile Flow 自动化流程
======================================

🛑 停止 Web Dashboard (PID: 12345)
✅ Web Dashboard 已停止

✅ 所有进程已停止

⏹️  Agile Flow 已停止

💡 使用 /agile-start 重新启动
```

## 故障排除

如果脚本失败，手动清理：

```bash
# 强制停止所有相关进程
pkill -9 -f "node.*server.js"

# 清理文件
rm -f ai-docs/run/server.pid
rm -f ai-docs/run/server.port
```
