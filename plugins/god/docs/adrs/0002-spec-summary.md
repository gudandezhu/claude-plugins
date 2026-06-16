# ADR-0002: G8 spec-summary 接受为 v0.4.0 P0 落地项

> **状态**：✅ 已接受（v0.4.0 P0 实现已落）
> **替代**：[`RFC-0002`](../rfcs/0002-spec-summary.md)
> **决议日**：2026-07-13
> **影响范围**：`commands/prd.md §2.5` / `spec/scripts/spec-summary.js` / `spec/scripts/spec-summary.test.js` / `templates/spec-summary/v0.1.0.md`

---

## 1. 上下文

god v0.3.0 把 G8 spec-summary 从 P1 提为 P0（[roadmap §3.2 G8](../roadmap.md)），但具体设计与落地路径未明。RFC-0002 提出完整方案。

## 2. 决策

**G8 spec-summary = OPC 验收界面，v0.4.0 P0 必做**。具体设计见 RFC-0002 §3，本 ADR 锁定关键约束：

| 约束 | 决定 |
|---|---|
| summary.md 上限 | **100 行**（含 4 段结构 + 强制跳行号链接）|
| 零 Gherkin 关键词 | Given / When / Then / And / But / Scenario / Feature / SC-xxx 全禁 |
| 强制跳回 spec.feature | 末尾 1 行 `> 详细 spec: spec/SPEC-FORMAT.md#L<num>-L<num>` |
| "不在范围内" 段必含 | 3-7 条 OPC 显式排除项 |
| 接入 prd 阶段 2.5 | 自动跑 gen，**不阻塞**——失败仅 warn |
| 接入 test 阶段 S1 出口 | 跑 check 校验 + 4 项规则 |

## 3. 后果

### 3.1 必修（v0.4.0 已完成）

- ✅ `spec/scripts/spec-summary.js`（~250 行，含 gen/check 子命令 + 4 段解析 + 行号自动算）
- ✅ `spec/scripts/spec-summary.test.js`（11 测试，覆盖解析 + 校验规则 + 负面用例）
- ✅ `templates/spec-summary/v0.1.0.md`（占位符模板）
- ✅ `commands/prd.md` §2.5 阶段接入
- ✅ 11/11 单元测试全过

### 3.2 兼容性

- 旧 spec 项目（无 sources.md 的 4 段结构）—— gen 失败但 prd 不阻塞，warn 提示
- 3 份 perspectives 演练中 OPC"看 summary 签字"的承诺——v0.4.0 后**真能兑现**

### 3.3 拒绝（明确不做）

- ❌ 模板多版本（v0.1.0 单一模板）
- ❌ 多 spec.feature → 1 份 summary（roadmap 未来扩展）
- ❌ 阶段 2.5 阻塞（summary 失败不阻塞 prd）
- ❌ summary 含代码片段 / Gherkin 关键词

## 4. 替代方案（已否决）

### 方案 B：summary 由 AI 自由发挥（无模板）

- 拒因：3 份 perspectives 01 §1 D5 S1 翻脸案例 = AI 生成的"验收报告"和"summary"里没让 OPC 1 跳回原文 → 假签字反模式温床

### 方案 C：summary 含 SC-xxx 编号（让 OPC 看到 SC 锚点）

- 拒因：违反 CLAUDE.md §1.1 目标 1 字面"OPC 不直接打开 spec.feature"——SC-xxx 是 spec.feature 的术语

## 5. 关联

- 3 视角：[`01-ops-runbook.md §1 D5`](../perspectives/01-ops-runbook.md) / [`03-architect-perspective.md §3`](../perspectives/03-architect-perspective.md)
- 上一 ADR：[`ADR-0001 spec 状态机 6 vs 4 状态`](0001-spec-lifecycle-6-vs-4-states.md)
- 下一 RFC：[`RFC-0003 hooks 集成（G3）`](../rfcs/0003-hooks-integration.md)（待写）
