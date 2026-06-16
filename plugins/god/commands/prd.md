---
description: >
  需求的唯一入口。梳理（加载 brainstorm skill）+ 固化（加载 build-spec skill）。
  AI 先自助调研（CLAUDE.md / docs / 知识库 / 已有 spec）再与用户交互，
  满足 2 标准才固化 spec。方法论由 skill 承载，本 command 只编排。
argument-hint: 需求想法 / 项目目录
---

你是需求的唯一入口。**方法论全部由 skill 承载，本 command 只编排流程——不自己写内容，靠加载 skill。**

## 目的

prd 的全部目的是**把模糊想法梳理成无歧义、可验证的需求**，最终落到标准 spec.feature。

- 一切手段（用户视角分析 / 6 lenses / Need Gate / Challenge）都是**为梳理服务**，不是 prd 本身的目的
- 梳理的充分性 = 产出的充分性；草草梳理必然产出一份漏掉的 spec
- 固化的标准 = 梳理出的需求**100% 转化为标准格式**，无遗漏、无新增

## 产出 spec 的 2 个标准（满足任一才固化，否则继续梳理）

1. **用户明确要求产出**（任何时刻："够了 / 固化吧 / 出 spec"）
2. **需求完全清晰**：brainstorm skill 里程碑 3 完成，行为契约能写成 Given/When/Then

两者都不满足 = 继续梳理，绝不产出。

## 流程（编排，方法论在 skill）

### 阶段 0：自助调研（必做，问用户前先做完，并发提速）

**不开口问，先把能挖的全挖出来。**

| # | 信息源 | 解决什么问题 |
|---|--------|------------|
| 1 | 项目根 `CLAUDE.md` | 项目结构、技术栈约定、命名规范、已声明的偏好 |
| 2 | `docs/`、`doc/`、`wiki/` | 业务背景、领域知识、术语表 |
| 3 | 业务/技术知识库（`biz-product-docs/`、`biz-tech-docs/`、`tech-specs/`） | 同领域已有产品/技术决策 |
| 4 | 已有 `spec.feature` | 同类需求的历史 spec 模板、Scenario 风格 |
| 5 | 项目 `README.md`、`CHANGELOG.md` | 项目定位、近期变更 |
| 6 | `process-docs/` | 团队过程产物（既有提案、复盘） |

**并发策略**：根据独立性分配 worker,目录不存在时 worker 返回"无"不阻塞。
- **本地快速读**（主 agent 同轮并行 Read）:源 1、源 5
- **域级扫描**（3 个 Explore subagent 并行）:源 2、源 3、源 6
- **同项目历史**（1 个 Explore subagent）:源 4

并发完成后合并为**调研摘要**（短句 + 来源），供 brainstorm skill 每个里程碑复用。

### 阶段 1：梳理（加载 brainstorm skill）

加载 `brainstorm` skill，完整执行其方法论。

**M3 C2 通过后 → 加载 `user-perspective-analyzer` skill**（核心流程节点已对齐，按角色深入挖掘真实视角与隐性需求）。产物写 `spec/sources/user-perspectives/{role}.md` + `_summary.md`，路径记录到 sources.md 元信息区。**Handoff 之前必跑**——build-spec 阶段会读用户视角文档作为 REQ 命名的语义参考。

终点：**Handoff 产出 `spec/sources.md` 草稿**（需求清单 + MoSCoW + 未决项 + 元信息 + M1-M3 Snapshot + Check 结论 + 用户视角文档路径），需求清晰到能写 GWT，无歧义、无遗漏、未决项已结案。

### 阶段 2：固化（加载 build-spec skill）

满足 2 标准后，加载 `build-spec` skill,按 sources.md 100% 翻译生成/变更 `spec.feature`。**双向绑定机制、不丢不增原则**详见 build-spec skill。

### 阶段 2.5：OPC 验收界面（自动产出 summary.md）

> v0.4.0 新增（G8 spec-summary，P0）。详见 [RFC-0002](../docs/rfcs/0002-spec-summary.md)。

阶段 2 build-spec 自检通过后，**自动跑** `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目目录>`：

- 读 `spec/spec.feature` + `spec/sources.md`
- 写 `spec/summary.md`（≤ 100 行，零 Gherkin 关键词，强制末尾"详细 spec"链接）
- **不阻塞** prd——summary 失败仅 warn，不退回阶段 2
- OPC 在 S1 出口（test 阶段）会再跑一次 `spec-summary check`，保证"被签字那一刻"summary 是最新

`summary.md` 是 OPC 唯一看的产物——**prd 全程不许引导 OPC 打开 spec.feature**。

### 阶段 3：自检（拆 3a 机械 + 3b 语义）

#### 3a 机械校验（v0.4.0 起硬挂）

