---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-17
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# RFC-0011: domain.md（roadmap G10 落地，4 节：术语/角色/业务流程/反模式）

> **状态**：已合并（v0.4.0+）
> **关联**：[`docs/roadmap.md` G10](../roadmap.md) + [`templates/domain.md`](../../templates/domain.md) + [`CLAUDE.md` §5 G10](../../CLAUDE.md)

---

## 1. 动机

god v0.3.0 演练暴露：spec.feature 用了"降权""加白"等业务术语但 OPC 和 AI 理解不一致。domain.md 用 4 节固化术语表 + 角色 + 业务流程 + 反模式，**spec 阶段 0 自动加载到 dev-pipeline context**，避免语义漂移。

---

## 2. 4 节结构

| 节 | 内容 | 示例 |
|---|---|---|
| 术语表 | 项目专有词 | 降权 = 30 天内 lead 评分衰减 50% |
| 角色 | 业务角色 | OPC（一人公司）/ AI 外骨骼 / God 评审者 |
| 业务流程 | 关键链路 | lead 进门 → 评分 → 30 天降权 → 加白 |
| 反模式 | 禁止行为 | 不要绕过 spec 直接改代码 |

模板：`templates/domain.md`（4 节空白 + 注释指引）。

---

## 3. 落点

- 4 节空白模板：`templates/domain.md`（v0.1.0）
- 真实填法：项目创建时从 `templates/domain.md` 复制到项目根 `domain.md`
- 加载时机：prd 阶段 0（自助调研）自动加载到 AI context

---

## 4. 验收

- `templates/domain.md` 含 4 节标题 + 空白 + 注释
- 演练：3 个 OPC 角色用同一份 domain.md 写 spec.feature，术语一致率 ≥ 95%
