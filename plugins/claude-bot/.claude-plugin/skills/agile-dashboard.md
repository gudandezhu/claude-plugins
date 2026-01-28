---
name: agile-dashboard
description: 生成状态索引（status.json）和进度看板（dashboard.html + summary.md）
version: 1.0.0
---

# Agile Dashboard - 状态索引生成器

## 任务
读取项目中的所有任务、用户故事、测试结果，生成结构化的状态索引（status.json）和进度看板（dashboard.html、summary.md）。

---

## 执行流程

### 第一步：读取项目状态

```bash
# 确定当前迭代
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
else
    # 如果不存在，创建迭代 1
    iteration=1
    echo $iteration > projects/active/iteration.txt
fi

iteration_dir="projects/active/iterations/${iteration}"

# 读取所有任务卡片
tasks=()
for task_file in ${iteration_dir}/tasks/task-*.md; do
    if [ -f "$task_file" ]; then
        # 提取 YAML frontmatter
        yaml=$(sed -n '/^---$/,/^---$/{ /^---$/d; /^---$/d; p; }' "$task_file")
        tasks+=("$yaml")
    fi
done

# 读取所有用户故事
stories=()
for story_file in projects/active/backlog/story-*.md; do
    if [ -f "$story_file" ]; then
        yaml=$(sed -n '/^---$/,/^---$/{ /^---$/d; /^---$/d; p; }' "$story_file")
        stories+=("$yaml")
    fi
done

# 读取所有缺陷
bugs=()
for bug_file in projects/active/backlog/bug-*.md; do
    if [ -f "$bug_file" ]; then
        yaml=$(sed -n '/^---$/,/^---$/{ /^---$/d; /^---$/d; p; }' "$bug_file")
        bugs+=("$yaml")
    fi
done
```

### 第二步：统计进度

```bash
# 统计任务状态
pending_tasks=()
in_progress_tasks=()
completed_tasks=()

for task in "${tasks[@]}"; do
    status=$(echo "$task" | grep '^status:' | cut -d: -f2 | xargs)

    case "$status" in
        "pending")
            pending_tasks+=("$task")
            ;;
        "in_progress")
            in_progress_tasks+=("$task")
            ;;
        "completed"|"pending_acceptance")
            completed_tasks+=("$task")
            ;;
    esac
done

total_tasks=${#tasks[@]}
completed_count=${#completed_tasks[@]}
progress_percentage=$((completed_count * 100 / total_tasks))
```

### 第三步：确定当前任务

```bash
# 优先级：in_progress > pending
if [ ${#in_progress_tasks[@]} -gt 0 ]; then
    current_task_yaml=${in_progress_tasks[0]}
elif [ ${#pending_tasks[@]} -gt 0 ]; then
    # 检查依赖是否满足
    for task in "${pending_tasks[@]}"; do
        dependencies=$(echo "$task" | grep '^dependencies:' | cut -d: -f2 | xargs)
        if [ -z "$dependencies" ] || [ "$dependencies" == "[]" ]; then
            current_task_yaml=$task
            break
        fi
    done
fi
```

### 第四步：生成 status.json

```bash
cat > ${iteration_dir}/status.json << EOF
{
  "iteration": $iteration,
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "$(if [ ${#in_progress_tasks[@]} -gt 0 ] || [ ${#pending_tasks[@]} -gt 0 ]; then echo "in_progress"; else echo "completed"; fi)",
  "progress": {
    "stories_completed": $(grep -l "status: completed" projects/active/backlog/story-*.md 2>/dev/null | wc -l),
    "stories_total": ${#stories[@]},
    "tasks_completed": $completed_count,
    "tasks_total": $total_tasks,
    "test_coverage": 0.0,
    "completion_percentage": $progress_percentage
  },
  "current_task": $(parse_task_yaml_to_json "$current_task_yaml"),
  "pending_tasks": $(parse_tasks_array_to_json "${pending_tasks[@]}"),
  "completed_tasks": $(parse_tasks_array_to_json "${completed_tasks[@]}"),
  "bugs": $(parse_bugs_array_to_json "${bugs[@]}"),
  "blockers": [],
  "context_summary_path": "./summary.md",
  "dashboard_path": "./dashboard.html"
}
EOF

echo "✅ status.json 已生成 (${iteration_dir}/status.json)"
```

**status.json 结构说明**：

