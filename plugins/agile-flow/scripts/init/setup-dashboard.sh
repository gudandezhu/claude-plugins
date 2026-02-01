#!/usr/bin/env bash
# Script: setup-dashboard.sh
# Description: Setup Web Dashboard and Product Observer Agent in user project
# Usage: ./setup-dashboard.sh [options]

set -euo pipefail
IFS=$'\n\t'

# ============================================
# Constants
# ============================================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# User project directory (current working directory)
readonly PROJECT_ROOT="$(pwd)"
readonly AI_DOCS_DIR="${PROJECT_ROOT}/ai-docs"

# Plugin directory (where this script is installed)
readonly PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
readonly PLUGIN_WEB_DIR="${PLUGIN_ROOT}/plugins/agile-flow/web"
readonly PLUGIN_SERVER_JS="${PLUGIN_WEB_DIR}/server.js"
readonly PLUGIN_DASHBOARD_HTML="${PLUGIN_WEB_DIR}/dashboard.html"

# Product Observer directory
# 使用默认值，如果 CLAUDE_PLUGIN_ROOT 未设置则使用计算的路径
readonly PLUGIN_AGGRESSIVE_FLOW_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly PRODUCT_OBSERVER_DIR="${CLAUDE_PLUGIN_ROOT:-${PLUGIN_AGGRESSIVE_FLOW_ROOT}}/agents/product-observer"

# Server configuration
readonly WEB_SERVER_DEFAULT_PORT=3737
readonly WEB_PORT_FILE="${LOGS_DIR}/server.port"
readonly OBSERVER_PORT_FILE="${LOGS_DIR}/observer.port"  # 预留，未来可能需要

# File paths in user project
readonly LOGS_DIR="${AI_DOCS_DIR}/.logs"
readonly WEB_PID_FILE="${LOGS_DIR}/server.pid"
readonly WEB_LOG_FILE="${LOGS_DIR}/server.log"
readonly OBSERVER_PID_FILE="${LOGS_DIR}/observer.pid"
readonly OBSERVER_LOG_FILE="${LOGS_DIR}/observer.log"

# Process commands
readonly NODE_PROCESS_PATTERN="node.*server\.js"
readonly PYTHON_MIN_VERSION="3.10"

# ============================================
# Logging Functions
# ============================================
log_info() {
    echo "ℹ️  $*" >&2
}

log_success() {
    echo "✅ $*" >&2
}

log_warning() {
    echo "⚠️  $*" >&2
}

log_error() {
    echo "❌ $*" >&2
}

log_action() {
    echo "🚀 $*" >&2
}

# ============================================
# Utility Functions
# ============================================
check_command() {
    local cmd="$1"
    command -v "$cmd" >/dev/null 2>&1 || {
        log_error "$cmd 未找到，请先安装"
        return 1
    }
}

check_python_version() {
    local python_version
    python_version=$(python3 --version 2>&1 | awk '{print $2}')

    # 使用参数展开提取版本号，避免修改 IFS
    local major="${python_version%%.*}"
    local minor="${python_version#*.}"
    minor="${minor%%.*}"

    if (( major < 3 || (major == 3 && minor < 10) )); then
        log_error "Python 版本过低 ($python_version)，需要 ${PYTHON_MIN_VERSION}+"
        return 1
    fi
}

is_process_running() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null
}

is_port_in_use() {
    local port="$1"
    lsof -i:"${port}" >/dev/null 2>&1
}

allocate_port() {
    # 从默认端口开始查找可用端口
    local port="$WEB_SERVER_DEFAULT_PORT"
    local max_attempts=100

    for ((i=0; i<max_attempts; i++)); do
        if ! is_port_in_use "$port"; then
            echo "$port"
            return 0
        fi
        ((port++))
    done

    log_error "无法分配端口（已尝试 ${max_attempts} 次）"
    return 1
}

get_server_port() {
    # 获取服务器端口，如果未分配则分配新端口
    if [[ -f "$WEB_PORT_FILE" ]]; then
        local saved_port
        saved_port=$(cat "$WEB_PORT_FILE")
        # 验证保存的端口是否可用
        if is_port_in_use "$saved_port"; then
            # 端口被占用，可能是本服务在运行，检查 PID
            if [[ -f "$WEB_PID_FILE" ]]; then
                local pid
                pid=$(cat "$WEB_PID_FILE")
                if is_process_running "$pid"; then
                    # 是本服务的端口，返回
                    echo "$saved_port"
                    return 0
                fi
            fi
            # 端口被其他服务占用，重新分配
            log_warning "端口 $saved_port 被占用，重新分配..."
        else
            # 端口可用，返回保存的端口
            echo "$saved_port"
            return 0
        fi
    fi

    # 分配新端口并保存
    local new_port
    new_port=$(allocate_port)
    echo "$new_port" > "$WEB_PORT_FILE"
    echo "$new_port"
}

ensure_directory() {
    local dir="$1"
    [[ -d "$dir" ]] || mkdir -p "$dir"
}

