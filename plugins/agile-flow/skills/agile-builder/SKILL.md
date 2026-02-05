---
name: agile-builder
description: TDD 开发技能：循环处理 pending 任务，执行测试→红→绿→重构流程，标记为 tested
version: 8.0.0
---

# Agile Builder

按 TDD 流程开发任务，循环处理所有 pending 任务。

## TDD 流程（6 步骤）

1. **检查测试文件** - 确认存在
2. **运行测试（红）** - 确认失败
3. **编写最小代码（绿）** - 使测试通过
4. **重构** - 优化结构
5. **检查覆盖率** - 确保 ≥80%
6. **代码审核** - 使用 `/pr-review-toolkit:code-reviewer`

## 执行步骤

### 循环处理任务

1. **获取任务列表**
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list
   ```

2. **处理每个 pending 任务**
   - 获取任务详情：
     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-detail <TASK_ID>
     ```
   - 检查依赖任务状态
   - 执行 TDD 流程
   - 更新任务状态为 `tested`（跳过 `testing` 状态）
     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <TASK_ID> tested
     ```

3. **循环直到无 pending 任务**
   - 继续获取下一个 pending 任务
   - 重复上述流程
   - 直到所有 pending 任务处理完成

4. **退出**

## 输出要求

- 最多一行（如 `✓ TASK-001 → tested`）
- 不输出详细步骤
- 最多 20 字
