---
name: agile-flow-engine
description: 自动化敏捷开发流程引擎，持续运行，自动管理任务流转、测试验收和需求处理。当用户执行 /agile-start 或需要启动自动化敏捷流程时使用此 skill。
version: 1.0.0
---

# Agile Flow Engine

自动化敏捷开发流程引擎，完全自动化的任务管理和流转。

## 核心原则

1. **完全自动化**：一旦启动就持续运行，不需要暂停
2. **持续循环**：不断处理任务直到全部完成
3. **自动恢复**：遇到错误时尝试自动恢复
4. **需求驱动**：用户通过 Web Dashboard 提交需求，系统自动处理
5. **统一目录**：所有数据在 `ai-docs/` 目录管理

## 自动化流程循环

```
需求池 → 任务选择 → 开发 → 测试 → 验收 → 下一个任务
   ↑                                      ↓
   └────────────── 自动循环 ←──────────────┘
```

## 执行步骤

### 步骤 1：检查需求池

从 `ai-docs/PRD.md` 读取新需求：
- 使用 `${CLAUDE_PLUGIN_ROOT}/scripts/utils/priority-evaluator.sh` 评估优先级
- 使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add <P0|P1|P2|P3> "描述"` 添加到 `ai-docs/TASKS.json`
- 状态默认为 `pending`

### 步骤 2：选择下一个任务

使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-next` 获取下一个任务。

优先级顺序：
1. BUG 任务（最高优先级）
2. 进行中任务
3. 待测试任务
4. 已测试任务
5. 待办任务（按 P0 → P1 → P2 → P3）

如果没有待处理任务，返回步骤 1。

### 步骤 3：执行任务

**如果任务在待办状态**：
- 使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <id> inProgress` 更新状态
- 根据任务类型选择技能：
  - TypeScript 代码：调用 `/typescript` skill
  - Python 代码：调用 `/python-development` skill
  - Shell 脚本：调用 `/shell-scripting` skill
- 代码审核：调用 `/pr-review-toolkit:code-reviewer` skill
- 提交：`git commit`
- 使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <id> testing` 更新到待测试

**如果任务在进行中状态**：
- 检查是否已完成
- 完成后使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <id> testing`

### 步骤 4：自动测试

对待测试任务执行：

1. **生成单元测试**（覆盖率 ≥ 80%）
   - TypeScript: 调用 `/typescript` skill
   - Python: 调用 `/python-development` skill
   - Shell: 调用 `/shell-scripting` skill

2. **运行测试**
   - TypeScript: `npm run test:unit -- --coverage`
   - Python: `pytest --cov`

3. **启动项目验证**
   - 查看日志是否有 error 信息
   - 使用 Playwright 进行功能验证

4. **处理结果**
   - 发现 Bug：记录到 BUGS.md，使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <id> bug`
   - 测试通过：使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <id> tested`

### 步骤 5：验收

对已测试任务：
1. 总结核心内容（200字）到 `ai-docs/ACCEPTANCE.md`
2. 更新 `ai-docs/CONTEXT.md`（50字）
3. 如果有 API 变更，记录到 `ai-docs/API.md`
4. 使用 `node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <id> completed` 移动到已完成

### 步骤 6：继续循环

返回步骤 1，继续处理下一个任务。

## 停止条件

只有在以下情况才停止：
1. 用户执行 `/agile-stop`
2. 所有任务完成且无新需求
3. 遇到无法自动解决的阻塞（记录到日志并提示用户）

## 输出格式

在执行过程中，输出清晰的进度信息：

```
🔄 正在处理任务: TASK-001
📊 当前进度: 5/10 (50%)
✅ 任务开发完成
🧪 开始测试...
✅ 测试通过
📝 验收完成
🎯 继续下一个任务...
```

## 注意事项

1. **永远不要使用 AskUserQuestion**：完全自动化，不需要询问用户
2. **自动处理错误**：如果遇到错误，尝试恢复或记录到 BUGS.md
3. **保持循环运行**：除非遇到停止条件，否则持续运行
4. **使用绝对路径**：使用 `${CLAUDE_PLUGIN_ROOT}` 引用插件资源
5. **统一数据目录**：所有数据都在 `ai-docs/` 目录
   - 任务数据：`ai-docs/TASKS.json`
   - 需求数据：`ai-docs/PRD.md`
   - 验收报告：`ai-docs/ACCEPTANCE.md`
   - Bug 列表：`ai-docs/BUGS.md`
