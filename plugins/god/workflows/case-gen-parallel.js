export const meta = {
  name: 'case-gen-parallel',
  description: '并行案例生成：按AC/API拆分agent → 脚本合并 → json-to-md split + 索引',
  phases: [
    { title: 'Prepare', detail: '动态扫描AC章节 → 每章节匹配API文档' },
    { title: 'Generate', detail: '按AC/API数拆分并行LLM案例生成' },
    { title: 'Merge', detail: 'merge-parts.js 确定性合并分片' },
    { title: 'PostProcess', detail: 'json-to-md split + 产出验证' },
    { title: 'Index', detail: '生成 _index.md 索引' },
    { title: 'Retry', detail: '失败类型降级重试' },
  ],
}

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const workDir = _args.workDir
const testingDir = _args.testingDir || `${workDir}/testing`
const pluginRoot = _args.pluginRoot
const acPath = _args.acPath || ''
const prdPaths = _args.prdPaths || ''
const businessObjective = _args.businessObjective || ''
const uiPaths = _args.uiPaths || ''
const apiDocPaths = _args.apiDocPaths || ''
const domProbeSummary = _args.domProbeSummary || ''
const userPerspectivesDir = _args.userPerspectivesDir || ''

if (!workDir) throw new Error('workDir is required')
if (!pluginRoot) throw new Error('pluginRoot is required')

// ── Schemas ──

const PROMPT_SCHEMA = {
  type: 'object',
  properties: { prompt: { type: 'string' }, size: { type: 'number' } },
  required: ['prompt'],
}

const GEN_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    file: { type: 'string' },
    caseCount: { type: 'number' },
  },
  required: ['success', 'file'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, caseCount: { type: 'number' }, type: { type: 'string' } },
  required: ['passed', 'type'],
}

const SECTION_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          acIds: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'array', items: { type: 'string' } },
          allApiDocs: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'acIds', 'keywords', 'allApiDocs'],
      },
    },
  },
  required: ['sections'],
}

const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    totalFiles: { type: 'number' },
    totalCases: { type: 'number' },
    types: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          fileCount: { type: 'number' },
          caseCount: { type: 'number' },
        },
      },
    },
  },
  required: ['totalFiles', 'totalCases'],
}

const SCRIPTS_DIR = `${pluginRoot}/skills/test-case-design/scripts`

function buildPostProcessCmd(type) {
  return `执行 ${type} 后处理（split 模式）:\n` +
    `1. node "${SCRIPTS_DIR}/json-to-md.js" --type ${type} --testing-dir "${testingDir}" --mode split\n` +
    `2. node "${SCRIPTS_DIR}/verify-output-exists.js" --type ${type} --testing-dir "${testingDir}"\n` +
    `\n返回: passed=true/false, caseCount=数量, type="${type}"`
}

function buildIndexCmd(type) {
  return `生成 ${type} 索引文件:\n` +
    `1. Bash: node -e "生成索引" 脚本:\n` +
    `   读取 ${testingDir}/test-cases/${type}/ 下所有 .json 文件（排除 _ 开头）\n` +
    `   生成 ${testingDir}/test-cases/${type}/_index.md\n` +
    `   格式: "# ${type.toUpperCase()} 测试案例索引\\n\\n| 模块 | 案例数 | 文件 |\\n|------|--------|------|\\n... | **合计** | **N** | |"\n` +
    `2. 返回: { passed: true/false, type: "${type}" }`
}

// ── Split Constants ──

const AC_PER_AGENT = 8
const API_PER_AGENT = 3

function makeSlug(title) {
  return title.replace(/[^a-zA-Z0-9一-鿿]/g, '-').replace(/-+/g, '-').substring(0, 30).replace(/^-|-$/g, '')
}

// ── Phase 1: Prepare ──

phase('Prepare')

log('扫描 AC 章节 + 匹配 API 文档 + Flow prompt...')

