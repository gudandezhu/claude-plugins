---
name: agile-flow-engine
description: 极简敏捷开发流程引擎：固定4个slot（需求1+设计1+开发1+测试1），完整流程（product→techdesign→develop→test）
version: 5.1.0
---

# Agile Flow Engine - 极简敏捷开发流程引擎

## 核心设计

**引擎只负责调度，subagent处理单任务后立即退出（清理上下文）**

主循环逻辑：
0. **检查引擎锁，防止重复启动**
1. 读取slot状态文件（ai-docs/run/.slots.json）
2. 为空闲slot启动subagent
3. 等待5秒
4. 检查完成的subagent并更新slot状态
5. 重复循环，直到所有slot空闲且无任务
6. 退出时清理slot状态文件和引擎锁

---

## 固定4 Slot策略

| Slot | 数量 | 处理任务 | 使用的技能 |
|------|------|----------|-----------|
| 需求 | 1个 | docs/PRD.md中未处理的需求 | agile-product-analyze |
| 技术设计 | 1个 | docs/PRD.md中的用户故事 | agile-tech-design |
| 开发 | 1个 | 状态为pending的任务 | agile-develop-task |
| 测试 | 1个 | 状态为testing的任务 | agile-e2e-test |

## Observer Subagent

Observer 作为独立的 subagent 运行，不占用 slot：
- **启动时机**：引擎启动时立即启动
- **运行方式**：后台运行（run_in_background: true）
- **生命周期**：随 Claude Code 退出而自动结束
- **职责**：持续监控项目并智能提出改进建议

**启动 Observer Subagent**：

使用 Task 工具启动 Observer：
- subagent_type: general-purpose
- run_in_background: true
- description: Observer Agent
- prompt内容：
```
使用 Observer Agent 监控项目状态并智能提出改进建议。

执行步骤：
1. 读取 ${CLAUDE_PLUGIN_ROOT}/agents/product-observer/agent.py
2. 实例化 ProductObserverAgent
3. 执行 observe_once() 方法进行一次观察分析
4. 等待 120 秒
5. 重复步骤 3-4，持续监控
6. 每次输出限制在 20 字以内

重要：Observer 作为 subagent 运行，当 Claude Code 退出时会自动结束。
```

---

## 环境变量

必须设置以下环境变量：
- `AI_DOCS_PATH`：指向ai-docs目录
- `CLAUDE_PLUGIN_ROOT`：指向agile-flow插件根目录

---

## 状态文件

### 引擎锁文件：`ai-docs/run/.engine.lock`

防止重复启动引擎，格式：
```json
{
  "pid": "进程ID",
  "startTime": "启动时间戳"
}
```

### Slot状态文件：`ai-docs/run/.slots.json`

持久化4个slot的运行状态，格式：
```json
{
  "requirement": {"agentId": "xxx", "status": "running", "taskId": null, "startTime": 1234567890},
  "design": {"agentId": "xxx", "status": "running", "taskId": null, "startTime": 1234567890},
  "develop": {"agentId": "xxx", "status": "running", "taskId": "TASK-001", "startTime": 1234567890},
  "test": {"agentId": "xxx", "status": "running", "taskId": "TASK-002", "startTime": 1234567890}
}
```

空闲slot状态：`null`

---

## 实现步骤

### 步骤0：初始化与锁检查

1. 检查引擎锁文件 `ai-docs/run/.engine.lock` 是否存在
2. 如果存在，读取锁文件，检查进程是否仍在运行
   - 如果进程仍在运行，立即退出（防止重复启动）
   - 如果进程已死，清理锁文件并继续
3. 创建新的引擎锁文件
4. 初始化slot状态文件 `ai-docs/run/.slots.json`（如果不存在）

### 步骤0.5：启动 Observer Subagent

引擎启动时立即启动 Observer subagent（仅启动一次，不在循环中重复启动）：

使用 Task 工具启动 Observer：
- subagent_type: general-purpose
- run_in_background: true
- description: Observer Agent
- prompt内容：
```
使用 Observer Agent 监控项目状态并智能提出改进建议。

执行步骤：
1. 读取 ${CLAUDE_PLUGIN_ROOT}/agents/product-observer/agent.py
2. 实例化 ProductObserverAgent
3. 执行 observe_once() 方法进行一次观察分析
4. 等待 120 秒
5. 重复步骤 3-4，持续监控
6. 每次输出限制在 20 字以内

重要：Observer 作为 subagent 运行，当 Claude Code 退出时会自动结束。
```

