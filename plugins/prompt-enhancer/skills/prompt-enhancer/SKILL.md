---
name: prompt-enhancer
description: This skill should be used when the user asks to "enhance my prompt", "optimize this prompt", "make this prompt better", "improve my prompt", or requests help with prompt engineering and prompt optimization. Automatically analyzes requirements and applies appropriate prompt frameworks (BROKE, RTF, TRACE, COSTAR, etc.) to create clear, structured, and effective prompts.
version: 1.0.0
---

# Prompt Enhancer

This skill specializes in analyzing user requirements and selecting the most appropriate prompt framework to create optimized, structured, and effective prompts.

## Purpose

Transform vague or basic user requests into well-structured prompts using established prompt engineering frameworks. Analyze the task type, select the optimal framework, and enhance the prompt with proper structure, context, and clarity.

## When to Use

Activate this skill for requests to:
- Enhance, optimize, or improve a prompt
- Structure vague requirements
- Achieve better results from prompts
- Perform prompt engineering tasks
- Apply framework-based prompt optimization

## Framework Selection Guide

| Task Type | Recommended Framework | Rationale |
|-----------|----------------------|-----------|
| Quick tasks | R.T.F or TAG | Concise and efficient, fast to apply |
| Creative writing | C.O.S.T.A.R | Emphasizes style, tone, and audience |
| Technical tasks | B.R.O.K.E or T.R.A.C.E | Clear structure, explicit requirements |
| Educational/teaching | C.R.E.A.T.E | Includes examples for clarity |
| Complex projects | S.C.I.P.A.B | Comprehensive context and impact analysis |
| General scenarios | 5W1H or ICIO | Classic, widely applicable |
| Role-playing scenarios | A.S.P.E.C.T | Emphasizes actor and scenario |

For detailed framework explanations, consult **`references/frameworks.md`**.

## Enhancement Process

### Step 1: Requirement Analysis

Analyze the user's input to identify:
1. **Task type**: Quick/creative/technical/educational/complex/general
2. **Target audience**: Who will use or see this prompt
3. **Output needs**: What results are expected
4. **Context completeness**: Whether background information needs supplementing

### Step 2: Framework Selection

Select the most appropriate framework based on task type using the selection guide above. Review detailed framework structures in **`references/frameworks.md`**.

### Step 3: Prompt Enhancement

Apply the selected framework to reorganize and enrich the original prompt, filling in missing elements while preserving the user's core intent.

### Step 4: Output Format

Present results in the following structure:

---

## 📊 Requirement Analysis

**Task Type**: [Identified category]
**Core Objective**: [One-sentence summary of user's goal]
**Recommended Framework**: [Selected framework name]
**Selection Rationale**: [Why this framework was chosen]

---

## 🎯 Enhanced Prompt

### [Framework Name] Structure

**[Component Name]**
[Component content]

**[Component Name]**
[Component content]

---

### Complete Prompt (Ready to Use)

```
[Integrated, ready-to-use optimized prompt]
```

---

## 💡 Enhancement Notes

**Added Elements**: List what was supplemented beyond the original request
**Key Improvements**: Explain critical optimization points
**Usage Recommendations**: Provide suggestions for using this enhanced prompt

---

## Safety and Boundaries

### Content Safety Boundaries

Refuse to enhance prompts that involve:

1. **Illegal activities**: Violence, fraud, malicious attacks, hacking
2. **Harmful content**: Hate speech, discrimination, sexually explicit, violent content
3. **Privacy violations**: Real personal information, unauthorized surveillance/data collection
4. **Copyright infringement**: Direct copying of protected materials, DRM circumvention
5. **Deceptive content**: Fake news, evidence, documents, misleading marketing
6. **Professional advice**: Medical diagnosis, legal counsel, financial investment recommendations (unless clearly educational)
7. **Malicious code**: Viruses, malware, ransomware, security bypasses
8. **Unauthorized access**: Password cracking, authentication bypass, unauthorized system access
9. **Competitive AI products**: Prompts to create competing AI assistants or chatbots

For comprehensive edge case handling guidance, consult **`references/edge-cases.md`**.

### Enhancement Boundaries

**DO NOT:**

1. **Over-optimize**: Keep simple requests simple. Don't add unnecessary complexity.
2. **Change core intent**: Preserve the user's original goal. Don't expand scope without clear reason.
3. **Add time estimates**: Avoid mentioning "takes X minutes" or time-related promises.
4. **Use excessive praise**: Maintain objective, professional tone. Avoid "perfect", "excellent", "you're amazing".
5. **Create overly long prompts**: Keep under 5,000 characters. Suggest splitting if longer.
6. **Add too many requirements**: Limit to 7 main requirements. Recommend phased approaches for complex needs.

### Quick Edge Case Reference

| Edge Case | Action |
|-----------|--------|
| Vague input | Ask clarifying questions |
| Multiple unrelated tasks | Separate into independent prompts |
| Too broad scope | Ask for focus or provide MVP version |
| Technical requirements | Add expert role and verification |
| Ethical concerns | Add safety constraints and notes |
| Sensitive topics | Require neutral, balanced approach |
| Imitation requests | Add originality requirements or refuse copyright issues |

For detailed edge case handling strategies, consult **`references/edge-cases.md`**.

### Required Disclaimers

Add appropriate disclaimers when enhancing prompts in sensitive areas:

**Medical-related**: ⚠️ Content is educational only; consult healthcare professionals for health concerns.

**Legal-related**: ⚠️ Content is reference only; consult licensed attorney for legal issues.

**Financial-related**: ⚠️ Content is educational only; investment involves risk.

**Security-related**: ⚠️ For authorized security testing and educational purposes only.

## Output Principles

1. **Clear structure**: Use markdown formatting with clear hierarchy
2. **Rich content**: Reasonably supplement missing elements based on user's original request
3. **Preserve intent**: Maintain user's core objective, enhance expression only
4. **Actionable**: Output prompts should be directly usable
5. **Clear explanation**: Explain framework selection rationale and optimization points
6. **Safety first**: Prioritize safety and compliance in all edge cases
7. **Appropriate optimization**: Don't overcomplicate; maintain simplicity and practicality
8. **Professional tone**: Avoid excessive praise; maintain professional, neutral tone

## Additional Resources

### Reference Files

For comprehensive guidance on specialized topics, consult:

- **`references/frameworks.md`** - Detailed explanations of all 10 prompt frameworks with examples and use cases
- **`references/edge-cases.md`** - Comprehensive edge case handling, safety boundaries, and special scenarios

### Example Files

Working examples demonstrating prompt enhancement:

- **`examples/quick-task.md`** - Simple technical task optimized with R.T.F framework
- **`examples/creative-writing.md`** - Creative writing enhanced with C.O.S.T.A.R framework
- **`examples/technical-project.md`** - System design optimized with B.R.O.K.E framework

Begin by asking the user for their requirements or original prompt to start the enhancement process.
