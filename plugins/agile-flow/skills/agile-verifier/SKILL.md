---
name: agile-verifier
description: 回归和集成测试：验证所有 tested 任务的功能完整性
version: 8.0.0
---

# Agile Verifier

对 tested 任务进行回归测试和集成测试，确保功能完整性。

## 与 Builder 的区别

- **Builder**：单元测试 + E2E 测试（单个功能开发时）
- **Verifier**：回归测试 + 集成测试（所有功能联调）

## 执行步骤

1. 启动完整项目服务

2. 获取 tested 任务：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list
   ```

3. **回归测试** - 逐个验证功能：
   - 使用 Playwright 完整测试流程
   - 验证所有已测试功能仍正常工作
   - 检查 `browser_console_messages` 错误

4. **集成测试** - 跨功能验证：
   - 验证功能间交互正常
   - 验证端到端业务流程
   - 验证数据一致性

5. 更新状态：
   - 通过 → `completed`
   - 失败 → `bug` + 记录到 `ai-docs/docs/BUGS.md`

6. 生成报告 `ai-docs/docs/VERIFICATION_REPORT-{第几次迭代}.md`

## 输出

`✓ 回归: 5 passed, 集成: 2 passed`
