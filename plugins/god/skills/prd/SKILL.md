---
status: stable
name: prd
user-invocable: false
description: |
  god 需求入口流水线（RFC-0013 落地，v0.7.0+）。
  阶段 0 自助调研 → 阶段 1 brainstorm → 阶段 2 build-spec → 阶段 2.5 readiness 校验
  → 阶段 3a/3b 机械+评审 → 阶段 3c S1 签字 → 阶段 4 dev-pipeline → 阶段 5 test-pipeline → 阶段 6 S3 验收。
  命令层 /god:prd 默认加载本 skill（无 --mode 时）。轻量场景用 prd-edit。
---

# PRD 一条龙（默认走法）

> 完整需求 → 验收全流程。**所有方法论下沉到子 skill，所有 SOP 下沉到脚本**。本 skill 只做编排。

## 加载列表（按阶段）

| 阶段 | 加载 | 跑脚本 |
|---|---|---|
| 0 自助调研 | (无) | (主 agent 并行 Read + Explore subagent) |
| 1 brainstorm | `brainstorm` skill | (无) |
| 1.5 user-perspective | `user-perspective-analyzer` skill | (无) |
| 2 build-spec | `build-spec` skill | spec-validate.js |
| 2.5 readiness | (无) | spec-readiness.js |
| 3a 机械 + lint | (无) | spec-lint.js + spec-validate.js |
| 3b 评审 | `spec-review` skill | spec-render.js |
| 3c S1 签字 | `sign-gate` skill | sign-gate.js |
| 4 dev-pipeline | `dev-pipeline` skill | dev-gen.js + spec-validate.js + spec-cli.js |
| 5 test-pipeline | `test-pipeline` skill | test-gen.js + spec-validate.js |
| 6 S3 验收 | `sign-gate` skill | sign-gate.js + measure-opc-cost.js |

## 流程

### 阶段 0：自助调研

- 6 类信息源并发（项目根 CLAUDE.md / docs / 知识库 / 已有 spec / README / process-docs）
- 不开口问，先挖全

### 阶段 1：brainstorm

- 加载 `brainstorm` skill
- M3 C2 通过后加载 `user-perspective-analyzer` skill
- Handoff 产出 `spec/sources.md` 草稿

### 阶段 2：build-spec

- 加载 `build-spec` skill
- sources.md 100% 翻译为 spec.feature
- 跑 spec-validate.js（不自检不能进 2.5）

### 阶段 2.5：readiness（机器可测清晰度）

- 跑 spec-readiness.js
- 7 项指标：6 硬 + 1 软
- 阻断 → 引导回对应阶段
- 软失败 ≤ 1 项可走（写软失败免责锚点：sign-gate --soft-ack）

### 阶段 3a：机械 + lint

- 跑 spec-lint.js + spec-validate.js
- 不通过 → 回阶段 1/2

### 阶段 3b：评审

- 跑 spec-render.js
- 加载 `spec-review` skill
- ≥ 90 分通过 / 显式跳过写 C5 锚点

### 阶段 3c：S1 签字 Gate

- 加载 `sign-gate` skill
- OPC 选：通过 / 改需求 / 撤回
- 拒签 → 回阶段 1/2

### 阶段 4：dev-pipeline（AI 全自主）

- 加载 `dev-pipeline` skill
- 末尾自动加载 sign-gate 弹 S2
- S2 拒签归因 → 回 prd（spec 错）/ 回 dev（实现错）

### 阶段 5：test-pipeline（AI 全自主）

- 加载 `test-pipeline` skill
- 末尾自动加载 sign-gate 弹 S3
- S3 拒签归因 → 同 S2

### 阶段 6：S3 验收 + 成本归因

- sign-gate 弹 S3 accept
- 自动跑 measure-opc-cost.js
- 写 ACCEPTANCE.md

## 阶段切换硬规则

1. 阶段 2 必跑 spec-validate（不自检不能进 2.5）
2. 阶段 2.5 readiness 阻断必回**对应阶段**（不静默蒙混）
3. 阶段 3c 拒签后**禁止原地改 spec**——必须回阶段 1/2 走完整链路
4. 阶段 4/5 跑崩点最多内部修 3 次，第 4 次必须问 OPC（避免死循环）
5. 阶段 6 S3 通过后**不再回退**——除 OPC 显式 ack 撤回

## OPC 注意力预算

| 档位 | 触发 | Gate 次数 |
|---|---|---|
| 简单档 | 无 F-XX 崩 + 无拒签 | C1+C2+C4 (prd 内) + S1 + S2 + S3 = 5-6 次 |
| 复杂档 | 1 次崩 / 1 次拒签 | +1-2 次 |
| 上限 | (RFC-0013 新规约) | 8 次 |

## 跟 prd-edit 的区别

| 项 | prd（本 skill） | prd-edit |
|---|---|---|
| 触发 | `/god:prd`（默认）| `/god:prd --mode edit` |
| 阶段 0 调研 | 完整 6 类 | 复用旧 spec 结论 |
| brainstorm | M1-M3 全量 | diff 模式（仅看新增/修改/删除）|
| 适用 | 新需求首次梳理 | 已存在 spec.feature，改需求 |
| 节省 | - | ≈ 15 min OPC 注意力 |

## 禁止

- ❌ 跳过 sign-gate 直接跑 dev / test
- ❌ 在阶段 4/5 跑的时候弹"是否继续"（默认继续，不问）
- ❌ readiness 硬失败时强签字
- ❌ 阶段 2.5 软失败 > 1 项仍放行
