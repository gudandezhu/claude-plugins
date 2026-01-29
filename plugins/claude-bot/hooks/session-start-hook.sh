#!/bin/bash
# SessionStart Hook - 显示项目状态
set -e

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

# 检查是否有待处理的自动继续标记
auto_continue_flag="$PROJECT_ROOT/projects/active/auto_continue.flag"
if [ -f "$auto_continue_flag" ]; then
    echo "" >&2
    echo "🔄 检测到待处理的任务完成" >&2
    completed_task=$(jq -r '.completed_task' "$auto_continue_flag" 2>/dev/null)
    echo "   任务: $completed_task" >&2
    echo "   提示: agile-continue 技能将自动运行测试和验收" >&2
    echo "" >&2
fi

exit 0
