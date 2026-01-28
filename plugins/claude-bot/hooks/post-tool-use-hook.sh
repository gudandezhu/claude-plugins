#!/bin/bash
# PostToolUse Hook - 工具执行后自动更新状态
# 功能：在任务完成后自动生成 status.json 和进度看板

set -euo pipefail

# 项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-.}"

# 第一步：检查是否在活跃项目中
if [ ! -f "$PROJECT_ROOT/projects/active/iteration.txt" ]; then
    exit 0
fi

# 第二步：检查是否触发了状态更新
# 只在特定的工具执行后更新（Write、Edit、Bash）
# 通过检查是否有最近修改的任务文件来判断
iteration=$(cat "$PROJECT_ROOT/projects/active/iteration.txt")
tasks_dir="$PROJECT_ROOT/projects/active/iterations/${iteration}/tasks"

if [ ! -d "$tasks_dir" ]; then
    exit 0
fi

# 第三步：生成状态索引
# 检查 jq 是否可用
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq 未安装，无法生成状态索引"
    exit 0
fi

# 统计任务状态
pending_count=0
in_progress_count=0
completed_count=0

current_task="{}"
next_task="{}"

# 临时数组存储任务
pending_tasks=()

# 遍历任务文件
for task_file in "$tasks_dir"/TASK-*.md "$tasks_dir"/task-*.md; do
    if [ -f "$task_file" ]; then
        # 提取 YAML frontmatter 中的 status
        status=$(grep "^status:" "$task_file" | sed 's/status: *//;s/"//g' | head -1)

        task_id=$(basename "$task_file" .md)

        case "$status" in
            "pending")
                pending_count=$((pending_count + 1))
                pending_tasks+=("\"$task_id\"")
                ;;
            "in_progress")
                in_progress_count=$((in_progress_count + 1))
                current_task="\"$task_id\""
                ;;
            "completed"|"accepted")
                completed_count=$((completed_count + 1))
                ;;
        esac
    fi
done

total_tasks=$((pending_count + in_progress_count + completed_count))

# 确定下一个任务（优先 in_progress，否则第一个 pending）
if [ $in_progress_count -gt 0 ]; then
    next_task="$current_task"
elif [ $pending_count -gt 0 ]; then
    next_task="\"${pending_tasks[0]}\""
fi

# 第四步：更新 status.json
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json"

# 构造 pending_tasks 数组
pending_tasks_json=$(printf '%s\n' "${pending_tasks[@]}" | jq -R . | jq -s .)

cat > "$status_file" << EOF
{
  "iteration": $iteration,
  "current_task": $current_task,
  "pending_tasks": $pending_tasks_json,
  "progress": {
    "tasks_total": $total_tasks,
    "tasks_completed": $completed_count,
    "tasks_in_progress": $in_progress_count,
    "tasks_pending": $pending_count,
    "completion_percentage": $((completed_count * 100 / total_tasks))
  },
  "bugs": [],
  "blockers": [],
  "last_updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# 第五步：生成简洁的输出提示
if [ $completed_count -gt 0 ] && [ $completed_count -lt $total_tasks ]; then
    echo "📊 任务完成，状态已更新 ($completed_count/$total_tasks 完成，$((completed_count * 100 / total_tasks))%)"
fi

exit 0
