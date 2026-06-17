---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0003: spec-cli 状态机 G1 + meta.json G2 捆绑落地

> **状态**：✅ 已接受（v0.4.0 P0 实现已落）
> **替代**：[`RFC-0001`](../rfcs/0001-spec-cli-state-machine.md) + [`RFC-0002`](../rfcs/0002-spec-summary.md)（G8 协同）
> **决议日**：2026-07-13
> **影响范围**：`spec/scripts/spec-cli.js` / `spec/scripts/spec-cli.test.js` / `spec/TESTING.md L1-B` / `skills/test-pipeline/SKILL.md §5`

---

## 1. 上下文

god v0.3.0 已把 G1（spec-cli 状态机）+ G2（meta.json）列为 P0（[roadmap §3.2 G1+G2](../roadmap.md)），RFC-0001 提出完整设计。本 ADR 锁定 G1+G2 关键约束。

## 2. 决策

**G1 + G2 捆绑 = v0.4.0 P0 必做**。具体约束：

| 约束 | 决定 |
|---|---|
| 状态数 | **6**（idea / drafted / reviewed / implemented / verified / accepted）|
| 转移规则 | **不可跳过**；必须按 PHASE_ORDER 单调递增 |
| rollback | 必填 `--to <phase>` + `--reason "<text>"`；强制理由留痕 |
| `--force` | 允许跳过 gate 校验，但**必须**写 `[FORCE]` 到 `.trace` |
| trace 格式 | `2026-07-02T14:25:00Z drafted → reviewed` 或带 `[FORCE]` / `ROLLBACK ... \| reason: ...` 后缀 |
| meta.json | 必含 specId/version/phase/owner/createdAt/updatedAt/relatedPR/scopes/gates |
| gate 时间戳 | `gates[<phase>]` 记录每阶段通过时间；rollback 时清掉被回退阶段 |
| check 命令 | 双校验：跑 spec-validate.js + 状态机合法性 |

## 3. 后果

### 3.1 必修（v0.4.0 已完成）

- ✅ `spec/scripts/spec-cli.js`（~280 行，含 status/advance/rollback/check/init 5 子命令）
- ✅ `spec/scripts/spec-cli.test.js`（20 测试全过）
- ✅ `spec/TESTING.md L1-B` 状态机单元测试段
- ✅ `skills/test-pipeline/SKILL.md §5` S1 出口自动跑 advance 到 accepted

### 3.2 G8 协同（已纳入）

- G8 spec-summary 的 S1 出口校验 = spec-cli check 的前置
- 两者绑定关系：advance → accepted 必先跑 spec-summary check

### 3.3 拒绝（明确不做）

- ❌ 状态写在 spec.feature 文件头注释（不可机器查询）
- ❌ 状态写在 git commit message（跨分支无意义）
- ❌ 状态机含 rejected/skipped/archived 额外状态（异常走 P1 介入点）
- ❌ rollback 不带 reason
- ❌ --force 跳过不留痕

## 4. 替代方案（已否决）

### 方案 B：状态写在文件系统目录结构

- 拒因：难回滚；git diff 复杂；dev/test 命令要读目录判断 phase

### 方案 C：状态写在 git commit message

- 拒因：跨分支无意义；commit 不可变

## 5. 关联

- 上一 ADR：[`ADR-0002 spec-summary` v0.4.0 P0](0002-spec-summary.md)
- 配套：[`RFC-0003 hooks 集成（G3）`](../rfcs/0003-hooks-integration.md)（待写）
- 3 视角：[`01-ops-runbook.md §1 D1`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §3`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §2`](../perspectives/03-architect-perspective.md)
