#!/bin/bash
# PostToolUse Hook - 自动化任务管理：检测任务完成、触发 agile-continue 技能

# 日志文件
LOG_FILE="/tmp/agile-post-tool-use.log"
echo "=== PostToolUse Hook at $(date) ===" >> "$LOG_FILE"
echo "Tool: $TOOL_NAME" >> "$LOG_FILE"

# 获取项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-.}"

# 检查项目是否已初始化
if [ ! -f "$PROJECT_ROOT/projects/active/iteration.txt" ]; then
    exit 0
fi

# 检查是否暂停
if [ -f "$PROJECT_ROOT/projects/active/pause.flag" ]; then
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
current_task_id=$(jq -r '.current_task.id // empty' "$status_file" 2>/dev/null)

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

# 如果任务已完成，触发后续流程
if [ "$task_status" = "completed" ]; then
    echo "" >&2
    echo "✅ 任务完成: $current_task_id" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

    # 记录到日志
    echo "Task completed: $current_task_id" >> "$LOG_FILE"

    # 创建自动继续标记
    cat > "$PROJECT_ROOT/projects/active/auto_continue.flag" << EOF
{
  "completed_task": "$current_task_id",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "iteration": "$iteration"
}
EOF

    # 输出提示信息
    echo "🧪 自动化流程已触发:" >&2
    echo "  - agile-continue 技能将自动运行测试和验收" >&2
    echo "  - 更新文档（ACCEPTANCE.md、PLAN.md）" >&2
    echo "  - 继续下一个优先级最高的任务" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
fi

exit 0
