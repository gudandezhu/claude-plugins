# Element Plus 选择器精确定位规则

> 本文件仅在 `techStack.uiLibrary` 为 `element-plus` 时加载。
> 其他 UI 框架用户无需阅读。

`getByText()`、`getByRole()` 等语义定位器在 Element Plus 页面中极易匹配到多个元素
（表格单元格、面包屑、菜单项都可能包含相同文本），导致 `selector_ambiguous`。
必须用作用域限定或结构选择器消除歧义：

**弹窗内文本输入框（el-dialog 内）**：
```typescript
// ✗ 即使加了 dialog 容器限定，el-select 内部也有隐藏 input，仍会 selector_ambiguous
const dialog = page.locator('.el-dialog:visible');
await dialog.locator('.el-input input').fill('规则名称'); // 匹配到 2 个

// ✓ 用 placeholder 精确定位
await dialog.getByPlaceholder('请输入规则名称').fill('规则名称');
// ✓ 或用 form-item label 过滤
await dialog.locator('.el-form-item:has(.el-form-item__label:has-text("规则名称")) input').fill('规则名称');
```

**弹窗内下拉框（el-select）**：
```typescript
// ✗ nth-of-type 按 div 标签类型计数，不按 class，结果不可预测
await dialog.locator('.el-select:nth-of-type(1)').click(); // 实际匹配第几个不确定

// ✓ 用 form-item label 文字过滤，精确定位对应的 el-select
await dialog.locator('.el-form-item:has(.el-form-item__label:has-text("对账类型")) .el-select').click();
```

**下拉选项（el-select / el-cascader）**：
```typescript
// ✗ getByText('客户对账') — 表格里也有这个文本，匹配 23 个
// ✓ 限定到下拉面板内
await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '客户对账' }).click();
// 或用 option role
await page.locator('.el-select-dropdown:visible').getByRole('option', { name: '客户对账' }).click();
```

**弹窗内元素（el-dialog）**：
```typescript
// ✗ getByText('保存') — 页面上可能有多个"保存"按钮
// ✓ 限定到当前可见弹窗
const dialog = page.locator('.el-dialog:visible');
await dialog.getByRole('button', { name: '保存' }).click();
```

**表格操作按钮**：
```typescript
// ✗ getByText('编辑') — 每行都有编辑按钮
// ✓ 先定位到目标行，再找按钮
const row = page.locator('.el-table__row').filter({ hasText: '目标数据标识' });
await row.getByText('编辑').click();
```

**Tab 切换**：
```typescript
// ✗ getByText('基本信息') — 可能匹配到 tab 内容区的文本
// ✓ 限定到 tab 导航区
await page.locator('.el-tabs__nav').getByText('基本信息').click();
```

**通用原则**：
- 先用 `.locator()` 限定到容器（dialog/dropdown/table-row），再用语义定位器找目标
- `:visible` 伪类过滤隐藏的同结构元素（如多个 el-select-dropdown 同时存在于 DOM）
- 表格行操作必须先定位行（通过唯一标识文本），再在行内找按钮
- 如果 dom-probe.md 记录了 data-testid，优先使用——它天然唯一

**data-testid 短路规则**：

当元素有 `data-testid` 属性时（dom-probe.md 中选择器为 `getByTestId('xxx')` 格式），
直接使用 `page.getByTestId('xxx')` 定位，跳过上述所有复杂结构化选择器。
无 `data-testid` 的元素仍按上述规则处理。

```typescript
// 有 data-testid 时：直接用 getByTestId，无需容器限定或结构化选择器
await page.getByTestId('prd-btn-create').click();
await page.getByTestId('prd-select-type').click();
await page.getByTestId('prd-input-name').fill('规则名称');

// 无 data-testid 时：保持原有结构化定位方式
await dialog.locator('.el-form-item:has(.el-form-item__label:has-text("规则名称")) input').fill('规则名称');
```

