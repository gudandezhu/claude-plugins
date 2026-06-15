---
name: dayu
label: 大禹平台
description: >
  面向大禹平台的 PRD 类型。强制商业建模（Phase 3.5）、平台能力审计、
  知识库交叉校验。原型通过 /zcode:ui 命令生成（Pencil + dayu 组件库）。
modeling: required
---

# 大禹平台类型

## 适用场景

- 大禹平台新功能开发
- 大禹平台现有页面增强
- 涉及大禹平台组件的任何需求

## 差异规则

### Phase 1 增强：平台能力审计（强制）

需求分析阶段必须执行平台能力盘点：

1. 读取大禹平台产品知识库主文档，了解平台全貌和导航结构
2. 根据需求描述定位涉及的模块目录，读取对应模块概述文档
3. 深入读取涉及页面的子页面文档，获取现有字段、筛选条件、操作按钮、数据量等信息
4. 盘点已有平台能力：

| 能力类型 | 已有平台能力 | 本需求是否需要 | 对接方式 |
|---------|------------|--------------|---------|
| 告警通知 | 已有告警平台 | 是/否 | API 对接 / 直接复用 |
| 权限管理 | 平台权限系统 | 是/否 | 直接复用 |
| 审计日志 | 通用审计服务 | 是/否 | 事件上报 |
| ... | ... | ... | ... |

原则：能复用不自建，需要对接的在 PRD 关联性需求中说明。

### Phase 3.5 增强：知识库强制阅读

建模阶段开始前（prd-phase-prepare.md step 3），必须读取知识库中每个涉及页面的子页面文档：
- 逐字段记录现有页面完整结构（筛选条件、列表字段、操作按钮、统计卡片、数据规模）
- 增强型页面必须先完整列出现有字段，再标注新增字段
- 禁止凭假设描述页面结构，必须以知识库文档为准
- 知识库无记录时，使用 Playwright 访问实际页面获取结构信息（兜底）

### Phase 4 增强：知识库交叉校验（强制）

编写功能描述（M09）之前，必须执��（仅当 M09 被激活时）：
1. 重新读取知识库中每个涉及页面的子页面文档
2. PRD 字段表格中每个字段标注"现有"或"新增"
3. 现有字段描述必须与知识库完全一致
4. 增强型页面先完整列出现有字段，再标注新增字段

### Phase 5b 重定向

- 跳过 Phase 5b HTML 生成
- 提示用户使用 `/zcode:ui $PRD_OUTPUT`（Pencil MCP + dayu_platform.lib.pen 组件库）

### Phase 5 自审（3 级自适应）

加载 `references/prd-review-workflow.md`，根据需求规模选择自审层级：

| 规模 | 人天 | 自审层级 | 检查项数 |
|------|------|---------|---------|
| 小 | 1-3 | 轻量 | 5 项 |
| 中 | 4-10 | 标准 | 12 项 |
| 大 | 10+ | 完整 | 18 项 |

输出到 `$PROJECT_DIR/08-self-review.md`。

### 跨职能评审（可选）

加载 `references/cross-functional-review.md`：

| 规模 | 建议 | 模式 |
|------|------|------|
| 大（10+ 人天） | 必须 | 同步 30 分钟 |
| 中（4-10 人天） | 建议 | 异步 10-15 分钟/人 |
| 小（1-3 人天） | 可跳过 | — |

评审维度：产品视角（5 项）+ 设计视角（5 项）+ 研发视角（5 项）+ 测试视角（3 项）。

### 变更管理

PRD 变更涉及页面字段、功能模块、导航结构时：
- 必须同步更新大禹平台产品知识库中受影响的模块文档
- 记录到 `大禹平台产品知识库/CHANGELOG.md`
- 设计资产沉淀：原型中发现的新组件添加到 `dayu_platform.lib.pen`，更新 `component-map.md`

## 设计系统

- 设计系统：`dayu`
- 组件映射：`skills/pencil/references/design-systems/dayu/component-map.md`
- 设计 Token：`skills/pencil/references/design-systems/dayu/design-tokens.md`
- 设计规则：`skills/pencil/references/design-systems/dayu/design-rules.md`

## 模块要求

按 SKILL.md 场景→模块映射表动态选配模块 + 上述差异约束（仅在被激活的模块上生效）。

## 规则引用

| 场景 | 读取文件 |
|------|---------|
| 工作流（变更管理） | `${CLAUDE_PLUGIN_ROOT}/skills/prd/references/prd-write-workflow.md` |
| PRD 编写规范 | `${CLAUDE_PLUGIN_ROOT}/skills/prd/references/prd-writing-guide.md` |
| 需求自审 | `${CLAUDE_PLUGIN_ROOT}/skills/prd/references/prd-review-workflow.md` |
| 跨职能评审 | `${CLAUDE_PLUGIN_ROOT}/skills/prd/references/cross-functional-review.md` |
| 分析模板 | `${CLAUDE_PLUGIN_ROOT}/skills/prd/references/analysis-templates.md` |
| PRD 写作规范+模板 | `${CLAUDE_PLUGIN_ROOT}/skills/prd/references/prd-writing-guide.md` |

## 重点关注

- M02（需求背景与目标）：包含平台能力复用表
- M09（功能详细说明）：字段来源标注（现有/新增），以知识库为准
- M11（异常与边界）：四维度覆盖
- M12（权限与敏感信息）：平台角色体系对齐
