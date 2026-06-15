# 配置面板

> 由命令文件在展示配置面板时加载。

先静默分析技术方案、任务列表、接口文档，自动推断所有配置项的默认值，
然后一次性展示配置面板让用户确认。

**认证预设检测**（在自动推断前执行）：

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/resolve-auth.js" --workspace "$JLC_AI_WORKSPACE" --base-url "<frontend.baseUrl>" --testing-dir "$WORK_DIR/testing"
```

根据输出 status：
1. `ready` → 自动填充 auth 配置，跳过 auto-login-passport 的认证判断。配置面板中 auth 行标注"（来自团队预设）"
2. `no-credentials` → 提示用户设置环境变量（输出中有缺失的变量名），等待确认后重试
3. `no-preset` 或 `error` → 走 auto-login-passport 优先级系统

预设填充的字段：
- `auth.type` ← preset.auth.type
- `auth.ssoUrl` ← preset.auth.ssoUrl
- `auth.loginUrl` ← preset.auth.loginUrl
- `auth.credentials` ← preset.auth.credentials（引用，不复制密码）
- `auth.storageStatePatches` ← preset.auth.storageStatePatches

**自动推断逻辑**（在展示面板前完成）：
- 测试范围：检测 `task-list.json` 中是否有 FE/BE 任务
- **前端/后端地址**：host 固定 `localhost`，端口从已启动服务的 `.zcode-run/*.info` 中读取 `PORT=` 行。探测逻辑：
  ```bash
  # 从项目目录的 .zcode-run/ 读取已启动服务的实际端口
  # PROJECT_DIR 来自 tech-design.md 或 task-list.json 中的 project-dir
  detect_port_from_zcode_run() {
    local project_dir="$1"
    local default_port="$2"
    if [ -d "$project_dir/.zcode-run" ]; then
      for info_file in "$project_dir"/.zcode-run/*.info; do
        [ -f "$info_file" ] || continue
        local port
        port=$(grep '^PORT=' "$info_file" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
        if [ -n "$port" ]; then
          echo "$port"
          return
        fi
      done
    fi
    echo "$default_port"
  }
  ```
  - 前端端口：`detect_port_from_zcode_run {前端项目目录} 9090`
  - 后端端口：`detect_port_from_zcode_run {后端项目目录} 8080`
  - 项目目录未提供或 `.zcode-run/` 不存在 → 使用默认端口
  - 最终地址格式：`http://localhost:{检测到的端口}`
- API 前缀：按下方「API 路径探测」章节执行
- Swagger 地址：从后端地址拼接 `http://localhost:{后端端口}/v3/api-docs`
- 技术栈：从 package.json 检测 vue/react，从 pom.xml/build.gradle 检测 spring-boot
- 源码路径：检查 `tech-design.md` 中是否有项目路径信息
- 输入路径：按以下脚本逐项探测，未找到的项显示"（未提供）"
  ```bash
  # 探测接口文档目录（按优先级）
  API_DOCS_PATH=""
  for dir in "design/task/api" "requirement/api" "design/api" "tasks/api"; do
    if [ -d "$WORK_DIR/$dir" ] && ls "$WORK_DIR/$dir/"*.md >/dev/null 2>&1; then
      API_DOCS_PATH="$dir"
      break
    fi
  done
  echo "API_DOCS_PATH=$API_DOCS_PATH"
  ```
  PRD/UI/技术方案/任务列表路径用 `ls` 检测 `$WORK_DIR` 下对应目录是否存在。

**展示格式**：

```
⚙️ 测试配置 — {功能名称}（需求 {需求编号}）

┌─ 基本配置 ──────────────────────────────────────────┐
│  1. 测试范围    [✓] 前后端（推荐）                     │
│  2. 前端地址    http://localhost:{前端端口}             │
│  3. 后端地址    http://localhost:{后端端口}             │
│     API 前缀    （由探测自动填充）                      │
│  4. Swagger     http://localhost:{后端端口}/v3/api-docs │
└───────────────────────────────────────────────────────┘
┌─ 项目配置 ──────────────────────────────────────────┐
│  5. 前端源码    （未提供）                              │
│  6. 后端源码    （未提供）                              │
│  7. 技术栈      Java + Vue 3 + Element Plus           │
└───────────────────────────────────────────────────────┘
┌─ 输入路径（自动推断，可修改）────────────────────────┐
│  8. PRD 目录     requirement/prd                      │
│  9. UI 原型目录  requirement/ui                       │
│  10. 技术方案    design/tech-design.md                │
│  11. 接口文档    {API_DOCS_PATH 或 （未提供）}          │
└───────────────────────────────────────────────────────┘
┌─ 认证配置（有预设时显示）────────────────────────────┐
│  12. 认证方式   CAS/SSO（来自团队预设）               │
│      SSO 地址   dev-passport.jlcops.com              │
│      测试账号   ✅ 已配置（环境变量）                  │
└───────────────────────────────────────────────────────┘

👉 直接回车确认，或输入编号修改（如 "2 http://localhost:3000"）
```

用户直接回车 → 全部采用默认值。输入编号 → 只修改对应项。
API 前缀冲突时必须用户选择——自动选择可能选错，导致后续所有请求失败。
输入路径默认值通过上述探测脚本自动推断，目录不存在时留空显示"（未提供）"。

**Q5: 自动执行配置**（可选，用户确认基本配置后追问）：

```
Q5: 是否启用自动执行？（修 BUG 后重跑时跳过交互确认）
    → 默认关闭
    → 启用 → 追问：
        Q5a: 默认案例类型？（全部 / 仅E2E / 仅API / 仅Flow）
        Q5b: 默认脚本类型？（全部 / 仅E2E / 仅API流程）
        Q5c: 默认测试范围？（全部 / API / E2E）
        Q5d: 默认执行模式？（并行 / 串行）
        Q5e: 倒计时秒数？（默认 30）
```

写入 test-config.json 的 `autoExecute` 字段。无 `autoExecute` 字段或子字段时，各命令按 `enabled=false` 处理，使用各命令自身硬编码的默认值。

**autoExecute.mode 字段说明**：

| 值 | 说明 | 适用场景 |
|----|------|---------|
| `parallel` | 并行执行（默认，推荐） | CI 环境、后端性能充足、快速回归 |
| `serial` | 串行执行 | 单机开发环境、首次执行、后端性能有限 |

**并行优先策略**：
- gen-test: E2E/API/Flow 并行生成 subagent
- run-test: E2E+API 流程并行 subagent
- run-test: API+E2E 并行执行（独立进程，一个失败不影响另一个）

## API 测试认证 — helpers/auth.ts

```typescript
import axios from 'axios';
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const API_PREFIX = process.env.API_PREFIX || '';
export async function getAuthToken(): Promise<string> {
  const response = await axios.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    { username: process.env.TEST_USERNAME, password: process.env.TEST_PASSWORD }
  );
  return response.data.data.token;
}
```

## 浏览器降级策略

内网环境下 Playwright Chromium 无法下载时的降级：

1. 优先本地 Chrome（pre-check.js 自动检测路径）
2. 检测到 → 自动配置 `channel: 'chrome'`，更新 test-config.json `"browser": "local-chrome"`
3. 无本地 Chrome 但 Playwright Chromium 已安装 → 使用 Playwright Chromium
4. 都没有 → 停止，提示安装

gen-skeleton.js 默认 `channel: 'chrome'`，除非 `PLAYWRIGHT_CHROME=playwright` 显式指定。