注意：`getByTestId` 定位的元素仍需遵守交互规则（如 el-select 点击后选项在 teleport 面板中、el-input-number 需要特殊填充方式）。`getByTestId` 解决的是「找到元素」的问题，不改变「操作元素」的方式。

**el-table 影子表问题（固定列场景）**：

Element Plus 的固定列实现会在 DOM 中生成两个 `.el-table` 实例：
- 第一个：`display:none` 的影子表（用于固定列宽度计算）
- 第二个：`display:flex` 的主滚动表（用户实际看到的）

```typescript
// ✗ .first() 会选中隐藏的影子表，后续操作全部失败
page.locator('.el-table.super-table').first()

// ✓ 方案 A：用 .last() 选中主表
page.locator('.el-table.super-table').last()

// ✓ 方案 B：可见性过滤（更健壮，不依赖 DOM 顺序）
page.locator('.super-table-container:visible .el-table')
```

**规则**：
- 禁止对 `.el-table` 使用 `.first()`——固定列场景下第一个是隐藏的影子表
- 必须使用 `.last()` 或可见性过滤（`:visible`）
- 如果 dom-probe.md 的"多实例元素说明"章节有记录，按其推荐方式定位

**确认弹窗（el-message-box）**：
```typescript
// ✗ 无容器限定，会匹配到页面其他 primary 按钮（如"新增"、"保存"）
// ✗ 'button.el-button--primary:has-text("确定")'
// ✓ 加 .el-message-box 容器限定
await page.locator('.el-message-box button.el-button--primary:has-text("确定")').click();
await page.locator('.el-message-box button:has-text("取消")').click();
```

**UI 组件内置行为注意**：
- `el-input-number` 的 min/max 会在组件级别限制输入，不会触发表单验证错误
- `el-select` 有默认值时没有 placeholder——不要用 placeholder 文本做选择器
- `el-switch` 切换后可能有异步 API 调用——需要等待请求完成后再断言状态
- `el-dialog` 的确认按钮文字可能是"确定"、"保存"、"提交"中的任意一个——必须从 dom-probe.md 获取

## 组件运行时行为（脚本必须处理）

### el-input-number
- `fill()` 不触发 Vue 的 change 事件，表单校验认为字段未修改
- 必须使用 `fillNumberInput()` 辅助函数（见 e2e-script-template.ts）
- 或手动：click → fill('') → pressSequentially(value) → dispatchEvent('change') → blur

### el-select dropdown teleport
- el-select 的下拉面板默认 teleport 到 body，不在 .el-dialog 内部
- 定位下拉选项时不能用 `dialog.locator('.el-select-dropdown')`
- 正确：`page.locator('.el-select-dropdown:visible .el-select-dropdown__item')`

### el-tour 引导遮罩
- `.el-tour__hollow` 是 `<path>` 子元素，才是实际拦截 pointer-events 的元素，仅隐藏 `.el-tour` 根元素不够
- Vue 异步重挂载会让 tour 在 `dismissTour` 调用后重新出现，必须用 MutationObserver 持续压制
- CSS 注入必须覆盖所有子元素：`.el-tour, .el-tour *, .el-tour__hollow { display: none !important; pointer-events: none !important; }`
- 调用 `dismissTour` 后必须等待 `.el-tour` 进入 `hidden` 状态再继续操作

### el-switch
- 点击外层 `.el-switch` div 可能不触发 change 事件
- 正确：点击 `.el-switch__core`（内层核心元素）
- 状态判断：用 class `.is-checked` 而非 `aria-checked`（el-switch 不一定有 aria 属性）

### el-checkbox
- 点击外层 `.el-checkbox` 可能被 label 文字遮挡
- 正确：点击 `.el-checkbox__input` 或 `.el-checkbox__original`

### beforeAll/afterAll 中创建页面必须带 storageState

- `browser.newPage()` 在新的浏览器上下文中创建页面，不继承 fixtures 注入的 storageState
- 没有 storageState 的页面发出的 API 请求无 auth cookie，创建/删除测试数据必然失败
- 失败后列表找不到目标行，后续所有依赖该数据的用例级联失败

