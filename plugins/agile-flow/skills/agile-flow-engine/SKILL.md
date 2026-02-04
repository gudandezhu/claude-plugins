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

### 步骤 2：Subagent Prompt 模板

**重要**：使用 `run_in_background=True` 实现真正的并行

#### 需求分析（填充剩余配额，最多 2 个）

```python
while slots_available > 0:
    req_tasks = get_tasks_by_status("requirements")
    if not req_tasks: break
    task = req_tasks[0]
    task_id = Task(
        subagent_type="general-purpose",
        description=f"需求分析：{task.description}",
        prompt=f"""
任务 ID: {task.id}，需求内容: {task.description}
环境变量：export AI_DOCS_PATH="$(pwd)/ai-docs"

步骤：
1. 读取 CONTEXT.md、TECH.md、PRD.md
2. 评估优先级（P0紧急/P1重要/P2默认/P3可选）
3. 使用 tasks.js add 创建任务
4. 更新 CONTEXT.md

返回 JSON：{{"task_id": "{task.id}", "tasks_created": 数量, "summary": "总结"}}
""",
        run_in_background=True
    )
    running[task_id] = ("requirement", task.id)
    slots_available -= 1
```

#### TDD 开发（固定 1 个）

```python
if dev_count < 1 and (pending_tasks := get_tasks_by_status("pending")):
    task = pending_tasks[0]
    task_id = Task(
        subagent_type="general-purpose",
        description=f"TDD 开发：{task.description}",
        prompt=f"""
任务 ID: {task.id}，优先级: {task.priority}
环境变量：export AI_DOCS_PATH="$(pwd)/ai-docs"

TDD 流程：
1. TODO 规划（>20行时）
2. 检查测试 → 运行测试（红）→ 编写代码（绿）→ 重构
3. 覆盖率 ≥ 80% → 代码审核（/pr-review-toolkit:code-reviewer）
4. 更新状态：tasks.js update {task.id} testing

返回 JSON：{{"task_id": "{task.id}", "status": "testing|bug", "summary": "总结"}}
""",
        run_in_background=True
    )
    running[task_id] = ("dev", task.id)
    slots_available -= 1
```

#### E2E 测试（最多 1 个）

```python
if test_count < 1 and slots_available > 0 and (testing_tasks := get_tasks_by_status("testing")):
    task = testing_tasks[0]
    task_id = Task(
        subagent_type="general-purpose",
        description=f"E2E 测试：{task.description}",
        prompt=f"""
任务 ID: {task.id}
环境变量：export AI_DOCS_PATH="$(pwd)/ai-docs"

步骤：
1. 启动项目 → Playwright MCP 测试 → 检查控制台错误
2. BUG 记录到 BUGS.md
3. 更新状态：tasks.js update {task.id} tested

返回 JSON：{{"task_id": "{task.id}", "status": "tested|bug", "bugs": []}}
""",
        run_in_background=True
    )
    running[task_id] = ("test", task.id)
    slots_available -= 1
```

### 步骤 3：清理已完成的任务

```python
def cleanup_finished(running):
    """清理已完成的任务"""
    finished = []
    for task_id, (task_type, original_id) in running.items():
        try:
            result = TaskOutput(task_id=task_id, block=False, timeout=1000)
            if result is not None:
                process_result(task_type, result, original_id)
                finished.append(task_id)
                print(f"  {['📋','💻','🧪'][['requirement','dev','test'].index(task_type)]} 完成: {original_id}")
        except: pass

    for task_id in finished: del running[task_id]
    return running

def process_result(task_type, result, original_id):
    """处理任务结果"""
    task_id = result.get("task_id", original_id)
    if task_type == "requirement":
        Bash(command=f"node ${{CLAUDE_PLUGIN_ROOT}}/scripts/utils/tasks.js update {task_id} pending")
    elif task_type == "dev":
        Bash(command=f"node ${{CLAUDE_PLUGIN_ROOT}}/scripts/utils/tasks.js update {task_id} {result.get('status','testing')}")
    elif task_type == "test":
        Bash(command=f"node ${{CLAUDE_PLUGIN_ROOT}}/scripts/utils/tasks.js update {task_id} {result.get('status','tested')}")
```

## 输出示例

```
🔄 运行中: 3/3 (开发:1, 测试:1, 需求:1)
💻 启动开发: TASK-001
🧪 启动测试: TEST-005
📋 启动需求: REQ-003

[5秒后]
💻 完成: TASK-001
🔄 运行中: 2/3
💻 启动开发: TASK-002
```

## 注意事项

1. **总并发=3**：不是每个阶段3个
2. **开发固定1个**：避免代码冲突
3. **使用 `run_in_background=True`**
4. **使用 `TaskOutput(block=False)`**
5. **每5秒检查一次状态**
