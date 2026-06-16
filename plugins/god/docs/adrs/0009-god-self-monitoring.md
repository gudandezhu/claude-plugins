# ADR-0009: god 自我监控（plan.md §4 Week 4 E）

> **状态**：✅ 已接受（v0.4.0+ 实现已落）
> **替代**：[`plan.md §4 Week 4 E`](../plan.md) + [RFC-0009（集成 ADR）](../rfcs/0009-god-self-monitoring.md)
> **决议日**：2026-07-13
> **影响范围**：`spec/scripts/god-trends.js` / `demo/lead-scoring/DASHBOARD.md` / `commands/test.md` S1 出口

---

## 1. 上下文

god v0.4.0 有 `measure-opc-cost.js` 算单 feature OPC 介入时长（5 维归因），但**没有跨 feature 趋势**。plan.md §4 Week 4 E 决定补 god 自我监控。

## 2. 决策

**god-trends.js = v0.4.0+ 必做**（plan §4 Week 4 E）。具体约束：

| 约束 | 决定 |
|---|---|
| 输入 | `spec/.trace` 累计（含 INIT 划分多 feature） |
| 输出维度 | feature 数 / OPC 介入时长 avg/median/min/max / L 档分布 / NO-VERIFY + ROLLBACK 累计 / 最近 3 feature 趋势 |
| 趋势判断 | 最近 3 feature 的 L 档严格升/降 → 趋势报告 |
| L3 触发 | 同一 feature 含 ≥ 2 次 NO-VERIFY + ROLLBACK → 升级 L3（系统失败信号）|
| 接入 | `commands/test.md` S1 出口自动跑（验收报告附录）|
| Demo | `demo/lead-scoring/DASHBOARD.md` OPC 视角仪表盘 |

## 3. 后果

### 3.1 必修（v0.4.0+ 已完成）

- ✅ `spec/scripts/god-trends.js`（~200 行：aggregateFeatures + summarize + 趋势判断）
- ✅ `spec/scripts/god-trends.test.js`（19 测试全过：解析 + 档位 + 趋势升/降 + CLI）
- ✅ `demo/lead-scoring/DASHBOARD.md`（OPC 视角仪表盘）
- ✅ `/tmp/god-multi-feature-demo/` 跨 feature 真实跑通（feat 1 + feat 2 改需求 → L2 档）

### 3.2 与 D5 协同

- `measure-opc-cost.js` 算单 feature 5 维归因
- `god-trends.js` 算跨 feature 累计 + 趋势
- 两者 = 单点 + 趋势的 god 自我监控完整闭环

### 3.3 拒绝（明确不做）

- ❌ god-trends 自动改 spec —— 自我监控不动业务
- ❌ 跨项目聚合（v0.4.0+ 单项目）
- ❌ L3 自动停 god —— 只报警，需 OPC 决策

## 4. 替代方案（已否决）

### 方案 B：god-trends 写回 spec/

- 拒因：spec 是真相源，自我监控数据不该污染

### 方案 C：跨项目聚合 dashboard

- 拒因：v0.4.0+ 单项目 god，单项目已够

## 5. 关联

- 上一 ADR：[`ADR-0008 test-gen`](0008-test-gen.md)
- plan：[`docs/plan.md §4 Week 4 E`](../plan.md)
- 演示：`demo/lead-scoring/DASHBOARD.md`
- 上一档位定义：[`ADR-0005 OPC 预算分级`](0005-opc-cost-tiered.md)
