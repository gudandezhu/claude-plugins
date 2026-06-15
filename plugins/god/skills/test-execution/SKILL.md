---
name: test-execution
user-invocable: false
description: |
  测试执行与报告技能。覆盖脚本化执行流程、test-summary.json 读取、失败分类处理、
  单文件重试机制、classify-error 流程、E2E 自动修复循环、截图规范、缺陷报告生成、
  验收报告合规校验。
  在 /run-test 执行阶段和报告生成阶段加载。
  当需要执行测试脚本、诊断测试失败、修复选择器问题、生成验收报告、记录测试缺陷、
  采集测试证据时，使用此技能。
  即使用户只是说"测试跑不过"或"报告不完整"，也应加载此技能。
---

# 脚本路径（禁止修改）

所有可执行脚本位于 `skills/test-execution/scripts/`：
- run-tests.js: `$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/run-tests.js`
- pre-check.js: `$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/pre-check.js`
- parse-results.js: `$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/parse-results.js`

# 执行流程

测试执行流程（run-tests.js 调用、test-summary.json 读取）
详见 `references/execution-flow.md`。

其他 references 按需加载：

| reference 文件 | 加载条件 |
|---------------|---------|
| execution-flow.md | 步骤二执行测试时 |
| batch-execution.md | E2E 文件 > 30 时自适应分批 |
| testing-repo-execution.md | testingRepo 已配置时 |
| pre-check.md | run-test 前置检查阶段 |
| archive-results.md | run-test 步骤一归档 |
| single-file-retry.md | 修复后单文件重试时 |
| element-plus-fix-patterns.md | Element Plus 特定修复时 |
| fix-experience-index.md | 修复失败脚本前查询经验库 |

## Testing-Repo 独立运行模式

Testing-Repo 支持脱离插件会话独立执行测试，详见 `references/testing-repo-execution.md`。

关键点：
- 入口：`run.sh`（Linux/macOS）或 `run.ps1`（Windows）
- 环境变量 `TESTING_REPO_MODE=1` 由入口脚本自动设置
- 配置来源：`.env` 文件（而非 test-config.json）
- storageState 路径：`.cache/.auth/storage-state.json`

以下为失败处理和修复循环规范。

## 失败分类处理

test-summary.json 中每个 failure 带有 errorType 字段，按类型处理：

| errorType | 含义 | suggestedAction | 处理方式 |
|-----------|------|-----------------|---------|
| `selector_not_found` | 选择器找不到 | `fix-selector` | 查 dom-probe.md 修正，单文件重试 |
| `selector_ambiguous` | 选择器匹配多个 | `fix-selector` | 加精确选择器，单文件重试 |
| `element_blocked` | 元素被遮挡 | `fix-selector` | 检查遮罩层，单文件重试 |
| `api_path_error` | API 响应字段路径错误 | `fix-api-path` | 探测不准导致的断言路径错误，可修正字段路径，单文件重试 |
| `api_path_error` | TypeError: Cannot read properties of null/undefined | `fix-api-path` | API 返回 data:null 但脚本访问 data.bizKey，修正空值处理或路径 |
| `api_path_error` | HTTP 404（API 前缀缺失） | `fix-api-path` | API_PREFIX 未注入或路径拼接错误，修正请求路径 |
| `assertion_failed` | 断言失败 | `report-defect` | 业务缺陷，记录到缺陷清单，禁止修改断言 |
| `network_error` | 网络错误 | `check-environment` | 环境问题，提示用户检查服务，禁止修改脚本 |
| `network_error` | Cannot navigate to invalid URL | `check-environment` | FRONTEND_URL 未设置，检查 test-config.json 的 frontend.baseUrl |
| `browser_crash` | 浏览器崩溃 | `retry` | 自动重试，连续 2 次崩溃提示检查 Chrome 版本 |
| `unknown` | 未知错误 | `diagnose-with-browser` | 启动 agent-browser 诊断 |
| `framework_error` | 路径解析失败、依赖缺失、脚本语法错误、目录结构不匹配 | `stop-and-report` | 记录缺陷(type: "framework")，中止步骤，提示独立修复 |
| `config_missing` | auth 未配置但 scope 含 E2E、baseUrl 指向错误 | `stop-and-report` | 提示用户修正 test-config.json |

