---
name: agile-flow-engine
description: 极简敏捷开发流程引擎：顺序执行3个agent（规划+构建+验证）
version: 8.0.0
---

# Agile Flow Engine

顺序执行 3 个 agent：Planner → Builder → Verifier。

**注意**：Dashboard 由 `/agile-start` 启动，本 skill 只负责执行 3 个 agent。

## 执行步骤

1. **检查需求文档**：`ai-docs/PRD.md`

2. **执行 3 个 Agent**（使用 Task 工具）：
   - `subagent_type=agile-flow:planner` - 分析需求，生成任务
   - `subagent_type=agile-flow:builder` - TDD 开发
   - `subagent_type=agile-flow:verifier` - 回归和集成测试

3. **显示总结**：
   ```
   ✅ Agile Flow 执行完成
   ✓ Planner: 创建 5 个任务
   ✓ Builder: 完成 3 个任务
   ✓ Verifier: 验证完成，5 passed
   📊 Dashboard: http://localhost:3737
   ```

## 输出要求

每完成一个 agent，输出一行简洁结果。
