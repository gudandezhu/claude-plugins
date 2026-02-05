---
name: agile-builder
description: TDD 开发技能：先写完整测试用例，确保全部通过，循环处理 pending 任务
version: 8.0.0
---

# Agile Builder

按 TDD 流程开发 pending 任务。

**核心原则**：先写完整测试，全部通过才 OK。

## 循环处理任务

1. 获取任务：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-detail <TASK_ID>
   ```

2. 执行 TDD（见下方）

3. 更新状态：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <TASK_ID> tested
   ```

4. 重复直到无 pending 任务

## TDD 流程（7 步）

1. **编写完整测试** - 覆盖正常、边界、异常场景
2. **运行（红）** - 确认测试失败
3. **编写代码** - 最小实现
4. **运行（绿）** - 全部通过
5. **覆盖率** - ≥80%
6. **重构** - 保持全绿
7. **审核** - `/pr-review-toolkit:code-reviewer`

## 输出

`✓ TASK-001 → tested (12 tests passed)`
