# storageState 登录态失效（CAS/SSO session cookie）

> **注意**：本文档以 `SAASERPCASLOGIN` 为示例说明问题模式。实际的 localStorage 认证标志名称应通过 `test-config.json` 的 `auth.storageStatePatches.localStorage` 配置，由 `check-auth.js` 和 `pre-check.js` 读取检查。

## 症状

- errorType: `assertion_failed`（全部 20 个测试）
- message 关键词: `waitForSelector .el-table timeout` / `page blank` / `SAASERPCASLOGIN=false`
- 表现：所有 E2E 测试在 `beforeEach` 的表格等待处超时，失败模式完全一致

## 根因

三个叠加问题：

1. **SAASERPCASLOGIN 在 sessionStorage**：应用路由守卫读取此标志判断是否已登录。`storageState()` 只保存 localStorage，sessionStorage 不保存，导致新 Playwright context 加载时此标志为 `false`，路由守卫拦截，页面空白。

2. **session cookie 跨实例失效**：`SAAS_ERP_CUSTOMER_SESSION_ID` 是服务端 session cookie（`expires=-1`），绑定原始浏览器实例。新 Playwright context 加载同一 cookie，服务端拒绝，重定向到登录页。

3. **agent-browser 格式不兼容**：用 agent-browser 保存的 storageState 格式与 Playwright 不兼容，cookie 无法注入（`document.cookie` 为空）。

## 影响范围

系统性——所有使用 CAS/SSO 登录的项目都会出现此问题。

## 修复方式（脚本层面）

1. 必须用 `auth-login.js`（Playwright 原生）保存 storageState，禁止用 agent-browser
2. 登录时必须勾选"自动登录"，确保 `lsId` 持久 token 生成
3. `auth-login.js` 保存后自动 patch：注入 `SAASERPCASLOGIN=true` 到 localStorage origins，修正 `sameSite=None→Lax` + `secure=false`

快速修复已有 storageState（不重新登录）：
```bash
node -e "
const fs = require('fs');
const p = 'testing/auth/storage-state.json';
const state = JSON.parse(fs.readFileSync(p, 'utf-8'));
const origin = (state.origins || []).find(o => o.origin === 'http://localhost:9090');
if (origin) {
  const entry = (origin.localStorage || []).find(i => i.name === 'SAASERPCASLOGIN');
  if (entry) entry.value = 'true';
  else origin.localStorage.push({ name: 'SAASERPCASLOGIN', value: 'true' });
}
fs.writeFileSync(p, JSON.stringify(state, null, 2));
console.log('patched');
"
```

## 修复方式（插件层面）

- `testing/auth-login.js`：等 `lsId` cookie、保存后注入配置的 localStorage 标志、修正 sameSite/secure（已修复）
- `skills/test-execution/scripts/check-auth.js`：新增 `--local-storage-checks` 参数，从配置读取 localStorage 检查项；新增 `--sso-url` 参数检测 CAS TGT（已修复）
- `skills/test-execution/scripts/pre-check.js`：从 `auth.storageStatePatches.localStorage` 读取检查项（已修复）


> 相关经验：CAS TGT 缺失（agent-browser state save 导致）见 `fix-experience/e2e-cas-tgt-missing.md`

## 预防措施

调试模式登录态检查时，除了检查 cookie 过期时间，还必须检查：
- localStorage 中配置的认证标志（`auth.storageStatePatches.localStorage`）是否为期望值
- `lsId` cookie 是否存在（无 lsId = 未勾选自动登录 = session 跨实例必然失效）
