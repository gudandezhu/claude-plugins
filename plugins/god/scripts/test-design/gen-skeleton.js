#!/usr/bin/env node
"use strict";
/**
 * TASK-07: gen-skeleton.js
 * 从 api-skeleton.json + dom-probe.md 自动生成测试代码骨架和案例骨架
 *
 * 用法：node gen-skeleton.js --testing-dir testing/
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
const { safeReadJson } = require("../lib/safe-json");
function parseArgs() {
    const argv = process.argv.slice(2);
    let testingDir = 'testing';
    let templatesDir = '';
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--testing-dir' && argv[i + 1])
            testingDir = argv[++i];
        if (argv[i] === '--templates-dir' && argv[i + 1])
            templatesDir = argv[++i];
    }
    return { testingDir, templatesDir };
}
// ─── Task 1.1: 生成 playwright.config.ts ────────────────────
function generatePlaywrightConfig(testingDir, config, e2eOutputDir, options = {}) {
    const isRepoMode = !!options.repoMode;
    const configDir = e2eOutputDir || path.join(testingDir, 'scripts', 'e2e');
    const projectRoot = path.resolve(testingDir, '..');
    const rel = path.relative(configDir, projectRoot).replace(/\\/g, '/');
    const hasAuth = config.auth !== null && config.auth !== undefined;
    const authSetupExists = hasAuth && fs.existsSync(path.join(configDir, 'auth.setup.ts'));
    const storageStatePath = isRepoMode
        ? "path.resolve(process.cwd(), '.cache', '.auth', 'storage-state.json')"
        : "path.resolve(WORK_DIR, 'testing/auth/storage-state.json')";
    let projects;
    if (hasAuth && authSetupExists) {
        projects = `
  projects: [
    { name: 'setup', testMatch: /auth\\.setup\\.ts/ },
    {
      name: 'e2e-tests',
      dependencies: ['setup'],
      use: {
        storageState: ${storageStatePath},
        ...commonUse,
      },
    },
  ],`;
    } else if (hasAuth) {
        projects = `
  projects: [
    {
      name: 'e2e-tests',
      use: {
        storageState: ${storageStatePath},
        ...commonUse,
      },
    },
  ],`;
    } else {
        projects = `
  projects: [
    {
      name: 'e2e-tests',
      use: { ...commonUse },
    },
  ],`;
    }
    if (isRepoMode) {
        return `import { defineConfig } from '@playwright/test';
import path from 'path';

// 由 gen-skeleton.js 自动生成（Testing-Repo 独立模式）
// 配置从环境变量读取，通过 .env 文件管理
const USE_LOCAL_CHROME = process.env.PLAYWRIGHT_CHROME !== 'playwright';
const baseUrl = process.env.FRONTEND_URL || '';
const navigationTimeout = parseInt(process.env.NAVIGATION_TIMEOUT || '${config.timeouts?.navigation || config.timeout?.navigation || 30000}');
const actionTimeout = parseInt(process.env.ACTION_TIMEOUT || '${config.timeouts?.action || config.timeout?.action || 15000}');
const expectTimeout = parseInt(process.env.EXPECT_TIMEOUT || '${config.timeouts?.toBeVisible || 10000}');
const workers = parseInt(process.env.WORKERS || '2');
const retries = parseInt(process.env.RETRIES || '1');

const commonUse = {
  headless: true,
  ...(USE_LOCAL_CHROME ? { channel: 'chrome' } : {}),
  ...(baseUrl ? { baseURL: baseUrl } : {}),
  navigationTimeout,
  actionTimeout,
  screenshot: 'only-on-failure',
};

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests/e2e'),
  fullyParallel: false,
  retries,
  workers,
  reporter: 'json',
  timeout: parseInt(process.env.TIMEOUT || '60000'),
  use: { ...commonUse },
  expect: { timeout: expectTimeout },
${projects}
});
`;
    }
    return `import { defineConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// 由 gen-skeleton.js 自动生成，路径动态计算
// WORK_DIR 由 run-tests.js 注入为 process-docs 根目录（包含 testing/ 子目录）
// 直接运行 npx playwright test 时需手动设置: set WORK_DIR=<process-docs-root>
const WORK_DIR = process.env.WORK_DIR || path.resolve(__dirname, '${rel}');
// 内网环境默认使用本地 Chrome（Playwright Chromium 下载需要外网）
const USE_LOCAL_CHROME = process.env.PLAYWRIGHT_CHROME !== 'playwright';

// 从 test-config.json 读取超时配置，避免硬编码
// 修改超时只需改 test-config.json，无需重新生成脚本
// 配置键: timeouts.toBeVisible / timeouts.action / timeouts.navigation
const testConfig = (() => {
  return safeReadJson(path.resolve(WORK_DIR, 'testing/test-config.json'), { fallback: {} });
})();
const cfgTimeouts = testConfig.timeouts || testConfig.timeout || {};
const navigationTimeout = cfgTimeouts.navigation ?? ${config.timeouts?.navigation || config.timeout?.navigation || 30000};
const actionTimeout = cfgTimeouts.action ?? ${config.timeouts?.action || config.timeout?.action || 15000};
const expectTimeout = cfgTimeouts.toBeVisible ?? ${config.timeouts?.toBeVisible || 10000};
const baseUrl = testConfig.frontend?.baseUrl || '';
const workers = testConfig.execution?.workers || 1;
const retries = testConfig.execution?.retries ?? 1;

const commonUse = {
  headless: true,
  ...(USE_LOCAL_CHROME ? { channel: 'chrome' } : {}),
  ...(baseUrl ? { baseURL: baseUrl } : {}),
  navigationTimeout,
  actionTimeout,
  screenshot: 'only-on-failure',
};

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests'),
  fullyParallel: false,
  retries,
  workers,
  reporter: 'json',
  timeout: 60000,
  use: { ...commonUse },
  expect: { timeout: expectTimeout },
${projects}
});
`;
}

// ─── Task 1.2: 生成 vitest.config.ts ────────────────────────
function generateVitestConfig(testingDir, config, apiOutputDir) {
    const isRepoMode = !!apiOutputDir && !apiOutputDir.startsWith(testingDir);
    const helpersDir = isRepoMode ? path.resolve(apiOutputDir, 'helpers') : path.resolve(testingDir, 'scripts/api/helpers');
    const includePattern = isRepoMode
        ? `['${path.relative(process.cwd(), path.join(apiOutputDir, 'tests')).replace(/\\/g, '/')}/**/*.api.test.ts']`
        : "['scripts/api/tests/**/*.api.test.ts']";
    const aliasPath = isRepoMode
        ? `path.resolve('${path.relative(process.cwd(), helpersDir).replace(/\\/g, '/')}')`
        : "path.resolve('scripts/api/helpers')";
    return `import { defineConfig } from 'vitest/config';
import path from 'path';

// 由 gen-skeleton.js 自动生成
export default defineConfig({
  test: {
    globals: true,
    include: ${includePattern},
    exclude: ['**/test-runs/**', '**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@helpers': ${aliasPath},
    },
  },
});
`;
}
// ─── Testing-Repo ��板函数 ─────────────────────────────────────
function generateEnvFromConfig(config) {
    const lines = [
        '# 由 gen-skeleton.js 从 test-config.json 自动生成',
        '# 修改后直接生效，无需重新运行 gen-skeleton',
        '',
        `FRONTEND_URL=${config.frontend?.baseUrl || ''}`,
        `API_BASE_URL=${config.backend?.baseUrl || ''}`,
        `API_PREFIX=${config.backend?.apiPrefix || ''}`,
    ];
    if (config.execution?.workers) lines.push(`WORKERS=${config.execution.workers}`);
    if (config.execution?.retries !== undefined) lines.push(`RETRIES=${config.execution.retries}`);
    const t = config.timeouts || config.timeout || {};
    if (t.navigation) lines.push(`NAVIGATION_TIMEOUT=${t.navigation}`);
    if (t.action) lines.push(`ACTION_TIMEOUT=${t.action}`);
    if (t.toBeVisible) lines.push(`EXPECT_TIMEOUT=${t.toBeVisible}`);
    if (t.timeout) lines.push(`TIMEOUT=${t.timeout}`);
    if (config.auth?.type) lines.push(`AUTH_TYPE=${config.auth.type}`);
    return lines.join('\n') + '\n';
}

function getEnvExampleTemplate() {
    return `# ============================================
# Testing-Repo 环境配置模板
# 复制此文件为 .env 并填写实际值
# ============================================

# ─── 必需配置 ──────────────────────────────

# 前端应用地址
FRONTEND_URL=https://dev.example.com

# 后端 API 地址
API_BASE_URL=https://api.dev.example.com

# API 路径前缀（可为空）
API_PREFIX={/xxx}

# 测试账号
TEST_USERNAME=your_test_account
TEST_PASSWORD=your_password_here

# ─── 认证配置（可选）────────────────────────

# 认证类型: FORM / CAS / TOKEN
AUTH_TYPE=FORM

# CAS SSO 地址（AUTH_TYPE=CAS 时需要）
# SSO_URL=https://sso.example.com

# Token 在 storage-state.json 中的 key 名称（默认 token）
# 不同项目可能使用 jwt / session_id / X-Auth-Token 等
AUTH_TOKEN_NAME=token

# ─── 执行配置（可选）────────────────────────

# 项目组标识（多项目组时使用）
PROJECT_GROUP=default

# 测试范围: fullstack / frontend / backend
TEST_SCOPE=fullstack

# 浏览器: chrome / chromium
BROWSER=chrome

# 并发数
WORKERS=2

# 重试次数
RETRIES=1
`;
}

