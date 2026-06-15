# 测试执行流程

## 为什么用脚本而非 LLM 逐步执行

LLM 在长会话中容易对执行状态产生误判——把"全部失败"标记为"完成"，
或因 API 失败就跳过 E2E。脚本化执行消除这类主观误判：
结果由脚本写入 JSON，LLM 只读结构化摘要，不参与状态判断。

## 插件路径

`` 由 Claude Code 平台自动注入，无需手动解析。直接使用即可。

**写法统一规范**：
- bash 脚本中：使用 ``（平台环境变量格式）
- 文档描述中：使用 ``
- 传入 subagent 时：使用字面路径字符串

验证脚本存在，再执行：

```bash
# 脚本位于 skills/test-execution/scripts/ 目录
RUN_TESTS="$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/run-tests.js"
if [ ! -f "$RUN_TESTS" ]; then
  echo "❌ run-tests.js 不存在: $RUN_TESTS"
  echo "请确认 settings.local.json 中 pluginDirs[0] 指向正确的插件目录"
  exit 1
fi
```

**降级条件（仅以下情况才降级）**：run-tests.js 文件确实不存在，或执行时报 `MODULE_NOT_FOUND`。
路径解析失败不是降级理由——应先修复 settings.local.json 中的 pluginDirs 配置。

## run-tests 执行流程

### 标准模式（默认）

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/run-tests.js" --config "$WORK_DIR/testing/test-config.json"
```

脚本内部按顺序执行：
1. 预检（pre-check）→ 验证 baseUrl、浏览器可用性 + Windows Chrome 残留清理
2. API 测试（vitest）→ 输出 testing/.cache/api-raw.json
3. E2E 测试（playwright）→ 输出 testing/.cache/e2e-raw.json
4. 结果解析（parse-results）→ 输出 testing/.cache/test-summary.json

API 和 E2E 独立执行——一个失败不影响另一个。
预检失败时整体停止（退出码 2），避免在配置错误的情况下浪费时间。

### 阶段拆分模式（--phase）

当测试量大（>30 个文件）时，可拆分为两个独立调用，避免单次 Bash 超时：

```bash
# 阶段 1：只跑测试，输出原始 JSON
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/run-tests.js" --config "$WORK_DIR/testing/test-config.json" --phase run

# 阶段 2：只解析结果，输出 test-summary.json
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/run-tests.js" --config "$WORK_DIR/testing/test-config.json" --phase parse
```

`--phase run` 执行完测试后立即退出，不运行 parse-results。
`--phase parse` 跳过测试执行，直接解析已有的 api-raw.json 和 e2e-raw.json。

### 自适应分批执行（E2E 文件 > 30 时自动启用）

详见 `references/batch-execution.md`。

run-tests.js 自动设置 `MSYS_NO_PATHCONV=1` 环境变量，
防止 Git Bash 将 API_PREFIX（如 `/saas/erp/biz`）转换为 Windows 路径。

### Testing-Repo 独立运行模式

详见 `references/testing-repo-execution.md`。

## 读取 test-summary.json

执行完成后读取 `testing/.cache/test-summary.json`：

```json
{
  "timestamp": "2026-04-08T10:30:00Z",
  "api": { "total": 27, "passed": 25, "failed": 2, "skipped": 0, "failures": [...] },
  "e2e": { "total": 15, "passed": 12, "failed": 3, "skipped": 0, "failures": [...] }
}
```

**进程异常时**（超时被终止、启动失败等），api/e2e 对象会包含 `processError` 字段：
```json
{
  "api": { "total": 0, "passed": 0, "failed": 0, "skipped": 0, "failures": [],
           "processError": "spawnSync cmd.exe ETIMEDOUT", "killed": true }
}
```
`processError` 存在时，表示测试进程本身异常，不是测试用例失败。
- `killed: true` → 执行超时被终止（5 分钟限制），常见原因：Playwright 浏览器启动卡住、网络不通
- `killed: false` → 进程启动失败（如 vitest 配置错误、依赖缺失）

**processError 的处理**：
- **禁止进入修复循环**——进程异常不是脚本问题，修复脚本无意义
- total=0 + processError 意味着没有任何测试被执行，不能生成报告
- 调用方（run-test.md / backend-test.md）必须在读取 test-summary.json 后立即检查 processError 字段
- 存在时展示用户面板：
  ```
  ❌ 测试进程异常（{processError}）

  killed=true → 执行超时（5分钟限制），常见原因：浏览器启动卡住、网络不通
  killed=false → 进程启动失败，常见原因：vitest 配置错误、依赖缺失

  请选择：
  1. 检查环境后重新执行（推荐）
  2. 查看详细日志（.cache/e2e-console.log 或 .cache/api-console.log）
  3. 跳过该类型测试，继续执行其他类型
  ```
- 必须等待用户选择，禁止自动跳过或生成空报告
- total=0 + processError 的测试类型**不计入通过率分母**

**test-summary.json 不存在时的处理**：
- 先检查 run-tests.js 退出码：非 0 且无 JSON 输出 → 脚本启动失败
- 展示错误提示：`❌ test-summary.json 未生成，run-tests.js 可能异常退出。请检查 .cache/e2e-console.log 或 .cache/api-console.log 获取详细错误信息。`
- **禁止在 test-summary.json 不存在时继续后续步骤**——没有结构化结果就无法分类失败、无法生成报告

每个 failure 对象包含 `suggestedAction` 字段，指示 LLM 应采取的行动。

**测试状态以 test-summary.json 为准。** 禁止 LLM 自行判断"应该通过了"或"可能失败了"。
JSON 说失败就是失败，说通过就是通过。

**全量失败启发式**：parse-results.js 和 classify-error.js 会检测全量失败模式（>90% 相同错误类型），
自动将 `report-defect` 升级为 `check-environment`。
100% E2E toBeVisible 失败通常是认证过期或环境问题，不是业务缺陷。

**执行报错时必须诊断修复，不能跳过。** 如果脚本执行报错（如 vitest 启动失败、路径错误），
应该分析错误原因并修复，而不是"简化测试执行"直接生成报告。
未实际执行的测试不能出现在验收报告中——那是编造数据。

## 测试仓库模式（Phase 3）

详见 `references/testing-repo-execution.md`。
