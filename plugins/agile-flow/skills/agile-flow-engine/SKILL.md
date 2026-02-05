---
name: agile-flow-engine
description: 极简敏捷开发流程引擎：固定4个slot（需求1+设计1+开发1+测试1），完整流程（product→techdesign→develop→test）
version: 5.0.0
---

# Agile Flow Engine - 极简敏捷开发流程引擎

## 核心设计

**引擎只负责调度，subagent处理单任务后立即退出（清理上下文）**

主循环逻辑：
1. 检查4个slot状态
2. 为空闲slot启动subagent
3. 等待5秒
4. 检查完成的subagent并输出状态
5. 重复循环，直到所有slot空闲且无任务

---

## 固定4 Slot策略

| Slot | 数量 | 处理任务 | 使用的技能 |
|------|------|----------|-----------|
| 需求 | 1个 | PRD.md中未处理的需求 | agile-product-analyze |
| 技术设计 | 1个 | PRD.md中的用户故事 | agile-tech-design |
| 开发 | 1个 | 状态为pending的任务 | agile-develop-task |
| 测试 | 1个 | 状态为testing的任务 | agile-e2e-test |

---

## 环境变量

必须设置以下环境变量：
- `AI_DOCS_PATH`：指向ai-docs目录
- `CLAUDE_PLUGIN_ROOT`：指向agile-flow插件根目录

---

## 实现步骤

### 步骤1：状态管理

维护4个slot的运行状态：
- 需求slot：记录true（运行中）或null（空闲）
- 技术设计slot：记录true（运行中）或null（空闲）
- 开发slot：记录当前运行的任务ID或null（空闲）
- 测试slot：记录当前运行的任务ID或null（空闲）

### 步骤2：为空闲slot启动subagent

**需求slot启动条件**：slot空闲 且 PRD.md存在未处理需求

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-product-analyze技能，从PRD.md读取一个未处理需求，评估优先级并创建任务，更新CONTEXT.md，立即结束

**技术设计slot启动条件**：slot空闲 且 PRD.md存在用户故事

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-tech-design技能，从PRD.md读取一个用户故事，拆分为技术任务，更新TECH.md，立即结束

**开发slot启动条件**：slot空闲 且 存在pending状态的任务

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-develop-task技能，获取一个pending任务，执行TDD开发，完成后更新状态为testing，立即结束

**测试slot启动条件**：slot空闲 且 存在testing状态的任务

使用Task工具启动subagent：
- subagent_type: general-purpose
- run_in_background: true
- prompt内容：使用agile-e2e-test技能，获取一个testing任务，执行E2E测试，通过则更新为tested，发现bug则更新为bug，立即结束

### 步骤3：检查完成的subagent

对每个非空闲的slot，使用TaskGet工具检查状态：
- 如果状态为completed，输出完成信息，将slot设为空闲
- 如果状态为error或failed，输出错误信息，将slot设为空闲

### 步骤4：检查退出条件

当满足以下所有条件时，引擎退出：
- 4个slot都空闲
- 没有pending状态的任务
- 没有testing状态的任务
- PRD.md没有未处理需求和用户故事

退出时输出：所有任务已完成

### 步骤5：等待并继续

等待5秒后，返回步骤2继续循环

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

- AI_DOCS_PATH/PRD.md：产品需求文档
- AI_DOCS_PATH/TASKS.json：任务数据
- AI_DOCS_PATH/CONTEXT.md：项目业务上下文
- AI_DOCS_PATH/TECH.md：项目技术上下文
- AI_DOCS_PATH/BUGS.md：Bug列表
- CLAUDE_PLUGIN_ROOT/scripts/utils/tasks.js：任务管理工具

---

## 注意事项

1. 不要使用AskUserQuestion工具，流程必须完全自动化
2. 严格限制subagent输出在20字以内
3. 使用tasks.js工具管理任务状态
4. 固定只运行4个subagent，不要超过
5. 确保AI_DOCS_PATH和CLAUDE_PLUGIN_ROOT环境变量已设置
6. 需求分析创建用户故事级别的任务，技术设计将其拆分为技术任务
