# 选择器歧义（strict mode violation）

## 症状

- errorType: `selector_ambiguous`
- message 关键词: `strict mode violation`、`resolved to N elements`、`getByText`
- 表现：Playwright strict mode 报错，一个选择器匹配到多个元素

## 根因

Element Plus 页面中，表格单元格、面包屑、菜单项、下拉选项经常包含相同文本。
使用 `getByText()`、`getByRole()` 不加作用域限定时，会匹配到多个元素。

常见场景：
- 表格中多行包含相同操作按钮（"编辑"、"删除"）
- 下拉选项与页面其他文本重复
- 多个不可见的 dropdown DOM 同时存在（Element Plus 不销毁已关闭的 dropdown）

## 影响范围

系统性 — 所有使用 `getByText`/`getByRole` 的 E2E 脚本都可能受影响。

## 修复方式（脚本层面）

用作用域限定消除歧义（核心原则：先限定容器，再找目标）：

```typescript
// ✗ 错误：全局搜索，匹配多个
page.getByText('编辑');

// ✓ 正确：限定在特定表格行
page.locator('.el-table__row').filter({ hasText: '唯一标识' }).getByText('编辑');
```

更多 Element Plus 选择器歧义场景（下拉选项、弹窗按钮、Tab 切换等），
详见 `element-plus-fix-patterns.md` 的「selector_ambiguous 常见根因」章节。

## 修复方式（插件层面）

修正 `skills/test-scripting/references/element-plus-scripting-rules.md`：
- 强调所有选择器必须加作用域限定
- 补充 `:visible` 过滤隐藏 DOM 的规则
- 列出 Element Plus 常见的重复文本场景

## 预防措施

run-test 生成 E2E 脚本时：
- 禁止使用无作用域的 `getByText()`、`getByRole()`
- 表格行操作必须先 `.filter({ hasText: '唯一标识' })` 定位行
- 下拉选项必须加 `:visible` 过滤
- 弹窗内操作必须限定在 `.el-dialog:visible` 内
