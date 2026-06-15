# waitForLoadState('networkidle') 导致 SPA 测试全量超时

## 症状

classify-error 输出 `unknown`，message 含 `Test timeout` 或 `waitForLoadState` + `networkidle`。
所有测试在页面导航后卡住，最终超时失败。

## 根因

SPA 应用（Vue/React）通常有持续的后台轮询（心跳、消息推送、WebSocket）或定时请求，
`networkidle` 要求网络请求静止 500ms，在有轮询的页面永远无法满足，导致等待超时。

## 影响范围

系统性——LLM 生成脚本时若使用 `waitForLoadState('networkidle')`，所有含该调用的测试都会超时。

## 修复方式（脚本层面）

将所有 `waitForLoadState('networkidle')` 和 `waitForLoadState('load')` 替换为：

```ts
// ✅ 正确：等待实际内容元素出现（Vue 组件挂载 + 异步数据请求完成后才可见）
await expect(page.locator('.el-table')).toBeVisible({ timeout: 15000 });
// 或等待自定义组件的实际渲染元素
await expect(page.locator('[class*="super-table"], .el-table')).toBeVisible({ timeout: 15000 });
```

**不要用 `waitForLoadState('load')` 替代**——它只等 HTML 解析完成，Vue 组件挂载和异步数据请求尚未完成，动态内容仍然找不到。

## 修复方式（插件层面）

`skills/test-scripting/prompts/script-writer.md` 禁止事项已更新：
- 禁止 `waitForLoadState('networkidle')`
- 禁止用 `waitForLoadState('load')` 等待页面内容就绪
- 必须用 `expect(page.locator(selector)).toBeVisible({ timeout: 15000 })`

## 预防措施

页面导航后的等待统一用：
1. `await expect(page.locator('.el-table')).toBeVisible({ timeout: 15000 })` — 等待列表页核心元素（含 Vue 异步渲染完成）
2. `await expect(page.locator(SEL.dialog)).toBeVisible()` — 等待弹窗出现
3. `await page.waitForResponse(r => r.url().includes(API_PREFIX) && ...)` — 等待特定 API 响应后再断言

`waitForLoadState` 只在需要等待静态资源加载时使用（如 `'domcontentloaded'`），不用于等待动态内容。
