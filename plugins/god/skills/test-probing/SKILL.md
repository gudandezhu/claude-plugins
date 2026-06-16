---
status: stable
name: test-probing
user-invocable: false
description: |
  真实环境探测与环境验证技能。覆盖 DOM/API 探测、环境变量注入、前后端可访问性检查、
  baseUrl 正确性验证、登录态验证、冒烟测试。
  在 /run-test Phase 1（环境验证）和 Phase 2（DOM/API 探测）时加载。
  当涉及 DOM 结构、CSS 选择器、页面元素定位、UI 框架识别、运行时弹窗处理、
  API 响应字段名验证、分页结构确认、接口真实返回值、环境验证、登录态检查时，使用此技能。
  即使用户只是提到"选择器不对"或"字段名对不上"，也应加载此技能进行探测。
---

# 为什么需要探测

设计文档不记录 DOM 结构和 CSS 类名，接口文档的字段名可能与实际实现不一致。
基于文档猜测编写的脚本首次执行必然大面积失败，反复修正浪费的时间远超探测成本。
探测将这些差异在脚本生成前暴露出来。

---

# references 按 scope 加载

references/ 目录下的文件按 scope 条件加载，禁止一次性读取全部：

| reference 文件 | 加载条件 |
|---------------|---------|
| api-probing.md | scope 含后端时加载 |
| dom-probing.md | scope 含前端时加载 |
| env-variables.md | 手动执行环境变量注入时 |

---

# API 响应探测（scope 含后端时）

按 `references/api-probing.md` 执行完整的 API 探测流程，包括 swagger-probe 脚本、降级处理、手动探测、置信度标记和 api-probe.md 产出。

# DOM 探测（scope 含前端时）

## 前置守卫：认证状态确认

scope 含前端时，DOM 探测入口必须先确认认证状态已就绪：

1. 检查会话上下文中是否已有 resolve-auth.js 的输出（由 run-test.md 认证状态检查步骤产出）
2. 如果没有（被其他命令直接触发），则在此处执行：
   ```bash
   node "$CLAUDE_PLUGIN_ROOT/scripts/auth/resolve-auth.js" \
     --workspace "$JLC_AI_WORKSPACE" \
     --base-url "${backend.baseUrl}" \
     --testing-dir "$WORK_DIR/testing"
   ```
3. status != "ready" 且 authSkipped != true → 阻塞，展示认证选择面板（同 run-test.md 定义）

**禁止跳过 resolve-auth.js 直接开始 DOM 探测。**
**禁止直接询问账号密码——必须先搜索 storage-state.json 或展示选择面板。**

按 `references/dom-probing.md` 执行完整的 DOM 探测流程，包括源码辅助提取、登录处理、逐页探测、交互后探测和 dom-probe.md 产出。
DOM 探测基于 Playwright runtime snapshot，详见 `references/dom-probing.md`。

# 探测报告复用检查（编排层调用，重新生成时）

**探测报告复用检查**（重新生成时）：
如果 `dom-probe.md` 和/或 `api-probe.md` 存在（上轮保留），先执行需求变更检测再让用户决定。

**需求变更检测**（展示面板前自动执行）：
比对以下文件的最后修改时间与 test-config.json 中 `domProbe.probedAt` / `apiProbe.probedAt` 的时间戳
（以下路径从 test-config.json 的 `paths` 字段读取，不存在时使用默认值）：
- PRD 文件：`$WORK_DIR/${paths.prd}/` 下所有 .md 文件（默认 `requirement/prd`）
- 接口文档：`$WORK_DIR/${paths.apiDocs}/` 下所有 .md 文件（默认 `tasks/api`）
- 技术方案：`$WORK_DIR/${paths.techDesign}`（默认 `design/tech-design.md`）
- 前端源码路由文件（如有 projects.frontend）：router 目录下的文件

检测结果分三种：
- 🟢 无变更：所有输入文件的修改时间早于探测时间
- 🟡 有变更：部分输入文件在探测后被修改过（列出具体文件名）
- 🔴 大幅变更：PRD 新增/删除了文件，或接口文档数量变化

展示带变更检测结果的选择面板：

```
🔍 探测报告复用检查

  dom-probe.md  ✅ 存在（探测时间：2026-04-10 14:30）
  api-probe.md  ✅ 存在（探测时间：2026-04-10 14:28）

  📋 需求变更检测：
  🟡 以下文件在上次探测后有修改：
    - requirement/prd/rule-management.md（修改于 2026-04-12 09:15）
    - tasks/api/rule-create.md（修改于 2026-04-11 16:40）
  ⚠️ 建议重新探测，修改过的文件可能影响页面结构或接口定义

请选择：
1. 复用上轮探测结果（需求未实质变更时，节省 5-10 分钟）
2. 重新探测（推荐，输入文件有变更）
3. 部分复用（只重新探测 DOM / 只重新探测 API）
```

无变更时"推荐"标注在选项 1，有变更时"推荐"标注在选项 2。
必须等待用户选择，禁止自动决定——变更检测基于文件修改时间，可能存在误判（如只改了注释不影响接口）。

