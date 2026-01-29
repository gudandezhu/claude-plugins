---
name: agile-add-task
description: 用户随时添加任务并指定优先级。解析用户输入（如 "p0: 实现用户登录"），创建任务卡片，更新 status.json 和 PLAN.md
version: 1.0.0
---

# Agile Add Task - 添加任务技能

## 任务

解析用户输入的任务描述和优先级，创建任务卡片，更新项目状态。

---

## 执行流程

### 第一步：解析用户输入

用户输入格式示例：
- `p0: 实现用户登录功能`
- `P1: 添加数据导出功能`
- `实现文件上传功能`（默认 P2）

```bash
# 获取用户输入
user_input="$1"

# 解析优先级（默认 P2）
priority=$(echo "$user_input" | grep -oE '^[pP][0-3]' | tr '[:lower:]' '[:upper:]' || echo "P2")

# 提取任务描述
description=$(echo "$user_input" | sed -E 's/^[pP][0-3]:\s*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$description" ]; then
    echo "❌ 任务描述不能为空"
    echo "使用格式: p0: 任务描述 或 P1: 任务描述"
    exit 1
fi

echo "✅ 解析成功"
echo "优先级: $priority"
echo "描述: $description"
```

### 第二步：读取项目状态

```bash
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
```

### 第三步：生成任务卡片

```bash
task_file="$tasks_dir/${task_id}.md"

# 获取当前时间
current_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 生成任务卡片
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
- [ ] 代码通过类型检查

## 技术要点

待定义

## 相关文件

待添加

## 依赖任务

无

## 备注

用户通过自然语言添加的任务
EOF

echo "✅ 任务卡片已创建: $task_file"
```

### 第四步：更新 status.json

```bash
status_file="$iteration_dir/status.json"

# 检查 status.json 是否存在
if [ ! -f "$status_file" ]; then
    echo "警告：status.json 不存在，将创建新文件"
    cat > "$status_file" << EOF
{
  "iteration": ${iteration},
  "updated_at": "${current_time}",
  "status": "in_progress",
  "progress": {
    "stories_completed": 0,
    "stories_total": 0,
    "tasks_completed": 0,
    "tasks_total": 1,
    "test_coverage": 0.0,
    "completion_percentage": 0
  },
  "current_task": null,
  "pending_tasks": [],
  "completed_tasks": [],
  "bugs": [],
  "blockers": []
}
EOF
fi

# 使用 jq 添加新任务到 pending_tasks，并按优先级排序
if command -v jq &> /dev/null; then
    jq \
        --arg id "$task_id" \
        --arg name "$description" \
        --arg priority "$priority" \
        '
            # 添加新任务
            .pending_tasks += [{
                id: $id,
                name: $name,
                priority: $priority,
                status: "pending",
                blocked_by: []
            }] |
            # 按优先级排序（P0 > P1 > P2 > P3）
            .pending_tasks |= sort_by(.priority) |
            # 更新统计
            .progress.tasks_total += 1 |
            .updated_at = "'"$current_time"'"
        ' \
        "$status_file" > "${status_file}.tmp"

    mv "${status_file}.tmp" "$status_file"
    echo "✅ status.json 已更新并按优先级排序"
else
    echo "⚠️  jq 未安装，无法更新 status.json"
fi
```

### 第五步：更新 PLAN.md

