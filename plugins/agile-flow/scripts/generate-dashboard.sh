#!/bin/bash
# Agile Flow - 生成项目状态看板
set -e

echo "=== 项目状态看板 ==="

# 确定当前迭代
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
else
    echo "⚠️  项目未初始化"
    exit 1
fi

iteration_dir="projects/active/iterations/${iteration}"
status_file="$iteration_dir/status.json"

# 读取状态
if [ -f "$status_file" ]; then
    current_task=$(jq -r '.current_task // empty' "$status_file")
    tasks_total=$(jq -r '.progress.tasks_total // 0' "$status_file")
    tasks_completed=$(jq -r '.progress.tasks_completed // 0' "$status_file")
    test_coverage=$(jq -r '.progress.test_coverage // 0' "$status_file")
else
    echo "⚠️  状态文件不存在，正在生成..."
    exit 1
fi

# 读取待办任务
pending_tasks=$(jq -r '.pending_tasks | length' "$status_file" 2>/dev/null || echo "0")

# 计算进度
if [ "$tasks_total" -gt 0 ]; then
    progress=$((tasks_completed * 100 / tasks_total))
else
    progress=0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 敏捷开发进度看板"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📈 迭代进度"
echo "  迭代: ${iteration}"
echo "  任务: ${tasks_completed}/${tasks_total} (${progress}%)"
echo "  测试覆盖率: ${test_coverage}%"
echo ""

if [ -n "$current_task" ] && [ "$current_task" != "null" ]; then
    echo "🔄 当前任务"
    echo "  ${current_task}"
    echo ""
fi

if [ "$pending_tasks" -gt 0 ]; then
    echo "📋 待办任务: ${pending_tasks} 个"
    jq -r '.pending_tasks[:3] | .[] | "  - \(.id): \(.name) (优先级: \(.priority))"' "$status_file" 2>/dev/null || true
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
