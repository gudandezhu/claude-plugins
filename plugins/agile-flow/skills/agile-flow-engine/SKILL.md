---
name: agile-flow-engine
description: 自动化敏捷开发流程引擎（总并发=3，开发固定1个+测试1个+需求2个），持续运行模式
version: 4.0.0
---

# Agile Flow Engine - 持续并发模式

自动化敏捷开发流程引擎，**总并发限制=3**，持续运行，动态分配资源。

## 核心原理

**关键**：使用 `Task` tool 的 `run_in_background=true` 参数来实现真正的并行 subagent 执行。

```python
# 串行执行（旧版）
Task(subagent_type="general-purpose", prompt="任务A")  # 等待完成
Task(subagent_type="general-purpose", prompt="任务B")  # 等待完成

# 并行执行（新版，默认）
Task(subagent_type="general-purpose", prompt="任务A", run_in_background=True)  # 立即返回
Task(subagent_type="general-purpose", prompt="任务B", run_in_background=True)  # 立即返回
# 两个任务同时运行
```

## 并行策略

### 严格并发限制（API 限制 = 3）

**重要**：由于 API 并发限制为 3，必须严格控制总并发数为 3。

**持续运行模式**（不是批次模式）：
- 开发固定 1 个（必须一直保持）
- 测试最多 1 个
- 需求分析占用剩余配额（最多 2 个）
- 技术设计跳过（优先开发和测试）

```
总并发 = 3
├── 开发: 1 (固定)
├── 测试: 0-1 (动态)
└── 需求: 0-2 (动态填充剩余配额)
```

### 动态资源分配

```
有测试任务时: [开发1] + [测试1] + [需求1] = 3
无测试任务时: [开发1] + [需求2] = 3
只有开发时: [开发1] = 1
```

**关键规则**：
1. 开发必须保持 1 个（如果有待开发任务）
2. 测试优先级高于需求
3. 需求分析填充剩余配额
4. 某个阶段任务完成后，立即启动该阶段的下一个任务

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_CONCURRENT=3  # 总并发限制（开发1 + 测试1 + 需求2）
```

## 执行流程

### 主循环（核心 - 持续运行模式）

```python
MAX_CONCURRENT = 3  # 总并发限制

def main_loop():
    """主循环：持续运行，动态分配资源"""
    running = {}  # {task_id: (task_type, original_task_id)}

    while True:
        # 1. 清理已完成的任务
        running = cleanup_finished(running)

        # 2. 统计各阶段运行中的任务数
        dev_count = count_by_type(running, "dev")
        test_count = count_by_type(running, "test")
        req_count = count_by_type(running, "requirement")

        # 3. 计算剩余配额
        slots_available = MAX_CONCURRENT - len(running)

        # 4. 如果没有任务且没有运行中的进程，退出
        if not has_any_pending_tasks() and not running:
            print("✅ 所有任务已完成")
            break

        # 5. 动态分配资源

        # 5.1 开发：固定保持 1 个
        if dev_count < 1:
            dev_tasks = get_tasks_by_status("pending")
            if dev_tasks and slots_available > 0:
                task = dev_tasks[0]
                task_id = launch_developer(task, run_in_background=True)
                running[task_id] = ("dev", task.id)
                slots_available -= 1
                print(f"  💻 启动开发: {task.id}")

        # 5.2 测试：最多 1 个
        if test_count < 1 and slots_available > 0:
            test_tasks = get_tasks_by_status("testing")
            if test_tasks:
                task = test_tasks[0]
                task_id = launch_tester(task, run_in_background=True)
                running[task_id] = ("test", task.id)
                slots_available -= 1
                print(f"  🧪 启动测试: {task.id}")

        # 5.3 需求分析：填充剩余配额
        while slots_available > 0:
            req_tasks = get_tasks_by_status("requirements")
            if not req_tasks:
                break
            task = req_tasks[0]
            task_id = launch_requirement_analyzer(task, run_in_background=True)
            running[task_id] = ("requirement", task.id)
            slots_available -= 1
            print(f"  📋 启动需求: {task.id}")

        # 6. 显示当前状态
        print(f"\n🔄 运行中: {len(running)}/{MAX_CONCURRENT}")
        print(f"   开发: {dev_count}, 测试: {test_count}, 需求: {req_count}")

        # 7. 等待一段时间再检查
        time.sleep(5)
