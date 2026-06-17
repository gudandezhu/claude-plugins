# subagent 任务书：god 根 6 项 bug 修复 + 演练验证

> **目的**：subagent 第一轮跑出 6 个真问题，**核心是改 god 根**，demo 只是验证手段。
> **起点**：god 根有 12 个 L3 脚本，6 个被指证有 bug
> **终点**：6 个 god 根 bug 全修 + 单元测试全过 + 在 lead-scoring demo 上跑通验证
> **禁止**：堆 demo 产物、甩半成品、用 url-shortener/task-tracker

---

## 0. 你的工作位置

- god 根：`/Users/puyifan/project/github/claude-plugins/plugins/god/`（**你主要改这里**）
- 验证用 demo：`demo/lead-scoring/`（v1.1.0 lead-tag 已闭环，**只用来跑通、不许大改**）
- L3 工具目录：`spec/scripts/`（重点改这里）
- L4 模板：`templates/`

---

## 1. 第一轮跑出的 6 个 god 根 bug（必须全修）

### Bug #1：measure-opc-cost.js 演练 NO-VERIFY 误算

**位置**：`spec/scripts/measure-opc-cost.js`

**症状**：`demo/lead-scoring` 跑出"崩点修复: 90min"，但实际 5 次 NO-VERIFY 是"故意破环→拦截→还原"的演练，1 次是真 bug fix。归因把演练成本也算成崩点成本。

**修法**：
- 读 `.trace` 文件的 NO-VERIFY 记录
- 识别 `commit message` 或 `trace reason` 字段含 `演练/破环/test/intentionally` 关键字
- 演练类 NO-VERIFY **不计入崩点成本**（可单独 report "演练 N 次"但不乘 15min）
- 加单元测试：构造 5 个演练 NO-VERIFY + 1 个真 NO-VERIFY，断言总崩点 = 15min 而非 90min

### Bug #2：@intent SC-004 在 spec-validate 强制"代码+测试绑定"

**位置**：`spec/scripts/spec-validate.js`

**症状**：`SPEC-FORMAT.md §3.4` 写"豁免代码+测试绑定"，但 spec-validate.js 实际仍把 `@intent` SC 算进"代码缺 @spec / 测试缺 SC-xxx:" 的错。

**修法**：
- spec-validate.js 跑追溯矩阵时，**@intent SC 跳过"代码绑定"和"测试绑定"检查**
- 仍要求 sources.md 的 C6 锚点存在（这条不能豁免）
- 加单元测试：构造 @intent SC，断言不报"代码缺 @spec"

### Bug #3：spec.feature 模板没说"前后端职责边界"

**位置**：`spec/SPEC-FORMAT.md` §3 + §6

**症状**：SC-001 Then 写"界面显示'已收到'"，实现只返 message 字符串。规范没说"后端只返数据，UI 负责渲染"。

**修法**：
- SPEC-FORMAT.md §3 加一节"职责分离"：明确 GWT 的 Then 是"系统行为契约"，包含 1) 数据契约 2) UI 渲染
- §6 示例的 Then 加注释"后端: 返回 X；UI: 渲染 Y"
- 不改 demo 任何 spec.feature

### Bug #4：spec-summary.js 重复"详细 spec"链接

**位置**：`spec/scripts/spec-summary.js` + `templates/spec-summary/`

**症状**：`demo/lead-scoring` summary.md 末尾"详细 spec"链接出现 2 次（`spec/SPEC-FORMAT.md` + `spec/SPEC-FORMAT.md#L1-L2`）。

**修法**：
- 读 `spec/scripts/spec-summary.js` 的 render 函数
- 找到"详细 spec"行生成逻辑，**去重只保留 1 次**
- 加单元测试：跑 gen → 断言 "详细 spec" 行只出现 1 次

### Bug #5：sc4() 空壳函数（subagent 产物）

**位置**：无（这是 subagent 自己造的，本就不该存在）

**修法**：**不需要修 god 根**。`SPEC-FORMAT.md §3.4` 已经豁免 @intent SC 的代码+测试绑定，subagent 应该遵守而不是写 sc4()。在你的 REHEARSAL-REPORT 写明"subagent 应遵守豁免规范，不必造空壳函数"。

### Bug #6：REHEARSAL-REPORT.md 自评表不可信

**位置**：无（这是 subagent 自己写的报告）

**修法**：**不需要修 god 根**。REHEARSAL-REPORT 是 demo 产物，**删 demo**（已删）。如果你要 god 自身有"演练报告模板"，可以放 `templates/rehearsal-report.md`，但**非必需**。