# ============================================
# Web Dashboard Functions
# ============================================
setup_web_server_files() {
    ensure_directory "$AI_DOCS_DIR"

    # 复制 server.js 和 dashboard.html 到用户项目
    if [[ ! -f "${AI_DOCS_DIR}/server.js" ]]; then
        cp "$PLUGIN_SERVER_JS" "${AI_DOCS_DIR}/server.js"
        log_info "已复制 server.js 到 ${AI_DOCS_DIR}"
    fi

    if [[ ! -f "${AI_DOCS_DIR}/dashboard.html" ]]; then
        cp "$PLUGIN_DASHBOARD_HTML" "${AI_DOCS_DIR}/dashboard.html"
        log_info "已复制 dashboard.html 到 ${AI_DOCS_DIR}"
    fi
}

check_web_server_running() {
    if [[ -f "$WEB_PID_FILE" ]]; then
        local existing_pid
        existing_pid=$(cat "$WEB_PID_FILE")
        if is_process_running "$existing_pid"; then
            log_info "Web Dashboard 已在运行 (PID: $existing_pid)"
            return 0
        else
            log_warning "旧的 PID 文件存在，但进程已停止，清理中..."
            rm -f "$WEB_PID_FILE"
        fi
    fi
    return 1
}

cleanup_web_port() {
    local port
    port=$(get_server_port)
    if is_port_in_use "$port"; then
        log_warning "端口 ${port} 已被占用，尝试终止旧进程..."
        pkill -f "$NODE_PROCESS_PATTERN" || true
        sleep 1
    fi
}

start_web_server() {
    ensure_directory "$LOGS_DIR"

    setup_web_server_files
    cd "$AI_DOCS_DIR"

    # 获取端口
    local server_port
    server_port=$(get_server_port)

    # 清理旧进程
    if is_port_in_use "$server_port"; then
        local old_pid
        old_pid=$(lsof -ti:"$server_port" 2>/dev/null)
        if [[ -n "$old_pid" ]]; then
            kill "$old_pid" 2>/dev/null || true
            sleep 1
        fi
    fi

    log_action "正在启动 Web Dashboard (端口: $server_port)..."
    # 使用 PORT 环境变量传递端口
    PORT="$server_port" nohup node server.js > "$WEB_LOG_FILE" 2>&1 &
    local server_pid=$!
    echo "$server_pid" > "$WEB_PID_FILE"

    sleep 2

    if is_process_running "$server_pid"; then
        log_success "Web Dashboard 已启动 (PID: $server_pid)"
        log_info "项目目录: $PROJECT_ROOT"
        log_info "访问地址: http://localhost:${server_port}"
    else
        log_error "Web Dashboard 启动失败，查看日志："
        cat "$WEB_LOG_FILE"
        return 1
    fi
}

setup_web_dashboard() {
    if ! check_web_server_running; then
        start_web_server
    fi
}

# ============================================
# Product Observer Functions
# ============================================
check_observer_running() {
    if [[ -f "$OBSERVER_PID_FILE" ]]; then
        local existing_pid
        existing_pid=$(cat "$OBSERVER_PID_FILE")
        if is_process_running "$existing_pid"; then
            log_info "产品观察者 Agent 已在运行 (PID: $existing_pid)"
            return 0
        fi
    fi
    return 1
}

install_observer_dependencies() {
    cd "$PRODUCT_OBSERVER_DIR"

    if ! python3 -c "import claude_agent_sdk" 2>/dev/null; then
        log_info "📦 安装 Agent SDK 依赖..."
        if ! pip3 install -q -r requirements.txt; then
            log_error "依赖安装失败"
            return 1
        fi
    fi
}

start_product_observer() {
    ensure_directory "$(dirname "$OBSERVER_PID_FILE")"

    # 检查 Python 环境
    check_command python3
    check_python_version

    # 安装依赖
    install_observer_dependencies || return 1

    cd "$PRODUCT_OBSERVER_DIR"

    log_action "正在启动产品观察者 Agent..."
    nohup python3 main.py > "$OBSERVER_LOG_FILE" 2>&1 &
    local observer_pid=$!
    echo "$observer_pid" > "$OBSERVER_PID_FILE"

    sleep 2

    if is_process_running "$observer_pid"; then
        log_success "产品观察者 Agent 已启动 (PID: $observer_pid)"
    else
        log_warning "产品观察者 Agent 启动失败，查看日志："
        cat "$OBSERVER_LOG_FILE"
        return 1
    fi

    cd - >/dev/null
}

setup_product_observer() {
    if ! check_observer_running; then
        start_product_observer
    fi
}

# ============================================
# Main Function
# ============================================
main() {
    # 设置环境变量（仅在当前进程中有效）
    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export AI_DOCS_PATH="$AI_DOCS_DIR"

    log_info "项目目录: $PROJECT_ROOT"
    log_info "AI_DOCS_DIR: $AI_DOCS_DIR"
    log_info "插件目录: $PLUGIN_ROOT"

    # 设置 Web Dashboard
    setup_web_dashboard

    # 设置产品观察者 Agent
    setup_product_observer

    log_success "Dashboard 设置完成"
}

main "$@"