```

### 资源分配优先级

```
1. 开发：必须有 1 个（如果有待开发任务）
2. 测试：最多 1 个（优先于需求）
3. 需求：填充剩余配额（0-2 个）
```

### 步骤 1：获取待处理任务

```bash
# 获取所有待处理任务（按状态分组）
requirements_tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list requirements)
pending_tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list pending)
testing_tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list testing)
# 注意：跳过 design 状态，需求分析完成后直接进入开发
```

### 步骤 2：并行启动多个 subagent（核心）

**重要**：使用 `run_in_background=True` 实现真正的并行

#### 需求分析 subagent

```python
for task in requirements_tasks[:MAX_PARALLEL]:
    task_id = Task(
        subagent_type="general-purpose",
        description=f"需求分析：{task.description}",
        prompt=f"""
分析项目需求并创建任务到 TASKS.json

任务 ID: {task.id}
需求内容: {task.description}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**（第一步）：
1. 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
2. 读取 ai-docs/TECH.md - 了解项目技术上下文

步骤：
1. 读取 CONTEXT.md 和 TECH.md，了解项目当前状态
2. 读取 PRD.md
3. 识别功能需求
4. 评估优先级：
   - P0: 紧急、关键、核心、阻塞、崩溃、安全、漏洞
   - P1: 重要、优化、性能、体验、提升、改进
   - P2: 默认优先级
   - P3: 可选、建议、美化、调整、微调
5. 使用 tasks.js add 创建任务
6. 更新 CONTEXT.md

完成后返回 JSON：
{{
  "task_id": "{task.id}",
  "tasks_created": 数量,
  "context_updated": true,
  "summary": "简要总结"
}}
""",
        run_in_background=True  # 关键：后台运行，真正并行
    )
    background_tasks.append(("requirement", task_id, task.id))
    print(f"  🚀 启动需求分析: {task.id}")
```

#### TDD 开发 subagent（固定 1 个）

```python
# 开发：固定保持 1 个
pending_tasks = get_tasks_by_status("pending")
if pending_tasks and dev_count < 1:
    task = pending_tasks[0]
    task_id = Task(
        subagent_type="general-purpose",
        description=f"TDD 开发：{task.description}",
        prompt=f"""
使用 TDD 流程完成任务：{task.description}

任务 ID: {task.id}
优先级: {task.priority}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**：
1. 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
2. 读取 ai-docs/TECH.md - 了解项目技术上下文

TDD 流程：
1. TODO 规划（如果超过 20 行）
2. 检查测试文件
3. 运行测试（红）→ npm run test:unit 或 pytest
4. 编写代码（绿）→ 使用 Skill 工具调用 /typescript 或 /python-development
5. 重构
6. 检查覆盖率 ≥ 80%
7. 代码审核 → 使用 Skill 工具调用 /pr-review-toolkit:code-reviewer
8. 更新任务状态 → node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {task.id} testing

完成后返回 JSON：
{{
  "task_id": "{task.id}",
  "status": "testing" | "bug",
  "context_update": "50字更新（保存到 CONTEXT.md）",
  "bugs": ["BUG列表"]
}}
""",
        run_in_background=True
    )
    background_tasks.append(("dev", task_id, task.id))
    print(f"  💻 启动TDD开发: {task.id}")