```json
{
  "iteration": 1,                    // 当前迭代编号
  "updated_at": "2026-01-28T22:30:00Z",
  "status": "in_progress",           // overall status
  "progress": {
    "stories_completed": 2,
    "stories_total": 5,
    "tasks_completed": 12,
    "tasks_total": 18,
    "test_coverage": 0.82,
    "completion_percentage": 67
  },
  "current_task": {                  // 当前正在执行的任务
    "id": "TASK-303",
    "name": "实现购物车组件",
    "status": "in_progress",
    "story_id": "story-003",
    "acceptance_criteria": [...],
    "related_files": [...]
  },
  "pending_tasks": [                 // 待办任务列表
    {
      "id": "TASK-304",
      "name": "实现数量修改",
      "blocked_by": ["TASK-303"],
      "priority": 1
    }
  ],
  "completed_tasks": [...],
  "bugs": [...],
  "blockers": [],
  "context_summary_path": "./summary.md",
  "dashboard_path": "./dashboard.html"
}
```

### 第五步：生成 summary.md（上下文摘要）

```bash
cat > ${iteration_dir}/summary.md << EOF
# Iteration ${iteration} Context Summary

## Project Goal
$(cat projects/active/project-manifest.md 2>/dev/null | grep -A 5 "## 项目目标" || echo "待定义")

## Completed Features (Iteration ${iteration})
EOF

# 添加已完成的用户故事
for story_file in projects/active/backlog/story-*.md; do
    status=$(grep '^status:' "$story_file" | cut -d: -f2 | xargs)
    if [ "$status" == "completed" ]; then
        story_id=$(basename "$story_file" .md)
        story_title=$(grep '^#' "$story_file" | head -1 | sed 's/^# //')
        echo "1. **${story_id}**: ${story_title}" >> ${iteration_dir}/summary.md
    fi
done

cat >> ${iteration_dir}/summary.md << EOF

## In Progress
$(if [ ${#in_progress_tasks[@]} -gt 0 ]; then
    for task in "${in_progress_tasks[@]}"; do
        task_id=$(echo "$task" | grep '^id:' | cut -d: -f2 | xargs)
        task_name=$(echo "$task" | grep '^name:' | cut -d: -f2 | xargs)
        echo "- **${task_id}**: ${task_name}"
    done
else
    echo "No tasks in progress"
fi)

## Technical Decisions
$(cat projects/active/knowledge-base/technical-decisions.md 2>/dev/null | tail -10 || echo "无")

## Key Domain Concepts
$(cat projects/active/knowledge-base/domain-concepts.md 2>/dev/null | head -20 || echo "无")

## Current Architecture
\`\`\`
projects/active/
├── iterations/${iteration}/
│   ├── tasks/           # 任务卡片
│   ├── tests/           # 测试文档
│   ├── status.json      # 状态索引
│   ├── summary.md       # 上下文摘要
│   └── dashboard.html   # 进度看板
├── backlog/            # 产品待办
└── knowledge-base/     # 知识库
\`\`\`

## Next Steps
1. $(if [ -n "$current_task_yaml" ]; then
    task_id=$(echo "$current_task_yaml" | grep '^id:' | cut -d: -f2 | xargs)
    echo "Complete ${task_id}"
else
    echo "Review and plan next iteration"
fi)
EOF

echo "✅ summary.md 已生成 (${iteration_dir}/summary.md)"
```

### 第六步：生成 dashboard.html（人类查看）

