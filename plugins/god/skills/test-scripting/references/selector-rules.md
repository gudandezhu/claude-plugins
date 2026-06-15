# E2E 选择器决策规则

script-writer 和 quality-auditor 共同遵守的唯一规则源。

## 选择器优先级（从高到低选择第一个可用的）

| 优先级 | 方式 | 示例 | 适用场景 |
|--------|------|------|---------|
| 1 | getByTestId | `page.getByTestId('submit-btn')` | 前端加了 data-testid（最稳定） |
| 2 | getByRole/getByLabel | `page.getByRole('button', { name: '提交' })` | 语义化元素 |
| 3 | getByText (exact) | `page.getByText('确认', { exact: true })` | 唯一文本按钮/链接 |
| 4 | 父级限定 CSS | `.purchase-form .el-table` | 以上都不适用时 |

## 禁止规则

1. **禁止裸类选择器**：禁止单独使用 `.el-table`、`.el-select` 等纯类选择器，必须加父级限定
2. **禁止 nth-of-type 定位 el-select**：`.el-select:nth-of-type(N)` 按 div 标签计数不可预测；改用 `.el-form-item:has(.el-form-item__label:has-text("字段名")) .el-select`
3. **禁止 .or() + toBeVisible**：多元素匹配导致 strict mode 报错；改用 CSS 多选择器 `.el-message--error, .el-notification--error`
4. **禁止 getByText 定位 el-select**：placeholder 与 label 文字相同时会双重匹配；改用父级限定方式
5. **多元素场景必须加 .first() 或父级限定**：不依赖 strict mode 报错来发现歧义

## API 等待模式

- **waitForResponse URL**：必须用 `${API_PREFIX}` + 具体路径，禁止硬编码 `/api/`
- **waitForResponse 状态码**：`r.status() >= 200 && r.status() < 300`，禁止 `=== 200`
- **beforeEach 页面加载**：禁止 waitForResponse（竞态），禁止 waitForTimeout（不确定）；唯一正确方式 `await expect(page.locator(SEL.table)).toBeVisible({ timeout: 15000 })`
- **非列表页等待**：表单页用表单可见，详情页用关键字段可见
