---
name: agile-flow-engine-parallel
description: 并行化敏捷开发流程引擎，使用 run_in_background 真正并行执行多个 subagent
version: 2.0.0
---

# Agile Flow Engine - 并行版本

## 核心原理

**关键**：使用 `Task` tool 的 `run_in_background=true` 参数来实现真正的并行 subagent 执行。

```python
# 串行执行（原版）
Task(tool, subagent_type="general-purpose", prompt="任务A")
Task(tool, subagent_type="general-purpose", prompt="任务B")  # 等待 A 完成

# 并行执行（新版）
Task(tool, subagent_type="general-purpose", prompt="任务A", run_in_background=true)  # 立即返回
Task(tool, subagent_type="general-purpose", prompt="任务B", run_in_background=true)  # 立即返回
# 两个任务真正并行执行
```

## 执行流程

### 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_PARALLEL=3  # 最大并行任务数
```

### 步骤 1：获取待处理任务

```bash
tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list pending)
```

### 步骤 2：并行启动任务（核心）

**重要**：使用 `run_in_background=true` 真正并行执行

```python
# 获取所有待处理任务
pending_tasks = get_pending_tasks()

# 并行启动多个 subagent（最多 MAX_PARALLEL 个）
background_tasks = []
for i, task in enumerate(pending_tasks[:MAX_PARALLEL]):
    task_id = Task(
        subagent_type="general-purpose",
        description=f"TDD 开发：{task.description}",
        prompt=f"""
使用 TDD 流程完成任务：{task.description}

任务 ID: {task.id}
优先级: {task.priority}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

TDD 流程：
1. 优先读取项目上下文：
   - 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
   - 读取 ai-docs/TECH.md - 了解项目技术上下文
2. TODO 规划（如果超过 20 行）
3. 检查测试文件
4. 运行测试（红）→ npm run test:unit 或 pytest
5. 编写代码（绿）→ 使用 Skill 工具调用 /typescript 或 /python-development
6. 重构
7. 检查覆盖率 ≥ 80%
8. 代码审核 → 使用 Skill 工具调用 /pr-review-toolkit:code-reviewer
9. 更新任务状态 → node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {task.id} testing

完成后返回 JSON：
{{
  "task_id": "{task.id}",
  "status": "testing" | "bug",
  "context_update": "50字更新（保存到 CONTEXT.md）",
  "bugs": ["BUG列表"]
}}
""",
        run_in_background=True  # 关键：后台运行，真正并行
    )
    background_tasks.append((task_id, task.id))
    print(f"  🚀 启动后台任务: {task.id}")
```

### 步骤 3：等待并收集结果

```python
import time

# 等待所有后台任务完成
results = []
while background_tasks:
    # 检查每个任务状态
    for task_id, original_id in background_tasks[:]:
        try:
            # 使用 TaskOutput 获取结果（非阻塞）
            result = TaskOutput(task_id=task_id, block=False, timeout=1000)

            if result is not None:
                # 任务完成
                print(f"  ✅ 任务完成: {original_id}")
                results.append(result)
                background_tasks.remove((task_id, original_id))

                # 更新任务状态
                update_task_status(original_id, "testing")
        except:
            # 任务仍在运行
            pass

    time.sleep(5)  # 每 5 秒检查一次
```

### 步骤 4：处理结果

```python
# 保存上下文更新
for result in results:
    if result.get("context_update"):
        with open("ai-docs/CONTEXT.md", "a") as f:
            f.write(f"\n{result['context_update']}\n")

    # 如果有 BUG，记录到 BUGS.md
    if result.get("bugs"):
        with open("ai-docs/BUGS.md", "a") as f:
            for bug in result["bugs"]:
                f.write(f"- {bug}\n")
```

### 步骤 5：继续下一批

```python
# 处理下一批任务
remaining_tasks = get_pending_tasks()
if remaining_tasks:
    # 返回步骤 2
    pass
else:
    print("✅ 所有任务已完成")
```

## 完整执行流程

### 主循环

```python
def run_parallel_flow():
    """并行执行流程主循环"""
    while True:
        # 1. 获取待处理任务
        pending_tasks = get_pending_tasks()

        if not pending_tasks:
            print("✅ 所有任务已完成")
            break

        # 2. 限制并行度
        batch = pending_tasks[:MAX_PARALLEL]

        # 3. 并行启动任务
        background_tasks = launch_parallel_tasks(batch)

        # 4. 等待完成
        results = wait_for_completion(background_tasks)

        # 5. 处理结果
        process_results(results)

        print("📊 批次完成，继续下一批...")
```

## 关键改进点

### 1. 真正的并行执行

**原版（串行）**：
```
任务A → 等待完成 → 任务B → 等待完成 → 任务C
```

**新版（并行）**：
```
任务A ┐
任务B ├→ 同时执行 → 等待全部完成
任务C ┘
```

### 2. 使用 run_in_background

```python
# ✅ 正确：真正并行
Task(..., run_in_background=True)

# ❌ 错误：串行执行
Task(...)  # 默认 run_in_background=False
```

### 3. 使用 TaskOutput 获取结果

```python
# 非阻塞检查
result = TaskOutput(task_id="xxx", block=False, timeout=1000)

# 阻塞等待（不推荐，会失去并行优势）
result = TaskOutput(task_id="xxx", block=True)
```

## 性能对比

### 场景：3个任务，每个10分钟

| 模式 | 总耗时 | 说明 |
|------|--------|------|
| 串行 | 30分钟 | 任务A → 任务B → 任务C |
| 并行(3) | 10分钟 | [任务A, 任务B, 任务C] 同时执行 |

### 实际效果

```
🚀 并行执行中 (3个任务)

  🔄 TASK-001: 用户认证 (运行中)
  🔄 TASK-003: 股票 API (运行中)
  🔄 TASK-004: 报告生成 (运行中)

