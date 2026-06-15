---
name: brainstorm
user-invocable: false
description: Use when a user has a vague idea or feature request and needs to explore it before formalizing into a PRD. Triage requirements into core path and iteration pool before deep-diving. Outputs a structured proposal document.
argument-hint: "[idea or feature description]"
---

# Brainstorm

> **living-spec 定位**：本 skill 是 `/god:prd` command 加载的**探索 skill**。产出 proposal（需求决策），不产 spec；proposal 进入 `/god:prd` 固化为 `spec.feature`。也可独立用于纯需求探索。

From vague idea to structured proposal, through relentless collaborative dialogue.

**Core principle**: Help the user clarify what they truly need through structured dialogue. The goal is shared understanding — not filtering ideas, but making implicit assumptions explicit so the right path becomes obvious. Pseudo-requirements die naturally when the thinking is clear.

<HARD-GATE>
Do NOT write any code or take implementation action. This skill produces a proposal document only.
</HARD-GATE>

<HARD-RULE>
**No technology selection; constraints only.** Describe "what effect to achieve" (performance, platform, security) — not "what tool to implement with" (frameworks, languages, databases, patterns). Technology selection belongs in a later design phase.

**User-perspective boundary**: ALL questions and options must be framed from the user's perspective — what they experience, what workflow they follow, what outcome they get. If a question or option would only make sense to a developer (e.g., "which framework", "what protocol", "CLI tech stack"), it is OUT OF SCOPE for brainstorm.

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

1. **Triage first** — Split requirements into core path and iteration pool before going deep. Don't treat all requirements equally.
2. **Depth adapts** — Analyze complexity determines analysis depth. Simple needs → light touch. Complex needs → deep dive. Use judgment, not checklists.
3. **Minimize interruptions** — Batch related confirmations. One confirmation beats two. Let AI think before asking.
4. **Core path first** — Complete the core loop end-to-end, produce a usable proposal. Iteration pool items wait for the next cycle.

## Process Flow

```
Analyze context → Snapshot (problem + triage)
  → Fast path (clear + simple): generate proposal skeleton → confirm → commit
  → Standard path: Focus → Approaches & Closure → Write → Confirm → Commit
→ Iteration pool remaining? → hint user to continue in next cycle
```

## Input Clarity Reference

Consider these dimensions when judging how much analysis is needed. Don't mechanically score — use judgment:

- Is the problem explicitly stated?
- Are target users and scenarios identifiable?
- Is there a concrete feature or workflow described?
- Can success criteria be inferred?
- Are constraints known or clearly not applicable?

Clearer input → move faster, skip unnecessary analysis.
Vague input → invest in building shared understanding first.
Extreme case: input is clear and needs are simple → jump from Snapshot directly to Write.

## Thinking Toolbox

Reference tools, not mandatory steps. AI picks what's useful and skips what's not.

### Lens 1: Jobs-to-be-Done (JTBD)

Ask: **"用户'雇佣'这个功能来完成什么任务？"**

Transform features into jobs:
- ❌ "需要一个搜索功能" → ✅ "用户需要在不记住文档位置的情况下，快速找到上次看过的内容"
- ❌ "需要权限管理" → ✅ "用户需要控制 AI 能碰哪些文档，否则不敢接入"

JTBD question template: "When [situation], I want to [motivation], so I can [expected outcome]"

### Lens 2: Pain-Gain Mapping

For each user role, fill this grid:

| | Pain (现在的痛苦) | Gain (期望的改善) |
|---|---|---|
| **Functional** | 需要手动复制粘贴文档内容 | AI 直接读取，不用离开工作流 |
| **Emotional** | 担心 AI 改乱文档，不敢授权 | 放心授权，因为能看到 AI 改了什么、能撤销 |
| **Social** | 团队不知道 AI 改了什么，协作混乱 | 团队成员清楚看到每步操作来源 |

This catches emotional and social dimensions that pure feature lists miss.

### Lens 3: First-Time User Test

