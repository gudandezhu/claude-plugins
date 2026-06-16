---
name: auto-login-passport
user-invocable: false
description: |
  JLC 登录唯一权威文档。测试阶段的默认登录方案。
  用户自定义登录优先，通用 passport 登录为 fallback。
  前端自测 + QA 测试统一引用。
---

# JLC 自动登录

> **定位**：测试阶段登录态获取的唯一权威。前端自测 + QA 测试统一引用。
> **优先级**：用户自定义登录 > 通用 passport 登录。

## 认证判断（无预设时）

自动判断，不询问用户：

1. 检查接口文档/技术方案是���存在登录接口或认证要求
2. 检查前端代码是否有路由守卫/登录拦截
3. 不需要 → auth = null
4. 需要 → 按下方优先级获取

## 预设检测（配置阶段最优先）

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/resolve-auth.js" \
  --workspace "$JLC_AI_WORKSPACE" \
  --base-url "<frontend.baseUrl>" \
  --testing-dir "$WORK_DIR/testing"
```

读取输出 JSON 的 `status` 字段：

| status | 处理 |
|--------|------|
| `ready` | 继续执行。`localStorageState` 或 `cachedStorageState` 非空时记录路径供后续使用 |
| `no-preset` | 展示认证选择面板（见下方） |
| `no-credentials` | 展示认证选择面板（见下方） |
| `error` | 展示错误信息 + 认证选择面板 |

### 认证选择面板（禁止跳过，禁止直接询问账号密码）

```
⚠️ 认证状态未就绪: {message}

请选择：
1. 配置团队认证预设（推荐，配置一���后续自动复用）
2. 手动登录后保存 storage-state.json
3. 使用已有的 storage-state.json 文件（输入路径）
4. 跳过认证（仅适用于无需登录的公开页面）
```

**禁止直接询问账号密码，必须通过 resolve-auth.js 或选择面板获取认证信息。**

## 优先级判定

测试阶段需要登录态时，按以下顺序查找登录方案：

1. **项目 CLAUDE.md 中定义的登录脚本**
2. **`testing/auth-login.js`**（项目级自定义登录脚本）
3. **`auto-login.js`**（本 skill，通用 passport fallback）→ 仅适用于 CAS/Passport 场景
4. 都没有 → 展示手动登录面板

判定逻辑：
```
if project CLAUDE.md 含 "## 登录脚本" → 用其中记录的脚本
elif testing/auth-login.js 存在 → 用该项目脚本
elif 目标 URL 含 passport.jlc.com / CAS 特征 → 用 auto-login.js（本skill）
else → 展示手动登录面板
```

## CAS/SSO 跨域识别

出现以下特征时识别为 CAS/SSO 场景：

- 技术方案提到 CAS、SSO、单点登录、统一认证
- 前端代码跳转到 passport/sso/cas/auth 子域
- 登录过程中出现非 `frontend.baseUrl` 域的页面或 iframe
- URL 中包含 `cas`、`sso`、`passport`、`oauth`、`auth.xxx.com` 等关键词
- snapshot 中出现指向其他域的登录表单 iframe
- 不确定时默认按 CAS 处理——最坏情况只是多弹一个浏览器窗口

⛔ **禁止在 CAS 场景手动保存只覆盖单域的 storageState**——SSO TGT 丢失，Playwright 执行 E2E 时全量重定向到登录页。

## 登录态验证（auth 不为 null 且 scope 含前端时）

E2E 测试执行前必须验证登录态有效，否则所有测试都会重定向到登录页或页面空白全部失败。

⚠️ **禁止使用 python3 检查 storage-state.json**——Windows Git Bash 环境下 python3 不可靠。所有 JSON 解析必须用 node。

### 步骤 1：检查 storage-state.json

```bash
CONFIG_JSON='$WORK_DIR/testing/test-config.json'
SSO_URL=$(node -e "try{const c=require('$CONFIG_JSON');console.log(c.auth?.ssoUrl||'')}catch(e){console.log('')}")
LS_CHECKS=$(node -e "try{const c=require('$CONFIG_JSON');console.log(JSON.stringify(c.auth?.storageStatePatches?.localStorage||[]))}catch(e){console.log('[]')}")
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/check-auth.js" \
  --storage-state "$WORK_DIR/testing/auth/storage-state.json" \
  ${SSO_URL:+--sso-url "$SSO_URL"} \
  ${LS_CHECKS:+--local-storage-checks "$LS_CHECKS"}
