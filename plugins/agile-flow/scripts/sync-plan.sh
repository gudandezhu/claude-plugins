#!/bin/bash
# Agile Flow - 同步 PLAN.md
# 从 status.json 和任务文件自动生成 PLAN.md

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== 同步 PLAN.md ==="

# 确保项目已初始化
if [ ! -f "projects/active/iteration.txt" ]; then
    echo "❌ 项目未初始化"
    exit 1
fi

iteration=$(cat projects/active/iteration.txt)
iteration_dir="projects/active/iterations/${iteration}"
status_file="$iteration_dir/status.json"
tasks_dir="$iteration_dir/tasks"
plan_file="ai-docs/PLAN.md"

# 读取迭代信息
iteration_name=$(jq -r '.iteration_name // "未命名迭代"' "$status_file")
current_task=$(jq -r '.current_task // empty' "$status_file")
tasks_total=$(jq -r '.progress.tasks_total // 0' "$status_file")
tasks_completed=$(jq -r '.progress.tasks_completed // 0' "$status_file")
completion_percentage=$(jq -r '.progress.completion_percentage // 0' "$status_file")

# 计算进度
if [ "$tasks_total" -gt 0 ]; then
    progress=$((tasks_completed * 100 / tasks_total))
else
    progress=0
fi

# 开始生成 PLAN.md
cat > "$plan_file" << EOF
# 工作计划和任务清单

## 当前迭代

**迭代编号**: ${iteration}
**迭代名称**: ${iteration_name}
**目标**: $([ -f "$iteration_dir/goals.md" ] && cat "$iteration_dir/goals.md" || echo "待定义")

## 任务清单

### 进行中 (In Progress)
EOF

# 获取当前任务
if [ -n "$current_task" ] && [ "$current_task" != "null" ]; then
    # 尝试从 current_task 中提取任务 ID
    current_task_id=$(echo "$current_task" | grep -oE 'TASK-[0-9]+' || echo "")

    if [ -n "$current_task_id" ] && [ -f "$tasks_dir/${current_task_id}.md" ]; then
        # 从任务文件读取详情
        task_name=$(grep '^name:' "$tasks_dir/${current_task_id}.md" | cut -d':' -f2 | xargs || echo "$current_task")
        task_priority=$(grep '^priority:' "$tasks_dir/${current_task_id}.md" | cut -d':' -f2 | xargs || echo "P2")
        echo "- **${current_task_id}**: ${task_name} (优先级: ${task_priority})" >> "$plan_file"
    else
        echo "- ${current_task}" >> "$plan_file"
    fi
else
    echo "- 无" >> "$plan_file"
fi

echo "" >> "$plan_file"
echo "### 待办 (Pending)" >> "$plan_file"
echo "" >> "$plan_file"

# 读取待办任务
pending_count=$(jq -r '.pending_tasks | length' "$status_file")
if [ "$pending_count" -gt 0 ]; then
    jq -r '.pending_tasks[] | "- **\(.id)**: \(.name) (优先级: \(.priority))"' "$status_file" >> "$plan_file"
else
    echo "- 无" >> "$plan_file"
fi

echo "" >> "$plan_file"
echo "### 已完成 (Completed)" >> "$plan_file"
echo "" >> "$plan_file"

# 读取已完成任务
completed_count=$(jq -r '.completed_tasks | length' "$status_file")
if [ "$completed_count" -gt 0 ]; then
    jq -r '.completed_tasks[] | "- \(.)"' "$status_file" >> "$plan_file"
else
    echo "- 无" >> "$plan_file"
fi

# 添加优先级说明
cat >> "$plan_file" << EOF

## 优先级说明

- **P0**: 关键任务，阻塞其他功能
- **P1**: 高优先级，重要但不阻塞
- **P2**: 中等优先级，可以延后
- **P3**: 低优先级，有时间再做

## 进度跟踪

- 总任务数: ${tasks_total}
- 已完成: ${tasks_completed}
- 完成率: ${progress}%

## 下一步

EOF

# 添加下一步计划
next_steps_count=$(jq -r '.next_steps | length' "$status_file")
if [ "$next_steps_count" -gt 0 ]; then
    jq -r '.next_steps[] | "- \(.)"' "$status_file" >> "$plan_file"
else
    echo "- 待规划" >> "$plan_file"
fi

echo "" >> "$plan_file"
echo "---" >> "$plan_file"
echo "" >> "$plan_file"
echo "**最后更新**: $(date '+%Y-%m-%d %H:%M:%S')" >> "$plan_file"

echo -e "${GREEN}✅ PLAN.md 已同步${NC}"
echo "   文件: ${plan_file}"
