# waitForResponse 超时的三种根因

## 症状

- errorType: `unknown`（classify-error 无法归类为明确的选择器/断言问题）
- message 关键词: `waitForResponse timeout`、`Timeout 30000ms exceeded`、`waiting for response`、`Test timeout of 30000ms exceeded`
- 表现：`page.waitForResponse(...)` 超时，但实际请求已发出且成功

## 根因

三种常见情况：

1. **API_PREFIX 缺失**：`waitForResponse` 使用硬编码路径（如 `/rule/delete`），但实际请求带有 `API_PREFIX`（如 `/saas/erp/biz/rule/delete`），URL 匹配不到。

2. **status 过严**：`r.status() === 200` 但接口实际返回 204 或其他 2xx，导致监听器永远不触发。

3. **API_PREFIX 双重拼接**（gen-skeleton.js 生成骨架时）：`api-probe.md` 记录的路径已含 apiPrefix（如 `/saas/erp/biz/finance/xxx`），gen-skeleton.js 提取后直接拼接 `${API_PREFIX}`，运行时变成 `/saas/erp/biz/saas/erp/biz/finance/xxx`，永远不匹配。LLM 直接从 api-probe.md 读取路径写脚本时同样会出现此问题。

4. **test 级 timeout 不足**：`playwright.config.ts` 未设置 `timeout`，默认 30000ms。测试前置步骤（等待表格、截图、等待弹窗）已消耗 10-20 秒，`waitForResponse` 的 `{ timeout: 30000 }` 还没触发，test 级 timeout 就先到期，整个 test 被硬截断。

5. **API 请求根本未发出**：按钮点击后没有触发 API 请求（业务逻辑问题、按钮被遮罩拦截、点击了错误元素），`waitForResponse` 永远等不到请求。
   - 排查方法：去掉 `waitForResponse`，改为直接断言操作结果（如表格行消失、弹窗关闭），如果断言也失败则说明操作本身未生效
   - 常见原因：el-tour 遮罩拦截了点击、el-message-box 确认按钮选择器匹配到了错误元素、el-switch 点击了外层 div 而非 `.el-switch__core`
   - 此类问题属于业务缺陷（`report-defect`）或脚本选择器问题，不是 `waitForResponse` 本身的问题

## 影响范围

系统性 — 所有使用 `waitForResponse` 的 E2E 脚本都可能受影响。

## 修复方式（脚本层面）

```typescript
// ✗ 错误：硬编码路径 + 严格 status
await page.waitForResponse(r => r.url().includes('/rule/delete') && r.status() === 200);

// ✓ 正确：使用 API_PREFIX + 宽松 2xx 判断
const API_PREFIX = process.env.API_PREFIX || '';
await page.waitForResponse(r =>
  r.url().includes(`${API_PREFIX}/rule/delete`) &&
  r.status() >= 200 && r.status() < 300
);
```

情况 3（从 api-probe.md 读取路径时）：

```typescript
// api-probe.md 中记录：### DELETE /saas/erp/biz/finance/statement-rules/delete/{bizKey}
// API_PREFIX = '/saas/erp/biz'

// ✗ 错误：直接用 api-probe.md 的完整路径拼接 API_PREFIX
await page.waitForResponse(r =>
  r.url().includes(`${API_PREFIX}/saas/erp/biz/finance/statement-rules/delete/`)
  // 运行时 → '/saas/erp/biz/saas/erp/biz/...' 永远不匹配
);

// ✓ 正确：从 api-probe.md 路径中剥离 apiPrefix，只保留业务路径
// 业务路径 = api-probe.md 路径去掉 apiPrefix 前缀
await page.waitForResponse(r =>
  r.url().includes(`${API_PREFIX}/finance/statement-rules/delete/`) &&
  r.status() >= 200 && r.status() < 300
);
```

## 修复方式（插件层面）

修正 `skills/test-scripting/references/e2e-script-template.ts`：
- 确保模板中所有 `waitForResponse` 示例都使用 `API_PREFIX`
- status 判断统一用 `r.status() >= 200 && r.status() < 300`，不用 `=== 200`

修正 `scripts/test-design/gen-skeleton.js`（情况 3 + 4 的根本修复）：
- `parseInteractionPatterns` 增加 `apiPrefix` 参数，提取 api-probe.md 路径后剥离 apiPrefix
- `main()` 中从 `config.backend?.apiPrefix` 读取并传入
- `generatePlaywrightConfig` 生成的 `defineConfig` 中加入 `timeout: 60000`

## 预防措施

run-test 生成 E2E 脚本时：
- 所有 `waitForResponse` 必须使用 `${API_PREFIX}` 拼接路径
- 禁止硬编码 API 路径（如 `/api/`、`/saas/`）
- status 判断用 `>= 200 && < 300`，不用 `=== 200`
- 从 api-probe.md 读取接口路径时，路径已含 apiPrefix（如 `/saas/erp/biz/finance/xxx`）。
  在 `waitForResponse` 中使用时，必须先去掉 apiPrefix 前缀，只保留业务路径（如 `/finance/xxx`），
  否则运行时会变成双重前缀永远不匹配
- `playwright.config.ts` 必须设置 `timeout: 60000`（test 级超时），
  默认 30000ms 在有多个前置步骤的测试中会被耗尽，导致 waitForResponse 被硬截断
