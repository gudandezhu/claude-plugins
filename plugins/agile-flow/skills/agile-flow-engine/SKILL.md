---
name: agile-flow-engine
description: 自动化敏捷开发流程引擎（默认并行），同时运行需求分析、技术设计、开发、测试多个 subagent
version: 3.0.0
---

# Agile Flow Engine - 并行版本

自动化敏捷开发流程引擎，**默认支持并行执行**，多个阶段的任务可以同时进行。

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

### 流水线并行（推荐）

```
需求池 → [需求A, 需求B, 需求C] → 需求分析（并行3个）
       ↓
       [设计A, 设计B, 设计C] → 技术设计（并行3个）
       ↓
       [开发A, 开发B, 开发C] → TDD开发（并行3个）
       ↓
       [测试A, 测试B, 测试C] → E2E测试（并行3个）
```

**关键**：不同阶段的任务可以并行执行！
- 需求分析可以并行处理多个需求
- 技术设计可以并行处理多个设计
- TDD 开发可以并行处理多个开发任务
- E2E 测试可以并行处理多个测试

### 阶段并行

```
[需求分析 subagent] ──┐
[技术设计 subagent] ──┼──→ 同时运行
[TDD 开发 subagent]  ──┤
[E2E 测试 subagent]  ──┘
```

**每个阶段同时运行最多 3 个 subagent**（MAX_PARALLEL=3）

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_PARALLEL=3  # 每个阶段最多并行数
```

## 执行流程

### 主循环（核心）

```python
def main_loop():
    """主循环：持续并行处理任务"""
    while True:
        # 检查是否还有任务
        pending_tasks = get_pending_tasks()
        if not pending_tasks:
            print("✅ 所有任务已完成")
            break

        # 并行启动多个阶段的 subagent
        background_tasks = []

        # 1. 需求分析（最多 MAX_PARALLEL 个）
        req_tasks = get_tasks_by_status("requirements")
        for task in req_tasks[:MAX_PARALLEL]:
            task_id = launch_requirement_analyzer(task, run_in_background=True)
            background_tasks.append(("requirement", task_id, task.id))

        # 2. 技术设计（最多 MAX_PARALLEL 个）
        design_tasks = get_tasks_by_status("design")
        for task in design_tasks[:MAX_PARALLEL]:
            task_id = launch_tech_designer(task, run_in_background=True)
            background_tasks.append(("design", task_id, task.id))

        # 3. TDD 开发（最多 MAX_PARALLEL 个）
        dev_tasks = get_tasks_by_status("pending")
        for task in dev_tasks[:MAX_PARALLEL]:
            task_id = launch_developer(task, run_in_background=True)
            background_tasks.append(("dev", task_id, task.id))

        # 4. E2E 测试（最多 MAX_PARALLEL 个）
        test_tasks = get_tasks_by_status("testing")
        for task in test_tasks[:MAX_PARALLEL]:
            task_id = launch_tester(task, run_in_background=True)
            background_tasks.append(("test", task_id, task.id))

        # 如果没有启动任何任务，退出
        if not background_tasks:
            print("✅ 没有可执行的任务")
            break

        # 等待所有后台任务完成
        print(f"\n🚀 并行执行中 ({len(background_tasks)} 个 subagent)")
        results = wait_for_completion(background_tasks)

        # 处理结果
        process_results(results)

        print("\n📊 批次完成，继续下一批...")
```

### 步骤 1：获取待处理任务

```bash
# 获取所有待处理任务（按状态分组）
requirements_tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list requirements)
design_tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list design)
pending_tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list pending)
testing_tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list testing)
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

#### 技术设计 subagent

```python
for task in design_tasks[:MAX_PARALLEL]:
    task_id = Task(
        subagent_type="general-purpose",
        description=f"技术设计：{task.description}",
        prompt=f"""
将用户故事拆分为技术任务并维护技术上下文

任务 ID: {task.id}
需求: {task.description}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**：
1. 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
2. 读取 ai-docs/TECH.md - 了解项目技术上下文

步骤：
1. 从 CONTEXT.md 读取业务上下文
2. 从 TECH.md 读取技术上下文
3. 从 PRD.md 读取用户需求
4. 分析技术需求：API 端点、数据模型、前端组件、测试需求
5. 拆分为技术任务（每个任务 1-4 小时）
6. 使用 tasks.js add 创建任务
7. 更新 TECH.md

TECH.md 应该包含：
- 技术栈
- 目录结构
- 代码约定
- 重要文件位置
- API 设计原则
- 数据模型概述

完成后返回 JSON：
{{
  "task_id": "{task.id}",
  "tasks_created": 数量,
  "tech_context_updated": true,
  "summary": "简要总结"
}}
""",
        run_in_background=True
    )
    background_tasks.append(("design", task_id, task.id))
    print(f"  🎨 启动技术设计: {task.id}")
```

#### TDD 开发 subagent

```python
for task in pending_tasks[:MAX_PARALLEL]:
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

#### E2E 测试 subagent

```python
for task in testing_tasks[:MAX_PARALLEL]:
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
    background_tasks.append(("test", task_id, task.id))
    print(f"  🧪 启动E2E测试: {task.id}")
```

### 步骤 3：等待并收集结果

```python
import time

