# {feature-name} — 领域知识入口

> god v0.5.0+ G10 落地。prd 阶段 0 自动加载本文件,brainstorm / build-spec / spec-review 共享术语表。
> 模板: ${CLAUDE_PLUGIN_ROOT}/templates/domain.md v0.1.0
> 修改请直接覆写本文件,不要新建 `spec/domain/<feature>.md`(多 feature 项目用 `spec/<feature>/domain.md` 扩展,**预留,未实现**)。

## 业务背景（≤ 3 句）

{domain-brief}

## 核心术语表

| 术语 | 业务定义 | 误用警告 |
|------|----------|----------|
| {term-1} | {business-def} | {avoid-confusing-with-X} |
| ... | ... | ... |

## 角色清单

| 角色 | 业务定位 | 关心什么 |
|------|----------|----------|
| {role-1} | {role-brief} | {role-concerns} |

## 业务流程骨架

1. {step-1}: {actor} → {action} → {outcome}
2. ...

## 反模式

- ❌ {anti-pattern-1}: {why-bad}
- ...

## 关联文档

- 需求清单: spec/sources.md
- 行为规格: spec/spec.feature
- 一页纸摘要: spec/summary.md
- 评审产物: spec/review/
