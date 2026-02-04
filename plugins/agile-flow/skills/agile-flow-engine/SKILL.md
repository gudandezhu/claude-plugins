---
name: agile-flow-engine
description: 自动化敏捷开发流程引擎，使用 Task tool 调用 subagent 完成任务，自动管理上下文隔离和清理
version: 2.0.0
---

# Agile Flow Engine

自动化敏捷开发流程引擎，使用 Task tool 调用 subagent 完成任务，实现自动上下文隔离和清理。

## 核心原则

1. **Subagent 隔离**：每个任务在独立的 subagent 中执行，上下文自动隔离
2. **自动清理**：subagent 完成后，其上下文自动从主会话移除
3. **只保留摘要**：主会话只保留任务状态和关键摘要（200字）
4. **完全自动化**：持续运行，不需要人工干预
5. **可追溯**：每个任务的结果保存在独立的 transcript 中

## 架构

```
agile-flow-engine (主会话，精简)
├─ Task tool → 需求分析 subagent (独立上下文)
├─ Task tool → 技术设计 subagent (独立上下文)
├─ Task tool → TDD 开发 subagent (独立上下文)
├─ Task tool → E2E 测试 subagent (独立上下文)
└─ 只保留：TASKS.json 状态 + 关键摘要
```

## 流程

| 阶段 | 使用 Skill |
|------|-----------|
| **需求分析** | `/agile-flow:agile-product-analyze` |
| **技术设计** | `/agile-flow:agile-tech-design` |
| **TDD 开发** | `/agile-flow:agile-develop-task` |
| **E2E 测试** | `/agile-flow:agile-e2e-test` |

## 环境变量

**必须设置**：
```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
```

## 执行步骤

### 步骤 1：检查需求池

从 `ai-docs/PRD.md` 读取新需求，使用 Task tool 调用 subagent：

```
Task(
  subagent_type="general-purpose",
  prompt=f"""
分析项目需求并创建任务到 TASKS.json

需求文件：ai-docs/PRD.md

步骤：
1. 读取 PRD.md
2. 识别功能需求
3. 评估优先级（P0/P1/P2/P3）
4. 使用 tasks.js add 创建任务

返回 JSON：
{{
  "tasks_created": 数量,
  "summary": "简要总结"
}}
"""
)
```

### 步骤 2：选择下一个任务

使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-next` 获取任务。

### 步骤 3：执行任务（使用 Subagent）

**开发任务**：
```
Task(
  subagent_type="general-purpose",
  description=f"TDD 开发：{task.description}",
  prompt=f"""
使用 TDD 流程完成任务：{task.description}

任务 ID: {task.id}
优先级: {task.priority}

TDD 流程：
1. 检查测试文件
2. 运行测试（红）→ npm run test:unit 或 pytest
3. 编写代码（绿）→ 使用 /typescript 或 /python-development
4. 重构
5. 检查覆盖率 ≥ 80%
6. 代码审核 → 使用 /pr-review-toolkit:code-reviewer

完成后返回 JSON：
{{
  "status": "testing" | "bug",
  "context_update": "50字更新（保存到 CONTEXT.md）",
  "bugs": ["BUG描述"]
}}
"""
)

# 更新任务状态
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {task.id} testing
```

**测试任务**：
```
Task(
  subagent_type="general-purpose",
  description=f"E2E 测试：{task.description}",
  prompt=f"""
使用 Playwright 进行 E2E 测试：{task.description}

任务 ID: {task.id}

步骤：
1. 启动项目
2. 使用 Playwright MCP 工具：
   - browser_navigate → 导航
   - browser_snapshot → 获取元素
   - browser_click/type → 操作
   - browser_console_messages → 检查错误
3. 截图记录

完成后返回 JSON：
{{
  "status": "tested" | "bug",
  "summary": "测试结果总结",
  "bugs": ["发现的BUG列表"]
}}
"""
)

# 更新任务状态
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {task.id} tested
```

### 步骤 4：验收

Subagent 完成后，提取返回的 JSON，保存关键信息：

```bash
# 从 subagent 结果中提取
context_update="..."  # 50字更新
api_changes="..."    # API 变更（如有）

