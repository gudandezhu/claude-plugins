#!/usr/bin/env bash
# Script: stop-services.sh
# Description: 停止 Agile Flow 自动化流程（Web Dashboard + Observer）
# Usage: ./stop-services.sh [project_directory]

set -euo pipefail
IFS=$'\n\t'

# ============================================
# Usage
# ============================================
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [project_directory]

Stop Agile Flow automation services (Web Dashboard + Observer).

Arguments:
    project_directory    Path to project directory (default: current directory)

Environment:
    AI_DOCS_PATH         Path to ai-docs directory (default: <project>/ai-docs)

Examples:
    $SCRIPT_NAME                          # Stop in current directory
    $SCRIPT_NAME /path/to/project         # Stop in specific directory
    AI_DOCS_PATH=/custom/docs $SCRIPT_NAME # Use custom docs path

EOF
}

# ============================================
# Constants
# ============================================

# ============================================
# Constants
# ============================================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# User project directory
if [[ -n "${1:-}" ]]; then
    readonly PROJECT_ROOT="$1"
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
    local project_dir="$1"

    # 检查 Web Dashboard（限制在项目目录内）
    if pgrep -f "node.*server.js" >/dev/null 2>&1; then
        # 只显示项目相关的进程
        local pids
        pids=$(pgrep -f "node.*server.js" 2>/dev/null | while read -r pid; do
            if [[ -d "/proc/$pid" ]]; then
                local cmdline
                cmdline=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ')
                if [[ "$cmdline" == *"$project_dir"* ]]; then
                    echo "$pid"
                fi
            fi
        done)

        if [[ -n "$pids" ]]; then
            echo "⚠️  警告: 仍有 Web Dashboard 进程运行"
            echo "$pids" | head -3
            ((remaining++))
        fi
    fi

    # 检查 Observer（限制在项目目录内）
    if pgrep -f "observer.*agent.py" >/dev/null 2>&1; then
        local pids
        pids=$(pgrep -f "observer.*agent.py" 2>/dev/null | while read -r pid; do
            if [[ -d "/proc/$pid" ]]; then
                local cmdline
                cmdline=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ')
                if [[ "$cmdline" == *"$project_dir"* ]]; then
                    echo "$pid"
                fi
            fi
        done)

        if [[ -n "$pids" ]]; then
            echo "⚠️  警告: 仍有 Observer 进程运行"
            echo "$pids" | head -3
            ((remaining++))
        fi
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
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            *)
                PROJECT_ROOT="$1"
                shift
                ;;
        esac
    done

    # Validate project directory
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        log_error "项目目录不存在: $PROJECT_ROOT"
        exit 1
    fi

    # Validate ai-docs directory
    if [[ ! -d "$AI_DOCS_DIR" ]]; then
        log_error "ai-docs 目录不存在: $AI_DOCS_DIR"
        log_error "请确认项目路径正确，或使用: AI_DOCS_PATH=/custom/path $SCRIPT_NAME"
        exit 1
    fi

    echo ""
    echo "⏹️  停止 Agile Flow 自动化流程"
    echo "======================================"
    echo "项目: $PROJECT_ROOT"
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
    if verify_stop "$PROJECT_ROOT"; then
        echo ""
        echo "⏹️  Agile Flow 已停止"
        echo ""
        echo "💡 使用 /agile-start 重新启动"
        exit 0
    else
        echo ""
        echo "❌ 停止失败，请手动检查"
        echo ""
        echo "提示："
        echo "  查看进程: ps aux | grep -E 'node.*server.js|observer.*agent.py'"
        echo "  强制停止: pkill -9 -f 'node.*server.js|observer.*agent.py'"
        exit 1
    fi
}

main "$@"
