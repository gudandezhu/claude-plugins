---
created: "{{DATE}}"
author: "{{AUTHOR}}"
status: Draft
---

# Proposal: {{PROPOSAL_TITLE}}

## Problem

<!-- State the core problem in one unambiguous sentence. Two readers should interpret it the same way. -->

### Evidence
<!-- Data, user feedback, or concrete examples proving this problem exists. Avoid "we think..." — cite specifics. -->

### Urgency
<!-- Why solve this now? What happens if we don't? What's the cost of delay? -->

## Proposed Solution

<!-- High-level approach. What will be built? What does the end user experience? -->

### Innovation Highlights

<!-- How does this solution differ from or improve upon industry-standard approaches?
What's the creative insight? What ideas are borrowed from other domains?
Keep it honest — if the approach is straightforward adoption of a standard, say so and explain why. -->

## Requirements Analysis

### Key Scenarios
<!-- List the main user scenarios this feature must handle:
- Happy path scenarios
- Edge cases and boundary conditions
- Error scenarios and failure modes
-->

### Non-Functional Requirements
<!-- Relevant NFRs: performance, security, compatibility, accessibility, scalability, etc.
Skip NFRs that are clearly not relevant — don't pad. -->

### Constraints & Dependencies
<!-- External systems this depends on (as user-visible interfaces, not implementation)
User-facing constraints (platform, compatibility, performance expectations)
Prerequisite conditions that must be met
-->

## Alternatives & Industry Benchmarking

### Industry Solutions

<!-- How is this type of problem typically solved in the industry?
Reference specific products, open-source projects, or published patterns. -->

### Comparison Table

| Approach | Source | Pros | Cons | Verdict |
|----------|--------|------|------|---------|
| Do nothing | — | <!-- cost of inaction --> | <!-- --> | Rejected: <!-- why --> |
| <!-- industry standard --> | <!-- product/pattern name --> | <!-- --> | <!-- --> | <!-- --> |
| <!-- alternative approach --> | <!-- source --> | <!-- --> | <!-- --> | <!-- --> |
| **Chosen approach** | <!-- --> | <!-- --> | <!-- --> | **Selected: <!-- why -->** |

## Feasibility Assessment

### Technical Feasibility
<!-- Are there known user-facing constraints (platform, browser, device, performance) that affect feasibility? NOT about tech stack choices. -->

### Resource & Timeline
<!-- Does the team have the skills? Is the scope realistic for the timeline? -->

### Dependency Readiness
<!-- Are external APIs/services available and stable? Are upstream prerequisites in place? -->

## Assumptions Challenged

| Assumption | Challenge Tool | Finding |
|------------|---------------|---------|
| <!-- state the assumption that was tested --> | <!-- 5 Whys / XY Detection / Assumption Flip / Stress Test / Occam's Razor --> | <!-- Confirmed / Overturned / Refined: what the challenge revealed --> |

## Scope

### Core Path（核心路径 — 本轮交付）
- <!-- 不做则整体不成立的需求。去掉任何一个，核心用户无法完成核心任务或业务闭环断裂 -->

### Iteration Pool（迭代池 — 后续轮次处理）
- <!-- 做不好不致命的需求。每条含：需求描述 + 推迟原因 -->

### Out of Scope
- <!-- 明确不属于本次的需求 -->

## Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| <!-- --> | <!-- H/M/L --> | <!-- H/M/L --> | <!-- actionable mitigation --> |

## Success Criteria

- [ ] <!-- Each criterion must include a number, percentage, or observable behavior that can be objectively verified -->

## Next Steps

- 将本 proposal 喂给 `/god:prd` 转为 `spec.feature`（living-spec 产物是 spec，不是传统 PRD 文档）