**v0.4.0 强化**：本阶段 3a 必跑，**不通过则 prd 阶段 3 不进 3b**（exit 1 强制回退）：

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>
```

**校验项全过**：
- 格式项（Feature / 版本 / Scenario ID / GWT）
- 双向绑定（sources.md ↔ spec.feature）
- **C5 锚点**（`spec/sources.md` 必须含 `- **C5 Spec 评审** (...)` 行，通过/未跑二选一，格式见 `skills/spec-review/SKILL.md` 阶段 4）
- 漂移检测（代码 / 测试 ↔ spec）

**C5 校验是 spec-review 的机械门禁**：
- 无 C5 → spec-review 没跑或被绕过
- C5 格式错 → 主 agent 伪造或漏字段
- C5 写"通过"但分 < 90 → 自相矛盾
- 任一失败 → 阶段 3b 没真正完成,**回到 3b 重跑**（不能直接补锚点蒙混）

**v0.4.0 起硬规则**：
- spec-validate exit code != 0 → **prd 阶段 3a FAIL**，不进入 3b
- C5 失败 → 回 3b 重跑（不能直接补锚点）
- 其他校验失败 → 按 validator 报错定位回对应阶段修

**不通过 → 回对应阶段修**（C5 失败回 3b；其他按 validator 报错定位）。

#### 3b 语义评审（强制环节）

**加载 `spec-review` skill**(一句话入口)。不要绕过本 SKILL 自己拼 `eval-loop(...)`——本 SKILL 内部固定 `maxIterations=1` 禁用 Fix 阶段,绕过则违背评审契约。

`spec-review` skill 对 `spec/sources.md` + `spec/spec.feature` 做语义质量门禁:
- 评分维度:D1 需求完整性 30 + D2 用户视角正确性 25 + D3 GWT 可验证性 25 + D4 双向绑定一致性 20
- ≥ 90 分通过,< 90 不通过

**不通过的处理路径**(主 agent 决策,本 command 不自动改):
- D1 失分 → 回到 `prd 阶段 1` brainstorm M2/M3 补
- D2/D3/D4 失分 → 回到 `prd 阶段 2` build-spec 重写
- 未结案项不为 0 → 主 agent 主动 AskUserQuestion,**不可静默**
- 用户主动跳 → 必须输入完整"我确认跳过 spec-review",**二次确认后必须写一行 C5 锚点(标"未跑"格式,见 spec-review/SKILL.md 阶段 4)**

**评审产物归档(强制)**:
- **通过**:写一行 `- **C5 Spec 评审** (YYYY-MM-DD HH:MM / {简单档|复杂档} / XX 分 / 通过)` 到 `spec/sources.md` 的 Check 结论区
- **跳过**:写一行 `- **C5 Spec 评审** (YYYY-MM-DD HH:MM / 未跑 / 免责确认:{摘要})` 同位置

**这条 C5 锚点必被 `/god:dev` 消费**(见 `commands/dev.md`)。spec 历史上任一版本必带 C5 行,无 C5 视为评审缺失,dev 阶段报错。

### 阶段 4：衔接

spec 就绪 → `/god:dev`；变更同步 dev/test 防漂移。

## 4 个必确认 check 点（不可省）

| # | check 点 | 时机 | 确认什么 | 失败后果 |
|---|---------|------|---------|---------|
| **C1** | **目标价值** | 阶段 1 M1 末尾 | "为什么做？做成什么样算赢？" | 方向错了，spec 写得再细也是废的 |
| **C2** | **核心流程** | 阶段 1 M3 末尾 | 主流程节点 + 每节点业务规则 + 方向选择 | 流程错了，下游 dev/test 全部返工 |
| **C3** | **疑问点** | 阶段 1 全程动态 | AI 拿不准、有歧义、调研不到的点 | 留到固化才发现 = 推翻重来 |
| **C4** | **总流程** | 阶段 1 M3 末尾,**C2 之后** | 整张 spec 全景：场景清单 + 边界 + 异常 + 优先级 + 未决项 | 单点对 ≠ 全局对，最后一刻才发现漏了关键场景 |

- **C1 / C2 / C4 是 gate**：不通过则继续梳理
- **C3 是动态的**：AI 拿不准时主动问
- **check 形式**：用 1 次 AskUserQuestion 列出确认项 + "调整"选项,让用户一次性 ack 或改
- **GATE 触发规则**（确认/修改/无回复行为,见 brainstorm skill C1 Gate 节）
- **check 通过后**:记录结论到 sources.md 的 "Check 结论"区,作为追溯锚点

## 原则

- 梳理充分优先于快速产出
- 固化 = 100% 翻译梳理结果,不丢不增
- **command 编排,skill 承载方法**
- 变更从 spec 发起(防漂移)
