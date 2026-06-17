---
status: stable
name: brainstorm
user-invocable: false
description: Use when a user has a vague idea or feature request that needs to be clarified into unambiguous, testable requirements before being written as a spec. Triage requirements into core path and iteration pool before deep-diving. Pure dialogue — no documents produced, no commits.
argument-hint: "[idea or feature description]"
---

# Brainstorm

> **定位**：本 skill 由 `prd` 阶段 1 **派 brainstorm subagent 调用**——subagent 跑 M1/M2/M3 维护 sources.md 草稿，**主 agent 弹 C1/C2/C4 Gate**。
>
> 目的 = 把模糊想法梳理成无歧义、可验证的需求（能写 GWT）。**所有手段（用户视角分析 / 6 lenses / Need Gate / Challenge Protocol）都是为梳理服务**，本身不是目的。
>
> 梳理到里程碑 3（方案闭环）即停,产出 `spec/sources.md` 草稿,subagent 完事回主 agent，由主 agent 加载 build-spec 固化为 `spec.feature`。
>
> **对用户友好原则**：先把能挖的全挖出来（项目文档 / 知识库 / 已有 spec / 代码库），再开口问用户。问必带推荐项和推荐理由，让用户面对的是收敛后的选择题，不是空白问卷。

## 调用契约

**调用方**：主 agent（prd skill 阶段 1）派 `brainstorm` subagent
**subagent 不能做**：弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 spec.state.meta.json
**subagent 完事回主 agent**，主 agent 弹 C1/C2/C4 Gate。

The goal is **complete, unambiguous requirements** — making implicit assumptions explicit so the right path becomes obvious, and so the eventual spec captures every behavior contract with zero loss.

<HARD-GATE>
Do NOT write any files. Do NOT commit. This skill produces shared understanding only — output is dialogue, not artifacts. The output of this skill is **the clarity to write the spec**, not a document.
</HARD-GATE>

<HARD-GATE>
**梳理的充分性 = 产出的充分性**。每个里程碑的"完成标准"是"再问一遍能不能少一句话":如果还有一句话能补全就让 spec 完整,继续问;问不出新东西才停。漏一个边界 = spec 漏一个 Scenario = 测试漏一个用例 = 线上一个 bug。
</HARD-GATE>

<HARD-GATE>
**问用户前必须先自助调研**。能用 CLAUDE.md / docs / 知识库 / 已有 spec / 代码库解决的问题,绝不问用户。能用一句话推理得出的预设,不要展开问。问必带"推荐项 + 推荐理由"。能合并就合并,别拆成多道。
</HARD-GATE>

<HARD-RULE>
**No technology selection; constraints only.** Describe "what effect to achieve" (performance, platform, security) — not "what tool to implement with" (frameworks, languages, databases, patterns). Technology selection belongs in a later design phase.

**User-perspective boundary**: ALL questions and options must be framed from the user's perspective. If a question or option would only make sense to a developer (e.g., "which framework", "what protocol"), it is OUT OF SCOPE for brainstorm.

**Why user-perspective is non-negotiable here**: spec 的 Then 必须可观察、可验证。只有落在用户视角,Then 才能写成断言;问"用什么 API"得到的是实现选择,固化不进 spec;问"用户期望什么"得到的是行为契约,直接落 spec。

**Explicitly FORBIDDEN in brainstorm**:
- Technology stack choices (languages, frameworks, build tools, runtime)
- Architecture patterns (microservices, monolith, event-driven)
- API/protocol design (REST, GraphQL, gRPC)
- Database/storage selection
- Authentication implementation details
- Any "how to build" decisions

**Explicitly IN SCOPE for brainstorm**:
- User workflows and processes
- Feature behaviors and mechanisms
- User experience and interaction patterns
- Business rules and constraints (as user-facing effects, not implementation)
- Success criteria from user's perspective
- Scope boundaries of what users can/cannot do
</HARD-RULE>

## Design Principles

1. **Triage first** — Split requirements into core path and iteration pool before going deep.
2. **Depth adapts** — Analyze complexity determines analysis depth. Simple needs → light touch. Complex needs → deep dive. Use judgment, not checklists.
3. **Minimize interruptions** — Batch related confirmations. One confirmation beats two.
4. **Core path first** — Complete the core loop end-to-end; iteration pool items wait for the next cycle.
5. **Completeness bias** — 默认认为还有遗漏。每轮结束前自问"还能补什么"。