# 等待所有后台任务完成
results = []
while background_tasks:
    # 检查每个任务状态
    for task_type, task_id, original_id in background_tasks[:]:
        try:
            # 使用 TaskOutput 获取结果（非阻塞）
            result = TaskOutput(task_id=task_id, block=False, timeout=1000)

            if result is not None:
                # 任务完成
                type_emoji = {
                    "requirement": "📋",
                    "design": "🎨",
                    "dev": "💻",
                    "test": "🧪"
                }
                print(f"  {type_emoji.get(task_type, '✅')} 完成: {original_id}")
                results.append((task_type, result))
                background_tasks.remove((task_type, task_id, original_id))
        except:
            # 任务仍在运行
            pass

    time.sleep(5)  # 每 5 秒检查一次
```

### 步骤 4：处理结果

```python
# 处理每个任务的结果
for task_type, result in results:
    task_id = result.get("task_id")

    if task_type == "requirement":
        # 需求分析完成
        if result.get("context_update"):
            with open("ai-docs/CONTEXT.md", "a") as f:
                f.write(f"\n{result['context_update']}\n")
        # 更新任务状态
        Bash(command=f"node ${{CLAUDE_PLUGIN_ROOT}}/scripts/utils/tasks.js update {task_id} design")

    elif task_type == "design":
        # 技术设计完成
        if result.get("tech_context_updated"):
            print(f"  📝 技术上下文已更新")
        # 更新任务状态
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
        # 更新任务状态（根据返回的状态）
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

### 场景：12个任务（3需求 + 3设计 + 3开发 + 3测试）

| 模式 | 总耗时 | 说明 |
|------|--------|------|
| 串行 | 120分钟 | 需求→设计→开发→测试，每个10分钟 |
| 并行(3) | 40分钟 | 4个阶段各并行3个，同时执行 |

**加速比：约 3 倍**

## 输出格式

```
🚀 并行敏捷开发流程 (MAX_PARALLEL=3)

📋 待处理任务: 12 个
  - 需求分析: 3 个
  - 技术设计: 3 个
  - TDD 开发: 3 个
  - E2E 测试: 3 个

🚀 启动并行 subagent (12 个)
  📋 启动需求分析: REQ-001
  📋 启动需求分析: REQ-002
  📋 启动需求分析: REQ-003
  🎨 启动技术设计: DES-001
  🎨 启动技术设计: DES-002
  🎨 启动技术设计: DES-003
  💻 启动TDD开发: TASK-001
  💻 启动TDD开发: TASK-002
  💻 启动TDD开发: TASK-003
  🧪 启动E2E测试: TEST-001
  🧪 启动E2E测试: TEST-002
  🧪 启动E2E测试: TEST-003

⏳ 等待任务完成...
  📋 完成: REQ-001
  💻 完成: TASK-002
  🎨 完成: DES-001
  🧪 完成: TEST-001
  ...

📝 更新 CONTEXT.md
📊 批次完成，继续下一批...
```

## 核心原则

1. **Subagent 隔离**：每个任务在独立的 subagent 中执行，上下文自动隔离
2. **自动清理**：subagent 完成后，其上下文自动从主会话移除
3. **只保留摘要**：主会话只保留任务状态和关键摘要（200字）
4. **完全自动化**：持续运行，不需要人工干预
5. **默认并行**：多个阶段的任务默认并行执行，无需额外配置

## 注意事项

1. **使用 run_in_background=True**：所有 Task 调用必须设置此参数
2. **使用 TaskOutput(block=False)**：非阻塞获取结果
3. **限制并行度**：每个阶段最多 MAX_PARALLEL 个 subagent
4. **文件冲突**：任务拆分时避免文件重叠
5. **端口冲突**：动态端口分配（3000-3010）
6. **优先读取上下文**：每个 subagent 启动时，优先读取 CONTEXT.md 和 TECH.md

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

## 监控与调试

### 实时状态

```python
def show_status(background_tasks):
    """显示并行执行状态"""
    print(f"\n🚀 并行执行中 ({len(background_tasks)} 个 subagent)")

    for task_type, task_id, original_id in background_tasks:
        type_emoji = {
            "requirement": "📋",
            "design": "🎨",
            "dev": "💻",
            "test": "🧪"
        }
        # 检查任务状态
        try:
            result = TaskOutput(task_id=task_id, block=False, timeout=100)
            if result:
                print(f"  {type_emoji.get(task_type, '✅')} {original_id}: 已完成")
            else:
                print(f"  {type_emoji.get(task_type, '🔄')} {original_id}: 运行中")
        except:
            print(f"  ⚠️  {original_id}: 状态未知")
```

## 总结

**核心改进**：
1. **默认并行**：无需参数，自动并行执行
2. **多阶段并行**：需求、设计、开发、测试同时进行
3. **使用 run_in_background=True**：实现真正的并行
4. **使用 TaskOutput(block=False)**：非阻塞获取结果
5. **批次处理**：限制并行度，避免资源耗尽

**性能提升**：
- 串行：4 个阶段 × N 个任务 × 每个任务时间
- 并行：⌈N / MAX_PARALLEL⌉ × 每个任务时间
- 加速比：约 MAX_PARALLEL 倍
