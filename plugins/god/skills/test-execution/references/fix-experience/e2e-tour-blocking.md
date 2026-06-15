# el-tour 引导弹窗遮挡操作

## 症状

- errorType: `element_blocked`
- message 关键词: `click intercepted` / `element is not visible` / `.el-tour`
- 表现：点击"新增"、"编辑"、"删除"等按钮后，后续操作超时或被拦截

## 根因

`el-tour` 引导弹窗在某些操作（新增、编辑、删除按钮点击）后动态创建，CSS 注入对动态创建的元素存在一帧竞争窗口，可能来不及隐藏就已经拦截了后续点击。

`beforeEach` 里的 tour 关闭只处理页面加载时已存在的 tour，无法处理操作触发的 tour。

## 影响范围

系统性——所有有 el-tour 引导的页面都会出现此问题。

## 修复方式（脚本层面）

在每个可能触发 tour 的点击操作**之后**立即调用 `dismissTour(page)`：

```typescript
// 修复前
await dismissTour(page);
await page.locator(SEL.addBtn).click();
await expect(page.locator(SEL.dialog)).toBeVisible();

// 修复后
await dismissTour(page);
await page.locator(SEL.addBtn).click();
await dismissTour(page);  // ← 点击后再次关闭，处理操作触发的 tour
await expect(page.locator(SEL.dialog)).toBeVisible();
```

`dismissTour` 函数必须用 `page.evaluate` 强制隐藏，不能只依赖 CSS 注入：

```typescript
async function dismissTour(page: any) {
  await page.evaluate(() => {
    document.querySelectorAll('.el-tour').forEach((el: any) => {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
  });
  const closeBtn = page.locator('.el-tour__close');
  if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
    await closeBtn.click().catch(() => {});
  }
}
```

## 修复方式（插件层面）

`skills/test-scripting/references/e2e-script-template.ts` 中的 `dismissTour` 函数改为 `page.evaluate` 强制隐藏版本，并在模板注释中说明：点击新增/编辑/删除后需要再次调用 `dismissTour`。

## 预防措施

run-test 生成脚本时，凡是点击会触发弹窗的按钮（新增、编辑、删除），在点击后统一加一次 `await dismissTour(page)`。
