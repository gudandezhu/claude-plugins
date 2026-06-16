export const meta = {
  name: 'eval-loop-review',
  description: '单轮量化评审：前置校验 → reviewer subagent 评分。输入: targetPath, rubricName, threshold, skillRoot, deliverables[]',
  phases: [
    { title: 'PreCheck', detail: '交付物存在性校验' },
    { title: 'Review', detail: 'reviewer subagent 量化评分' },
  ],
}

const REVIEW_SCORE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number', description: '总分 0-100' },
    passed: { type: 'boolean', description: '是否达到阈值' },
    dimensions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number' },
          maxScore: { type: 'number' },
          deductions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: '检查项名称' },
                points: { type: 'number', description: '扣分' },
                reason: { type: 'string', description: '扣分原因' },
                suggestion: { type: 'string', description: '改进建议' },
              },
              required: ['item', 'points', 'reason', 'suggestion'],
            },
          },
        },
        required: ['name', 'score', 'maxScore', 'deductions'],
      },
    },
    criticalIssues: { type: 'number', description: 'Critical 级别问题数' },
    importantIssues: { type: 'number', description: 'Important 级别问题数' },
    minorIssues: { type: 'number', description: 'Minor 级别问题数' },
    summary: { type: 'string', description: '评审结论一句话' },
  },
  required: ['score', 'passed', 'dimensions', 'summary'],
}

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const targetPath = _args.targetPath
const rubricName = _args.rubricName || 'default'
const threshold = _args.threshold ?? 90
const reviewContextPath = _args.reviewContextPath || ''
const skillRoot = _args.skillRoot
const deliverables = _args.deliverables || []
const preCheckScript = _args.preCheckScript || ''
const reviewSkillPath = _args.reviewSkillPath || ''
const scopeHint = _args.scopeHint || ''

if (!targetPath) throw new Error('targetPath is required')
if (!skillRoot) throw new Error('skillRoot is required (eval-loop skill directory)')

let rubricPath = `${skillRoot}/references/rubric-${rubricName}.md`
const defaultRubricPath = `${skillRoot}/references/rubric-default.md`
const reviewerTemplatePath = `${skillRoot}/prompts/reviewer.md`

// ── Phase 0: 前置校验（确定性）──
phase('PreCheck')

if (deliverables.length > 0 && preCheckScript) {
  const deliverableArgs = deliverables.map(d => `"${d.desc}|${d.glob}"`).join(' ')
  const preCheckCmd = `bash "${preCheckScript}" "${targetPath}" ${deliverableArgs}`
  const preCheckResult = await agent(
    `执行交付物存在性校验。

运行命令: ${preCheckCmd}

如果命令退出码非 0，输出 preCheckPassed=false 和缺失列表。
如果命令退出码 0，输出 preCheckPassed=true。`,
    {
      label: 'pre-check',
      phase: 'PreCheck',
      schema: {
        type: 'object',
        properties: {
          preCheckPassed: { type: 'boolean' },
          missing: { type: 'array', items: { type: 'string' } },
          output: { type: 'string' },
        },
        required: ['preCheckPassed'],
      },
    },
  )

  if (preCheckResult && !preCheckResult.preCheckPassed) {
    return {
      score: 0,
      passed: false,
      threshold,
      rounds: 0,
      rubricName,
      history: [{ phase: 'preCheck', passed: false, missing: preCheckResult.missing || [] }],
      finalReport: `前置校验失败，缺失交付物: ${(preCheckResult.missing || []).join(', ')}`,
    }
  }

  log(`前置校验通过`)
}

// ── Reviewer Prompt 构造器 ──
function buildReviewerPrompt() {
  const skillSection = reviewSkillPath
    ? `## 专业评审技能（必须先 Read）\n先 Read 评审技能文件，按其指令执行评审：${reviewSkillPath}\n该技能包含专业评审流程和检查规则，必须按其步骤执行。\n\n`
    : ''

  const scopeSection = scopeHint
    ? `## 评审范围限定\n${scopeHint}\n\n`
    : ''

  const step1 = reviewSkillPath
    ? `1. Read 评审技能 ${reviewSkillPath}，按其专业流程执行`
    : `1. Read 模板 ${reviewerTemplatePath}（包含完整评分规则和输出格式）`

  return `你是一个独立评估员。请严格按以下 Rubric 对目标内容进行量化评分。

${skillSection}## 模板文件
先 Read reviewer 模板文件了解完整评分规则：${reviewerTemplatePath}

## 目标内容路径
${targetPath}

## Rubric 路径
${rubricPath}

## 通过阈值
${threshold}

## 额外上下文
${reviewContextPath || '无'}

${scopeSection}## 执行要求
${step1}
2. Read Rubric ${rubricPath} 和目标内容 ${targetPath}
3. 目录则 Glob 后读取所有文件
4. Rubric 如有"前置准备"章节，按其指令操作
5. 如额外上下文路径非空，则 Read 该文件
6. 按 Rubric 逐项评分（通过=满分，部分通过=50%，不通过=0）
7. 汇总得分，结构化输出

## 禁止
- 禁止修改任何文件
- 禁止不读内容就评分
- 禁止给模糊评价
- 只评估，不修复`
}

// ── Phase 1: 单轮 Reviewer subagent 评分 ──
phase('Review')

const reviewResult = await agent(
  buildReviewerPrompt(),
  {
    label: 'reviewer',
    phase: 'Review',
    schema: REVIEW_SCORE_SCHEMA,
  },
)

if (!reviewResult) {
  log(`reviewer subagent 被跳过或失败`)
  return {
    score: 0,
    passed: false,
    threshold,
    rounds: 0,
    rubricName,
    history: [{ phase: 'review', passed: false, skipped: true }],
    finalReport: null,
  }
}

const passed = reviewResult.score >= threshold
log(`评审完成: score=${reviewResult.score}/${threshold} passed=${passed}`)

return {
  score: reviewResult.score,
  passed,
  threshold,
  rounds: 1,
  rubricName,
  history: [{
    round: 1,
    phase: 'review',
    score: reviewResult.score,
    passed,
    dimensions: reviewResult.dimensions,
  }],
  finalReport: JSON.stringify(reviewResult, null, 2),
}