```

#### E2E 测试 subagent（最多 1 个）

```python
# 测试：最多 1 个
testing_tasks = get_tasks_by_status("testing")
if testing_tasks and test_count < 1 and slots_available > 0:
    task = testing_tasks[0]
    task_id = Task(
        subagent_type="general-purpose",
        description=f"E2E 测试：{task.description}",
        prompt=f"""
使用 Playwright 进行 E2E 测试：{task.description}

任务 ID: {task.id}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**：
1. 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
2. 读取 ai-docs/TECH.md - 了解项目技术上下文
3. 读取 ai-docs/PRD.md - 了解需求详情

步骤：
1. 启动项目
2. 使用 Playwright MCP 工具测试
3. 检查控制台错误
4. 如发现 BUG，记录到 BUGS.md
5. 更新任务状态 → node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {task.id} tested

完成后返回 JSON：
{{
  "task_id": "{task.id}",
  "status": "tested" | "bug",
  "summary": "测试结果总结",
  "bugs": ["BUG列表"]
}}
""",
        run_in_background=True
    )
    running[task_id] = ("test", task.id)
    slots_available -= 1
    print(f"  🧪 启动测试: {task.id}")
```

#### 需求分析 subagent（填充剩余配额）

```python
# 需求：填充剩余配额（最多 2 个）
while slots_available > 0:
    req_tasks = get_tasks_by_status("requirements")
    if not req_tasks:
        break
    task = req_tasks[0]
    task_id = Task(
        subagent_type="general-purpose",
        description=f"需求分析：{task.description}",
        prompt=f"""
分析项目需求并创建任务到 TASKS.json

任务 ID: {task.id}
需求内容: {task.description}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**（第一步）：
1. 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
2. 读取 ai-docs/TECH.md - 了解项目技术上下文

步骤：
1. 读取 CONTEXT.md 和 TECH.md，了解项目当前状态
2. 读取 PRD.md
3. 识别功能需求
4. 评估优先级：
   - P0: 紧急、关键、核心、阻塞、崩溃、安全、漏洞
   - P1: 重要、优化、性能、体验、提升、改进
   - P2: 默认优先级
   - P3: 可选、建议、美化、调整、微调
5. 使用 tasks.js add 创建任务
6. 更新 CONTEXT.md

完成后返回 JSON：
{{
  "task_id": "{task.id}",
  "tasks_created": 数量,
  "context_updated": true,
  "summary": "简要总结"
}}
""",
        run_in_background=True
    )
    running[task_id] = ("requirement", task.id)
    slots_available -= 1
    print(f"  📋 启动需求: {task.id}")
```

### 步骤 3：清理已完成的任务并处理结果

```python
import time

def cleanup_finished(running):
    """清理已完成的任务，返回新的 running 字典"""
    finished = []

    for task_id, (task_type, original_id) in running.items():
        try:
            result = TaskOutput(task_id=task_id, block=False, timeout=1000)
            if result is not None:
                # 任务完成，处理结果
                process_result(task_type, result, original_id)
                finished.append(task_id)
                type_emoji = {
                    "requirement": "📋",
                    "dev": "💻",
                    "test": "🧪"
                }
                print(f"  {type_emoji.get(task_type, '✅')} 完成: {original_id}")
        except:
            # 任务仍在运行
            pass

    # 移除已完成的任务
    for task_id in finished:
        del running[task_id]

    return running

def process_result(task_type, result, original_id):
    """处理任务完成后的结果"""
    task_id = result.get("task_id", original_id)

    if task_type == "requirement":
        # 需求分析完成
        if result.get("context_update"):
            with open("ai-docs/CONTEXT.md", "a") as f:
                f.write(f"\n{result['context_update']}\n")
        # 更新任务状态 → pending（跳过 design，直接进入开发）
        Bash(command=f"node ${{CLAUDE_PLUGIN_ROOT}}/scripts/utils/tasks.js update {task_id} pending")

    elif task_type == "dev":
        # TDD 开发完成
        if result.get("context_update"):
            with open("ai-docs/CONTEXT.md", "a") as f:
                f.write(f"\n{result['context_update']}\n")
        # 如果有 BUG，记录到 BUGS.md
        if result.get("bugs"):
            with open("ai-docs/BUGS.md", "a") as f:
                for bug in result["bugs"]:
                    f.write(f"- {bug}\n")
        # 更新任务状态
        new_status = result.get("status", "testing")
        Bash(command=f"node ${{CLAUDE_PLUGIN_ROOT}}/scripts/utils/tasks.js update {task_id} {new_status}")

    elif task_type == "test":
        # E2E 测试完成
        if result.get("bugs"):
            with open("ai-docs/BUGS.md", "a") as f:
                for bug in result["bugs"]:
                    f.write(f"- {bug}\n")
        # 更新任务状态
        new_status = "tested" if result.get("status") == "tested" else "bug"
        Bash(command=f"node ${{CLAUDE_PLUGIN_ROOT}}/scripts/utils/tasks.js update {task_id} {new_status}")
