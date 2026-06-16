# 环境变量参考

## 已知故障模式（不设置环境变量的后果）

| 缺失变量 | 故障表现 | 根因 |
|---------|---------|------|
| `WORK_DIR` | auth.ts 报 `paths[0] undefined`，所有测试 skip 或报错 | storageState 路径无法解析 |
| `API_PREFIX` | 所有 API 测试返回 404 | 请求 URL 缺少前缀（如 `/finance/xxx` 而非 `/saas/erp/biz/finance/xxx`） |
| `API_BASE_URL` | API 测试连接 localhost 默认端口失败 | 后端地址不对 |
| `FRONTEND_URL` | E2E 测试报 "Cannot navigate to invalid URL"，所有 page.goto() 失败 | 前端地址未配置或 test-config.json 中 frontend.baseUrl 为空 |
| `MSYS_NO_PATHCONV` | API_PREFIX 被 Git Bash 转为 Windows 路径 | `/saas/erp/biz` 变成 `C:/Program Files/Git/saas/erp/biz` |

## 已知非环境变量故障模式

| 故障表现 | 根因 | 修复方式 |
|---------|------|---------|
| E2E 全部白屏（100% assertion_failed） | storage-state.json 中 cookie 的 `secure: true` 但前端是 HTTP | 将 cookie 的 `secure` 改为 `false` |
| E2E 全部白屏（Vue 路由守卫拦截） | localStorage 中认证标志为 `false`（如 `isLogin`、`*CAS*LOGIN*` 等项目特定 key） | 修正 storage-state.json 中 localStorage 的认证标志值；或按 `auto-login-passport` 优先级重新获取登录态 |
| E2E 全部白屏（storageState 加载后 document.cookie 为空） | storageState 不是经 Playwright `context.storageState()` 输出，cookie 注入失败 | 按 `auto-login-passport` 优先级获取登录态，必须经 Playwright `context.storageState()` 输出 |
| E2E 全部白屏（新 Playwright context 加载 storageState 后 session 失效） | 应用使用服务端 session cookie（expires=-1），跨浏览器实例服务端拒绝；无 lsId 持久 token 无法重建 session | 按 `auto-login-passport` 优先级重新获取登录态，CAS 场景登录时勾选"自动登录"以生成 lsId cookie |
| E2E URL 含中文导致导航失败 | dom-probe.md 路由行含括号注释被整行拼入 URL | 使用 dom-probe.md 的「完整 URL 路径」字段，不含注释 |
| Playwright 启动超时（spawnSync ETIMEDOUT） | Playwright Chromium 未安装，尝试下载超时 | 使用本地 Chrome（`channel: 'chrome'`），内网默认行为 |
| `ENOENT: no such file or directory, open 'E:\dev\stdin'` | Windows 无 `/dev/stdin`，`readFileSync('/dev/stdin')` 被解析为 Windows 路径 | 改用 `node -e "JSON.parse(require('fs').readFileSync('文件路径','utf-8'))"` 直接读文件 |
| parse-results 报 `SyntaxError: Unexpected non-whitespace character after JSON at position N` | 用 `2>&1 \| tee results.json` 捕获测试输出时，stderr 混入 stdout 导致 JSON 损坏 | 用 `--reporter=json > results.json 2>errors.log` 分离 stdout/stderr；run-tests.js 已处理，手动执行时必须分离 |
| Playwright `--reporter=json` + execSync 管道死锁（ETIMEDOUT） | Windows 下 execSync pipe 缓冲区约 1MB，Playwright JSON 输出超限导致子进程写阻塞 → 死锁 → 超时 | run-tests.js 已改用 `PLAYWRIGHT_JSON_OUTPUT_NAME` 环境变量让 Playwright 直接写文件，绕过 stdout 管道 |
| storage-state.json 检查报"不存在或解析失败"但文件实际存在 | 用 python3 检查，Windows Git Bash 下 python3 不可靠 | 统一用 `node -e "..."` 检查，禁止用 python3 |

## Git Bash 中文编码陷阱

在 Git Bash 中用 `curl -d '{"ruleName":"中文"}'` 直接传递含中文的 JSON 时，
中文字符编码会被破坏，导致后端返回 `success: false`。

这不是后端 bug。通过文件传递（`curl --data @file.json`）或 Node.js 脚本（axios/fetch）发送则正常。

手动调试 API 时如果遇到中文参数失败：
1. 将 JSON 写入临时文件：`echo '{"ruleName":"测试"}' > /tmp/req.json`
2. 用文件传递：`curl -X POST -H "Content-Type: application/json" --data @/tmp/req.json <url>`
3. 或直接用 Node.js 脚本调试，避免 shell 编码问题

不要因为 curl 中文失败就记录为后端缺陷——先排除 shell 编码因素。

## Windows 控制台中文乱码

Windows 默认控制台编码是 GBK（代码页 936），但 Node.js 输出 UTF-8。
vitest/playwright 的中文测试名称和错误消息在控制台可能显示为乱码。

run-tests.js 会在 Windows 上自动执行 `chcp 65001` 切换到 UTF-8 代码页。
手动执行测试时，先运行 `chcp 65001` 再执行 vitest/playwright 命令。

如果生成的报告文件出现乱码，检查：
1. 编辑器是否以 UTF-8 打开文件（VS Code 右下角状态栏可切换）
2. Git Bash 终端编码是否为 UTF-8（Options → Text → Character set → UTF-8）
