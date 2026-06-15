---
name: login-script-generator
user-invocable: true
description: |
  登录脚本生成器。用 agent-browser 抓包分析登录流程，自动生成 Node.js 登录脚本。
  支持通用 passport 登录和个性化登录，用户只需提供 URL + 账号密码。
---

# 登录脚本生成器

用 agent-browser 打开登录页 → 填入账密 → 抓包 → 分析 → 生成脚本。

## 前置条件

- agent-browser 可用（`npx agent-browser --version`）
- 目标页面可访问

## 输入

向用户收集以下信息（交互式提问，不强求一次给齐）：

| 信息 | 必填 | 说明 |
|------|------|------|
| 登录页 URL | ✅ | 如 `https://dev.jlc-erp.com/erp/#/login` |
| 账号 | ✅ | 测试账号 |
| 密码 | ✅ | 测试密码 |
| 脚本名称 | ❌ | 默认从 URL 推导，如 `saaserp-login.mjs` |
| 输出目录 | ❌ | 默认 `$WORK_DIR/testing/` |

## 完整流程

### Phase 1: 探测登录页

```
1. agent-browser --headed open <登录页URL>
2. agent-browser wait --load networkidle
3. agent-browser snapshot -i
```

从 snapshot 判断：

**情况 A：CAS/SSO 跳转**（URL 变为 passport.jlc.com / sso.xxx.com）
→ 不抓包，直接复用 `auto-login.js`，生成一个调用它的包装脚本
→ 跳到 Phase 4

**情况 B：自有登录表单**（页面有 username/password 输入框 + 登录按钮）
→ 继续 Phase 2

**情况 C：无法判断**（空白页 / 加载中 / 需要特殊操作）
→ 用 `--headed` 模式，提示用户在弹出的浏览器中手动导航到登录页，然后用 `agent-browser snapshot -i` 重新检测

### Phase 2: 抓包登录

这是核心步骤。用 HAR 录制 + agent-browser 交互来捕获完整登录流程。

#### 2.1 启动 HAR 录制

```bash
agent-browser network har start
```

#### 2.2 填入账密并登录

```
1. agent-browser fill @username_ref <账号>
2. agent-browser fill @password_ref <密码>
3. agent-browser click @login_button_ref
4. agent-browser wait --load networkidle
```

如果页面有验证码/滑块：
- 提示用户在 headed 浏览器中手动完成验证码
- 然后 `agent-browser wait --url <登录后URL>` 等待跳转

如果登录后需要选择企业/租户：
- `agent-browser snapshot -i` 获取选择列表
- 选择第一个或让用户指定
- 继续等待跳转完成

#### 2.3 停止录制并保存状态

```bash
agent-browser network har stop ./login-capture.har
agent-browser state save ./storage-state.json
```

#### 2.4 提取网络请求

```bash
agent-browser network requests
```

记录所有 API 请求的 method + URL + status。

### Phase 3: 分析登录流程

读取 HAR 文件，分析以下维度：

#### 3.1 识别登录 API 调用

从 HAR 中筛选关键请求：

```
筛选条件：
  method = POST
  URL 包含 login / auth / session / token / secret / password
  status = 200
  response body 含 token / code / session / cookie / user / customer
```

按时间排序，识别调用链。常见模式：

**模式 1：单步登录**
```
POST /api/login → { token }
```

**模式 2：密钥交换 + 登录**
```
POST /api/secret/update → { keyId, publicKey, privateKey }
POST /api/login → { token }  (header 带 secretkey: keyId)
```

**模式 3：会话初始化 + 登录 + 选择**
```
POST /api/session/init
POST /api/login/withPassword
POST /api/login/select → { tenantId }
```

**模式 4：Passport CAS**
```
POST /api/cas/login/get-init-session
POST /api/cas/login/with-password → { authCode }
```

#### 3.2 分析加密方式

对比 HAR 中发送的 password 值和用户提供的明文密码：

| 特征 | 加密方式 | 处理 |
|------|---------|------|
| 密文 = 明文 | 无加密 | 直接发送 |
| 密文以 `04` 开头，长度 200+ | SM2 | 需要分析是否先 Base64（对比 206 vs 210 chars） |
| 密文以 `{secret}04` 开头 | SM2 + {secret}前缀 | @jlc/utils 的标准格式 |
| 密文为长 Base64 字符串 | AES 或 RSA | 检查页面 JS 源码 |
| 密文短于明文 | 可能是 hash | 检查是否 MD5/SHA |

如果密文不是明文，用 `agent-browser eval` 提取页面加密函数：
```bash
agent-browser eval "typeof window.sm2Encrypt"
agent-browser eval "typeof window.encryptPassword"
agent-browser eval "typeof window.RSAEncrypt"
```

如果页面有 `sm2Encrypt`，直接用它来加密：
```bash
agent-browser eval "window.sm2Encrypt('<明文密码>')"
```
对比输出和 HAR 中抓到的值，确认加密逻辑。

#### 3.3 分析请求 Headers

检查关键自定义 headers：
- `secretkey` → 对应 keyId（密钥交换模式）
- `X-JLC-*` → JLC 特定 headers
- `Authorization` → Bearer token
- `X-CSRF-Token` → CSRF 保护

#### 3.4 分析 Cookie 流

从 HAR 中提取 Set-Cookie，识别：
- 会话 cookie（JSESSIONID, SESSION_ID）
- 认证 token cookie
- TGT cookie（CAS 场景）
- 自动登录 cookie

