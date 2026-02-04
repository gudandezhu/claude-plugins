#!/bin/bash
# Stop Hook - 正常退出时的清理（仅在 /exit 等正常退出时触发）

echo "执行 stop hook..."

# 项目目录
cd "${CLAUDE_PROJECT_DIR:-}" || exit 0

# 日志和 PID 目录
readonly AI_DOCS_DIR="ai-docs"
readonly LOGS_DIR="${AI_DOCS_DIR}/.logs"
readonly WEB_PID_FILE="${LOGS_DIR}/server.pid"
readonly OBSERVER_PID_FILE="${LOGS_DIR}/observer.pid"

# 停止 Web Dashboard
if [[ -f "$WEB_PID_FILE" ]]; then
    local web_pid
    web_pid=$(cat "$WEB_PID_FILE")
    if kill -0 "$web_pid" 2>/dev/null; then
        echo "  🛑 停止 Web Dashboard (PID: $web_pid)..."
        kill "$web_pid" 2>/dev/null || true
        sleep 1
        if kill -0 "$web_pid" 2>/dev/null; then
            kill -9 "$web_pid" 2>/dev/null || true
        fi
    fi
    rm -f "$WEB_PID_FILE"
fi

# 停止 Observer Agent
if [[ -f "$OBSERVER_PID_FILE" ]]; then
    local observer_pid
    observer_pid=$(cat "$OBSERVER_PID_FILE")
    if kill -0 "$observer_pid" 2>/dev/null; then
        echo "  👁️  停止 Observer Agent (PID: $observer_pid)..."
        kill "$observer_pid" 2>/dev/null || true
        sleep 1
        if kill -0 "$observer_pid" 2>/dev/null; then
            kill -9 "$observer_pid" 2>/dev/null || true
        fi
    fi
    rm -f "$OBSERVER_PID_FILE"
fi

echo "✅ 自动化流程已清理"

# 如果有未完成的敏捷任务，提醒用户
if [ -d "ai-docs" ]; then
    if [ -f "ai-docs/TASKS.json" ]; then
        local pending_tasks
        pending_tasks=$(python3 -c "
import json
try:
    with open('ai-docs/TASKS.json', 'r') as f:
        tasks = json.load(f).get('tasks', [])
    pending = [t for t in tasks if t.get('status') not in ['completed', 'cancelled']]
    print(len(pending))
except:
    print(0)
" 2>/dev/null || echo "0")

        if [ "$pending_tasks" -gt 0 ]; then
            echo "" >&2
            echo "⚠️  还有 ${pending_tasks} 个未完成任务" >&2
            echo "   下次启动时可以继续敏捷流程" >&2
        fi
    fi
fi

exit 0
