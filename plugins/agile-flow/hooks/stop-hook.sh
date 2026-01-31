#!/bin/bash
# Stop Hook - 显示项目状态和任务统计

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 输出到stderr
exec >&2

echo ""
echo -e "${BLUE}────────────────────────────────────${NC}"
echo -e "${GREEN}🔍 Agile Flow 项目状态${NC}"
echo -e "${BLUE}────────────────────────────────────${NC}"
echo ""

# 检查项目是否已初始化
if [ ! -d "projects/active" ]; then
    echo -e "${YELLOW}⚠️  项目未初始化${NC}"
    echo "   使用 /agile-start 初始化项目"
    echo ""
    exit 0
fi

# 读取迭代信息
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
    status_file="projects/active/iterations/${iteration}/status.json"

    if [ -f "$status_file" ]; then
        iteration_name=$(jq -r '.iteration_name // "未命名迭代"' "$status_file")
        current_task=$(jq -r '.current_task // empty' "$status_file")
        tasks_total=$(jq -r '.progress.tasks_total // 0' "$status_file")
        tasks_completed=$(jq -r '.progress.tasks_completed // 0' "$status_file")
        completion_percentage=$(jq -r '.progress.completion_percentage // 0' "$status_file")

        echo -e "${GREEN}📊 迭代 ${iteration}: ${iteration_name}${NC}"
        echo "   进度: ${tasks_completed}/${tasks_total} (${completion_percentage}%)"
        echo ""

        # 显示当前任务
        if [ -n "$current_task" ] && [ "$current_task" != "null" ]; then
            echo -e "${YELLOW}🔄 当前任务:${NC}"
            echo "   ${current_task}"
            echo ""
        fi

        # 显示待办任务数量
        pending_count=$(jq -r '.pending_tasks | length' "$status_file")
        if [ "$pending_count" -gt 0 ]; then
            echo -e "${YELLOW}📋 待办任务: ${pending_count} 个${NC}"
        fi

        # 显示BUG
        bugs_count=$(jq -r '.bugs | length' "$status_file")
        if [ "$bugs_count" -gt 0 ]; then
            echo -e "${YELLOW}🐛 BUG: ${bugs_count} 个${NC}"
        fi
    fi
fi

echo ""
echo -e "${BLUE}────────────────────────────────────${NC}"
echo -e "${GREEN}💡 下一步操作${NC}"
echo -e "${BLUE}────────────────────────────────────${NC}"
echo ""
echo "继续当前任务: /agile-continue"
echo "添加新任务:   /agile-add-task"
echo "查看仪表盘:   /agile-dashboard"
echo "暂停流程:     /agile-pause"
echo ""
exit 0
