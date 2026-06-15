# Subagent 生成策略

## 使用时机

run-test 阶段二默认使用 script-writer subagent 生成脚本。
test-writer subagent 作为降级路径，在 script-writer 不可用时使用。

编排层（run-test.md）按以下流程启动 subagent。

**技能加载机制**：编排层读取对应 prompt 文件内容，拼接到 subagent prompt 中。
Subagent 是独立上下文，无法自行"加载"技能文件。

## 默认路径：Script Writer Subagent

1. 读取 prompt 模板：`$CLAUDE_PLUGIN_ROOT/skills/test-scripting/prompts/script-writer.md`
2. 替换模板变量（必须使用 `{WORK_DIR_LITERAL}` 字面路径，subagent 不继承环境变量）：
   - `{workDir}` → `{WORK_DIR_LITERAL}`
   - `{testConfigPath}` → `{WORK_DIR_LITERAL}/testing/test-config.json`
   - `{domProbePath}` → `{WORK_DIR_LITERAL}/testing/dom-probe.md`
   - `{apiProbePath}` → `{WORK_DIR_LITERAL}/testing/api-probe.md`
   - `{domProbeSummaryPath}` → `{WORK_DIR_LITERAL}/testing/.cache/dom-probe-summary.json`
   - `{e2eCasesPath}` → `{WORK_DIR_LITERAL}/testing/test-cases/e2e-test-cases.md`
   - `{flowCasesPath}` → `{WORK_DIR_LITERAL}/testing/test-cases/api-flow-test-cases.md`
   - `{e2eSkeletonFileList}` → E2E 骨架文件路径列表（字面路径）
   - `{apiSkeletonFileList}` → API 骨架文件路径列表（字面路径）
   - `{e2eScriptsOutputDir}` → 功能树存在时：`{TESTING_REPO_LITERAL}/{PROJECT_DIR}/tests/e2e/features/{groupDir}/`；不存在时：`{TESTING_REPO_LITERAL}/{PROJECT_DIR}/tests/e2e/features/`
   - `{apiScriptsOutputDir}` → `{TESTING_REPO_LITERAL}/{PROJECT_DIR}/tests/api/features/`
   - `{groupId}` → 功能树第一个 group 的 ID（如 `PRQL-FLTR`），无功能树时传空字符串
   - `{groupDir}` → 功能树 groupId（如 `PRQL-FLTR`），无功能树时传空字符串
   - `{scope}` → test-config.json 中的 scope 值
3. 通过当前环境的 subagent 机制调用

**script-writer 不再传入外部规范文件路径**（e2e-case-writing.md / element-plus-scripting-rules.md）。
这些规范的 TOP 5 关键要点已内嵌到 script-writer.md 的「七条元原则」中。
完整规范文件仍保留在 `references/` 目录，供 gate-check checkers 和 quality-auditor 使用。

**禁止传入的内容**：PRD 原文路径、UI 原型路径——script-writer 只消费案例文档，不做案例设计。
**禁止读取源码**：选择器和 API 路径必须从探测报告（dom-probe.md / api-probe.md）获取，禁止读取 projects/ 目录下的源码文件。subagent prompt 中必须包含此禁令。

Script Writer 内部按 scope 顺序生成：
- scope 含前端 → 生成 E2E 脚本 + 更新案例为 v2
- scope 含后端 → 生成 API 流程脚本（不生成单 API 脚本）

### testingRepo 相关模板变量（默认包含）

testingRepo 是强制配置项，以下变量始终可用：
   - `{acFilePath}` → `{AC_FILE_LITERAL}`（Step 0 确定的实际路径）
   - `{apiHelpersPath}` → `{WORK_DIR_LITERAL}/testing/scripts/api/helpers/`（helpers 始终在原始工作目录，testingRepo 模式下脚本应使用 `@helpers` alias import）
   - `{featureTreeFragment}` → `{TESTING_REPO_LITERAL}/feature-tree/index.json`（不存在时传空字符串）
   - `{selectorsModulePath}` → `{TESTING_REPO_LITERAL}/{PROJECT_DIR}/selectors/`（不存在时传空字符串）
   - `{stepHelpersPath}` → `{TESTING_REPO_LITERAL}/{PROJECT_DIR}/step-helpers/`（不存在时传空字符串）
   - `{treeContextPath}` → `{WORK_DIR_LITERAL}/testing/.cache/tree-context.json`（功能树+菜单树上下文，不存在时传空字符串）