#### 3.5 分析 localStorage

```bash
agent-browser eval "JSON.stringify(Object.entries(localStorage))"
```

提取登录态相关项（token, isLogin, keyPair, userInfo 等）。

### Phase 4: 生成脚本

根据分析结果，生成 Node.js 登录脚本。

#### 4.1 输出路径

```
<前端项目>/testing/scripts/<脚本名>.mjs
```

脚本放前端项目的 `testing/scripts/` 目录，跟测试代码在一起。理由：
- 登录逻辑跟具体项目绑定（API地址、加密方式、企业选择）
- 随项目 git 管理，团队成员共享
- E2E 测试直接引用同目录的 storageState

#### 4.2 脚本模板

根据分析出的模式选择模板：

**模板变量替换规则**：

| 模板变量 | 替换来源 |
|---------|---------|
| `{{SCRIPT_NAME}}` | 脚本名称 |
| `{{BASE_URL}}` | 登录页 URL 的 origin |
| `{{LOGIN_STEPS}}` | Phase 3 分析出的 API 调用链 |
| `{{ENCRYPT_FN}}` | 加密函数（SM2/无/自定义） |
| `{{HEADERS}}` | 必要的自定义 headers |
| `{{COOKIE_NAMES}}` | 登录成功标志 cookie |
| `{{LOCALSTORAGE_FLAGS}}` | localStorage 登录标志 |

#### 4.3 脚本结构

生成的脚本必须包含：

```
1. CLI 参数解析（-u 账号 -p 密码 -o 输出路径）
2. CookieJar 类（自动管理 cookie）
3. 加密函数（如需要）
4. 登录步骤（按分析出的 API 调用链）
5. 输出：JSON stdout + 可选 storageState 文件
6. 可选：agent-browser 注入模式
```

#### 4.4 质量检查清单

生成后自检：

- [ ] 脚本无硬编码账密（从 CLI 参数读取）
- [ ] 无硬编码 URL（从 BASE_URL 变量读取）
- [ ] Cookie 自动管理（CookieJar）
- [ ] 加密逻辑正确（与 HAR 对比）
- [ ] 多步流程完整（不遗漏选择企业等步骤）
- [ ] 输出 storageState 格式正确
- [ ] 错误处理（网络超时、登录失败）
- [ ] 依赖声明（如有外部依赖，在脚本头部注释）

### Phase 5: 验证

#### 5.1 运行脚本

```bash
node <脚本路径> -u <账号> -p <密码> -o ./test-storage-state.json
```

#### 5.2 验证结果

- stdout JSON 中 `success: true`
- storageState 文件包含登录态 cookie
- cookie 的 domain 正确

#### 5.3 如果失败

- 对比脚本发送的请求和 HAR 中的请求
- 检查加密输出是否一致
- 检查 cookie 链路是否完整
- 检查是否有遗漏的步骤（如 CSRF token）

### Phase 6: 交付集成

脚本验证通过后，将使用说明写入前端项目 `CLAUDE.md`。AI agent 读 CLAUDE.md 就知道怎么登录，不需要额外配置。

#### 写入前端项目 CLAUDE.md

在前端项目的 `CLAUDE.md` 中追加登录脚本使用说明：

```markdown
## 登录脚本

测试前获取登录态：

\`\`\`bash
# 个性化登录
node ./testing/scripts/<脚本名>.mjs \
  -u $TEST_USERNAME -p $TEST_PASSWORD \
  -o ./testing/auth/storage-state.json

# 通用 passport 登录（如果用通用登录）
node $CLAUDE_PLUGIN_ROOT/scripts/auth/auto-login.js \
  -d dev -u $TEST_USERNAME -p $TEST_PASSWORD \
  -o ./testing/auth/storage-state.json
\`\`\`

环境变量：\`TEST_USERNAME\`、\`TEST_PASSWORD\` 从 biz-tech-docs 凭证文件读取。
```

**写入位置**：追加到项目 `CLAUDE.md` 末尾。如果已有 `## 测试` 章节，插入该章节内。

**写入后确认**：展示写入内容让用户确认。

## 已有脚本复用

如果分析后发现登录流程匹配已有脚本，直接复用：

| 登录类型 | 脚本 | 触发条件 |
|---------|------|---------|
| Passport CAS/SSO | `scripts/auth/auto-login.js` | URL 含 passport.jlc.com |

复用方式：生成一个薄包装脚本调用已有脚本。

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| HAR 为空 | 页面在录制前就跳转了 | 先 open → wait → 再开始 HAR 录制 |
| 抓不到登录 API | SPA 框架拦截了 fetch | 用 `network requests` 替代 HAR |
| 加密分析不出来 | 混淆 JS | 用 `agent-browser eval` 直接调用页面加密函数 |
| 生成的脚本报 401 | 漏了 cookie 或 header | 对比 HAR 中的完整请求头 |
| 验证码阻塞 | 滑块/图形验证码 | 用 headed 模式让用户手动完成 |

## 与其他 skill 的关系

- 本 skill 生成登录脚本，存入前端项目 `testing/scripts/`
- 使用说明写入前端项目 `CLAUDE.md`，AI agent 读到就知道怎么登录
- `test-probing` 的 CAS/SSO 文档提供 CAS 场景参考
- 已有脚本可直接复用：`scripts/auth/auto-login.js`（passport）