```

## 性能对比

### 场景：12个任务（3需求 + 3开发 + 3测试）

| 模式 | 总耗时 | 说明 |
|------|--------|------|
| 串行 | 90分钟 | 需求→开发→测试，每个10分钟 |
| 持续并发(3) | 40分钟 | 开发固定1个，测试和需求动态填充 |

**加速比：约 2.25 倍**

## 输出格式

```
🚀 敏捷开发流程 (总并发=3)

🔄 运行中: 3/3
   开发: 1, 测试: 1, 需求: 1

💻 启动开发: TASK-001
🧪 启动测试: TEST-005
📋 启动需求: REQ-003

[5秒后]
💻 完成: TASK-001
🔄 运行中: 2/3
   开发: 0, 测试: 1, 需求: 1

💻 启动开发: TASK-002
🔄 运行中: 3/3
   开发: 1, 测试: 1, 需求: 1
...
```

## 核心原则

1. **总并发限制 = 3**：严格遵守 API 并发限制
2. **开发固定 1 个**：避免代码仓库混乱
3. **动态资源分配**：任务完成后立即启动同类型的下一个
4. **Subagent 隔离**：每个任务在独立的 subagent 中执行
5. **完全自动化**：持续运行，不需要人工干预

## 注意事项

1. **总并发数 = 3**：不是每个阶段 3 个
2. **开发必须 1 个**：避免多开发导致代码冲突
3. **使用 run_in_background=True**：所有 Task 调用必须设置此参数
4. **使用 TaskOutput(block=False)**：非阻塞获取结果
5. **持续监控**：每 5 秒检查一次任务状态
6. **优先读取上下文**：每个 subagent 启动时，优先读取 CONTEXT.md 和 TECH.md

## 最佳实践

### 1. 并发度选择

```
API 限制 = 3: MAX_CONCURRENT = 3
API 限制 = 5: MAX_CONCURRENT = 5
```

### 2. 资源分配策略

```
开发: 固定 1 个（必须）
测试: 最多 1 个（优先）
需求: 填充剩余（0-2 个）
```

### 3. 错误处理

```python
try:
    result = TaskOutput(task_id=task_id, block=False, timeout=1000)
except Exception as e:
    print(f"⚠️  任务 {task_id} 异常: {e}")
    # 标记任务失败
    update_task_status(task_id, "failed")
```

## 监控与调试

### 实时状态

```python
def show_status(running):
    """显示当前运行状态"""
    dev_count = count_by_type(running, "dev")
    test_count = count_by_type(running, "test")
    req_count = count_by_type(running, "requirement")

    print(f"\n🔄 运行中: {len(running)}/{MAX_CONCURRENT}")
    print(f"   开发: {dev_count}, 测试: {test_count}, 需求: {req_count}")

    # 显示各任务详情
    for task_id, (task_type, original_id) in running.items():
        type_emoji = {
            "requirement": "📋",
            "dev": "💻",
            "test": "🧪"
        }
        print(f"  {type_emoji.get(task_type, '🔄')} {original_id}: 运行中")
```

## 总结

**核心改进**：
1. **总并发限制 = 3**：严格遵守 API 并发限制
2. **开发固定 1 个**：避免代码仓库冲突
3. **动态资源分配**：任务完成后立即启动下一个
4. **持续运行模式**：不是批次模式，而是持续监控
5. **使用 run_in_background=True**：实现真正的并行

**性能提升**：
- 串行：需求 → 开发 → 测试，依次执行
- 持续并发：开发固定 + 测试需求动态填充
- 加速比：约 2-3 倍（取决于任务分布）
