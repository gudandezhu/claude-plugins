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
    readonly PRODUCT_OBSERVER_DIR="${PLUGIN_ROOT}/agents/product-observer"
else
    # 根据脚本位置自动检测
    # 检测是否在版本化缓存目录中（如 4.0.0）
    if [[ "$SCRIPT_DIR" =~ /cache/ ]] || [[ "$(basename "$(cd "${SCRIPT_DIR}/../.." && pwd)")" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # 缓存目录结构: version_dir/scripts/init → version_dir
        readonly VERSION_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
        readonly PLUGIN_WEB_DIR="${VERSION_ROOT}/web"
        readonly PLUGIN_SERVER_JS="${PLUGIN_WEB_DIR}/server.js"
        readonly PLUGIN_DASHBOARD_HTML="${PLUGIN_WEB_DIR}/dashboard.html"
        readonly PRODUCT_OBSERVER_DIR="${VERSION_ROOT}/agents/product-observer"
        readonly PLUGIN_ROOT="$VERSION_ROOT"  # 保持变量名一致性
    else
        # 源码目录结构: plugins/agile-flow/scripts/init → plugins/agile-flow
        readonly PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
        readonly PLUGIN_WEB_DIR="${PLUGIN_ROOT}/web"
        readonly PLUGIN_SERVER_JS="${PLUGIN_WEB_DIR}/server.js"
        readonly PLUGIN_DASHBOARD_HTML="${PLUGIN_WEB_DIR}/dashboard.html"
        readonly PRODUCT_OBSERVER_DIR="${PLUGIN_ROOT}/agents/product-observer"
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

start_web_server() {
    ensure_directory "$LOGS_DIR"
    ensure_directory "$RUN_DIR"

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
    # 使用 PORT 环境变量传递端口，AI_DOCS_PATH 传递文档路径
    PORT="$server_port" AI_DOCS_PATH="$AI_DOCS_DIR" nohup node server.js > "$WEB_LOG_FILE" 2>&1 &
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
# ============================================
# Product Observer Functions (仅安装依赖)
# ============================================
install_observer_dependencies() {
    cd "$PRODUCT_OBSERVER_DIR"

    # 检查依赖是否已安装
    if python3 -c "import claude_agent_sdk" 2>/dev/null; then
        return 0
    fi

    log_info "📦 安装 Agent SDK 依赖..."

    # 优先使用项目虚拟环境
    local venv_pip="${PROJECT_ROOT}/.venv/bin/pip"
    if [[ -f "$venv_pip" ]]; then
        log_info "使用项目虚拟环境安装依赖..."
        if ! "$venv_pip" install -q -r requirements.txt; then
            log_error "虚拟环境依赖安装失败"
            return 1
        fi
    else
        # 使用用户级 pip 安装
        if ! pip3 install -q --user -r requirements.txt; then
            log_error "依赖安装失败"
            return 1
        fi
    fi
}

setup_product_observer() {
    # 仅安装依赖，Observer 由 Task 工具作为 subagent 启动
    install_observer_dependencies
    log_info "Observer Agent 依赖已就绪，将由 Task 工具启动"
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

    log_success "✅ Web Dashboard 已启动"
    log_info ""
    log_info "📌 服务说明："
    log_info "   • Web Dashboard：独立运行"
    log_info "   • Observer Agent：请使用 Task 工具作为后台 subagent 启动"
    log_info "   • 如需停止，请执行: /agile-stop"
}

main "$@"