Imagine someone using this for the **first time, no documentation, no training**:

1. **3-second test**: Can they tell what this does?
2. **First-action test**: Can they complete one task without help?
3. **Error recovery test**: When something fails, can they figure out what to do next?

Apply this to every scenario: "A new user sits down, what's their first 30 seconds like?"

### Lens 4: Worst-Day Scenario

Don't just design for the happy path. For each scenario, ask:

1. **What's the WORST thing that could happen to the user?** (data loss, wrong doc changed, permission leak)
2. **How would the user discover it happened?** (immediately? or later by accident?)
3. **What can they do about it?** (undo? contact support? nothing?)

This drives trust & safety requirements from user experience, not technical specs.

### Lens 5: Day-in-the-Life Walkthrough

Sketch a realistic daily workflow. Not ideal usage — real, messy usage:

```
09:00  Developer opens Claude Code, starts working
09:05  "Check the PRD" → AI pulls Wiki doc
09:10  Developer starts coding based on the doc
11:30  Coding done, "Update API changes to Wiki"
11:31  → AI updates doc, user moves on
14:00  PM sees doc changed on Wiki, finds AI changed wrong section
14:01  → PM one-click rollback
```

This reveals: timing of actions, who else is affected, what happens between interactions, where the user's attention is.

### Lens 6: Capability Discovery

Ask: **"用户怎么知道这个功能存在？怎么知道下一步该做什么？"**

- User just got a new tool. How do they discover what it can do?
- User finished one task. How do they know what else is possible?
- User is stuck. How do they figure out the right command/action?

This catches discoverability gaps that kill adoption.

## Milestones

### Milestone 1: Snapshot

**Goal**: Understand the full picture and triage requirements.

**Completion criteria**:
- Problem reframed (JTBD statement)
- Requirements split into core path and iteration pool
- User confirmed the split

**How to triage**: For each requirement, ask "if we don't do this, can core users still complete their core tasks?"
- "Can't use it at all" or "core loop breaks" → core path
- "Usable but not great" → iteration pool

**Fast path trigger**: When AI judges the input is clear and needs are simple enough to skip deep analysis → generate proposal skeleton directly, single confirmation.

**Core Principles** (apply throughout all milestones):
- **Shared understanding is the termination condition** — keep going until both sides genuinely agree
- **Think from user's chair** — every question must be answerable by someone who USES the product
- **Recommend before asking** — provide your recommended answer as the first option
- **Codebase-first answering** — if a question about existing features could be answered by searching the codebase, search first

**Forbidden vs Required Questions**:

| ❌ Forbidden (technical, developer-only) | ✅ Required (user-perspective) |
|---|---|
| "用什么 API 风格？REST 还是 GraphQL？" | "用户怎么找到想要的文档？" |
| "乐观锁还是 MVCC？" | "两个人同时改一个文档，用户看到什么？" |
| "Token 存哪里？JSON 还是 SQLite？" | "用户配置权限时觉得复杂吗？" |
| "用 WebSockets 还是轮询？" | "用户什么时候需要实时通知？" |
| "搜索用 ES 还是数据库？" | "用户搜索时期望搜到什么？" |
| "CLI 用什么框架？" | "用户记不住命令怎么办？" |

---

### Milestone 2: Focus

**Goal**: Build complete understanding of core path requirements.

**Completion criteria**:
- Business goals and success metrics defined
- Core user journeys mapped (with pain points and opportunities)
- Impact scope identified (affected features, processes, roles)
- Priority determined (MoSCoW for core path only)

**Toolbox** (pick what's useful, skip what's not):
- 5 Whys — use when pain points are vague, skip when root cause is obvious
- Pain-Gain Mapping — functional/emotional/social dimensions
- User Journey Mapping — timeline of behaviors, pain points, opportunities
- Day-in-the-Life / Worst-Day Scenario — realistic scenario walkthrough
- Impact Analysis — upstream/downstream chain reactions, stakeholders, hidden impacts
- First-Time User Test — 3s / first action / error recovery
- Capability Discovery — how users discover features and next steps
- MoSCoW — Must/Should/Could/Won't for core path requirements only