**suggestedAction 是硬约束**——LLM 必须严格按上表的 suggestedAction 行动，修复范围见下表。

`fix-api-path` 包含 404 场景时 → 检查环境变量 `API_PREFIX` 是否注入，修正测试脚本中的路径拼接，**禁止在 vitest.config.ts 的 `define` 中硬编码地址**。

errorType 明确时（selector_not_found/selector_ambiguous/element_blocked），
直接根据错误信息修复，不需要启动 agent-browser——
agent-browser 诊断耗时长，只在 errorType 为 unknown 时才值得使用。

Element Plus 特定的修复策略详见 `references/element-plus-fix-patterns.md`。

## 经验库辅助修复

修复失败脚本前，可选查询 `references/fix-experience-index.md` 的 errorType 索引表，
用 classify-error 输出的 errorType + message 关键词匹配已知问题模式：

- 匹配到 → 加载对应的 `fix-experience/*.md` 经验文件，按其修复方式直接修复，减少试错
- 未匹配 → 按正常 suggestedAction 流程处理（不影响现有逻辑）

使用场景：
1. errorType 为 `unknown` 时：先查经验库再决定是否启动 agent-browser 诊断
2. 同一 errorType 连续出现多次时：查经验库看是否有系统性修复方案
3. `fix-selector` 或 `fix-api-path` 第 1 次修复失败后：查经验库看是否有更精准的修复策略

经验库是辅助手段，不改变 suggestedAction 的硬约束——
`report-defect` 仍然直接记录缺陷，`check-environment` 仍然提示用户。

## 单文件重试

修复后只重试失败的文件。详细流程见 `references/single-file-retry.md`。

**重试后必须先运行 classify-error**，按其 suggestedAction 行动（硬约束）。
单文件最多重试 3 次。


## E2E 执行与自动修复

按文件逐个执行，每个 spec 文件独立计数重试次数。
一个文件的失败不应阻塞其他文件的执行。

### 修复范围限定

修复范围由 test-summary.json 中的 `suggestedAction` 字段决定，不需要 LLM 自行判断：

| suggestedAction | 允许修改 | 禁止修改 |
|-----------------|---------|---------|
| `fix-selector` | 选择器（含持久化写回）、waitFor、fixtures.ts 覆盖层配置、storageState | 断言逻辑、请求参数、测试匹配范围 |
| `fix-api-path` | 响应字段访问路径、成功码判断 | 断言业务期望值、请求参数 |
| `report-defect` | 无（只能记录缺陷） | 所有脚本修改 |
| `check-environment` | 无（只能提示用户） | 所有脚本修改 |
| `diagnose-with-browser` | 诊断后根据结果重新分类 | 未诊断前不能修改 |

以下修改在任何情况下都禁止（属于测试逻辑变更）：
- 修改断言的业务期望值（如 expect(name).toBe('A') 改为 toBe('B')）
- 新增或删除 test() 用例
- 修改 vitest/playwright 配置的测试匹配范围
- 添加 `.catch(() => {})` 容错
- 降低断言强度（如 toBe → toBeTruthy）

以下范围在任何 suggestedAction 下都不可触碰（框架保护）：
- plugins/zcode/ 目录下的任何文件（框架脚本、配置、模板）
- testingRepo 根目录的 package.json
- node_modules/ 下的任何文件
- playwright.config.ts / vitest.config.ts 的 testDir、testMatch 等测试范围配置
遇到上述范围内的问题 → 记录到缺陷清单（type: "framework"），提示用户在独立会话中修复。

发现这些问题时，记录到缺陷清单（标注 type 为 "test-script"），
提示用户回到 run-test 修正后重新执行。

### 诊断修复循环（单文件最多 3 次）