```typescript
// ✗ 错误：不继承 storageState，API 无 auth
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  // ...
});

// ✓ 正确：显式传入 storageState
test.beforeAll(async ({ browser }) => {
  const storageStatePath = path.resolve(WORK_DIR, 'testing/auth/storage-state.json');
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  // ... 创建测试数据
  await context.close();
});
```
- 编辑弹窗打开后，数据通过 API 异步加载，表单字段初始为空
- 必须等待关键字段有值后再操作：`waitForFormPopulated(page, selector)`
- `waitForFormPopulated` 内部必须用 `page.locator().waitFor()` 或 `expect().not.toHaveValue()`，禁止用 `page.waitForSelector(':visible')` 或 `querySelector(':visible')`——`:visible` 是 Playwright 伪类，原生 DOM API 不支持
- 不要在弹窗 visible 后立即读取字段值

### 测试清理/前置数据操作禁止用 page.evaluate fetch
- `page.evaluate` 在浏览器上下文执行，受同源策略限制，跨域请求后端 API 必然失败
- 清理代码（afterAll/afterEach 中删除测试数据）必须用 `page.request` 或 `request` fixture：
```typescript
// ✗ 错误：浏览器上下文跨域失败
await page.evaluate(() => fetch(`${API_BASE}/api/delete/${id}`, { method: 'DELETE' }));
// ✓ 正确：Node.js 上下文，不受同源策略限制
await page.request.delete(`${process.env.BACKEND_URL}${API_PREFIX}/finance/rules/${id}`);
```

### el-message / el-notification 错误提示
- 错误提示文字由后端返回，不一定包含"失败"或"重试"
- 宽松匹配：优先匹配 `.el-message--error` class，而非文字内容
- 或使用 `waitForErrorMessage()` 辅助函数
- **禁止用 `.or()` 复合 locator 配合 `toBeVisible()`**——两侧都匹配时合并结果含多个元素，strict mode 下报错；改用多选择器 CSS 字符串：
  ```typescript
  // ✗ 错误：.or() 两侧都匹配时触发 strict mode
  page.locator('.el-message--error').or(page.locator('.el-notification--error'))
  // ✓ 正确：多选择器 CSS 字符串，单次匹配
  page.locator('.el-message--error, .el-notification--error')
  ```

### el-select placeholder 与 label 文字相同导致歧义
- el-select 的 placeholder 文字（如"选择供应商"）与 form-item label 文字相同时，`getByText` 会同时匹配 label 元素和 select 内部的 placeholder span
- 禁止用 `getByText('选择供应商')` 定位 el-select
- 正确做法：用 form-item label 过滤定位 el-select，再点击：
  ```typescript
  // ✗ 错误：匹配到 label + placeholder 两个元素
  await page.getByText('选择供应商').click();
  // ✓ 正确：通过 form-item 容器精确定位
  await page.locator('.el-form-item:has(.el-form-item__label:has-text("供应商")) .el-select').click();
  ```

## 菜单树区域使用指导（tree-context.json 存在时）

从 tree-context.json 的 menuTree 提取区域信息，生成对应的等待和断言策略：

| 区域 | 等待策略 | 关闭策略 |
|------|---------|---------|
| E区(弹窗) | `expect(overlay).toBeVisible()` | 关闭后 `expect(overlay).toBeHidden({ timeout: 2000 })` |
| D区(确认) | D区优先级高于E区 | 先点确认/取消，再等E区overlay消失 |
| S区(抽屉) | `expect(drawer).toBeVisible()` | `expect(drawer).toBeHidden()` |
| F区(全屏) | transition 动画完成 | 返回按钮/浏览器后退 |

### 菜单树区域使用禁止事项

❌ 禁止将 zone 值用于 CSS 选择器：
   `await page.locator('.el-dialog[style*="z-index: 100"]');` // 错误

