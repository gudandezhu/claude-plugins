# Prompt Frameworks Reference

Comprehensive guide to all prompt engineering frameworks supported by the prompt-enhancer skill.

## R.T.F (Role - Task - Format)

**Best for**: Quick tasks, simple requests

**Components**:
- **Role**: Define AI's professional identity or persona
- **Task**: Specify what needs to be accomplished
- **Format**: Define required output format

**Example**:
```
Role: You are a Python developer
Task: Write a function to calculate fibonacci numbers
Format: Provide code with docstring and usage example
```

**Why use it**: Minimal structure, fast to apply, ideal for straightforward tasks

---

## B.R.O.K.E (Background - Role - Objectives - Key Results - Evolve)

**Best for**: Technical tasks, project planning, complex requirements

**Components**:
- **Background**: Provide comprehensive context about the situation
- **Role**: Define AI's expert identity and qualifications
- **Objectives**: List clear, achievable goals
- **Key Results**: Specify expected deliverables and success criteria
- **Evolve**: Define iteration and improvement direction

**Example**:
```
Background: We're building a REST API for a task management application
Role: You are a senior backend architect with 10 years of experience
Objectives:
- Design a scalable API structure
- Include authentication and authorization
- Support CRUD operations for tasks

Key Results:
- Complete API specification with endpoints
- Database schema design
- Security best practices documentation

Evolve: Consider future enhancements like real-time notifications and rate limiting
```

**Why use it**: Comprehensive, outcome-focused, encourages iterative thinking

---

## C.O.S.T.A.R (Context - Objective - Style - Tone - Audience - Response)

**Best for**: Creative writing, content creation, marketing copy

**Components**:
- **Context**: Describe usage scenario and background
- **Objective**: State primary goal clearly
- **Style**: Specify response style (professional/humorous/concise/storytelling)
- **Tone**: Set tone (formal/informal/friendly/authoritative)
- **Audience**: Identify who will see the results
- **Response**: Define expected output format

**Example**:
```
Context: Writing a blog post about AI for a general audience
Objective: Explain machine learning concepts in simple terms
Style: Engaging, storytelling, with relatable analogies
Tone: Friendly, approachable, not overly technical
Audience: Non-technical readers curious about AI
Response: 800-word blog post with headings and examples
```

**Why use it**: Excellent for content requiring specific voice and audience targeting

---

## T.R.A.C.E (Task - Requirements - Actions - Context - Evaluation)

**Best for**: Technical tasks, debugging, code reviews

**Components**:
- **Task**: Define specific work to be done
- **Requirements**: List constraints and specifications
- **Actions**: Break down execution steps
- **Context**: Provide necessary background information
- **Evaluation**: Define quality metrics and success criteria

**Example**:
```
Task: Debug a slow database query
Requirements:
- Must not change query results
- Should reduce execution time by at least 50%
- Must maintain code readability

Actions:
1. Analyze current query execution plan
2. Identify bottlenecks
3. Propose optimization strategies
4. Implement chosen solution
5. Verify results match

Context: PostgreSQL database, 10M rows, query used in dashboard
Evaluation: Measure execution time before and after, verify identical result sets
```

**Why use it**: Process-oriented, emphasizes requirements and quality metrics

---

## C.R.E.A.T.E (Context - Role - Expectations - Actions - Tone - Examples)

**Best for**: Educational content, tutorials, teaching scenarios

**Components**:
- **Context**: Provide background information
- **Role**: Define AI's persona (e.g., "You are an experienced teacher")
- **Expectations**: Detail specific requirements
- **Actions**: List actionable steps
- **Tone**: Set communication style
- **Examples**: Provide reference examples

**Example**:
```
Context: Teaching React hooks to a developer familiar with class components
Role: You are a patient React instructor with 5 years of teaching experience
Expectations:
- Explain useState and useEffect
- Compare with class component lifecycle
- Include common pitfalls

Actions:
1. Introduce the concept of hooks
2. Show useState examples
3. Demonstrate useEffect for side effects
4. Provide comparison with class components
5. Include practice exercises

Tone: Educational, encouraging, with clear explanations

Examples:
- Counter component using useState
- Data fetching with useEffect
- Common mistake: missing dependencies
```

