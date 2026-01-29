---
name: agile-product-analyze
description: 产品需求分析技能：分析PRD、创建用户故事
version: 2.0.0
---

# Agile Product Analyze - 产品需求分析

## 任务

分析项目需求文档（PRD），创建用户故事。

---

## 执行流程

### 第一步：读取 PRD

读取 `ai-docs/PRD.md` 文件。

### 第二步：识别功能需求

从 PRD 中提取核心功能，记录：
- 功能名称
- 优先级
- 用户故事

### 第三步：创建用户故事

为每个功能创建用户故事文件：
`projects/active/backlog/STORY-XXX.md`

---

## 用户故事模板

```markdown
---
id: STORY-001
name: 用户认证
status: pending
priority: P0
acceptance_criteria:
  - 用户可以注册账户
  - 用户可以登录
  - 用户可以登出
---

## 用户故事

作为 用户，我想要 注册和登录账户，以便 访问个性化功能。

## 验收标准

- [ ] 用户可以使用邮箱注册
- [ ] 用户可以使用邮箱和密码登录
- [ ] 用户可以登出
- [ ] 密码加密存储
```

---

## 输出结果

```
✅ 分析完成

识别的功能: 5 个
- P0: 用户认证
- P0: 数据管理
- P1: 数据导出
- P1: 报表生成
- P2: 系统设置

创建的用户故事: 5 个
- STORY-001: 用户认证
- STORY-002: 数据管理
...
```
