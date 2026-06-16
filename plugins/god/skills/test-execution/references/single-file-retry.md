# 单文件重试

> 由 run-test/backend-test 在修复后重试单个失败文件时加载。
> 也包含从 SKILL.md 提取的单文件重试规范。

## 单文件重试规范（来自 SKILL.md）

修复后只重试失败的文件，不重跑全量。**必须使用 `--reporter=json` 并输出到文件**。

**手动执行时**：确保已按 `test-probing` 技能的「环境变量注入」章节设置了所有环境变量（WORK_DIR、API_BASE_URL、API_PREFIX 等），
否则重试也会因同样的环境问题失败。

```bash
# 必须从 testing/ 目录执行，确保使用本地 node_modules 中的 playwright
# 用 PLAYWRIGHT_JSON_OUTPUT_NAME 让 Playwright 直接写文件，避免 stdout 管道死锁和上下文污染
cd $WORK_DIR/testing
MSYS_NO_PATHCONV=1 PLAYWRIGHT_JSON_OUTPUT_NAME=.cache/retry-raw.json npx playwright test <单个文件> 2>.cache/retry-raw.log
```

API 单文件重试：
```bash
cd $WORK_DIR/testing
MSYS_NO_PATHCONV=1 npx vitest run --config scripts/api/vitest.config.ts <单个文件> --reporter=json > .cache/retry-api-raw.json 2>.cache/retry-api-raw.log
```

**禁止不带 JSON reporter 执行测试**——playwright.config.ts 已配置双 reporter（json + line），
JSON 输出由 `PLAYWRIGHT_JSON_OUTPUT_NAME` 控制。没有 JSON 输出，classify-error.js 无法运行，
suggestedAction 机制完全失效，LLM 会回到"自行判断"的老路上。

**重试后必须先运行 classify-error，再决定下一步行动**：
```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/classify-error.js" --file testing/.cache/retry-raw.json --type e2e
```

（`$CLAUDE_PLUGIN_ROOT` 已在「`$CLAUDE_PLUGIN_ROOT` 解析」章节中设置）

脚本输出每个失败的 `suggestedAction`，LLM 必须按此行动：
- `report-defect` → ⛔ 立即停止重试循环，记录缺陷，不要启动任何诊断（截图分析、HAR 抓包、手动 API 调用都禁止）
- `fix-selector` → 🔧 修正选择器，可以再次重试
- `check-environment` → ⛔ 停止重试，提示用户
- `diagnose-with-browser` → 🔍 启动 Playwright 诊断

**禁止跳过 classify-error 直接分析错误**——这是 LLM 绕过 suggestedAction 机制的根因。
LLM 看到 `expect(received).not.toBe(expected)` 可能会启动一轮冗长的诊断（截图分析、HAR 抓包、手动 API 调用），
但 classify-error 会直接告诉它这是 `assertion_failed` → `report-defect`，不需要诊断，直接记录缺陷。

单文件最多重试 3 次。3 次是硬限制——超过说明问题超出自动修复能力，
继续重试只会浪费时间和上下文。

---

## 前置条件

⚠️ 以下 shell 变量必须在加载本文件前已设置（由编排层在 path-resolution 完成后 export）：
- `$WORK_DIR` — 工作目录（如 `E:/ai-workspace/process-docs/JLCS1-100003`）
- `$CLAUDE_PLUGIN_ROOT` — 插件目录

如果变量未设置，重试命令中的路径会为空，导致 `cd` 到错误目录或 `classify-error.js` 找不到。
编排层（run-test.md / backend-test.md）必须在 path-resolution 完成后执行：
```bash
export WORK_DIR="{WORK_DIR_LITERAL}"
```

## E2E 单文件重试

```bash
cd $WORK_DIR/testing
MSYS_NO_PATHCONV=1 PLAYWRIGHT_JSON_OUTPUT_NAME=.cache/retry-raw.json npx playwright test <单个文件> --reporter=json 2>.cache/retry-raw.log
```

testingRepo 模式下，`<单个文件>` 使用 testingRepo 中的完整路径（如 `$TESTING_REPO/$PROJECT_DIR/tests/e2e/flows/FLOW-001_test.spec.ts`），脚本修复也直接在 testingRepo 中进行。

## API 单文件重试

```bash
cd $WORK_DIR/testing
MSYS_NO_PATHCONV=1 npx vitest run --config scripts/api/vitest.config.ts <单个文件> --reporter=json > .cache/retry-api-raw.json 2>.cache/retry-api-raw.log
```

## 重试后必须运行 classify-error

```bash
# E2E
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/classify-error.js" --file testing/.cache/retry-raw.json --type e2e

# API
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/classify-error.js" --file testing/.cache/retry-api-raw.json --type api
```

（`$CLAUDE_PLUGIN_ROOT` 已在路径解析阶段设置）

## 规则

- **禁止不带 `--reporter=json` 执行测试**——没有 JSON 输出，classify-error 无法运行
- **禁止跳过 classify-error 直接分析错误**——这是绕过 suggestedAction 机制的根因
- 单文件最多重试 3 次（硬限制）
- 必须从 `testing/` 目录执行，确保使用本地 node_modules 中的 playwright/vitest
- 用 `PLAYWRIGHT_JSON_OUTPUT_NAME` 让 Playwright 直接写文件，避免 stdout 管道死锁
