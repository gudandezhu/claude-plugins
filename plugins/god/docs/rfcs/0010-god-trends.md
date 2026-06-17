---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# RFC-0010: god-trends（plan.md §4 Week 4 E，自我监控）

> **状态**：草稿（v0.4.0+）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 ADR-NNNN
> **关联 3 视角**：[`01-ops-runbook.md §1 D5`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §6.1`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §6`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.2 D5`](../roadmap.md)（自我监控维度的子块）
> **关联 plan**：[`docs/plan.md §4 Week 4 E`](../plan.md)
> **替代 RFC**：v0.4.0 之前 `RFC-0005 OPC 介入预算分级归因`（commit `a1e5ed2`）落地 `measure-opc-cost.js`（单 feature）—— god-trends 是其跨 feature 聚合版本

---

## 1. 背景

`measure-opc-cost.js`（commit `a1e5ed2`，`RFC-0005`）实现单 feature 的 OPC 介入成本 3 档分级归因（L0/L1/L2/L3）。但**跨 feature 趋势**没统计：

- 1 个 feature 看不出 god 整体表现（L1 单 feature 可能 OK，但 10 个 feature 全 L1 = 系统问题）
- 趋势不可追踪：连续 3 个 feature 都超 90 → 系统失败信号，但**没自动化**
- 崩点率 / 翻脸率累计 = god 健康指标，但**手工算**
- 救场场景（NO-VERIFY commit）累计 = hooks 设计是否阻塞过度，但**没统计**

**核心价值**：god-trends 读 `spec/.trace`（spec-cli + hooks 自动写）累计跨 feature 数据，输出**可机读 JSON + 人类可读报告**，god 团队可据此做数据驱动决策（升 hooks / 改 ADR / 拆 spec）。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 读 `spec/.trace` 累计 → 跨 feature 趋势报告 | `node god-trends.js <项目>` 输出报告 |
| 2 | 监控 OPC 介入时长 avg/median/min/max | 报告含 4 统计量 |
| 3 | 监控档位分布 L0/L1/L2/L3 | 报告含 4 档计数 |
| 4 | 监控崩点率（NO-VERIFY commit / feature）| 报告含 NO-VERIFY 总数 |
| 5 | 监控翻脸率（ROLLBACK / feature）| 报告含 ROLLBACK 总数 |
| 6 | 趋势检测：最近 3 feature 档位升级/降级 | 报告含 `↑ 升级` / `↓ 降级` / `平稳` |
| 7 | JSON 输出供 dashboard 消费 | `--json` 输出可解析 |
| 8 | 零外部依赖 | 纯 Node 内置模块 |

## 3. 详细设计

### 3.1 输入格式：`spec/.trace`

trace 是 god 系统的事件流（spec-cli / hooks / commands 自动追加）。每行 = `ISO 时间 + 空格 + 事件描述`：

```
2026-06-15T10:00:00Z INIT feature=lead-scoring phase=drafted
2026-06-15T11:00:00Z C5 (简单档 / 92 分 / 通过)
2026-06-15T13:30:00Z advance drafted→reviewed
2026-06-15T14:00:00Z advance reviewed→implemented
2026-06-15T15:00:00Z NO-VERIFY commit abc1234 (救命：hotfix spec/typo)
2026-06-15T16:00:00Z advance implemented→verified
2026-06-15T17:00:00Z accepted
```

god-trends 不解析所有事件，只识别 4 类：
- `INIT <feature=...>` — 划分 feature 边界
- `accepted` — feature 终点（计算总时长）
- `NO-VERIFY` — 救场 commit
- `ROLLBACK` — 翻脸决策

### 3.2 输出结构

#### 人类可读（默认）

```
god 趋势报告（v0.4.0+ 自我监控）：
  feature 数:    3
  OPC 介入时长:  avg=18min  median=20min  min=3min  max=30min
  档位分布:      L0=1  L1=1  L2=1  L3=0
  NO-VERIFY:     2 次（救命场景累计）
  ROLLBACK:      0 次（翻脸决策累计）
  趋势（最近 3）: 平稳

  解读：
    L3 ≥ 1  → 系统失败信号，需 root cause
    L2 ≥ 1  → OPC 主观不满意，建议 ADR 落档原因
    trend ↑  → 介入时长恶化，关注 hooks/dev-gen 自动化
    trend ↓  → 自动化生效，god v0.4.0+ 工具链正反馈
```

#### JSON (`--json`)

```json
{
  "count": 3,
  "avg": 1080,
  "median": 1200,
  "min": 180,
  "max": 1800,
  "tierDist": { "L0": 1, "L1": 1, "L2": 1, "L3": 0 },
  "noVerifyTotal": 2,
  "rollbacksTotal": 0,
  "trend": "平稳"
}
```

### 3.3 监控维度（v0.4.0+ 起步）

| 维度 | 算法 | 数据源 |
|---|---|---|
| OPC 介入时长 | (accepted.time - INIT.time) 秒 / feature | spec/.trace |
| 档位 | L0 = 无 NO-VERIFY + 无 ROLLBACK；L1 = ≥1 NO-VERIFY；L2 = ≥1 ROLLBACK；L3 = (NO-VERIFY + ROLLBACK) ≥ 2 | 同上 |
| 崩点率 | NO-VERIFY 计数 / feature 数 | 同上 |
| 翻脸率 | ROLLBACK 计数 / feature 数 | 同上 |
| 趋势 | 最近 3 feature 档位单调：tierVal 序列 ↑=升级、↓=降级 | 同上 |

### 3.4 档位定义对齐

档位定义**严格**对齐 `RFC-0005 OPC 介入预算分级归因`（CLAUDE.md §1.3）：

| 档 | 触发 |
|---|---|
| **L0** | 无 NO-VERIFY + 无 ROLLBACK（纯流程）|
| **L1** | ≥1 NO-VERIFY（崩点修复 ≥1）|
| **L2** | ≥1 ROLLBACK（翻脸决策 ≥1）|
| **L3** | (NO-VERIFY + ROLLBACK) ≥ 2（多次崩/翻脸）|

L0 预算 = 30 min；L1 = 60 min；L2 = 90 min；L3 = 超预算（系统失败）。

### 3.5 CLI 签名

```bash
# 人类可读报告
$ node spec/scripts/god-trends.js <项目目录>

# JSON 输出（供 dashboard / CI 消费）
$ node spec/scripts/god-trends.js <项目目录> --json
```

### 3.6 落点

- `spec/scripts/god-trends.js`（~200 行）
- `spec/scripts/god-trends.test.js`（~150 行）
- `spec/TESTING.md L1-I` 段

## 4. 验收

- [ ] `node spec/scripts/god-trends.js demo/lead-scoring` 输出报告
- [ ] 报告含 OPC 介入时长 4 统计量
- [ ] 报告含档位分布 4 档
- [ ] 报告含 NO-VERIFY / ROLLBACK 累计
- [ ] 报告含趋势（↑/↓/平稳）
- [ ] `--json` 输出可被 `JSON.parse` 解析
- [ ] 无 trace → "无 feature 数据"
- [ ] 15+ 单元测试全过

## 5. 反模式（明确不做）

- ❌ god-trends 写 trace（**只读**，trace 由 spec-cli / hooks 写）
- ❌ god-trends 报警（**只报告**，报警是 CI 集成的事）
- ❌ god-trends 改 OPC 介入预算（**只统计现状**，调档位是 ADR 的事）
- ❌ god-trends 跑 measure-opc-cost（**复用其数据**，不重复算）
- ❌ god-trends 跨项目聚合（**只单项目**，跨项目是 v0.5+）

## 6. 开放问题

- [ ] 是否集成到 `commands/test.md` S1 出口自动跑？当前手动
- [ ] 是否加 dashboard（web 视图）？当前只看 stdout + JSON
- [ ] trace 格式破坏（人工改 .trace）如何防？当前不防（trace 是机器产物）

## 7. 时间线

- **Week 4**（2026-08-11 ~ 08-17）：RFC 评审 + god-trends.js 实现 + 测试
- **Week 4 末**：RFC 转 ADR + demo 跑通（lead-scoring 已 1 feature 数据）+ 采集 OPC 真实体感