## 自助调研

prd command 阶段 0 已做过 6 类信息源调研。brainstorm 在每个里程碑起手时**增量**复盘,重点补查 brainstorm 独有的:

- **代码库**（`projects/`、`src/`、`packages/`）— 现有功能、命名习惯,发现"用户已经能做到的"避免重复需求

**调研产出**:每个里程碑开头产出一段"调研摘要"(3-8 条短句),记下发现的事实和复用项,**这是后续不重复问用户的根据**。

## Process Flow

```
Analyze context → Snapshot (problem + triage)
  → Fast path (clear + simple): one confirmation → closure
  → Standard path: Focus → Approaches & Closure → handoff to prd/build-spec
```

**终止信号**(任一满足即停,**不产文档,交回 prd command**):
- 用户对当前方案无新增疑问,且连续 2 次回复为确认/补充细节
- 关键假设均已由 codebase 事实或用户明确陈述覆盖(逐条标注来源)
- 用户主动说"可以了/往下走/固化吧"

**与"应该继续问"的区分**:终止信号是"问不出新东西",不是"问过一轮就停"。如果还有边界/异常/角色/场景没覆盖,即使没人提质疑,也要继续问。

## Input Clarity Reference

Don't mechanically score — use judgment:

- Is the problem explicitly stated?
- Are target users and scenarios identifiable?
- Is there a concrete feature or workflow described?
- Can success criteria be inferred?
- Are constraints known or clearly not applicable?

Clearer input → move faster. Vague input → invest in shared understanding first.

## Thinking Toolbox

Reference tools, not mandatory steps. AI picks what's useful and skips what's not。**每个工具的目的 = 从一个角度挖出可能被遗漏的需求**。

### Lens 1: Jobs-to-be-Done (JTBD)

**目的**:把"功能"翻译成"用户任务",让 spec 写的是行为而不是按钮。

Ask: **"用户'雇佣'这个功能来完成什么任务?"**

- ❌ "需要一个搜索功能" → ✅ "用户需要在不记住文档位置的情况下,快速找到上次看过的内容"
- ❌ "需要权限管理" → ✅ "用户需要控制 AI 能碰哪些文档,否则不敢接入"

### Lens 2: Pain-Gain Mapping

**目的**:挖出功能维度之外的情感/社交需求(这类需求最容易在 spec 里漏掉)。

| | Pain | Gain |
|---|---|---|
| **Functional** | 需要手动复制粘贴文档内容 | AI 直接读取,不用离开工作流 |
| **Emotional** | 担心 AI 改乱文档,不敢授权 | 放心授权,因为能看到 AI 改了什么、能撤销 |
| **Social** | 团队不知道 AI 改了什么 | 团队成员清楚看到每步操作来源 |

### Lens 3: First-Time User Test

**目的**:挖出"上手门槛"类需求(文档/引导/错误恢复),spec 不写就是上线后用户卡住。

1. **3-second test**: Can they tell what this does?
2. **First-action test**: Can they complete one task without help?
3. **Error recovery test**: When something fails, can they figure out what to do next?

### Lens 4: Worst-Day Scenario

**目的**:挖出 happy path 之外的失败/异常需求(这类需求漏一个就是一个线上事故)。

1. **What's the WORST thing that could happen to the user?** (data loss, wrong doc changed, permission leak)
2. **How would the user discover it happened?** (immediately? or later by accident?)
3. **What can they do about it?** (undo? contact support? nothing?)

### Lens 5: Day-in-the-Life Walkthrough

**目的**:挖出时序/协作/跨角色需求(单角色视角下看不到)。

```
09:00  Developer opens Claude Code, starts working
09:05  "Check the PRD" → AI pulls Wiki doc
11:30  Coding done, "Update API changes to Wiki"
11:31  → AI updates doc, user moves on
14:00  PM sees doc changed on Wiki, finds AI changed wrong section
14:01  → PM one-click rollback
```

### Lens 6: Capability Discovery

**目的**:挖出"用户如何发现/记起"类需求(可发现性漏 = 用户根本不知道功能存在)。

Ask: **"用户怎么知道这个功能存在?怎么知道下一步该做什么?"**

- User just got a new tool. How do they discover what it can do?
- User finished one task. How do they know what else is possible?
- User is stuck. How do they figure out the right command/action?

## Milestones

### Milestone 1: Snapshot

**Goal**: Understand the full picture and triage requirements.

