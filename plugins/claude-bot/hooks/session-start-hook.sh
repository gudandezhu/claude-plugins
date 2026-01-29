#!/bin/bash
# SessionStart Hook - 显示项目状态
set -e

# 获取项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-.}"

# 检查项目是否已初始化
if [ ! -f "$PROJECT_ROOT/projects/active/iteration.txt" ]; then
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
