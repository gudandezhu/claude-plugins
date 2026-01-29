---
name: prompt-enhancer
description: Enhance and optimize prompts using best-practice frameworks like BROKE, RTF, TRACE, COSTAR, etc. Analyzes requirements and selects the optimal framework.
version: 1.0.0
argument-hint: [your prompt or requirement]
---

# Prompt Enhancer

Enhance and optimize prompts using established prompt engineering frameworks.

## Instructions

When this command is invoked, follow the prompt-enhancer skill to:

1. **Analyze** the user's input to identify:
   - Task type (quick/creative/technical/educational/complex/general)
   - Target audience
   - Output needs
   - Context completeness

2. **Select** the most appropriate framework based on the task type:
   - Quick tasks → R.T.F or TAG
   - Creative writing → C.O.S.T.A.R
   - Technical tasks → B.R.O.K.E or T.R.A.C.E
   - Educational/teaching → C.R.E.A.T.E
   - Complex projects → S.C.I.P.A.B
   - General scenarios → 5W1H or ICIO
   - Role-playing → A.S.P.E.C.T

3. **Enhance** the prompt by applying the selected framework structure

4. **Output** in the specified format:
   - Requirement Analysis (task type, objectives, recommended framework, rationale)
   - Enhanced Prompt (framework structure + complete prompt)
   - Enhancement Notes (added elements, improvements, recommendations)

5. **Follow safety boundaries**:
   - Refuse illegal/harmful content
   - Preserve user's core intent
   - Avoid over-optimization
   - Add disclaimers for medical/legal/financial/security topics

## Usage Examples

```
/prompt-enhancer write a python function to calculate fibonacci
/prompt-enhancer create a marketing email for a SaaS product
/prompt-enhancer design a user authentication system
/prompt-enhancer help me optimize this prompt about React hooks
```

## Supported Frameworks

- **R.T.F** - Role, Task, Format (Quick tasks)
- **B.R.O.K.E** - Background, Role, Objectives, Key Results, Evolve (Technical)
- **C.O.S.T.A.R** - Context, Objective, Style, Tone, Audience, Response (Creative)
- **T.R.A.C.E** - Task, Requirements, Actions, Context, Evaluation (Technical)
- **C.R.E.A.T.E** - Context, Role, Expectations, Actions, Tone, Examples (Teaching)
- **TAG** - Task, Action, Goal (Simple)
- **S.C.I.P.A.B** - Situation, Complication, Implication, Position, Action, Benefit (Complex)
- **5W1H** - Who, What, When, Where, Why, How (General)
- **ICIO** - Instruction, Context, Input Data, Output Indicator (Data)
- **A.S.P.E.C.T** - Actor, Scenario, Product, Expectations, Context, Tone (Role-play)

## Notes

- This command invokes the prompt-enhancer skill
- The skill also auto-triggers when users ask to "enhance my prompt", "optimize this prompt", etc.
- Reference the skill for detailed framework explanations and edge case handling
