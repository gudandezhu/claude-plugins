#!/usr/bin/env node
"use strict";
/**
 * TASK-02: pre-check.js
 * 测试执行前预检：验证 baseUrl 正确性 + 浏览器可用性
 * 解决已知问题 1（baseUrl 指向前端）和已知问题 4（Playwright 浏览器未安装）
 *
 * 用法：node pre-check.js --config testing/test-config.json
 * 输出：testing/.cache/pre-check-result.json
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const child_process_1 = require("child_process");
const path_utils_1 = require("../../../scripts/lib/path-utils");
const { safeReadJson } = require("../../../scripts/lib/safe-json");
// ─── HTTP 检查 ──────────────────────────────────────────────
function httpCheck(url, timeoutMs = 10000, maxRedirects = 3, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            timeout: timeoutMs,
            headers: { 'Accept': '*/*', ...extraHeaders }
        }, (res) => {
            // Follow redirects
            if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location && maxRedirects > 0) {
                const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
                return httpCheck(redirectUrl, timeoutMs, maxRedirects - 1).then(resolve, reject);
            }
            let body = '';
            res.setEncoding('utf-8');
            res.on('data', (chunk) => { if (body.length < 200)
                body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode || 0, body: body.substring(0, 200), headers: res.headers }));
        });
        req.on('error', (err) => reject(err));
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}
function looksLikeHtml(body) {
    const trimmed = body.trim().toLowerCase();
    return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}