```

读取输出 JSON 的 `status` 字段：

| status | 含义 | 处理 |
|--------|------|------|
| `valid` / `session_only` | 登录态有效 | 继续步骤 2 |
| `not_found` / `parse_error` | 文件不存在或损坏 | 先查团队缓存，无则按优先级获取 |
| `cas_tgt_missing` | CAS 域 TGT 缺失（保存登录态时未覆盖 SSO 域） | 按优先级重新获取 |
| `auth_flag_false` / `auth_flag_missing` | localStorage 标志异常 | 尝试注入修复，失败则按优先级重新获取 |
| `no_lsid_session_only` / `expired_cookie` | 登录态已失效 | 按优先级重新获取 |

注入修复方式（`auth_flag_*` 场景）：
```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/resolve-auth.js" \
    --storage-state "$WORK_DIR/testing/auth/storage-state.json" \
    --frontend-url "<frontend.baseUrl>" \
    --config "$WORK_DIR/testing/test-config.json"
```

### 步骤 2：浏览器级别验证

用 Playwright 加载 storageState 后访问一个需要认证的页面。

判断登录态失效的条件（满足任意一条）：
- URL 重定向到登录页
- snapshot 中可交互元素为 0（页面空白，路由守卫静默拦截）
- `#app` 内容为空或只有注释节点（`<!---->`）
- 页面中出现 CAS/SSO 登录 iframe（如 `dev-passport.xxx.com`）

### 步骤 3：失效时按优先级获取

失效 → 先检查认证预设：
```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/resolve-auth.js" --workspace "$JLC_AI_WORKSPACE" --base-url "<frontend.baseUrl>" --testing-dir "$WORK_DIR/testing"
```

- status = "ready" → 按优先级自动获取：
  1. 查找团队级缓存（cachedStorageState），有则复制到需求级目录
  2. 无缓存 → 按优先级执行登录（项目自定义 → auto-login.js → 手动面板）
  3. 成功 → 同步更新团队级缓存，继续执行
  4. 失败 → 降级到手动登录面板
- 其他 status → 展示手动登录面板

### 步骤 4：验证 playwright.config.ts

验证通过后确认 playwright.config.ts 中 storageState 路径配置正确。

## 通用登录（passport）

JLC 通用登录（passport）已内置纯 API 登录脚本，零浏览器依赖。

### 用法

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/auto-login.js" \
  --domain dev \
  --username <账号> \
  --password <密码> \
  --output ./storage-state.json
```

### 参数

| 参数 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `--domain` / `-d` | ✅ | 环境：dev / fat / uat / prd | — |
| `--username` / `-u` | ✅ | 账号 | — |
| `--password` / `-p` | ✅ | 密码 | — |
| `--appId` | ❌ | 应用ID | `JLC_PORTAL_PC` |
| `--redirectUrl` | ❌ | 登录后跳转URL | 根据环境自动生成 |
| `--output` / `-o` | ❌ | 输出 Playwright storageState 路径 | 仅 stdout |
| `--verbose` / `-v` | ❌ | 详细日志 | false |

### 输出

stdout 输出 JSON：

```json
{
  "success": true,
  "authCode": "AC-xxx",
  "customerCode": "00012A",
  "customerName": "公司名称",
  "cookies": [{ "name": "tgc", "value": "TGT-xxx", "domain": "" }],
  "cookieStr": "device_id=xxx; lsId=xxx; tgc=TGT-xxx; ...",
  "environment": "dev"
}
```

`--output` 输出 Playwright `storageState` 格式（可直接用于 E2E 测试）。

### 原理

```
明文 → Base64 → SM2加密(C1C3C2) → "04"前缀
→ get-init-session (获取 device_id + lsId cookie)
→ with-password (获取 authCode + TGT + CAS-SID)
```

关键：SM2 加密必须先 Base64 编码明文，再 SM2 加密。直接加密明文会返回 102280（风控拦截）。

### 与 E2E 测试集成

auto-login.js 可替代 `probe-with-playwright.js --headed` 手动登录步骤：

```bash
# 方式1：直接生成 storageState
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/auto-login.js" \
  -d dev -u 00012A -p a222222 \
  -o "$WORK_DIR/testing/auth/storage-state.json"