**Pre-step: 增量自助调研**(重点查业务领域术语、用户角色定义、已有同类 spec)

**Completion criteria**:
- Problem reframed (JTBD statement)
- Requirements split into core path and iteration pool
- 核心路径判断的**预设已用调研证据标注来源**

**How to triage**: For each requirement, ask "if we don't do this, can core users still complete their core tasks?"
- "Can't use it at all" or "core loop breaks" → core path
- "Usable but not great" → iteration pool

**Fast path trigger**: When AI judges the input is clear and needs are simple enough → one confirmation, then closure.

**Core Principles** (apply throughout all milestones):
- **Termination condition** = 见 Process Flow 终止信号
- **Recommend before asking** — provide your recommended answer as the first option
- **Codebase-first answering** — if a question about existing features could be answered by searching the codebase, search first
- **Completeness bias** — 默认认为还有遗漏,每轮结束前自问"还能补什么"
- **4 check points gating** — C1 目标价值 / C2 核心流程 / C3 疑问点 / C4 总流程 中不通过的项不能跳到下一阶段

---

### 疑问点清单（C3 跟踪机制,贯穿 M1-M3）

**M1 起手就建立并持续维护**。不建立 = 用户到固化时才发现 AI 偷偷假设了一堆。

| # | 疑问 | 来源 | 状态 |
|---|------|------|------|
| 1 | <AI 拿不准的预设> | M1 | 待确认 / 已自助解决(附证据) / 显式未决 |

**状态流转**:
- **待确认**:列入下次 AskUserQuestion 主动问;**不要静默假设**
- **已自助解决**:附证据(CLAUDE.md X 行 / docs/X 文档 / 已有 spec Y)—— C4 时用户可批量推翻
- **显式未决**:进入"Out of Scope"或"未决项"区,固化时显式标注

**触发条件**(出现任一即记一条):
- AI 拿不准、有多种合理解释
- 调研摘要里没找到证据
- 用户的话前后矛盾或模糊
- Challenge 挑战后用户没给清晰答案
- 边界/异常场景的取舍无依据

---

### Milestone 2: Focus

**Goal**: Build complete understanding of core path requirements + **enumerate boundaries/exceptions** (挖全 + 分类)。

**Pre-step: 增量自助调研**(补查:核心用户角色的现有行为、上下游依赖、相关 spec) + **疑问点清单 review**

**Completion criteria**:
- Business goals and success metrics defined (C1 已通过)
- Core user journeys mapped (with pain points and opportunities)
- Impact scope identified (affected features, processes, roles)
- Priority determined (MoSCoW for core path only)
- **边界/异常清单**: 用 Lens 4 / Lens 3 挖出所有 happy path 之外的边界场景和异常场景,每条一句话,**已分配 MoSCoW 优先级**
- **疑问点清单**: 全部"待确认"项已结案
- **M2 Snapshot 已更新**

> **M2 / M3 边界分工**:M2 解决"有没有"——挖出所有边界/异常,入清单,分优先级;M3 解决"嵌哪、对不对"——把 M2 清单嵌入业务循环图,验证闭合。**M2 漏了的话回到 M2 补,不是 M3 重新挖**。

**Toolbox** (pick what's useful, skip what's not):
- 5 Whys / Pain-Gain / User Journey / Day-in-the-Life / Worst-Day / Impact Analysis / First-Time User / Capability Discovery
- **Boundary Mining** (本阶段必用) — Worst-Day 失败 + 边界值 + 异常流,产出可分类的边界/异常清单
- MoSCoW — Must/Should/Could/Won't for core path requirements **+ 边界/异常**

**Adaptive depth**: Simple needs → light analysis, one confirmation. Complex needs → deeper analysis, multiple rounds.

---

### Milestone 3: Approaches & Closure

**Goal**: Propose viable approaches and **embed M2 boundaries into the business loop, validate closure**.

**Pre-step: 增量自助调研**(补查:行业同类方案、已有技术约束) + **疑问点清单 review**(M2 留下的"待确认"项必须在本里程碑结案) + **M2 边界/异常清单 review**(作为 closure 验证输入,不重挖)

**Completion criteria**:
- 2-3 business approaches proposed (including "do nothing"), with user experience differences explained
- User selected a direction
- Business loop validated: trigger → execution → result → follow-up → close/loop-back
  - Each step checked: who operates, who needs to know, what if it fails, what configuration is needed
  - **每节点的边界/异常已嵌入**:M2 清单每条都能找到归属节点(嵌入或显式标"不适用")
  - **每条边界/异常的归属都能闭合**:嵌入后,该节点能完整处理,不会"卡死"或"丢球"