```bash
plan_file="ai-docs/PLAN.md"

if [ -f "$plan_file" ]; then
    # 添加到待办列表
    # 根据 priority 决定添加位置
    case "$priority" in
        "P0")
            section_header="### 待办 (Pending)"
            ;;
        "P1")
            section_header="### 待办 (Pending)"
            ;;
        *)
            section_header="### 待办 (Pending)"
            ;;
    esac

    # 检查是否已存在 "待办" 部分
    if grep -q "$section_header" "$plan_file"; then
        # 在待办部分添加任务
        awk -v task_id="$task_id" \
            -v description="$description" \
            -v priority="$priority" \
            -v section="$section_header" \
            '
            $0 == section {
                print
                print ""
                print "- ["priority"] " task_id ": " description
                next
            }
            { print }
            ' "$plan_file" > "${plan_file}.tmp"

        mv "${plan_file}.tmp" "$plan_file"
    else
        # 如果没有待办部分，添加到文件末尾
        cat >> "$plan_file" << EOF

$section_header
- [$priority] $task_id: $description
EOF
    fi

    # 更新进度统计
    total_tasks=$(jq -r '.progress.tasks_total' "$status_file" 2>/dev/null || echo "1")
    completed_tasks=$(jq -r '.progress.tasks_completed' "$status_file" 2>/dev/null || echo "0")

    # 更新进度
    sed -i.bak "s/- 总任务数: [0-9]*/- 总任务数: $total_tasks/" "$plan_file" 2>/dev/null || true
    sed -i.bak "s/- 已完成: [0-9]*/- 已完成: $completed_tasks/" "$plan_file" 2>/dev/null || true

    echo "✅ PLAN.md 已更新"
else
    echo "⚠️  PLAN.md 不存在，跳过更新"
fi
```

### 第六步：触发 Dashboard 更新

```bash
# 提示用户查看进度
echo ""
echo "📊 任务已添加，可以运行 /agile-dashboard 查看更新后的进度"
```

---

## 📤 输出结果

```markdown
✅ 任务已添加

**任务 ID**: TASK-003
**优先级**: P0
**描述**: 实现用户登录功能
**状态**: pending

**下一步**:
- 运行 /agile-dashboard 查看进度
- 运行 /agile-develop-task TASK-003 开始开发
```

---

## 优先级说明

| 优先级 | 说明 | 示例 |
|--------|------|------|
| **P0** | 关键任务，阻塞其他功能 | 用户认证、核心数据流 |
| **P1** | 高优先级，重要但不阻塞 | 数据导出、报表功能 |
| **P2** | 中等优先级，可以延后 | UI 优化、辅助功能 |
| **P3** | 低优先级，有时间再做 | 文档完善、锦上添花 |

---

## 使用示例

```bash
# 用户说以下话术时，自动触发此技能

# 指定优先级
"p0: 实现用户登录功能"
"P1: 添加数据导出功能"
"p2: 优化页面加载速度"
"p3: 完善文档"

# 不指定优先级（默认 P2）
"实现文件上传功能"
"添加用户设置页面"

# 更简洁的方式
"添加登录功能"
"实现导出功能"
"创建用户管理"
"开发支付接口"

# 问题形式
"能帮我添加一个功能吗？"
"我要实现一个新的需求"
"有个新任务要做"

# 需求描述
"我需要一个用户注册功能"
"想要实现数据备份"
"能不能加个搜索功能"
```

---

## 触发条件

此技能在以下情况下触发：

1. **优先级标记**：用户输入包含 `p0:`、`P0:`、`p1:`、`P1:` 等优先级标记
2. **动词开头**：用户输入以 "添加"、"实现"、"创建"、"开发"、"新增" 等动词开头
3. **需求描述**：用户说 "我需要"、"我想要"、"能不能"、"有个" 等表达需求的方式
4. **问题形式**：用户问 "能帮我"、"能添加" 等寻求帮助的问题
5. **明确表示**：用户明确表示要添加新任务或功能

---

## 注意事项

1. **任务 ID 自动生成**: TASK-001, TASK-002, ...
2. **优先级不区分大小写**: p0 和 P0 等效
3. **默认优先级**: 不指定时默认为 P2
4. **文件位置**: 任务卡片保存在 `projects/active/iterations/{n}/tasks/`
5. **自动排序**: P0 任务会在 status.json 中排在前面

---

## 相关技能

- `/agile-tech-design` - 拆分复杂任务为子任务
- `/agile-develop-task` - 执行任务开发
- `/agile-dashboard` - 查看任务进度
