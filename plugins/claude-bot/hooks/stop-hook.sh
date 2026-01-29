#!/bin/bash
# Stop Hook - 保存进度、生成会话总结、更新文档

# 日志文件
LOG_FILE="/tmp/agile-stop-hook.log"
echo "=== Stop Hook at $(date) ===" >> "$LOG_FILE"
echo "Working directory: $(pwd)" >> "$LOG_FILE"

# 获取项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-.}"

# 检查项目是否已初始化
if [ ! -f "$PROJECT_ROOT/projects/active/iteration.txt" ]; then
    exit 0
fi

# 读取当前迭代
iteration=$(cat "$PROJECT_ROOT/projects/active/iteration.txt")
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json"

# 检查状态文件
if [ ! -f "$status_file" ]; then
    exit 0
fi

# 提取进度信息
tasks_total=$(jq -r '.progress.tasks_total // 0' "$status_file" 2>/dev/null)
tasks_completed=$(jq -r '.progress.tasks_completed // 0' "$status_file" 2>/dev/null)
completion=$(jq -r '.progress.completion_percentage // 0' "$status_file" 2>/dev/null)

# 读取当前任务
current_task_id=$(jq -r '.current_task.id // empty' "$status_file" 2>/dev/null)
current_task_name=$(jq -r '.current_task.name // empty' "$status_file" 2>/dev/null)

# 读取待办任务数
pending_count=$(jq -r '.pending_tasks | length' "$status_file" 2>/dev/null || echo "0")

# 记录到日志
echo "Progress: ${tasks_completed}/${tasks_total} (${completion}%)" >> "$LOG_FILE"
echo "Iteration: ${iteration}" >> "$LOG_FILE"

# 生成会话总结
SESSION_SUMMARY="$PROJECT_ROOT/projects/active/last_session_summary.md"

cat > "$SESSION_SUMMARY" << EOF
# 会话总结

**时间**: $(date '+%Y-%m-%d %H:%M:%S')
**迭代**: ${iteration}

## 进度概览

- 总任务数: ${tasks_total}
- 已完成: ${tasks_completed}
- 完成率: ${completion}%
- 待办任务: ${pending_count}个

EOF

# 如果有当前任务，添加到总结
if [ -n "$current_task_id" ] && [ "$current_task_id" != "null" ]; then
    cat >> "$SESSION_SUMMARY" << EOF
## 当前任务

- **ID**: ${current_task_id}
- **名称**: ${current_task_name}
- **状态**: 进行中

EOF
fi

# 添加下一步行动
cat >> "$SESSION_SUMMARY" << EOF
## 下一步行动

EOF

if [ "$pending_count" -gt 0 ]; then
    next_task_id=$(jq -r '.pending_tasks[0].id' "$status_file" 2>/dev/null)
    next_task_name=$(jq -r '.pending_tasks[0].name' "$status_file" 2>/dev/null)
    cat >> "$SESSION_SUMMARY" << EOF
1. 继续下一个任务: ${next_task_id} - ${next_task_name}
2. 或添加新任务

EOF
else
    cat >> "$SESSION_SUMMARY" << EOF
1. 添加新任务
2. 或生成迭代回顾

EOF
fi

# 输出会话总结到 stderr（显示给用户）
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "📊 会话总结" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "迭代: ${iteration}" >&2
echo "进度: ${tasks_completed}/${tasks_total} (${completion}%)" >&2
echo "待办: ${pending_count} 个任务" >&2

if [ -n "$current_task_id" ] && [ "$current_task_id" != "null" ]; then
    echo "当前: ${current_task_id} - ${current_task_name}" >&2
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

exit 0