---

## 2. 必走的 5 个阶段（核心是改 god，跑通 demo 是验证）

| # | 阶段 | 产物 | 验收 |
|---|---|---|---|
| 1 | **修 Bug #1** | `spec/scripts/measure-opc-cost.js` 改 + 单测 | `npx vitest run spec/scripts/measure-opc-cost.test.js` 全过；跑 demo/lead-scoring 输出 崩点修复 ≤ 5min |
| 2 | **修 Bug #2** | `spec/scripts/spec-validate.js` 改 + 单测 | `npx vitest run spec/scripts/spec-validate.test.js` 全过；构造 @intent SC 不报代码缺 |
| 3 | **修 Bug #3** | `spec/SPEC-FORMAT.md` §3/§6 加职责分离节 | 不跑测试，肉眼可读；Lead-scoring demo 的 spec.feature 不用动 |
| 4 | **修 Bug #4** | `spec/scripts/spec-summary.js` 改 + 单测 | `npx vitest run spec/scripts/spec-summary.test.js` 全过；跑 demo/lead-scoring 重 gen summary.md，"详细 spec"行 1 次 |
| 5 | **总验证** | 跑 `lead-scoring` 全链路（10 步同前任务书 §2，但用 lead-scoring 替代新建 demo） | vitest 全过 + spec-validate 14/14 + measure-opc-cost 输出正确归因 + spec-summary 干净 |

---

## 3. 量化评分表（100 分制，最后自评 + 我验收）

| 维度 | 分值 | 评分标准 |
|---|---|---|
| 1. Bug #1 修对 | 20 | measure-opc-cost.js 修改有针对性 + 单测覆盖"演练 NO-VERIFY 不计入崩点"场景 + lead-scoring 跑出 崩点修复 ≤ 5min |
| 2. Bug #2 修对 | 20 | spec-validate.js 豁免 @intent SC 代码+测试绑定 + 单测覆盖 + lead-scoring 跑 14/14 不报 |
| 3. Bug #3 修对 | 10 | SPEC-FORMAT.md 加"职责分离"节，文字清晰、示例到位 |
| 4. Bug #4 修对 | 15 | spec-summary.js 去重 + 单测 + lead-scoring 跑 summary.md 干净 |
| 5. lead-scoring 全链路验证 | 15 | 5 维归因正确 + 14/14 validate + vitest 全过 + summary 干净 |
| 6. commit 信息质量 | 5 | 4 个 god 根 fix commit 信息符合 Conventional Commits，diff 干净（只改相关文件）|
| 7. 报告 | 10 | `docs/incidents/0002-god-rehearsal-round-1.md` 写清 6 bug 起源 + 修法 + 教训 |
| 8. 产物干净 | 5 | 无 dead code、无 .DS_Store、commit hash 记录全 |
| **总计** | **100** | |

**评分 < 90 视为不合格 self-fix；连续 2 轮 < 90 立刻汇报**。

---

## 4. 强制规则

1. **核心是改 god 根**。不要碰 demo（lead-scoring 只读验证；其他 demo 不动）。
2. **每个 god 根 fix 必须有单测**。`spec/scripts/*.test.js` 都用 vitest，没有单测的修法不算修。
3. **不许甩半成品**。5 阶段顺序不能换，每阶段产可量化证据。
4. **遇到 OPC 模糊点**：按 §1 修法做，不准回头问。
5. **每个阶段 commit 一次**（5+ 个 commit 是合理的），commit 信息必含 `fix(god):` 前缀。
6. **不撤我之前 commit**（包括 dirty 树固化的 commit）。你的 commit 必须基于 god 根最新 main。
7. **必须写 1 个 incident**：`docs/incidents/0002-god-rehearsal-round-1.md`，把 6 bug + 修法 + 教训沉淀进 god 知识库。

---

## 5. 汇报节点

**单轮汇报（B 汇报）**：
- 跑完全部 5 阶段后
- 给我 SendMessage
- 必含：commit log（5+ god 根 commit）+ 5 阶段产物清单 + 单测输出 + lead-scoring 全链路输出 + 自评分表
- **没达到 90 分前不要汇报**

---

## 6. 开干信号

读完本文件 → 在 god 根 `/Users/puyifan/project/github/claude-plugins/plugins/god/` 开干。
任何阶段卡住超过 3 次尝试 → 用 SendMessage 给我汇报，不要硬撑。
