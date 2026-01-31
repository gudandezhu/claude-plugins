---
name: agile-tech-design
description: 技术设计技能：拆分用户故事为技术任务
version: 3.0.0
---

# Agile Tech Design - 技术设计

## 任务

将用户故事拆分为具体的技术任务。

---

## 执行流程

### 第一步：读取用户故事

从 `ai-docs/PRD.md` 读取用户需求。

### 第二步：分析技术需求

识别：
- API 端点
- 数据模型
- 前端组件
- 测试需求

### 第三步：创建技术任务

为每个技术需求创建任务，添加到 `ai-docs/PLAN.md` 的待办列表。

**重要**：技术任务代码实现：
- TypeScript 代码使用 `/typescript`
- Python 代码使用 `/python-development`
- Shell 脚本使用 `/shell-scripting`

---

## 任务拆分示例

### 用户需求：用户认证

拆分为：
- TASK-001: 设计用户数据模型 (P0)
- TASK-002: 实现注册 API (P0)
- TASK-003: 实现登录 API (P0)
- TASK-004: 创建认证中间件 (P0)
- TASK-005: 编写单元测试 (P0)
- TASK-006: 创建登录页面 (P1)
- TASK-007: 集成测试 (P1)

---

## 输出结果

```
✅ 技术设计完成

用户需求: 用户认证

创建的技术任务: 7 个
- TASK-001: 设计用户数据模型 (P0)
- TASK-002: 实现注册 API (P0)
- TASK-003: 实现登录 API (P0)
- TASK-004: 创建认证中间件 (P0)
- TASK-005: 编写单元测试 (P0)
- TASK-006: 创建登录页面 (P1)
- TASK-007: 集成测试 (P1)

依赖关系:
- TASK-002 依赖 TASK-001
- TASK-003 依赖 TASK-001
- TASK-004 依赖 TASK-002, TASK-003
```
