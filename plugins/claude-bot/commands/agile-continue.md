---
name: agile-continue
description: 恢复自动继续模式 - 删除暂停标记、启用自动继续
version: 1.0.0
---

# Agile Continue - 恢复自动继续

请执行以下步骤恢复自动继续模式：

## 第一步：删除暂停标记

```bash
if [ -f "projects/active/pause.flag" ]; then
    rm -f projects/active/pause.flag
    echo "✅ 已删除暂停标记"
else
    echo "ℹ️  未找到暂停标记，自动继续模式已启用"
fi
```

## 第二步：检查项目状态

```bash
# 读取当前迭代
if [ ! -f "projects/active/iteration.txt" ]; then
    echo "❌ 项目未初始化，请先运行 /agile-start"
    exit 1
fi

iteration=$(cat projects/active/iteration.txt)
status_file="projects/active/iterations/${iteration}/status.json"

if [ ! -f "$status_file" ]; then
    echo "❌ 状态文件不存在，请先运行 /agile-start"
    exit 1
fi
```

## 第三步：读取进度数据

```bash
# 提取状态信息
total=$(jq '.progress.tasks_total' "$status_file")
completed=$(jq '.progress.tasks_completed' "$status_file")
pending=$(jq '.progress.tasks_pending' "$status_file")
bugs=$(jq '.bugs | length' "$status_file")
blockers=$(jq '.blockers | length' "$status_file")
```

## 第四步：检查是否可以继续

```bash
can_continue=true

if [ "$pending" -eq 0 ]; then
    echo "✅ 所有任务已完成"
    can_continue=false
fi

if [ "$bugs" -gt 0 ]; then
    echo "⚠️  存在 $bugs 个缺陷，建议先处理"
    can_continue=false
fi

if [ "$blockers" -gt 0 ]; then
    echo "⚠️  存在 $blockers 个阻塞因素，需要解决"
    can_continue=false
fi

if [ "$can_continue" = false ]; then
    echo ""
    echo "💡 建议："
    echo "  - 查看进度: /agile-dashboard"
    echo "  - 生成回顾: /agile-retrospective"
    exit 0
fi
```

## 第五步：生成继续提示

```bash
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            ▶️  Agile Flow - 恢复自动继续                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ 自动继续模式已启用"
echo ""
echo "📊 当前进度"
echo "─────────────────────────────────────────────────────────────"
echo "  迭代: $iteration"
echo "  完成: $completed/$total 任务"
echo "  待处理: $pending 任务"
echo ""

# 显示下一个任务
next_task=$(jq -r '.pending_tasks[0] // "无"' "$status_file")
if [ "$next_task" != "null" ] && [ "$next_task" != "无" ]; then
    echo "📋 下一个任务"
    echo "─────────────────────────────────────────────────────────────"
    echo "  $next_task"
    echo ""
fi

echo "💡 工作方式"
echo "─────────────────────────────────────────────────────────────"
echo "  - 任务完成后自动保存状态"
echo "  - 下次启动自动继续下一个任务"
echo "  - 如需暂停: /agile-pause"
echo ""
```

## 第六步：创建继续状态（可选）

```bash
# 如果有待办任务，创建 continuation_state.json
if [ "$pending" -gt 0 ]; then
    next_task_info=$(jq '.pending_tasks[0]' "$status_file")

    cat > projects/active/continuation_state.json << EOF
{
  "mode": "continue",
  "iteration": $iteration,
  "next_task": $next_task_info,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "user_resumed"
}
EOF

    echo "✅ 已设置继续状态"
fi
```

## 恢复后的行为

**自动继续模式启用后**：
- ✅ Stop hook 会自动保存继续状态
- ✅ SessionStart hook 会自动恢复任务
- ✅ PostToolUse hook 会自动更新状态

**智能中断**：
- ⏸️ 严重缺陷时自动暂停
- ⏸️ 阻塞因素时自动暂停
- ⏸️ 所有任务完成时停止

## 输出示例

```
╔════════════════════════════════════════════════════════════╗
║            ▶️  Agile Flow - 恢复自动继续                 ║
╚════════════════════════════════════════════════════════════╝

✅ 自动继续模式已启用

📊 当前进度
─────────────────────────────────────────────────────────────
  迭代: 1
  完成: 6/10 任务
  待处理: 4 任务

📋 下一个任务
─────────────────────────────────────────────────────────────
  TASK-007

💡 工作方式
─────────────────────────────────────────────────────────────
  - 任务完成后自动保存状态
  - 下次启动自动继续下一个任务
  - 如需暂停: /agile-pause

✅ 已设置继续状态
```

## 与 pause 的关系

| 状态 | pause.flag | 继续状态 |
|------|-----------|---------|
| **启用继续** | ❌ 不存在 | ✅ 可选存在 |
| **暂停** | ✅ 存在 | ❌ 不保存 |

**优先级**：pause.flag > continuation_state.json

## 使用场景

1. **从暂停恢复**：之前使用了 /agile-pause
2. **首次启用**：项目刚初始化，想启用自动继续
3. **手动恢复**：清理了 pause.flag，想重新启用

## 注意事项

1. **检查缺陷**：恢复前建议先处理严重缺陷
2. **检查阻塞**：确保没有阻塞因素
3. **可逆操作**：随时可使用 /agile-pause 暂停
