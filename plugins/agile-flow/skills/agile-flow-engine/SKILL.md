---
name: agile-flow-engine
description: 自动化敏捷开发流程引擎（固定3个slot：开发1+测试1+需求1）
version: 4.0.0
---

# Agile Flow Engine

自动化敏捷开发流程引擎，固定保持 3 个 slot，每个 subagent 完成后立即启动新的。

## 核心原理

**为什么需要引擎循环**？
- 每个 subagent 只处理一个任务就结束（清理上下文，避免 token 浪费）
- 引擎检测到完成后，立即启动新的同类型 subagent
- 这样始终有 3 个 subagent 在工作，但上下文不会堆积

## 并发策略

**固定 3 个 slot**：
- 开发 slot：1 个（持续处理 pending 任务）
- 测试 slot：1 个（持续处理 testing 任务）
- 需求 slot：1 个（持续处理 PRD.md 需求）

## 你需要做的

**重要**：直接执行，不要创建任何脚本文件。

### 主循环（简化版）

**执行以下循环，直到 3 个 slot 都没有任务**：

#### 步骤 1：检查是否有任务

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list
```

#### 步骤 2：清理已完成的 subagent

对每个运行中的 subagent，使用 `TaskOutput(task_id, block=False, timeout=1000)` 检查：
- 如果已完成，从运行列表移除，记录该类型 slot 变为空闲

#### 步骤 3：为空闲的 slot 启动新的 subagent

**开发 slot（如果空闲且有待开发任务）**：
- 使用 `Task` 工具，subagent_type="general-purpose", run_in_background=true
- prompt: "使用 /agile-flow:agile-develop-task 技能，从 TASKS.json 中获取一个 status='pending' 的任务并执行 TDD 开发。处理完这个任务后就结束"
- 记录到运行列表：running["dev"] = task_id

**测试 slot（如果空闲且有测试任务）**：
- 使用 `Task` 工具，subagent_type="general-purpose", run_in_background=true
- prompt: "使用 /agile-flow:agile-e2e-test 技能，从 TASKS.json 中获取一个 status='testing' 的任务并执行 E2E 测试。处理完这个任务后就结束"
- 记录到运行列表：running["test"] = task_id

**需求 slot（如果空闲且 PRD.md 有未处理需求）**：
- 使用 `Task` 工具，subagent_type="general-purpose", run_in_background=true
- prompt: "使用 /agile-flow:agile-product-analyze 技能，从 PRD.md 中读取一个未处理的需求，评估并创建任务到 TASKS.json。处理完这个需求后就结束"
- 记录到运行列表：running["requirement"] = task_id

#### 步骤 4：检查是否全部完成

如果：
- 3 个 slot 都空闲
- 且没有 pending 任务
- 且没有 testing 任务
- 且 PRD.md 没有未处理需求

则显示 "✅ 所有任务已完成" 并结束。

#### 步骤 5：等待 5 秒

使用 Bash 工具：`sleep 5`

然后回到步骤 1，继续下一轮循环。

## 工作流程

```
主循环：
├── 检查任务状态
├── 清理已完成的 SA
├── 为空闲 slot 启动新 SA
│   ├── 开发 slot 空闲? → 启动开发 SA
│   ├── 测试 slot 空闲? → 启动测试 SA
│   └── 需求 slot 空闲? → 启动需求 SA
├── 全部完成? → 结束
└── 等待 5 秒 → 回到开始
```

## 上下文清理示例

```
时间线：
T0: 启动开发SA-1 (处理任务1)
T1: SA-1 完成，结束 (上下文清理)
T2: 引擎检测到开发 slot 空闲，启动开发SA-2 (处理任务2)
T3: SA-2 完成，结束 (上下文清理)
T4: 引擎检测到开发 slot 空闲，启动开发SA-3 (处理任务3)
...
```

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
```

## 关键说明

1. **每个 subagent 只处理一个任务** - 避免上下文堆积
2. **引擎主循环** - 检测完成并启动新的 subagent
3. **固定 3 个 slot** - 开发、测试、需求各一个
4. **使用 run_in_background=true** - 并行执行
