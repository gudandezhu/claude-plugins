---
name: agile-develop-task
description: TDD 开发技能：测试检查→红→绿→重构→覆盖率≥80%→代码审核
version: 6.0.0
---

# Agile Develop Task

按 TDD 流程开发任务。

## TDD 流程（6 步骤）

1. **检查测试文件** - 确认存在
2. **运行测试（红）** - 确认失败
3. **编写最小代码（绿）** - 使测试通过
4. **重构** - 优化结构
5. **检查覆盖率** - 确保 ≥80%
6. **代码审核** - 使用 `/pr-review-toolkit:code-reviewer`

## 执行步骤

1. 获取任务详情：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-detail <TASK_ID>
   ```
2. 检查依赖任务状态
3. 执行 TDD 流程
4. 更新任务状态：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <TASK_ID> testing
   ```

## 输出要求

- 最多一行（如 `✓ TASK-001 → testing`）
- 不输出详细步骤
- 最多 20 字
