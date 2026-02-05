---
name: agile-verifier
description: E2E 验证技能：使用 Playwright 进行端到端测试，生成验证报告
version: 8.0.0
---

# Agile Verifier

使用 Playwright 进行 E2E 测试，验证所有 tested 任务。

## 执行步骤

1. **启动项目服务**
   - 确保项目服务正常运行
   - 记录服务地址

2. **获取 tested 任务列表**
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list
   ```

3. **使用 Playwright MCP 工具测试**
   - `browser_navigate` - 导航到 URL
   - `browser_snapshot` - 获取页面快照
   - `browser_click` / `browser_type` / `browser_fill_form` - 交互
   - `browser_console_messages` - 检查控制台错误（必需）

4. **更新任务状态**
   - 测试通过 → `completed`
   - 测试失败 → `bug` + 记录到 `ai-docs/docs/BUGS.md`

5. **生成验证报告**
   - 创建 `ai-docs/docs/VERIFICATION_REPORT.md`
   - 包含测试结果、覆盖率、问题列表

6. **输出简洁结果**
   - 最多一行（如 `✓ 验证完成: 5 passed, 1 failed`）
   - 不输出详细步骤
   - 最多 20 字

## 输出要求

- 最多一行（如 `✓ 验证完成: 5 passed, 1 failed`）
- 不输出详细步骤
- 最多 20 字
