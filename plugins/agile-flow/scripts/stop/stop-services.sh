#!/usr/bin/env bash
# Script: stop-services.sh
# Description: 停止 Agile Flow 自动化流程（Web Dashboard + Observer）
# Usage: ./stop-services.sh [project_directory]

set -euo pipefail
IFS=$'\n\t'

# ============================================
# Constants
# ============================================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# User project directory
if [[ -n "${1:-}" ]]; then
    readonly PROJECT_ROOT="$1"
elif [[ -n "${PWD:-}" ]]; then
    readonly PROJECT_ROOT="$PWD"
else
    readonly PROJECT_ROOT="$(pwd)"
fi

readonly AI_DOCS_DIR="${PROJECT_ROOT}/ai-docs"
readonly LOGS_DIR="${AI_DOCS_DIR}/.logs"
readonly WEB_PID_FILE="${LOGS_DIR}/server.pid"
readonly WEB_PORT_FILE="${LOGS_DIR}/server.port"
readonly OBSERVER_PID_FILE="${LOGS_DIR}/observer.pid"

# ============================================
# Logging Functions
# ============================================
log_info() {
    echo "ℹ️  $*" >&2
}

log_success() {
    echo "✅ $*"
}

log_warning() {
    echo "⚠️  $*" >&2
}

log_error() {
    echo "❌ $*" >&2
}

log_action() {
    echo "🚀 $*"
}

# ============================================
# Utility Functions
# ============================================
is_process_running() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null
}

kill_process() {
    local pid="$1"
    local name="$2"

    if is_process_running "$pid"; then
        echo "🛑 停止 ${name} (PID: $pid)"
        kill "$pid" 2>/dev/null || true

        # 等待最多 3 秒
        local count=0
        while is_process_running "$pid" && (( count < 3 )); do
            sleep 1
            ((count++))
        done

        # 如果还在运行，强制终止
        if is_process_running "$pid"; then
            echo "⚠️  强制终止 ${name}"
            kill -9 "$pid" 2>/dev/null || true
            sleep 1
        fi

        echo "✅ ${name} 已停止"
    else
        echo "⚠️  ${name} 进程不存在 (PID: $pid)"
    fi
}

# ============================================
# Stop Functions
# ============================================
stop_web_server() {
    if [[ -f "$WEB_PID_FILE" ]]; then
        local pid
        pid=$(cat "$WEB_PID_FILE")
        kill_process "$pid" "Web Dashboard"
        rm -f "$WEB_PID_FILE"
    else
        echo "ℹ️  未找到 Web Dashboard PID 文件"
    fi
}

stop_observer() {
    if [[ -f "$OBSERVER_PID_FILE" ]]; then
        local pid
        pid=$(cat "$OBSERVER_PID_FILE")
        kill_process "$pid" "Observer Agent"
        rm -f "$OBSERVER_PID_FILE"
    else
        echo "ℹ️  未找到 Observer Agent PID 文件"
    fi
}

cleanup_port() {
    if [[ -f "$WEB_PORT_FILE" ]]; then
        local port
        port=$(cat "$WEB_PORT_FILE")

        if lsof -i:"$port" >/dev/null 2>&1; then
            echo "⚠️  端口 ${port} 仍被占用，强制清理..."
            lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
            sleep 1

            if lsof -i:"$port" >/dev/null 2>&1; then
                echo "❌ 无法释放端口 ${port}"
                echo "💡 请手动检查: lsof -i:${port}"
            else
                echo "✅ 端口 ${port} 已释放"
            fi
        fi

        rm -f "$WEB_PORT_FILE"
    fi
}

verify_stop() {
    local remaining=0

    # 检查 Web Dashboard
    if pgrep -f "node.*server.js" >/dev/null 2>&1; then
        echo "⚠️  警告: 仍有 Web Dashboard 进程运行"
        pgrep -f "node.*server.js" | head -3
        ((remaining++))
    fi

    # 检查 Observer
    if [[ -f "$OBSERVER_PID_FILE" ]] || pgrep -f "observer.*agent.py" >/dev/null 2>&1; then
        echo "⚠️  警告: 仍有 Observer 进程运行"
        pgrep -f "observer.*agent.py" | head -3
        ((remaining++))
    fi

    if (( remaining == 0 )); then
        echo "✅ 所有进程已停止"
        return 0
    else
        echo "❌ 部分进程未能停止"
        return 1
    fi
}

# ============================================
# Main Function
# ============================================
main() {
    echo ""
    echo "⏹️  停止 Agile Flow 自动化流程"
    echo "======================================"
    echo ""

    # 停止服务
    stop_web_server
    echo ""
    stop_observer
    echo ""

    # 清理端口
    cleanup_port
    echo ""

    # 验证
    if verify_stop; then
        echo ""
        echo "⏹️  Agile Flow 已停止"
        echo ""
        echo "💡 使用 /agile-start 重新启动"
        exit 0
    else
        echo ""
        echo "❌ 停止失败，请手动检查"
        exit 1
    fi
}

main "$@"