// ─── 浏览器检测 ─────────────────────────────────────────────
function findPlaywrightChromium() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const possiblePaths = [
        path.join(homeDir, 'AppData', 'Local', 'ms-playwright'),
        path.join(homeDir, '.cache', 'ms-playwright'),
        path.join(homeDir, 'Library', 'Caches', 'ms-playwright'),
    ];
    for (const base of possiblePaths) {
        if (!fs.existsSync(base))
            continue;
        try {
            const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium'));
            for (const dir of dirs) {
                const chromePath = path.join(base, dir, 'chrome-win', 'chrome.exe');
                const chromePathLinux = path.join(base, dir, 'chrome-linux', 'chrome');
                const chromePathMac = path.join(base, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
                for (const p of [chromePath, chromePathLinux, chromePathMac]) {
                    if (fs.existsSync(p))
                        return p;
                }
            }
        }
        catch { /* ignore */ }
    }
    return null;
}
function findLocalChrome() {
    const candidates = [
        // Windows
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        // macOS
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        // Linux
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p))
            return p;
    }
    // Try which/where
    try {
        const result = (0, child_process_1.execSync)(process.platform === 'win32' ? 'where chrome' : 'which google-chrome', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (result && fs.existsSync(result.split('\n')[0]))
            return result.split('\n')[0];
    }
    catch { /* ignore */ }
    return null;
}
function checkBrowser() {
    const pwChromium = findPlaywrightChromium();
    const localChrome = findLocalChrome();
    // 内网环境优先使用本地 Chrome，跳过 Playwright Chromium 下载（下载需要外网，内网必超时）
    if (localChrome) {
        return {
            playwrightChromium: { installed: !!pwChromium, path: pwChromium },
            localChrome: { installed: true, path: localChrome },
            recommendation: 'local-chrome',
            action_required: false,
            envOverrides: { PLAYWRIGHT_CHROME: 'local' },
            message: `使用本地 Chrome: ${localChrome}`,
        };
    }
    if (pwChromium) {
        return {
            playwrightChromium: { installed: true, path: pwChromium },
            localChrome: { installed: false, path: null },
            recommendation: 'playwright-chromium',
            action_required: false,
            message: 'Playwright Chromium 已安装',
        };
    }
    return {
        playwrightChromium: { installed: false, path: null },
        localChrome: { installed: false, path: null },
        recommendation: 'none',
        action_required: true,
        envOverrides: {},
        message: '未找到任何可用浏览器。请安装 Chrome 或运行 npx playwright install chromium',
    };
}
// ─── 主流程 ─────────────────────────────────────────────────
async function main() {
    const rawConfigArg = process.argv.find((_, i, arr) => arr[i - 1] === '--config') || 'testing/test-config.json';
    const configArg = path_utils_1.normalizeMsysPath(rawConfigArg);
    const scopeArg = process.argv.find((_, i, arr) => arr[i - 1] === '--scope');
    if (!fs.existsSync(configArg)) {
        console.error(`[FAIL] 配置文件不存在: ${configArg}`);
        process.exit(2);
    }
    const config = safeReadJson(configArg);
    const scope = scopeArg || config.scope || 'fullstack';
    const cacheDir = path.join(path.dirname(configArg), '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const result = {
        status: 'passed',
        timestamp: new Date().toISOString(),
        checks: { frontend: null, backend: null, backendReturnsJson: null, browser: null },
        failedChecks: [],
    };
    // 0. 必需配置项检查：scope 含前端时 frontend.baseUrl 必须有值
    if (scope !== 'backend' && !config.frontend?.baseUrl) {
        result.checks.frontend = {
            passed: false,
            message: 'frontend.baseUrl 未配置，E2E 测试的 FRONTEND_URL 将为空，所有 page.goto() 会报 "Cannot navigate to invalid URL"'
        };
        result.failedChecks.push('frontend');
    }
    // 0a. 必需配置项检查：scope 含后端时 backend.baseUrl 必须有值
    if ((scope === 'backend' || scope === 'fullstack') && !config.backend?.baseUrl) {
        result.checks.backend = {
            passed: false,
            message: 'backend.baseUrl 未配置，API 测试的 API_BASE_URL 将为空，所有请求会失败'
        };
        result.failedChecks.push('backend');
    }
    // ─── HTTP 检查并行化 ─────────────────────────────────────────
    const httpChecks = [];
    // 1. 前端可访问性
    if (scope !== 'backend' && config.frontend?.baseUrl) {
        httpChecks.push(
            httpCheck(config.frontend.baseUrl, 10000, 3, { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' })
                .then(res => {
                    const isHtml = looksLikeHtml(res.body);
                    result.checks.frontend = {
                        passed: (res.status === 200 || res.status === 304) || isHtml,
                        message: `HTTP ${res.status}${isHtml ? ', HTML content' : ''}`
                    };
                })
                .catch(err => {
                    result.checks.frontend = { passed: false, message: err.message };
                })
                .then(() => {
                    if (result.checks.frontend && !result.checks.frontend.passed)
                        result.failedChecks.push('frontend');
                })
        );
    }
    // 2. 后端可访问性
    if ((scope === 'backend' || scope === 'fullstack') && config.backend?.baseUrl) {
        httpChecks.push(
            httpCheck(config.backend.baseUrl)
                .then(res => {
                    result.checks.backend = { passed: res.status === 200 || res.status === 404, message: `HTTP ${res.status}` };
                })
                .catch(err => {
                    result.checks.backend = { passed: false, message: err.message };
                })
                .then(() => {
                    if (result.checks.backend && !result.checks.backend.passed)
                        result.failedChecks.push('backend');
                })
        );
    }
    // 3. 后端返回 JSON 而非 HTML
    if ((scope === 'backend' || scope === 'fullstack') && config.backend?.baseUrl) {
        const apiPrefix = config.backend.apiPrefix || '';
        const testUrl = `${config.backend.baseUrl}${apiPrefix}`;
        httpChecks.push(
            httpCheck(testUrl, 10000, 3, { 'Accept': 'application/json' })
                .then(res => {
                    const contentType = res.headers?.['content-type'] || '';
                    const isHtml = looksLikeHtml(res.body);
                    const isJson = contentType.includes('json');
                    result.checks.backendReturnsJson = {
                        passed: !isHtml,
                        message: isHtml
                            ? `[WARN] ${testUrl} 返回 HTML (Content-Type: ${contentType})，baseUrl 可能指向了前端`
                            : isJson ? `${testUrl} 返回 JSON (Content-Type: ${contentType})`
                                     : `${testUrl} Content-Type: ${contentType}`,
                    };
                })
                .catch(err => {
                    result.checks.backendReturnsJson = { passed: true, message: `请求失败但非 HTML: ${err.message}` };
                })
                .then(() => {
                    if (result.checks.backendReturnsJson && !result.checks.backendReturnsJson.passed)
                        result.failedChecks.push('backendReturnsJson');
                })
        );
    }
    // 并行执行所有 HTTP 检查
    await Promise.all(httpChecks);
    // 4. API 文档存在性（scope 含后端时，信息性输出）
    if (scope === 'backend' || scope === 'fullstack') {
        const workDir = path.dirname(path.dirname(configArg));
        const apiDocPaths = [
            path.join(workDir, 'design/task/api'),
            path.join(workDir, 'requirement/api'),
        ];
        const apiDocDir = apiDocPaths.find(d => {
            if (!fs.existsSync(d)) return false;
            try { return fs.readdirSync(d).some(f => f.endsWith('.md')); } catch { return false; }
        });
        if (apiDocDir) {
            const mdFiles = fs.readdirSync(apiDocDir).filter(f => f.endsWith('.md'));
            console.log(`[INFO] API 文档: 找到 ${mdFiles.length} 个 (${path.relative(workDir, apiDocDir)})`);
        } else {
            console.log('[INFO] API 文档: 未找到本地 API 文档 (design/task/api/)，API 测试字段名以 api-probe.md 为准');
        }
    }
    // 5. 浏览器可用性（scope 含前端时）
    if (scope !== 'backend') {
        result.checks.browser = checkBrowser();
        if (result.checks.browser.recommendation === 'none') {
            result.failedChecks.push('browser');
        }
    }
    // 6. 登录态有效性（scope 含前端且 auth 不为 null 时）
    if (scope !== 'backend' && !config.auth) {
        console.warn('[WARN] scope 含 E2E 但 auth 未配置。如果应用需要认证（登录页），'
            + 'E2E 测试可能因重定向到登录页而全部超时。'
            + '请在 test-config.json 中配置 auth，或确认应用不需要认证。');
        result.checks.authRequired = {
            passed: true,
            message: 'auth 未配置。如果应用需要认证，E2E 测试可能全部超时失败。'
        };
    }
    if (scope !== 'backend' && config.auth && config.auth.type !== 'none') {
        const isTestingRepoMode = process.env.TESTING_REPO_MODE === '1';
        // 优先从 config.auth.storageStatePath 读取，支持相对路径
        const configDir = path.dirname(configArg);
        const storagePath = config.auth?.storageStatePath
            ? path.resolve(configDir, config.auth.storageStatePath)
            : (isTestingRepoMode
                ? path.join(process.cwd(), '.cache', '.auth', 'storage-state.json')
                : path.join(configDir, 'auth/storage-state.json'));
        if (!fs.existsSync(storagePath)) {
            result.checks.auth = { passed: false, message: 'storage-state.json 不存在，需要先获取登录态' };
            result.failedChecks.push('auth');
        } else {
            // 检查文件修改时间，超过 24h 警告
            const fileStat = fs.statSync(storagePath);
            const fileAgeHours = (Date.now() - fileStat.mtimeMs) / (1000 * 60 * 60);
            const maxAgeHours = 24;
            if (fileAgeHours > maxAgeHours) {
                console.log(`[WARN] storage-state.json 已 ${Math.round(fileAgeHours)} 小时未更新（阈值 ${maxAgeHours}h），建议重新获取登录态`);
            }
            try {
                const state = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
                const now = Date.now() / 1000;
                const expired = (state.cookies || []).filter(c =>
                    c.expires > 0 && c.expires < now
                );
                if (expired.length > 0) {
                    result.checks.auth = {
                        passed: false,
                        message: `${expired.length} 个 cookie 已过期，需要重新获取登录态`
                    };
                    result.failedChecks.push('auth');
                } else {
                    // 检查 localStorage 中的认证标志（从配置读取）
                    // auth.storageStatePatches.localStorage 配置需要检查的标志
                    // 未配置时跳过检查，保持向后兼容
                    const lsItems = (state.origins || []).flatMap(o => o.localStorage || []);
                    const localStorageChecks = config.auth?.storageStatePatches?.localStorage || [];
                    
                    // 检查每个配置的标志
                    let failedFlag = null;
                    for (const check of localStorageChecks) {
                        const item = lsItems.find(i => i.name === check.name);
                        if (item && item.value !== check.value) {
                            failedFlag = { name: check.name, expected: check.value, actual: item.value };
                            break;
                        }
                    }
                    
                    if (failedFlag) {
                        result.checks.auth = {
                            passed: false,
                            message: `localStorage.${failedFlag.name}=${failedFlag.actual}（期望 "${failedFlag.expected}"），前端路由守卫会拦截所有页面并重定向到登录页，需要重新获取登录态`
                        };
                        result.failedChecks.push('auth');
                    } else {
                        // CAS 场景：检查 storageState 是否包含 SSO 域的 cookie（TGT）
                        // 缺少 TGT 时 Playwright 加载 storageState 后仍会被重定向到 CAS 登录页
                        const ssoUrl = config.auth?.ssoUrl || '';
                        if (ssoUrl) {
                            const ssoDomain = (() => {
                                try { return new URL(ssoUrl.startsWith('http') ? ssoUrl : `https://${ssoUrl}`).hostname; }
                                catch { return ssoUrl; }
                            })();
                            const hasSsoCookie = (state.cookies || []).some(c =>
                                c.domain && (c.domain.includes(ssoDomain) || ssoDomain.includes(c.domain.replace(/^\./, '')))
                            );
                            if (!hasSsoCookie) {
                                result.checks.auth = {
                                    passed: false,
                                    message: `storageState 中未找到 CAS/SSO 域（${ssoDomain}）的 cookie（TGT），Playwright 加载后会被重定向到登录页。请运行 auth-login.js 重新获取登录态（使用 Playwright context.storageState() 输出 storageState）`
                                };
                                result.failedChecks.push('auth');
                            } else {
                                result.checks.auth = {
                                    passed: true,
                                    message: `登录态有效，含 CAS 域（${ssoDomain}）cookie`
                                };
                            }
                        } else {
                            result.checks.auth = {
                                passed: true,
                                message: '登录态 cookie 未过期（注意：未验证 token 有效性，实际可能已失效）'
                            };
                        }
                    }
                }
                // 检查 secure cookie 与前端协议是否匹配，自动修正
                const isHttps = (config.frontend?.baseUrl || '').startsWith('https');
                if (!isHttps) {
                    const needsFix = (state.cookies || []).filter(c => c.secure || c.sameSite === 'None');
                    if (needsFix.length > 0) {
                        // 自动修正：secure → false，sameSite None → Lax（None 要求 secure=true，HTTP 下两者都要改）
                        let fixed = 0;
                        for (const cookie of state.cookies) {
                            if (cookie.secure || cookie.sameSite === 'None') {
                                cookie.secure = false;
                                if (cookie.sameSite === 'None') cookie.sameSite = 'Lax';
                                fixed++;
                            }
                        }
                        fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));
                        console.log(`[FIX] 自动修正 storage-state.json：${fixed} 个 cookie 的 secure/sameSite 已修正（前端是 HTTP）`);
                        // 不标记为失败，已自动修正
                        if (result.checks.auth.passed) {
                            result.checks.auth.message += ` (已自动修正 ${fixed} 个 secure/sameSite cookie)`;
                        }
                    }
                }
            } catch (e) {
                result.checks.auth = { passed: false, message: `storage-state.json 解析失败: ${e.message}` };
                result.failedChecks.push('auth');
            }
        }
    }
    // 将 envOverrides 提升到 result 顶层，供 run-tests.js 读取
    if (result.checks.browser?.envOverrides) {
        result.envOverrides = result.checks.browser.envOverrides;
    }
    // 6.5. testingRepo node_modules check (scope with frontend)
    const tr = config.testingRepo;
    const testingRepoProjectRoot = tr && tr.path
        ? path_utils_1.normalizeMsysPath(tr.path.replace(/\$JLC_AI_WORKSPACE/g, process.env.JLC_AI_WORKSPACE || ''))
        : null;
    if (scope !== 'backend' && testingRepoProjectRoot) {
        const requiredModules = ['@playwright/test'];
        const nodeModulesDir = path.join(testingRepoProjectRoot, 'node_modules');
        const missingModules = [];
        for (const mod of requiredModules) {
            if (!fs.existsSync(path.join(nodeModulesDir, mod))) {
                missingModules.push(mod);
            }
        }
        if (missingModules.length > 0) {
            result.checks.nodeModules = {
                passed: false,
                message: 'testingRepo missing deps: ' + missingModules.join(', ')
                    + '. Run npm install in ' + testingRepoProjectRoot
            };
            result.failedChecks.push('nodeModules');
        }
        else {
            result.checks.nodeModules = {
                passed: true,
                message: 'testingRepo deps OK (@playwright/test available)'
            };
        }
    }
    // 7. playwright.config.ts 配置完整性校验（scope 含前端时）
    if (scope !== 'backend') {
        const projectRoot = testingRepoProjectRoot;
        // 配置文件查找优先级：testingRepo > testingDir
        const pwConfigCandidates = projectRoot ? [
            // 方案 C：项目根优先
            path.join(projectRoot, 'playwright.config.ts'),
            path.join(projectRoot, 'features', 'e2e', 'playwright.config.ts'),
            ...path_utils_1.findGroupedConfigs(projectRoot, 'e2e', 'playwright.config.ts'),
            // 兼容结构：scripts/e2e/playwright.config.ts（非分组输出）
            path.join(projectRoot, 'scripts', 'e2e', 'playwright.config.ts'),
        ] : [];
        pwConfigCandidates.push(path.join(path.dirname(configArg), 'scripts/e2e/playwright.config.ts'));
        
        let pwConfigPath = null;
        for (const candidate of pwConfigCandidates) {
            if (fs.existsSync(candidate)) {
                pwConfigPath = candidate;
                break;
            }
        }
        
        if (pwConfigPath) {
            const pwContent = fs.readFileSync(pwConfigPath, 'utf-8');
            const configIssues = [];
            // 检查 baseURL（当 test-config.json 有 frontend.baseUrl 时）
            if (config.frontend?.baseUrl && !pwContent.includes('baseURL')) {
                configIssues.push(`playwright.config.ts 缺少 baseURL。test-config.json 配置了 frontend.baseUrl="${config.frontend.baseUrl}"，`
                    + `但生成的 playwright.config.ts 未包含。测试使用相对路径时会全部导航失败。`
                    + `修复：在 commonUse 中添加 baseURL: '${config.frontend.baseUrl}'`);
            }
            // 检查 storageState（当有 auth 配置时）
            if (config.auth && !pwContent.includes('storageState')) {
                configIssues.push('有 auth 配置但 playwright.config.ts 缺少 storageState，测试无法复用登录态');
            }
            // 检查 testDir
            if (!pwContent.includes('testDir')) {
                configIssues.push('playwright.config.ts 缺少 testDir，Playwright 无法定位测试文件');
            }
            if (configIssues.length > 0) {
                result.checks.playwrightConfig = {
                    passed: false,
                    message: configIssues.join('; '),
                };
                result.failedChecks.push('playwrightConfig');
            } else {
                result.checks.playwrightConfig = { passed: true, message: `playwright.config.ts 配置完整性检查通过 (${pwConfigPath})` };
            }
        } else {
            result.checks.playwrightConfig = { passed: true, message: 'playwright.config.ts 不存在（由 gen-skeleton.js 生成前跳过）' };
        }
    }
    // 汇总
    result.status = result.failedChecks.length === 0 ? 'passed' : 'failed';
    fs.writeFileSync(path.join(cacheDir, 'pre-check-result.json'), JSON.stringify(result, null, 2));
    if (result.status === 'passed') {
        console.log('[OK] 预检通过');
    }
    else {
        console.error(`[FAIL] 预检失败: ${result.failedChecks.join(', ')}`);
        for (const key of result.failedChecks) {
            const check = result.checks[key];
            if (check?.message)
                console.error(`   ${key}: ${check.message}`);
        }
        process.exit(1);
    }
}
main().catch((err) => {
    console.error('pre-check 未预期错误:', err);
    process.exit(2);
});
