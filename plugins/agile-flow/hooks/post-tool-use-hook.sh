#!/bin/bash
# PostToolUse Hook - 自动检测任务完成并触发后续流程

LOG_FILE="/tmp/agile-post-tool-use.log"
{
  echo "=== PostToolUse Hook at $(date) ==="
  echo "PWD: $(pwd)"
} >> "$LOG_FILE" 2>&1

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
    # 没有找到项目根目录，退出
    exit 0
fi

echo "PROJECT_ROOT: $PROJECT_ROOT" >> "$LOG_FILE"

# 检查是否暂停
if [ -f "$PROJECT_ROOT/projects/active/pause.flag" ]; then
    exit 0
fi

# 检查是否已经在处理中（避免重复触发）
if [ -f "$PROJECT_ROOT/projects/active/.processing" ]; then
    exit 0
fi

# 读取当前迭代
iteration=$(cat "$PROJECT_ROOT/projects/active/iteration.txt")
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json"

# 检查状态文件
if [ ! -f "$status_file" ]; then
    exit 0
fi

# 读取当前任务
if command -v jq >/dev/null 2>&1; then
    current_task_id=$(jq -r '.current_task.id // empty' "$status_file" 2>/dev/null)
else
    current_task_id=""
fi

# 如果没有当前任务，退出
if [ -z "$current_task_id" ] || [ "$current_task_id" = "null" ]; then
    exit 0
fi

# 读取任务状态
task_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/tasks/${current_task_id}.md"
if [ ! -f "$task_file" ]; then
    exit 0
fi

task_status=$(grep '^status:' "$task_file" | cut -d: -f2 | xargs)

# 如果任务刚完成，创建触发标记
if [ "$task_status" = "completed" ]; then
    # 检查是否已经处理过这个任务
    processed_file="$PROJECT_ROOT/projects/active/.processed_tasks"
    if [ -f "$processed_file" ]; then
        if grep -q "^${current_task_id}$" "$processed_file" 2>/dev/null; then
            # 已经处理过，跳过
            exit 0
        fi
    fi

    # 创建处理中标记
    touch "$PROJECT_ROOT/projects/active/.processing"

    # 记录日志
    echo "Task completed: $current_task_id" >> "$LOG_FILE"

    # 创建自动继续标记
    cat > "$PROJECT_ROOT/projects/active/auto_continue.flag" << EOF
{
  "completed_task": "$current_task_id}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "iteration": "$iteration"
}
EOF

    # 标记任务已处理
    echo "${current_task_id}" >> "$processed_file"

    # 移除处理中标记
    rm -f "$PROJECT_ROOT/projects/active/.processing"

    # 输出提示（到 stderr，让用户看到）
    echo "" >&2
    echo "✅ 任务完成: $current_task_id" >&2
    echo "🧪 自动化流程已触发" >&2
    echo "" >&2
fi

exit 0
