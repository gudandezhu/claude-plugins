#!/usr/bin/env bash
# Script: stop-services.sh
# Description: 停止 Agile Flow 自动化流程（Web Dashboard + Observer）
# Usage: ./stop-services.sh [project_directory]

# shellcheck disable=SC2317
set -euo pipefail
IFS=$'\n\t'

# ============================================
# Constants
# ============================================
declare -g SCRIPT_NAME
SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

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
    local web_pid_file="$1"

    if [[ -f "$web_pid_file" ]]; then
        local pid
        pid=$(cat "$web_pid_file")
        kill_process "$pid" "Web Dashboard"
        rm -f "$web_pid_file"
    else
        echo "ℹ️  未找到 Web Dashboard PID 文件"
    fi
}

stop_observer() {
    local observer_pid_file="$1"

    if [[ -f "$observer_pid_file" ]]; then
        local pid
        pid=$(cat "$observer_pid_file")
        kill_process "$pid" "Observer Agent"
        rm -f "$observer_pid_file"
    else
        echo "ℹ️  未找到 Observer Agent PID 文件"
    fi
}

cleanup_port() {
    local web_port_file="$1"

    if [[ -f "$web_port_file" ]]; then
        local port
        port=$(cat "$web_port_file")

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

        rm -f "$web_port_file"
    fi
}

verify_stop() {
    local project_dir="$1"
    local remaining=0

    # 检查 Web Dashboard（限制在项目目录内）
    if pgrep -f "node.*server.js" >/dev/null 2>&1; then
        local pids
        pids=$(pgrep -f "node.*server.js" 2>/dev/null | while read -r pid; do
            if [[ -d "/proc/$pid" ]]; then
                local cmdline
                cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)
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
                cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)
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
    local project_dir=""
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
                project_dir="$1"
                shift
                ;;
        esac
    done

    # 如果没有通过参数指定，使用当前目录
    if [[ -z "$project_dir" ]]; then
        project_dir="$(pwd)"
    fi

    # 验证项目目录
    if [[ ! -d "$project_dir" ]]; then
        log_error "项目目录不存在: $project_dir"
        exit 1
    fi

    # 设置路径
    local ai_docs_dir="${project_dir}/ai-docs"
    local logs_dir="${ai_docs_dir}/.logs"
    local web_pid_file="${logs_dir}/server.pid"
    local web_port_file="${logs_dir}/server.port"
    local observer_pid_file="${logs_dir}/observer.pid"

    # 验证 ai-docs 目录
    if [[ ! -d "$ai_docs_dir" ]]; then
        log_error "ai-docs 目录不存在: $ai_docs_dir"
        log_error "请确认项目路径正确，或使用: AI_DOCS_PATH=/custom/path $SCRIPT_NAME"
        exit 1
    fi

    echo ""
    echo "⏹️  停止 Agile Flow 自动化流程"
    echo "======================================"
    echo "项目: $project_dir"
    echo ""

    # 停止服务
    stop_web_server "$web_pid_file"
    echo ""
    stop_observer "$observer_pid_file"
    echo ""

    # 清理端口
    cleanup_port "$web_port_file"
    echo ""

    # 验证
    if verify_stop "$project_dir"; then
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
