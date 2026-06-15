# Element Plus 修复策略参考

## element_blocked 常见根因：Element Plus 弹窗遮挡

Element Plus 的 `el-dialog` 弹窗内部元素（combobox、checkbox、date-picker）
经常因为弹窗自身的 overlay 层或其他弹出层（el-select-dropdown、el-popper）遮挡而无法点击。

修复策略（按优先级）：
1. 检查 fixtures.ts 的覆盖层抑制是否包含了 `.el-overlay` 选择器
2. 弹窗内的 `el-select` 展开后 dropdown 可能被另一个 overlay 遮挡——
   使用 `{ force: true }` 点击，但必须注释原因
3. 如果多个弹窗嵌套（如弹窗内再弹确认框），等待外层弹窗动画完成后再操作内层
4. `el-checkbox` 的可点击区域是 `.el-checkbox__input`，不是外层 `.el-checkbox`——
   选择器不精确会导致点击到 label 区域被遮挡

## selector_ambiguous 常见根因：Element Plus 文本重复

`getByText()`、`getByRole()` 在 Element Plus 页面中极易匹配多个元素，
因为表格单元格、面包屑、菜单项、下拉选项可能包含相同文本。

修复策略——用作用域限定消除歧义：
- 下拉选项：`page.locator('.el-select-dropdown:visible').getByRole('option', { name: '...' })`
- 弹窗内按钮：`page.locator('.el-dialog:visible').getByRole('button', { name: '...' })`
- 表格行操作：`page.locator('.el-table__row').filter({ hasText: '唯一标识' }).getByText('编辑')`
- Tab 切换：`page.locator('.el-tabs__nav').getByText('...')`
- `:visible` 过滤隐藏的同结构 DOM 元素（多个 dropdown 同时存在）


## element_blocked 常见根因：页面级遮罩层阻挡操作按钮

除了弹窗内部遮挡，页面级操作按钮（如工具栏的"新增"按钮）也可能被遮罩层阻挡。
常见场景：页面加载时有 loading overlay、或上一个操作的弹窗关闭动画未完成。

修复策略：
1. 操作前等待遮罩层消失：`await expect(page.locator('.el-overlay')).not.toBeVisible({ timeout: 5000 });`
2. 如果页面有 loading 遮罩：`await expect(page.locator('.el-loading-mask')).not.toBeVisible();`
3. 如果是弹窗关闭后的残留 overlay：等待动画完成 `await page.waitForTimeout(300);`（仅此场景允许短暂硬等待）

## waitForResponse URL 匹配失败：API_PREFIX 缺失

`waitForResponse` 的 URL 匹配必须包含 `API_PREFIX` 环境变量，否则在非默认前缀的环境中匹配不到。

常见错误：
```typescript
// ✗ 硬编码路径
await page.waitForResponse(r => r.url().includes('/rule/delete'));
// ✗ 使用通用 /api/ 前缀，实际环境可能不是 /api/
await page.waitForResponse(r => r.url().includes('/api/'));
```

正确写法：
```typescript
const API_PREFIX = process.env.API_PREFIX || '';
// ✓ 使用环境变量 + 具体接口路径
await page.waitForResponse(r => r.url().includes(`${API_PREFIX}/rule/delete`) && r.status() === 200);
```

删除确认弹窗的完整等待模式：
```typescript
// 点击删除 → 等待确认弹窗 → 点击确认 → 等待 API + 弹窗消失
await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click();
await Promise.all([
  page.waitForResponse(r => r.url().includes(`${API_PREFIX}/rule/delete`) && r.status() === 200),
  expect(page.locator('.el-message-box')).not.toBeVisible(),
]);
```
