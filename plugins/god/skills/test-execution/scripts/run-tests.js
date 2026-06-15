#!/usr/bin/env node
"use strict";
/**
 * TASK-04: run-tests.js
 * 脚本化执行全部测试，输出结构化结果
 * 支持 testingRepo 模式（Phase 3）从集中测试仓库执行
 *
 * 用法：node run-tests.js --config testing/test-config.json
 * 退出码：0=全部通过，1=有失败，2=预检失败
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
const child_process_1 = require("child_process");
const path_utils_1 = require("../../../scripts/lib/path-utils");
const { collectTestingRepoTests } = require("../../../scripts/lib/test-file-collector");
function parseArgs() {
    const argv = process.argv.slice(2);
    let config = 'testing/test-config.json';
    let scopeOverride = null;
    let includeSingleApi = false;
    let mode = 'parallel';
    let phase = 'all';
    let devMode = false;
    let filePattern = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--config' && argv[i + 1])
            config = argv[++i];
        else if (argv[i] === '--scope' && argv[i + 1])
            scopeOverride = argv[++i];
        else if (argv[i] === '--include-single-api')
            includeSingleApi = true;
        else if (argv[i] === '--mode' && argv[i + 1])
            mode = argv[++i];
        else if (argv[i] === '--phase' && argv[i + 1])
            phase = argv[++i];
        else if (argv[i] === '--dev')
            devMode = true;
        else if (argv[i] === '--file' && argv[i + 1])
            filePattern = argv[++i];
    }
    // 'all' 作为 'fullstack' 的别名
    if (scopeOverride === 'all') scopeOverride = 'fullstack';
    return { config: path_utils_1.normalizeMsysPath(config), scopeOverride, includeSingleApi, mode, phase, devMode, filePattern };
}
function runCommand(cmd, label, env, cwd) {
    if (env === void 0) { env = process.env; }
    console.log(`执行: ${cmd}${cwd ? ` (cwd: ${cwd})` : ''}`);
    try {
        (0, child_process_1.execSync)(cmd, { stdio: 'inherit', timeout: 300000, env: env, cwd: cwd });
        return 0;
    }
    catch (err) {
        if (err.status !== undefined)
            return err.status;
        console.error(`${label} 执行异常: ${err.message}`);
        return 1;
    }
}
function runCommandAsync(cmd, label, env, cwd, timeout) {
    if (env === void 0) { env = process.env; }
    if (timeout === void 0) { timeout = 300000; }
    return new Promise((resolve) => {
        let proc;
        if (Array.isArray(cmd)) {
            console.log(`[并行] 启动 ${label}: ${cmd.join(' ')}`);
            proc = (0, child_process_1.spawn)('npx', cmd, { env: env, cwd: cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        } else {
            const isWin = process.platform === 'win32';
            const shell = isWin ? 'cmd' : 'sh';
            const flag = isWin ? '/c' : '-c';
            console.log(`[并行] 启动 ${label}: ${cmd}`);
            proc = (0, child_process_1.spawn)(shell, [flag, cmd], { env: env, cwd: cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        }
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.stderr.on('data', (d) => { stderr += d; });
        proc.on('close', (code) => {
            resolve({ exitCode: code || 0, stdout: stdout, stderr: stderr });
        });
        setTimeout(() => {
            proc.kill();
            resolve({ exitCode: 124, stdout: stdout, stderr: stderr, killed: true });
        }, timeout);
    });
}
function readTimeoutConfig(configData) {
    const timeout = configData.timeout || {};
    return {
        apiParallel: timeout.apiParallel || 180000,
        e2eParallel: timeout.e2eParallel || 300000,
        serialApi: timeout.serialApi || 300000,
        serialE2e: timeout.serialE2e || 300000,
        perTestMs: timeout.perTestMs || 120000,
    };
}
// 动态超时计算：根据测试文件数量缩放总超时
function calculateDynamicTimeout(baseMs, testCount, perTestMs) {
    if (testCount <= 0) return baseMs;
    const scaled = testCount * perTestMs + 60000;
    return Math.max(baseMs, Math.min(scaled, 3600000));
}
// Task 2.2: 递归查找测试文件
function countFiles(dir, pattern) {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    function walk(d) {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            if (entry.isDirectory()) walk(path.join(d, entry.name));
            else if (entry.name.match(pattern)) count++;
        }
    }
    walk(dir);
    return count;
}

// 递归收集测试文件（返回绝对路径列表）
function collectTestFiles(dir, pattern) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    function walk(d) {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.match(pattern)) files.push(full);
        }
    }
    walk(dir);
    return files;
}

// --file 参数过滤：按 glob/substring 匹配文件名
function filterByFilePattern(files, filePattern) {
    if (!filePattern) return files;
    const pattern = filePattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(pattern, 'i');
    return files.filter(f => re.test(path.basename(f)));
}

// 自适应分批执行 E2E 测试
// 从小批量开始，根据实测性能动态调整批次大小，每批结果独立写入文件
// 支持断点续跑：总执行时间接近 Bash 工具限制时保存进度退出，下次调用从断点继续
function runE2EAdaptiveBatch(opts) {
    const { testFiles, pwConfig, testEnv, cacheDir, e2eRawFile, e2eCwd, scope, devMode } = opts;
    const BATCH_TIME_BUDGET_MS = 480000; // 8 min per batch (Claude Code 10min - 2min buffer)
    const TOTAL_TIME_BUDGET_MS = 540000; // 9 min total (Claude Code 10min - 1min buffer)
    const SEED_BATCH_SIZE = 5;
    const progressFile = path.join(cacheDir, 'batch-progress.json');
    const totalFiles = testFiles.length;

    // 检查是否有未完成的进度（断点续跑）
    let progress = { nextIndex: 0, avgTimePerFileMs: null, batchResults: [], phase: 'running' };
    if (fs.existsSync(progressFile)) {
        try {
            const saved = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
            if (saved.phase === 'running' && saved.nextIndex < totalFiles) {
                progress = saved;
                console.log(`[BATCH] 恢复进度: 已完成 ${progress.nextIndex}/${totalFiles}，继续执行`);
            }
        } catch (_) { /* 损坏则从头开始 */ }
    }

    // 执行单个批次，返回 { elapsed, exitCode, resultFile }
    function runBatch(files, batchIndex) {
        const batchResultFile = path.join(cacheDir, `e2e-batch-${batchIndex}.json`);
        const batchLogFile = path.join(cacheDir, `e2e-batch-${batchIndex}.log`);
        const env = Object.assign({}, testEnv, { PLAYWRIGHT_JSON_OUTPUT_NAME: batchResultFile });
        const cmdArgs = [...files, '--config', pwConfig];
        if (devMode) cmdArgs.push('--retries', '0');
        const logFd = fs.openSync(batchLogFile, 'w');
        const startTime = Date.now();
        let exitCode = 0;
        try {
            (0, child_process_1.execFileSync)('npx', ['playwright', 'test', ...cmdArgs], {
                stdio: ['ignore', logFd, logFd],
                timeout: BATCH_TIME_BUDGET_MS, env: env, cwd: e2eCwd,
            });
        } catch (err) {
            exitCode = (err.status !== undefined && err.status !== null) ? err.status : (err.killed ? 124 : 1);
            if (err.killed) console.error(`[BATCH] 批次 ${batchIndex} 超时被终止`);
        } finally { fs.closeSync(logFd); }
        const elapsed = Date.now() - startTime;

        // 超时时尝试保留已有结果
        if (!fs.existsSync(batchResultFile)) {
            if (exitCode === 124 && files.length > 1) {
                // 批次超时：可能是文件数太多，回退到逐文件执行
                console.log(`[BATCH] 批次 ${batchIndex} 超时，回退到逐文件执行`);
                return runFilesIndividually(files, batchIndex, env, pwConfig, e2eCwd, cacheDir, BATCH_TIME_BUDGET_MS);
            }
            fs.writeFileSync(batchResultFile, JSON.stringify({
                error: exitCode === 124 ? '批次执行超时被终止' : 'Playwright 进程异常退出',
                killed: exitCode === 124, signal: null, suites: [],
            }));
        }
        return { elapsed, exitCode, resultFile: batchResultFile };
    }

    // 逐文件执行（批次超时时的降级策略）
    function runFilesIndividually(files, batchIndex, env, pwConfig, e2eCwd, cacheDir, timeBudget) {
        const results = [];
        let totalElapsed = 0;
        for (let i = 0; i < files.length; i++) {
            if (totalElapsed > timeBudget) {
                console.log(`[BATCH] 逐文件执行达到时间预算，剩余 ${files.length - i} 个文件`);
                break;
            }
            const singleFile = path.join(cacheDir, `e2e-batch-${batchIndex}-single-${i}.json`);
            const singleEnv = Object.assign({}, env, { PLAYWRIGHT_JSON_OUTPUT_NAME: singleFile });
            const singleArgs = [files[i], '--config', pwConfig];
            if (devMode) singleArgs.push('--retries', '0');
            const logFd = fs.openSync(path.join(cacheDir, `e2e-batch-${batchIndex}-single-${i}.log`), 'w');
            const start = Date.now();
            let code = 0;
            try {
                (0, child_process_1.execFileSync)('npx', ['playwright', 'test', ...singleArgs], {
                    stdio: ['ignore', logFd, logFd],
                    timeout: timeBudget - totalElapsed, env: singleEnv, cwd: e2eCwd,
                });
            } catch (err) {
                code = (err.status !== undefined && err.status !== null) ? err.status : 1;
            } finally { fs.closeSync(logFd); }
            totalElapsed += Date.now() - start;
            if (fs.existsSync(singleFile)) results.push(singleFile);
        }
        // 合并逐文件结果为一个批次结果
        const mergedFile = path.join(cacheDir, `e2e-batch-${batchIndex}.json`);
        mergeJsonReports(results, mergedFile);
        return { elapsed: totalElapsed, exitCode: results.length < files.length ? 124 : 0, resultFile: mergedFile };
    }

    // 主循环：从小批次开始，动态调整
    const loopStartTime = Date.now();
    let batchIndex = progress.batchResults.length;
    let totalExitCode = 0;
    while (progress.nextIndex < totalFiles) {
        // BUG 1 修复：检查总执行时间是否接近 Bash 工具限制
        const totalElapsed = Date.now() - loopStartTime;
        if (totalElapsed > TOTAL_TIME_BUDGET_MS) {
            console.log(`[BATCH] 总执行时间 ${Math.round(totalElapsed / 1000)}s 接近 Bash 工具限制，保存进度后退出`);
            console.log(`[BATCH] 进度: ${progress.nextIndex}/${totalFiles}，重新调用 run-tests.js 将从断点继续`);
            progress.phase = 'running';
            fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
            // 增量合并已完成的批次结果（确保被 kill 前有可用的部分结果）
            if (progress.batchResults.length > 0) {
                mergeJsonReports(progress.batchResults, e2eRawFile);
                console.log(`[BATCH] 已保存 ${progress.batchResults.length} 批次的部分合并结果`);
            }
            return 2; // exit code 2 = 有未完成的批次，需要重新调用
        }

        // 计算本批次大小
        let batchSize;
        if (progress.avgTimePerFileMs === null) {
            batchSize = Math.min(SEED_BATCH_SIZE, totalFiles - progress.nextIndex);
        } else {
            batchSize = Math.max(1, Math.floor((BATCH_TIME_BUDGET_MS * 0.8) / progress.avgTimePerFileMs));
            batchSize = Math.min(batchSize, totalFiles - progress.nextIndex);
        }

        const batchFiles = testFiles.slice(progress.nextIndex, progress.nextIndex + batchSize);
        console.log(`[BATCH] 批次 ${batchIndex + 1}: ${batchFiles.length} 文件 (累计 ${progress.nextIndex + batchFiles.length}/${totalFiles})`);

        const result = runBatch(batchFiles, batchIndex);
        totalExitCode = totalExitCode || result.exitCode;

        // 更新滚动平均耗时
        if (batchFiles.length > 0 && result.elapsed > 0) {
            const batchAvg = result.elapsed / batchFiles.length;
            if (progress.avgTimePerFileMs === null) {
                progress.avgTimePerFileMs = batchAvg;
            } else {
                // 指数移动平均，新数据权重 0.5
                progress.avgTimePerFileMs = progress.avgTimePerFileMs * 0.5 + batchAvg * 0.5;
            }
        }

        progress.nextIndex += batchFiles.length;
        progress.batchResults.push(result.resultFile);
        batchIndex++;

        // BUG 3 修复：每批完成后立即增量合并 → e2e-raw.json
        // 确保被 kill 前 parse-results.js 能读到已完成的批次结果
        const isComplete = progress.nextIndex >= totalFiles;
        progress.phase = isComplete ? 'complete' : 'running';
        mergeJsonReports(progress.batchResults, e2eRawFile);
        fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));

        console.log(`[BATCH] 完成: ${result.elapsed}ms, avg ${progress.avgTimePerFileMs?.toFixed(0)}ms/文件, 已合并 ${progress.batchResults.length} 批次${isComplete ? ' → 全部完成' : ''}`);
    }

    console.log(`[BATCH] 最终合并 ${progress.batchResults.length} 批次结果 → ${e2eRawFile}`);
    // 清理进度文件（全部完成）
    if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
    return totalExitCode;
}

