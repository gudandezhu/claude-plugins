export const meta = {
  name: 'architect-review',
  description: 'architect Phase 3: 前置校验 → tech-review → 影响分析 → 批量修复 → 一致性验证',
  phases: [
    { title: 'PreCheck', detail: '交付物存在性校验' },
    { title: 'Review', detail: 'tech-review 量化评审' },
    { title: 'Impact', detail: '关联影响分析' },
    { title: 'Fix', detail: '批量修复' },
    { title: 'Verify', detail: 'Grep 一致性验证' },
  ],
}

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const designDir = _args.designDir
const workDir = _args.workDir
const skillRoot = _args.skillRoot
const threshold = _args.threshold ?? 90
const maxIterations = Math.min(_args.maxIterations ?? 3, 5)
const preCheckScript = _args.preCheckScript || ''
const deliverables = _args.deliverables || []
const reviewContext = _args.reviewContext || ''

if (!designDir) throw new Error('designDir is required')
if (!skillRoot) throw new Error('skillRoot is required')

const REVIEW_SCORE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    passed: { type: 'boolean' },
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
                item: { type: 'string' },
                points: { type: 'number' },
                reason: { type: 'string' },
                suggestion: { type: 'string' },
              },
              required: ['item', 'points', 'reason', 'suggestion'],
            },
          },
        },
        required: ['name', 'score', 'maxScore', 'deductions'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['score', 'passed', 'dimensions', 'summary'],
}