⏱️  预计剩余: 10分钟 (串行需要 30分钟)
```

## 注意事项

### 1. 文件冲突

**问题**：多个任务同时修改同一文件

**解决**：
- 任务拆分时避免文件重叠
- 检测到冲突时自动串行执行

### 2. 端口冲突

**问题**：多个任务同时使用同一端口

**解决**：
- 动态端口分配（3000-3010）
- 每个任务使用独立端口

### 3. 上下文污染

**问题**：多个 subagent 共享上下文

**解决**：
- Subagent 天然隔离上下文
- 主会话只保留摘要

## 监控与调试

### 实时状态

```python
def show_status(background_tasks):
    """显示并行执行状态"""
    print(f"\n🚀 并行执行中 ({len(background_tasks)} 个任务)")

    for task_id, original_id in background_tasks:
        # 检查任务状态
        try:
            result = TaskOutput(task_id=task_id, block=False, timeout=100)
            if result:
                print(f"  ✅ {original_id}: 已完成")
            else:
                print(f"  🔄 {original_id}: 运行中")
        except:
            print(f"  ⚠️  {original_id}: 状态未知")
```

### 日志记录

```python
# 保存执行日志
log_dir = Path("ai-docs/.logs/parallel-execution")
log_dir.mkdir(parents=True, exist_ok=True)

# 每个批次保存一个日志
batch_log = log_dir / f"batch-{timestamp}.md"
batch_log.write_text(f"""
# 批次 {timestamp}

任务: {', '.join(task_ids)}
开始时间: {start_time}
结束时间: {end_time}
结果: {results}
""")
```

## 最佳实践

### 1. 并行度选择

```
小型项目: MAX_PARALLEL = 2
中型项目: MAX_PARALLEL = 3
大型项目: MAX_PARALLEL = 5
```

### 2. 任务拆分原则

- ✅ 独立模块（auth, users, stocks）
- ✅ 清晰边界（前端 vs 后端）
- ❌ 避免文件重叠
- ❌ 避免循环依赖

### 3. 错误处理

```python
try:
    result = TaskOutput(task_id=task_id, block=False, timeout=1000)
except Exception as e:
    print(f"⚠️  任务 {task_id} 异常: {e}")
    # 标记任务失败
    update_task_status(task_id, "failed")
```

## 故障排除

### 任务卡住

```python
# 设置超时
MAX_TASK_TIME = 1800  # 30分钟

if time.time() - start_time > MAX_TASK_TIME:
    print(f"⚠️  任务 {task_id} 超时")
    # 停止任务
    TaskStop(task_id=task_id)
```

### 并发过多

```python
# 限制活跃任务数
while len(background_tasks) >= MAX_PARALLEL:
    # 等待某个任务完成
    time.sleep(5)
    background_tasks = [t for t in background_tasks if not is_completed(t)]
```

## 完整示例

```python
import time

# 环境设置
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_PARALLEL=3

# 主循环
while True:
    # 获取待处理任务
    pending_tasks = node("${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js", "list", "pending")

    if not pending_tasks:
        print("✅ 所有任务已完成")
        break

    # 限制批次大小
    batch = pending_tasks[:MAX_PARALLEL]
    print(f"\n🚀 启动 {len(batch)} 个并行任务")

    # 并行启动
    background_tasks = []
    for task in batch:
        task_id = Task(
            subagent_type="general-purpose",
            description=f"TDD 开发：{task.description}",
            prompt=f"使用 TDD 流程完成：{task.description}",
            run_in_background=True
        )
        background_tasks.append((task_id, task.id))
        print(f"  ✓ 启动: {task.id}")

    # 等待完成
    print("\n⏳ 等待任务完成...")
    results = []
    while background_tasks:
        time.sleep(5)

        for task_id, original_id in background_tasks[:]:
            try:
                result = TaskOutput(task_id=task_id, block=False, timeout=1000)
                if result:
                    print(f"  ✅ 完成: {original_id}")
                    results.append(result)
                    background_tasks.remove((task_id, original_id))
            except:
                pass

    # 处理结果
    for result in results:
        if result.get("context_update"):
            Bash(command=f"echo '{result['context_update']}' >> ai-docs/CONTEXT.md")

    print("\n📊 批次完成，继续下一批...")
```

## 输出格式

```
🚀 并行敏捷开发流程 (MAX_PARALLEL=3)

📋 待处理任务: 8 个

🚀 启动批次 1 (3个任务)
  ✓ 启动: TASK-001 (后台)
  ✓ 启动: TASK-003 (后台)
  ✓ 启动: TASK-004 (后台)

⏳ 等待任务完成...
  ✅ 完成: TASK-001
  ✅ 完成: TASK-003
  ✅ 完成: TASK-004

📝 更新 CONTEXT.md
📊 批次 1 完成

🚀 启动批次 2 (3个任务)
  ✓ 启动: TASK-002 (后台)
  ✓ 启动: TASK-005 (后台)
  ✓ 启动: TASK-006 (后台)
...
```

## 总结

**核心改进**：
1. 使用 `run_in_background=True` 实现真正的并行
2. 使用 `TaskOutput(block=False)` 非阻塞获取结果
3. 批次处理，限制并行度
4. 自动上下文清理

**性能提升**：
- 串行：N 个任务 × 每个任务时间
- 并行：⌈N / MAX_PARALLEL⌉ × 每个任务时间
- 加速比：约 MAX_PARALLEL 倍
