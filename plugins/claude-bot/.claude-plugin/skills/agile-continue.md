---
name: agile-continue
description: Stop/SessionStart hook：保存状态并自动继续执行任务
version: 1.0.0
---

# Agile Continue - 持续运行控制器

## Hook 类型
本技能同时支持 **Stop hook** 和 **SessionStart hook**。

---

## Stop Hook（会话结束时执行）

### 任务
检测会话结束原因，决定是否保存继续状态以实现跨会话自动执行。

### 执行流程

#### 第一步：检查暂停标记
```bash
# 如果用户主动暂停，不保存继续状态
if [ -f "projects/active/pause.flag" ]; then
    echo "检测到暂停标记，清理继续状态"
    rm -f projects/active/continuation_state.json
    exit 0
fi
```

#### 第二步：读取当前状态
```bash
# 读取当前迭代编号
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
else
    echo "未找到活跃项目，不保存继续状态"
    exit 0
fi

# 读取状态索引
status_file="projects/active/iterations/${iteration}/status.json"
if [ ! -f "$status_file" ]; then
    echo "状态文件不存在，不保存继续状态"
    exit 0
fi
```

#### 第三步：判断是否应该继续
检查以下条件，**全部满足**才保存继续状态：

1. ✅ 有待办任务（`pending_tasks` 不为空）
2. ✅ 无严重缺陷（`bugs` 中无 critical/high 级别）
3. ✅ 无阻塞因素（`blockers` 为空）
4. ✅ 未达到最大迭代限制（如配置了 `max_iterations`）

```bash
# 从 status.json 提取信息（使用 jq 或类似工具）
pending_count=$(jq '.pending_tasks | length' $status_file)
critical_bugs=$(jq '[.bugs[] | select(.severity == "critical" or .severity == "high")] | length' $status_file)
blockers_count=$(jq '.blockers | length' $status_file)

# 判断条件
if [ "$pending_count" -eq 0 ]; then
    echo "所有任务已完成，不保存继续状态"
    exit 0
fi

if [ "$critical_bugs" -gt 0 ]; then
    echo "发现严重缺陷，需要人工介入，不保存继续状态"
    exit 0
fi

if [ "$blockers_count" -gt 0 ]; then
    echo "存在阻塞因素，不保存继续状态"
    exit 0
fi
```

#### 第四步：保存继续状态
```bash
# 提取下一个任务
next_task=$(jq '.pending_tasks[0]' $status_file)

# 创建 continuation_state.json
cat > projects/active/continuation_state.json << EOF
{
  "mode": "continue",
  "iteration": $iteration,
  "current_task": $(jq '.current_task' $status_file),
  "next_task": $next_task,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "auto_continue"
}
EOF

echo "✅ 已保存继续状态"
echo "📋 下次启动将自动执行任务: $(echo $next_task | jq -r '.id') - $(echo $next_task | jq -r '.name')"
echo "💡 如需暂停，请运行: /agile-pause"
```

---

## SessionStart Hook（会话开始时执行）

### 任务
检测是否存在继续状态，如存在则自动加载并提示 AI 继续执行下一个任务。

### 执行流程

#### 第一步：检测继续状态
```bash
if [ ! -f "projects/active/continuation_state.json" ]; then
    # 无继续状态，正常启动
    exit 0
fi

echo "🔄 检测到继续状态，准备自动恢复..."
```

#### 第二步：读取继续状态
```bash
continuation=$(cat projects/active/continuation_state.json)
iteration=$(echo $continuation | jq -r '.iteration')
next_task_id=$(echo $continuation | jq -r '.next_task.id')
next_task_name=$(echo $continuation | jq -r '.next_task.name')

echo "当前状态:"
echo "  - 迭代: $iteration"
echo "  - 下一个任务: $next_task_id - $next_task_name"
```

#### 第三步：加载上下文
```bash
# 1. 读取状态索引（< 500 tokens）
status_json=$(cat projects/active/iterations/${iteration}/status.json)

# 2. 读取任务详情（< 1000 tokens）
task_file="projects/active/iterations/${iteration}/tasks/${next_task_id}.md"
if [ -f "$task_file" ]; then
    task_md=$(cat $task_file)
else
    echo "错误：任务文件不存在 $task_file"
    exit 1
fi

# 3. 读取摘要（< 300 tokens，可选）
summary_file="projects/active/iterations/${iteration}/summary.md"
if [ -f "$summary_file" ]; then
    summary_md=$(cat $summary_file)
fi
```

