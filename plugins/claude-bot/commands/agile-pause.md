---
name: agile-pause
description: 暂停自动继续模式 - 创建暂停标记、清理继续状态、输出进度摘要
version: 1.0.0
---

# Agile Pause - 暂停自动继续

请执行以下步骤暂停自动继续模式：

## 第一步：创建暂停标记

```bash
# 创建 pause.flag 文件
touch projects/active/pause.flag
echo "✅ 已创建暂停标记"
```

## 第二步：清理继续状态

```bash
# 删除 continuation_state.json（如果存在）
if [ -f "projects/active/continuation_state.json" ]; then
    rm -f projects/active/continuation_state.json
    echo "✅ 已清理继续状态"
fi
```

## 第三步：读取当前状态

```bash
# 读取当前迭代
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
    status_file="projects/active/iterations/${iteration}/status.json"

    if [ -f "$status_file" ]; then
        # 读取进度数据
        total=$(jq '.progress.tasks_total' "$status_file")
        completed=$(jq '.progress.tasks_completed' "$status_file")
        in_progress=$(jq '.progress.tasks_in_progress' "$status_file")
        bugs=$(jq '.bugs | length' "$status_file")

        # 读取当前任务
        current=$(jq -r '.current_task // "无"' "$status_file")

        # 读取待办任务
        pending_count=$(jq '.pending_tasks | length' "$status_file")
    fi
fi
```

## 第四步：生成进度摘要

```bash
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            ⏸️  Agile Flow - 已暂停自动继续                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 当前进度"
echo "─────────────────────────────────────────────────────────────"
echo "  迭代: $iteration"
echo "  完成度: $completed/$total 任务"
echo "  进行中: $in_progress 任务"
echo "  待处理: $pending_count 任务"
echo "  缺陷数: $bugs"
echo ""

if [ "$current" != "null" ] && [ -n "$current" ]; then
    echo "🎯 当前任务"
    echo "─────────────────────────────────────────────────────────────"
    echo "  $current"
    echo ""
fi

echo "💡 恢复自动继续"
echo "─────────────────────────────────────────────────────────────"
echo "  删除暂停标记: rm projects/active/pause.flag"
echo "  或使用命令: /agile-continue"
echo ""
```

## 第五步：保存暂停记录

```bash
# 可选：记录暂停时间
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > projects/active/.paused_at
```

## 暂停效果

**暂停后的行为**：
- ✅ Stop hook 不会再保存继续状态
- ✅ SessionStart hook 不会自动恢复
- ✅ 用户完全手动控制

**保留的功能**：
- ✅ 所有命令仍可正常使用
- ✅ 技能仍可触发
- ✅ Hooks 仍会运行（只是不保存继续状态）

## 恢复自动继续

### 方法 1：删除暂停标记
```bash
rm projects/active/pause.flag
```

### 方法 2：使用继续命令
```
/agile-continue
```

## 输出示例

```
╔════════════════════════════════════════════════════════════╗
║            ⏸️  Agile Flow - 已暂停自动继续                ║
╚════════════════════════════════════════════════════════════╝

📊 当前进度
─────────────────────────────────────────────────────────────
  迭代: 1
  完成度: 6/10 任务
  进行中: 1 任务
  待处理: 3 任务
  缺陷数: 0

🎯 当前任务
─────────────────────────────────────────────────────────────
  TASK-007

💡 恢复自动继续
─────────────────────────────────────────────────────────────
  删除暂停标记: rm projects/active/pause.flag
  或使用命令: /agile-continue
```

## 使用场景

1. **临时停止**：需要中断工作一段时间
2. **人工介入**：发现 bug 需要人工处理
3. **调查问题**：需要深入调查某个问题
4. **完全控制**：希望完全手动控制执行流程

## 注意事项

1. **pause.flag 优先级最高**：Stop hook 会检查此文件
2. **可逆操作**：随时可删除 pause.flag 恢复
3. **状态保留**：暂停不影响已保存的状态数据