用户选择 1 时：跳过探测，直接更新 progress（`domProbe: "done"`, `apiProbe: "done"`），进入阶段三。
用户选择 2 时：删除 `dom-probe.md`、`api-probe.md` 和 `.cache/` 中的探测缓存，按下方流程重新探测。
用户选择 3 时：只删除需要重新探测的部分，保留另一部分。

# 探测完整性验证（编排层调用，DOM 探测完成后）

**探测完整性验证**（DOM 探测完成后）：
```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/verify-probe.js" --testing-dir "$WORK_DIR/testing" --prd-dir "$WORK_DIR/${paths.prd}"
```

`paths.prd` 从 test-config.json 读取，默认 `requirement/prd`。

验证结果处理：

```
🔍 探测完整性验证结果

⚠️ 高优先级遗漏：
  - 新增弹窗未探测（PRD 提到"新增规则"但 dom-probe.md 无弹窗选择器）
  - 删除确认框未探测

ℹ️ 中优先级提示：
  - 分页组件未记录选择器

请选择：
1. 补充探测（推荐，回到步骤二补充遗漏的交互后探测）
2. 跳过高优先级遗漏（脚本中对应选择器将靠猜测，首次执行可能失败）
3. 全部跳过（记录但不阻塞）
```

必须等待用户明确选择，禁止自动选择跳过选项。
用户选择 1 时回到步骤二补充遗漏的交互后探测，补充完成后必须重新执行 verify-probe.js 验证。
用户选择 2 或 3 时在 dom-probe.md 中标注"以下交互未探测，选择器可能不准确"。

### 补充探测前强制：会话有效性检查

用户选择"补充探测"后，**必须先验证浏览器会话仍然有效**：

1. 用 Playwright 打开同一会话访问任意已登录页面，验证可交互元素 > 5 且无登录表单 → 会话有效，直接补充探测
2. 显示登录表单、页面空白、或元素极少 → **会话已过期**：
   - 按 `auto-login-passport` 优先级重新获取登录态（自定义脚本 > auto-login.js > 手动面板）
   - 获取成功后用 Playwright `context.storageState()` 重新加载 storageState 验证
   - 仍然失效 → 重新执行登录流程（dom-probing.md 步骤一）

**禁止在会话失效时继续操作页面**——后续所有 snapshot 和交互都会返回登录页内容，污染探测结果。

# 环境验证（run-test Phase 1）

## 手动执行（脚本不可用时的降级方案）

### ⚠️ 环境变量注入（手动执行必读）

run-tests.js 会自动注入以下环境变量，手动执行时必须自行设置，否则测试会因路径缺失或 API 404 全部失败：

```bash
# 从 test-config.json 读取配置值，设置环境变量
export WORK_DIR="$WORK_DIR"
export FRONTEND_URL="<frontend.baseUrl>"          # 如 http://localhost:9090
export API_BASE_URL="<backend.baseUrl>"            # 如 http://localhost:8080
export API_PREFIX="<backend.apiPrefix>"            # 如 /saas/erp/biz
export MSYS_NO_PATHCONV=1                          # Git Bash 防止路径转换
export MSYS2_ARG_CONV_EXCL="*"                     # 同上
```

已知故障模式详见 `references/env-variables.md`。

**快捷方式**：从 test-config.json 一次性提取所有变量：

```bash
# 读取 test-config.json 并设置环境变量（在 testing/ 目录下执行）
export WORK_DIR="$(cd .. && pwd)"
export FRONTEND_URL=$(node -e "console.log(require('./test-config.json').frontend?.baseUrl||'')")
export API_BASE_URL=$(node -e "console.log(require('./test-config.json').backend?.baseUrl||'')")
export API_PREFIX=$(node -e "console.log(require('./test-config.json').backend?.apiPrefix||'')")
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
```

浏览器相关变量（scope 含前端时）：
```bash
# Playwright Chromium 不可用时，降级到本地 Chrome
export PLAYWRIGHT_CHROME=local
```

**所有后续的手动 vitest/playwright 命令都必须在设置了上述环境变量的 shell 中执行。**

### Testing-Repo 独立运行模式

Testing-Repo 可脱离插件会话独立执行，环境变量通过 `.env` 文件管理：

```bash
# Linux/macOS
cd $TESTING_REPO && ./scripts/run.sh

# Windows PowerShell
cd $TESTING_REPO; .\scripts\run.ps1
```

**关键环境变量 `TESTING_REPO_MODE=1`**：
- 由 `run.sh` / `run.ps1` 自动设置，或由 `run-tests.js` 检测到 testing-repo 模式后设置
- 影响路径解析：
  - storageState: `.cache/.auth/storage-state.json`（而非 `testing/auth/`）
  - playwright.config.ts: 从环境变量读取配置（而非 test-config.json）
  - pre-check.js: 使用 `.cache/.auth/` 路径检查登录态

**与标准模式的差异**：