function getPackageJsonTemplate() {
    return JSON.stringify({
        name: 'biz-test-regression',
        private: true,
        type: 'module',
        scripts: {
            test: 'bash scripts/run.sh',
            'test:e2e': 'bash scripts/run.sh --scope frontend',
            'test:api': 'bash scripts/run.sh --scope backend',
            'test:win': 'powershell scripts/run.ps1',
            setup: 'bash scripts/setup.sh'
        },
        dependencies: {
            '@playwright/test': '^1.45.0',
            axios: '^1.7.0',
            vitest: '^1.6.0',
            dotenv: '^16.4.0'
        }
    }, null, 2) + '\n';
}

function getAuthSetupTemplate() {
    return `import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_TYPE = process.env.AUTH_TYPE || 'FORM';
const FRONTEND_URL = process.env.FRONTEND_URL!;
const SSO_URL = process.env.SSO_URL || '';
const TEST_USERNAME = process.env.TEST_USERNAME!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

const SELECTORS = {
  username: process.env.AUTH_USERNAME_SELECTOR || 'input[name="username"]',
  password: process.env.AUTH_PASSWORD_SELECTOR || 'input[name="password"]',
  submit: process.env.AUTH_SUBMIT_SELECTOR || 'button[type="submit"]',
  loginSuccessUrl: process.env.AUTH_SUCCESS_URL_PATTERN || '/(home|dashboard|index)',
};

const STORAGE_STATE_PATH = path.join(process.cwd(), '.cache', '.auth', 'storage-state.json');

async function loginByForm(page: any) {
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  await page.fill(SELECTORS.username, TEST_USERNAME);
  await page.fill(SELECTORS.password, TEST_PASSWORD);
  await page.click(SELECTORS.submit);
  await page.waitForURL(new RegExp(\`.*\${SELECTORS.loginSuccessUrl}.*\`), { timeout: 30000 });
}

async function loginByCAS(page: any) {
  await page.goto(SSO_URL || \`\${FRONTEND_URL}/cas/login\`);
  await page.waitForLoadState('networkidle');
  await page.fill(SELECTORS.username, TEST_USERNAME);
  await page.fill(SELECTORS.password, TEST_PASSWORD);
  await page.click(SELECTORS.submit);
  await page.waitForURL(new RegExp(\`.*\${FRONTEND_URL}.*\`), { timeout: 30000 });
}

async function loginByToken(page: any) {
  await page.goto(FRONTEND_URL);
  await page.evaluate((token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('AUTH_TOKEN', token);
    localStorage.setItem('isLogin', 'true');
  }, AUTH_TOKEN);
  await page.reload();
}

setup('authenticate', async ({ page }) => {
  const dir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  switch (AUTH_TYPE) {
    case 'CAS':
      await loginByCAS(page);
      break;
    case 'TOKEN':
      await loginByToken(page);
      break;
    case 'FORM':
    default:
      await loginByForm(page);
      break;
  }

  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
`;
}

function getRepoApiClientTemplate() {
    return `import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || '';
const API_PREFIX = process.env.API_PREFIX || '';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const AUTH_TOKEN_NAME = process.env.AUTH_TOKEN_NAME || 'token';
const TOKEN_NAMES = AUTH_TOKEN_NAME.split(',').map(s => s.trim());

const apiClient: AxiosInstance = axios.create({
  baseURL: \`\${API_BASE_URL}\${API_PREFIX}\`,
  timeout: 30000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getTestTokenSync();
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('认证失败，请检查 AUTH_TOKEN 或重新运行 auth.setup.ts');
    }
    return Promise.reject(error);
  }
);

export default apiClient;

export function getTestTokenSync(): string {
  if (AUTH_TOKEN) return AUTH_TOKEN;

  const storageStatePath = path.join(process.cwd(), '.cache', '.auth', 'storage-state.json');
  if (!fs.existsSync(storageStatePath)) {
    return '';
  }

  try {
    const storage = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));
    for (const cookie of (storage.cookies || [])) {
      if (TOKEN_NAMES.includes(cookie.name)) {
        return cookie.value;
      }
    }
    for (const origin of (storage.origins || [])) {
      for (const item of (origin.localStorage || [])) {
        if (TOKEN_NAMES.includes(item.name)) {
          return item.value;
        }
      }
    }
  } catch { /* ignore parse errors */ }

  return '';
}
`;
}

function getSetupShTemplate() {
    return `#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "Testing-Repo 环境初始化"

mkdir -p .cache/.auth
mkdir -p .cache/test-results

if [ ! -d "node_modules" ]; then
  echo "安装依赖..."
  npm install
  echo "依赖安装完成"
else
  echo "node_modules 已存在，跳过安装"
fi

npx playwright install chromium 2>/dev/null || echo "Playwright 浏览器安装失败，可能需要手动安装"

if [ ! -f .env ]; then
  echo "请复制 .env.example 到 .env 并填写实际值"
  echo "   cp .env.example .env"
fi

echo "初始化完成"
`;
}

function getRunShTemplate() {
    return `#!/bin/bash
#
# run.sh - Testing-Repo 一键测试执行
# 职责：加载 .env + 设置 TESTING_REPO_MODE + 转发到插件 run-tests.js
#
# 用法:
#   ./scripts/run.sh                    # 全量测试
#   ./scripts/run.sh --scope frontend   # 只跑 E2E
#   ./scripts/run.sh --scope backend    # 只跑 API
#   ./scripts/run.sh --file path/to/ts  # 单文件
#

set -e

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

cd "$REPO_ROOT"

if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "未找到 .env 文件，请复制 .env.example 到 .env"
  exit 1
fi

export TESTING_REPO_MODE=1

PLUGIN_DIR="$CLAUDE_PLUGIN_ROOT"
RUN_TESTS="$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/run-tests.js"

if [ ! -f "$RUN_TESTS" ]; then
  echo "未找到 run-tests.js: $RUN_TESTS"
  echo "   请确认 CLAUDE_PLUGIN_ROOT 环境变量已正确设置"
  exit 1
fi

exec node "$RUN_TESTS" --config "$REPO_ROOT/.env" "$@"
`;
}

function getRunPs1Template() {
    return `#
# run.ps1 - Testing-Repo 一键测试执行（Windows）
# 职责：加载 .env + 设置 TESTING_REPO_MODE + 转发到插件 run-tests.js
#
# 用法:
#   .\\scripts\\run.ps1                    # 全量测试
#   .\\scripts\\run.ps1 --scope frontend   # 只跑 E2E
#   .\\scripts\\run.ps1 --scope backend    # 只跑 API
#   .\\scripts\\run.ps1 --file path\\to\\ts  # 单文件
#

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT = Split-Path -Parent $SCRIPT_DIR
Set-Location $REPO_ROOT

$envFile = Join-Path $REPO_ROOT ".env"
if (-not (Test-Path $envFile)) {
    Write-Error "未找到 .env 文件，请复制 .env.example 到 .env"
    exit 1
}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\\s*([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
    }
}

$env:TESTING_REPO_MODE = "1"

$pluginDir = $env:CLAUDE_PLUGIN_ROOT
$runTests = Join-Path $pluginDir "skills\\test-execution\\scripts\\run-tests.js"

if (-not (Test-Path $runTests)) {
    Write-Error "未找到 run-tests.js: $runTests\`n请确认 CLAUDE_PLUGIN_ROOT 环境变量已正确设置"
    exit 1
}

& node $runTests --config (Join-Path $REPO_ROOT ".env") @args
exit $LASTEXITCODE
`;
}

function getRepoGitignoreTemplate() {
    return `# 依赖
node_modules/

# 登录态（敏感）
.cache/.auth/
.auth/

# 测试结果
.cache/
test-results/
playwright-report/
playwright/.cache/

# 环境配置（含密码）
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 日志
*.log
npm-debug.log*
`;
}

function getReadmeTemplate() {
    return `# biz-test-regression

集中测试仓库，支持脱离插件会话独立运行 E2E 和 API 集成测试。

## 快速开始

\`\`\`bash
# 1. 克隆仓库
git clone <repo-url> && cd <repo-name>

# 2. 初始化环境
cp .env.example .env   # 填写实际配置
bash scripts/setup.sh  # 安装依赖 + Playwright 浏览器

# 3. 运行测试
./scripts/run.sh                   # 全量测试（Linux/macOS）
.\\scripts\\run.ps1                  # 全量测试（Windows PowerShell）
\`\`\`

## 目录结构

\`\`\`
├── .env.example          # 环境变量模板
├── package.json          # 依赖声明
├── scripts/
│   ├── setup.sh          # 环境初始化
│   ├── run.sh            # bash 入口（Linux/macOS）
│   └── run.ps1           # PowerShell 入口（Windows）
├── playwright.config.ts   # E2E 配置
├── vitest.config.ts       # API 测试配置
├── shared/
│   ├── auth.setup.ts      # 登录态自动获取
│   └── api-client.ts      # HTTP 客户端（token 自动注入）
├── features/              # E2E 功能测试
└── flows/                 # 流程测试
└── .cache/
    └── .auth/storage-state.json   # 登录态（自动生成，已 gitignore）
\`\`\`

## 环境变量

| 变量 | 必需 | 说明 |
|------|:----:|------|
| FRONTEND_URL | ✅ | 前端应用地址 |
| API_BASE_URL | ✅ | 后端 API 地址 |
| API_PREFIX | ✅ | API 路径前缀（可为空） |
| TEST_USERNAME | ✅ | 测试账号 |
| TEST_PASSWORD | ✅ | 测试密码 |
| AUTH_TYPE | | 认证类型：FORM / CAS / TOKEN（默认 FORM） |
| AUTH_TOKEN_NAME | | storage-state.json 中 token 的 key 名称（默认 token，支持逗号分隔多个） |
| WORKERS | | 并发数（默认 2） |
| RETRIES | | 重试次数（默认 1） |

## 常用命令

### Linux / macOS

| 场景 | 命令 |
|------|------|
| 全量测试 | \`./scripts/run.sh\` |
| 只跑 E2E | \`./scripts/run.sh --scope frontend\` |
| 只跑 API | \`./scripts/run.sh --scope backend\` |
| 单文件 | \`./scripts/run.sh --file tests/e2e/features/X/test.spec.ts\` |

### Windows PowerShell

| 场景 | 命令 |
|------|------|
| 全量测试 | \`.\\scripts\\run.ps1\` |
| 只跑 E2E | \`.\\scripts\\run.ps1 --scope frontend\` |
| 只跑 API | \`.\\scripts\\run.ps1 --scope backend\` |
| 单文件 | \`.\\scripts\\run.ps1 --file tests\\e2e\\features\\X\\test.spec.ts\` |

## 注意事项

- Windows 用户首次运行 PowerShell 脚本需设置执行策略：\`Set-ExecutionPolicy RemoteSigned -Scope CurrentUser\`
- testing/ 目录运行模式已废弃，run-tests.js 检测到非 testing-repo 模式会拒绝执行
- 登录态（storage-state.json）由 auth.setup.ts 在测试执行前自动获取，无需手动维护
`;
}

