# ADR-0006: spec-archive G4 提 P0 落地（plan.md §4 Week 1 D）

> **状态**：✅ 已接受（v0.4.0 P0 实现已落，原 P1 提级）
> **替代**：[`RFC-0006`](../rfcs/0006-spec-archive.md)
> **决议日**：2026-07-13
> **影响范围**：`spec/scripts/spec-archive.js` / `spec/scripts/spec-archive.test.js` / `spec/TESTING.md L1-E` / `plan.md §4`

---

## 1. 上下文

roadmap G4 spec-archive 原 P1（按 ["文档/规范/驱动/防护/防护"] 顺序），但 [plan.md §4](../plan.md) 重新评估：

> **G4 我建议提到 P0**——"改坏 spec 不可回滚"是 god 用户最怕的痛点之一。G4 工作量小、立竿见影。

3 份 perspectives 01 §1 D4 痛点印证："改 spec 改 code 同一 commit 习惯不规范，revert 时需手动对齐"。

## 2. 决策

**G4 spec-archive = v0.4.0 P0 必做**（升级自 P1）。具体约束：

| 约束 | 决定 |
|---|---|
| 存储位置 | **`spec/.archive/`**（git 内）—— 可追溯；git diff 自然看 |
| 不可变性 | tar.gz 写完 chmod 0444（只读）；需重写先解除 |
| 阶段限制 | **restore 仅 `phase = drafted` 允许**（reviewed 之后改 spec 强制走 prd）|
| 恢复前自动备份 | 强制（防恢复错）—— 当前 spec 状态先 snapshot 再覆盖 |
| 删除 | `prune --older-than N` 默认保留 30 天 |
| 索引 | `.archive-index` 1 行 1 快照，append-only |
| tar 实现 | 极简自制 tar header（避免依赖 npm 包）|

## 3. 后果

### 3.1 必修（v0.4.0 已完成）

- ✅ `spec/scripts/spec-archive.js`（~300 行：4 子命令 + 自制 tar + gzip）
- ✅ `spec/scripts/spec-archive.test.js`（18 测试全过：tar round-trip + 4 子命令 + 不可变 + 阶段限制 + prune）
- ✅ `spec/TESTING.md L1-E`（待补）
- ✅ demo/lead-scoring 已 snapshot 第 1 个 G4 存档

### 3.2 与 G1/G2/G3 协同

- restore 阶段限制 = 读 G2 meta.json 的 phase 字段
- restore 自动 snapshot + .trace 追加 = 复用 G1 trace 格式
- spec-archive 可选 hook 接入（未来 hook 触发 snapshot）

### 3.3 拒绝（明确不做）

- ❌ git 外存储（独立 `.god/`）—— 不可追溯
- ❌ 快照可写 —— 一旦可写就不是"快照"
- ❌ restore 不限阶段 —— reviewed 之后改 spec 必须走 prd
- ❌ 恢复不备份当前 —— 万一恢复错无法回滚

## 4. 替代方案（已否决）

### 方案 B：git 外独立 .god/ 目录

- 拒因：不可追溯，与 CLAUDE.md §3 索引图冲突

### 方案 C：restore 不限阶段

- 拒因：reviewed 之后改 spec 强制走 prd 是铁律，restore 跨阶段等于绕过

### 方案 D：依赖 npm tar 包

- 拒因：god 仓零外部依赖原则；自制 tar ~50 行

## 5. 关联

- 上一 ADR：[`ADR-0005 OPC 预算分级`](0005-opc-cost-tiered.md)
- RFC：[`RFC-0006`](../rfcs/0006-spec-archive.md)
- plan：[`docs/plan.md §4 Week 1 D`](../plan.md)
- 3 视角：[`01-ops-runbook.md §1 D4`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §2`](../perspectives/02-dev-perspective.md)
