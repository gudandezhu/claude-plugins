export const meta = {
  name: 'user-perspective-analysis',
  description: '用户视角分析：识别角色 → 预读文档 → 并行分析（内容内联） → 写文件 → 汇总',
  phases: [
    { title: 'Identify', detail: '从需求材料识别用户角色' },
    { title: 'PreRead', detail: '单 agent 预读全部文档，返回精炼摘要' },
    { title: 'Analyze', detail: '每角色并行分析（摘要内联，只返回内容不写文件）' },
    { title: 'Write', detail: '单 agent 批量写入所有文件' },
    { title: 'Summarize', detail: '生成 _summary.md' },
  ],
}

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const workDir = _args.workDir
const requirementId = _args.requirementId
const acPath = _args.acPath || ''
const prdPaths = _args.prdPaths || ''
const uiPaths = _args.uiPaths || ''
const perspectiveDir = _args.perspectiveDir || `${workDir}/testing/.cache/user-perspectives`

const pluginRoot = _args.pluginRoot

if (!workDir) throw new Error('workDir is required')
if (!pluginRoot) throw new Error('pluginRoot is required')

const ROLES_SCHEMA = {
  type: 'object',
  properties: {
    roles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          definition: { type: 'string' },
        },
        required: ['name', 'definition'],
      },
    },
  },
  required: ['roles'],
}

const DOC_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '精炼业务摘要（≤4000字）' },
    moduleCount: { type: 'number' },
  },
  required: ['summary'],
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    roleName: { type: 'string' },
    content: { type: 'string', description: '完整的 6 维度 Markdown 分析内容' },
  },
  required: ['roleName', 'content'],
}

const WRITE_SCHEMA = {
  type: 'object',
  properties: {
    filesWritten: { type: 'number' },
    paths: { type: 'array', items: { type: 'string' } },
  },
  required: ['filesWritten'],
}

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summaryPath: { type: 'string' },
    roleCount: { type: 'number' },
  },
  required: ['summaryPath', 'roleCount'],
}

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9一-鿿-]/g, '')
}

// ── Phase 1: 角色识别 ──

phase('Identify')

const rolesResult = await agent(
  `从需求材料中识别用户角色。

## 工作目录
${workDir}

## 识别来源（按优先级）
1. 需求材料（proposal / PRD）中的直接角色声明
2. PRD 中的角色描述
3. 权限差异（不同角色看到不同页面/操作）
4. 业务流程中的参与者（申请人、审批人、执行人）

## 识别维度
- 直接角色声明（"管理员"、"审批人"、"普通用户"等）
- 权限差异（不同角色看到不同页面/操作）
- 业务流程中的参与者

## 操作
1. Read 需求材料（Glob: ${workDir}/requirement/**/*.md, ${workDir}/design/tech-design.md）
2. 识别所有用户角色
3. 返回角色列表，每个角色含 name 和一句话 definition

## 禁止
- 禁止读取代码文件
- 角色最多 4 个（合并相似角色）`,
  { label: 'role-identifier', phase: 'Identify', schema: ROLES_SCHEMA },
)

const roles = (rolesResult && rolesResult.roles) || []

if (roles.length === 0) {
  log('未识别到用户角色，跳过分析')
  return { roleCount: 0, roles: [], skipped: true }
}

log(`识别到 ${roles.length} 个用户角色: ${roles.map(r => r.name).join(', ')}`)

// ── Phase 2: 预读文档 ──

phase('PreRead')

const docSummaryResult = await agent(
  `预读所有需求文档，生成精炼业务摘要。

## 读取文件（按优先级）
1. ${acPath ? `AC 文件: ${acPath}` : '无AC文件'}
2. ${prdPaths ? `PRD 目录: ${prdPaths}` : '无PRD目录'}
3. ${uiPaths ? `UI 原型目录: ${uiPaths}（HTML文件，提取页面结构和交互）` : '无UI原型'}
4. ${workDir}/design/tech-design.md（如存在）

## 操作
1. 读取上述所有文件
2. 提取精炼摘要（≤4000字），必须包含：
   - 功能模块划分（每个模块的核心功能）
   - 业务规则（权限、限制、校验规则）
   - 数据流转（实体关系、状态变更）
   - 异常场景（超时、冻结、授权过期等）
   - 页面交互要点（从UI原型提取）

## 禁止
- 禁止读取代码文件
- 禁止输出原始文档内容，只输出摘要`,
  { label: 'pre-read-docs', phase: 'PreRead', schema: DOC_SUMMARY_SCHEMA },
)