❌ 禁止将 zone 值用于 z-index 断言：
   `await expect(dialog).toHaveCSS('z-index', '100');` // 错误

❌ 禁止假设 zone 值与 Element Plus z-index 一致

✅ zone 仅用于指导操作顺序和等待策略：
   ```typescript
   if (interaction.zone === 'D区') {
     await handleConfirmDialog(); // D区优先处理
   }
   await expect(page.locator('.el-overlay')).toBeHidden();
   ```

不存在 tree-context 时跳过此章节。

## 组件状态断言规则

Element Plus 组件的状态变化通过 CSS class 切换实现，但 class 名称与通用前端框架（如 Bootstrap 的 `.active`）不同。
script-writer 生成状态断言时必须使用以下规则，禁止猜测 class 名称。

### 按钮激活/选中状态

Element Plus 按钮通过 `type` 属性变化表示激活，对应的 CSS class：
- 激活：class 包含 `el-button--primary`
- 未激活：class 包含 `el-button--default`（或无 primary）

```typescript
// ✓ 正确：检查 el-button--primary
await expect(btn).toHaveClass(/el-button--primary/);       // 激活
await expect(btn).not.toHaveClass(/el-button--primary/);   // 未激活

// ✗ 错误：Element Plus 不使用 .active
await expect(btn).toHaveClass(/active/); // 必定失败
```

### Tab 激活状态

```typescript
await expect(tab).toHaveClass(/is-active/);   // 当前激活的 tab
```

### 表格展开行

```typescript
await expect(row.locator('.el-table__expand-icon')).toHaveClass(/el-table__expand-icon--expanded/);
// 或检查展开内容行可见性
await expect(page.locator('.el-table__expanded-cell:visible')).toBeVisible();
```

### 开关（el-switch）状态

```typescript
await expect(switchEl).toHaveClass(/is-checked/);   // 开启
await expect(switchEl).not.toHaveClass(/is-checked/); // 关闭
```

### 多选框（el-checkbox）状态

```typescript
await expect(checkbox).toHaveClass(/is-checked/);    // 勾选
await expect(checkbox).not.toHaveClass(/is-checked/); // 未勾选
```

### 输入框聚焦状态

```typescript
await expect(input).toHaveClass(/is-focus/); // 聚焦
```

### 下拉框展开状态

```typescript
// el-select 展开时 popper 添加 is-visible（非 select 本身）
await expect(page.locator('.el-select-dropdown:visible')).toBeVisible();
```

### 通用规则

- **禁止使用 `toHaveClass(/active/)`** — Element Plus 不使用 `.active` class
- **禁止猜测状态 class** — 必须使用上述已知映射或从 dom-probe.md 的状态变化快照获取
- 如果 dom-probe.md 包含"状态变化快照"章节，优先使用其中记录的实际 class 变化
- 如果无法确定状态 class，降级使用 `toBeVisible()` / `not.toBeVisible()` 断言

**el-loading-mask 等待规则**：

Element Plus 表格数据加载时显示 `.el-loading-mask` 遮罩，覆盖整个页面内容。
所有操作按钮（新增、汇总显示、导出等）在遮罩期间无法点击。

```typescript
// ✗ 表格可见后立即点击，loading mask 可能仍在显示
await expect(page.locator(SEL.table)).toBeVisible({ timeout: 15000 });
await page.locator(SEL.addBtn).click(); // 可能被 .el-loading-mask 遮挡

// ✓ 表格可见后等待 loading 消失再操作
await expect(page.locator(SEL.table)).toBeVisible({ timeout: 15000 });
await waitForLoading(page);
await page.locator(SEL.addBtn).click();
```

**规则**：
- beforeEach 中表格可见检查后必须调用 `waitForLoading(page)`
- 翻页/重新加载/切换视图后必须等待 loading 消失
- `waitForLoading` 已在 e2e-script-template.ts 中定义，直接调用即可