启动成功后记录 observer agentId（不写入 slots.json，Observer 不占用 slot）。

### 步骤1：读取slot状态

使用Read工具读取 `ai-docs/run/.slots.json`，获取4个slot的当前状态：
- requirement: 需求分析slot
- design: 技术设计slot
- develop: 开发slot
- test: 测试slot

### 步骤2：为空闲slot启动subagent

**关键**：只有当slot状态为null时才启动新agent

**需求slot启动条件**：slots.requirement === null 且 docs/PRD.md存在未处理需求

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-product-analyze技能，从docs/PRD.md读取一个未处理需求，评估优先级并创建任务，更新docs/CONTEXT.md，立即结束

启动成功后，更新 `ai-docs/run/.slots.json`：
```json
{
  "requirement": {"agentId": "返回的agentId", "status": "running", "taskId": null, "startTime": 当前时间戳}
}
```

**技术设计slot启动条件**：slots.design === null 且 docs/PRD.md存在用户故事

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-tech-design技能，从docs/PRD.md读取一个用户故事，拆分为技术任务，更新docs/TECH.md，立即结束

启动成功后，更新 `ai-docs/run/.slots.json`

**开发slot启动条件**：slots.develop === null 且 存在pending状态的任务

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-develop-task技能，获取一个pending任务，执行TDD开发，完成后更新状态为testing，立即结束

启动成功后，更新 `ai-docs/run/.slots.json`，记录taskId

**测试slot启动条件**：slots.test === null 且 存在testing状态的任务

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-e2e-test技能，获取一个testing任务，执行E2E测试，通过则更新为tested，发现bug则更新为bug，立即结束

启动成功后，更新 `ai-docs/run/.slots.json`，记录taskId

### 步骤3：检查完成的subagent

对每个非空闲的slot，使用TaskGet工具检查状态：
- 如果状态为completed：
  1. 输出完成信息
  2. 将slot状态设为null
  3. 更新 `ai-docs/run/.slots.json`
- 如果状态为error或failed：
  1. 输出错误信息
  2. 将slot状态设为null
  3. 更新 `ai-docs/run/.slots.json`

### 步骤4：检查退出条件

当满足以下所有条件时，引擎退出：
- 4个slot都空闲（全为null）
- 没有pending状态的任务
- 没有testing状态的任务
- docs/PRD.md没有未处理需求和用户故事

退出时：
1. 输出：所有任务已完成
2. 删除 `ai-docs/run/.slots.json`
3. 删除 `ai-docs/run/.engine.lock`

### 步骤5：等待并继续

等待5秒后，返回步骤1继续循环

---

## 输出格式规范

### Subagent输出要求

每个subagent必须严格限制输出在20字以内，避免上下文累积：

正确示例：
- ✓ TASK-001 → testing
- ✓ TASK-002 → tested
- ✓ 创建 5 个任务
- ✓ 拆分为 7 个技术任务
- ✓

### 引擎输出格式

主循环输出简洁格式：
- [req] ✓ 3个新任务
- [design] ✓ 拆分为 7 个技术任务
- [dev] ✓ TASK-001完成
- [test] ✓ TASK-002通过

---

## 任务状态流转

pending → inProgress → testing → tested → completed
                    ↓
                   bug

---

## 关键文件

- docs/PRD.md：产品需求文档
- data/TASKS.json：任务数据
- docs/CONTEXT.md：项目业务上下文
- docs/TECH.md：项目技术上下文
- BUGS.md：Bug列表
- CLAUDE_PLUGIN_ROOT/scripts/utils/tasks.js：任务管理工具

---

## 注意事项

1. 不要使用AskUserQuestion工具，流程必须完全自动化
2. 严格限制subagent输出在20字以内
3. 使用tasks.js工具管理任务状态
4. 固定只运行4个subagent，不要超过
5. 确保AI_DOCS_PATH和CLAUDE_PLUGIN_ROOT环境变量已设置
6. 需求分析创建用户故事级别的任务，技术设计将其拆分为技术任务
