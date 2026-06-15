# Ant Design 组件库映射配置

## 组件库信息

| 配置项 | 值 |
|-------|-----|
| 组件库名称 | Ant Design 5.x |
| 组件库文件 | `/Users/wangjunyi/Desktop/工作/设计/ant.pen` |
| 版本 | v1.0 |
| 更新日期 | 2026-03-24 |
| Reusable组件数 | 30 |

---

## 布局模板

| 语义名称 | 组件ID | 说明 |
|---------|--------|------|
| layout.list-page | aSSt8 | 侧边栏列表页布局（1440×900） |
| layout.list-page.sidebar | 6XAyd | 侧边栏（208px暗色） |
| layout.list-page.header | RJCLw | 顶部导航栏 |
| layout.list-page.content | HtBiW | 主内容区域 |
| layout.list-page.sidebar-menu | QUdGw | 侧边栏菜单容器 |
| layout.modal | mHhnP | 模态弹窗（520px） |
| layout.modal.title | bLkFe | 弹窗标题文字 |
| layout.modal.body | JXcI4 | 弹窗内容区 |
| layout.modal.footer | BHS9t | 弹窗底部按钮区 |
| layout.popconfirm-danger | 15KOy | 危险确认气泡框 |
| layout.popconfirm-danger.title | Tv525 | 确认标题 |
| layout.popconfirm-danger.desc | 3DVat | 确认描述 |

## 按钮

| 语义名称 | 组件ID | 内部文字ID | 说明 |
|---------|--------|-----------|------|
| button.primary | Z48wx | WmnlU | 主按钮（蓝色） |
| button.primary.inner | DOlZ7 | - | 主按钮内层 |
| button.secondary | A1pIL | mZIjc | 默认按钮（白色+灰边框） |
| button.secondary.inner | zL07u | - | 默认按钮内层 |
| button.danger | HQThT | d9TJy | 危险按钮（红色） |
| button.danger.inner | WVaOa | - | 危险按钮内层 |
| button.text | DBPJM | 1YrYw | 文字按钮（蓝色文字） |
| button.text.inner | qCJms | - | 文字按钮内层 |

## 表单控件

| 语义名称 | 组件ID | 文字ID | 说明 |
|---------|--------|--------|------|
| input.search | xHctb | LdivC | 搜索输入框 |
| input.select | UiaGQ | sdv0e | 下拉选择框 |
| input.select.icon | - | Y5Tkb | 下拉图标 |
| input.date | qKfXU | YfPzN | 日期选择器 |
| input.date-range | 9Dcp5 | 6YcoX | 日期范围选择器 |
| form.field-row | FG50u | - | 表单字段行 |
| form.field-row.label | - | uB52m | 标签文字 |
| form.field-row.required | - | 0LFgR | 必填标记 |
| form.field-row.input | gIAgE | pvkO7 | 输入框插槽 |

## 数据展示

| 语义名称 | 组件ID | 说明 |
|---------|--------|------|
| table | GldtN | 表格 |
| table.head | upCMu | 表头行 |
| table.row | c4f37 | 数据行 |
| pagination | BqYmT | 分页器 |
| pagination.info | SA68F | 分页总数文字 |
| detail.field-row | iXTni | 详情字段行 |
| detail.field-row.label | 1237I | 标签 |
| detail.field-row.value | hLaxO | 值 |
| section-card | ay1Ww | 信息区块卡片 |
| section-card.title | xyJdX | 区块标题 |
| section-card.content | KOX0h | 内容插槽 |
| list-action-bar | qjnK3 | 列表操作栏 |
| list-action-bar.label | wy4No | "常用功能："标签 |
| statistic-card | F6U8n | 统计指标卡片 |
| statistic-card.label | yAkYF | 指标名称 |
| statistic-card.value | dAbvN | 指标数值 |
| statistic-card.trend-arrow | nIfJr | 趋势箭头 |
| statistic-card.trend-text | l4vnt | 趋势文字 |
| chart-card | nDOA2 | 图表区块卡片 |
| chart-card.title | 3iWD8 | 图表标题 |
| chart-card.placeholder | VMWLi | 图表占位文字 |

## 状态徽章

| 语义名称 | 组件ID | 文字ID | 说明 |
|---------|--------|--------|------|
| badge.primary | 00Ewq | jU1CB | 主色徽章（蓝色） |
| badge.success | 66gkr | as0ct | 成功徽章（绿色） |
| badge.warning | x7kLr | mv20b | 警告徽章（橙色） |
| badge.error | nAHx3 | gKc6j | 错误徽章（红色） |

## 反馈组件

| 语义名称 | 组件ID | 说明 |
|---------|--------|------|
| alert.info | PL4bU | 信息提示（蓝色） |
| alert.info.text | k1yIh | 提示文字 |
| alert.success | 8A6sz | 成功提示（绿色） |
| alert.success.text | 5efZD | 提示文字 |
| result.success | VfY7w | 成功结果卡片 |
| result.failure | p7AVj | 失败结果卡片 |
| empty | 54bag | 空状态 |

## 状态关键词映射

| 状态关键词 | 语义名称 |
|----------|---------|
| 正常/运行中/active/启用/达标 | badge.success |
| 异常/停止/inactive/禁用/不达标 | badge.error |
| 待处理/pending/警告/处理中 | badge.primary |

## 按钮样式推断

| 操作关键词 | 语义名称 |
|----------|---------|
| 新建/创建/添加 | button.primary |
| 导出/导入/刷新/重置 | button.secondary |
| 删除/移除 | button.danger 或红色文字 |
| 编辑/修改/查看 | 蓝色文字链接 |

## Tier颜色映射

| Tier | 背景色 | 文字色 |
|------|--------|--------|
| P0 | #FFF2F0 | #FF4D4F |
| P1 | #FFFBE6 | #FAAD14 |
| P2 | #FFFFF0 | #D4B106 |
| P3 | #E6F4FF | #1677FF |