**修复循环入口限制（硬约束）**：

只有 classify-error 输出的 suggestedAction 为以下值时才允许进入修复循环：
- `fix-selector` → 进入修复循环
- `fix-api-path` → 进入修复循环

以下 suggestedAction **禁止进入修复循环**，必须立即停止：
- `report-defect` → 立即停止，记录缺陷
- `check-environment` → 立即停止，提示用户检查环境
- `diagnose-with-browser` → 仅启动诊断，诊断后重新分类，不直接修改脚本

每次重试失败后，先运行 `classify-error.js` 获取 suggestedAction，再决定是否进入下一轮：

| 重试次数 | 前置条件 | 诊断方式 | 修复策略 |
|---------|---------|---------|---------|
| 第 1 次失败 | classify-error → `fix-selector` 或 `fix-api-path` | 分析错误信息 + 读取 dom-probe.md / api-probe.md | 根据已有探测数据修正，不启动 agent-browser |
| 第 2 次失败 | classify-error → `fix-selector` | 用 agent-browser 重新探测失败元素所在页面区域 | 根据新探测结果修正选择器，**持久化写回脚本文件**，更新 dom-probe.md 对应章节 |
| 第 3 次失败 | 任何 suggestedAction | 不再自动修复 | 标记"需人工验证" |

**上下文清理（每次修复后必做）**：

每次修复后，只保留以下关键信息，清理冗余日志：
- 修复的文件路径和修复类型（fix-selector / fix-api-path）
- 修复前后的选择器/路径变更
- 持久化的选择器变更（文件路径 + 旧选择器 → 新选择器）
- 重试结果（pass / fail）

禁止保留的内容（会污染上下文、浪费 token）：
- 完整的测试输出日志（只保留错误摘要）
- 多次修复的完整 diff 历史（只保留最近一次）
- agent-browser 的完整 DOM snapshot（只保留修复相关的部分）

**agent-browser snapshot 保留规则**：
- 第 2 次修复使用 agent-browser 重新探测后，只保留与失败元素相关的 DOM 片段（最多 50 行）
- 完整的 `page.content()` 或 `innerHTML` 输出禁止保留——提取选择器相关信息后立即丢弃
- 新探测到的选择器信息应更新到 dom-probe.md，不要在上下文中保留原始 snapshot

## 选择器持久化写回规则

当第 2 次 fix-selector 失败后使用 agent-browser 重新探测并成功修复时：

1. **写回条件**：重试通过后，必须将新选择器写回脚本文件
2. **写回范围**：只修改失败的选择器行，不修改其他代码
3. **写回方式**：
   - 定位脚本中失败的选择器（通常是 `page.locator('...')`、`page.getByRole(...)` 等）
   - 用新探测到的选择器替换旧选择器
   - 保持断言逻辑、请求参数、测试匹配范围不变（修复禁令仍然适用）
4. **验证**：写回后再次运行该文件确认修复持久化成功
5. **记录**：在上下文中记录 `{文件路径}: {旧选择器} → {新选择器}` 的变更摘要

**禁止写回的情况**：
- 修复方式是修改断言值（report-defect 类型）
- 修复方式是环境配置变更（check-environment 类型）
- 新选择器导致测试逻辑变更（不仅仅是定位器替换）

**agent-browser 在 run-test 中的合法用途（仅以下两种）**：
1. 登录态验证（test-probing 技能）：加载 storageState 后访问页面，判断是否过期
2. 第 2 次 fix-selector 失败后重新探测 DOM：dom-probe.md 可能过时，需要获取最新页面结构

禁止在第 1 次失败时就启动 agent-browser——先用已有的 dom-probe.md 数据修复。
禁止对 errorType 明确的失败（selector_not_found/element_blocked/assertion_failed）启动 agent-browser 诊断——
agent-browser 诊断耗时长（启动浏览器+加载页面+获取 snapshot），只在 errorType 为 `unknown` 或第 2 次 fix-selector 失败时才值得使用。