| 维度 | 标准模式（插件会话） | Testing-Repo 独立模式 |
|------|---------------------|---------------------|
| 配置来源 | test-config.json | .env 文件 |
| storageState 路径 | testing/auth/storage-state.json | .cache/.auth/storage-state.json |
| 超时配置 | test-config.json timeouts | 环境变量 TIMEOUT/NAVIGATION_TIMEOUT 等 |
| 登录态获取 | auto-login-passport 优先级系统 | auth.setup.ts（Playwright setup project） |
| 入口脚本 | run-tests.js --config test-config.json | run.sh / run.ps1 → run-tests.js --config .env |

Windows 中文环境下手动执行前先切换控制台编码，防止中文测试名称乱码：
```bash
chcp 65001    # 切换到 UTF-8 代码页（run-tests.js 自动执行，手动执行时需要手动设置）
```

### ⚠️ Windows Git Bash 手动执行禁令

以下操作在 Windows Git Bash 中会静默失败或产生错误结果，**严格禁止**：

| 禁止操作 | 问题 | 正确替代 |
|---------|------|---------|
| `VAR=value command` 内联语法 | Git Bash 不支持，env var 未注入，测试全部 404 | 先 `export VAR=value`，再单独执行命令 |
| `cat file \| node -e "readFileSync('/dev/stdin')"` | Windows 无 `/dev/stdin`，报 `ENOENT: E:\dev\stdin` | `node -e "JSON.parse(require('fs').readFileSync('文件路径','utf-8'))"` |
| `command 2>&1 \| tee results.json` 捕获测试输出 | stderr 混入 stdout，JSON 在 position N 处损坏，parse-results 报 SyntaxError | 用 `--reporter=json` 输出到文件：`npx vitest run --reporter=json > results.json 2>errors.log` |
| `python3 -c "import json..."` 解析 JSON | Windows Git Bash 下 python3 不可靠，误报文件不存在 | 统一用 `node -e "..."` |
| `node -e "readFileSync('$JLC_AI_WORKSPACE/...')"` | Git Bash 将 `$JLC_AI_WORKSPACE` 展开后 node 再拼 CWD，路径重复两段 | 先 `export WORK_DIR=...`，再 `node -e "require('fs').readFileSync(process.env.WORK_DIR+'/...')"` |

## 前端可访问性检查（scope 含前端时）

```bash
# HTTP status + page content check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "<frontend.baseUrl>")
PAGE_CONTENT=$(curl -s -L "<frontend.baseUrl>" | head -c 2000)
```

判断逻辑:
- HTTP 200 + 页面内容不含登录表单特征 → 通过
- HTTP 200 + 页面含登录特征（"登录"/"login"/"password"/"密码"/"欢迎登录"）→ 警告:
  "前端返回了登录页面。scope 含 E2E 时需要配置 auth，否则所有测试将因重定向而失败。"
- 非 200 或超时 → 提示用户确认服务已启动，等待确认后重试

## 后端可访问性检查（scope 含后端时）

```bash
curl -s -o /dev/null -w "%{http_code}" <backend.baseUrl>/health
```

HTTP 200 → 通过。超时或非 200 → 提示用户确认服务已启动，等待确认后重试。

## baseUrl 正确性验证

```bash
curl -s <backend.baseUrl><apiPrefix>/任意已知接口 | head -c 20
```

如果返回 `<!doctype` 或 `<html`，说明 baseUrl 指向了前端而非后端——
这是已知问题的根因，会导致所有 API 测试返回 HTML 而非 JSON。
立即报错，让用户修正 backend.baseUrl。

## 登录态验证（auth 不为 null 且 scope 含前端时）

加载 `skills/auto-login-passport/SKILL.md`「登录态验证」章节，按其流程执行。

## 冒烟测试（环境验证后，可选）

环境验证通过后、正式执行前，可选执行冒烟测试快速验证核心功能可用。
目的是在花大量时间跑全量测试前，用 5 分钟确认系统基本可用。

加载模板：`$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/smoke-test-template.md`

冒烟检查项（按 scope）：
- 前端：首页可访问、登录功能正常、核心页面加载无白屏
- 后端：健康检查接口返回 200、登录接口可用、核心查询接口有响应

冒烟失败 → 停止执行，输出冒烟测试报告到 reports/smoke-test-report.md，
提示用户修复后重新执行。不要在冒烟失败的情况下继续跑全量测试——
全量测试会大面积失败，浪费时间且产生大量无意义的失败记录。

冒烟失败同样生成缺陷清单（按本技能的「缺陷报告」章节格式），方便 AI 开发 agent 快速定位。

---

## 禁止事项

- 禁止自动判断用户手动登录是否完成——必须展示确认面板等待用户主动确认，用户可能在处理验证码、二次认证或 SSO 跳转
- 禁止在页面空白时手动探测 DOM 结构试图理解原因——SPA 空白几乎 100% 是未登录，直接进入登录流程
- 禁止跳过交互后探测（步骤 2b）——弹窗/抽屉内的选择器是 E2E 脚本最容易出错的地方
- 禁止用探查工具执行测试——所有测试执行由 Playwright 负责
