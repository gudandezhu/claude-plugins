---
name: agile-flow-engine
description: 自动化敏捷开发流程引擎（固定3个slot：开发1+测试1+需求1，智能上下文管理）
version: 4.1.0
---

# Agile Flow Engine

自动化敏捷开发流程引擎，固定保持 3 个 slot，每个 subagent 完成后立即启动新的。**智能管理对话上下文，避免超限。**

## 核心原理

**为什么需要引擎循环**？
- 每个 subagent 只处理一个任务就结束（清理上下文，避免 token 浪费）
- 引擎检测到完成后，立即启动新的同类型 subagent
- 这样始终有 3 个 subagent 在工作，但上下文不会堆积

**智能上下文管理**：
- 定期检查上下文使用情况
- 当接近限制时，使用 `/clear` 清理
- 确保主对话始终保持健康状态

## 并发策略

**固定 3 个 slot**：
- 开发 slot：1 个（持续处理 pending 任务）
- 测试 slot：1 个（持续处理 testing 任务）
- 需求 slot：1 个（持续处理 PRD.md 需求）

## 你需要做的

**重要**：直接执行，不要创建任何脚本文件。

### 主循环（智能上下文管理版）

**执行以下循环，直到 3 个 slot 都没有任务**：

#### 步骤 0：检查并管理上下文（每 10 轮检查一次）

**重要**：维护一个计数器，每执行 10 轮循环后，执行上下文管理：

1. **使用 Bash 工具模拟 `/context` 命令**：
   ```bash
   # 查看当前 token 使用估算
   # 粗略估算：假设每轮循环产生约 3-5k tokens
   # 已执行轮数 × 4k ≈ 当前 tokens
   ```

2. **判断是否需要清理**：
   - 如果当前 tokens > 150k（约 75% 使用率）
   - 或者 Messages 部分占比 > 80%

3. **执行清理**：
   - **不要使用 `/clear` 命令**（这会清除所有内容）
   - **而是：记录当前运行状态到文件，然后建议用户清理**
   - 或者：**减少循环输出的详细程度**

#### 步骤 1：检查是否有任务

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list
```

**重要**：只读取必要信息，不要输出完整 JSON 到对话中。使用 Bash 工具的静默模式：
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list 2>/dev/null | jq '.tasks | length'
```

#### 步骤 2：清理已完成的 subagent

对每个运行中的 subagent，使用 `TaskOutput(task_id, block=False, timeout=1000)` 检查：
- 如果已完成，从运行列表移除，记录该类型 slot 变为空闲

**不要输出详细状态**，只记录在内部变量中。

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

然后回到步骤 0，继续下一轮循环。

## 上下文管理策略

### 减少输出的方法

**❌ 不要这样做**：
```
🔄 运行中: 3/3
   开发: 1, 测试: 1, 需求: 1
💻 启动开发: TASK-001
🧪 启动测试: TASK-002
📋 启动需求: REQ-003
💻 完成: TASK-001
```

**✅ 应该这样做**：
- 只在关键事件输出（任务完成、错误）
- 使用简洁格式
- 或者**完全不输出**，只在完成时报告

### 推荐的输出策略

```python
# 每轮循环不输出，或者：
if 有新任务完成:
    输出 "✓ 完成: TASK-001"
if 发生错误:
    输出 "⚠️ 错误: ..."
```

### 自动清理阈值

- **每 30 轮检查一次**上下文使用情况
- **如果超过 150k tokens**：
  - 保存当前运行状态到文件
  - 输出：⚠️ 上下文接近限制，建议执行 /clear 清理
  - 继续运行（不清除，避免中断）

## 工作流程

```
主循环：
├── 步骤 0: 检查上下文（每 10 轮）
│   ├── 估算当前 tokens
│   ├── 如果 > 150k: 提示清理
│   └── 减少输出详细程度
├── 步骤 1: 检查任务（静默模式）
├── 步骤 2: 清理已完成的 SA（不输出）
├── 步骤 3: 启动新的 SA（不输出）
├── 步骤 4: 检查是否完成
└── 步骤 5: 等待 5 秒
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
5. **智能上下文管理** - 定期检查并控制输出，避免超限
6. **静默运行** - 减少不必要的输出，降低 token 消耗
