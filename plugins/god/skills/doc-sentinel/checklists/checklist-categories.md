---
name: doc-sentinel checklist categories
status: stable
description: 9 类 check 速查索引。doc-sentinel agent 加载此文件快速了解每类 check 的核心问题。
---

# doc-sentinel 9 类 check 速查

| ID | 名称 | 核心问题 | auto-fix | 优先级 |
|---|---|---|---|---|
| **V1** | 版本漂移 | plugin.json version vs CHANGELOG 最新 | 半（PATCH/MINOR 是）| 高 |
| **N1** | 编号规约 | RFC/ADR 编号撞车 + 3 位残留 | 半（补零是，撞车否）| 最高 |
| **D1** | demo 三件套 | 每个 demo 含 DASHBOARD/summary/.trace | 是 | 中 |
| **F1** | frontmatter | SKILL.md/commands.md 缺 status: | 是 | 中 |
| **T1** | stale TODO | 含 TODO/FIXME/待填充/规划中 | 半 | 低 |
| **P1** | 路径引用 | .md 引用失效路径 | 是 | 中 |
| **G1** | G 状态机 | CLAUDE/roadmap/scripts/rfcs 4 路对齐 | 半 | 高 |
| **C1** | CHANGELOG 日期 | 版本日期与 git log 真实日期一致 | 是 | 高 |
| **M1** | 自检 | doc-sentinel 自身健康度 | 否 | — |

---

## 优先级排序逻辑

**最高**：N1（撞车破坏外部引用）
**高**：V1 / G1 / C1（涉及核心真相源：版本号 + 状态机 + 时间戳）
**中**：F1 / D1 / P1（机械修复，影响范围小）
**低**：T1（上下文依赖强，误判风险大）
**—**：M1（自检不修文件）

---

## 何时跳过 auto-fix

| 类 | 跳过条件 |
|---|---|
| V1 | MAJOR bump |
| N1 | RFC/ADR 编号撞车 |
| D1 | 目标 demo 已是 lead-scoring 自身 |
| F1 | 文件是骨架（"当前为骨架/待填充"）|
| T1 | 设计意图 TODO（dev-gen / test-gen 桩）|
| P1 | 占位符路径（`../api/{name}.md`）/ 跨仓库引用 |
| G1 | 4 路都不一致 |
| C1 | 未来日期 / 缺 `## v` 段 |
| M1 | 全部跳过 |

---

## 何时不跑 check

| 场景 | 跳过 |
|---|---|
| cron 没触发 | — |
| 上次跑 < 4h 前 | M1 仅做最小自检 |
| git status dirty | 全部跳过，写报告 `skipped: dirty` |