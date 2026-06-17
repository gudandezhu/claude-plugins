---
type: log
status: stable
owner: god 维护组
last_reviewed: 2026-06-16
update_rule: free
related: [../../CLAUDE.md]
---

# Incident 0001: 跨 feature 演练中 ROLLBACK + FORCE 推进真实发生

> 触发: 状态机 ROLLBACK + god-trends L2 档
> 发生: 2026-06-16 03:52:06Z
> 系统: 2-feature 跨域演练 (`/tmp/god-multi-feature-demo/`)
> 等级: P2 体验降级（系统未崩,但暴露 spec/cli 流程在"OPC 改需求"场景的卡顿）

## 事实（时间线,客观可验）

| 时间 | 事件 | 证据 |
|------|------|------|
| 2026-06-16T03:51:54Z | feat 1: lead-scoring INIT phase=drafted | trace L1 |
| 2026-06-16T03:51:54Z | drafted → reviewed | trace L2 |
| 2026-06-16T03:51:54Z | reviewed → implemented | trace L3 |
| 2026-06-16T03:51:54Z | implemented → verified | trace L4 |
| 2026-06-16T03:52:06Z | **ROLLBACK verified → drafted \| reason: OPC 改需求：加 SC-002 失联降权** | trace L5 |
| 2026-06-16T03:52:06Z | drafted → reviewed [FORCE] | trace L6 |
| 2026-06-16T03:52:06Z | reviewed → implemented | trace L7 |
| 2026-06-16T03:52:06Z | implemented → verified | trace L8 |

## 根因分析（5 Whys）

1. Why 1: 为什么 ROLLBACK？— OPC 在 feat 1 verified 后说"加 SC-002 失联降权"
2. Why 2: 为什么 OPC 改需求？— feat 1 写 spec 时未把"失联降权"放进来（来源 brainstorm M2 漏项）
3. Why 3: 为什么 M2 漏项？— prd 阶段 1 brainstorm 阶段没走全"边界清单"（spec/sources.md L25-27 才补"30 天未联系 → 分数 50 ± 10"）
4. Why 4: 为什么漏"边界清单"？— 阶段 1 用了 prd 简化路径，未触发 C4 总流程 check 强制对边界
5. Why 5: 根本原因：状态机的 ROLLBACK 是事后补救，**prd 阶段 C4 check 缺强制力**——边界/异常/未结案项无强制清单

## 影响

- 单 feature 演练：1 次 ROLLBACK + FORCE，OPC 介入 1 翻脸（plan §1.3 L2 档）
- 真实场景：如果 2-feature 演练发生在生产场景而非演练，ROLLBACK 会触发 spec-validate #11 拒绝推进，OPC 要手工 FORCE——**翻脸是必然的**
- 系统信号：god-trends L2 触发，提示"OPC 主观不满意，建议 ADR 落档原因"（plan §1.4 实测）

## 修复（已落地 / 计划中）

- [x] 把 2-feature 真实数据写入 incidents/0001（本次）— 2026-06-16
- [x] 沉淀为 ADR-0006（spec 阶段 C4 check 边界强制力）— 2026-06-16
- [ ] prd 命令 § 阶段 1 末尾强制过 C4 check 清单（未做）— owner: god 团队
- [ ] build-spec skill 加"边界清单 → SC 必转化"机械门禁（未做）— owner: god 团队

## 预防（机制层,不只补当前 bug）

- **机制 1**：prd 阶段 1 末尾，C4 check 必须显式列出"边界清单 → REQ → SC"全链路，任一断链 → 不允许进 build-spec
- **机制 2**：spec-validate.js #10 双向绑定加"边界清单条目必须出现在 sources.md REQ 表"校验
- **机制 3**：god-trends L2 触发时，自动建议"是否要建 incident"——避免人工遗漏沉淀

## 关联

- spec: demo/lead-scoring/spec/spec.feature SC-002
- 测试: demo/lead-scoring/tests/lead.test.js
- trace: /tmp/god-multi-feature-demo/spec/.trace L5-L6
- 衍生 ADR: docs/adrs/0011-c4-check-mandatory.md

## 附录: 修订记录

| 日期 | 修订人 | 内容 |
|------|--------|------|
| 2026-06-16 | puyifan (god 团队) | 初版 |
