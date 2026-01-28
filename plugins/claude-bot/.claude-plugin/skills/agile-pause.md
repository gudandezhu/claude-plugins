---
name: agile-pause
description: 暂停自动继续模式
version: 1.0.0
---

# Agile Pause - 暂停自动继续

## 任务
创建暂停标记，停止自动继续模式，输出当前进度摘要。

---

## 执行流程

### 第一步：创建暂停标记

```bash
# 创建 pause.flag 文件
cat > projects/active/pause.flag << EOF
{
  "paused": true,
  "reason": "user_requested",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "paused_by": "user"
}
EOF

echo "✅ 已创建暂停标记"
```

### 第二步：清理继续状态

```bash
# 删除继续状态文件（如果存在）
if [ -f "projects/active/continuation_state.json" ]; then
    rm -f projects/active/continuation_state.json
    echo "✅ 已清理继续状态"
fi
```

### 第三步：读取当前状态

```bash
# 读取当前迭代
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
    iteration_dir="projects/active/iterations/${iteration}"

    # 读取状态索引
    if [ -f "${iteration_dir}/status.json" ]; then
        status_json=$(cat ${iteration_dir}/status.json)
    fi
fi
```

### 第四步：生成进度摘要

```bash
echo ""
echo "📊 当前进度摘要"
echo "================"

if [ -n "$status_json" ]; then
    # 迭代信息
    echo "迭代: ${iteration}"
    echo "更新时间: $(echo $status_json | jq -r '.updated_at')"
    echo "状态: $(echo $status_json | jq -r '.status')"
    echo ""

    # 进度统计
    echo "进度:"
    echo "  - 用户故事: $(echo $status_json | jq -r '.progress.stories_completed')/$(echo $status_json | jq -r '.progress.stories_total')"
    echo "  - 技术任务: $(echo $status_json | jq -r '.progress.tasks_completed')/$(echo $status_json | jq -r '.progress.tasks_total')"
    echo "  - 完成率: $(echo $status_json | jq -r '.progress.completion_percentage')%"
    echo ""

    # 当前任务
    current_task=$(echo $status_json | jq -r '.current_task')
    if [ "$current_task" != "null" ] && [ -n "$current_task" ]; then
        echo "当前任务:"
        echo "  - ID: $(echo $status_json | jq -r '.current_task.id')"
        echo "  - 名称: $(echo $status_json | jq -r '.current_task.name')"
        echo "  - 状态: $(echo $status_json | jq -r '.current_task.status')"
        echo ""
    fi

    # 待办任务
    pending_count=$(echo $status_json | jq '.pending_tasks | length')
    if [ "$pending_count" -gt 0 ]; then
        echo "待办任务: ${pending_count}"
        echo $status_json | jq -r '.pending_tasks[] | "  - \(.id): \(.name)"' | head -5
        if [ "$pending_count" -gt 5 ]; then
            echo "  ... 还有 $((pending_count - 5)) 个任务"
        fi
        echo ""
    fi

    # 缺陷
    bugs_count=$(echo $status_json | jq '.bugs | length')
    if [ "$bugs_count" -gt 0 ]; then
        echo "缺陷: ${bugs_count}"
        echo $status_json | jq -r '.bugs[] | "  - \(.id): \(.description) [\(.severity)]"' | head -3
        echo ""
    fi
else
    echo "项目尚未初始化"
fi
```

### 第五步：输出恢复指令

```bash
echo "================"
echo ""
echo "💡 恢复自动继续:"
echo "  /agile-start"
echo ""
echo "📊 查看详细进度:"
echo "  /agile-dashboard"
echo "  或打开浏览器: file://$(pwd)/${iteration_dir}/dashboard.html"
echo ""
```

---

## 使用示例

```bash
# 暂停自动继续
/agile-pause

# 输出示例：
# ✅ 已创建暂停标记
# ✅ 已清理继续状态
#
# 📊 当前进度摘要
# ================
# 迭代: 1
# 更新时间: 2026-01-28T22:30:00Z
# 状态: in_progress
#
# 进度:
#   - 用户故事: 2/5
#   - 技术任务: 12/18
#   - 完成率: 67%
#
# 当前任务:
#   - ID: TASK-303
#   - 名称: 实现购物车组件
#   - 状态: in_progress
#
# 待办任务: 6
#   - TASK-304: 实现数量修改
#   - TASK-305: 编写测试
#   ...
#
# ================
#
# 💡 恢复自动继续:
#   /agile-start
#
# 📊 查看详细进度:
#   /agile-dashboard
```

---

## 暂停标记说明

**pause.flag 文件结构**：

```json
{
  "paused": true,
  "reason": "user_requested",
  "timestamp": "2026-01-28T22:30:00Z",
  "paused_by": "user",
  "note": "可选的暂停原因说明"
}
```

**作用**：
- Stop hook 检测到此文件时不保存继续状态
- SessionStart hook 检测到此文件时不自动恢复

**清理方式**：
1. 执行 `/agile-start` 会自动删除
2. 手动删除：`rm projects/active/pause.flag`

---

## 使用场景

### 场景 1：发现问题时暂停
```bash
# 发现 bug
cat > projects/active/backlog/bug-001.md << EOF
---
id: "BUG-001"
severity: "high"
---

# Bug 描述
价格排序功能异常
EOF

# 暂停自动继续
/agile-pause
```

### 场景 2：需要人工介入
```bash
# 需要确认需求
/agile-pause

# 用户确认后恢复
/agile-start
```

### 场景 3：暂时停止工作
```bash
# 下班了，暂停
/agile-pause

# 第二天早上恢复
/agile-start
```

---

## 注意事项

1. **暂停标记优先级**：pause.flag 优先级高于 continuation_state.json
2. **Stop hook 检测**：Stop hook 会检查 pause.flag，如存在则不保存继续状态
3. **状态保留**：暂停不影响 status.json、summary.md 等状态文件
4. **手动恢复**：删除 pause.flag 或执行 /agile-start 均可恢复
