---
name: agile-product-analyze
description: 产品需求分析技能：分析PRD、创建用户故事
version: 3.0.0
---

# Agile Product Analyze - 产品需求分析

## 任务

分析项目需求文档（PRD），创建用户任务。

---

## 执行流程

### 第一步：读取 PRD

读取 `ai-docs/PRD.md` 文件。

### 第二步：识别功能需求

从 PRD 中提取核心功能，记录：
- 功能名称
- 优先级
- 用户故事

### 第三步：创建用户任务

为每个功能创建任务，添加到 `ai-docs/PLAN.md` 的待办列表。

**代码实现规范**：
- 后续任务代码实现：
  - TypeScript 代码使用 `/typescript`
  - Python 代码使用 `/python-development`
  - Shell 脚本使用 `/shell-scripting`

---

## 用户任务模板

```markdown
## 用户故事

作为 [用户类型]，我想要 [功能]，以便 [价值]

## 验收标准

- [ ] 标准 1
- [ ] 标准 2
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

创建的任务: 5 个
- TASK-001: 用户认证
- TASK-002: 数据管理
...
```