const docSummary = (docSummaryResult && docSummaryResult.summary) || ''
log(`文档预读完成，摘要长度: ${docSummary.length} 字`)

// ── Phase 3: 并行角色分析（只返回内容，不写文件） ──

phase('Analyze')

const analyses = await parallel(
  roles.slice(0, 4).map((role) => () =>
    agent(
      `你是 ${role.name}，${requirementId} 系统的真实用户。只输出分析内容，不写文件。

## 角色定义
- 角色名: ${role.name}
- 定义: ${role.definition}
- 系统名称: ${requirementId}

## 业务背景（已预读精炼）
${docSummary}

## 分析任务
以真实用户视角，按以下 6 个维度分析：

### 一、用户画像（2-3句：你是谁、核心目标、使用频率、业务压力）
### 二、核心业务诉求（3-5个，每个必须说明：业务驱动力 + 不满足的业务后果）
### 三、关键操作流程（2-3个，每个含触发条件、步骤+数据变化、异常分支、边界情况）
### 四、数据变化追踪（操作→实体→变化前后→业务约束→下游影响）
### 五、隐性需求（需求未明确但你一定会遇到的，用具体场景说明）
### 六、测试重点建议（必须覆盖 + 容易出错 + 边界场景）

## 核心原则
- 以深层次业务行为/目标为导向，非表面界面功能设计
- 每个操作流程必须包含"不太顺利的一天"场景
- 异常分支：如果步骤N失败 → 当前数据状态 → 期望系统处理方式

## 输出要求
将完整 Markdown 内容放入 content 字段。roleName 字段填 "${role.name}"。

## 禁止
- 禁止读取任何文件（内容已在上方提供）
- 禁止写文件（由后续 agent 统一写入）
- 禁止 happy path only
- 禁止编造文档中不存在的功能`,
      { label: `perspective-${slug(role.name)}`, phase: 'Analyze', schema: ANALYSIS_SCHEMA },
    )
  ),
)

const validAnalyses = analyses.filter(Boolean)
log(`${validAnalyses.length}/${roles.length} 个角色分析完成`)

// ── Phase 4: 批量写文件 ──

phase('Write')

if (validAnalyses.length > 0) {
  const writeContent = validAnalyses.map(a => {
    const name = a.roleName
    const content = a.content
    const s = slug(name)
    return `## 文件: ${perspectiveDir}/${s}.md\n角色: ${name}\n内容:\n${content}`
  }).join('\n\n---\n\n')

  await agent(
    `将以下分析内容写入各自文件。

## 文件列表
${validAnalyses.map(a => `- ${perspectiveDir}/${slug(a.roleName)}.md (${a.roleName})`).join('\n')}

## 写入内容

${writeContent}

## 操作
1. mkdir -p ${perspectiveDir}
2. 用 Write tool 将每个角色的内容写入对应文件
3. 文件内容为纯 Markdown

返回写入的文件数量和路径列表。`,
    { label: 'write-perspectives', phase: 'Write', schema: WRITE_SCHEMA },
  )
}

// ── Phase 5: 汇总 ──

phase('Summarize')

await agent(
  `生成用户视角分析汇总文件。

## 输入
读取 ${perspectiveDir}/ 下所有非 _ 开头的 .md 文件。

## 输出
写入 ${perspectiveDir}/_summary.md，格式：

\`\`\`markdown
# 用户视角分析汇总

## 分析信息
- 需求编号: ${requirementId}
- 角色数量: ${roles.length}

## 角色清单
| # | 角色 | 核心目标 | 文档路径 |
|---|------|---------|---------|

## 关键发现
- 跨角色共性诉求
- 角色间冲突点
- 隐性需求汇总

## 给下游的输入
- test-case-design: 用户视角文档路径列表
\`\`\``,
  { label: 'perspective-summary', phase: 'Summarize', schema: SUMMARY_SCHEMA },
)

return {
  roleCount: roles.length,
  roles: roles.map(r => r.name),
  perspectiveDir,
  skipped: false,
}
