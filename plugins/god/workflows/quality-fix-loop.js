export const meta = {
  name: 'quality-fix-loop',
  description: '脚本驱动质量检查+修复循环。verify-case-coverage.js + review-case-quality.js → fixer → loop',
  phases: [
    { title: 'Check', detail: '脚本执行覆盖率检查+结构评审' },
    { title: 'Fix', detail: 'agent 修复质量问题' },
  ],
}

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const testingDir = _args.testingDir
const acPath = _args.acPath
const threshold = _args.threshold ?? 80   // 测试案例结构评审分阈值（非代码评审阈值，代码评审用 eval-loop 默认 90）
const maxRounds = Math.min(_args.maxRounds ?? 2, 3)
const scope = _args.scope || 'fullstack'
const coverageScript = _args.coverageScript || ''
const reviewScript = _args.reviewScript || ''
const passScore = _args.passScore ?? 80     // 同 threshold，测试案例维度
const fixSkillPath = _args.fixSkillPath || ''
const degradeThreshold = _args.degradeThreshold ?? 0
const acThreshold = _args.acThreshold ?? 100

if (!testingDir) throw new Error('testingDir is required')
if (!acPath) throw new Error('acPath is required')

const FIX_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'boolean' },
    fixCount: { type: 'number' },
    fixes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          issue: { type: 'string' },
          action: { type: 'string' },
          filesModified: { type: 'array', items: { type: 'string' } },
        },
        required: ['issue', 'action'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['fixed', 'fixCount', 'summary'],
}

let round = 0
let passed = false
let latestCoverageResult = null
let latestReviewResult = null
const history = []

