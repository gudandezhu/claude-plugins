---
status: stable
name: pencil
user-invocable: false
description: >
  UI 原型绘制规则集。支持 Pencil MCP（.pen 格式）和 HTML 两种模式。
  包含设计系统（大禹/Ant Design）、组件映射、原型 QA 规则。
  由 /zcode:ui 命令调用，不独立使用。
---

# UI 原型绘制规则集

## 模式选择

| 模式 | 触发条件 | 产物 |
|------|---------|------|
| Pencil | `mcp__pencil__get_editor_state()` 成功 | .pen 文件 + 导出图 |
| HTML | Pencil MCP 不可用 | HTML 文件 |

## Pencil 原型规则

### MCP 工具链

- `mcp__pencil__get_editor_state()` — 验证连接
- `mcp__pencil__batch_get()` — 读取组件
- `mcp__pencil__batch_design()` — 设计操作：C()复制模板、I()插入组件、U()更新属性、R()替换slot、D()删除节点
- `mcp__pencil__get_screenshot()` — 截图验证
- `mcp__pencil__snapshot_layout()` — 布局验证

### 组件映射

加载对应设计系统的组件映射表：
- 大禹：`${CLAUDE_PLUGIN_ROOT}/skills/pencil/references/design-systems/dayu/component-map.md`
- Ant Design：`${CLAUDE_PLUGIN_ROOT}/skills/pencil/references/design-systems/antd/component-map.md`

### 页面类型模板映射

| PRD 章节 | 页面类型 | 大禹模板 ID |
|----------|----------|------------|
| 列表页 | 列表页面 | MtsyV |
| 表单 | 表单页面 | VEdnN |
| 弹窗 | 弹窗 | 大禹弹窗模板 |

### 约束

- 组件库强制：Pencil 原型必须使用设计系统组件库，禁止手写组件
- 模板内容替换：复制模板后所有菜单、面包屑、标题必须替换为实际内容
- 表格标准宽度：1112px

## HTML 原型规则

- 技术栈：HTML5 + TailwindCSS CDN
- 禁止自定义 style
- 响应式：768px / 1024px / 1440px
- 可点击元素 `cursor-pointer`，hover 150-300ms 过渡
- 文字对比度 ≥ 4.5:1

## QA 规则

加载 `${CLAUDE_PLUGIN_ROOT}/skills/pencil/references/prototype-self-test-guide.md`

检查维度：
1. 覆盖度：PRD 页面 vs 原型页面一一对应
2. 操作闭环：按钮操作完整链路
3. 表单完整性：新增/编辑/删除/详情弹窗全覆盖
4. Pencil 专项：组件库合规、表格列宽、模板替换

通过标准：综合评分 ≥ 90%
修复循环：最多 2 轮

## 参考文件

| 场景 | 文件 |
|------|------|
| 原型自测指南 | `references/prototype-self-test-guide.md` |
| 大禹设计系统 | `references/dayu-design-system.md` |
| 大禹组件映射 | `references/design-systems/dayu/component-map.md` |
| 大禹设计规则 | `references/design-systems/dayu/design-rules.md` |
| 大禹设计 Token | `references/design-systems/dayu/design-tokens.md` |
| Ant Design 组件映射 | `references/design-systems/antd/component-map.md` |
| 设计调研 | `phases/design-research.md` |
| 原型创建 | `phases/prototype-creation.md` |
| 自测报告模板 | `templates/prototype-self-test-report.md` |