# 方式2：从 test-auth-preset.json 读取凭证
# (由 run-test 命令自动调用)
```

## 登录态后处理（保存 storage-state.json 后必须执行）

1. **secure cookie 修正**：baseUrl 是 HTTP 时，将 cookie `secure` 改为 `false`（Playwright 不在 HTTP 发送 secure cookie）
2. **localStorage 认证标志检查**：确认 isLogin/token/userInfo 等值为有效登录状态
3. **验证修正结果**：Playwright 加载 storageState 访问页面，确认不白屏

## 手动登录面板（自动方案全部失败时）

```
⚠️ 登录态已过期

请选择：
1. 重新手动登录（弹出有头浏览器，您完成登录后确认）
2. 跳过 E2E 测试（仅执行 API 测试）
3. 尝试继续执行（不推荐，E2E 测试大概率全部失败）
```

必须等待用户选择，禁止自动重新获取登录态——用户可能需要准备账号或 VPN。

用户选择 1 时，按优先级找到对应的登录脚本执行：
- 脚本弹出有头浏览器，等待用户完成登录（请勾选"自动登录"）
- 脚本自动等待 lsId cookie、保存 storageState、注入配置的 localStorage 标志、修正 secure cookie
- 脚本输出摘要后自动关闭，无需用户手动确认
- ⚠️ 禁止手工拼接 storageState——必须经 Playwright `context.storageState()` 输出，cookie 注入才会成功

### CAS/SSO 手动登录（Playwright headed）

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/auth/probe-with-playwright.js" \
  --config "$WORK_DIR/testing/test-config.json" \
  --headed
```

脚本行为：
1. 弹出浏览器窗口，导航到 `frontend.baseUrl`
2. 检测到 CAS 跨域跳转，提示用户手动登录
3. 用户完成登录后，脚本自动检测登录成功
4. 调用 `context.storageState()` 保存所有域 cookie（包括 SSO TGT）
5. 输出 probe-result.json（含可交互元素快照）

## 前端自测接入

前端自测（frontend-test skill）需要登录态时：
1. 加载本 skill 按优先级获取 storage-state.json
2. 用 Playwright 加载 storageState 后访问目标页面
3. 无需 AskUserQuestion 获取凭据——优先级系统已处理

## 依赖安装

```bash
npm install -g sm-crypto
```

## 故障排查

| 错误 | 原因 | 解决 |
|------|------|------|
| 102280 | JSec-X-Df 过期 | 浏览器 DevTools → passport 页面 → Network → 复制请求头中的 `JSec-X-Df`，更新脚本 `STATIC_HEADERS` |
| 连接超时 | 环境不可达 | fat/uat/prd 在内网，需 VPN 或跳板机 |
| 找不到 sm-crypto | 未安装依赖 | `npm install -g sm-crypto` |

## 常见问题

**Q：我的登录有验证码怎么办？**
- 滑块验证码：需要图像识别或第三方打码服务
- 图形验证码：同上
- 短信验证码：配置固定测试账号免验证码，或从测试环境接口获取

**Q：登录需要多步怎么办？**
- 第一步：获取 CSRF token / session
- 第二步：提交账密
- 第三步：选择账户/租户
- 按顺序调用，中间传递 cookie

**Q：token 会过期怎么办？**
- auto-login.js 每次调用获取新 token
- E2E 测试在 `auth.setup.ts` 中调用，每次测试前刷新

## 脚本路径

| 文件 | 说明 |
|------|------|
| `scripts/auth/auto-login.js` | 通用 passport 登录脚本 |
| `scripts/auth/probe-with-playwright.js` | CAS/SSO 手动登录（备选） |
| `scripts/auth/check-auth.js` | TGT 有效性检查 + localStorage 标志检查 |
| `scripts/auth/resolve-auth.js` | 认证预设解析 + storageState 注入修复 |
