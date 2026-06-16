# Challenge Protocol

Challenge is not a filter — it is a **clarification behavior** that helps the user see their own assumptions more clearly. Empty or vague questioning is forbidden.

## Need Gate (Clarification Checkpoint)

具体特性 crystallize 时触发（M2-M3）,不针对初始模糊想法。目的是确认解对问题,不是拒绝。

### Check 1: Simpler Alternative (Occam's Razor)

Before building anything new, check if existing tools already solve the problem.

**Search strategy** (execute at least 2 of these):
1. **Codebase keyword search** — search for the feature name, related verbs, and domain terms
2. **Pipe composition check** — can existing commands be combined (e.g., `grep <keyword> spec/`)?
3. **Configuration / standard tools** — can existing functionality or platform tools (grep, jq, fzf) meet the need?

If a simpler alternative exists → propose it. If the user needs a better experience than the alternative provides, that's a valid reason to proceed — but the discussion shifts from "new feature" to "experience upgrade over [existing tool]."

### Check 2: Real Need (XY Detection)

Users often ask for X when they really need Y. Before challenging X, **confirm Y with the user** (only after self-service lookup is exhausted):

1. Identify what the user asked for (X)
2. Hypothesize the underlying goal (Y)
3. **Self-service first**: search `docs/` / 业务知识库 / 用户反馈记录 / `process-docs/` — Y may already be documented. If found, present it as a hypothesis with evidence: "我在 docs/xxx 看到 Y 是这样,这是你想要的吗?"
4. Only if no evidence: ask the user "I understand your core need is [Y] — is that right?"
5. Only after Y is confirmed: assess whether X is the best path to Y

Do NOT challenge based on an unconfirmed Y hypothesis — a wrong guess wastes everyone's time.

### Check 3: Timing

"Why now instead of later?"

- If the cost of deferring is low (no blocked users, no architectural window closing) → suggest deferring until real demand emerges
- If there's a concrete deadline, dependency, or compounding cost → the timing is justified

### User Override

If the user insists on proceeding after hearing the gate's findings: **accept immediately**. 记录:发现 / 用户理由 / 风险,带进 handoff;不再质疑。The user's decision is final.

## Challenge Tools

These tools operate during Focus (SKILL.md Milestone 2) and Approaches & Closure (Milestone 3).

| Tool | When to Use | Trigger Condition | Termination Condition |
|------|-------------|-------------------|----------------------|
| **5 Whys** | Milestone 2 — drill into root cause（M1 仅在 triage 遇根因模糊时临时用）| User states a surface-level symptom or vague pain point | Root cause identified, OR 连续 2 次回答指向同一根因 |
| **XY Problem Detection** | Milestone 1 / 2 — ongoing use after Need Gate | User's stated goal and actual need seem misaligned | User confirms the actual underlying problem, OR provides clear rationale for the specific solution |
| **Assumption Flip** | Milestone 2 / 3 — validate critical assumptions | User presents a scenario that depends on an unverified assumption | Assumption confirmed by evidence, OR overturned and scenario adjusted |
| **Stress Test** | Milestone 2 / 3 — expose hidden risks in scenarios | User seems satisfied with a scenario without considering edge cases | All identified edge cases addressed, OR user explicitly accepts residual risk |

## Fact-Driven Principle

Every challenge must cite one of three evidence types:

1. **Codebase facts** — existing user-facing behaviors, performance observations, configuration 现状（引用现状作证据，不作新设计）
2. **Logical consistency** — internal contradictions, circular reasoning, or gaps in the user's own argument
3. **Domain common sense** — widely accepted knowledge in the relevant technical or business domain

> 证据**来源**不限视角，但 challenge 的**提问与结论必须落在用户视角**：性能数据要翻译成"用户感受到什么"才进入讨论，不讨论实现方案（架构/API 选型是 dev 阶段的事，brainstorm 禁区）。**为什么**：challenge 结论最终要进 spec 的 GWT,Then 必须可观察、可验证——只有用户视角的结论能直接写断言。

For greenfield projects (no existing codebase), rely on logical consistency and domain common sense. The absence of code does not excuse challenges from providing evidence.

## Challenge Tone

Challenges must be **rationally prudent**, not hostile. Every challenge follows this structure:

1. **State the observation** — what was said or assumed
2. **Present the evidence** — cite a specific fact from the three evidence types
3. **Pose the question** — ask what the implication is

Example: "你提到要做缓存解决卡顿。用户反馈的卡顿出现在哪个操作？（若无人反馈卡顿 → 需求真实性与时机存疑；若有 → 聚焦'用户在哪个操作感到慢'）"

## Occam's Razor (Standing Principle)

Need Gate 之外,Occam's Razor 是 brainstorm 全程通用原则:能用简单解释覆盖就不引入复杂方案,有疑就问"有没有更简单的方式"。
