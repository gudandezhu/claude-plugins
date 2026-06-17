---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# RFC-0005: OPC 介入预算分级归因（CLAUDE.md §1.3 修订）

> **状态**：草稿（v0.4.0 P1）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 ADR-NNNN
> **关联 3 视角**：[`01-ops-runbook.md §1 D5`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §6.1`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §6`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.2 D5`](../roadmap.md)
> **替代**：[`CLAUDE.md §1.3` 当前硬阈值版](../../CLAUDE.md)

---

## 1. 背景

CLAUDE.md §1.3 当前 OPC 预算硬阈值 "< 30 min / feature"——3 份 perspectives 演练一致表明**不可达**：

| 视角 | 实测 | 备注 |
|---|---|---|
| 01 OPC 真实试跑 | **75 min**（含 F-02 修复 60 + S1 翻脸 15）| 真实痛 |
| 02 god 团队试跑 | 28 min | 自我评分，无崩点 |
| 03 架构师试跑 | 22 min | 自我评分，无崩点 |
| 同一文档内部 4 个数 | 75/105/70/35 | 算"纯流程"还是"含崩"未分清 |

**核心 insight**：30 min 预算超不超 = god 自身实现程度的函数，不是 OPC 努力不努力的事。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 预算分 3 档：纯流程 30 / 含 1 崩点 60 / 含 1 翻脸 90 | 3 档判断逻辑可机械跑 |
| 2 | 5 维归因：prd 阶段 / dev 阶段 / test 阶段 / 崩点修复 / 翻脸决策 | 每档可拆 |
| 3 | 自动化：S1 出口自动跑算成本 + 写验收报告 | `measure-opc-cost.js` 一行调用 |
| 4 | 趋势可追踪：连续 3 个 feature 都超 90 → 系统失败信号 | `.trace` 累计 |

## 3. 详细设计

### 3.1 3 档预算（取代硬 30 min）

| 档位 | 触发条件 | 预算 | 含义 |
|---|---|---|---|
| **L0 纯流程** | 无 F-XX 崩点 + 无 S1 翻脸 | **30 min** | god v0.4.0+ 目标态 |
| **L1 含 1 崩** | 1 次 F-XX 修复（f-01~f-06 任一）| **60 min** | god 自身 bug 导致多花时间 |
| **L2 含 1 翻脸** | OPC 验收拒绝重做 | **90 min** | OPC 主观不满意导致返工 |
| **L3 多次崩/翻脸** | 累计 ≥ 2 次 | 标"超预算" | 系统失败信号，需 root cause |

### 3.2 5 维归因

```
总介入 = prd 介入 + dev 介入 + test 介入 + 崩点修复 + 翻脸决策
```

| 维 | 怎么算 | 数据源 |
|---|---|---|
| prd 介入 | sources.md 的 C1/C2/C3/C4 Gate 时间戳差 | sources.md 元信息 |
| dev 介入 | S1 之前 C4 gate 后的 OPC 决策时间 | spec/.trace C5 → first NO-VERIFY |
| test 介入 | S1 gate 的 OPC 决策时间 | spec/.trace last NO-VERIFY → accepted |
| 崩点修复 | NO-VERIFY commit 之间的总时间 | spec/.trace NO-VERIFY 行 |
| 翻脸决策 | S1 后 rollback 次数 × 平均决策时长 | spec/.trace ROLLBACK 行 |

### 3.3 CLI 签名

```bash
$ node spec/scripts/measure-opc-cost.js <项目目录>
# 输出 5 维归因 + 档位 + 与预算的差距
# exit 0 = 在预算内 / exit 1 = 超预算（写入验收报告）

$ node spec/scripts/measure-opc-cost.js <项目目录> --json
# 输出 JSON 给验收报告脚本消费
```

## 4. 验收

- [ ] `node spec/scripts/measure-opc-cost.js demo/lead-scoring` 输出 5 维归因
- [ ] L0/L1/L2 3 档判断正确（用 fixture 测试）
- [ ] `--json` 输出可被验收报告脚本解析
- [ ] 接入 `skills/test-pipeline/SKILL.md` S1 出口自动跑
- [ ] 3 份 perspectives 引用新规约（v0.4.0 文档轮次同步）

## 5. 反模式（明确不做）

- ❌ 继续硬 30 min（已证不可达）
- ❌ OPC 手动算时间（应自动化）
- ❌ 删 30 min 数字（保留作为 L0 目标）
- ❌ 不归因只报总数（5 维拆解是关键价值）

## 6. 开放问题

- [ ] L3"超预算"的阈值是 ≥2 次还是 ≥3 次？
- [ ] 5 维归因的"OPC 决策时长"怎么精确测量？靠 sources.md 的 C1/C2 timestamp 还是靠 spec/.trace 的 NO-VERIFY 时戳？
- [ ] 验收报告里 cost 部分放哪一段？

## 7. 时间线

- **Week 1**（2026-07-21 ~ 07-27）：RFC 评审 + measure-opc-cost.js 实现 + 测试
- **Week 2**（2026-07-28 ~ 08-03）：接入 test S1 出口 + RFC 转 ADR + CLAUDE.md §1.3 修订
- **Week 3**（2026-08-04 ~ 08-10）：3 份 perspectives 同步新规约