const [sectionsResult, flowPromptResult] = await parallel([

  // 核心扫描：AC章节 + 每章节匹配的API文档
  () => agent(
    `分析 AC 章节与 API 文档的对应关系。

## AC 文件
${acPath || '无（从PRD推导）'}

## API 文档目录
${workDir}/design/api/（或 ${workDir}/tasks/IT-*/api/）
如果 apiDocPaths 参数有值（"${apiDocPaths}"），从逗号分隔路径解析。

## 操作
1. ${acPath ? `读取 ${acPath}` : `Glob ${workDir}/requirement/**/*.md`}
2. 提取所有功能章节（## 级别，排除"基础信息/统计汇总/验收环境/验收流程/文档信息"等非功能章节）
3. 列出 API 文档目录下所有 *.md 文件
4. **按关键词匹配**：对每个章节，从章节标题和 AC 内容提取关键词（如"银行配置"、"账务查询"、"支付"），
   匹配 API 文档文件名（如 bank-config-* 匹配"银行配置"章节）
5. 每个章节的 keywords 要覆盖该章节涉及的业务实体名

## 匹配规则
- bank-config / bank-account → "银行配置"章节
- account-balance / account-transaction / account-receipt → "账务查询"章节
- payment / batchPay / singlePay / detail / checkStatus / queryStatus → "支付转账"章节
- 无法匹配的 API 文档归入最相关的章节（或单独成章）

返回每个章节的: title, acIds[], keywords[], allApiDocs[]（匹配到的API文档绝对路径列表）`,
    { label: 'scan-sections-api', phase: 'Prepare', schema: SECTION_SCHEMA },
  ),

  // Flow: 走脚本生成 prompt（不拆分）
  () => {
    let cmd = `node "${pluginRoot}/skills/test-case-design/scripts/prepare-subagent-prompt.js"`
    cmd += ` --type flow --work-dir "${workDir}" --plugin-dir "${pluginRoot}" --mode generate`
    if (businessObjective) cmd += ` --business-objective "${businessObjective}"`
    if (prdPaths) cmd += ` --prd-paths "${prdPaths}"`
    if (acPath) cmd += ` --ac-file "${acPath}"`
    if (uiPaths) cmd += ` --ui-paths "${uiPaths}"`
    if (apiDocPaths) cmd += ` --api-doc-paths "${apiDocPaths}"`
    if (domProbeSummary) cmd += ` --dom-probe-summary "${domProbeSummary}"`
    if (userPerspectivesDir) cmd += ` --user-perspectives-dir "${userPerspectivesDir}"`
    return agent(
      `运行脚本，捕获 stdout 作为 prompt:\n\n${cmd}\n\nstdout 完整内容放入 prompt 字段。`,
      { label: 'prepare-flow', phase: 'Prepare', schema: PROMPT_SCHEMA },
    )
  },
])

const sections = (sectionsResult && sectionsResult.sections) || []
const flowPrompt = flowPromptResult && flowPromptResult.prompt

sections.forEach((s, i) => {
  log(`章节 ${i + 1}: ${s.title} — AC:${s.acIds.length} API文档:${s.allApiDocs.length}`)
})

// ── Phase 2: Generate ──

phase('Generate')

const allAgents = []