// ─── Task 1.3: 覆盖层解析辅助函数 ──────────────────────────
function parseOverlayInfo(content) {
    const selectors = [];
    const localStorageKeys = {};
    if (!content) return { selectors, localStorageKeys };
    const lines = content.split('\n');
    let inInterferenceTable = false;
    let isNewFormat = false;
    for (const line of lines) {
        if (line.includes('运行时干扰') || line.includes('干扰类型')) {
            inInterferenceTable = true;
            isNewFormat = line.includes('localStorage key') || line.includes('CSS 选择器');
            continue;
        }
        if (inInterferenceTable && line.startsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cells[0] === '干扰类型' || cells[0].startsWith('---')) continue;
            if (isNewFormat && cells.length >= 5) {
                const cssSelector = cells[1].replace(/`/g, '').trim();
                const lsKey = cells[3].replace(/`/g, '').trim();
                const lsValue = cells[4].replace(/`/g, '').trim();
                if (cssSelector && cssSelector !== '—') selectors.push(cssSelector);
                if (lsKey && lsKey !== '—' && lsValue && lsValue !== '—') {
                    localStorageKeys[lsKey] = lsValue;
                }
            } else if (cells.length >= 3) {
                const closeMethod = cells[2];
                const classMatch = closeMethod.match(/\.([a-zA-Z][\w-]+)/g);
                if (classMatch) {
                    for (const cls of classMatch) {
                        const base = cls.replace(/__[a-z]+$/, '');
                        if (!selectors.includes(base)) selectors.push(base);
                    }
                }
            }
        }
        if (inInterferenceTable && !line.startsWith('|') && line.trim() !== '') {
            inInterferenceTable = false;
        }
    }
    return { selectors, localStorageKeys };
}
function getFrameworkOverlayPatterns(uiLibrary) {
    const patterns = {
        'element-plus': {
            selectors: ['.el-overlay:not(.el-dialog__wrapper):not(.el-drawer__wrapper)']
        },
        'ant-design': {
            selectors: ['.ant-modal-mask']
        },
        'naive-ui': {
            selectors: []
        }
    };
    return patterns[uiLibrary] || { selectors: [] };
}
// ─── UI 框架适配器（选择器模式）────────────────────────────────
const FRAMEWORK_PATTERNS = {
    'element-plus': {
        confirmDialogDefault: '.el-message-box',
        formDialog: '.el-dialog:visible',
        tableRow: '.el-table__row',
        tourSelector: '.el-tour',
        tourCloseSelector: '.el-tour__close',
        selectDropdown: '.el-select-dropdown:visible',
        pagination: '.el-pagination',
        table: '.el-table',
    },
    'ant-design': {
        confirmDialogDefault: '.ant-modal-confirm',
        formDialog: '.ant-modal:visible',
        tableRow: '.ant-table-row',
        tourSelector: '.ant-tour',
        tourCloseSelector: '.ant-tour-close',
        selectDropdown: '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
        pagination: '.ant-pagination',
        table: '.ant-table',
    },
    'naive-ui': {
        confirmDialogDefault: '.n-dialog',
        formDialog: '.n-modal:visible',
        tableRow: '.n-data-table-tr',
        tourSelector: null,
        tourCloseSelector: null,
        selectDropdown: '.n-base-select-menu',
        pagination: '.n-pagination',
        table: '.n-data-table',
    },
};
// ─── 交互模式解析（从 dom-probe.md + api-probe.md 提取）────────
function parseInteractionPatterns(domProbeContent, apiProbeContent, uiLibrary, apiPrefix = '') {
    const fw = FRAMEWORK_PATTERNS[uiLibrary] || FRAMEWORK_PATTERNS['element-plus'];
    const patterns = {
        hasTour: false,
        tourSelector: fw.tourSelector,
        tourCloseSelector: fw.tourCloseSelector,
        confirmDialogType: fw.confirmDialogDefault,
        confirmBtnText: '确定',
        cancelBtnText: '取消',
        addBtnSelector: null,
        editBtnText: '编辑',
        formDialogSelector: fw.formDialog,
        saveBtnText: '保存',
        editSaveBtnText: null, // 编辑弹窗保存按钮文字（null 时复用 saveBtnText）
        editDialogSelector: null, // 编辑弹窗选择器（null 时复用 formDialogSelector）
        hasCrud: false,
        hasDelete: false,
        hasEdit: false,
        hasToggle: false,
        toggleSelector: null, // 开关/切换元素选择器
        apiPaths: { add: null, update: null, delete: null, toggle: null, list: null },
        formFields: [], // 从交互后探测提取的表单字段 [{name, selector, type, required}]
    };
    // 检测 el-tour（干扰表格或交互探测章节中出现）
    if (domProbeContent.includes('el-tour') || domProbeContent.includes('引导')) {
        patterns.hasTour = true;
    }
    // 检测删除确认弹窗类型（从"交互后探测：删除确认弹窗"章节）
    const confirmSection = domProbeContent.match(/交互后探测[：:]删除确认弹窗([\s\S]*?)(?=####|$)/);
    if (confirmSection) {
        const section = confirmSection[1];
        // 弹窗类型字段
        const typeMatch = section.match(/弹窗类型[：:]\s*[`']?([^\s`'\n,，]+)/);
        if (typeMatch) {
            const t = typeMatch[1].replace(/[`'（(].*/g, '').trim();
            if (t) patterns.confirmDialogType = t.startsWith('.') ? t : '.' + t;
        }
        // 确认按钮文字
        const confirmBtnMatch = section.match(/确认按钮文字[：:]\s*\*\*([^*]+)\*\*/);
        if (confirmBtnMatch) patterns.confirmBtnText = confirmBtnMatch[1].trim();
        // 取消按钮文字
        const cancelBtnMatch = section.match(/取消按钮文字[：:]\s*([^\n]+)/);
        if (cancelBtnMatch) patterns.cancelBtnText = cancelBtnMatch[1].trim();
    }
    // 检测新增弹窗的保存按钮文字 + 表单字段
    const addSection = domProbeContent.match(/交互后探测[：:]新增[^\n]*弹窗([\s\S]*?)(?=####|$)/);
    if (addSection) {
        const saveBtnMatch = addSection[1].match(/确认按钮文字[：:]\s*\*\*([^*]+)\*\*/);
        if (saveBtnMatch) patterns.saveBtnText = saveBtnMatch[1].trim();
        // 提取表单字段表格
        patterns.formFields = parseFormFieldTable(addSection[1]);
    }
    // 检测编辑弹窗信息（可能与新增弹窗不同）
    const editSection = domProbeContent.match(/交互后探测[：:]编辑[^\n]*弹窗([\s\S]*?)(?=####|$)/);
    if (editSection) {
        const editSaveBtnMatch = editSection[1].match(/确认按钮文字[：:]\s*\*\*([^*]+)\*\*/);
        if (editSaveBtnMatch) patterns.editSaveBtnText = editSaveBtnMatch[1].trim();
        const editDialogTypeMatch = editSection[1].match(/弹窗类型[：:]\s*[`']?([^\s`'\n,，]+)/);
        if (editDialogTypeMatch) {
            const t = editDialogTypeMatch[1].replace(/[`'（(].*/g, '').trim();
            if (t) patterns.editDialogSelector = (t.startsWith('.') ? t : '.' + t) + ':visible';
        }
        // 如果新增弹窗没有表单字段但编辑弹窗有，用编辑弹窗的
        if (patterns.formFields.length === 0) {
            patterns.formFields = parseFormFieldTable(editSection[1]);
        }
    }
    // 检测新增按钮选择器（表格行操作按钮表格之前的新增按钮）
    const addBtnMatch = domProbeContent.match(/新增[^|]*\|\s*`([^`]+)`\s*\|\s*(?:verified|inferred)/);
    if (addBtnMatch) patterns.addBtnSelector = addBtnMatch[1];
    // 检测编辑按钮文字（从关键元素选择器表格中提取）
    const editBtnMatch = domProbeContent.match(/(?:编辑|修改)[^|]*\|\s*`([^`]+)`\s*\|\s*(?:verified|inferred)/);
    if (editBtnMatch) patterns.editBtnText = editBtnMatch[1].match(/:has-text\("([^"]+)"\)/) ?
        editBtnMatch[1].match(/:has-text\("([^"]+)"\)/)[1] : '编辑';
    // 检测开关/切换选择器
    const toggleSelectorMatch = domProbeContent.match(/(?:开关|切换|toggle)[^|]*\|\s*`([^`]+)`\s*\|\s*(?:verified|inferred)/i);
    if (toggleSelectorMatch) patterns.toggleSelector = toggleSelectorMatch[1];
    // 检测 CRUD 操作
    patterns.hasCrud = domProbeContent.includes('新增') || domProbeContent.includes('添加');
    patterns.hasEdit = domProbeContent.includes('编辑') || domProbeContent.includes('修改');
    patterns.hasDelete = domProbeContent.includes('删除');
    patterns.hasToggle = domProbeContent.includes('开关') || domProbeContent.includes('切换') || domProbeContent.includes('toggle') || domProbeContent.includes('auto-generate');
    // 从 api-probe.md 提取 API 路径（去掉 path 参数占位符）
    if (apiProbeContent) {
        const addMatch = apiProbeContent.match(/###\s+(?:POST|PUT)\s+(\/[^\s\[{]+add[^\s\[{]*)/i);
        if (addMatch) patterns.apiPaths.add = addMatch[1].replace(/\{[^}]+\}/g, '{id}');
        const updateMatch = apiProbeContent.match(/###\s+(?:POST|PUT)\s+(\/[^\s\[{]+(?:update|edit|modify)[^\s\[{]*)/i);
        if (updateMatch) patterns.apiPaths.update = updateMatch[1].replace(/\{[^}]+\}/g, '{id}');
        const deleteMatch = apiProbeContent.match(/###\s+(?:POST|DELETE)\s+(\/[^\s\[{]+delete[^\s\[{]*)/i);
        if (deleteMatch) patterns.apiPaths.delete = deleteMatch[1].replace(/\{[^}]+\}/g, '{id}');
        const toggleMatch = apiProbeContent.match(/###\s+(?:POST|PUT)\s+(\/[^\s\[{]+(?:toggle|auto-generate|enable|disable|status)[^\s\[{]*)/i);
        if (toggleMatch) patterns.apiPaths.toggle = toggleMatch[1].replace(/\{[^}]+\}/g, '{id}');
        const listMatch = apiProbeContent.match(/###\s+(?:GET|POST)\s+(\/[^\s\[{]+(?:list|page|query)[^\s\[{]*)/i);
        if (listMatch) patterns.apiPaths.list = listMatch[1].replace(/\{[^}]+\}/g, '{id}');
        // api-probe.md 记录的是含 apiPrefix 的完整路径（如 /saas/erp/biz/finance/xxx）
        // 生成的脚本会再次拼接 ${API_PREFIX}，所以这里必须先剥离 apiPrefix，只保留业务路径
        if (apiPrefix) {
            for (const key of ['add', 'update', 'delete', 'toggle', 'list']) {
                if (patterns.apiPaths[key] && patterns.apiPaths[key].startsWith(apiPrefix)) {
                    patterns.apiPaths[key] = patterns.apiPaths[key].slice(apiPrefix.length);
                }
            }
        }
    }
    return patterns;
}
// ─── 从 dom-probe.md 的 API 路径记录表提取实际触发路径 ──────────
// 这是 waitForResponse 路径的唯一权威来源，api-probe.md 是 Swagger 目录，不等于前端实际调用路径
function parseDomProbeApiPaths(domProbeContent, apiPrefix = '') {
    const paths = [];
    if (!domProbeContent) return paths;
    // 匹配所有 "#### API 路径记录" 章节（每个页面可能各有一个）
    const sectionRegex = /####\s*API\s*路径记录\s*\n\|[^\n]+\|\s*\n\|[-\s|]+\|\s*\n((?:\|[^\n]+\|\s*\n?)*)/gi;
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(domProbeContent)) !== null) {
        const tableBody = sectionMatch[1];
        const rowRegex = /\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
            const interaction = rowMatch[1].trim();
            const method = rowMatch[2].trim().toUpperCase();
            let apiPath = rowMatch[3].trim();
            if (interaction === '交互操作' || interaction.startsWith('---') || !apiPath.startsWith('/')) continue;
            // 剥离 apiPrefix，避免脚本中 ${API_PREFIX} + 路径 双重拼接
            if (apiPrefix && apiPath.startsWith(apiPrefix)) {
                apiPath = apiPath.slice(apiPrefix.length);
            }
            paths.push({ interaction, method, path: apiPath });
        }
    }
    return paths;
}
// 交互描述 → camelCase key（用于 API_PATHS 常量的 key 名）
function interactionToKey(interaction) {
    const keyMap = [
        [/页面加载|初始化列表|列表加载/, 'pageLoad'],
        [/新增.*保存|创建.*保存|添加.*保存|新增.*提交|新增.*确认/, 'add'],
        [/编辑.*保存|修改.*保存|更新.*保存|编辑.*提交/, 'update'],
        [/删除.*确认|点击删除/, 'delete'],
        [/开关|切换状态|toggle|启用|禁用/, 'toggle'],
        [/汇总|summary/i, 'summaryView'],
        [/明细|detail/i, 'detailView'],
        [/搜索|筛选|查询|filter|search/i, 'search'],
        [/分页|翻页|pagination/i, 'pagination'],
        [/提交|submit/i, 'submit'],
        [/审批|approve/i, 'approve'],
        [/撤回|recall/i, 'recall'],
    ];
    for (const [pattern, key] of keyMap) {
        if (pattern.test(interaction)) return key;
    }
    // 通用：去掉"点击"、"→"等，转 camelCase
    return interaction
        .replace(/点击|→|->|\s+/g, '')
        .replace(/[^一-龥a-zA-Z0-9]/g, '')
        .replace(/^[一-龥]+/, m => `action_${m}`)
        .replace(/^(.)/, c => c.toLowerCase()) || 'action';
}
// 生成 API_PATHS 常量（注入到骨架文件顶部）
function generateApiPathsConst(domApiPaths) {
    if (!domApiPaths || domApiPaths.length === 0) {
        return [
            '// ⚠️ dom-probe.md 缺少 "#### API 路径记录" 表格，API_PATHS 为空',
            '// 请重新执行 agent-browser 探测，记录每次交互触发的实际 API 请求',
            '// 禁止从 api-probe.md 手动填写路径——Swagger 目录路径 ≠ 前端实际调用路径',
            'const API_PATHS: Record<string, string> = {};',
        ].join('\n');
    }
    const seen = new Set();
    const lines = [
        '// API 路径常量（来自 dom-probe.md API 路径记录表，前端实际触发的路径）',
        '// ⚠️ 禁止从 api-probe.md 取路径——Swagger 目录路径 ≠ 前端实际调用路径',
        'const API_PATHS = {',
    ];
    for (const { interaction, method, path } of domApiPaths) {
        const key = interactionToKey(interaction);
        if (seen.has(key)) continue; // 同一 key 只取第一条
        seen.add(key);
        lines.push(`  ${key}: '${path}', // ${method} - ${interaction}`);
    }
    lines.push('};');
    return lines.join('\n');
}

// ─── 从 dom-probe.md 的表单字段表格中提取字段信息 ─────────────
function parseFormFieldTable(sectionContent) {
    const fields = [];
    // 匹配表单字段表格行：| 字段名 | 选择器 | 类型 | 默认值 | 必填 |
    const fieldRegex = /\|\s*(.+?)\s*\|\s*`(.+?)`\s*\|\s*(input|select|textarea|date|number|radio|checkbox|switch)\s*\|\s*(.+?)\s*\|\s*(\u2705|\u274C|是|否)\s*\|/gi;
    let fMatch;
    while ((fMatch = fieldRegex.exec(sectionContent)) !== null) {
        const name = fMatch[1].trim();
        const selector = fMatch[2].trim();
        const type = fMatch[3].trim().toLowerCase();
        const required = fMatch[5].trim() === '\u2705' || fMatch[5].trim() === '是';
        fields.push({ name, selector, type, required });
    }
    return fields;
}
// ─── Task 1.3 + 1.3c + 1.3d: 生成 fixtures.ts ─────────────
function generateFixtures(testingDir, config, domProbeContent) {
    const overlayData = parseOverlayInfo(domProbeContent);
    const uiFramework = config.techStack?.uiLibrary || '';
    const frameworkPatterns = getFrameworkOverlayPatterns(uiFramework);
    const customOverlay = config.techStack?.customOverlay;
    if (customOverlay?.selectors) frameworkPatterns.selectors = customOverlay.selectors;
    if (customOverlay?.localStorageKeys) {
        Object.assign(overlayData.localStorageKeys, customOverlay.localStorageKeys);
    }
    // Task 1.3d: 无覆盖层时最小化 fixtures
    const hasOverlayConfig =
        overlayData.selectors.length > 0 ||
        Object.keys(overlayData.localStorageKeys).length > 0 ||
        frameworkPatterns.selectors.length > 0;
    if (!hasOverlayConfig) {
        return `import { test, expect } from '@playwright/test';
// 无覆盖层配置，直接 re-export
// 如需覆盖层抑制，在 test-config.json 中配置 techStack.customOverlay
// 或在 dom-probe.md 中记录运行时干扰信息后重新运行 gen-skeleton.js
export { test, expect };
`;
    }
    // 有覆盖层：生成完整的 fixtures（含三层防护）
    return `import { test as base, expect } from '@playwright/test';

// 由 gen-skeleton.js 从 dom-probe.md 自动生成
// 覆盖层抑制通过 page fixture 注入，对所有 import 此文件的 spec 生效

export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.addInitScript((args) => {
      // === 第一层：localStorage 标记（阻止创建）===
      try {
        for (const [k, v] of Object.entries({ ...args.genericFlags, ...args.appFlags })) {
          localStorage.setItem(k, v);
        }
      } catch {}

      // === 第二层：CSS 注入（隐藏已创建的覆盖层）===
      const allSelectors = [...args.appSelectors, ...args.frameworkSelectors];
      if (allSelectors.length > 0) {
        const style = document.createElement('style');
        style.id = 'test-overlay-suppression';
        style.textContent = allSelectors.map(s =>
          s + ' { display: none !important; pointer-events: none !important; }'
        ).join('\\n');
        document.head.appendChild(style);
      }

      // === 第三层：MutationObserver 兜底（用 CSS style 而非 DOM remove）===
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            try {
              const cs = getComputedStyle(node);
              if ((cs.position === 'fixed' || cs.position === 'absolute') &&
                  parseInt(cs.zIndex) > 1000) {
                const rect = node.getBoundingClientRect();
                if (rect.width >= window.innerWidth * 0.5 &&
                    rect.height >= window.innerHeight * 0.5) {
                  const ic = node.querySelectorAll('button, input, select, textarea').length;
                  if (ic <= 1 && !node.querySelector('form')) {
                    node.style.setProperty('display', 'none', 'important');
                    node.style.setProperty('pointer-events', 'none', 'important');
                  }
                }
              }
            } catch {}
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

    }, {
      appSelectors: ${JSON.stringify(overlayData.selectors)},
      frameworkSelectors: ${JSON.stringify(frameworkPatterns.selectors)},
      appFlags: ${JSON.stringify(overlayData.localStorageKeys)},
      genericFlags: { 'tour-completed': 'true', 'guide-shown': 'true' },
    });

    await use(page);
  },
});

export { expect };
`;
}
// 从案例文档提取 TC → AC 关联映射（动态提取，不硬编码 AC 类型）
function extractTcAcMapping(testingDir) {
    const mapping = new Map(); // tcId -> [acId, ...]
    const caseFiles = [
        path.join(testingDir, 'test-cases/e2e-test-cases.md'),
        path.join(testingDir, 'test-cases/api-test-cases.md'),
        path.join(testingDir, 'test-cases/api-flow-test-cases.md'),
    ];
    const acPattern = /AC-[A-Z]+-\d+[a-z]?/g;
    for (const cf of caseFiles) {
        if (!fs.existsSync(cf)) continue;
        const content = fs.readFileSync(cf, 'utf-8');
        const lines = content.split('\n');
        let currentTcId = null;
        for (const line of lines) {
            const tcMatch = line.match(/^###\s+((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?)/);
            if (tcMatch) {
                currentTcId = tcMatch[1];
                if (!mapping.has(currentTcId)) mapping.set(currentTcId, new Set());
            }
            const acMatches = line.match(acPattern);
            if (acMatches && currentTcId) {
                for (const ac of acMatches) mapping.get(currentTcId).add(ac);
            }
        }
    }
    return mapping;
}
function generateApiTestSkeleton(ep, skeleton, tcAcMapping) {
    const params = ep.parameters.filter(p => p.in === 'query');
    const bodyParams = ep.requestBody;
    const tag = ep.tags[0] || 'api';
    const tcPrefix = `API-${tag.toUpperCase()}`;
    // 从案例文档提取该接口关联的所有 AC
    const relatedAcs = new Set();
    for (const [tcId, acs] of tcAcMapping) {
        if (tcId.startsWith(tcPrefix)) {
            for (const ac of acs) relatedAcs.add(ac);
        }
    }
    const coversComment = relatedAcs.size > 0 ? `  // @covers ${[...relatedAcs].join(', ')}` : '';
    const lines = [
        `import axios from 'axios';`,
        `import { getAuthToken } from '../helpers/auth';`,
        ``,
        `const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';`,
        `const API_PREFIX = process.env.API_PREFIX || '';`,
        ``,
        `describe('${ep.summary || ep.path}', () => {`,
        `  let authToken: string;`,
        `  beforeAll(async () => { authToken = await getAuthToken(); });`,
        ``,
        `  // 接口信息：${ep.method} ${ep.path}`,
        `  // TC 编号前缀：${tcPrefix}`,
    ];
    if (params.length > 0) {
        lines.push(`  // 查询参数：${params.map(p => `${p.name}(${p.required ? '必填' : '可选'})`).join(', ')}`);
    }
    if (bodyParams.length > 0) {
        lines.push(`  // 请求体参数：${bodyParams.map(p => p.name).join(', ')}`);
    }
    if (skeleton.wrapperClass) {
        lines.push(`  // 响应包装类：${skeleton.wrapperClass}，成功码 code=0`);
    }
    lines.push(`  // 以下测试用例由 LLM 从案例文档生成，不要手动添加`);
    lines.push(`});`);
    return lines.join('\n');
}
function generateApiCaseSkeleton(ep, skeleton) {
    const tag = ep.tags[0] || 'api';
    const tcPrefix = `API-${tag.toUpperCase()}`;
    return [
        `### ${ep.method} ${ep.path}`,
        ``,
        `#### ${tcPrefix}-001: 正常请求`,
        `- 接口：${ep.method} ${ep.path}`,
        `- 前置条件：已登录`,
        ep.parameters.length > 0 ? `- 请求参数：${ep.parameters.map(p => `${p.name}(${p.required ? '必填' : '可选'})`).join(', ')}` : '',
        `- 预期结果：HTTP 200, code=0`,
        ``,
        `<!-- TODO: 补充异常/边界案例 -->`,
        `<!-- TODO [E01]: 必填参数缺失 → 预期 400/参数校验失败 -->`,
        `<!-- TODO [E02]: 参数类型错误 → 预期 400/类型不匹配 -->`,
        `<!-- TODO [B01]: 字符串字段最大长度 → 预期截断或报错 -->`,
        `<!-- TODO [B02]: 数值字段边界值（0/负数/最大值） -->`,
        ``,
    ].filter(Boolean).join('\n');
}
function parseDomProbe(content) {
    const pages = [];
    // 兼容 Windows CRLF 换行
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const pageRegex = /### 页面：(.+)\n- 实际路由：(.+)/g;
    let match;
    while ((match = pageRegex.exec(normalized)) !== null) {
        const name = match[1].trim();
        const rawRoute = match[2].trim();
        // 清洗路由：去掉括号注释（如"（hash模式：#/xxx）"）
        const route = rawRoute.replace(/[（(].+?[）)]/g, '').trim();
        // 提取该页面下的选择器表格
        const pageStart = match.index;
        const nextPage = normalized.indexOf('### 页面：', pageStart + 1);
        const pageContent = nextPage > 0 ? normalized.substring(pageStart, nextPage) : normalized.substring(pageStart);
        // 检测路由模式：优先从「路由模式」字段读取，其次从「完整 URL 路径」字段读取
        const routeModeMatch = pageContent.match(/路由模式：\s*(hash|history)/i);
        const fullUrlMatch = pageContent.match(/完整 URL 路径：\s*(\/[^\s（(）)]*)/);
        let routeMode = 'history';
        let fullUrlPath = route;
        if (routeModeMatch) {
            routeMode = routeModeMatch[1].toLowerCase();
        } else if (fullUrlMatch && fullUrlMatch[1].includes('#/')) {
            routeMode = 'hash';
        } else if (rawRoute.includes('#/') || rawRoute.includes('hash')) {
            routeMode = 'hash';
        }
        if (fullUrlMatch) {
            // 清洗：去掉可能的括号注释
            fullUrlPath = fullUrlMatch[1].replace(/[（(].*/g, '').trim();
        } else if (routeMode === 'hash') {
            fullUrlPath = '/#' + (route.startsWith('/') ? route : '/' + route);
        }
        const selectors = [];
        const selectorRegex = /\| (.+?) \| `(.+?)` \| (?:verified|inferred) \| (.+?) \|/g;
        let sMatch;
        while ((sMatch = selectorRegex.exec(pageContent)) !== null) {
            selectors.push({
                description: sMatch[1].trim(),
                selector: sMatch[2].trim(),
                type: sMatch[3].trim(),
            });
        }
        pages.push({ name, route, routeMode, fullUrlPath, selectors });
    }
    return pages;
}
// ─── 生成 dismissTour 函数代码 ───────────────────────────────
function generateDismissTourFn(patterns) {
    if (!patterns.hasTour || !patterns.tourSelector) return '';
    return `
/** 关闭 ${patterns.tourSelector} 引导弹窗（如果存在）
 * 在每个可能触发 tour 的点击操作之后立即调用（新增/编辑/删除按钮点击后）
 */
async function dismissTour(page: any) {
  await page.evaluate(() => {
    if (!document.getElementById('test-tour-suppression')) {
      const style = document.createElement('style');
      style.id = 'test-tour-suppression';
      style.textContent = '${patterns.tourSelector} { display: none !important; pointer-events: none !important; }';
      document.head.appendChild(style);
    }
    document.querySelectorAll<HTMLElement>('${patterns.tourSelector}').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
  });${patterns.tourCloseSelector ? `
  const closeBtn = page.locator('${patterns.tourCloseSelector}');
  if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
    await closeBtn.click().catch(() => {});
  }` : ''}
}
`;
}
// ─── 生成 SEL 常量（从 dom-probe 提取的真实选择器）─────────────
function generateSelConstants(page, patterns, fw) {
    const lines = [`// 选择器常量（来自 dom-probe.md，已验证）`];
    lines.push(`const SEL = {`);
    lines.push(`  table: '${fw.table || '.table'}',`);
    lines.push(`  tableRow: '${fw.tableRow || 'tr'}',`);
    if (fw.pagination) lines.push(`  pagination: '${fw.pagination}',`);
    // 新增按钮（从 dom-probe 提取或用占位符）
    if (patterns.addBtnSelector) {
        lines.push(`  addBtn: '${patterns.addBtnSelector}',`);
    } else if (patterns.hasCrud) {
        lines.push(`  addBtn: 'button.el-button--primary:has-text("新增")', // TODO: 从 dom-probe.md 确认按钮文字`);
    }
    // 表单弹窗
    if (patterns.hasEdit || patterns.hasCrud) {
        lines.push(`  dialog: '${patterns.formDialogSelector}',`);
        lines.push(`  dialogSaveBtn: '${patterns.formDialogSelector.replace(':visible', '')}__footer button.el-button--primary:has-text("${patterns.saveBtnText}")',`);
        lines.push(`  dialogCancelBtn: '${patterns.formDialogSelector.replace(':visible', '')}__footer button:not(.el-button--primary)',`);
        lines.push(`  dialogClose: '${patterns.formDialogSelector.replace(':visible', '')}__headerbtn',`);
    }
    // 编辑弹窗（如果与新增弹窗不同）
    if (patterns.hasEdit && patterns.editDialogSelector && patterns.editDialogSelector !== patterns.formDialogSelector) {
        lines.push(`  editDialog: '${patterns.editDialogSelector}',`);
        lines.push(`  editDialogSaveBtn: '${patterns.editDialogSelector.replace(':visible', '')}__footer button.el-button--primary:has-text("${patterns.editSaveBtnText || patterns.saveBtnText}")',`);
    }
    // 删除确认弹窗（加容器限定）
    if (patterns.hasDelete) {
        lines.push(`  // [WARN] 删除确认弹窗（${patterns.confirmDialogType}）必须加容器限定，否则会匹配到页面其他 primary 按钮`);
        lines.push(`  deleteConfirmBtn: '${patterns.confirmDialogType} button.el-button--primary:has-text("${patterns.confirmBtnText}")',`);
        lines.push(`  deleteCancelBtn: '${patterns.confirmDialogType} button:has-text("${patterns.cancelBtnText}")',`);
    }
    // 开关/切换选择器
    if (patterns.hasToggle && patterns.toggleSelector) {
        lines.push(`  toggleSwitch: '${patterns.toggleSelector}',`);
    }
    // 表单字段选择器（从 dom-probe.md 交互后探测的表单字段表格提取）
    if (patterns.formFields && patterns.formFields.length > 0) {
        lines.push(`  // ── 表单字段（来自 dom-probe.md 交互后探测）──`);
        for (const field of patterns.formFields) {
            // 中文字段名转 camelCase key：form + 首字母大写
            let key = 'form' + field.name
                .replace(/[（(].*/g, '')
                .trim()
                .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
                .replace(/^(.)/, c => c.toUpperCase());
            // 全中文时用 formField + 序号
            if (!/[a-zA-Z]/.test(key.replace('form', ''))) {
                key = `formField${patterns.formFields.indexOf(field) + 1}`;
            }
            lines.push(`  ${key}: '${field.selector}', // ${field.name}${field.required ? '（必填）' : ''} [${field.type}]`);
        }
    }
    // 从 dom-probe 提取的其他选择器（跳过已生成的重复项）
    const usedSelectors = new Set();
    const usedKeys = new Set(['table', 'tableRow', 'pagination', 'addBtn', 'dialog', 'dialogSaveBtn', 'dialogCancelBtn', 'dialogClose', 'editDialog', 'editDialogSaveBtn', 'deleteConfirmBtn', 'deleteCancelBtn', 'toggleSwitch']);
    let extraIdx = 1;
    for (const sel of page.selectors.slice(0, 12)) {
        if (usedSelectors.has(sel.selector)) continue;
        usedSelectors.add(sel.selector);
        // 中文描述转 camelCase key：先提取英文/数字部分，全中文则用 field+序号
        let key = sel.description
            .replace(/[（(].*/g, '')
            .trim()
            .replace(/[\s\-_]+(.)/g, (_, c) => c.toUpperCase())
            .replace(/[^a-zA-Z0-9]/g, '')
            .replace(/^(.)/, c => c.toLowerCase());
        if (!key) key = `field${extraIdx}`;
        // 避免 key 重复
        if (usedKeys.has(key)) key = `${key}${extraIdx}`;
        usedKeys.add(key);
        extraIdx++;
        lines.push(`  ${key}: '${sel.selector}', // ${sel.description}`);
    }
    lines.push(`};`);
    return lines.join('\n');
}
// ─── 生成 waitForResponse 辅助函数 ──────────────────────────
function generateWaitForResponseHelper(patterns, domApiPaths) {
    const lines = [];
    // 优先使用 dom-probe API 路径（前端实际调用），回退到 api-probe 路径
    const hasDomPaths = domApiPaths && domApiPaths.length > 0;
    if (hasDomPaths) {
        // 使用 API_PATHS 常量引用，不硬编码路径字符串
        lines.push('// waitForResponse 辅助（路径引用 API_PATHS 常量，status 兼容 204 等 2xx）');
        const seen = new Set();
        for (const { interaction, path } of domApiPaths) {
            const key = interactionToKey(interaction);
            if (seen.has(key)) continue;
            seen.add(key);
            const fnName = 'waitFor' + key.charAt(0).toUpperCase() + key.slice(1);
            lines.push(`const ${fnName} = (page: any) => page.waitForResponse(r =>`);
            lines.push(`  r.url().includes(\`\${API_PREFIX}\${API_PATHS.${key}}\`) && r.status() >= 200 && r.status() < 300);`);
        }
        return lines.join('\n');
    }
    // 回退：使用 api-probe.md 路径（标注警告）
    if (patterns.apiPaths.add) {
        lines.push('// ⚠️ 以下路径来自 api-probe.md（Swagger 目录），可能与前端实际调用路径不符');
        lines.push('// 建议重新执行 agent-browser 探测，补充 dom-probe.md 的 API 路径记录表');
        lines.push(`const waitForAdd = (page: any) => page.waitForResponse(r =>`);
        lines.push(`  r.url().includes(\`\${API_PREFIX}${patterns.apiPaths.add}\`) && r.status() >= 200 && r.status() < 300);`);
    }
    if (patterns.apiPaths.update) {
        lines.push(`const waitForUpdate = (page: any) => page.waitForResponse(r =>`);
        lines.push(`  r.url().includes(\`\${API_PREFIX}${patterns.apiPaths.update}\`) && r.status() >= 200 && r.status() < 300);`);
    }
    if (patterns.apiPaths.delete) {
        lines.push(`const waitForDelete = (page: any) => page.waitForResponse(r =>`);
        lines.push(`  r.url().includes(\`\${API_PREFIX}${patterns.apiPaths.delete}\`) && r.status() >= 200 && r.status() < 300);`);
    }
    if (patterns.apiPaths.toggle) {
        lines.push(`const waitForToggle = (page: any) => page.waitForResponse(r =>`);
        lines.push(`  r.url().includes(\`\${API_PREFIX}${patterns.apiPaths.toggle}\`) && r.status() >= 200 && r.status() < 300);`);
    }
    return lines.join('\n');
}
function generateE2eTestSkeleton(page, patterns, uiLibrary, domApiPaths, tcAcMapping) {
    const fw = FRAMEWORK_PATTERNS[uiLibrary] || FRAMEWORK_PATTERNS['element-plus'];
    const hasTour = patterns && patterns.hasTour;
    const dismissTourFn = patterns ? generateDismissTourFn(patterns) : '';
    const selConstants = patterns ? generateSelConstants(page, patterns, fw) : `const SEL = {\n  // TODO: 从 dom-probe.md 复制真实选择器\n};`;
    const apiPathsConst = generateApiPathsConst(domApiPaths);
    const waitHelpers = patterns ? generateWaitForResponseHelper(patterns, domApiPaths) : '';
    const lines = [
        `import { test, expect } from '../fixtures';`,
        `import path from 'path';`,
        ``,
        `const WORK_DIR = process.env.WORK_DIR || process.cwd();`,
        `const IS_STANDALONE = !process.env.WORK_DIR;`,
        `const SCREENSHOTS_DIR = IS_STANDALONE`,
        `    ? path.resolve(process.cwd(), 'screenshots')`,
        `    : path.resolve(WORK_DIR, 'testing/screenshots');`,
        `const STORAGE_STATE_PATH = IS_STANDALONE`,
        `    ? path.resolve(process.cwd(), '.cache', '.auth', 'storage-state.json')`,
        `    : path.resolve(WORK_DIR, 'testing/auth/storage-state.json');`,
        `const API_PREFIX = process.env.API_PREFIX || '';`,
        `const TS = Date.now(); // 每次运行唯一时间戳，避免数据名称重复`,
        `// 路由模式：${page.routeMode}`,
        `const ROUTE = '${page.fullUrlPath}';`,
        ``,
        apiPathsConst,
        ``,
        selConstants,
        ``,
    ];
    if (dismissTourFn) lines.push(dismissTourFn);
    if (waitHelpers) { lines.push(waitHelpers); lines.push(''); }

    // 生成 Element Plus 运行时辅助函数
    const hasNumberField = patterns && patterns.formFields && patterns.formFields.some(f => f.type === 'number');
    if (hasNumberField) {
        lines.push(`/** el-input-number fill() 不触发 Vue change，用此函数替代 */`);
        lines.push(`async function fillNumberInput(page: any, selector: string, value: number | string) {`);
        lines.push(`  const input = page.locator(selector);`);
        lines.push(`  await input.click();`);
        lines.push(`  await input.fill('');`);
        lines.push(`  await input.pressSequentially(String(value), { delay: 50 });`);
        lines.push(`  await input.evaluate((el: HTMLInputElement) => {`);
        lines.push(`    el.dispatchEvent(new Event('input', { bubbles: true }));`);
        lines.push(`    el.dispatchEvent(new Event('change', { bubbles: true }));`);
        lines.push(`  });`);
        lines.push(`  await input.blur();`);
        lines.push(`}`);
        lines.push('');
    }
    if (patterns && patterns.hasEdit) {
        lines.push(`/** 编辑弹窗数据异步回显，等待字段有值 */`);
        lines.push(`async function waitForFormPopulated(page: any, selector: string, timeout = 5000) {`);
        lines.push(`  await expect(page.locator(selector)).not.toHaveValue('', { timeout });`);
        lines.push(`}`);
        lines.push('');
    }

    // 从 tcAcMapping 提取当前页面关联的 AC
    if (tcAcMapping && tcAcMapping.size > 0) {
        const pageName = page.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const relatedAcs = new Set();
        for (const [tcId, acs] of tcAcMapping) {
            // FE-XXX-001 格式：匹配页面名称
            if (tcId.startsWith('FE-') && tcId.toUpperCase().includes(pageName)) {
                for (const ac of acs) relatedAcs.add(ac);
            }
        }
        if (relatedAcs.size > 0) {
            lines.push(`// @covers ${[...relatedAcs].join(', ')}`);
            lines.push('');
        }
    }

    lines.push(`// 以下测试用例由 LLM 从 PRD + UI 原型设计生成，不要手动添加`);
    lines.push('');
    lines.push(`// ── 案例覆盖提醒（LLM 生成时必须覆盖以下类型）──`);
    lines.push(`// TODO [E] 异常场景：每个表单提交至少 2 个异常案例（接口报错 Mock、数据不存在）`);
    lines.push(`// TODO [B] 边界值：每个输入字段至少 1 个边界案例（空值、最大长度、特殊字符）`);
    lines.push(`// TODO [V] 表单验证：每个必填字段至少 1 个空值提交验证案例`);
    lines.push(`// TODO [S] 状态交互：加载中、空状态、分页（如有）`);

    return lines.join('\n');
}

// ─── 主流程 ─────────────────────────────────────────────────
function main() {
    const { testingDir } = parseArgs();
    const cacheDir = path.join(testingDir, '.cache');
    let generated = 0;
    // 读取 test-config.json
    const configPath = path.join(testingDir, 'test-config.json');
    const config = fs.existsSync(configPath)
        ? safeReadJson(configPath, { fallback: {} })
        : {};
    const scope = config.scope || 'fullstack';
    
    // ─── testingRepo 模式检测 ─────────────────────────────────
    const tr = config.testingRepo;
    let repoRoot = null;
    if (tr && tr.path) {
        const { normalizeMsysPath } = require('../lib/path-utils');
        const resolved = normalizeMsysPath(tr.path.replace(/\$JLC_AI_WORKSPACE/g, process.env.JLC_AI_WORKSPACE || ''));
        repoRoot = resolved;
        if (!fs.existsSync(repoRoot)) {
            console.error(`[FAIL] testingRepo 目录不存在: ${repoRoot}`);
            console.error('   请检查 test-config.json 中 testingRepo.path 配置是否正确');
            process.exit(1);
        }
        console.log(`[INFO] testingRepo 模式: ${repoRoot}`);
    }

    // ─── 功能树分组目录检测 ───────────────────────────────────
    let e2eGroupDir = null; // 功能树 groupId 目录名
    if (repoRoot) {
        const { buildGroupDirMapFromFile } = require('../lib/group-dir-map');
        const treeContextPath = path.join(testingDir, '.cache', 'tree-context.json');
        const groupDirMap = buildGroupDirMapFromFile(treeContextPath);
        if (groupDirMap) {
            const firstGroup = Object.values(groupDirMap)[0];
            if (firstGroup) {
                e2eGroupDir = firstGroup;
                console.log(`[INFO] 功能树分组输出: tests/e2e/features/${e2eGroupDir}/`);
            }
        }
        if (!e2eGroupDir) {
            console.log('[INFO] 无功能树数据，使用扁平 tests/e2e/features/ 输出');
        }
    }

    // 输出目录：方案 C - 配置集中 + 功能树保留
    let e2eOutputDir;
    if (!repoRoot) {
        e2eOutputDir = path.join(testingDir, 'scripts', 'e2e');
    } else if (e2eGroupDir) {
        e2eOutputDir = path.join(repoRoot, 'tests', 'e2e', 'features', e2eGroupDir);
    } else {
        e2eOutputDir = path.join(repoRoot, 'tests', 'e2e', 'features');
    }
    const configOutputDir = repoRoot || path.join(testingDir, 'scripts', 'e2e');
    const apiOutputDir = repoRoot ? path.join(repoRoot, 'tests', 'api', 'features') : path.join(testingDir, 'scripts', 'api');
    
    // 写入 .gitignore，防止 node_modules、缓存、登录凭据被误提交
    const gitignorePath = path.join(testingDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, [
            'node_modules/',
            '.cache/',
            'scripts/e2e/test-results/',
            'auth/storage-state.json',
        ].join('\n') + '\n');
        generated++;
        console.log('[OK] .gitignore 已生成');
    }

    // ─── Testing-Repo 额外产物输出 ───────────────────────────────
    if (repoRoot) {
        const sharedDir = path.join(repoRoot, 'shared');
        const scriptsDir = path.join(repoRoot, 'scripts');
        fs.mkdirSync(sharedDir, { recursive: true });
        fs.mkdirSync(scriptsDir, { recursive: true });

        // .env.example（仅首次生成，不覆盖已有）
        const envExamplePath = path.join(repoRoot, '.env.example');
        if (!fs.existsSync(envExamplePath)) {
            fs.writeFileSync(envExamplePath, getEnvExampleTemplate());
            generated++;
            console.log('[OK] .env.example 已生成');
        }

        // .env（每次覆盖，确保值最新）
        const envPath = path.join(repoRoot, '.env');
        fs.writeFileSync(envPath, generateEnvFromConfig(config));
        generated++;
        console.log('[OK] .env 已生成（含实际配置值）');

        // package.json
        const pkgPath = path.join(repoRoot, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            fs.writeFileSync(pkgPath, getPackageJsonTemplate());
            generated++;
            console.log('[OK] package.json 已生成');
        }

        // auth.setup.ts
        const authSetupPath = path.join(sharedDir, 'auth.setup.ts');
        if (!fs.existsSync(authSetupPath)) {
            fs.writeFileSync(authSetupPath, getAuthSetupTemplate());
            generated++;
            console.log('[OK] shared/auth.setup.ts 已生成');
        }

        // api-client.ts（Testing-Repo 专用，token 名称可配置）
        const repoApiClientPath = path.join(sharedDir, 'api-client.ts');
        if (!fs.existsSync(repoApiClientPath)) {
            fs.writeFileSync(repoApiClientPath, getRepoApiClientTemplate());
            generated++;
            console.log('[OK] shared/api-client.ts 已生成');
        }

        // setup.sh
        const setupShPath = path.join(scriptsDir, 'setup.sh');
        if (!fs.existsSync(setupShPath)) {
            fs.writeFileSync(setupShPath, getSetupShTemplate());
            generated++;
            console.log('[OK] scripts/setup.sh 已生成');
        }

        // run.sh
        const runShPath = path.join(scriptsDir, 'run.sh');
        if (!fs.existsSync(runShPath)) {
            fs.writeFileSync(runShPath, getRunShTemplate());
            generated++;
            console.log('[OK] scripts/run.sh 已生成');
        }

        // run.ps1
        const runPs1Path = path.join(scriptsDir, 'run.ps1');
        if (!fs.existsSync(runPs1Path)) {
            fs.writeFileSync(runPs1Path, getRunPs1Template());
            generated++;
            console.log('[OK] scripts/run.ps1 已生成');
        }

        // .gitignore（Testing-Repo 专用）
        const repoGitignorePath = path.join(repoRoot, '.gitignore');
        if (!fs.existsSync(repoGitignorePath)) {
            fs.writeFileSync(repoGitignorePath, getRepoGitignoreTemplate());
            generated++;
            console.log('[OK] Testing-Repo .gitignore 已生成');
        }

        // README.md
        const readmePath = path.join(repoRoot, 'README.md');
        if (!fs.existsSync(readmePath)) {
            fs.writeFileSync(readmePath, getReadmeTemplate());
            generated++;
            console.log('[OK] README.md 已生成');
        }
    }

    // ─── 统一读取 dom-probe.md（避免重复读取）─────────────────────
    const domProbePath = path.join(testingDir, 'dom-probe.md');
    const domProbeContent = fs.existsSync(domProbePath)
        ? fs.readFileSync(domProbePath, 'utf-8')
        : '';
    // Task 1.1: 生成 playwright.config.ts（scope 含前端时）
    if (scope !== 'backend') {
        fs.mkdirSync(e2eOutputDir, { recursive: true });
        const pwConfigPath = path.join(configOutputDir, 'playwright.config.ts');
        fs.writeFileSync(pwConfigPath, generatePlaywrightConfig(testingDir, config, configOutputDir, { repoMode: !!repoRoot }));
        generated++;
        console.log(`[OK] playwright.config.ts 已生成: ${pwConfigPath}`);
    }
    // Task 1.2: 生成 vitest.config.ts（scope 含后端时）
    if (scope !== 'frontend') {
        fs.mkdirSync(apiOutputDir, { recursive: true });
        const vitestConfigPath = path.join(configOutputDir, 'vitest.config.ts');
        fs.writeFileSync(vitestConfigPath, generateVitestConfig(testingDir, config, configOutputDir));
        generated++;
        console.log(`[OK] vitest.config.ts 已生成: ${vitestConfigPath}`);

        // 生成共享 Helper 层（api-client.ts + auth.ts）
        const helpersDir = path.join(apiOutputDir, 'helpers');
        fs.mkdirSync(helpersDir, { recursive: true });
        const apiClientPath = path.join(helpersDir, 'api-client.ts');
        if (!fs.existsSync(apiClientPath)) {
            // 尝试从插件模板复制
            const pluginDir = process.env.CLAUDE_PLUGIN_ROOT || '';
            const templatePath = path.join(pluginDir, 'skills/test-scripting/references/api-shared-helpers.ts');
            if (pluginDir && fs.existsSync(templatePath)) {
                fs.copyFileSync(templatePath, apiClientPath);
            } else {
                // 内联生成最小 api-client.ts（认证 header 从配置读取）
                const authHeaderName = config.backend?.authHeaderName || 'Authorization';
                const authHeaderFormat = config.backend?.authHeaderFormat || 'Bearer {token}';
                const headerExpr = authHeaderFormat.replace('{token}', '${token}');
                fs.writeFileSync(apiClientPath, [
                    "import axios from 'axios';",
                    "import { getAuthToken } from './auth';",
                    "",
                    "const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';",
                    "const API_PREFIX = process.env.API_PREFIX || '';",
                    "",
                    "async function getHeaders(opts: { token?: string } = {}) {",
                    "  const token = opts.token ?? await getAuthToken();",
                    `  return { 'Content-Type': 'application/json', ...(token ? { '${authHeaderName}': \`${headerExpr}\` } : {}) };`,
                    "}",
                    "",
                    "export async function post<T = any>(path: string, body: object, opts: { token?: string; timeout?: number } = {}): Promise<T> {",
                    "  const res = await axios.post(`${BASE_URL}${API_PREFIX}${path}`, body, { headers: await getHeaders(opts), validateStatus: () => true, timeout: opts.timeout });",
                    "  return res.data;",
                    "}",
                    "",
                    "export async function get<T = any>(path: string, params: Record<string, string | number> = {}, opts: { token?: string; timeout?: number } = {}): Promise<T> {",
                    "  const res = await axios.get(`${BASE_URL}${API_PREFIX}${path}`, { params, headers: await getHeaders(opts), validateStatus: () => true, timeout: opts.timeout });",
                    "  return res.data;",
                    "}",
                    "",
                    "export async function put<T = any>(path: string, body: object, opts: { token?: string; timeout?: number } = {}): Promise<T> {",
                    "  const res = await axios.put(`${BASE_URL}${API_PREFIX}${path}`, body, { headers: await getHeaders(opts), validateStatus: () => true, timeout: opts.timeout });",
                    "  return res.data;",
                    "}",
                    "",
                    "export async function del<T = any>(path: string, opts: { token?: string; timeout?: number } = {}): Promise<T> {",
                    "  const res = await axios.delete(`${BASE_URL}${API_PREFIX}${path}`, { headers: await getHeaders(opts), validateStatus: () => true, timeout: opts.timeout });",
                    "  return res.data;",
                    "}",
                ].join('\n'));
            }
            generated++;
            console.log('[OK] helpers/api-client.ts 已生成');
        }
        const authPath = path.join(helpersDir, 'auth.ts');
        if (!fs.existsSync(authPath)) {
            const authConfig = config.auth || {};
            const authLines = [
                "// 认证 helper — 由 gen-skeleton.js 自动生成",
                "export async function getAuthToken(): Promise<string> {",
            ];
            if (authConfig.token) {
                authLines.push(`  return process.env.AUTH_TOKEN || '${authConfig.token}';`);
            } else if (authConfig.loginUrl) {
                authLines.push("  // TODO: 实现登录获取 token 逻辑");
                authLines.push(`  // loginUrl: ${authConfig.loginUrl}`);
                authLines.push("  return process.env.AUTH_TOKEN || '';");
            } else {
                authLines.push("  return process.env.AUTH_TOKEN || '';");
            }
            authLines.push("}");
            fs.writeFileSync(authPath, authLines.join('\n'));
            generated++;
            console.log('[OK] helpers/auth.ts 已生成');
        }
    }
    // Task 1.3: 生成 fixtures.ts（scope 含前端时）
    if (scope !== 'backend') {
        fs.mkdirSync(configOutputDir, { recursive: true });
        const fixturesPath = path.join(configOutputDir, 'fixtures.ts');
        fs.writeFileSync(fixturesPath, generateFixtures(testingDir, config, domProbeContent));
        generated++;
        console.log(`[OK] fixtures.ts 已生成: ${fixturesPath}`);
    }
    // API 骨架
    const skeletonPath = path.join(cacheDir, 'api-skeleton.json');
    const skeletonData = fs.existsSync(skeletonPath) ? safeReadJson(skeletonPath, { fallback: { endpoints: [] } }) : null;
    if (skeletonData) {
        // 生成 API 脚本骨架
        const apiTestDir = path.join(apiOutputDir, 'tests');
        fs.mkdirSync(apiTestDir, { recursive: true });
        // 生成 API 案例骨架
        const casesLines = ['# API 测试案例骨架\n'];
        for (const ep of skeletonData.endpoints) {
            const safeName = ep.operationId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const testFile = path.join(apiTestDir, `${safeName}.api.test.ts`);
            if (!fs.existsSync(testFile)) {
                fs.writeFileSync(testFile, generateApiTestSkeleton(ep, skeletonData));
                generated++;
            }
            casesLines.push(generateApiCaseSkeleton(ep, skeletonData));
        }
        const casesSkeleton = path.join(testingDir, 'test-cases/api-test-cases-skeleton.md');
        fs.mkdirSync(path.dirname(casesSkeleton), { recursive: true });
        fs.writeFileSync(casesSkeleton, casesLines.join('\n'));
        generated++;
        console.log(`[OK] API 骨架: ${skeletonData.endpoints.length} 个接口`);
    }
    else {
        console.log('[WARN] api-skeleton.json 不存在，跳过 API 骨架生成');
    }
    // Flow 目录预创建（testingRepo 模式 + affectedFlows 配置时）
    if (repoRoot && config.testingRepo?.affectedFlows?.length > 0) {
        for (const flowId of config.testingRepo.affectedFlows) {
            const flowDir = path.join(repoRoot, 'flows', flowId, 'api');
            fs.mkdirSync(flowDir, { recursive: true });
            console.log(`[OK] Flow 目录已预创建: ${flowDir}`);
        }
    }
    // E2E 骨架
    if (domProbeContent) {
        const pages = parseDomProbe(domProbeContent);
        // 读取 api-probe.md（如果存在，用于提取 API 路径）
        const apiProbePath = path.join(testingDir, 'api-probe.md');
        const apiProbeContent = fs.existsSync(apiProbePath)
            ? fs.readFileSync(apiProbePath, 'utf-8')
            : '';
        // 解析交互模式（从 dom-probe + api-probe 提取确定信息）
        const uiLibrary = config.techStack?.uiLibrary || 'element-plus';
        // apiPrefix 用于剥离路径中的前缀，避免生成脚本时双重拼接
        const apiPrefix = config.backend?.apiPrefix || '';
        const patterns = parseInteractionPatterns(domProbeContent, apiProbeContent, uiLibrary, apiPrefix);
        // 从 dom-probe.md API 路径记录表提取前端实际触发路径（权威来源）
        const domApiPaths = parseDomProbeApiPaths(domProbeContent, apiPrefix);
        if (domApiPaths.length > 0) {
            console.log(`[OK] dom-probe API 路径记录: ${domApiPaths.length} 条（${domApiPaths.map(p => p.interaction).join(', ')}）`);
        } else {
            console.log('[WARN] dom-probe.md 缺少 "#### API 路径记录" 表格，waitForResponse 路径将回退到 api-probe.md（可能不准确）');
        }
        console.log(`[INSPECT] 交互模式识别: hasTour=${patterns.hasTour}, hasEdit=${patterns.hasEdit}, hasDelete=${patterns.hasDelete}, hasToggle=${patterns.hasToggle}, confirmDialog=${patterns.confirmDialogType}`);
        if (patterns.apiPaths.add) console.log(`   add: ${patterns.apiPaths.add}`);
        if (patterns.apiPaths.update) console.log(`   update: ${patterns.apiPaths.update}`);
        if (patterns.apiPaths.delete) console.log(`   delete: ${patterns.apiPaths.delete}`);
        if (patterns.apiPaths.toggle) console.log(`   toggle: ${patterns.apiPaths.toggle}`);
        if (patterns.formFields.length > 0) console.log(`   formFields: ${patterns.formFields.length} 个字段`);
        const e2eTestDir = e2eOutputDir;
        fs.mkdirSync(e2eTestDir, { recursive: true });
        const tcAcMapping = extractTcAcMapping(testingDir);
        const casesLines = ['# E2E 测试案例骨架\n'];
        for (const page of pages) {
            const safeName = page.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').toLowerCase();
            const testFile = path.join(e2eTestDir, `${safeName}.spec.ts`);
            if (!fs.existsSync(testFile)) {
                fs.writeFileSync(testFile, generateE2eTestSkeleton(page, patterns, uiLibrary, domApiPaths, tcAcMapping));
                generated++;
            }
            casesLines.push(`### ${page.name} (${page.route})\n`);
            for (const sel of page.selectors) {
                casesLines.push(`- ${sel.description}: \`${sel.selector}\``);
            }
            casesLines.push('\n<!-- TODO: 补充完整测试案例 -->\n');
        }
        const casesSkeleton = path.join(testingDir, 'test-cases/e2e-test-cases-skeleton.md');
        fs.mkdirSync(path.dirname(casesSkeleton), { recursive: true });
        fs.writeFileSync(casesSkeleton, casesLines.join('\n'));
        generated++;
        console.log(`[OK] E2E 骨架: ${pages.length} 个页面`);
    }
    else {
        console.log('[WARN] dom-probe.md 不存在，跳过 E2E 骨架生成');
    }
    // ─── 生成探测摘要（probe-summary）───────────────────────────
    try {
        const probeSummary = require('../lib/probe-summary');
        const uiLib = config.techStack?.uiLibrary || null;
        const customHints = config.techStack?.customHints || null;
        // DOM 探测摘要（复用已读取的 domProbeContent 和 skeletonData）
        const domProbeSummaryPath = path.join(cacheDir, 'dom-probe-summary.json');
        const domSummary = probeSummary.buildDomProbeSummary(domProbeContent, skeletonData, uiLib, customHints);
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(domProbeSummaryPath, JSON.stringify(domSummary, null, 2));
        console.log(`[OK] dom-probe-summary.json 已生成（检测框架: ${domSummary.detectedLibrary || '未知'}）`);
        // API 探测摘要
        const apiProbeSummaryPath = path.join(cacheDir, 'api-probe-summary.json');
        const apiProbeFile = path.join(testingDir, 'api-probe.md');
        const apiContent = fs.existsSync(apiProbeFile) ? fs.readFileSync(apiProbeFile, 'utf-8') : '';
        const apiSummary = probeSummary.buildApiProbeSummary(skeletonData, apiContent);
        fs.writeFileSync(apiProbeSummaryPath, JSON.stringify(apiSummary, null, 2));
        console.log(`[OK] api-probe-summary.json 已生成（${apiSummary.totalCount} 个接口）`);
    } catch (e) {
        console.log(`[WARN] 探测摘要生成失败（不影响骨架生成）: ${e.message}`);
    }
    console.log(`\n共生成 ${generated} 个文件`);
}
main();
