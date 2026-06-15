# Deep Research Skill

双模式调研方法论：**广度调研**（探索全貌）和**窄范围深度调研**（评估/对比具体技术或产品）。

<HARD-GATE>
Do NOT write any code or take implementation action. This skill produces a research document only.
</HARD-GATE>

## Core Principle

**Never generate content based solely on general knowledge.** Research quality = evidence quality + source diversity. A single search query is NEVER enough.

---

## Phase 1: Clarify Needs

Use `AskUserQuestion` to confirm scope. Max 2 rounds, 4 questions per round.

<HARD-RULE>
Use `AskUserQuestion` for all questions. Parameters prefill answers where applicable — skip questions the user already answered via args.
</HARD-RULE>

**Round 1 (2-3 questions):**

| # | Question | When to skip |
|---|----------|-------------|
| Q1 | 调研模式：**广度调研**（了解领域全貌）还是**窄范围深度调研**（评估/对比具体技术）？ | Always ask |
| Q2 | (If 窄范围) 单技术深挖 or 多候选对比？对比的话，哪些候选？ | Skip if user already specified |
| Q2' | (If 广度) 你最关注哪些方面？ | Always ask |
| Q3 | 简述你的调研目标 — 这份调研要回答什么问题？ | Always ask |

**Round 2 (only for 窄范围模式):**

| # | Question | Format |
|---|----------|--------|
| Q4 | 选择调研维度（multiSelect）— 从 `ref/research-dimensions.md` 加载对应维度集，core 维度预选 | AskUserQuestion with multiSelect |
| Q5 | 是否包含项目适配评估？（扫描当前代码库分析影响） | AskUserQuestion single select |

After Phase 1, you should have: mode, scope, dimensions (窄范围), and whether project context is needed.

---

## Phase 2: Execute Research

根据 Phase 1 确认的模式，走不同方法论。

### Mode A: 广度调研

适用于：了解一个领域/主题/趋势的全貌。

**4 阶段方法论：**

#### Stage 1: Broad Exploration

1. **Initial Survey**: WebSearch main topic → understand overall context
2. **Identify Dimensions**: From results, identify key subtopics, themes, angles
3. **Map the Territory**: Note different perspectives, stakeholders, viewpoints

```
Topic: "AI in healthcare"
Initial searches:
- "AI healthcare applications 2026"
- "artificial intelligence medical diagnosis"
- "healthcare AI market trends"

Identified dimensions:
- Diagnostic AI (radiology, pathology)
- Treatment recommendation systems
- Administrative automation
- Patient monitoring
- Regulatory landscape
- Ethical considerations
```

#### Stage 2: Deep Dive

For each important dimension:
1. **Specific Queries**: WebSearch with precise keywords
2. **Multiple Phrasings**: Different keyword combinations
3. **Fetch Full Content**: Use `mcp__web_reader__webReader` on important sources
4. **Follow References**: Search for resources mentioned in sources

#### Stage 3: Diversity & Validation

| Information Type | Purpose | Example Searches |
|-----------------|---------|------------------|
| **Facts & Data** | Concrete evidence | "statistics", "data", "market size" |
| **Examples & Cases** | Real-world applications | "case study", "example", "implementation" |
| **Expert Opinions** | Authority perspectives | "expert analysis", "interview" |
| **Trends & Predictions** | Future direction | "trends 2026", "forecast" |
| **Comparisons** | Context and alternatives | "vs", "comparison", "alternatives" |
| **Challenges & Criticisms** | Balanced view | "challenges", "limitations" |

#### Stage 4: Synthesis Check

- [ ] Searched from at least 3-5 different angles?
- [ ] Fetched and read the most important sources in full?
- [ ] Have concrete data, examples, and expert perspectives?
- [ ] Explored both positive aspects and challenges/limitations?
- [ ] Information is current and from authoritative sources?

**If any answer is NO, continue researching.**

### Mode B: 窄范围深度调研

