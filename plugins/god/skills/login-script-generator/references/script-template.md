# 登录脚本模板

## 模板 A：单步登录（无加密）

适用：密码明文传输，单次 POST 获取 token/session。

```javascript
#!/usr/bin/env node
// {{SCRIPT_NAME}} — 自动生成的登录脚本
// 用法: node {{SCRIPT_NAME}}.mjs [-u USER] [-p PASS] [-o output.json]
const BASE = '{{BASE_URL}}';

const args = process.argv.slice(2);
const getArg = (f, fb) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : fb; };
const username = getArg('-u');
const password = getArg('-p');
const output = getArg('-o');
if (!username || !password) { console.error('用法: node {{SCRIPT_NAME}}.mjs -u <账号> -p <密码> [-o output.json]'); process.exit(1); }

class CookieJar {
  _c = {};
  capture(resp) {
    for (const raw of (resp.headers.getSetCookie?.() || [])) {
      const [kv] = raw.split(';');
      const [k, ...v] = kv.split('=');
      this._c[k.trim()] = v.join('=');
    }
  }
  get header() { return Object.entries(this._c).map(([k, v]) => `${k}=${v}`).join('; '); }
}

async function run() {
  const jar = new CookieJar();
  const req = async (method, urlPath, body) => {
    const r = await fetch(`${BASE}${urlPath}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(jar.header ? { Cookie: jar.header } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    jar.capture(r);
    return r.json();
  };

  // ── 登录 ──
  const lr = await req('POST', '{{LOGIN_API_PATH}}', { {{USERNAME_FIELD}}: username, {{PASSWORD_FIELD}}: password });
  if (lr.code !== {{SUCCESS_CODE}}) throw new Error(`[${lr.code}] ${lr.message}`);

  // ── 输出 ──
  const result = { success: true, cookies: jar._c };
  if (output) {
    const fs = await import('fs');
    // TODO: 转换为 Playwright storageState 格式
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result, null, 2));
}

run().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
```

## 模板 B：密钥交换 + 登录（ERP 模式）

适用：先获取加密密钥，再登录，可能需要选择企业/租户。

```javascript
#!/usr/bin/env node
// {{SCRIPT_NAME}} — 自动生成的登录脚本
// 用法: node {{SCRIPT_NAME}}.mjs [-u USER] [-p PASS] [-e IDX] [-o output.json]
const BASE = '{{BASE_URL}}';

const args = process.argv.slice(2);
const getArg = (f, fb) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : fb; };
const username = getArg('-u');
const password = getArg('-p');
const entIdx = +getArg('-e', 0);
const output = getArg('-o');
if (!username || !password) { console.error('用法: node {{SCRIPT_NAME}}.mjs -u <账号> -p <密码> [-e 企业序号] [-o output.json]'); process.exit(1); }

class CookieJar {
  _c = {};
  capture(resp) {
    for (const raw of (resp.headers.getSetCookie?.() || [])) {
      const [kv] = raw.split(';');
      const [k, ...v] = kv.split('=');
      this._c[k.trim()] = v.join('=');
    }
  }
  get header() { return Object.entries(this._c).map(([k, v]) => `${k}=${v}`).join('; '); }
}

async function run() {
  const jar = new CookieJar();
  const req = async (method, urlPath, body, keyId) => {
    const r = await fetch(`${BASE}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(jar.header ? { Cookie: jar.header } : {}),
        ...(keyId ? { secretkey: keyId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    jar.capture(r);
    return r.json();
  };

  // 1. 密钥交换
  const { data: kp } = await req('POST', '{{SECRET_API_PATH}}');

  // 2. 登录
  const lr = await req('POST', '{{LOGIN_API_PATH}}', {
    {{USERNAME_FIELD}}: username,
    {{PASSWORD_FIELD}}: password,
    autoLoginFlag: true,
  }, kp.keyId);
  if (lr.code !== {{SUCCESS_CODE}} && lr.code !== {{SUCCESS_CODE_ALT}}) throw new Error(`[${lr.code}] ${lr.message}`);

  // 3. 选择企业（如需要）
  const { data: ents } = await req('GET', `{{ENTERPRISE_LIST_API}}?_t=${Date.now()}`, null, kp.keyId);
  const sel = ents?.[Math.min(entIdx, (ents?.length || 1) - 1)];
  if (sel) {
    await req('POST', '{{ENTERPRISE_SELECT_API}}', {
      tenantId: sel.tenantId,
      customerId: String(sel.customerId),
    }, kp.keyId);
  }

  // ── 输出 ──
  const result = { success: true, enterprise: sel?.enterpriseName, cookies: jar._c, keyPair: kp };
  if (output) {
    const fs = await import('fs');
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result, null, 2));
}

run().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
```

## 模板 C：SM2 加密登录

适用：密码需要 SM2 加密后传输。

```javascript
#!/usr/bin/env node
// {{SCRIPT_NAME}} — 自动生成的登录脚本（SM2 加密）
// 用法: node {{SCRIPT_NAME}}.js [-u USER] [-p PASS] [-o output.json]
// 依赖: npm install -g sm-crypto

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── SM2 加载 ──
let sm2;
function loadSm2() {
  if (sm2) return sm2;
  const paths = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules'),
    '/usr/local/lib/node_modules',
  ].map(p => path.join(p, 'sm-crypto'));
  for (const p of [...paths, 'sm-crypto']) {
    try { sm2 = require(p).sm2; return sm2; } catch {}
  }
  console.error('[FAIL] npm install -g sm-crypto'); process.exit(1);
}

function sm2Encrypt(plaintext, publicKey) {
  const b64 = Buffer.from(plaintext, 'utf-8').toString('base64');
  return '04' + loadSm2().doEncrypt(b64, publicKey, 1);
}

// ── 配置 ──
const SM2_PUBLIC_KEY = '{{SM2_PUBLIC_KEY}}';
// ... 其余同模板 A/B，密码字段用 sm2Encrypt(password, SM2_PUBLIC_KEY) 替换
```

## 模板 D：agent-browser 注入模式

适用：登录后需要将 cookie/localStorage 注入到浏览器（如个性化登录脚本）。

在任意模板的输出部分追加：

```javascript
// ── 注入浏览器 ──
import { execSync } from 'node:child_process';

const cookieJs = Object.entries(jar._c)
  .map(([k, v]) => `document.cookie='${k}=${v};path=/;secure;samesite=none';`)
  .join('');

const lsJs = {{LOCALSTORAGE_ENTRIES}}
  .map(([k, v]) => `localStorage.setItem('${k}','${v.replace(/'/g, "\\'")}');`)
  .join('');

const js = cookieJs + lsJs;
for (const cmd of [
  `agent-browser open ${BASE}/favicon.ico`,
  `agent-browser wait 1500`,
  `agent-browser eval "${js}"`,
  `agent-browser open ${BASE}/#/workbench`,
  `agent-browser wait 8000`,
]) { try { execSync(cmd, { stdio: 'pipe', timeout: 20000, shell: true }); } catch {} }
```

## storageState 输出格式

所有模板应支持 `--output` 输出 Playwright storageState：

```javascript
function toStorageState(cookies, frontendUrl, localStorageEntries) {
  return {
    cookies: cookies.map(([name, value, domain]) => ({
      name, value,
      domain: domain || new URL(frontendUrl).hostname,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: frontendUrl.startsWith('https'),
      sameSite: 'Lax',
    })),
    origins: [{
      origin: new URL(frontendUrl).origin,
      localStorage: localStorageEntries.map(([name, value]) => ({ name, value })),
    }],
  };
}
```
