---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0005: OPC 介入预算改为 3 档分级归因

> **状态**：✅ 已接受（v0.4.0 P1 实现已落）
> **替代**：[`RFC-0005`](../rfcs/0005-opc-cost-tiered.md) + `CLAUDE.md §1.3` 硬阈值版
> **决议日**：2026-07-13
> **影响范围**：`CLAUDE.md §1.3` / `spec/scripts/measure-opc-cost.js` / `spec/scripts/measure-opc-cost.test.js` / `spec/TESTING.md L1-D` / `skills/test-pipeline/SKILL.md §5`

---

## 1. 上下文

CLAUDE.md §1.3 当前 OPC 预算硬阈值 "< 30 min / feature"——3 份 perspectives 演练一致表明**不可达**：

| 视角 | 实测 | 备注 |
|---|---|---|
| 01 OPC 真实试跑 | 75 min | 含 F-02 修复 60 + S1 翻脸 15 |
| 02 god 团队试跑 | 28 min | 自我评分 |
| 03 架构师试跑 | 22 min | 自我评分 |

**核心 insight**：30 min 预算超不超 = god 自身实现程度的函数，不是 OPC 努力的事。

## 2. 决策

**OPC 预算改 3 档分级归因**。具体约束：

| 档位 | 触发 | 预算 | 含义 |
|---|---|---|---|
| L0 纯流程 | 无 F-XX + 无 S1 翻脸 | **30 min** | god v0.4.0+ 目标态 |
| L1 含 1 崩 | 1 次 F-XX 修复 | **60 min** | god bug 导致多花 |
| L2 含 1 翻脸 | 1 次 OPC 翻脸 | **90 min** | OPC 主观不满意 |
| L3 多次 | ≥2 次 | 标"超预算" | 系统失败信号 |

**5 维归因**：prd / dev / test / 崩点修复 / 翻脸决策。

## 3. 后果

### 3.1 必修（v0.4.0 已完成）

- ✅ `spec/scripts/measure-opc-cost.js`（~150 行：parseTrace + countFailures + computeCost + 3 档判断）
- ✅ `spec/scripts/measure-opc-cost.test.js`（17 测试全过：3 档 + 5 维 + 边界 + CLI）
- ✅ CLAUDE.md §1.3 改分级归因版本
- ✅ spec/TESTING.md L1-D 测试段

### 3.2 兼容性

- 旧"< 30 min"硬阈值 → 新"L0 30 / L1 60 / L2 90"
- 3 份 perspectives 演练 K1 数据 75/28/22 min → 重新归类为 L2/L0/L0

### 3.3 拒绝（明确不做）

- ❌ 继续硬 30 min（已证不可达）
- ❌ OPC 手动算时间（应自动化）
- ❌ 删 30 min 数字（保留作为 L0 目标）

## 4. 替代方案（已否决）

### 方案 B：30/45/60 三档

- 拒因：3 份 perspectives 演练实测 75 min 落在 60-90 区间，60 上限过紧

### 方案 C：30/60/120 三档

- 拒因：120 min = 2 小时，超 OPC 注意力预算上限

## 5. 关联

- 上一 ADR：[`ADR-0004 hooks 防漂移`](0004-hooks-integration.md)
- 3 视角：[`01-ops-runbook.md §1 D5`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §6.1`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §6`](../perspectives/03-architect-perspective.md)