while (round < maxRounds && !passed) {
  round++
  phase('Check')

  let coverageScore = 0
  let reviewScore = 0
  let coverageAction = 'continue'
  let reviewAction = 'continue'
  const issues = []

  // 阶段 1: 覆盖率检查（脚本驱动）
  if (coverageScript) {
    const coverageResult = await agent(
      `执行覆盖率检查脚本（确定性检查，禁止 AI 自行判断）。

运行命令:
node "${coverageScript}" --testing-dir "${testingDir}" --scope ${scope} --threshold ${threshold} --ac-file "${acPath}" --ac-threshold ${acThreshold}

脚本同时输出精简摘要到 ${testingDir}/.cache/coverage-check-summary.json。
Read 该摘要文件，直接返回其全部内容（字段已匹配 schema，无需提取或转换）。`,
      {
        label: `coverage-check-round-${round}`,
        phase: 'Check',
        schema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            action: { type: 'string', description: 'continue | ac-coverage-gap | ac-op-gap | state-transition-gap | embedded-rule-gap | coverage-gap | semantic-gap' },
            missingAc: { type: 'array', items: { type: 'string' } },
            details: { type: 'string' },
          },
          required: ['score', 'action'],
        },
      },
    )

    if (coverageResult) {
      coverageScore = coverageResult.score || 0
      coverageAction = coverageResult.action || 'continue'
      latestCoverageResult = coverageResult

      if (coverageAction !== 'continue') {
        issues.push({
          type: 'coverage',
          score: coverageScore,
          action: coverageAction,
          missingAc: coverageResult.missingAc || [],
        })
      }
    }
  } else {
    // 无脚本时 fallback 到 agent 检查（降级）
    log('警告: coverageScript 未提供，降级为 AI 检查')
    coverageScore = threshold
  }

  // 阶段 2: 结构评审（脚本驱动）
  if (reviewScript) {
    const reviewResult = await agent(
      `执行结构评审脚本（确定性评审，禁止 AI 自行判断）。

运行命令:
node "${reviewScript}" --testing-dir "${testingDir}" --scope ${scope} --pass-score ${passScore}

脚本同时输出精简摘要到 ${testingDir}/.cache/review-check-summary.json。
Read 该摘要文件，直接返回其全部内容（字段已匹配 schema，无需提取或转换）。`,
      {
        label: `review-check-round-${round}`,
        phase: 'Check',
        schema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            action: { type: 'string', description: 'continue | fix | degrade' },
            dimensions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  score: { type: 'number' },
                  maxScore: { type: 'number' },
                },
              },
            },
            details: { type: 'string' },
          },
          required: ['score', 'action'],
        },
      },
    )

    if (reviewResult) {
      reviewScore = reviewResult.score || 0
      reviewAction = reviewResult.action || 'continue'
      latestReviewResult = reviewResult

      if (reviewAction !== 'continue') {
        issues.push({
          type: 'quality',
          score: reviewScore,
          action: reviewAction,
          dimensions: reviewResult.dimensions,
        })
      }
    }
  } else {
    log('警告: reviewScript 未提供，降级为 AI 评审')
    reviewScore = passScore
  }

  // 综合判定（以脚本输出为准）
  passed = issues.length === 0

  history.push({
    round,
    phase: 'check',
    passed,
    coverageScore,
    reviewScore,
    issueCount: issues.length,
  })

  log(`Round ${round} check: coverage=${coverageScore} review=${reviewScore} issues=${issues.length} passed=${passed}`)

  if (passed) break

  // 降级阈值检查：综合分低于 degradeThreshold 时直接降级
  const combinedScore = Math.min(coverageScore, reviewScore)
  if (degradeThreshold > 0 && combinedScore > 0 && combinedScore < degradeThreshold) {
    log(`综合分 ${combinedScore} < degradeThreshold ${degradeThreshold}，降级通过`)
    history[history.length - 1].degraded = true
    break
  }

  if (round >= maxRounds) {
    log(`达到最大轮次 ${maxRounds}，降级通过`)
    break
  }

  // 修复
  phase('Fix')
  let fixerPrompt
  if (fixSkillPath) {
    fixerPrompt = `你是测试案例修复专家。使用指定的修复技能修复测试案例。

## 修复技能（必须先 Read）
先 Read 修复技能文件，按其指令执行修复：${fixSkillPath}

## 测试目录
${testingDir}

## 脚本检查结果（确定性输出，以脚本为准）
${JSON.stringify(issues, null, 2)}

## 修复要求
1. Read 修复技能文件 ${fixSkillPath}，按其 mode=fix 指令执行
2. 只修复报告中指出的问题，不改未报告的案例
3. 修复后输出摘要

## 禁止
- 禁止删除已有案例
- 禁止修改未报告的案例
- 禁止降低已有案例质量`
  } else {
    fixerPrompt = `你是测试案例修复专家。根据脚本检查结果修复测试案例。

## 测试目录
${testingDir}

## 脚本检查结果（确定性输出，以脚本为准）
${JSON.stringify(issues, null, 2)}

## 修复要求
1. Read 每个问题对应的测试案例文件
2. 针对每个 issue 做最小化修复
3. 只修复报告中指出的问题，不改未报告的案例
4. 修复后输出摘要

## 禁止
- 禁止删除已有案例
- 禁止修改未报告的案例
- 禁止降低已有案例质量`
  }
  const fixResult = await agent(
    fixerPrompt,
    {
      label: `quality-fix-round-${round}`,
      phase: 'Fix',
      schema: FIX_RESULT_SCHEMA,
    },
  )

  if (!fixResult) {
    log(`Round ${round}: fixer 被跳过，终止`)
    break
  }

  history.push({
    round,
    phase: 'fix',
    fixCount: fixResult.fixCount,
    summary: fixResult.summary,
  })

  log(`Round ${round} fix: ${fixResult.fixCount} issues fixed`)
}

return {
  passed: passed || round >= maxRounds,
  degraded: !passed && round >= maxRounds,
  rounds: round,
  maxRounds,
  threshold,
  history,
  coverageResult: latestCoverageResult,
  reviewResult: latestReviewResult,
}
