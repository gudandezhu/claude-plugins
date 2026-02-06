#!/usr/bin/env bash
# Script: setup-dashboard.sh
# Description: Setup Web Dashboard and Product Observer Agent in user project
# Usage: ./setup-dashboard.sh [project_directory]

set -euo pipefail
IFS=$'\n\t'

# ============================================
# Constants
# ============================================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# User project directory
# 优先使用传入参数，其次使用 PWD 环境变量，最后使用当前目录
if [[ -n "${1:-}" ]]; then
    readonly PROJECT_ROOT="$1"
elif [[ -n "${PWD:-}" ]]; then
    readonly PROJECT_ROOT="$PWD"
else
    readonly PROJECT_ROOT="$(pwd)"
fi

readonly AI_DOCS_DIR="${PROJECT_ROOT}/ai-docs"

# Plugin directory detection (handles both cache and source directory structures)
# 缓存目录: /cache/.../agile-flow/4.0.0/scripts/init/setup-dashboard.sh
# 源码目录: /source/plugins/agile-flow/scripts/init/setup-dashboard.sh

if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
    # 优先使用环境变量（由 Claude Code 设置）
    readonly PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
    readonly PLUGIN_WEB_DIR="${PLUGIN_ROOT}/web"
    readonly PLUGIN_SERVER_JS="${PLUGIN_WEB_DIR}/server.js"
    readonly PLUGIN_DASHBOARD_HTML="${PLUGIN_WEB_DIR}/dashboard.html"
else
    # 根据脚本位置自动检测
    # 检测是否在版本化缓存目录中（如 4.0.0）
    if [[ "$SCRIPT_DIR" =~ /cache/ ]] || [[ "$(basename "$(cd "${SCRIPT_DIR}/../.." && pwd)")" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # 缓存目录结构: version_dir/scripts/init → version_dir
        readonly VERSION_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
        readonly PLUGIN_WEB_DIR="${VERSION_ROOT}/web"
        readonly PLUGIN_SERVER_JS="${PLUGIN_WEB_DIR}/server.js"
        readonly PLUGIN_DASHBOARD_HTML="${PLUGIN_WEB_DIR}/dashboard.html"
        readonly PLUGIN_ROOT="$VERSION_ROOT"  # 保持变量名一致性
    else
        # 源码目录结构: plugins/agile-flow/scripts/init → plugins/agile-flow
        readonly PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
        readonly PLUGIN_WEB_DIR="${PLUGIN_ROOT}/web"
        readonly PLUGIN_SERVER_JS="${PLUGIN_WEB_DIR}/server.js"
        readonly PLUGIN_DASHBOARD_HTML="${PLUGIN_WEB_DIR}/dashboard.html"
    fi
fi

# Server configuration
readonly WEB_SERVER_DEFAULT_PORT=3737

# File paths in user project
readonly LOGS_DIR="${AI_DOCS_DIR}/logs"
readonly RUN_DIR="${AI_DOCS_DIR}/run"
readonly WEB_PORT_FILE="${RUN_DIR}/server.port"
readonly WEB_PID_FILE="${RUN_DIR}/server.pid"
readonly WEB_LOG_FILE="${LOGS_DIR}/server.log"

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

        # 检查 PID 文件是否存在
        if [[ -f "$WEB_PID_FILE" ]]; then
            local saved_pid
            saved_pid=$(cat "$WEB_PID_FILE")

            # 检查保存的进程是否在运行
            if is_process_running "$saved_pid"; then
                # 进程在运行，验证端口是否匹配
                local pid_port
                pid_port=$(lsof -ti:"$saved_port" 2>/dev/null)
                if [[ "$pid_port" == "$saved_pid" ]]; then
                    # PID 和端口匹配，返回保存的端口
                    echo "$saved_port"
                    return 0
                else
                    # PID 存在但不占用该端口，异常情况，重新分配
                    log_warning "PID $saved_pid 存在但不占用端口 $saved_port，重新分配..."
                fi
            else
                # PID 文件存在但进程已停止
                log_warning "旧进程 $saved_pid 已停止"
                rm -f "$WEB_PID_FILE"
            fi
        fi

        # 验证端口是否可用
        if is_port_in_use "$saved_port"; then
            # 端口被其他进程占用，重新分配
            log_warning "端口 $saved_port 被其他进程占用，重新分配..."
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

    # 检查并安装 npm 依赖
    if [[ ! -f "${AI_DOCS_DIR}/package.json" ]]; then
        log_info "创建 package.json..."
        cat > "${AI_DOCS_DIR}/package.json" << 'EOF'
{
  "name": "agile-flow-dashboard",
  "version": "1.0.0",
  "description": "Agile Flow Web Dashboard",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF
    fi

    if [[ ! -d "${AI_DOCS_DIR}/node_modules" ]]; then
        log_info "安装 npm 依赖..."
        cd "$AI_DOCS_DIR"
        npm install --silent >/dev/null 2>&1 || {
            log_error "npm install 失败"
            return 1
        }
    fi

    # 复制 server.js 和 dashboard.html 到用户项目（每次覆盖，确保使用最新版本）
    cp "$PLUGIN_SERVER_JS" "${AI_DOCS_DIR}/server.js"
    log_info "已更新 server.js"

    cp "$PLUGIN_DASHBOARD_HTML" "${AI_DOCS_DIR}/dashboard.html"
    log_info "已更新 dashboard.html"
}

check_web_server_running() {
    # 检查所有 node server.js 进程，不依赖 PID 文件
    local server_pids
    server_pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)

    if [[ -n "$server_pids" ]]; then
        # 检查是否至少有一个进程在运行
        for pid in $server_pids; do
            if is_process_running "$pid"; then
                log_info "Web Dashboard 已在运行 (PID: $pid)"
                return 0
            fi
        done
    fi

    # 清理无效的 PID 文件
    if [[ -f "$WEB_PID_FILE" ]]; then
        local existing_pid
        existing_pid=$(cat "$WEB_PID_FILE")
        if ! is_process_running "$existing_pid"; then
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
        # 更精确的匹配：只杀掉监听该端口的 node server.js 进程
        local old_pid
        old_pid=$(lsof -ti:"$port" 2>/dev/null)
        if [[ -n "$old_pid" ]]; then
            kill "$old_pid" 2>/dev/null || true
            sleep 1
            # 如果还在运行，强制杀死
            if is_process_running "$old_pid"; then
                kill -9 "$old_pid" 2>/dev/null || true
                sleep 1
            fi
        fi
    fi
}

# 清理所有 node server.js 进程（用于完全重置）
cleanup_all_server_processes() {
    log_info "清理所有 node server.js 进程..."
    local server_pids
    server_pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)

    if [[ -n "$server_pids" ]]; then
        for pid in $server_pids; do
            if is_process_running "$pid"; then
                log_info "终止进程 $pid"
                kill "$pid" 2>/dev/null || true
            fi
        done
        sleep 2

        # 强制杀死残留进程
        server_pids=$(pgrep -f "node.*server.js" 2>/dev/null || true)
        if [[ -n "$server_pids" ]]; then
            for pid in $server_pids; do
                if is_process_running "$pid"; then
                    kill -9 "$pid" 2>/dev/null || true
                fi
            done
            sleep 1
        fi
    fi

    # 清理 PID 和端口文件
    rm -f "$WEB_PID_FILE" "$WEB_PORT_FILE"
}

