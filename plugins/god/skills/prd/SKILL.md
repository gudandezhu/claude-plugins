---
status: stable
name: prd
user-invocable: false
description: |
  god 需求入口流水线（RFC-0013 落地，v0.7.0+）。
  9 阶段编排：调研 → brainstorm → build-spec → readiness → 评审 → S1 签字 → dev → test → S3 验收。
  主 agent 只做编排，每个阶段派 subagent 干具体活。
  命令层 /god:prd 默认加载本 skill（无 --mode 时）。轻量场景用 prd-edit。
---

# PRD 一条龙（默认走法）

> 完整需求 → 验收全流程。**主 agent 永远只编排不干活**——每个阶段派 subagent，写产物 + 跑 L3 校验。**主 agent 只读结果、弹签、衔接**。

## 编排契约

| 角色 | 能做 | 不能做 |
|---|---|---|
| **主 agent** | 派 subagent、读 subagent 结果、弹 AskUserQuestion（经 ask-user skill）、跑 sign-gate、推进 phase | 写 spec / 写代码 / 跑测试 / 改 spec 文件 |
| **subagent** | 独立 session 干"具体活"、写产物、跑 L3 校验、写 checkpoint | 弹签 / 派 subagent / 改 spec.state.meta.json / 跑 sign-gate |
| **sign-gate skill** | 弹签 + 推进 phase + 写锚点 | 派 subagent / 写产物 |

**关键**：每个阶段末尾 subagent 必回主 agent，**由主 agent 弹签**。subagent 不能弹签。

## 9 阶段表（主 agent 编排）

**横切关注点**：架构文档 `spec/architecture/{business,tech}.md` 在 prd / dev 阶段都读。