适用于：评估单一技术/产品，或对比多个候选方案做选型决策。

**Adaptive multi-source research.** Agent decides how many search rounds based on information convergence.

<HARD-RULE>
**Convergence rule**: Stop researching a topic when 2 consecutive search rounds yield no substantively new information. Do not cap rounds artificially — trust the convergence signal.
</HARD-RULE>

**Information sources (priority order):**

1. **Official documentation** — Fetch official docs, README, getting-started guide
2. **Community & ecosystem** — WebSearch for comparisons, benchmarks, community sentiment, adoption trends
3. **Codebase scan** (if Q5 = yes) — Use Glob/Grep/Agent(Explore) to find related code, dependencies, patterns
4. **Mid-research clarification** — If critical ambiguity blocks progress, AskUserQuestion (max 2 mid-research questions)

**Research execution pattern:**

For each dimension confirmed in Phase 1:
1. Search official sources for authoritative information
2. Search community sources for real-world experience and benchmarks
3. Cross-reference claims across sources — flag contradictions
4. Record findings with source URLs for citation

For comparison mode specifically:
- Research each candidate independently before comparing
- Ensure all candidates are evaluated on the same dimensions
- Flag dimensions where information is unavailable for a candidate

---

## Phase 3: Output Report

### Mode A: 广度调研报告

自由结构，按发现的维度组织。必须包含：
- 一段话概述（读者不读后续也能得到答案）
- 每个维度的深入分析，附 inline citation `[citation:Title](URL)`
- Challenges & Risks 段落
- Sources 列表

保存到 `docs/research/<slug>.md`。

### Mode B: 窄范围深度调研报告

1. Read `templates/research-report.md` for the report structure.
2. Write the report to `docs/research/<slug>.md`.
3. Key points:
   - **Overview** must contain a one-line conclusion
   - **Comparison mode** includes a horizontal comparison matrix table
   - **Project adaptation assessment** is optional (only when Q5 = yes)
   - All factual claims must cite sources

### Common for both modes

4. Present the report to the user.
5. Ask: **"是否要将本次调研结合其他需求，转为提案？如需要，可运行 /brainstorm"**

<HARD-RULE>
Do NOT commit automatically. Present the report and let the user review first.
</HARD-RULE>

---

## Search Strategy (Both Modes)

### Effective Query Patterns

```
# Be specific with context
❌ "AI trends"
✅ "enterprise AI adoption trends 2026"

# Include authoritative source hints
"[topic] research paper"
"[topic] McKinsey report"
"[topic] industry analysis"

# Use temporal qualifiers — always use the ACTUAL current year from <current_date>
"[topic] 2026"   # ← replace with real current year, never hardcode a past year
```

### Temporal Awareness

| User intent | Precision | Example query |
|---|---|---|
| "today / just released" | **Month + Day** | `"tech news February 28 2026"` |
| "this week" | **Week range** | `"technology releases week of Feb 24 2026"` |
| "recently / latest" | **Month** | `"AI breakthroughs February 2026"` |
| "this year / trends" | **Year** | `"software trends 2026"` |

### When to Use mcp__web_reader__webReader

- A search result looks highly relevant and authoritative
- You need detailed information beyond the snippet
- The source contains data, case studies, or expert analysis

---

## Common Mistakes

| Mistake | Correction |
|---------|------------|
| Stopping after 1-2 searches | Continue until convergence or quality bar met |
| Summarizing only first page of search results | Cross-reference multiple sources, seek primary evidence |
| Writing marketing copy instead of analysis | Present trade-offs honestly; every strength has a cost |
| Skipping official docs in favor of blog posts | Always start with official documentation |
| Researching candidates on different dimensions | Compare on the same axes; note gaps explicitly |
| Producing a generic report detached from user's context | Anchor findings to the user's stated goal (Q3) |
| Using outdated information when current data exists | Check `<current_date>` before forming queries |
