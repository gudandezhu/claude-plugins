#!/bin/bash
# PostToolUse Hook - 自动检测任务完成并触发后续流程
# 优化版本：使用多种检测方式，减少误判

LOG_FILE="/tmp/agile-post-tool-use.log"
LOG_MAX_LINES=1000

# 日志函数（限制大小）
log_message() {
    {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    } >> "$LOG_FILE"
    # 限制日志文件大小
    if [ -f "$LOG_FILE" ]; then
        tail -n $LOG_MAX_LINES "$LOG_FILE" > "${LOG_FILE}.tmp" 2>/dev/null && mv "${LOG_FILE}.tmp" "$LOG_FILE"
    fi
}

log_message "=== PostToolUse Hook triggered ==="
log_message "PWD: $(pwd)"
log_message "Tool: ${TOOL_NAME:-unknown}"

# 查找项目根目录 - 向上查找包含 projects/active/iteration.txt 的目录
find_project_root() {
    local current_dir="$(pwd)"
    local checked_dir="$current_dir"

    while [ "$checked_dir" != "/" ]; do
        if [ -f "$checked_dir/projects/active/iteration.txt" ]; then
            echo "$checked_dir"
            return 0
        fi
        checked_dir="$(dirname "$checked_dir")"
    done

    # 如果没找到，返回空
    echo ""
    return 1
}

# 获取项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-$(find_project_root)}"

if [ -z "$PROJECT_ROOT" ]; then
    log_message "No project root found, exiting"
    exit 0
fi

log_message "PROJECT_ROOT: $PROJECT_ROOT"

# 检查是否暂停
if [ -f "$PROJECT_ROOT/projects/active/pause.flag" ]; then
    log_message "Project is paused, exiting"
    exit 0
fi

# 检查是否已经在处理中（避免重复触发）
if [ -f "$PROJECT_ROOT/projects/active/.processing" ]; then
    log_message "Already processing, exiting"
    exit 0
fi

# 检查是否有显式的完成标记（优先级最高）
complete_flag="$PROJECT_ROOT/projects/active/.task_complete"
if [ -f "$complete_flag" ]; then
    log_message "Found explicit complete flag"
    current_task_id=$(cat "$complete_flag" 2>/dev/null || echo "")
    if [ -n "$current_task_id" ]; then
        # 触发继续流程
        trigger_auto_continue "$PROJECT_ROOT" "$current_task_id" "explicit_flag"
        rm -f "$complete_flag"
    fi
    exit 0
fi

# 读取当前迭代
iteration_file="$PROJECT_ROOT/projects/active/iteration.txt"
if [ ! -f "$iteration_file" ]; then
    log_message "No iteration file found, exiting"
    exit 0
fi

iteration=$(cat "$iteration_file" 2>/dev/null || echo "1")
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json"

# 检查状态文件
if [ ! -f "$status_file" ]; then
    log_message "No status file found, exiting"
    exit 0
fi

# 读取当前任务（使用 jq，如果没有 jq 则跳过）
if command -v jq >/dev/null 2>&1; then
    current_task_id=$(jq -r '.current_task.id // empty' "$status_file" 2>/dev/null)
    log_message "Current task from status.json: $current_task_id"
else
    log_message "jq not available, skipping status check"
    exit 0
fi

# 如果没有当前任务，退出
if [ -z "$current_task_id" ] || [ "$current_task_id" = "null" ]; then
    log_message "No current task found, exiting"
    exit 0
fi

# 读取任务文件
task_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/tasks/${current_task_id}.md"
if [ ! -f "$task_file" ]; then
    log_message "Task file not found: $task_file, exiting"
    exit 0
fi

# 检测任务完成（多种方式）
task_completed=false

# 方式1：检查 status: 字段
task_status=$(grep '^status:' "$task_file" 2>/dev/null | cut -d: -f2 | xargs || echo "")
if [ "$task_status" = "completed" ]; then
    log_message "Task status: completed (via status field)"
    task_completed=true
fi

# 方式2：检查文件是否包含完成标记
if grep -q "# ✅ 完成" "$task_file" 2>/dev/null || \
   grep -q "## 完成状态" "$task_file" 2>/dev/null; then
    log_message "Task status: completed (via completion marker)"
    task_completed=true
fi

# 如果任务完成，触发后续流程
if [ "$task_completed" = true ]; then
    # 检查是否已经处理过这个任务
    processed_file="$PROJECT_ROOT/projects/active/.processed_tasks"
    if [ -f "$processed_file" ]; then
        if grep -q "^${current_task_id}$" "$processed_file" 2>/dev/null; then
            log_message "Task already processed: $current_task_id, exiting"
            exit 0
        fi
    fi

    trigger_auto_continue "$PROJECT_ROOT" "$current_task_id" "$iteration"
fi

exit 0

# 触发自动继续流程的函数
trigger_auto_continue() {
    local project_root="$1"
    local task_id="$2"
    local iteration="$3"

    log_message "Triggering auto continue for task: $task_id"

    # 创建处理中标记
    touch "$project_root/projects/active/.processing"

    # 创建自动继续标记
    cat > "$project_root/projects/active/auto_continue.flag" << EOF
{
  "completed_task": "$task_id",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "iteration": "$iteration"
}
EOF

    # 标记任务已处理
    echo "${task_id}" >> "$project_root/projects/active/.processed_tasks"

    # 移除处理中标记
    rm -f "$project_root/projects/active/.processing"

    # 输出提示（到 stderr，让用户看到）
    echo "" >&2
    echo "✅ 任务完成: $task_id" >&2
    echo "🧪 自动化流程已触发" >&2
    echo "   提示: 使用 /agile-continue 继续下一个任务" >&2
    echo "" >&2

    log_message "Auto continue flag created for task: $task_id"
}