| # | 阶段 | 派 subagent | subagent 写产物 | 读 architecture/ | 主 agent 动作 |
|---|---|---|---|---|---|
| 0 | 自助调研 | `Explore` subagent × 6 并行 | (读) | (读 business.md 业务域清单) | 收集调研摘要进 sources.md 草稿 |
| 1 | brainstorm | `brainstorm` subagent | spec/sources.md 草稿 | 读 business.md (新需求归到 D-XXX) | 弹 C1 / C2 / C4 Gate |
| 1.5 | user-perspective | `user-perspective-analyzer` subagent | spec/sources/user-perspectives/ | 读 business.md | (无) |
| 2 | build-spec | `build-spec` subagent | spec/domains/D-XXX/spec.feature（**1 domain 1 spec.feature**）| 读 business.md (判业务域归属) | 跑 spec-validate.js 校验 |
| 2.5 | readiness | (无 subagent) | (无) | (无) | 跑 spec-readiness.js |
| 3a | 机械 + lint | (无 subagent) | (无) | (无) | 跑 spec-lint.js + spec-validate.js |
| 3b | 评审 | `spec-review` subagent（reviewer + fixer）| (评审产物) | 读 business.md (验 SC 业务域归属) | 跑 spec-render.js，循环派 reviewer/fixer |
| 3c | S1 签字 | (无 subagent) | (无) | (无) | 加载 sign-gate skill 弹 S1 |
| 4 | dev | `dev` subagent | src/D-XXX/* + @spec 标注 | 读 tech.md (服务划分 + API + DB) | 跑 dev-gen.js + spec-validate.js + spec-cli.js advance + **同步 tech.md** |
| 4.5 | S2 签字 | (无 subagent) | (无) | (无) | 加载 sign-gate skill 弹 S2 |
| 5 | test | `test` subagent | tests/D-XXX/* + SC-xxx 命名 | 读 tech.md (服务边界) | 跑 test-gen.js + spec-validate.js |
| 5.5 | S3 签字 | (无 subagent) | (无) | (无) | 加载 sign-gate skill 弹 S3 |
| 6 | 验收 + 成本归因 | (无 subagent) | (无) | (无) | 跑 measure-opc-cost.js 写 ACCEPTANCE.md |

## 流程（按阶段）

### 阶段 0：自助调研（主 agent 派 6 Explore subagent）

- 6 类信息源并发（项目根 CLAUDE.md / docs / 知识库 / 已有 spec / README / process-docs）
- 不开口问，先挖全
- **主 agent 不读**——派 6 个 Explore subagent 并行，主 agent 拿汇总

### 阶段 1：brainstorm（派 brainstorm subagent）

- 派 `brainstorm` subagent（worktree 隔离）
- subagent 跑 M1/M2/M3 + 维护 sources.md 草稿
- subagent 写完回主 agent
- **主 agent 弹 C1 / C2 / C4 Gate**（经 ask-user skill）

### 阶段 1.5：user-perspective

- M3 C2 通过后派 `user-perspective-analyzer` subagent
- subagent 写 `spec/sources/user-perspectives/` 下每角色文档 + _summary.md

### 阶段 2：build-spec（派 build-spec subagent）

- 派 `build-spec` subagent（worktree 隔离）
- subagent 读 sources.md → 逐条翻译为 spec.feature
- subagent 跑 spec-validate.js 自检
- subagent 完事回主 agent

### 阶段 2.5：readiness（主 agent 跑 L3 脚本）

- 主 agent 跑 `spec-readiness.js`
- 7 项指标：6 硬 + 1 软
- 阻断 → 引导回对应阶段
- 软失败 ≤ 1 项可走（写软失败免责锚点：sign-gate --soft-ack）

### 阶段 3a：机械 + lint（主 agent 跑 L3 脚本）

- 主 agent 跑 `spec-lint.js` + `spec-validate.js`
- 不通过 → 回阶段 1/2

### 阶段 3b：评审（派 spec-review subagent 循环）

- 主 agent 跑 `spec-render.js`
- 派 `spec-review` subagent（reviewer 角色，独立 session）
- reviewer 返回评分报告
- **主 agent 决策**：不通过则派 fixer subagent 修 spec → 再派 reviewer 复评
- 循环上限 3 轮（1 评 + 2 复评），超限强制终止
- ≥ 90 分通过 / 显式跳过写 C5 锚点

### 阶段 3c：S1 签字 Gate（主 agent 弹签）

- 加载 `sign-gate` skill
- 主 agent 弹 S1（4 选项：通过+继续 / 通过+结束本会话 / 改需求 / 撤回）
- OPC 选后 sign-gate.js 推进 phase

### 阶段 4：dev（派 dev subagent）

- 派 `dev` subagent（worktree 隔离）
- subagent 读 spec.feature → 跑 dev-gen.js → 写 src/* + @spec 标注
- subagent 跑 spec-validate.js + spec-cli.js advance
- subagent 完事回主 agent
- **主 agent 不写代码**——只读 subagent 产物

### 阶段 4.5：S2 签字 Gate（主 agent 弹签）

- 加载 `sign-gate` skill
- 主 agent 弹 S2（4 选项：通过+继续 / 通过+结束本会话 / spec 错 / 实现错）
- 拒签归因 → 回 prd（spec 错）/ 回 dev（实现错）

### 阶段 5：test（派 test subagent）

- 派 `test` subagent（worktree 隔离）
- subagent 跑 test-gen.js → 写 tests/* + SC-xxx 命名
- subagent 跑 spec-validate.js
- subagent 完事回主 agent

### 阶段 5.5：S3 签字 Gate（主 agent 弹签）

- 加载 `sign-gate` skill
- 主 agent 弹 S3（4 选项：通过+继续 / 通过+结束本会话 / 退回 / 部分通过）

### 阶段 6：验收 + 成本归因（主 agent 跑 L3 脚本）

- sign-gate 弹 S3 accept
- 主 agent 跑 `measure-opc-cost.js`
- 写 ACCEPTANCE.md

## 阶段切换硬规则

1. 阶段 2 必跑 spec-validate（不自检不能进 2.5）
2. 阶段 2.5 readiness 阻断必回**对应阶段**（不静默蒙混）
3. 阶段 3c 拒签后**禁止原地改 spec**——必须回阶段 1/2 走完整链路
4. **subagent 跑崩点最多内部修 3 次，第 4 次必须回主 agent 问 OPC**（避免死循环）
5. 阶段 6 S3 通过后**不再回退**——除 OPC 显式 ack 撤回
6. **subagent 不能弹签**——任何 sign-gate 必回主 agent

## OPC 注意力预算

| 档位 | 触发 | Gate 次数 |
|---|---|---|
| 简单档 | 无 F-XX 崩 + 无拒签 | C1+C2+C4 (prd 内) + S1 + S2 + S3 = 5-6 次 |
| 复杂档 | 1 次崩 / 1 次拒签 | +1-2 次 |
| 上限 | (RFC-0013 新规约) | 8 次 |

## 多会话接续

> **主 agent 派 subagent 后，主 agent 自己必然轻量**——多会话问题主要由 subagent 内部处理。session-end hook 写断点由 subagent 写（不是主 agent）。

| 触发 | 处理者 | 动作 |
|---|---|---|
| subagent 跑不完 N SC | subagent 内部 | 写 `spec/<phase>-<task>-status.md` 断点 + 跑完当前项后退出 |
| OPC 说"结束会话" | 主 agent | 跑 session-end hook 写 `spec/<phase>-checkpoint.md` |
| 下一会话启动 | 主 agent | 读 phase + checkpoint → 重新派 subagent → subagent 读 status 续跑 |

**禁止**：

- ❌ 主 agent 自己干具体活（写 spec / 写代码 / 跑测试）
- ❌ subagent 弹 AskUserQuestion / 派 subagent / 跑 sign-gate
- ❌ 主 agent 主动建议"下一会话跑 X"
- ❌ subagent 把"OPC 注意力预算"当成"该退出"（由 OPC 主动说）

## 跟 prd-edit 的区别

| 项 | prd（本 skill） | prd-edit |
|---|---|---|
| 触发 | `/god:prd`（默认）| `/god:prd --mode edit` |
| 阶段 0 调研 | 完整 6 类 | 复用旧 spec 结论 |
| brainstorm | M1-M3 全量 | diff 模式（仅看新增/修改/删除）|
| 适用 | 新需求首次梳理 | 已存在 spec.feature，改需求 |
| 节省 | - | ≈ 15 min OPC 注意力 |

## 禁止

- ❌ 主 agent 干具体活（写 spec / 写代码 / 跑测试）
- ❌ 跳过 sign-gate 直接跑 dev / test
- ❌ 在阶段 4/5 跑的时候弹"是否继续"（默认继续，不问）
- ❌ readiness 硬失败时强签字
- ❌ 阶段 2.5 软失败 > 1 项仍放行
- ❌ subagent 弹签 / 派 subagent
