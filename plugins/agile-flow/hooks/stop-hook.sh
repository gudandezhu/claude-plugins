#!/bin/bash
# Stop Hook - 强制返回状态2，提示继续迭代或规划新迭代

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
    # 没有找到项目根目录，直接返回状态2
    exit 2
fi

# 读取当前迭代
iteration=$(cat "$PROJECT_ROOT/projects/active/iteration.txt" 2>/dev/null || echo "")
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json" 2>/dev/null

# 检查状态文件和待办任务
pending_count=0
if [ -f "$status_file" ] && command -v jq >/dev/null 2>&1; then
    pending_count=$(jq -r '.pending_tasks | length' "$status_file" 2>/dev/null || echo "0")
fi

# 输出提示到 stderr
if [ "$pending_count" -gt 0 ]; then
    echo "" >&2
    echo "🔄 当前迭代还有 ${pending_count} 个待办任务，请继续执行迭代任务。" >&2
    echo "   使用 agile-continue 继续下一个任务" >&2
    echo "" >&2
else
    echo "" >&2
    echo "✅ 当前迭代所有任务已完成！" >&2
    echo "   请规划新迭代或进行回顾总结" >&2
    echo "" >&2
fi

# 强制返回状态2，告诉 Claude Code 继续执行
exit 2
