---
name: agile-e2e-test
description: 端到端测试技能：使用 Playwright 进行功能验证、记录结果
version: 6.0.0
---

# Agile E2E Test

使用 Playwright 进行 E2E 测试。

## 执行步骤

1. 启动项目服务
2. 获取 testing 任务
3. 使用 Playwright MCP 工具测试：
   - `browser_navigate` - 导航到 URL
   - `browser_snapshot` - 获取页面快照
   - `browser_click` / `browser_type` / `browser_fill_form` - 交互
   - `browser_console_messages` - 检查控制台错误（必需）
4. 更新任务状态：
   - 通过 → `tested`
   - 失败 → `bug` + 记录到 `BUGS.md`

## 输出要求

- 最多一行（如 `✓ TASK-001 → tested`）
- 不输出详细步骤
- 最多 20 字