for (let i = 0; i < sections.length; i++) {
  const s = sections[i]
  const slug = makeSlug(s.title)

  // ── E2E: 按 AC 数拆分 ──
  const acChunks = []
  for (let j = 0; j < s.acIds.length; j += AC_PER_AGENT) {
    acChunks.push(s.acIds.slice(j, j + AC_PER_AGENT))
  }
  // 如果没有 AC，至少 1 个 agent
  if (acChunks.length === 0) acChunks.push([])

  acChunks.forEach((acChunk, chunkIdx) => {
    const acList = acChunk.join(', ')
    const needPartSuffix = acChunks.length > 1
    const partSuffix = needPartSuffix ? `-${chunkIdx + 1}` : ''
    const partLabel = needPartSuffix ? ` part ${chunkIdx + 1}/${acChunks.length}` : ''
    const filePath = `${testingDir}/test-cases/e2e/${slug}${partSuffix}.json`

    allAgents.push({
      label: `e2e-${i}-${slug}${needPartSuffix ? '-' + (chunkIdx + 1) : ''}`,
      type: 'e2e',
      section: s.title,
      prompt: `## 角色
你是 E2E 测试案例设计专家。只设计测试案例，不编写脚本，不涉及代码。

## 你负责的模块: ${s.title}${partLabel}

## 核心业务目标
${businessObjective || '从PRD中提取'}

## 输入
- AC 文件: ${acPath || '无'}
- 你负责的 AC: ${acList || '与"' + s.title + '"相关的AC'}
- PRD: ${prdPaths || '无'}
- UI 原型: ${uiPaths || '无'}
- E2E 设计规范: ${pluginRoot}/skills/test-case-design/references/e2e-case-design.md
- AC 分配: ${testingDir}/.cache/ac-assignment.json
${userPerspectivesDir ? `- 用户视角: ${userPerspectivesDir}` : ''}

## 任务
1. 读取 AC 文件，只关注: ${acList || '与"' + s.title + '"相关的AC'}
2. 读取 PRD 中"${s.title}"相关章节
3. ${uiPaths ? '读取 UI 原型获取页面交互细节' : '从PRD推导交互'}
4. 逐条 AC 设计 E2E 用例：正常+异常+边界
5. 每条标注 覆盖AC: AC-XX，testPath 写完整导航路径

## 输出
只输出 JSON，写入: ${filePath}

先 mkdir -p "${testingDir}/test-cases/e2e"
用 Bash + PYTHONUTF8=1 python -c 写入。如果内容 > 20000 字符，分段写入。

JSON: {"feature":"${s.title}","version":"v1","generatedAt":"ISO���期","source_section":"${s.title}","test_cases":[...]}
每条 test_case: {id:"FE-{简名}-001",title,priority,type,testPath,covers,preconditions,steps,expected,design_method,tags}

## 限制
- 最多 40 条用例

## 禁止
- 禁止输出 Markdown
- 禁止设计其他模块案例`,
    })
  })

  // ── API: 按 API 文档数拆分 ──
  if (s.allApiDocs.length > 0) {
    const apiChunks = []
    for (let j = 0; j < s.allApiDocs.length; j += API_PER_AGENT) {
      apiChunks.push(s.allApiDocs.slice(j, j + API_PER_AGENT))
    }

    apiChunks.forEach((apiChunk, chunkIdx) => {
      const apiDocsList = apiChunk.join(', ')
      // API agent 负责对应 AC
      const acList = s.acIds.join(', ')
      const needPartSuffix = apiChunks.length > 1
      const partSuffix = needPartSuffix ? `-${chunkIdx + 1}` : ''
      const partLabel = needPartSuffix ? ` part ${chunkIdx + 1}/${apiChunks.length}（${apiChunk.length}个接口）` : ''
      const filePath = `${testingDir}/test-cases/api/${slug}${partSuffix}.json`

      allAgents.push({
        label: `api-${i}-${slug}${needPartSuffix ? '-' + (chunkIdx + 1) : ''}`,
        type: 'api',
        section: s.title,
        prompt: `## 角色
你是 API 测试案例设计专家。只设计测试案例，不编写脚本，不涉及代码。

## 你负责的模块: ${s.title}${partLabel}

## 核心业务目标
${businessObjective || '从PRD中提取'}

## 输入
- AC 文件: ${acPath || '无'}
- 你负责的 AC: ${acList || '与"' + s.title + '"相关的AC'}
- PRD: ${prdPaths || '无'}
- **接口文档（${apiChunk.length}个）: ${apiDocsList}**
- API 设计规范: ${pluginRoot}/skills/test-case-design/references/api-case-design.md
- AC 分配: ${testingDir}/.cache/ac-assignment.json
${userPerspectivesDir ? `- 用户视角: ${userPerspectivesDir}` : ''}

## 任务
1. 读取所有 ${apiChunk.length} 个接口文档
2. 读取 AC 文件，只关注: ${acList}
3. 读取 PRD 补充业务规则
4. **识别 CRUD 关联**：同一实体的增/删/改/查接口，参数和状态有关联的案例要连贯
5. 为每个接口设计：正向+参数校验+边界值+业务规则+异常
6. 每条标注 覆盖AC: AC-XX

## 输出
只输出 JSON，写入: ${filePath}

先 mkdir -p "${testingDir}/test-cases/api"
用 Bash + PYTHONUTF8=1 python -c 写入。如果内容 > 20000 字符，分段写入。

JSON: {"feature":"${s.title} API","version":"v1","generatedAt":"ISO日期","source_api_docs":[${apiChunk.map(p => '"' + p + '"').join(',')}],"test_cases":[...]}
每条 test_case: {id:"API-{简名}-001",title,priority,type,covers,preconditions,steps,expected,design_method,tags}

## 限制
- 最多 40 条用例

## 禁止
- 禁止输出 Markdown
- 禁止设计其他模块案例`,
      })
    })
  }
}

// Flow agent（不拆分）
if (flowPrompt) {
  allAgents.push({ label: 'case-designer-flow', type: 'flow', prompt: flowPrompt })
}

const e2eCount = allAgents.filter(a => a.type === 'e2e').length
const apiCount = allAgents.filter(a => a.type === 'api').length
log(`并行启动 ${allAgents.length} 个 agent（E2E:${e2eCount} + API:${apiCount} + Flow:${flowPrompt ? 1 : 0}）`)

const cases = await parallel(
  allAgents.map(item => () =>
    agent(item.prompt, { label: item.label, phase: 'Generate', schema: GEN_RESULT_SCHEMA })
  )
)

const successCount = cases.filter(Boolean).length
log(`${successCount}/${allAgents.length} 个 agent 完成`)

