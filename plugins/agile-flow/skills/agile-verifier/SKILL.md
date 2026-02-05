---
name: agile-verifier
description: E2E 验证技能：使用 Playwright 进行端到端测试，生成验证报告
version: 8.0.0
---

# Agile Verifier

使用 Playwright 验证 tested 任务。

## 执行步骤

1. 启动项目服务

2. 获取 tested 任务：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list
   ```

3. 使用 Playwright MCP 工具测试：
   - `browser_navigate`, `browser_snapshot`
   - `browser_click`, `browser_type`, `browser_fill_form`
   - `browser_console_messages`（必需）

4. 更新状态：
   - 通过 → `completed`
   - 失败 → `bug` + 记录到 `ai-docs/docs/BUGS.md`

5. 生成报告 `ai-docs/docs/VERIFICATION_REPORT.md`

## 输出

`✓ 验证完成: 5 passed, 1 failed`
