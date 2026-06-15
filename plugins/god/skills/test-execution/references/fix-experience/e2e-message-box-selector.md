# el-message-box 确认弹窗选择器无容器限定

## 症状

- errorType: `unknown`（waitForResponse timeout）
- message 关键词: `waitForResponse timeout`、`Timeout 30000ms exceeded`
- 表现：点击"确定"后 delete/update API 未触发，waitForResponse 超时；但 `expect(confirmBtn).toBeVisible()` 通过

## 根因

`button.el-button--primary:has-text("确定")` 没有容器限定，匹配到了页面上其他 primary 按钮（如"新增规则"、"保存"等），点击了错误按钮，目标 API 自然不会触发。

`expect(confirmBtn).toBeVisible()` 通过是因为匹配到了错误的按钮，给出了假阳性。

Element Plus 的 `el-message-box`（`this.$confirm()`）渲染在 `body` 下的 `.el-message-box__wrapper` 容器内，必须加容器限定才能精确匹配。

## 影响范围

系统性 — 所有使用 `el-message-box`（`$confirm`）的确认弹窗都会出现此问题。

## 修复方式（脚本层面）

```typescript
// ✗ 错误：无容器限定，会匹配到页面其他 primary 按钮
deleteConfirmBtn: 'button.el-button--primary:has-text("确定")',
deleteCancelBtn: 'button:has-text("取消")',

// ✓ 正确：加 .el-message-box 容器限定
deleteConfirmBtn: '.el-message-box button.el-button--primary:has-text("确定")',
deleteCancelBtn: '.el-message-box button:has-text("取消")',
```

## 修复方式（插件层面）

- `dom-probe.md` 探测删除确认弹窗时，必须记录容器 class（`el-message-box` 或 `el-message-box__wrapper`）
- `skills/test-scripting/references/e2e-script-template.ts` 中确认弹窗选择器示例加容器限定

## 预防措施

run-test 生成脚本时：
- 确认弹窗（`$confirm`）按钮选择器必须加 `.el-message-box` 容器前缀
- 禁止裸用 `button.el-button--primary:has-text("确定")`——页面上可能同时存在多个 primary 按钮
- dom-probe.md 中"弹窗类型"字段若为 `el-message-box`，选择器必须带容器
