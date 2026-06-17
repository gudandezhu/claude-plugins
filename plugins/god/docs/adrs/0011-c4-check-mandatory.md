---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0011: prd 阶段 1 末尾 C4 check 边界强制力

> 状态: 已采纳
> 日期: 2026-06-16
> 触发: Incident 0001（2-feature 演练 ROLLBACK）
> 取代: —

## 背景

v0.5.0 2-feature 跨域演练（`/tmp/god-multi-feature-demo/`）中，feat 1 lead-scoring 在 verified 阶段被 OPC 翻脸（"加 SC-002 失联降权"），触发 ROLLBACK + FORCE 推进。god-trends 输出 L2 档。

根因追溯：prd 阶段 1 brainstorm M2 漏"30 天未联系 → 分数降权"边界，导致 SC-002 缺失。prd § 阶段 1 末尾 C4 check 缺强制力，边界清单与 REQ 表未机械对齐。

## 决策

**prd 阶段 1 末尾 C4 check 加 2 条硬约束**：

1. **边界清单 → REQ 表必转化**：sources.md "边界 / 异常清单" 段每条都必须在 REQ 表里有 `→ SC-xxx` 归属（spec-validate #10 升级版）
2. **未决项 = 0 才放行**：C3 check 结论"未决项不为 0" → 阶段 1 不允许 advance

## 取舍

- **采纳**：C4 强制清单 + 未决项 0 → 阶段 1 exit 0 / 1 直接对应是否能进 build-spec
- **放弃**：让 AI 自由决定是否补边界（导致 OPC 翻脸）
- **放弃**：把 ROLLBACK 做得更智能（语义层"猜"OPC 改需求）——超出 v0.5.0 范围，违反 §1.1 铁律 2

## 后果

- **正面**：OPC 翻脸率（v0.5.0 L2 档触发条件）下降，预估 L2/L3 触发率 -50%
- **代价**：prd 阶段 1 耗时 +5-10 min（多走一遍 C4 清单）
- **风险**：过度严格可能让"快速 MVP 场景"感到繁琐——预留 `--relax-c4` 救命标志，但需写 C5 锚点留痕

## 落地

- [x] Incident 0001 写入 docs/incidents/（2026-06-16）
- [x] ADR-0006 写入 docs/adrs/（2026-06-16）
- [ ] commands/prd.md § 阶段 1 末尾补 C4 强制清单段（v0.5.0+）
- [ ] spec-validate.js #10 升级"边界清单 → REQ"机械校验（v0.6.0 启动）

## 关联

- Incident 0001: docs/incidents/0001-multi-feature-rollback.md
- Plan §1.3 OPC 注意力预算 L2 档
- Plan §1.4 真实 2-feature 演练
- ADR-0005 OPC 预算分级归因