**Why use it**: Learning-focused, includes examples, great for tutorials

---

## TAG (Task - Action - Goal)

**Best for**: Very simple tasks, quick requests

**Components**:
- **Task**: Describe the task
- **Action**: Specify concrete actions
- **Goal**: Define ultimate objective

**Example**:
```
Task: Write a function
Action: Create a Python function that sorts a list
Goal: Get working code I can use immediately
```

**Why use it**: Minimal structure, fastest to apply, for straightforward requests

---

## S.C.I.P.A.B (Situation - Complication - Implication - Position - Action - Benefit)

**Best for**: Complex projects, business proposals, strategic planning

**Components**:
- **Situation**: Current circumstances
- **Complication**: Challenges faced
- **Implication**: Potential impact
- **Position**: Stance to take
- **Action**: Action plan
- **Benefit**: Expected outcomes

**Example**:
```
Situation: Our monolithic application is becoming hard to maintain
Complication: Deployment times have increased to 2 hours, bugs are harder to isolate
Implication: If we don't act, developer productivity will decrease further
Position: We should migrate to a microservices architecture
Action:
1. Identify service boundaries
2. Plan migration strategy
3. Implement proof of concept
4. Gradually migrate services

Benefit: Faster deployments, easier scaling, improved developer experience
```

**Why use it**: Strategic thinking, considers implications and benefits

---

## 5W1H (Who - What - When - Where - Why - How)

**Best for**: General scenarios, comprehensive planning

**Components**:
- **Who**: Role identification
- **What**: Task content
- **When**: Time requirements
- **Where**: Application context
- **Why**: Purpose and rationale
- **How**: Methods and procedures

**Example**:
```
Who: You are a DevOps engineer
What: Set up a CI/CD pipeline
When: Must be completed this week
Where: For our web application hosted on AWS
Why: To automate testing and deployment
How:
- Use GitHub Actions
- Run tests on every push
- Deploy to staging on merge to main
- Manual approval for production
```

**Why use it**: Classic framework, ensures all aspects are covered

---

## ICIO (Instruction - Context - Input Data - Output Indicator)

**Best for**: Data processing, analysis tasks, API integrations

**Components**:
- **Instruction**: Core directive
- **Context**: Background information
- **Input Data**: Reference information, data sources
- **Output Indicator**: Output specification

**Example**:
```
Instruction: Analyze the sales data and create a report
Context: Quarterly sales review for Q4 2024
Input Data:
- CSV file with 50,000 transactions
- Columns: date, product, category, amount, region
Output Indicator: Summary report with charts showing:
- Total sales by category
- Regional performance
- Month-over-month growth
```

**Why use it**: Clear input/output specification, data-focused

---

## A.S.P.E.C.T (Actor - Scenario - Product - Expectations - Context - Tone)

**Best for**: Role-playing scenarios, customer service, training simulations

**Components**:
- **Actor**: Role identity
- **Scenario**: Usage context
- **Product**: Expected deliverable
- **Expectations**: Specific requirements
- **Context**: Supplementary information
- **Tone**: Communication style

**Example**:
```
Actor: You are a senior customer success manager
Scenario: A client is considering canceling their subscription
Product: A retention email or call script
Expectations:
- Address their concerns empathetically
- Offer solutions or alternatives
- Maintain professional relationship
Context: Client has been with us for 2 years, citing budget cuts
Tone: Empathetic, professional, solution-oriented
```

**Why use it**: Strong focus on role and scenario, great for interpersonal tasks

---

## Framework Selection Quick Reference

| Use Case | Framework |
|----------|-----------|
| Quick/simple tasks | TAG, R.T.F |
| Technical implementation | B.R.O.K.E, T.R.A.C.E |
| Creative/Content | C.O.S.T.A.R |
| Teaching/Tutorials | C.R.E.A.T.E |
| Strategic planning | S.C.I.P.A.B |
| Data/Analysis | ICIO |
| Role-playing | A.S.P.E.C.T |
| Comprehensive planning | 5W1H |