# 保存到文档
echo "$context_update" >> ai-docs/CONTEXT.md

# 如果有 API 变更，记录到 API.md
if [ -n "$api_changes" ]; then
  echo "$api_changes" >> ai-docs/API.md
fi

# 更新任务状态到已完成
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {task.id} completed
```

### 步骤 5：上下文自动清理

**Subagent 完成后，其上下文自动从主会话移除**。

主会话只保留：
- TASKS.json 中的任务状态
- CONTEXT.md 中的上下文更新
- API.md 中的 API 变更

### 步骤 6：继续循环

返回步骤 1，处理下一个任务。

## Subagent Prompt 模板

### 需求分析模板

```
分析项目需求并创建任务到 TASKS.json

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
{
  "tasks_created": 数量,
  "context_updated": true,
  "summary": "简要总结"
}
```

### 技术设计模板

```
将用户故事拆分为技术任务并维护技术上下文

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**（第一步）：
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

TECH.md 应该包含（技术地图）：
- 技术栈
- 目录结构
- 代码约定
- 重要文件位置
- API 设计原则
- 数据模型概述

TECH.md 不应该包含（这些由 TODO 和需求管理）：
- 具体功能需求
- 详细实现步骤
- 业务逻辑说明

完成后返回 JSON：
{
  "tasks_created": 数量,
  "tech_context_updated": true,
  "summary": "简要总结（创建了哪些技术任务，更新了哪些技术上下文）"
}
```

### 开发任务模板

```
使用 TDD 流程完成任务：{task.description}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**（第一步）：
1. 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
2. 读取 ai-docs/TECH.md - 了解项目技术上下文

TDD 流程：
1. TODO 规划（如果超过 20 行）
2. 检查测试文件
3. 运行测试（红）
4. 编写代码（绿）→ 使用 Skill 工具调用 /typescript 或 /python-development
5. 重构
6. 检查覆盖率 ≥ 80%
7. 代码审核 → 使用 Skill 工具调用 /pr-review-toolkit:code-reviewer
8. 更新任务状态 → node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {id} testing

完成后返回 JSON：
{
  "status": "testing" | "bug",
  "context_update": "50字更新（保存到 CONTEXT.md）",
  "bugs": ["BUG列表"]
}
```

### 测试任务模板

```
使用 Playwright 进行 E2E 测试：{task.description}

环境变量：
export AI_DOCS_PATH="$(pwd)/ai-docs"

**优先读取项目上下文**（第一步）：
1. 读取 ai-docs/CONTEXT.md - 了解项目业务上下文
2. 读取 ai-docs/TECH.md - 了解项目技术上下文
3. 读取 ai-docs/PRD.md - 了解需求详情

步骤：
1. 启动项目
2. 使用 Playwright MCP 工具测试
3. 检查控制台错误
4. 如发现 BUG，记录到 BUGS.md
5. 更新任务状态 → node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update {id} tested

完成后返回 JSON：
{
  "status": "tested" | "bug",
  "summary": "测试结果总结",
  "bugs": ["BUG列表"]
}
```

## 输出格式

```
🔄 处理任务: TASK-001 (使用 subagent)
📊 Subagent 运行中...
✅ Subagent 完成
📝 已更新 CONTEXT.md
🧹 Subagent 上下文已自动清理
🎯 继续下一个任务...
```

## 注意事项

1. **使用 Task tool**：所有任务执行都通过 Task tool 调用 subagent
2. **优先读取上下文**：每个 subagent 启动时，优先读取 CONTEXT.md 和 TECH.md
3. **JSON 返回格式**：subagent 必须返回指定格式的 JSON
4. **自动清理**：subagent 完成后上下文自动移除，无需手动清理
5. **保留关键信息**：只保存摘要到文档，不保留详细过程
6. **状态同步**：及时更新 TASKS.json 中的任务状态
7. **上下文分层**：
   - CONTEXT.md（业务层）：项目概述、目标用户、核心功能、项目目标
   - TECH.md（技术层）：技术栈、目录结构、代码约定、API 设计
   - TODO（实现层）：具体实现点（在代码中）
