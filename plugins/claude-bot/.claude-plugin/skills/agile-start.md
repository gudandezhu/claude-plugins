---
name: agile-start
description: 启动敏捷开发流程，检查状态并继续执行
version: 1.0.0
---

# Agile Start - 启动敏捷开发流程

## 任务
初始化或恢复敏捷开发流程，检查项目状态，获取下一个待执行任务。

---

## 执行流程

### 第一步：检查项目结构

```bash
# 确保项目目录存在
if [ ! -d "projects/active" ]; then
    echo "创建新项目..."
    mkdir -p projects/active/{iterations,backlog,knowledge-base}

    # 初始化配置
    cat > projects/active/config.json << EOF
{
  "defaultIterationLength": "1-week",
  "continuation": {
    "enabled": true,
    "autoStart": true,
    "maxIterations": 10,
    "pauseOnBugs": true,
    "pauseOnBlockers": true,
    "pauseOnIterationComplete": false,
    "taskTimeout": 14400
  },
  "contextLimits": {
    "maxTokens": 2000,
    "statusJsonMax": 500,
    "summaryMax": 300,
    "taskMax": 1000
  }
}
EOF

    # 初始化项目清单
    cat > projects/active/project-manifest.md << EOF
# 项目清单

## 项目目标
待定义

## 范围
待定义

## 干系人
待定义

## 技术栈
待定义
EOF

    echo "✅ 项目结构已创建"
fi
```

### 第二步：检查当前迭代

```bash
# 读取当前迭代编号
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
    echo "当前迭代: ${iteration}"
else
    # 创建迭代 1
    iteration=1
    echo $iteration > projects/active/iteration.txt

    # 创建迭代目录
    mkdir -p projects/active/iterations/${iteration}/{tasks,tests,development}

    # 初始化状态文件
    cat > projects/active/iterations/${iteration}/status.json << EOF
{
  "iteration": 1,
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "initialized",
  "progress": {
    "stories_completed": 0,
    "stories_total": 0,
    "tasks_completed": 0,
    "tasks_total": 0,
    "test_coverage": 0.0,
    "completion_percentage": 0
  },
  "current_task": null,
  "pending_tasks": [],
  "completed_tasks": [],
  "bugs": [],
  "blockers": [],
  "context_summary_path": "./summary.md",
  "dashboard_path": "./dashboard.html"
}
EOF

    echo "✅ 迭代 ${iteration} 已创建"
fi

iteration_dir="projects/active/iterations/${iteration}"
```

### 第三步：清理暂停标记

```bash
# 删除暂停标记（如果存在）
if [ -f "projects/active/pause.flag" ]; then
    echo "检测到暂停标记，已清除"
    rm -f projects/active/pause.flag
fi
```

### 第四步：加载状态

```bash
# 读取状态索引
if [ -f "${iteration_dir}/status.json" ]; then
    status_json=$(cat ${iteration_dir}/status.json)

    # 提取当前任务
    current_task_id=$(echo $status_json | jq -r '.current_task.id // empty')

    # 提取待办任务
    pending_count=$(echo $status_json | jq '.pending_tasks | length')

    echo "项目状态:"
    echo "  - 迭代: ${iteration}"
    echo "  - 当前进度: $(echo $status_json | jq -r '.progress.tasks_completed')/$(echo $status_json | jq -r '.progress.tasks_total') 任务完成"
    echo "  - 待办任务: ${pending_count}"
else
    echo "警告：状态文件不存在，将重新生成"
    /agile-dashboard
fi
```

### 第五步：获取下一个任务

```bash
# 优先级：current_task > pending_tasks[0]
if [ -n "$current_task_id" ] && [ "$current_task_id" != "null" ]; then
    # 有当前任务，继续执行
    next_task_id=$current_task_id
    echo "继续当前任务: ${next_task_id}"
elif [ "$pending_count" -gt 0 ]; then
    # 获取第一个待办任务
    next_task_id=$(echo $status_json | jq -r '.pending_tasks[0].id')
    echo "下一个待办任务: ${next_task_id}"
else
    # 无待办任务
    echo "当前无待办任务"

    # 检查是否需要创建下一迭代
    tasks_total=$(echo $status_json | jq -r '.progress.tasks_total')
    tasks_completed=$(echo $status_json | jq -r '.progress.tasks_completed')

    if [ "$tasks_total" -gt 0 ] && [ "$tasks_completed" -eq "$tasks_total" ]; then
        echo "✅ 当前迭代所有任务已完成"

        # 询问是否创建下一迭代
        echo "是否创建下一迭代？"
        echo "使用 /agile-retrospective 生成迭代回顾后，手动创建迭代 $((iteration + 1))"
        exit 0
    else
        echo "请先创建用户故事和任务卡片："
        echo "  1. /agile-product-analyze - 分析需求并创建用户故事"
        echo "  2. /agile-tech-design - 拆分技术任务"
        exit 0
    fi
fi
```