**classify-error → `report-defect` 时，立即停止重试循环**，不进入下一轮。
不要因为"想确认是不是真的缺陷"而启动额外诊断（截图分析、HAR 抓包、手动 API 调用等）——
这些诊断耗时长、会污染测试环境（如手动调 API 修改数据），且最终结论仍然是记录缺陷。
直接记录到缺陷清单，让开发人员判断。

### 失败分类处理

单文件重试后，以 `classify-error.js` 输出的 suggestedAction 为准：

| suggestedAction | 失败类型 | 自动处理 |
|-----------------|---------|---------|
| `fix-selector` | 选择器找不到/匹配多个/被遮挡 | 修正选择器，可重试 |
| `fix-selector` | 登录态丢失（页面跳转到登录页） | 刷新 storageState，可重试 |
| `fix-selector` | 配置错误（storageState 路径不匹配） | 修正配置，可重试 |
| `report-defect` | 断言失败（业务逻辑错误） | ⛔ 记录缺陷，停止重试 |
| `check-environment` | 网络错误 | ⛔ 提示用户，停止重试 |
| `diagnose-with-browser` | 未知错误 | 启动 agent-browser 诊断后重新分类 |

### 修复禁令

以下行为在修复过程中禁止——它们会让测试"通过"但掩盖真实问题：

- 不要降低断言强度（如 toBe → toBeTruthy）——测试失去验证价值
- 不要添加 `.catch(() => {})` 容错——失败静默通过
- 不要超过 3 次自动重试——超出说明需要人工介入
- 不要在 `suggestedAction` 为 `report-defect` 或 `check-environment` 时修改脚本
- 修复后的脚本必须仍符合 test-gate 中的质量规则
- 选择器修复通过后**必须写回脚本文件**——不持久化的修复等于没修复，下次运行同样会失败

# 截图规范（E2E 执行时强制执行）

## 报告产出路径规范

所有报告产出路径以 `{WORK_DIR}/testing/` 为根目录（集成模式），standalone 模式以 `{repoRoot}/` 为根：
- 报告输出：`{WORK_DIR}/testing/reports/`（standalone: 不适用，报告由集成模式生成）
- 截图输出：`{WORK_DIR}/testing/screenshots/`（standalone: `{repoRoot}/screenshots/`）
- 证据输出：`{WORK_DIR}/testing/evidence/`

`WORK_DIR` 来源优先级：
1. `test-config.json` 的 `workDir` 字段（最可靠，脚本化读取）
2. 编排层 path-resolution 解析的 `$WORK_DIR` shell 变量（需已 export）

禁止硬编码路径或从其他来源推断——`test-config.json` 中的 `workDir` 是唯一权威来源。
如果 `$WORK_DIR` 与 `test-config.json` 中的值不一致，以 `test-config.json` 为准。

## references 按需加载（报告阶段）

| reference 文件 | 加载条件 |
|---------------|---------|
| defect-schema.md | 生成缺陷报告时 |
| ac-matrix-generation.md | 步骤四-B 生成 AC 覆盖矩阵时 |
| verify-report-rules.md | 步骤五报告合规校验时 |

## tree-context.json 消费（功能树+菜单树增强报告）

tree-context.json 存在时（`TREE_CONTEXT` 变量非空），报告生成增强：
- 功能覆盖维度矩阵（按功能编号汇总通过率）
- 导航失败关联菜单树入口（失败分析增强）
- 不存在时保持现有报告格式，不影响报告完整性

1. 每个 `test()` 执行完毕后必须截图，命名：`{TC编号}_{步骤序号}.png`
2. 截图保存到 `$WORK_DIR/testing/screenshots/`（standalone 模式: `{repoRoot}/screenshots/`）
3. 脚本中使用 `page.screenshot()` 主动截图
4. 执行完成后，比对截图文件列表 vs TC 编号列表，输出截图完整性检查清单

# API 测试证据采集

每个 API 测试用例执行时，记录请求和响应到 `testing/evidence/api/`：