// 合并多个 Playwright JSON 报告为一个
// Playwright JSON reporter 没有顶层 stats 字段，parse-results.js 自己从 suites 递归计算
// 这里只合并 suites，不输出误导性的 stats
function mergeJsonReports(reportFiles, outputFile) {
    const merged = { suites: [] };
    for (const file of reportFiles) {
        if (!fs.existsSync(file)) continue;
        try {
            const report = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (report.suites) merged.suites.push(...report.suites);
        } catch (_) { /* 跳过损坏的报告 */ }
    }
    fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2));
}

// ─── testingRepo 模式支持 ─────────────────────────────────────
function resolveTestPaths(config, scriptDir) {
    // 调用 resolve-test-paths.js 判断执行模式
    const resolveScript = path.join(scriptDir, '..', '..', '..', 'scripts', 'resolve-test-paths.js');
    if (!fs.existsSync(resolveScript)) {
        return { mode: 'legacy' };
    }
    try {
        const output = (0, child_process_1.execSync)(`node "${resolveScript}" --config "${config}"`, {
            encoding: 'utf-8',
            timeout: 10000
        });
        return JSON.parse(output);
    }
    catch (e) {
        return { mode: 'legacy' };
    }
}

// 查找 testingRepo 中的配置文件
function findTestingRepoConfig(projectRoot, configType) {
    const candidates = configType === 'playwright' ? [
        // 方案 C：项目根优先
        path.join(projectRoot, 'playwright.config.ts'),
        // 旧结构：features/e2e/playwright.config.ts
        path.join(projectRoot, 'features', 'e2e', 'playwright.config.ts'),
        // 分组结构：features/*/e2e/playwright.config.ts
        ...path_utils_1.findGroupedConfigs(projectRoot, 'e2e', 'playwright.config.ts'),
        // 兼容结构：scripts/e2e/playwright.config.ts（非分组输出）
        path.join(projectRoot, 'scripts', 'e2e', 'playwright.config.ts'),
    ] : [
        // 方案 C：项目根优先
        path.join(projectRoot, 'vitest.config.ts'),
        // 旧结构：scripts/api/vitest.config.ts
        path.join(projectRoot, 'scripts', 'api', 'vitest.config.ts'),
    ];
    
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

// 解析认证 token
function resolveAuthToken(configData, testingDir) {
    // 1. 从 test-config.json 的 auth 配置获取
    if (configData.auth?.token) {
        return configData.auth.token;
    }
    
    // 2. 从 storage-state.json 获取（优先 testing/auth/，fallback testingRepo .cache/.auth/）
    let storagePath = path.join(testingDir, 'auth', 'storage-state.json');
    if (!fs.existsSync(storagePath)) {
        storagePath = path.join(testingDir, '.cache', '.auth', 'storage-state.json');
    }
    if (fs.existsSync(storagePath)) {
        try {
            const storage = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
            // 从 cookie 中查找 token
            for (const cookie of (storage.cookies || [])) {
                if (cookie.name === 'token' || cookie.name === 'AUTH_TOKEN' || cookie.name === 'access_token') {
                    return cookie.value;
                }
            }
            // 从 localStorage 中查找 token
            for (const origin of (storage.origins || [])) {
                for (const item of (origin.localStorage || [])) {
                    if (item.name === 'token' || item.name === 'AUTH_TOKEN' || item.name === 'access_token') {
                        return item.value;
                    }
                }
            }
        } catch (e) { /* ignore */ }
    }
    
    // 3. 返回空字符串，让测试脚本自行处理
    return '';
}

async function main() {
    const { config, scopeOverride, includeSingleApi, mode, phase, devMode, filePattern } = parseArgs();
    if (!fs.existsSync(config)) {
        console.error(`[FAIL] 配置文件不存在: ${config}`);
        process.exit(2);
    }
    if (devMode) {
        console.log('[INFO] 开发模式：失败测试不重试（retries=0），加快调试周期');
    }

    // 支持 .env 文件作为配置（Testing-Repo standalone 模式）
    let configData;
    if (config.endsWith('.env')) {
        try {
            require('dotenv').config({ path: config });
        } catch {
            // dotenv 不可用时手动解析
            const envContent = fs.readFileSync(config, 'utf-8');
            for (const line of envContent.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    process.env[key] = val;
                }
            }
        }
        configData = {
            scope: process.env.TEST_SCOPE || 'fullstack',
            frontend: { baseUrl: process.env.FRONTEND_URL || '' },
            backend: { baseUrl: process.env.API_BASE_URL || '', apiPrefix: process.env.API_PREFIX || '' },
            auth: { token: process.env.AUTH_TOKEN || '' },
            execution: { workers: parseInt(process.env.WORKERS || '2'), retries: parseInt(process.env.RETRIES || '1') },
        };
    } else {
        try {
            configData = JSON.parse(fs.readFileSync(config, 'utf-8'));
        } catch (e) {
            console.error(`[FAIL] 配置文件 JSON 解析失败: ${config}\n  ${e.message}`);
            process.exit(2);
        }
    }

    const scope = scopeOverride || configData.scope || 'fullstack';
    if (scopeOverride) {
        console.log(`[CONFIG] scope 已由命令行覆盖: ${scopeOverride}（config 文件值: ${configData.scope || 'fullstack'}）`);
    }
    const testingDir = path.dirname(config);
    const cacheDir = path.join(testingDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const scriptDir = __dirname;
    
    // 解析测试路径模式
    const pathInfo = resolveTestPaths(config, scriptDir);
    const isTestingRepoMode = pathInfo.mode === 'testing-repo';
    const projectRoot = isTestingRepoMode ? pathInfo.projectRoot : null;

    if (isTestingRepoMode) {
        process.env.TESTING_REPO_MODE = '1';
    }

    // testingRepo 强制检查：禁止降级到 legacy 模式执行
    if (!isTestingRepoMode) {
        console.error(`[FAIL] testingRepo 未配置或目录结构不存在 (mode: ${pathInfo.mode})`);
        console.error('   请在 test-config.json 中配置 testingRepo，或运行 detect-testing-repo.js 自动探测');
        console.error('   禁止降级到本地 testing/ 目录执行测试');
        // 清理旧的 test-summary.json
        const staleSummary = path.join(cacheDir, 'test-summary.json');
        if (fs.existsSync(staleSummary)) fs.unlinkSync(staleSummary);
        process.exit(2);
    }

    console.log(`[FIX] 配置: ${config}`);
    console.log(`[DIR] 测试目录: ${testingDir}`);
    console.log(`[TARGET] 范围: ${scope}`);
    console.log(`[MODE] 执行模式: ${mode === 'parallel' ? '并行' : '串行'}`);
    if (isTestingRepoMode) {
        console.log(`[REPO] testing-repo 模式: ${projectRoot}`);
    }
    console.log('');
    
    // Task 2.1: 构建基础 testEnv
    // MSYS_NO_PATHCONV=1 防止 Git Bash 将 API_PREFIX（如 /saas/erp/biz）
    // 自动转换为 Windows 路径（如 C:/Program Files/Git/saas/erp/biz）
    
    // 解析认证 token
    const authToken = resolveAuthToken(configData, testingDir);
    
    const testEnv = Object.assign({}, process.env, {
        MSYS_NO_PATHCONV: '1',
        MSYS2_ARG_CONV_EXCL: '*',
        WORK_DIR: config.endsWith('.env')
            ? testingDir                          // standalone: repoRoot 就是 root
            : path.resolve(testingDir, '..'),     // 集成: process-docs 根
        FRONTEND_URL: configData.frontend?.baseUrl || '',
        API_BASE_URL: configData.backend?.baseUrl || '',
        API_PREFIX: configData.backend?.apiPrefix || '',
        AUTH_TOKEN: authToken,
    });
    
    // Windows 中文环境下强制 UTF-8 控制台编码，防止中文测试名称乱码
    if (process.platform === 'win32') {
        try { (0, child_process_1.execSync)('chcp 65001', { stdio: 'ignore' }); } catch {}
        // 仅在检测到端口冲突时清理残留 Chrome 进程
        try {
            const netstat = (0, child_process_1.execSync)('netstat -ano | findstr ":9222"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            if (netstat.trim()) {
                (0, child_process_1.execSync)('taskkill /F /IM chrome.exe 2>nul', { stdio: 'ignore' });
                console.log('[INFO] 检测到端口 9222 占用，已清理残留 Chrome 进程');
            }
        } catch {}
    }
    
    // ─── 步骤 1：预检 ─────────────────────────────────────────
    console.log('━━━ 步骤 1/4: 预检 ━━━');
    const preCheckScript = path.join(scriptDir, 'pre-check.js');
    if (fs.existsSync(preCheckScript)) {
        const preCheckExit = runCommand(`node "${preCheckScript}" --config "${config}"${scopeOverride ? ` --scope ${scopeOverride}` : ''}`, '预检', testEnv);
        if (preCheckExit !== 0) {
            console.error(`[FAIL] 预检失败，查看 ${cacheDir}/pre-check-result.json`);
            // 清理旧的 test-summary.json，防止 LLM 读取残留结果做错误决策
            const staleSummary = path.join(cacheDir, 'test-summary.json');
            if (fs.existsSync(staleSummary)) {
                fs.unlinkSync(staleSummary);
                console.log('[FIX] 已清理旧的 test-summary.json');
            }
            process.exit(2);
        }
        // Task 2.1: pre-check 执行后，读取结果合并 envOverrides
        const preCheckPath = path.join(cacheDir, 'pre-check-result.json');
        if (fs.existsSync(preCheckPath)) {
            try {
                const pc = JSON.parse(fs.readFileSync(preCheckPath, 'utf-8'));
                const overrides = pc.checks?.browser?.envOverrides || pc.envOverrides || {};
                Object.assign(testEnv, overrides);
            } catch (e) { /* ignore parse error */ }
        }
    }
    else {
        console.log('[WARN] pre-check.js 不存在，跳过预检');
    }
    console.log('');
    
    // ─── 步骤 2+3：测试执行（串行/并行）─────────────────────────
    const timeoutConfig = readTimeoutConfig(configData);

    // --phase parse: 跳过测试执行，直接解析已有结果
    if (phase === 'parse') {
        console.log('━━━ 跳过测试执行，直接解析已有结果 ━━━');
        const apiRawFile = path.join(cacheDir, 'api-raw.json');
        const e2eRawFile = path.join(cacheDir, 'e2e-raw.json');
        const summaryFile = path.join(cacheDir, 'test-summary.json');
        const parseScript = path.join(scriptDir, 'parse-results.js');
        if (fs.existsSync(parseScript)) {
            runCommand(`node "${parseScript}" --api "${apiRawFile}" --e2e "${e2eRawFile}" --output "${summaryFile}"`, '结果解析');
        } else {
            const emptySummary = {
                timestamp: new Date().toISOString(),
                api: { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] },
                e2e: { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] },
            };
            fs.writeFileSync(summaryFile, JSON.stringify(emptySummary, null, 2));
        }
        console.log(`结果文件: ${summaryFile}`);
        process.exit(fs.existsSync(summaryFile) ? 0 : 1);
    }

    let apiExit = 0;
    let e2eExit = 0;
    let skipApi = false;
    let skipE2e = false;
    const apiRawFile = path.join(cacheDir, 'api-raw.json');
    const e2eRawFile = path.join(cacheDir, 'e2e-raw.json');
    const hasApi = scope === 'backend' || scope === 'fullstack';
    const hasE2e = scope === 'frontend' || scope === 'fullstack' || scope === 'e2e';

    // 构建 API 测试命令和检测
    let apiCmd = null;
    let apiCwd = null;
    let totalApiCount = 0;
    if (hasApi) {
        console.log('━━━ 步骤 2/4: API 测试 ━━━');
        let apiTestFiles = [];
        let vitestConfig = path.join(testingDir, 'scripts/api/vitest.config.ts');
        if (isTestingRepoMode && projectRoot) {
            const apiTests = collectTestingRepoTests(projectRoot, 'api');
            if (apiTests.length > 0) {
                console.log(`[INFO] testingRepo 模式：找到 ${apiTests.length} 个 API 测试文件`);
                apiTestFiles = filterByFilePattern(apiTests, filePattern);
                const repoVitestConfig = findTestingRepoConfig(projectRoot, 'vitest');
                if (repoVitestConfig) {
                    vitestConfig = repoVitestConfig;
                    console.log(`[INFO] 使用 vitest 配置: ${vitestConfig}`);
                }
            }
        }
        const legacyApiDir = path.join(testingDir, 'scripts/api/tests');
        const legacyApiCount = fs.existsSync(legacyApiDir) ? countFiles(legacyApiDir, /\.api\.test\.ts$/) : 0;
        if (apiTestFiles.length === 0 && legacyApiCount === 0) {
            console.log('[WARN] 无 API 测试文件，跳过 API 测试');
            fs.writeFileSync(apiRawFile, JSON.stringify({ status: 'skipped', reason: 'no_test_files', total: 0 }));
            skipApi = true;
        } else if (!fs.existsSync(vitestConfig)) {
            console.log(`[WARN] vitest.config.ts 不存在: ${vitestConfig}`);
            fs.writeFileSync(apiRawFile, '{"testResults":[]}');
        } else {
            totalApiCount = apiTestFiles.length > 0 ? apiTestFiles.length : legacyApiCount;
            const flowFilter = includeSingleApi ? '' : ' "flow"';
            console.log(`[INFO] 找到 ${totalApiCount} 个 API 测试文件${includeSingleApi ? '（含单 API）' : '（仅流程测试）'}`);
            const absVitestConfig = path.resolve(vitestConfig);
            const absApiRawFile = path.resolve(apiRawFile);
            // 直接使用测试文件路径而非目录
            const apiCmdArgs = apiTestFiles.length > 0
                ? ['vitest', 'run', ...apiTestFiles, '--config', absVitestConfig, '--reporter', 'json', '--outputFile', absApiRawFile]
                : ['vitest', 'run', '--config', absVitestConfig, '--reporter', 'json', '--outputFile', absApiRawFile, ...(flowFilter ? [flowFilter.trim()] : [])];
            apiCmd = apiCmdArgs;
            apiCwd = isTestingRepoMode && projectRoot ? projectRoot : path.resolve(testingDir);
        }
    } else {
        console.log('━━━ 步骤 2/4: API 测试（跳过，scope=frontend）━━━');
        fs.writeFileSync(apiRawFile, '{"testResults":[]}');
    }
    console.log('');

    // 构建 E2E 测试命令和检测
    let e2eCmd = null;
    let e2eCwd = null;
    let e2eEnv = testEnv;
    let totalE2eCount = 0;
    if (hasE2e) {
        console.log('━━━ 步骤 3/4: E2E 测试 ━━━');
        let e2eTestFiles = [];
        let pwConfig = path.join(testingDir, 'scripts/e2e/playwright.config.ts');
        if (isTestingRepoMode && projectRoot) {
            const e2eTests = collectTestingRepoTests(projectRoot, 'e2e');
            if (e2eTests.length > 0) {
                console.log(`[INFO] testingRepo 模式：找到 ${e2eTests.length} 个 E2E 测试文件`);
                e2eTestFiles = filterByFilePattern(e2eTests, filePattern);
                const repoPwConfig = findTestingRepoConfig(projectRoot, 'playwright');
                if (repoPwConfig) {
                    pwConfig = repoPwConfig;
                    console.log(`[INFO] 使用 playwright 配置: ${pwConfig}`);
                }
            }
        }
        const legacyE2eDir = path.join(testingDir, 'scripts/e2e/tests');
        const legacyE2eCount = fs.existsSync(legacyE2eDir) ? countFiles(legacyE2eDir, /\.spec\.ts$/) : 0;
        if (e2eTestFiles.length === 0 && legacyE2eCount === 0) {
            console.log('[WARN] 无 E2E 测试文件，跳过 E2E 测试');
            fs.writeFileSync(e2eRawFile, JSON.stringify({ status: 'skipped', reason: 'no_test_files', total: 0 }));
            skipE2e = true;
        } else if (!fs.existsSync(pwConfig)) {
            console.log(`[WARN] playwright.config.ts 不存在: ${pwConfig}`);
            fs.writeFileSync(e2eRawFile, '{"suites":[]}');
        } else {
            totalE2eCount = e2eTestFiles.length > 0 ? e2eTestFiles.length : legacyE2eCount;
            console.log(`[INFO] 找到 ${totalE2eCount} 个 E2E 测试文件`);
            const absPwConfig = path.resolve(pwConfig);
            const absE2eRawFile = path.resolve(e2eRawFile);
            e2eEnv = Object.assign({}, testEnv, { PLAYWRIGHT_JSON_OUTPUT_NAME: absE2eRawFile });
            // testingRepo 模式下 playwright.config.ts 已配置 testDir，直接使用即可
            // 避免在 Windows 中文文件名路径上出现 "No tests found" 问题
            const isRepoWithConfig = isTestingRepoMode && e2eTestFiles.length > 0;
            const e2eTestPaths = (!isRepoWithConfig && e2eTestFiles.length > 0) ? e2eTestFiles : [];
            const e2eArgs = ['playwright', 'test', ...e2eTestPaths, '--config', absPwConfig];
            if (devMode) e2eArgs.push('--retries', '0');
            e2eCmd = e2eArgs;
            // cwd 设置为配置文件所在目录，确保 Playwright 能正确解析相对路径
            e2eCwd = (isTestingRepoMode && projectRoot && e2eTestFiles.length > 0) ? path.dirname(absPwConfig) : path.resolve(testingDir);
        }
    } else {
        console.log('━━━ 步骤 3/4: E2E 测试（跳过，scope=backend）━━━');
        fs.writeFileSync(e2eRawFile, '{"suites":[]}');
    }
    console.log('');

    // ─── 执行测试（串行 or 并行）────────────────────────────────
    if (mode === 'parallel' && apiCmd && e2eCmd) {
        console.log('━━━ 并行执行 API + E2E ━━━');
        const [apiResult, e2eResult] = await Promise.all([
            runCommandAsync(apiCmd, 'API', testEnv, apiCwd, timeoutConfig.apiParallel),
            runCommandAsync(e2eCmd, 'E2E', e2eEnv, e2eCwd, timeoutConfig.e2eParallel),
        ]);
        apiExit = apiResult.exitCode;
        e2eExit = e2eResult.exitCode;
        // 写入日志
        const apiLogFile = path.join(cacheDir, 'api-console.log');
        const e2eLogFile = path.join(cacheDir, 'e2e-console.log');
        fs.writeFileSync(apiLogFile, apiResult.stdout + '\n' + apiResult.stderr);
        fs.writeFileSync(e2eLogFile, e2eResult.stdout + '\n' + e2eResult.stderr);
        // 检查 API 输出
        const absApiRawFile = path.resolve(apiRawFile);
        if (!fs.existsSync(absApiRawFile)) {
            fs.writeFileSync(absApiRawFile, JSON.stringify({
                error: apiResult.killed ? 'API 测试执行超时被终止' : 'vitest 进程异常退出，未生成 JSON 报告',
                killed: apiResult.killed || false, signal: null, testResults: [],
            }));
        }
        // 检查 E2E 输出
        const absE2eRawFile = path.resolve(e2eRawFile);
        if (!fs.existsSync(absE2eRawFile)) {
            fs.writeFileSync(absE2eRawFile, JSON.stringify({
                error: e2eResult.killed ? 'E2E 测试执行超时被终止' : 'Playwright 进程异常退出，未生成 JSON 报告',
                killed: e2eResult.killed || false, signal: null, suites: [],
            }));
        }
        console.log(`并行执行完成 (API=${apiExit}, E2E=${e2eExit})`);
    } else {
        // 串行执行（原有逻辑）
        if (apiCmd) {
            const apiTimeout = calculateDynamicTimeout(timeoutConfig.serialApi, totalApiCount, timeoutConfig.perTestMs);
            console.log(`[INFO] API 串行超时: ${apiTimeout}ms（${totalApiCount} 个文件）`);
            const apiLogFile = path.join(cacheDir, 'api-console.log');
            const apiLogFd = fs.openSync(apiLogFile, 'w');
            const absApiRawFile = path.resolve(apiRawFile);
            try {
                if (Array.isArray(apiCmd)) {
                    (0, child_process_1.execFileSync)('npx', apiCmd, {
                        timeout: apiTimeout, stdio: ['pipe', apiLogFd, apiLogFd],
                        env: testEnv, cwd: apiCwd,
                    });
                } else {
                    (0, child_process_1.execSync)(apiCmd, {
                        timeout: apiTimeout, stdio: ['pipe', apiLogFd, apiLogFd],
                        env: testEnv, cwd: apiCwd,
                    });
                }
                apiExit = 0;
            } catch (err) {
                apiExit = (err.status !== undefined && err.status !== null) ? err.status : (err.killed ? 124 : 1);
                if (err.killed) console.error('[WARN] API 测试执行超时被终止');
            } finally { fs.closeSync(apiLogFd); }
            if (!fs.existsSync(absApiRawFile)) {
                fs.writeFileSync(absApiRawFile, JSON.stringify({
                    error: 'vitest 进程异常退出，未生成 JSON 报告',
                    killed: apiExit === 124, signal: null, testResults: [],
                }));
                console.error(`[WARN] API 测试无有效输出`);
            }
            console.log(`API 测试退出码: ${apiExit}（详细日志: ${apiLogFile}）`);
        }
        if (e2eCmd) {
            // 自适应分批：文件数 > 30 时启用，避免单次执行超过 Bash 工具 10 分钟限制
            const ADAPTIVE_THRESHOLD = 30;
            if (totalE2eCount > ADAPTIVE_THRESHOLD) {
                console.log(`[INFO] E2E 文件数 ${totalE2eCount} > ${ADAPTIVE_THRESHOLD}，启用自适应分批执行`);
                // 收集所有 E2E 测试文件
                let allE2eFiles = [];
                const legacyE2eDir = path.join(testingDir, 'scripts/e2e/tests');
                if (fs.existsSync(legacyE2eDir)) {
                    allE2eFiles = collectTestFiles(legacyE2eDir, /\.spec\.ts$/);
                }
                if (isTestingRepoMode && projectRoot) {
                    allE2eFiles = allE2eFiles.concat(collectTestingRepoTests(projectRoot, 'e2e'));
                }
                if (allE2eFiles.length > 0) {
                    // 使用统一的配置文件查找函数
                    const absPwConfig = isTestingRepoMode && projectRoot
                        ? (findTestingRepoConfig(projectRoot, 'playwright') || path.join(testingDir, 'scripts/e2e/playwright.config.ts'))
                        : path.join(testingDir, 'scripts/e2e/playwright.config.ts');
                    // cwd 设置为配置文件所在目录
                    const batchE2eCwd = path.dirname(absPwConfig);
                    e2eExit = runE2EAdaptiveBatch({
                        testFiles: allE2eFiles,
                        pwConfig: absPwConfig,
                        testEnv: e2eEnv,
                        cacheDir: cacheDir,
                        e2eRawFile: path.resolve(e2eRawFile),
                        e2eCwd: batchE2eCwd,
                        scope: scope,
                        devMode: devMode,
                    });
                } else {
                    console.log('[WARN] 未收集到 E2E 测试文件，跳过分批执行');
                }
            } else {
                // 文件数 <= 30，使用原有单次执行逻辑
                const e2eTimeout = calculateDynamicTimeout(timeoutConfig.serialE2e, totalE2eCount, timeoutConfig.perTestMs);
                console.log(`[INFO] E2E 串行超时: ${e2eTimeout}ms（${totalE2eCount} 个文件）`);
                const e2eLogFile = path.join(cacheDir, 'e2e-console.log');
                const e2eLogFd = fs.openSync(e2eLogFile, 'w');
                const absE2eRawFile = path.resolve(e2eRawFile);
                try {
                    if (Array.isArray(e2eCmd)) {
                        (0, child_process_1.execFileSync)('npx', e2eCmd, {
                            stdio: ['ignore', e2eLogFd, e2eLogFd],
                            timeout: e2eTimeout, env: e2eEnv, cwd: e2eCwd,
                        });
                    } else {
                        (0, child_process_1.execSync)(e2eCmd, {
                            stdio: ['ignore', e2eLogFd, e2eLogFd],
                            timeout: e2eTimeout, env: e2eEnv, cwd: e2eCwd,
                        });
                    }
                    e2eExit = 0;
                } catch (err) {
                    e2eExit = (err.status !== undefined && err.status !== null) ? err.status : (err.killed ? 124 : 1);
                    if (err.killed) console.error('[WARN] E2E 测试执行超时被终止');
                } finally { fs.closeSync(e2eLogFd); }
                if (!fs.existsSync(absE2eRawFile)) {
                    fs.writeFileSync(absE2eRawFile, JSON.stringify({
                        error: 'Playwright 进程异常退出，未生成 JSON 报告',
                        killed: true, signal: null, suites: [],
                    }));
                }
                console.log(`E2E 测试退出码: ${e2eExit}（详细日志: ${e2eLogFile}）`);
            }
        }
    }
    console.log('');
    
    // ─── 步骤 4：解析结果 ─────────────────────────────────────
    // --phase run: 只执行测试不解析，输出原始 JSON 后退出
    if (phase === 'run') {
        console.log('━━━ --phase run: 测试执行完成，跳过解析 ━━━');
        console.log(`API 原始结果: ${apiRawFile}`);
        console.log(`E2E 原始结果: ${e2eRawFile}`);
        console.log('使用 --phase parse 解析结果，或直接读取原始 JSON 文件');
        process.exit(apiExit === 0 && e2eExit === 0 ? 0 : 1);
    }
    console.log('━━━ 步骤 4/4: 解析结果 ━━━');
    const parseScript = path.join(scriptDir, 'parse-results.js');
    const summaryFile = path.join(cacheDir, 'test-summary.json');
    if (fs.existsSync(parseScript)) {
        runCommand(`node "${parseScript}" --api "${apiRawFile}" --e2e "${e2eRawFile}" --output "${summaryFile}"`, '结果解析');
    }
    else {
        console.log('[WARN] parse-results.js 不存在，生成空摘要');
        const emptySummary = {
            timestamp: new Date().toISOString(),
            api: { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] },
            e2e: { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] },
        };
        fs.writeFileSync(summaryFile, JSON.stringify(emptySummary, null, 2));
    }
    console.log('');
    
    // ─── 汇总 ─────────────────────────────────────────────────
    // 分批续跑：E2E 返回 exit code 2 表示有未完成批次，需要重新调用
    if (e2eExit === 2 && fs.existsSync(path.join(cacheDir, 'batch-progress.json'))) {
        console.log('━━━ 分批执行未完成 ━━━');
        console.log('[CONTINUE] E2E 测试分批执行中，部分批次已完成。');
        console.log('[CONTINUE] 请重新调用 run-tests.js 以从断点继续执行剩余批次。');
        console.log(`[CONTINUE] 当前进度见: ${path.join(cacheDir, 'batch-progress.json')}`);
        process.exit(2);
    }
    console.log('━━━ 执行完成 ━━━');
    console.log(`结果文件: ${summaryFile}`);
    if (skipApi && skipE2e) {
        console.log('[WARN] 无任何测试文件，无法执行测试');
        process.exit(2);
    }
    else if (apiExit === 0 && e2eExit === 0) {
        const skipped = [skipApi, skipE2e].filter(Boolean).length;
        if (skipped > 0) {
            console.log(`[WARN] ${skipped} 类测试被跳过（无测试文件），其余全部通过`);
        } else {
            console.log('[OK] 全部通过');
        }
        process.exit(0);
    }
    else {
        console.log(`[FAIL] 有失败 (API=${apiExit}, E2E=${e2eExit})`);
        process.exit(1);
    }
}
main();
