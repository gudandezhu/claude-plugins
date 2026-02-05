---
name: agile-flow-engine
description: 极简敏捷开发流程引擎：顺序执行3个agent（规划+构建+验证）
version: 8.0.0
---

# Agile Flow Engine

顺序执行 3 个 agent：Planner → Builder → Verifier。

## 环境变量

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export CLAUDE_PLUGIN_ROOT="/data/project/claude-plugins/plugins/agile-flow"
```

## 执行步骤

1. **检查需求文档**：`ai-docs/REQUIREMENTS.md`

2. **启动 Dashboard**：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/web/server.js &
   echo $! > ai-docs/run/dashboard.pid
   ```

3. **执行 3 个 Agent**（顺序调用 skill）：
   - `agile-planner` - 分析需求，生成任务
   - `agile-builder` - TDD 开发
   - `agile-verifier` - E2E 验证

4. **显示总结**：
   ```
   ✅ Agile Flow 执行完成
   ✓ Planner: 创建 5 个任务
   ✓ Builder: 完成 3 个任务
   ✓ Verifier: 验证完成，5 passed
   📊 Dashboard: http://localhost:3737
   ```

## 停止

执行完 3 个 agent 后自动退出，Dashboard 继续运行，用 `/agile-stop` 停止。
