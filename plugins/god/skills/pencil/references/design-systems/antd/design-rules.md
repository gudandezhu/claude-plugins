# Ant Design 页面样式规范（模板）

> 基于 Ant Design Pro 布局规范，需根据实际项目调整。

## 1. 列表页样式

### 主内容区域
| 属性 | 值 |
|------|-----|
| fill | `#FFFFFF` |
| layout | `vertical` |
| gap | `16` |
| padding | `24` |

### 表格
| 属性 | 值 |
|------|-----|
| cornerRadius | `8` |
| stroke | `1px #F0F0F0` |
| 分页位置 | 表格底部右对齐 |

### 操作列
查看（链接）、编辑（链接）、删除（红色链接），用 Divider 分隔

## 2. 详情页/表单页卡片样式

| 属性 | 值 |
|------|-----|
| fill | `#FFFFFF` |
| cornerRadius | `8` |
| padding | `24` |
| stroke | 无（使用阴影） |
| shadow | `0 1px 2px rgba(0,0,0,0.03)` |

## 3. 侧边栏规范

| 规则 | 说明 |
|------|------|
| 布局 | ProLayout Sider |
| 当前页高亮 | 使用 Ant Design Menu selectedKeys |
| 主题 | 支持 light/dark 切换 |

## 4. 列宽规则

根据 Ant Design Table 自适应列宽机制，优先使用百分比或 ellipsis 截断。
