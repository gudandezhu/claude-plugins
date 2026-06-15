---
name: code-review
user-invocable: false
description: >
  代码审查规范。需求合规检查 + 代码质量检查两阶段评估��
  评估逻辑由 eval-loop（维度名 code-review）统一执行。
---

# 代码审查

## 概述

开发完成并编译通过后，对代码进行审查。审查分两阶段：先检查是否实现了需求，再检查代码质量。

**核心原则：** 审查不通过就不能提交。

## 何时触发

- 功能开发完成、编译通过后
- 修复复杂 bug 后
- 提交代码前

## 流程

```
开发完成 + 编译通过
        ↓
调用 eval-loop(项目根目录, code-review, 90, 3)
        ↓
  ┌─ ✅ 通过 → 返回通过
  └─ ❌ 不通过 → eval-loop 自动修复并重新评估
```

## 执行步骤

### 1. 调用 eval-loop

```
eval-loop(项目根目录, code-review, 90, 3)
```

eval-loop 会加载 `eval-loop/references/rubric-code-review.md`，评估阶段会：
1. Glob + Read 读取目标目录下的源码文件
2. 按需求合规（40分）+ 代码质量（60分）两阶段评分
3. 不通过则 fixer 自动修复并重新评估

### 2. 处理评估结果

**通过：** 返回通过。

**不通过：** eval-loop 会在最大迭代次数内自动修复+重新评估。若最终仍不通过，报告剩余问题。

## 评估维度

评估由 eval-loop 统一执行，使用 `rubric-code-review` 维度。各维度满分：

| 维度 | 满分 |
|------|------|
| 需求合规 | 40 |
| 代码质量 | 60 |
| **合计** | **100** |

详细检查项见 `eval-loop/references/rubric-code-review.md`。

## 输入

从任务文件 frontmatter 获取：
- `project-dir`：项目代码目录（作为 eval-loop 的目标路径）
- `acceptance-criteria`：AC 条目列表（reviewer 用于需求合规检查）
- `api-docs`：API 文档路径列表（reviewer 用于接口合规检查）

## 禁止事项

- 禁止跳过审查直接提交
- 禁止自审（评估与开发必须隔离）
- 禁止不修复就标记通过

User input: $ARGUMENTS