### 第六步：加载任务详情

```bash
# 读取任务卡片
task_file="${iteration_dir}/tasks/${next_task_id}.md"

if [ ! -f "$task_file" ]; then
    echo "错误：任务文件不存在 ${task_file}"
    exit 1
fi

task_md=$(cat $task_file)

# 提取任务元数据
task_name=$(grep '^name:' "$task_file" | cut -d: -f2 | xargs)
task_status=$(grep '^status:' "$task_file" | cut -d: -f2 | xargs)
task_story=$(grep '^story:' "$task_file" | cut -d: -f2 | xargs)
dependencies=$(grep '^dependencies:' "$task_file" | cut -d: -f2 | xargs)

echo "任务信息:"
echo "  - ID: ${next_task_id}"
echo "  - 名称: ${task_name}"
echo "  - 状态: ${task_status}"
echo "  - 关联故事: ${task_story}"
echo "  - 依赖: ${dependencies}"
```

### 第七步：检查依赖

```bash
# 检查依赖任务是否完成
if [ -n "$dependencies" ] && [ "$dependencies" != "[]" ]; then
    echo "检查依赖任务..."

    # 解析依赖数组（简单处理，实际应使用 jq）
    deps=$(echo $dependencies | sed 's/\[//;s/\]//;s/,//g')

    for dep in $deps; do
        dep_file="${iteration_dir}/tasks/${dep}.md"
        if [ -f "$dep_file" ]; then
            dep_status=$(grep '^status:' "$dep_file" | cut -d: -f2 | xargs)
            if [ "$dep_status" != "completed" ]; then
                echo "❌ 依赖任务 ${dep} 未完成（状态：${dep_status}）"
                echo "请先完成依赖任务"
                exit 1
            else
                echo "✅ 依赖任务 ${dep} 已完成"
            fi
        else
            echo "⚠️  依赖任务文件不存在 ${dep_file}"
        fi
    done
fi
```

### 第八步：读取上下文

```bash
# 读取项目摘要（可选，< 300 tokens）
if [ -f "${iteration_dir}/summary.md" ]; then
    echo ""
    echo "=== 项目摘要 ==="
    cat ${iteration_dir}/summary.md
    echo ""
fi

# 读取关联的用户故事（如需要）
if [ -n "$task_story" ] && [ "$task_story" != "null" ]; then
    story_file="projects/active/backlog/${task_story}.md"
    if [ -f "$story_file" ]; then
        echo "=== 用户故事背景 ==="
        head -30 "$story_file"
        echo ""
    fi
fi
```

### 第九步：输出执行指令

```
🎯 准备执行任务

## 任务信息
- ID: ${next_task_id}
- 名称: ${task_name}
- 状态: ${task_status}
- 关联故事: ${task_story}

## 任务详情
${task_md}

## 下一步操作
请使用以下命令开始执行任务:

/agile-develop-task ${next_task_id}

或使用 TDD 开发流程：
1. 编写测试用例
2. 运行测试（预期失败）
3. 编写最少代码使测试通过
4. 运行 pytest --cov（确保覆盖率 ≥ 80%）
5. 更新任务状态为 completed
```

---

## 使用示例

```bash
# 第一次启动（初始化项目）
/agile-start

# 后续启动（自动继续）
/agile-start

# 查看当前状态
/agile-dashboard
```

---

## 配置选项

在 `projects/active/config.json` 中配置：

```json
{
  "continuation": {
    "enabled": true,
    "autoStart": true
  }
}
```

- `enabled`: 是否启用持续运行模式
- `autoStart`: 启动时是否自动执行下一个任务

---

## 注意事项

1. **项目结构**：首次运行会自动创建目录结构
2. **状态文件**：status.json 是核心，由 /agile-dashboard 维护
3. **依赖检查**：确保依赖任务已完成才执行当前任务
4. **Token 预算**：加载的上下文应控制在 2000 tokens 以内