start_web_server() {
    ensure_directory "$LOGS_DIR"
    ensure_directory "$RUN_DIR"

    setup_web_server_files
    cd "$AI_DOCS_DIR"

    # 首先清理所有 node server.js 进程（避免多端口问题）
    cleanup_all_server_processes

    # 获取端口
    local server_port
    server_port=$(get_server_port)

    log_action "正在启动 Web Dashboard (端口: $server_port)..."
    # 使用 PORT 环境变量传递端口，AI_DOCS_PATH 传递文档路径
    PORT="$server_port" AI_DOCS_PATH="$AI_DOCS_DIR" nohup node server.js > "$WEB_LOG_FILE" 2>&1 &
    local server_pid=$!
    echo "$server_pid" > "$WEB_PID_FILE"

    sleep 2

    if is_process_running "$server_pid"; then
        # 验证进程确实监听了指定端口
        local actual_port
        actual_port=$(lsof -ti:"$server_port" 2>/dev/null)
        if [[ -z "$actual_port" ]]; then
            log_error "进程启动失败，未监听端口 $server_port"
            cat "$WEB_LOG_FILE"
            return 1
        fi

        log_success "Web Dashboard 已启动 (PID: $server_pid, 端口: $server_port)"
        log_info "项目目录: $PROJECT_ROOT"
        log_info "访问地址: http://localhost:${server_port}"
    else
        log_error "Web Dashboard 启动失败，查看日志："
        cat "$WEB_LOG_FILE"
        return 1
    fi
}

stop_web_server() {
    if [[ -f "$WEB_PID_FILE" ]]; then
        local existing_pid
        existing_pid=$(cat "$WEB_PID_FILE")
        if is_process_running "$existing_pid"; then
            log_info "正在停止 Web Dashboard (PID: $existing_pid)..."
            kill "$existing_pid" 2>/dev/null || true
            sleep 1
            # 如果进程还在，强制杀死
            if is_process_running "$existing_pid"; then
                kill -9 "$existing_pid" 2>/dev/null || true
                sleep 1
            fi
            log_success "Web Dashboard 已停止"
        fi
        rm -f "$WEB_PID_FILE"
    fi
}

setup_web_dashboard() {
    # 每次都重启：先停止旧进程，再启动新进程
    stop_web_server
    start_web_server
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

    log_success "✅ Web Dashboard 已启动"
    log_info ""
    log_info "📌 服务说明："
    log_info "   • Web Dashboard：独立运行"
    log_info "   • 如需停止，请执行: /agile-stop"
}

main "$@"