```bash
cat > ${iteration_dir}/dashboard.html << EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iteration ${iteration} - 进度看板</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .progress { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .progress-bar { height: 30px; background: #e0e0e0; border-radius: 15px; overflow: hidden; margin-top: 10px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
        .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .task { border-left: 4px solid #2196F3; padding: 10px; margin-bottom: 10px; background: #f9f9f9; }
        .task.completed { border-left-color: #4CAF50; }
        .task.in-progress { border-left-color: #FF9800; }
        .task.pending { border-left-color: #9E9E9E; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge.success { background: #4CAF50; color: white; }
        .badge.warning { background: #FF9800; color: white; }
        .badge.info { background: #2196F3; color: white; }
        h1 { margin: 0; color: #333; }
        h2 { color: #666; margin-top: 0; }
        .stat { display: inline-block; margin-right: 20px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2196F3; }
        .stat-label { font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 迭代 ${iteration} 进度看板</h1>
            <p style="color: #666; margin-top: 5px;">更新时间: $(date +'%Y-%m-%d %H:%M:%S')</p>
        </div>

        <div class="progress">
            <div class="stat">
                <div class="stat-value">${completed_count}/${total_tasks}</div>
                <div class="stat-label">任务完成</div>
            </div>
            <div class="stat">
                <div class="stat-value">${progress_percentage}%</div>
                <div class="stat-label">完成率</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress_percentage}%">${progress_percentage}%</div>
            </div>
        </div>

        <div class="section">
            <h2>🎯 当前任务</h2>
            $(if [ -n "$current_task_yaml" ]; then
                task_id=$(echo "$current_task_yaml" | grep '^id:' | cut -d: -f2 | xargs)
                task_name=$(echo "$current_task_yaml" | grep '^name:' | cut -d: -f2 | xargs)
                task_status=$(echo "$current_task_yaml" | grep '^status:' | cut -d: -f2 | xargs)
                echo "<div class='task in-progress'>"
                echo "<strong>${task_id}</strong>: ${task_name}"
                echo "<span class='badge info'>${task_status}</span>"
                echo "</div>"
            else
                echo "<p>暂无进行中的任务</p>"
            fi)
        </div>

        <div class="section">
            <h2>✅ 已完成 (${#completed_tasks[@]})</h2>
            $(for task in "${completed_tasks[@]}"; do
                task_id=$(echo "$task" | grep '^id:' | cut -d: -f2 | xargs)
                task_name=$(echo "$task" | grep '^name:' | cut -d: -f2 | xargs)
                echo "<div class='task completed'>"
                echo "<strong>${task_id}</strong>: ${task_name}"
                echo "<span class='badge success'>completed</span>"
                echo "</div>"
            done)
        </div>

        <div class="section">
            <h2>⏳ 待办 (${#pending_tasks[@]})</h2>
            $(for task in "${pending_tasks[@]}"; do
                task_id=$(echo "$task" | grep '^id:' | cut -d: -f2 | xargs)
                task_name=$(echo "$task" | grep '^name:' | cut -d: -f2 | xargs)
                dependencies=$(echo "$task" | grep '^dependencies:' | cut -d: -f2 | xargs)
                echo "<div class='task pending'>"
                echo "<strong>${task_id}</strong>: ${task_name}"
                if [ -n "$dependencies" ] && [ "$dependencies" != "[]" ]; then
                    echo "<br><small style='color: #666;'>依赖: ${dependencies}</small>"
                fi
                echo "</div>"
            done)
        </div>

        $(if [ ${#bugs[@]} -gt 0 ]; then
            echo "<div class='section'>"
            echo "<h2>🐛 缺陷 (${#bugs[@]})</h2>"
            for bug in "${bugs[@]}"; do
                bug_id=$(echo "$bug" | grep '^id:' | cut -d: -f2 | xargs)
                bug_desc=$(echo "$bug" | grep '^description:' | cut -d: -f2 | xargs)
                severity=$(echo "$bug" | grep '^severity:' | cut -d: -f2 | xargs)
                echo "<div class='task' style='border-left-color: #f44336;'>"
                echo "<strong>${bug_id}</strong>: ${bug_desc}"
                echo "<span class='badge warning'>${severity}</span>"
                echo "</div>"
            done
            echo "</div>"
        fi)
    </div>
</body>
</html>
EOF

echo "✅ dashboard.html 已生成 (${iteration_dir}/dashboard.html)"
```

### 第七步：输出查看方式

```bash
echo ""
echo "📊 进度看板已生成！"
echo ""
echo "查看方式："
echo "  1. 浏览器打开: file://$(pwd)/${iteration_dir}/dashboard.html"
echo "  2. VS Code: 右键 dashboard.html → Open in Default Browser"
echo "  3. 命令行: python -m http.server 8000 → 访问 http://localhost:8000"
echo ""
echo "状态文件："
echo "  - status.json: ${iteration_dir}/status.json"
echo "  - summary.md: ${iteration_dir}/summary.md"
echo "  - dashboard.html: ${iteration_dir}/dashboard.html"
```

---

## Token 控制

确保生成的文件大小控制在以下范围：

- ✅ **status.json** < 500 tokens（~2000 字符）
- ✅ **summary.md** < 300 tokens（~1200 字符）
- ✅ **dashboard.html** 不限（仅人类查看）

**压缩策略**：
- pending_tasks 只保留前 10 个
- completed_tasks 只保留 ID 和名称
- bugs 只保留 ID、描述、严重程度

---

## 使用示例

```bash
# 手动触发生成
/agile-dashboard

# 自动触发（PostToolUse hook）
# 每次任务状态更新后自动执行
```

---

## 注意事项

1. **JSON 格式验证**：生成的 status.json 必须是有效的 JSON
2. **文件编码**：所有文件使用 UTF-8 编码
3. **时间格式**：使用 ISO 8601 格式（UTC）
4. **路径处理**：使用绝对路径或相对于项目根目录的路径