**Adaptive depth**:
- Simple clear needs → light analysis, one confirmation
- Complex ambiguous needs → deeper analysis, multiple rounds of interaction

---

### Milestone 3: Approaches & Closure

**Goal**: Propose viable approaches and validate the business loop.

**Completion criteria**:
- 2-3 business approaches proposed (including "do nothing"), with user experience differences explained
- User selected a direction
- Business loop validated: trigger → execution → result → follow-up → close/loop-back
  - Each step checked: who operates (permissions), who needs to know (notifications), what if it fails (exceptions), what configuration is needed (management)
- Adversarial evaluation done: assumptions challenged, blind spots identified, failure scenarios explored
- Major defects addressed (if any)

**Toolbox**:
- Closure walkthrough — check each step for completeness, identify missing links
- Adversarial evaluation — challenge assumptions, find blind spots, explore failure scenarios
- Need Gate — simpler alternative? real need? why now?

**If major defects found**: go back to approach selection, don't proceed with a broken plan.

---

### Milestone 4: Write & Commit

**Goal**: Produce a structured proposal.

**Completion criteria**:
- Proposal generated using `templates/proposal.md`
- Core path = current scope; iteration pool = future cycles (each with requirement description + deferral reason)
- User confirmed satisfied
- Git add + commit + push done
- If iteration pool has remaining items, user has been informed of next steps

<HARD-RULE>
Do NOT commit automatically. Present to the user and wait for explicit approval.
</HARD-RULE>

### Quality Standards

| Section | Standard | Red Flag |
|---------|----------|----------|
| Problem | Specific statement + evidence + urgency | "We need to improve X" |
| Solution | Concrete user-facing behavior | "Build a system that..." |
| Alternatives | Honest trade-offs including "do nothing" | Straw-man alternatives with only pros |
| Scope | Core path items + iteration pool items with deferral reasons + out of scope exclusions | Vague areas, open-ended |
| Risks | 3+ specific risks with actionable mitigations | "We'll handle it" |
| Success Criteria | Measurable, testable, covers all scope | "Works well" or "Better UX" |

### Need Gate (embedded at every decision point)

As scenarios reveal specific features or capabilities, apply this clarification check **before diving into how to implement each one**. The gate triggers when a concrete feature crystallizes from the discussion — not on the initial vague idea, but on each actionable feature point that emerges.

**Three checks (in order)**:
1. **Simpler alternative?** — Search for existing tools, commands, pipe compositions, or ecosystem utilities that already solve this. If found → propose the simpler path.
2. **Is this the real need?** — Hypothesize the user's underlying goal (Y). Confirm with the user before challenging: "I understand your core need is [Y] — is that right?" Only after confirmation, assess whether X is the best path to Y.
3. **Why now?** — "What happens if we defer this?" If the cost of delay is low → suggest deferring until a real need emerges.

**If the user overrides the gate** (insists on proceeding despite a simpler alternative or deferral suggestion): accept and record `Challenge Override: user chose to proceed. Reason: <user's reason or "not stated">.` in the proposal. Do NOT keep challenging after an override.

For the full protocol including search strategy, Y-confirmation flow, and timing criteria, see `rules/challenge-protocol.md`.

### Challenge Protocol

Challenge is mandatory at every decision point, not a separate step. For the full challenge toolkit, evidence requirements, and tone guidelines, see `rules/challenge-protocol.md`.

**Key rules**:
- Every challenge must cite one of: codebase facts, logical consistency, or domain common sense
- Challenges must be rationally prudent, not hostile: state observation → present evidence → pose question

## After Completion

After committing and pushing the proposal:

- If iteration pool has remaining items → inform the user:
  > 迭代池中还有 N 项需求，可在后续轮次继续讨论或单独处理。
- Iteration pool items can be promoted to core path in subsequent cycles
- Each cycle updates the same proposal document
