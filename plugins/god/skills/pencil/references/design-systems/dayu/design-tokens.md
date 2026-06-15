# 大禹设计Token

> 基于线上实际 UI 采集（2026-04-01），框架为 Element Plus。

## 颜色

### 主色系
| Token名称 | 值 | 说明 |
|----------|-----|------|
| color.primary | #409EFF | 主要操作按钮、链接、强调元素 |
| color.primary.hover | #66B1FF | 主色悬停 |
| color.primary.active | #3A8EE6 | 主色按下 |

### 功能色
| Token名称 | 值 | 说明 |
|----------|-----|------|
| color.success | #67C23A | 成功状态 |
| color.success.bg | #F0F9EB | 成功背景 |
| color.warning | #E6A23C | 警告提示 |
| color.warning.bg | #FDF6EC | 警告背景 |
| color.error | #F56C6C | 错误/危险 |
| color.error.bg | #FEF0F0 | 错误背景 |
| color.info | #909399 | 信息/进行中 |
| color.info.bg | #F4F4F5 | 信息背景 |

### 中性色
| Token名称 | 值 | 说明 |
|----------|-----|------|
| color.text.primary | #303133 | 标题、正文 |
| color.text.regular | #606266 | 常规文字 |
| color.text.secondary | #909399 | 辅助信息 |
| color.text.placeholder | #A8ABB2 | 占位符 |
| color.text.disabled | #C0C4CC | 禁用文字 |
| color.border | #DCDFE6 | 边框、分隔线 |
| color.border.light | #E4E7ED | 浅色边框 |
| color.bg.page | #F5F5F5 | 页面背景 |
| color.bg.card | #FFFFFF | 卡片背景 |
| color.bg.table-header | #FAFAFA | 表头背景 |
| color.bg.button-secondary | #FFFFFF | 次要按钮背景 |
| color.sidebar | #2E363F | 侧边栏背景 |
| color.sidebar.text | #EEF1F6 | 侧边栏文字 |
| color.sidebar.active-text | #FB9100 | 侧边栏选中文字（橙色） |
| color.sidebar.active-bg | #40536F | 侧边栏选中背景 |
| color.header | #E7EBF6 | 顶部导航背景 |

---

## 字体

| Token名称 | 值 | 说明 |
|----------|-----|------|
| font.family | -apple-system, system-ui, "SF Pro SC", "SF Pro Text", "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif | 系统字体栈 |
| font.size.h1 | 18px | 页面标题/弹窗标题 |
| font.size.h2 | 16px | 卡片/区块标题 |
| font.size.body | 14px | 正文内容、表格、筛选标签 |
| font.size.button | 12px | 按钮文字 |
| font.size.small | 12px | 辅助文字、徽章 |
| font.weight.bold | 700 | 弹窗标题字重 |
| font.weight.semibold | 600 | 表头字重 |
| font.weight.medium | 500 | 按钮/标签字重 |
| font.weight.normal | 400 | 正文字重 |

---

## 间距

| Token名称 | 值 | 说明 |
|----------|-----|------|
| spacing.xs | 4px | 徽章内边距、紧密元素 |
| spacing.sm | 8px | 相关元素、小间距 |
| spacing.md | 12px | 操作按钮间距 |
| spacing.lg | 16px | 卡片内边距、表单元素间距 |
| spacing.xl | 24px | 页面内边距、卡片间距 |
| spacing.page-padding | 24px | 页面内边距 |
| spacing.card-gap | 16px | 卡片间距 |
| spacing.form-gap | 16px | 表单元素间距 |
| spacing.button-gap | 8px | 按钮间距 |

---

## 圆角

| Token名称 | 值 | 说明 |
|----------|-----|------|
| radius.card | 4px | 卡片 |
| radius.button | 3px | 按钮 |
| radius.input | 4px | 输入框/下拉框 |
| radius.badge | 4px | 徽章 |
| radius.modal | 2px | 弹窗 |
| radius.pagination | 2px | 分页按钮 |

---

## 尺寸

| Token名称 | 值 | 说明 |
|----------|-----|------|
| size.page-width | 1440px | 页面总宽度（设计稿基准） |
| size.sidebar-width | 200px | 侧边栏菜单宽度 |
| size.sidebar-aside | 206px | 侧边栏容器宽度 |
| size.content-width | 1234px | 内容区宽度（1440-206） |
| size.page-height | 900px | 页面高度 |
| size.header-height | 44px | 顶部导航高度 |
| size.button-height | 24px | 按钮高度（小尺寸） |
| size.button-padding | 5px 11px | 按钮内边距 |
| size.input-height | 32px | 输入框/下拉框高度 |
| size.table-header-height | 40px | 表头行高 |
| size.table-row-height | 40px | 数据行高 |
| size.menu-item-height | 40px | 侧边栏菜单项高度 |
| size.modal-width.sm | 500px | 小弹窗宽度 |
| size.modal-width.md | 700px | 中弹窗宽度 |
| size.modal-width.lg | 800px | 大弹窗宽度 |
| size.pagination-button | 32px | 分页按钮尺寸 |

---

## 阴影

| Token名称 | 值 | 说明 |
|----------|-----|------|
| shadow.modal | 0px 12px 32px 4px rgba(0,0,0,0.04), 0px 8px 20px 0px rgba(0,0,0,0.08) | 弹窗阴影 |
| shadow.popconfirm | blur:12 color:#0000001A offset:0,4 | 气泡确认框阴影 |
| shadow.input-border | inset 0 0 0 1px #DCDFE6 | 输入框边框（Element Plus box-shadow 模拟） |
| shadow.focus | 0 0 0 2px rgba(64,158,255,0.2) | 焦点框阴影 |