#### 第四步：生成自动执行提示
```
🔄 自动继续模式

检测到上次的会话未完成，将继续执行下一个任务。

## 当前状态
- 迭代: ${iteration}
- 当前进度: $(echo $status_json | jq -r '.progress.tasks_completed')/$(echo $status_json | jq -r '.progress.tasks_total') 任务完成

## 下一个任务
- ID: ${next_task_id}
- 名称: ${next_task_name}
- 状态: pending
- 依赖: $(echo $continuation | jq -r '.next_task.blocked_by // []')

## 任务详情
${task_md}

${summary_md:+## 项目摘要
${summary_md}}

## 请继续执行此任务
使用 /agile-develop-task ${next_task_id}
```

#### 第五步：清理继续状态
```bash
# 任务开始后删除继续状态文件
rm -f projects/active/continuation_state.json
echo "继续状态已加载并清理"
```

---

## 中断条件

以下情况**不保存**继续状态：

### 1. 用户主动暂停
```bash
# 用户执行 /agile-pause 后创建 pause.flag
# Stop hook 检测到此文件则不保存继续状态
```

### 2. 发现严重缺陷
```json
// status.json 中的严重 bug
{
  "bugs": [
    {
      "id": "BUG-001",
      "severity": "critical",  // 或 "high"
      "description": "..."
    }
  ]
}
```

### 3. 存在阻塞因素
```json
{
  "blockers": [
    {
      "task_id": "TASK-303",
      "reason": "等待用户确认需求"
    }
  ]
}
```

### 4. 所有任务完成
```json
{
  "progress": {
    "tasks_completed": 18,
    "tasks_total": 18
  },
  "pending_tasks": []
}
```

### 5. 达到最大迭代限制
```bash
# 检查配置的 max_iterations
current_iteration=$(cat projects/active/iteration.txt)
max_iterations=$(jq -r '.continuation.maxIterations' config.json)

if [ "$current_iteration" -ge "$max_iterations" ]; then
    echo "已达到最大迭代限制，停止自动继续"
    exit 0
fi
```

---

## 配置选项

在 `projects/active/config.json` 中配置：

```json
{
  "continuation": {
    "enabled": true,
    "autoStart": true,
    "maxIterations": 10,
    "pauseOnBugs": true,
    "pauseOnBlockers": true,
    "pauseOnIterationComplete": false,
    "taskTimeout": 14400
  }
}
```

**配置说明**：
- `enabled`: 是否启用持续运行模式
- `autoStart`: 启动时是否自动继续
- `maxIterations`: 最大自动执行迭代数（防止无限循环）
- `pauseOnBugs`: 发现 bug 时是否暂停
- `pauseOnBlockers`: 遇到阻塞时是否暂停
- `pauseOnIterationComplete`: 迭代完成时是否暂停
- `taskTimeout`: 单任务超时时间（秒，默认 4 小时）

---

## 使用示例

### 启动持续运行
```bash
# 第一次启动，开始迭代 1
/agile-start

# AI 执行任务 1...
# [会话结束]

# 用户重新打开 Claude Code
# [自动检测到 continuation_state.json]
# [自动加载任务 2 并执行]
```

### 暂停自动继续
```bash
/agile-pause
# 创建 pause.flag，下次会话结束不保存继续状态
```

### 恢复自动继续
```bash
/agile-start
# 删除 pause.flag，重新启用自动继续
```

---

## 调试

查看当前状态：
```bash
# 查看继续状态
cat projects/active/continuation_state.json

# 查看暂停标记
cat projects/active/pause.flag

# 查看当前迭代
cat projects/active/iteration.txt

# 查看状态索引
cat projects/active/iterations/$(cat projects/active/iteration.txt)/status.json
```

手动清理状态：
```bash
# 清理继续状态（停止自动继续）
rm -f projects/active/continuation_state.json

# 清理暂停标记（恢复自动继续）
rm -f projects/active/pause.flag

# 重置项目状态（慎用！）
rm -rf projects/active/
```

---

## 注意事项

1. **状态一致性**：所有状态文件使用 JSON 格式，便于 AI 解析
2. **原子操作**：先写临时文件，再重命名到正式文件
3. **备份机制**：重要状态变更前创建备份
4. **Token 预算**：加载的上下文应控制在 2000 tokens 以内
5. **人工优先**：`pause.flag` 优先级高于 `continuation_state.json`
