export const meta = {
  name: 'parallel-review',
  description: '4专家并行评审+加权汇总+修复循环。输入: targetPath, maxRounds, threshold, maxP0, templatePath, templateVars',
  phases: [
    { title: 'Review', detail: 'N 个专家并行评审（基于模板）' },
    { title: 'Fix', detail: '汇总问题修复' },
  ],
}

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const targetPath = _args.targetPath
const maxRounds = Math.min(_args.maxRounds ?? 2, 3)
const threshold = _args.threshold ?? 90
const maxP0 = _args.maxP0 ?? 3
const templatePath = _args.templatePath || ''
const templateVars = _args.templateVars || {}
const experts = _args.experts || [
  { name: '业务价值专家', weight: 0.30, focus: '现状-目标-差距分析质量、业务逻辑准确性、改动范围合理性、业务价值闭环' },
  { name: '流程自洽专家', weight: 0.25, focus: '流程闭环、状态流转完整性、数据流转一致性、流程与功能对应' },
  { name: '场景覆盖专家', weight: 0.25, focus: '角色场景覆盖、异常场景充分性、边界条件、用户视角隐性需求' },
  { name: '可测试性专家', weight: 0.20, focus: '需求可判定性、验收标准质量、非功能需求指标、格式合规' },
]

if (!targetPath) throw new Error('targetPath is required')

const EXPERT_SCORE_SCHEMA = {
  type: 'object',
  properties: {
    expertName: { type: 'string' },
    score: { type: 'number', description: '该维度 0-100' },
    p0Issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          location: { type: 'string', description: '章节标题' },
          issue: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['location', 'issue'],
      },
    },
    p1Issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          issue: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['location', 'issue'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['expertName', 'score', 'p0Issues', 'p1Issues', 'summary'],
}

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
          expertName: { type: 'string' },
          issue: { type: 'string' },
          action: { type: 'string' },
          location: { type: 'string' },
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
let latestExpertReports = []
const history = []

while (round < maxRounds && !passed) {
  round++
  phase('Review')

  const expertResults = await parallel(
    experts.map((expert, idx) => () => agent(
      `你是${expert.name}，权重 ${(expert.weight * 100).toFixed(0)}%。

## 评审目标
${targetPath}

## 评审焦点
${expert.focus}

${templatePath ? `## 专家评审模板（必须先 Read）
先 Read 模板文件获取你专属的完整评审任务和扣分规则：${templatePath}
模板中找到"专家 ${idx + 1}: ${expert.name}"部分，那才是你的评审任务。按模板中的检查项逐条评审。

## 模板变量（供你读取额外文件）
${Object.entries(templateVars).map(([k, v]) => `- ${k}: ${v || '未提供'}`).join('\n')}
` : ''}
## 执行要求
1. ${templatePath ? `Read 模板 ${templatePath}，找到你的评审任务部分` : '按评审焦点逐项评估'}
${templateVars.prdPath ? `2. Read PRD: ${templateVars.prdPath}` : '2. Read 目标内容'}
${templateVars.perspectiveSummaryPath ? `3. Read 用户视角汇总: ${templateVars.perspectiveSummaryPath}` : ''}
${templateVars.proposalPath ? `4. Read Proposal: ${templateVars.proposalPath}` : ''}
${templateVars.perspectiveDir ? `5. Glob + Read 用户视角详情: ${templateVars.perspectiveDir}/*.md` : ''}
6. 按模板/焦点逐项评审，每个问题按 P0/P1 分类
7. 每个问题必须包含：章节标题 + 问题描述 + 建议修复方案
8. 给出本维度 0-100 分

## 禁止
- 禁止修改任何文件
- 禁止给无依据的评价
- 只评审你负责的维度，不越界`,
      {
        label: `expert-${idx + 1}-${expert.name}`,
        phase: 'Review',
        schema: EXPERT_SCORE_SCHEMA,
      },
    )),
  )

  latestExpertReports = expertResults.filter(Boolean)

  let totalScore = 0
  let totalP0 = 0
  let totalP1 = 0
  const dimensionScores = []

  for (const report of latestExpertReports) {
    const expert = experts.find(e => e.name === report.expertName) || experts[0]
    totalScore += report.score * expert.weight
    totalP0 += (report.p0Issues || []).length
    totalP1 += (report.p1Issues || []).length
    dimensionScores.push({
      expert: report.expertName,
      score: report.score,
      weight: expert.weight,
      p0Count: (report.p0Issues || []).length,
      p1Count: (report.p1Issues || []).length,
    })
  }

  const scorePassed = totalScore >= threshold
  const p0Passed = totalP0 <= maxP0
  passed = scorePassed && p0Passed

  history.push({
    round,
    totalScore: Math.round(totalScore * 100) / 100,
    scorePassed,
    p0Count: totalP0,
    p0Passed,
    passed,
    dimensions: dimensionScores,
  })

  log(`Round ${round}: total=${totalScore.toFixed(1)}/${threshold} P0=${totalP0}/${maxP0} passed=${passed}`)

  if (passed) break

  if (round >= maxRounds) {
    log(`达到最大轮次 ${maxRounds}，自动接受`)
    break
  }

  phase('Fix')
  const allP0P1 = latestExpertReports.flatMap(r => [
    ...(r.p0Issues || []).map(i => ({ ...i, expert: r.expertName, severity: 'P0' })),
    ...(r.p1Issues || []).map(i => ({ ...i, expert: r.expertName, severity: 'P1' })),
  ])

  const fixResult = await agent(
    `你是 PRD 修复专家。根据多维度专家评审报告修复目标内容。

## 目标内容
${targetPath}

## 专家评审报告（P0/P1 问题汇总）
${JSON.stringify(allP0P1, null, 2)}

## 修复要求
1. Read 目标内容 ${targetPath}
2. 仅修改被 P0/P1 指向的章节，不触碰其他章节
3. P0 问题优先修复，P1 其次
4. 若修复涉及功能清单或角色权限章节，修复后须重新校验 MECE 矩阵一致性
5. 修复后局部自检：确认修复内容与 PRD 其他章节无矛盾
6. 输出修复摘要

## 禁止
- 禁止重写整个文件
- 禁止修改未被指出问题的章节
- 禁止修改后引入新的矛盾`,
    {
      label: `prd-fixer-round-${round}`,
      phase: 'Fix',
      schema: FIX_RESULT_SCHEMA,
    },
  )

  if (!fixResult) {
    log(`Round ${round}: fixer agent 被跳过，终止`)
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
  totalScore: history.length > 0 ? history.filter(h => h.totalScore !== undefined).pop().totalScore : 0,
  passed,
  degraded: !passed && round >= maxRounds,
  rounds: round,
  maxRounds,
  threshold,
  maxP0,
  history,
  expertReports: latestExpertReports,
}
