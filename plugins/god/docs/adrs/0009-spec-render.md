---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0009: spec-render G7 落地（plan.md §4 B'）

> **状态**：✅ 已接受（v0.4.0+ 实现已落）
> **替代**：[`RFC-0009`](../rfcs/0009-spec-render.md)
> **决议日**：2026-08-10
> **影响范围**：`spec/scripts/spec-render.js` / `spec/scripts/spec-render.test.js` / `skills/spec-review/SKILL.md` §2 / `commands/prd.md` 阶段 3b

---

## 1. 上下文

`skills/spec-review/SKILL.md` v0.4.0 已实现 D1-D4 4 维度评分（需求完整 / 用户视角 / GWT 可验证性 / 双向绑定）。但评审者直接读 `spec.feature` Gherkin 原文做评分：

- 要脑补"哪条 REQ 覆盖哪个 SC"（D1）
- 要脑补"哪个 SC 没在代码/测试里"（D4）
- 要看完整 Gherkin 才知"哪些是 sad-path / intent"（D2 边界）

roadmap P1 G7 决定实现 spec-render：把 `spec.feature` + `spec/sources.md` + `spec/meta.json` 翻译成评审者视角的 checklist（`spec/review.md`），D1-D4 评分有自评草稿。

## 2. 决策

**G7 spec-render = v0.4.0+ 必做**（roadmap P1）。具体约束：

| 约束 | 决定 |
|---|---|
| 输入 | `spec/spec.feature` + `spec/sources.md` + `spec/meta.json` |
| 输出 | `spec/review.md`（与 spec.feature 同目录）|
| 解析 spec.feature | inline 复制 parseFeatureScenarios（保持独立可跑）|
| REQ 解析 | 从 sources.md 需求清单表格解析（"REQ-xxx \| 描述 \| 类别 \| MoSCoW \| 来源 \| 归属"）|
| 代码/测试扫描 | inline 复制 scanCode + scanTests（复用 spec-validate.js #7/#8 逻辑）|
| D1 维度 | 每 REQ → 覆盖 SC + ✅/❌/🚫 状态（Out of Scope 显式标）|
| D2 维度 | SC 按 tag 分类列表（happy / edge / sad-path / intent / untagged）|
| D3 维度 | GWT 字段非空机械检查（✓/✗）|
| D4 维度 | SC ↔ 代码 ↔ 测试三方映射矩阵 + 孤儿检测 |
| 评分草稿 | 留空（spec-review skill 跑完回填）|
| 覆盖 | 默认询问；`--force` 跳过 |
| 失败回滚 | 写失败 → 自动恢复原 review.md |

## 3. 后果

### 3.1 必修（v0.4.0+ 已完成）

- ✅ `spec/scripts/spec-render.js`（~280 行：4 解析 + 4 生成 + 4 CLI 错误处理 + 写失败回滚）
- ✅ `spec/scripts/spec-render.test.js`（14 测试全过：解析 + 生成 + CLI + 4 维度）
- ✅ demo/lead-scoring 跑通：产 spec/review.md（80 行）+ D1-D4 维度齐全
- ⏳ `skills/spec-review/SKILL.md` §2 阶段 2 加"前置产物：自动跑 spec-render"（待接入）
- ⏳ `commands/prd.md` 阶段 3b 加"前置产物：自动跑 spec-render"（待接入）

### 3.2 与 G1/G2/G8 协同

| 维度 | 关系 |
|---|---|
| G1 spec-cli | spec-render 不读 phase 状态（避免耦合）|
| G2 meta.json | spec-render 不写 meta（只读产物，不修改真相源）|
| G8 summary | summary.md 给 OPC 看（签字）；review.md 给评审者看（找 bug）。两个产物独立 |
| G5 dev-gen | spec-render D4 扫描 dev-gen 产出的 @spec 标注 |
| G6 test-gen | spec-render D4 扫描 test-gen 产出的 `SC-xxx:` 用例名 |

### 3.3 拒绝（明确不做）

- ❌ spec-render 写评分 —— 只写 checklist + 草稿占位（评分是 spec-review 的活）
- ❌ spec-render 跑 spec-validate —— 只读，不校验
- ❌ spec-render 合并到 summary.md —— 两个产物用途不同
- ❌ spec-render 修 review.md 旧版 diff —— 只覆盖（历史由 spec-archive 留）
- ❌ 自动跑 spec-render 写 review.md —— 必须显式（spec-review 阶段可自动调）

## 4. 替代方案（已否决）

### 方案 B：spec-render 跑 spec-validate 推算 D1-D4 自评分

- 拒因：spec-validate 是机械规则（行号扫描），评分需语义判断。混在一起 = 评分无意义

### 方案 C：spec-render 合并到 spec-summary（一个 summary.md 全包）

- 拒因：summary.md 给 OPC 看（1 页，签字）；review.md 给评审者看（4 维度，checklist）。受众不同，混一起两边都难用

### 方案 D：review.md 入 spec/archive/

- 拒因：review.md 是评审产物（评审一次写一次），不入 spec 真相源；archive 只存 spec 真相源快照

## 5. 关联

- 上一 ADR：[`ADR-0008 test-gen`](0008-test-gen.md)（v0.4.0+ G6）
- RFC：[`RFC-0009`](../rfcs/0009-spec-render.md)
- 关联 RFC：[`RFC-0010 god-trends`](../rfcs/0010-god-trends.md)