- Adversarial evaluation done
- **M2 清单全量已处理**:每条有"嵌入节点"或"显式不适用"结论,无悬空
- Major defects addressed (if any)
- **疑问点清单**: 全部结案
- **M3 Snapshot 已更新**

**Toolbox**: Closure walkthrough / Adversarial evaluation / Need Gate(见 rules/)

**If major defects found**: go back to approach selection, don't proceed with a broken plan.

#### ⛳ C2 Gate: 核心流程(Closure 末尾必做,C4 之前)

**不通过不能进入 C4**。

向用户确认主流程(已含 M2 边界/异常嵌入):
- **节点**:触发 → 执行 → 结果 → 后续 → 闭环
- **每节点业务规则**:谁操作、谁需要知道、失败如何处理、配置如何管理
- **每节点边界/异常**:M2 清单的每条边界/异常是否在该节点有归属
- **方向选择**:选哪条 approach

**GATE 触发规则**(同 C1):确认/继续→通过;修改→重做;无回复→重复1次后暂停。

**通过后**:把核心流程图(含边界)记录到 sources.md 的 Check 结论 区(C2 项);更新 M3 Snapshot。

#### ⛳ C4 Gate: 总流程(M3 末尾必做,固化前最后一道)

**不通过不能进入固化**。

向用户展示**完整 spec 全景**:

| 项目 | 内容 |
|------|------|
| 场景清单 | 核心路径 + 边界 + 异常,每条一句话 |
| 优先级 | Must/Should/Could/Won't (MoSCoW) |
| 未决项 | 显式未决(建议 Out of Scope) |
| 疑问点 | C3 清单的全量状态 |
| 范围声明 | In Scope / Out of Scope |
| 成功指标 | C1 定的指标 |

**GATE 触发规则**(同 C1)。

**通过后**:把 C4 结论记录到 sources.md 的 Check 结论 区(C4 项);全 M1-M3 Snapshot 已固化,build-spec 阶段可消费。

---

### 动态调整(贯穿全程)

- **新发现的边界/异常** → 补到 M2/M3 的场景清单,触发新一轮 C3 review
- **前提被推翻**(如发现已有同类功能)→ 回到 M1 重新 triage
- **用户临时加需求** → 列入 M1 triage,决定进核心路径还是迭代池
- **用户推翻前面 check(C1/C2/C4)的结论** → 回到对应里程碑重做,不静默覆盖
- **发现现有 spec 矛盾** → 在 C4 中显式列出,由用户决定

---

### Handoff — 生成 sources.md(不产 spec.feature,但产母本)

里程碑 3 完成、终止信号命中 → **不产 spec.feature**,prd command 加载 build-spec 固化。

**Handoff 产出 = `spec/sources.md` 草稿**(唯一外部化产物)。sources.md 是外部化清单,作 build-spec 翻译 checklist,与 spec.feature 双向绑定。

**sources.md 草稿内容**:
- Feature 元信息 / Check 结论(追溯锚点)
- 阶段快照(Stage Snapshot) — 借鉴 zcode Context Snapshot,每阶段完成时更新 M1/M2/M3 Snapshot
- 需求清单 REQ 表(REQ-ID / 描述 / 类别 / MoSCoW / 来源 / 归属)
- 未决项区

**REQs 来源映射**(保证每条都有出处,防"凭空"):
- REQ 来源 = M1 triage / M2 用户旅程的每一步 / M2 边界/异常清单的每条 / M3 closure 嵌入的每条边界 / C3 显式 Out of Scope 的每条(类别 oos)

**自检**(Handoff 之前必做):
- M1 / M2 / M3 Snapshot 都已更新
- 需求清单条数 = M2 用户旅程步骤数 + M2 边界/异常清单条数 + 显式 oos 条数
- 每条 REQ 有 REQ-ID / 描述 / 类别 / MoSCoW / 来源
- 未决项区不空

漏 sources.md 草稿 = 不能 Handoff,回到 M3 补。

### Need Gate / Challenge Protocol

完整定义见 `rules/challenge-protocol.md`(单一事实源)。Need Gate 在固化前挑"伪需求";Challenge 在固化前挑"错误假设"。