### Script Writer 内部行为（E2E subagent）

- 读取 v1 E2E 案例文档
- 读取探测报告，补充技术细节
- 生成 E2E 脚本（不生成单 API 脚本）
- 更新 E2E 案例文档为 v2
- 输出 script-generation-summary.json

## 降级路径：Test Writer Subagent

script-writer 遇到服务端错误时，降级到 test-writer subagent。

1. 读取 prompt 模板：`$CLAUDE_PLUGIN_ROOT/skills/test-scripting/prompts/test-writer.md`
2. 替换模板变量（与 script-writer 相同，必须使用 `{WORK_DIR_LITERAL}` 字面路径；额外增加案例文档输出路径）：
   - `{e2eCasesOutputPath}` → `{WORK_DIR_LITERAL}/testing/test-cases/e2e-test-cases.md`
   - `{apiCasesOutputPath}` → `{WORK_DIR_LITERAL}/testing/test-cases/api-test-cases.md`
3. 传入 `references/e2e-case-writing.md` + `references/api-case-writing.md` 路径（subagent 自行读取，不内联）
4. test-writer 同时生成案例和脚本（兼容旧流程）

## 降级策略

### 降级判断

Subagent 返回后，**必须先执行产出验证脚本**，再判断是否降级：

**E2E 产出验证**（scope 含前端时）：检查 `{e2eScriptsOutputDir}` 下 `.spec.ts` 文件存在且总大小 >500 字节，输出 `OK` 或 `NO_OUTPUT`。
**API 流程产出验证**（scope 含后端时）：检查 `{apiScriptsOutputDir}` 下 `.api.test.ts` 文件存在且总大小 >500 字节，输出 `OK` 或 `NO_OUTPUT`。

以下任一情况触发降级：
- Subagent 重试一次后仍然失败
- Subagent 执行中断且无法恢复
- Subagent 返回但输出 token 极低（< 2000 tokens）
- **产出验证脚本输出 `NO_OUTPUT`**（无论 subagent 是否报错）

## 并行 subagent 调度

编排层使用多个 Agent 工具调用同时启动两个 subagent：

```
Agent({ description: "E2E script generation", prompt: e2ePrompt })
Agent({ description: "API flow script generation", prompt: apiFlowPrompt })
```

### 并行失败策略

1. 两个 subagent 并行启动
2. 任一 subagent 失败 → 等待另一个完成 → 对失败的那个串行重试
3. 串行重试也失败 → 执行标准降级流程（轻量 writer subagent）

### 并行产物验证

两个 subagent 都完成后，分别执行产出验证脚本：
- E2E 产出 OK → 完成
- E2E 产出 NO_OUTPUT → 对 E2E 部分执行降级
- API 产出 OK → 完成
- API 产出 NO_OUTPUT → 对 API 部分执行降级

### 降级流程

1. **确认已完成产出**：以产出验证脚本结果为准（`OK` = 已完成，`NO_OUTPUT` = 未完成）
2. **确定补充范围**：E2E 已完成则只补充流程脚本，反之亦然
3. **派发轻量 writer subagent**（第一降级选项）：
   - 只传入：输出路径、案例文档路径、探测报告路径、骨架文件路径、脚本规范路径
   - 所有路径使用 `{WORK_DIR_LITERAL}` 字面路径
   - subagent 自行读取文件，不在 prompt 中内联内容
   - 轻量 subagent 上下文小，成功率远高于主会话直接生成
4. **轻量 subagent 也失败时**：立即停止，输出以下消息后**禁止执行任何后续文件操作（包括 Read、Write、Edit、Bash、Update）**：
   ```
   ❌ Subagent 连续失败，无法生成脚本。
   请开启新会话重试：/zcode:run-test {需求编号}
   ```
5. **禁止退化到主会话直接生成或修改脚本文件**——无论是新建文件还是修改现有文件，主会话此时上下文已重（经历了探测+subagent 调度+失败检测），Bash/Write/Edit 工具的参数会因 token 压力被截断，且绕过了 subagent 的质量规范，导致产物不可信

### 降级通知

```
⚠️ Subagent 遇到错误，已切换到轻量 subagent 重试。
已完成：{已完成的部分}
待生成：{待生成的部分}
```
