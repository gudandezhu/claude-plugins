#!/bin/bash
# Agile Flow - 添加任务
set -e

user_input="$1"

if [ -z "$user_input" ]; then
    echo "❌ 请提供任务描述"
    echo "使用格式: p0: 任务描述 或 P1: 任务描述"
    exit 1
fi

# 解析优先级（默认 P2）
priority=$(echo "$user_input" | grep -oE '^[pP][0-3]' | tr '[:lower:]' '[:upper:]' || echo "P2")

# 提取任务描述
description=$(echo "$user_input" | sed -E 's/^[pP][0-3]:\s*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$description" ]; then
    echo "❌ 任务描述不能为空"
    exit 1
fi

echo "✅ 解析成功: 优先级=$priority, 描述=$description"

# 确保项目已初始化
if [ ! -f "projects/active/iteration.txt" ]; then
    echo "❌ 项目未初始化，请先运行 /agile-start"
    exit 1
fi

iteration=$(cat projects/active/iteration.txt)
iteration_dir="projects/active/iterations/${iteration}"
tasks_dir="$iteration_dir/tasks"

# 确保目录存在
mkdir -p "$tasks_dir"

# 读取现有任务数量
task_count=$(ls -1 "$tasks_dir"/TASK-*.md 2>/dev/null | wc -l | xargs)
new_task_num=$((task_count + 1))
task_id=$(printf "TASK-%03d" $new_task_num)

# 生成任务卡片
task_file="$tasks_dir/${task_id}.md"
current_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > "$task_file" << EOF
---
id: ${task_id}
name: ${description}
status: pending
priority: ${priority}
story: null
dependencies: []
acceptance_criteria: []
related_files: []
created_at: "${current_time}"
updated_at: "${current_time}"
---

# ${task_id}: ${description}

## 任务描述

${description}

## 验收标准

- [ ] 功能正常工作
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 代码通过 Linting

## 相关文件

待添加

## 依赖任务

无
EOF

echo "✅ 任务已创建: ${task_id}"
echo "   文件: ${task_file}"

# 更新状态文件（如果存在）
status_file="$iteration_dir/status.json"
if [ -f "$status_file" ]; then
    # 添加新任务到 pending_tasks
    jq --arg id "$task_id" \
       --arg name "$description" \
       --arg priority "$priority" \
       '.pending_tasks += [{"id": $id, "name": $name, "priority": $priority}] | .progress.tasks_total += 1' \
       "$status_file" > "${status_file}.tmp" && mv "${status_file}.tmp" "$status_file"
    echo "✅ 状态文件已更新"
fi
