#!/bin/bash
# SessionStart Hook - 自动检测并恢复项目状态

# 日志文件
LOG_FILE="/tmp/agile-session-start.log"
echo "=== SessionStart Hook at $(date) ===" >> "$LOG_FILE"

# 获取项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-.}"

# 检查项目是否已初始化
if [ ! -f "$PROJECT_ROOT/projects/active/iteration.txt" ]; then
    echo "📋 Agile Flow: 项目未初始化" >&2
    echo "   提示: 告诉 AI \"开始\" 或使用 /agile-start 初始化项目" >&2
    exit 0
fi

# 检查是否暂停
if [ -f "$PROJECT_ROOT/projects/active/pause.flag" ]; then
    echo "⏸️  Agile Flow: 项目已暂停" >&2
    echo "   提示: 告诉 AI \"继续\" 或使用 /agile-start 恢复开发" >&2
    exit 0
fi

# 读取当前迭代
iteration=$(cat "$PROJECT_ROOT/projects/active/iteration.txt")
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json"

# 检查状态文件
if [ ! -f "$status_file" ]; then
    echo "⚠️  Agile Flow: 状态文件不存在" >&2
    echo "   提示: 告诉 AI \"查看进度\" 重新生成状态" >&2
    exit 0
fi

# 读取当前任务
current_task=$(jq -r '.current_task.id // empty' "$status_file" 2>/dev/null)
current_task_name=$(jq -r '.current_task.name // empty' "$status_file" 2>/dev/null)

# 读取待办任务
pending_count=$(jq -r '.pending_tasks | length' "$status_file" 2>/dev/null || echo "0")

# 读取进度
tasks_total=$(jq -r '.progress.tasks_total // 0' "$status_file" 2>/dev/null)
tasks_completed=$(jq -r '.progress.tasks_completed // 0' "$status_file" 2>/dev/null)

# 输出状态到 stderr（显示给用户）
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "🚀 Agile Flow: 项目已运行" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

if [ -n "$current_task" ] && [ "$current_task" != "null" ]; then
    echo "🔄 当前任务: $current_task - $current_task_name" >&2
    echo "   技能将自动继续执行" >&2
elif [ "$pending_count" -gt 0 ]; then
    next_task=$(jq -r '.pending_tasks[0].id' "$status_file" 2>/dev/null)
    next_task_name=$(jq -r '.pending_tasks[0].name' "$status_file" 2>/dev/null)
    next_priority=$(jq -r '.pending_tasks[0].priority' "$status_file" 2>/dev/null)
    echo "📋 待办任务: $pending_count 个" >&2
    echo "   下一个: $next_task - $next_task_name (优先级: $next_priority)" >&2
    echo "   提示: 告诉 AI 你想做什么，或等待自动执行" >&2
else
    echo "✅ 所有任务已完成" >&2
    echo "   提示: 告诉 AI 添加新任务，例如 \"p0: 实现新功能\"" >&2
fi

echo "" >&2
echo "📊 当前进度: $tasks_completed / $tasks_total 任务完成" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

exit 0
