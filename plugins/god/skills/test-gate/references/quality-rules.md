~~# E2E 脚本质量原则（权威源）

检查范围：test() 块内部的业务逻辑。beforeEach 中用于关闭运行时干扰的
防御性 .catch 不算违规。覆盖层抑制由 fixtures.ts 全局处理。

---

## 原则 1：测真实系统，不测你的脚手架

正常流程中，被测系统必须是真实的——mock 的数据、注入的认证、跳过的导航，都是在测你的测试代码而非被测系统。

```typescript
// ✅ 正例：正常流程直接调真实 API，数据来自前置操作
const order = await createOrderViaUI(page);
expect(order.status).toBe('pending');

// ✅ 正例：异常场景允许 mock（test 名含 error/fail/异常/timeout/500/404/边界）
test('网络超时时显示错误提示', async ({ page }) => {
  await page.route('**/api/orders', route => route.abort());
  // ...
});

// ❌ 反例：正常流程 mock API——测的是 mock 返回的数据，不是系统
test('创建订单', async ({ page }) => {
  await page.route('**/api/orders', route => route.fulfill({ body: '{}' })); // 正常流程禁止
});

// ❌ 反例：硬编码测试数据——换个环境就废了
await page.fill('#name', '测试用户');
await page.fill('#phone', '13800138000');

// ❌ 反例：深度链接跳过导航——用户不会直接输入 URL
await page.goto('/order/detail/123'); // 内部页面必须通过 UI 操作到达

// ❌ 反例��注入认证绕过登录
await context.addCookies([{ name: 'token', value: 'fake' }]);
await page.evaluate(() => localStorage.setItem('token', 'fake'));
// 认证必须通过 storageState fixture 获取
```

## 原则 2：每个测试必须验证真实业务结果

没断言 = 没测。只验证"没报错"等于没测。截图是验收证据链。

```typescript
// ✅ 正例：断言业务结果 + 截图存证
const res = await page.waitForResponse(r => r.url().includes('/orders') && r.status() >= 200 && r.status() < 300);
const data = await res.json();
expect(data.status).toBe('active');
await page.screenshot({ path: `${TC}_result.png` });

// ❌ 反例：waitForResponse 不赋值——纯渲染等待，什么都没验证
await page.waitForResponse(r => r.url().includes('/orders')); // 不赋值，没断言

// ❌ 反例：整个 test() 没有 expect()
test('查看列表', async ({ page }) => {
  await page.goto('/');
  await page.click('text=订单管理');
  // 没有任何 expect()——通过不等于正确
});

// ❌ 反例：不截图——验收报告缺证据
// test() 结束前没有 page.screenshot()
```

## 原则 3：不要掩盖失败

测试的价值在于发现 bug。静默吞错误、条件跳过、绕过 actionability，都在掩盖问题。

```typescript
// ✅ 正例：让错误自然抛出，不可见就失败
await page.locator('.submit-btn').click(); // 元素不可见 → 测试失败 → 发现遮罩 bug

// ❌ 反例：.catch(() => {}) 吞错误——失败静默通过
await page.click('#btn').catch(() => {});

// ❌ 反例：if (visible) 包裹整个逻辑——不可见时跳过了所有验证
if (await page.locator('.form').isVisible()) {
  await fillForm();
  await submit();
}

// ❌ 反例：evaluate 绕过 actionability——遮住了遮罩层 bug
await page.evaluate(() => document.querySelector('.submit-btn').click());
// Playwright actionability 能发现遮罩问题，绕过它 = 掩盖 bug
// 例外：dom-probe.md 明确记录的元素允许但须注释原因
```

## 原则 4：API 交互必须健壮可配置

API 路径、状态码判断、数据获取方式必须适应环境变化，不能写死。

```typescript
// ✅ 正例：API_PREFIX 拼接 + 2xx 范围判断 + 正确的数据操作方式
const res = await page.waitForResponse(
  r => r.url().includes(`${API_PREFIX}/orders`) && r.status() >= 200 && r.status() < 300
);
// 清理数据用 page.request（浏览器上下文同源）
await page.request.delete(`${API_PREFIX}/orders/${orderId}`);

// ❌ 反例：=== 200——接口返回 204 时监听器永远不触发
await page.waitForResponse(r => r.status() === 200);

// ❌ 反例：硬编码 API 路径——换环境全部挂掉
await page.waitForResponse(r => r.url().includes('/saas/api/orders'));

// ❌ 反例：evaluate 中 fetch——浏览器上下文跨域必然失败
await page.evaluate(async () => {
  await fetch('/api/orders', { method: 'DELETE' }); // 跨域 403
});

// ❌ 反例：凭猜测写 waitForResponse URL
// URL 必须从 dom-probe.md 的"实际触发请求"章节获取，不是从 api-probe.md
```

## 原则 5：使用正确的 Playwright 模式

Playwright 有自己的 API 设计哲学。用原生 DOM 方式或自建 context 会绕过 Playwright 的保护机制。

```typescript
// ✅ 正例：Playwright 原生 API + fixtures
const page = await context.newPage(); // 使用 fixtures.ts 提供的 page/context
await page.locator('.el-form-item:has(.el-form-item__label:has-text("类型")) .el-select').click();
await page.getByTestId('submit-btn').click();

// ❌ 反例：querySelector 中 :visible——原生 DOM 不支持
await page.waitForSelector('.dialog:visible'); // SyntaxError

// ❌ 反例：browser.newPage()——不继承 storageState，API 无 auth
const page = await browser.newPage(); // beforeAll/afterAll 中禁止

// ❌ 反例：nth-of-type 定位下拉框——按 div 标签计数，不按 class
await page.locator('.el-select:nth-of-type(2)').click(); // 匹配第几个不确定

// ❌ 反例：裸 CSS 类选择器——组件结构变化就失效，多元素触发 strict mode
await page.locator('.el-table').click(); // 用 getByTestId > getByRole > getByText

// ❌ 反例：自建 context——绕过 fixtures.ts 的 el-tour 抑制等全局注入
const ctx = await browser.newContext(); // 禁止，必须用 fixtures 的 context
```

---

## 附录：原则 → 自动化检查映射

| 原则 | gate-check.js 步骤 | quality-auditor rule enum |
|------|-------------------|--------------------------|
| 原则 1 测真实系统 | 32-35（捷径检测） | normal-flow-mock, hardcoded-test-data, deep-link-bypass, auth-injection |
| 原则 2 验证结果 | 4c, 4e | missing-assertion, missing-screenshot |
| 原则 3 不掩盖失败 | 4a, 4b, 4d | catch-swallow, conditional-skip, evaluate-bypass |
| 原则 4 API健壮 | 4f, 4g, 9 | status-strict-equal, hardcoded-api-path, evaluate-fetch-cors |
| 原则 5 正确模式 | 10-14 | visible-in-queryselector, browser-new-page-no-storage, nth-of-type-select, or-locator-strict-mode, getbytext-el-select |

原则 5 中的 `or-locator-strict-mode`、`getbytext-el-select` 及裸 CSS 类选择器、waitForResponse 赋值、自建 context、URL 来源（dom-probe.md）共 5 项仅由 quality-auditor LLM 审核覆盖，gate-check.js 暂无自动化步骤。~~
