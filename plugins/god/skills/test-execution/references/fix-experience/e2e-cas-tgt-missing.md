# CAS/SSO 跨域登录 TGT 缺失导致 E2E 全量重定向到登录页

## 症状

- E2E 测试 100% 失败，失败模式：页面重定向到 CAS 登录页
- classify-error 输出 `check-environment`，message 含 CAS/SSO 域 URL
- pre-check.js 输出 `cas_tgt_missing`
- curl 直接访问后端 API 返回 200（后端 session 有效），但 Playwright 仍被重定向

## 根因

CAS 认证流程：`localhost:9091 → 重定向到 dev-passport.xxx.com → 用户登录 → TGT cookie 写入 CAS 域 → 重定向回 localhost`

`agent-browser state save` 只保存**当前页面域**（localhost）的 cookie，CAS 域的 TGT（Ticket Granting Ticket）不会被捕获。

Playwright 加载 storageState 后：
- localhost 的 session cookie 存在 → 后端 API 正常
- CAS 域的 TGT 不存在 → 前端路由守卫触发 CAS 验证 → 重定向到登录页

## 影响范围

系统性——所有使用 CAS/SSO 跨域登录的项目都会出现此问题。

## 修复方式（项目层面）

**必须用 Playwright 的 `context.storageState()` 保存登录态**，不能用 `agent-browser state save`。

Playwright context 在整个会话中访问过的所有域的 cookie 都会被捕获，包括 CAS 域的 TGT。

运行项目的 `auth-login.js`（使用 CAS 模板生成）：

```bash
WORK_DIR="$WORK_DIR" \
FRONTEND_URL="http://localhost:9091" \
node "$WORK_DIR/testing/auth-login.js"
```

auth-login.js 会：
1. 用 Playwright 有头浏览器打开登录页
2. 等待用户完成 CAS 登录（请勾选"自动登录"）
3. 用 `context.storageState()` 保存所有域的 cookie（含 CAS 域 TGT）
4. 自动注入配置的 localStorage 认证标志并修正 secure cookie

## 修复方式（插件层面）

已修复以下文件：

- `skills/test-execution/scripts/check-auth.js`：
  - 新增 `--sso-url` 参数
  - 新增 `cas_tgt_missing` 状态：检查 storageState 中是否包含 SSO 域 cookie

- `skills/test-execution/scripts/pre-check.js`：
  - auth 检查分支新增 CAS 域 cookie 检查（读取 `config.auth.ssoUrl`）
  - `cas_tgt_missing` 时预检失败并输出明确提示

- `skills/test-probing/SKILL.md`：
  - check-auth.js 调用加入 `--sso-url` 参数（从 test-config.json 读取）
  - 新增 `cas_tgt_missing` 状态处理说明

- `skills/auto-login-passport/SKILL.md`：
  - 登录唯一权威，包含完整优先级链、CAS/SSO 识别、手动面板
  - 明确禁止 CAS 场景使用 `agent-browser state save`

## 预防措施

1. `test-config.json` 中 CAS 项目必须设置 `auth.ssoUrl`（如 `"dev-passport.xxx.com"`）
2. pre-check.js 步骤 6 会自动检测 TGT 缺失并阻断测试执行
3. auth-login.js 必须使用 CAS 模板（`auth-templates.md` 策略二-CAS），不能用 agent-browser 版本
