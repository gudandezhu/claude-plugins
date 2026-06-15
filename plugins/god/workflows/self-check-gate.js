export const meta = {
  name: 'self-check-gate',
  description: '跨迭代自检门禁：覆盖/依赖/AC/完整性 4 项确定性校验',
  phases: [
    { title: 'Check', detail: '执行 4 项确定性校验' },
  ],
}

const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const tasksDir = _args.tasksDir
const techDesignPath = _args.techDesignPath
const acPath = _args.acPath

if (!tasksDir) throw new Error('tasksDir is required')

const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    checkName: { type: 'string' },
    passed: { type: 'boolean' },
    details: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string', description: '检查项名称' },
          passed: { type: 'boolean' },
          detail: { type: 'string', description: '通过原因或失败详情' },
          location: { type: 'string', description: '失败定位（迭代/任务ID/AC编号）' },
        },
        required: ['item', 'passed', 'detail'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['checkName', 'passed', 'details', 'summary'],
}

// ── 并行执行 4 项校验 ──
const checks = await parallel([
  () => agent(
    `你是自检校验员。执行"迭代覆盖检查"。

## 任务目录
${tasksDir}

## 技术方案路径
${techDesignPath || '未提供（跳过与 tech-design 的覆盖比对）'}

## 检查内容
1. 读取所有迭代的 task-list.json（Glob: ${tasksDir}/IT-*/task-list.json）
2. 汇总所有任务，统计覆盖的页面、接口、数据库表
${techDesignPath ? `3. 读取 ${techDesignPath}，比对所有页面/接口/表是否都有对应任务` : '3. 跳过 tech-design 比对（未提供）'}
4. 检查是否有未分配到任何迭代的功能模块

## 输出
对每个检查项给出 passed/failed 和定位信息。`,
    { label: 'check-coverage', phase: 'Check', schema: CHECK_SCHEMA },
  ),
  () => agent(
    `你是自检校验员。执行"跨迭代依赖无环检查"。

## 任务目录
${tasksDir}

## 检查内容
1. 读取所有迭代的 task-list.json
2. 提取所有跨迭代依赖（dependsOn 中的 IT-XX 或 IT-XX.BE-XX 格式）
3. 构建依赖图，检测是否存在环
4. 验证拓扑排序：INFRA 任务是否排在最前
5. 验证每个任务的 dependsOn 字段是否已填写（无依赖填"无"）

## 输出
对每个检查项给出 passed/failed 和定位信息。`,
    { label: 'check-deps', phase: 'Check', schema: CHECK_SCHEMA },
  ),
  () => agent(
    `你是自检校验员。执行"AC 全覆盖检查"。

## AC 文件路径
${acPath || '未提供'}

## 任务目录
${tasksDir}

## 检查内容
1. ${acPath ? `读取 ${acPath}，提取所有 AC 编号（AC-XX 格式）` : 'AC 路径未提供，从任务中反向收集'}
2. 读取所有任务详情文档（Glob: ${tasksDir}/IT-*/{BE,FE,INFRA}-*.md）
3. 检查每个 AC 是否至少被一个任务的 frontmatter acceptance-criteria 引用
4. 检查每个任务是否至少有 1 个 AC 引用（无 AC 的任务需说明原因）

## 输出
对每个检查项给出 passed/failed 和定位信息。列出所有未被引用的 AC 编号和所有缺少 AC 的任务。`,
    { label: 'check-ac', phase: 'Check', schema: CHECK_SCHEMA },
  ),
  () => agent(
    `你是自检校验员。执行"任务 AC 引用检查 + 完整性检查"。

## 任务目录
${tasksDir}

## 检查内容
1. 对每个迭代，读取 task-list.json 中的 tasks 数组
2. 验证每个 task 的 detailPath 指向的文件实际存在
3. 验证 task-list.json 的 tasks 数组长度 == 实际存在的任务详情文件数量
4. 验证每个任务详情文件 frontmatter 包含必需字段（title, role, acceptance-criteria）
5. 验证每个任务的 acceptance-criteria 至少包含 1 个 AC-XX 或 UI-XX 引用（无 AC 可分配的任务需在正文中说明原因）

## 输出
列出所有不一致项。`,
    { label: 'check-integrity', phase: 'Check', schema: CHECK_SCHEMA },
  ),
])

// ── 汇总结果 ──
const results = checks.filter(Boolean)
const allPassed = results.every(r => r.passed)

return {
  passed: allPassed,
  checks: results,
  checkCount: results.length,
  passedCount: results.filter(r => r.passed).length,
  failedCount: results.filter(r => !r.passed).length,
}
