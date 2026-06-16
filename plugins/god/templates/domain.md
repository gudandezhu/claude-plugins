<!--
  domain.md 模板 v0.1.0
  适用: god v0.5.0+ G10 落地,prd 阶段 0 自动加载
  位置: spec/domain.md(与 spec.feature 同级,便于 spec-validate 一并校验)
  约束: ≤ 80 行 · 术语表 5-15 条 · 反模式 ≤ 5 条
  不可手改核心段(术语表/反模式) —— 修改请走 ADR
-->

# {domain-name} — 领域知识入口

> god v0.5.0+ G10 落地。该文件由 OPC 在 prd 阶段 0 调研时填写,作为后续 brainstorm / build-spec / spec-review 的术语统一源。
> 详细规范: docs/rfcs/0010-domain-md.md(待写)
> 自动加载: prd 阶段 0 Read 列表加一行 "spec/domain.md"

## 业务背景（≤ 3 句）

{domain-brief}

## 核心术语表（5-15 条,按业务域定义）

| 术语 | 业务定义 | 误用警告 |
|------|----------|----------|
| {term-1} | {business-def} | {avoid-confusing-with-X} |
| {term-2} | {business-def} | {avoid-confusing-with-Y} |
| ... | ... | ... |

## 角色清单（domain-specific 角色, 与 spec.feature 的"核心用户角色"对齐）

| 角色 | 业务定位 | 关心什么 |
|------|----------|----------|
| {role-1} | {role-brief} | {role-concerns} |
| ... | ... | ... |

## 业务流程骨架（domain 整体流程,与单 feature 流程对齐）

1. {step-1}: {actor} → {action} → {outcome}
2. {step-2}: ...
3. ...

## 反模式（domain 容易踩的坑, 列 ≤ 5 条）

- ❌ {anti-pattern-1}: {why-bad}
- ❌ {anti-pattern-2}: {why-bad}
- ...

## 关联文档

- 需求清单: spec/sources.md
- 行为规格: spec/spec.feature
- 一页纸摘要: spec/summary.md
