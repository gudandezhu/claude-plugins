# 遮罩层阻挡 click 操作

## 症状

- errorType: `element_blocked`
- message 关键词: `click timeout`、`.el-overlay`、`element is not visible`、`intercept`
- 表现：点击按钮超时，Playwright 报告元素被 `.el-overlay` 或 `.el-loading-mask` 遮挡

## 根因

两种常见场景：

1. **弹窗关闭后残留 overlay**：Element Plus 弹窗（el-dialog）关闭时有动画，
   overlay 层在动画期间仍然存在，阻挡后续操作。
2. **页面 loading 遮罩**：数据加载时的 `.el-loading-mask` 覆盖整个页面，
   阻挡工具栏按钮点击。

## 影响范围

系统性 — 所有涉及弹窗操作或页面加载的 E2E 脚本都可能受影响。

## 修复方式（脚本层面）

操作前等待遮罩层消失：

```typescript
// 等待 Element Plus overlay 消失
await expect(page.locator('.el-overlay')).not.toBeVisible({ timeout: 5000 });

// 等待 loading 遮罩消失
await expect(page.locator('.el-loading-mask')).not.toBeVisible({ timeout: 5000 });
```

更多 Element Plus 遮挡场景的修复策略（弹窗内部遮挡、checkbox 点击区域等），
详见 `element-plus-fix-patterns.md` 的「element_blocked 常见根因」章节。

## 修复方式（插件层面）

1. 修正 `scripts/test-design/gen-skeleton.js`：确保 `fixtures.ts` 模板包含覆盖层抑制配置
2. 修正 `skills/test-scripting/references/e2e-script-template.ts`：
   在弹窗操作后的示例中加入等待 overlay 消失的步骤

fixtures.ts 中应包含：
```typescript
// 覆盖层抑制 — 在每个测试前注入样式隐藏遮罩层
await page.addStyleTag({ content: '.el-overlay { display: none !important; }' });
```

注意：fixtures.ts 的覆盖层抑制是全局方案，但某些场景（如确认弹窗）需要 overlay 可见，
此时应在具体测试中临时移除抑制。

## 预防措施

run-test 生成 E2E 脚本时：
- 弹窗操作后必须等待 overlay 消失再进行下一步操作
- 页面导航或数据加载后等待 loading 遮罩消失
- 检查 fixtures.ts 是否包含 `.el-overlay` 选择器的覆盖层抑制