文件命名：`{接口名}-{TC编号}.json`
内容结构：
```json
{
  "tc_id": "TC-API-001",
  "timestamp": "2026-04-07T10:30:00Z",
  "request": {
    "method": "GET",
    "url": "{/url}",
    "params": { "pageNum": 1, "pageSize": 10 },
    "headers": { "Authorization": "Bearer ..." }
  },
  "response": {
    "status": 200,
    "data": { "code": 0, "msg": "success", "data": { "..." } }
  },
  "result": "pass"
}
```

证据采集的目的是让验收报告有据可查——没有请求/响应记录的 API 测试结果
无法被第三方验证，等于自说自话。

# 缺陷报告（面向 AI 修复）

## 设计理念

缺陷报告不仅是给人看的验收文档，更重要的是给 AI 开发 agent 看的修复输入。
AI agent 收到缺陷清单后应能直接定位问题代码并修复，不需要再做额外的信息收集。
因此每个缺陷必须包含足够的定位信息：模块、代码位置、错误上下文、期望 vs 实际。

## 产出文件

- `reports/defect-list.json` — 结构化缺陷清单（AI 消费）
- `reports/bug-report.md` — 可读缺陷报告（人类消费），加载模板 `skills/test-scripting/templates/bug-report-template.md` 生成

两份文件内容一致，格式不同。defect-list.json 是 AI 修复的主要输入。

## defect-list.json 结构

详见 `references/defect-schema.md`。

## 不要记录为缺陷的情况

- 选择器错误、等待超时 → 测试脚本的问题，在修复循环中解决
- 配置错误（storageState 路径、环境变量缺失）→ 修正配置
- 网络超时（服务未启动）→ 环境问题，提示用户

只有断言失败（期望值 ≠ 实际值）且排除脚本自身问题后，才记录为业务缺陷。

## sourceLocation 的获取策略

**后端缺陷**：从 API 响应的错误堆栈中提取文件名和行号；无堆栈时根据接口路径搜索 Controller → Service。
**前端缺陷**：从 Playwright 错误输出提取失败选择器和页面 URL；根据路由搜索对应组件。
**projects 为 null 时**：sourceLocation 设为 null，hint 说明"未提供源码路径"。

# 验收报告合规校验

生成报告前，根据阶段从 `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/` 加载对应模板：

| 产物 | 加载模板 |
|------|---------|
| 验收报告 | `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/acceptance-report-template.md` |
| 验收清单 | `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/acceptance-result-checklist-template.md` |
| 缺陷清单（有缺陷时） | 直接生成 defect-list.json + bug-report.md |
| 测试总结（可选） | `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/test-summary-template.md` |

报告生成后，运行合规校验脚本：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/verify-report.js" --testing-dir "$WORK_DIR/testing" --scope <scope>
```

脚本自动检查：
- 验收报告是否包含所有 13 个必填章节
- 验收清单是否存在
- E2E 截图是否覆盖所有 TC 编号
- API 证据是否覆盖所有 TC 编号
- 测试通过率是否达到 `testPolicy.stabilityThreshold` 阈值（默认 80%，从 test-summary.json 读取通过率）

读取 `testing/.cache/verify-report-result.json` 获取检查结果。
通过率未达标时必须展示选择面板等用户确认，不能静默跳过。
必填章节缺失时必须补充后重新验证。截图/证据缺失为警告，记录但不阻塞。

全部通过后标记 `report: "done"`。

验收报告中的缺陷章节应包含指向 `reports/defect-list.json` 的引用，
说明"详细缺陷信息见 defect-list.json，可直接交给开发 agent 进行修复"。

# 文件编码规范

所有报告文件（.md、.json）必须以 UTF-8 编码写入。
禁止通过 shell 重定向（`echo "..." > file.md`）写入中文内容——
Git Bash 默认编码为系统编码（Windows 下通常是 GBK/CP936），会导致中文乱码。
必须通过 LLM 的文件写入工具或 Node.js `fs.writeFileSync(path, content, 'utf-8')` 写入。
