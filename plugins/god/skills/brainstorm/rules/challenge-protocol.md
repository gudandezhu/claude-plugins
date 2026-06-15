# Challenge Protocol

Challenge is not a filter — it is a **clarification behavior** that helps the user see their own assumptions more clearly. Every challenge must be grounded in facts (see Fact-Driven Principle). Empty or vague questioning is forbidden.

## Need Gate (Clarification Checkpoint)

Every feature request passes through this gate when a concrete feature crystallizes from the discussion (typically during Focus / Approaches, i.e. SKILL.md Milestone 2-3) to clarify what the user truly needs. The gate is not about saying "no" — it's about making sure we're solving the right problem before investing energy in implementation details. It triggers when a concrete feature crystallizes from the discussion — not on the initial vague idea.

### Check 1: Simpler Alternative (Occam's Razor)

Before building anything new, check if existing tools already solve the problem.

**Search strategy** (execute at least 2 of these):
1. **Codebase keyword search** — search for the feature name, related verbs, and domain terms
2. **Pipe composition check** — can existing commands be combined (e.g., `forge proposal | grep <keyword>`)?
3. **Configuration check** — can existing functionality meet the need through settings or parameters?
4. **Ecosystem check** — are standard tools (grep, jq, fzf, sort) or platform features sufficient?

If a simpler alternative exists → propose it. If the user needs a better experience than the alternative provides, that's a valid reason to proceed — but the discussion shifts from "new feature" to "experience upgrade over [existing tool]."

### Check 2: Real Need (XY Detection)

Users often ask for X when they really need Y. Before challenging X, **confirm Y with the user**:

1. Identify what the user asked for (X)
2. Hypothesize the underlying goal (Y)
3. **Ask the user**: "I understand your core need is [Y] — is that right?"
4. Only after Y is confirmed: assess whether X is the best path to Y

Do NOT challenge based on an unconfirmed Y hypothesis — a wrong guess wastes everyone's time.

### Check 3: Timing

"Why now instead of later?"

- If the cost of deferring is low (no blocked users, no architectural window closing) → suggest deferring until real demand emerges
- If there's a concrete deadline, dependency, or compounding cost → the timing is justified

This catches "we'll eventually need this" requirements that are true but premature.

### User Override

If the user insists on proceeding after hearing the gate's findings: **accept immediately**. Record in the proposal:
```
Challenge Override: user chose to proceed despite <finding>.
Reason: <user's reason or "not stated">.
Potential risk: <one-sentence risk if applicable>.
```

Do NOT re-challenge after an override. The user's decision is final.

## Challenge Tools

These tools operate during Focus (SKILL.md Milestone 2) and Approaches & Closure (Milestone 3). Need Gate uses Occam's Razor and XY Detection as structured checks (see above) — the table below covers their ongoing use plus additional tools.

| Tool | When to Use | Trigger Condition | Termination Condition |
|------|-------------|-------------------|----------------------|
| **5 Whys** | Milestone 2 (Focus) — drill into root cause（M1 仅在 triage 遇根因模糊时临时用）| User states a surface-level symptom or vague pain point | Root cause identified (causal chain reaches a fundamental user-level constraint), OR 连续 2 次回答指向同一根因/触及用户无法再细分的根本约束 |
| **XY Problem Detection** | Milestone 1 (Snapshot) / Milestone 2 (Focus) — ongoing use after Need Gate | User's stated goal and actual need seem misaligned during discussion | User confirms the actual underlying problem, OR user provides clear rationale for why the specific solution is needed |
| **Assumption Flip** | Milestone 2 (Focus) / Milestone 3 (Approaches & Closure) — validate critical assumptions | User presents a scenario that depends on an unverified assumption | Assumption is confirmed by evidence, OR assumption is overturned and scenario is adjusted, OR user provides sufficient domain expertise as evidence |
| **Stress Test** | Milestone 2 (Focus) / Milestone 3 (Approaches & Closure) — expose hidden risks in scenarios | User seems satisfied with a scenario without considering edge cases | All identified edge cases are addressed, OR user explicitly accepts residual risk with documented rationale |

## Fact-Driven Principle

Every challenge must cite one of three evidence types:

1. **Codebase facts** — existing user-facing behaviors, performance observations, configuration 现状（引用现状作证据，不作新设计）
2. **Logical consistency** — internal contradictions, circular reasoning, or gaps in the user's own argument
3. **Domain common sense** — widely accepted knowledge in the relevant technical or business domain

> 证据**来源**不限视角，但 challenge 的**提问与结论必须落在用户视角**：性能数据要翻译成"用户感受到什么"才进入讨论，不讨论实现方案（架构/API 选型是 dev 阶段的事，brainstorm 禁区）。

For greenfield projects (no existing codebase), rely on logical consistency and domain common sense. The absence of code does not excuse challenges from providing evidence.

## Challenge Tone

Challenges must be **rationally prudent**, not hostile. Every challenge follows this structure:

1. **State the observation** — what was said or assumed
2. **Present the evidence** — cite a specific fact from the three evidence types
3. **Pose the question** — ask what the implication is

Example: "你提到要做缓存解决卡顿。用户反馈的卡顿出现在哪个操作？（若无人反馈卡顿 → 需求真实性与时机存疑；若有 → 聚焦'用户在哪个操作感到慢'，而非'用什么缓存方案'——后者是 dev 阶段的事）"

## Occam's Razor (Standing Principle)

Beyond the Need Gate's structured check, Occam's Razor applies as a standing principle throughout the brainstorm:

- If a simple explanation covers the observed problem, do not propose complex alternatives without evidence requiring complexity
- If a straightforward approach meets all success criteria, do not add sophistication without justification
- When in doubt, ask: "Is there a simpler way to achieve the same outcome?"