// ── Phase 3: Merge（确定性脚本） ──

phase('Merge')

const mergeResult = await agent(
  `运行确定性合并脚本:
node "${SCRIPTS_DIR}/merge-parts.js" --testing-dir "${testingDir}" --types e2e,api,flow

读取 stdout JSON 结果返回。`,
  { label: 'merge-parts', phase: 'Merge', schema: MERGE_SCHEMA },
)

if (mergeResult) {
  log(`合并完成: ${mergeResult.totalFiles} 文件, ${mergeResult.totalCases} 用例`)
}

// ── Phase 4: PostProcess ──

phase('PostProcess')

const postResults = await parallel(
  ['e2e', 'api', 'flow'].map(type => () =>
    agent(buildPostProcessCmd(type), { label: `postprocess-${type}`, phase: 'PostProcess', schema: VERIFY_SCHEMA })
  )
)

const postByType = {}
postResults.forEach((r, i) => { if (r) postByType[['e2e','api','flow'][i]] = r })

// ── Phase 5: Index ──

phase('Index')

const indexResults = await parallel(
  ['e2e', 'api', 'flow'].map(type => () =>
    agent(`生成 ${type} 测试案例索引文件。

读取 ${testingDir}/test-cases/${type}/ 下所有 .json 文件（排除 _ 开头），生成 ${testingDir}/test-cases/${type}/_index.md。

格式:
# ${type.toUpperCase()} 测试案例索引

| # | 模块 | 案例数 | 文件 |
|---|------|--------|------|
| 1 | xxx | N | xxx.md |
| **合计** | | **N** | |

先 mkdir -p "${testingDir}/test-cases/${type}"
用 Write tool 写入 _index.md。

返回: { passed: true, type: "${type}" }`,
      { label: `index-${type}`, phase: 'Index', schema: VERIFY_SCHEMA },
    )
  )
)

indexResults.forEach(r => { if (r) postByType[r.type] = { ...postByType[r.type], indexed: r.passed } })

// ── Phase 6: Retry ──

phase('Retry')

const failedTypes = ['e2e', 'api', 'flow'].filter(t => { const r = postByType[t]; return !r || !r.passed })

if (failedTypes.length === 0) {
  log('全部通过验证')
  return { allPassed: true, results: postByType, agentCount: allAgents.length, sectionCount: sections.length, retryCount: 0 }
}

log(`${failedTypes.length} 个类型失败: ${failedTypes.join(', ')}`)

const retryResults = {}
for (const type of failedTypes) {
  log(`${type} 重试: 全量重新生成...`)
  let cmd = `node "${pluginRoot}/skills/test-case-design/scripts/prepare-subagent-prompt.js" --type ${type} --work-dir "${workDir}" --plugin-dir "${pluginRoot}" --mode generate`
  if (businessObjective) cmd += ` --business-objective "${businessObjective}"`
  if (prdPaths) cmd += ` --prd-paths "${prdPaths}"`
  if (acPath) cmd += ` --ac-file "${acPath}"`
  if (uiPaths) cmd += ` --ui-paths "${uiPaths}"`
  if (apiDocPaths) cmd += ` --api-doc-paths "${apiDocPaths}"`
  if (userPerspectivesDir) cmd += ` --user-perspectives-dir "${userPerspectivesDir}"`
  if (domProbeSummary) cmd += ` --dom-probe-summary "${domProbeSummary}"`

  const retryPrompt = await agent(`运行脚本: ${cmd}`, { label: `prepare-${type}-retry`, phase: 'Retry', schema: PROMPT_SCHEMA })
  if (retryPrompt) {
    await agent(retryPrompt.prompt, { label: `case-designer-${type}-retry`, phase: 'Retry' })
  }

  // Retry 后也需要合并和后处理
  await agent(
    `运行合并脚本:\nnode "${SCRIPTS_DIR}/merge-parts.js" --testing-dir "${testingDir}" --types ${type}`,
    { label: `merge-${type}-retry`, phase: 'Retry', schema: MERGE_SCHEMA },
  )

  const retryPost = await agent(buildPostProcessCmd(type), { label: `postprocess-${type}-retry`, phase: 'Retry', schema: VERIFY_SCHEMA })
  retryResults[type] = retryPost || { passed: false }
}

const finalResults = { ...postByType, ...retryResults }
const allPassed = Object.values(finalResults).every(r => r && r.passed)

log(allPassed ? '重试后全部通过' : '重试后仍有失败')

return { allPassed, results: finalResults, agentCount: allAgents.length, sectionCount: sections.length, retryCount: failedTypes.length }