const IMPACT_SCHEMA = {
  type: 'object',
  properties: {
    affectedFiles: {
      type: 'array',
      items: { type: 'string' },
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
    },
    impactMap: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          locations: { type: 'array', items: { type: 'string' } },
        },
        required: ['keyword', 'files'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['affectedFiles', 'keywords', 'summary'],
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
          file: { type: 'string' },
          keyword: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['file', 'action'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['fixed', 'fixCount', 'summary'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verified: { type: 'boolean' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          oldCleared: { type: 'boolean', description: '旧值已清除' },
          newConsistent: { type: 'boolean', description: '新值一致' },
          details: { type: 'string' },
        },
        required: ['keyword', 'oldCleared', 'newConsistent'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['verified', 'checks', 'summary'],
}

const rubricPath = `${skillRoot}/references/rubric-tech-review.md`

// ── Phase 0: 前置校验（确定性）──
phase('PreCheck')
if (deliverables.length > 0 && preCheckScript) {
  const deliverableArgs = deliverables.map(d => `"${d.desc}|${d.glob}"`).join(' ')
  const preCheckCmd = `bash "${preCheckScript}" "${designDir}" ${deliverableArgs}`
  const preCheckResult = await agent(
    `执行交付物存在性校验。运行命令: ${preCheckCmd}
如果退出码非 0，输出 preCheckPassed=false 和缺失列表。如果退出码 0，输出 preCheckPassed=true。`,
    {
      label: 'architect-pre-check',
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
      rounds: 0,
      maxIterations,
      threshold,
      history: [{ phase: 'preCheck', passed: false, missing: preCheckResult.missing || [] }],
    }
  }

  log('前置校验通过')
}

// ── 主循环 ──
let iteration = 0
let passed = false
const history = []

while (iteration < maxIterations && !passed) {
  iteration++

  // Phase 1: Review
  phase('Review')
  const contextSection = reviewContext
    ? `\n## 规范要点摘要（已提取，直接使用，无需重新读取规范文件）\n${reviewContext}\n`
    : ''

  const reviewResult = await agent(
    `你是技术方案评审员。按 Rubric 对技术方案进行量化评审。

## 目标内容路径
${designDir}

## Rubric 路径
${rubricPath}

## 通过阈值
${threshold}
${contextSection}
## 执行要求
1. Read Rubric ${rubricPath}
2. Read 目标内容 ${designDir}（目录则 Glob 后读取所有文件）
3. Rubric 如有"前置准备"章节，按其指令加载规范文件
4. 按 Rubric 逐项评分（通过=满分，部分通过=50%，不通过=0）
5. 汇总得分，结构化输出

## 评审输出要求
- 对每个扣分项，明确标注：**直接修复**（你能给出具体修改内容）还是**需推导修复**（需要主 agent 根据上下文自行推导）
- 评审不通过时，明确说明"需要继续提交评审，直到通过"

## 禁止
- 禁止修改任何文件
- 禁止不读内容就评分
- 只评估，不修复`,
    {
      label: `tech-review-round-${iteration}`,
      phase: 'Review',
      schema: REVIEW_SCORE_SCHEMA,
    },
  )

  if (!reviewResult) {
    log(`Round ${iteration}: reviewer 被跳过，终止`)
    break
  }

  const score = reviewResult.score
  passed = reviewResult.passed

  history.push({
    round: iteration,
    phase: 'review',
    score,
    passed,
  })

  log(`Round ${iteration} review: score=${score}/${threshold} passed=${passed}`)

  if (passed) break
  if (iteration >= maxIterations) {
    log(`达到最大迭代 ${maxIterations}，停止`)
    break
  }

  // Phase 2: Impact Analysis
  phase('Impact')
  const deductions = reviewResult.dimensions
    ? reviewResult.dimensions.flatMap(d => (d.deductions || []).map(dd => dd.reason))
    : []

  const impactResult = await agent(
    `你是影响分析专家。分析评审报告中每个扣分项的关联影响范围。

## 设计目录
${designDir}

## 工作目录（需搜索关联文档的范围）
${workDir || designDir}

## 评审扣分原因列表
${deductions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## 执行要求
1. 从每个扣分原因中提取关键词（如接口名、表名、字段名、模块名）
2. 用 Grep 在 ${workDir || designDir} 下搜索每个关键词
3. 记录每个关键词出现的文件和位置
4. 输出影响图谱：关键词 → 受影响文件列表

## 输出
受影响文件列表、关键词列表、关键词→文件的映射关系`,
    {
      label: `impact-analysis-round-${iteration}`,
      phase: 'Impact',
      schema: IMPACT_SCHEMA,
    },
  )

  if (!impactResult) {
    log(`Round ${iteration}: impact analysis 被跳过，终止`)
    break
  }

  history.push({
    round: iteration,
    phase: 'impact',
    affectedFiles: impactResult.affectedFiles,
    keywordCount: impactResult.keywords.length,
  })

  log(`Round ${iteration} impact: ${impactResult.keywords.length} keywords, ${impactResult.affectedFiles.length} files affected`)

  // Phase 3: Batch Fix
  phase('Fix')
  const fixResult = await agent(
    `你是技术方案修复专家。根据评审报告和影响分析结果，批量修复所有受影响文件。

## 设计目录
${designDir}

## 评审报告
${JSON.stringify(reviewResult, null, 2)}

## 影响分析结果
${JSON.stringify(impactResult, null, 2)}

## 修复要求
1. Read 每个受影响文件
2. 针对每个扣分项，在所有受影响文件中做一致修改
3. 最小化修复：只改扣分相关内容
4. 确保修改后的内容在各文件间保持一致

## 禁止
- 禁止重写整个文件
- 禁止修复未扣分的内容
- 禁止遗漏影响分析中列出的文件`,
    {
      label: `batch-fix-round-${iteration}`,
      phase: 'Fix',
      schema: FIX_RESULT_SCHEMA,
    },
  )

  if (!fixResult) {
    log(`Round ${iteration}: fixer 被跳过，终止`)
    break
  }

  history.push({
    round: iteration,
    phase: 'fix',
    fixCount: fixResult.fixCount,
  })

  log(`Round ${iteration} fix: ${fixResult.fixCount} items fixed`)

  // Phase 4: Consistency Verification
  phase('Verify')
  const verifyResult = await agent(
    `你是一致性验证员。验证修复后所有受影响文件中旧值已清除、新值一致。

## 设计目录
${designDir}

## 修复内容
${JSON.stringify(fixResult, null, 2)}

## 影响分析中的关键词
${JSON.stringify(impactResult.keywords, null, 2)}

## 执行要求
1. 对每个修复项，Grep 搜索旧值是否已清除
2. Grep 搜索新值是否在所有受影响文件中一致
3. 对每个关键词报告：oldCleared + newConsistent

## 输出
逐项验证结果，全部 oldCleared=true 且 newConsistent=true 才算 verified`,
    {
      label: `consistency-verify-round-${iteration}`,
      phase: 'Verify',
      schema: VERIFY_SCHEMA,
    },
  )

  if (!verifyResult) {
    log(`Round ${iteration}: verifier 被跳过，继续下一轮`)
    continue
  }

  history.push({
    round: iteration,
    phase: 'verify',
    verified: verifyResult.verified,
  })

  log(`Round ${iteration} verify: ${verifyResult.verified ? 'consistent' : 'inconsistent'}`)
}

return {
  score: history.filter(h => h.score !== undefined).pop()?.score || 0,
  passed,
  rounds: iteration,
  maxIterations,
  threshold,
  history,
}
