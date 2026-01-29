#!/bin/bash
# SessionStart Hook - 显示项目状态和待处理标记

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

    echo ""
    return 1
}

# 获取项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-$(find_project_root || true)}"

if [ -z "$PROJECT_ROOT" ]; then
    # 没有找到项目根目录，静默退出
    exit 0
fi

# 读取当前迭代
iteration=$(cat "$PROJECT_ROOT/projects/active/iteration.txt" 2>/dev/null || echo "")
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json" 2>/dev/null

# 获取任务状态
pending_count=0
completed_count=0
current_task=""

if [ -f "$status_file" ] && command -v jq >/dev/null 2>&1; then
    pending_count=$(jq -r '.pending_tasks | length' "$status_file" 2>/dev/null || echo "0")
    completed_count=$(jq -r '.completed_tasks | length' "$status_file" 2>/dev/null || echo "0")
    current_task=$(jq -r '.current_task.id // empty' "$status_file" 2>/dev/null || echo "")
fi

# 检查是否有待处理的自动继续标记
auto_continue_flag="$PROJECT_ROOT/projects/active/auto_continue.flag"
has_auto_continue=false
completed_task=""

if [ -f "$auto_continue_flag" ]; then
    has_auto_continue=true
    if command -v jq >/dev/null 2>&1; then
        completed_task=$(jq -r '.completed_task // empty' "$auto_continue_flag" 2>/dev/null || echo "未知任务")
    fi
fi

# 检查是否暂停
pause_flag="$PROJECT_ROOT/projects/active/pause.flag"
is_paused=false
if [ -f "$pause_flag" ]; then
    is_paused=true
fi

# 输出状态信息（到 stderr）
echo "" >&2
echo "══════════════════════════════════════════" >&2
echo "🔄 agile-flow 项目已加载" >&2
echo "   项目: $PROJECT_ROOT" >&2
echo "   迭代: ${iteration} | 已完成: ${completed_count} | 待办: ${pending_count}" >&2

if [ -n "$current_task" ] && [ "$current_task" != "null" ]; then
    echo "   当前任务: $current_task" >&2
fi

if [ "$is_paused" = true ]; then
    echo "" >&2
    echo "⏸️  自动继续已暂停" >&2
    echo "   使用 /agile-start 恢复自动继续" >&2
fi

if [ "$has_auto_continue" = true ]; then
    echo "" >&2
    echo "✅ 检测到任务完成: $completed_task" >&2
    echo "   提示: 使用 /agile-continue 运行测试和验收" >&2
fi

echo "══════════════════════════════════════════" >&2
echo "" >&2

exit 0
