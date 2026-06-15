#!/usr/bin/env node
"use strict";
/**
 * pre-check-enhanced.js
 * run-test 执行前的增强检查
 * 验证配置与环境一致性，提前发现问题
 *
 * 用法：
 *   node pre-check-enhanced.js --testing-dir testing --config testing/test-config.json
 *
 * 输出 JSON：
 *   { status, checks: [...] }
 */
const fs = require('fs');
const path = require('path');
const { safeReadJson } = require('../../../scripts/lib/safe-json');

function parseArgs() {
    const argv = process.argv.slice(2);
    let testingDir = '';
    let configPath = '';
    
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--testing-dir' && argv[i + 1]) testingDir = argv[++i];
        if (argv[i] === '--config' && argv[i + 1]) configPath = argv[++i];
    }
    return { testingDir, configPath };
}

/**
 * 检查 test-config.json 存在性
 */
function checkTestConfig(configPath) {
    if (!configPath || !fs.existsSync(configPath)) {
        return { name: 'test-config', status: 'fail', message: 'test-config.json 不存在' };
    }
    
    try {
        const config = safeReadJson(configPath, { fallback: null });
        if (!config) {
            return { name: 'test-config', status: 'fail', message: 'test-config.json 格式错误' };
        }
        if (!config.scope) {
            return { name: 'test-config', status: 'warn', message: 'test-config.json 缺少 scope 字段' };
        }
        return { name: 'test-config', status: 'pass', message: '' };
    } catch (e) {
        return { name: 'test-config', status: 'fail', message: `test-config.json 格式错误: ${e.message}` };
    }
}

/**
 * 检查 gate 状态
 */
function checkGateStatus(configPath) {
    if (!configPath || !fs.existsSync(configPath)) {
        return { name: 'gate', status: 'skip', message: 'test-config.json 不存在' };
    }
    
    try {
        const config = safeReadJson(configPath, { fallback: null });
        if (!config) return { name: 'gate', status: 'warn', message: '无法读取 gate 状态' };
        const gate = config.progress?.gate;
        
        if (gate === 'done') {
            return { name: 'gate', status: 'pass', message: 'gate 检查已通过' };
        } else if (gate === 'pending') {
            return { name: 'gate', status: 'warn', message: 'gate 检查未完成，建议先执行 run-test' };
        } else {
            return { name: 'gate', status: 'warn', message: `gate 状态未知: ${gate}` };
        }
    } catch (e) {
        return { name: 'gate', status: 'warn', message: `无法读取 gate 状态: ${e.message}` };
    }
}

/**
 * 检查 API 路径配置一致性
 */
function checkApiPrefix(testingDir, configPath) {
    const domProbePath = path.join(testingDir, '.cache', 'dom-probe.md');
    
    if (!fs.existsSync(domProbePath)) {
        return { name: 'api-prefix', status: 'skip', message: 'dom-probe.md 不存在，跳过 API 路径检查' };
    }
    
    if (!configPath || !fs.existsSync(configPath)) {
        return { name: 'api-prefix', status: 'skip', message: 'test-config.json 不存在' };
    }
    
    try {
        const config = safeReadJson(configPath, { fallback: null });
        if (!config) return { name: 'api-prefix', status: 'skip', message: '无法读取 test-config.json' };
        const configuredPrefix = config.backend?.apiPrefix || '';
        
        // 从 dom-probe.md 提取 API 路径
        const domProbeContent = fs.readFileSync(domProbePath, 'utf-8');
        const apiPaths = extractApiPaths(domProbeContent);
        
        if (apiPaths.length === 0) {
            return { name: 'api-prefix', status: 'pass', message: '无 API 路径记录' };
        }
        
        // 检查所有路径是否以配置的前缀开头
        const mismatchedPaths = apiPaths.filter(p => !p.startsWith(configuredPrefix));
        
        if (mismatchedPaths.length === 0) {
            return { name: 'api-prefix', status: 'pass', message: `API 路径配置一致 (${apiPaths.length} 条路径)` };
        }
        
        // 尝试推断正确的前缀
        const inferredPrefix = inferPrefix(apiPaths);
        return {
            name: 'api-prefix',
            status: 'warn',
            message: `配置的前缀 "${configuredPrefix}" 与 ${mismatchedPaths.length} 条路径不匹配，建议使用 "${inferredPrefix}"`
        };
    } catch (e) {
        return { name: 'api-prefix', status: 'warn', message: `检查失败: ${e.message}` };
    }
}

/**
 * 从 dom-probe.md 提取 API 路径
 */
function extractApiPaths(content) {
    const paths = [];
    const lines = content.split('\n');
    let inApiSection = false;
    
    for (const line of lines) {
        if (/#{2,4}\s*API\s*路径记录/i.test(line)) {
            inApiSection = true;
            continue;
        }
        if (/^#{2,4}\s/.test(line) && !/API\s*路径/i.test(line)) {
            inApiSection = false;
            continue;
        }
        
        if (!inApiSection) continue;
        
        const backtickMatches = line.match(/`([^`]+)`/g);
        if (backtickMatches) {
            for (const match of backtickMatches) {
                const content = match.slice(1, -1).trim();
                const pathMatch = content.match(/^(?:GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)$/i);
                if (pathMatch) {
                    paths.push(pathMatch[1]);
                } else if (/^\/[\w\-./]+$/.test(content)) {
                    paths.push(content);
                }
            }
        }
    }
    
    return [...new Set(paths)];
}

/**
 * 推断公共前缀
 */
function inferPrefix(paths) {
    if (paths.length === 0) return '';
    
    const segments = paths.map(p => p.split('/').filter(Boolean));
    const prefixCounts = {};
    
    for (const segs of segments) {
        for (let len = 1; len <= Math.min(3, segs.length); len++) {
            const prefix = '/' + segs.slice(0, len).join('/');
            prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
        }
    }
    
    const sorted = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '';
}

/**
 * 检查认证配置
 */
function checkAuthConfig(testingDir, configPath) {
    const storagePath = path.join(testingDir, 'auth', 'storage-state.json');
    const playwrightConfigPath = path.join(testingDir, 'scripts', 'e2e', 'playwright.config.ts');
    
    const issues = [];
    
    // 检查 test-config.json 的 auth 配置
    let config = {};
    if (configPath && fs.existsSync(configPath)) {
        config = safeReadJson(configPath, { fallback: {} });
    }
    
    // 检查 storage-state.json 是否存在
    const hasStorageState = fs.existsSync(storagePath);
    
    // 检查 playwright.config.ts 是否配置了 storageState
    let hasPlaywrightAuth = false;
    if (fs.existsSync(playwrightConfigPath)) {
        const pwConfig = fs.readFileSync(playwrightConfigPath, 'utf-8');
        hasPlaywrightAuth = pwConfig.includes('storageState');
    }
    
    // 判断认证状态
    if (config.auth?.type === 'none' || !config.auth) {
        // 无需认证或未配置
        if (!hasStorageState) {
            return { name: 'auth-config', status: 'pass', message: '无需认证' };
        }
        return { name: 'auth-config', status: 'pass', message: '认证配置正常' };
    }
    
    // 需要认证
    if (!hasStorageState) {
        return { name: 'auth-config', status: 'fail', message: '需要认证但 storage-state.json 不存在，请先执行登录' };
    }
    
    if (!hasPlaywrightAuth) {
        issues.push('playwright.config.ts 未配置 storageState');
    }
    
    // 检查 localStorage 登录标记（从配置读取检查项，向后兼容）
    try {
        const storage = safeReadJson(storagePath, { fallback: { origins: [] } });
        const origins = storage.origins || [];

        // 从 test-config.json 读取配置的 localStorage 检查项
        const configPath = path.join(path.dirname(storagePath), '..', 'test-config.json');
        let localStorageChecks = [];
        if (fs.existsSync(configPath)) {
            const cfg = safeReadJson(configPath, { fallback: {} });
            localStorageChecks = cfg.auth?.storageStatePatches?.localStorage || [];
        }

        // 检查配置的标志
        if (localStorageChecks.length > 0) {
            for (const check of localStorageChecks) {
                const hasFlag = origins.some(o => 
                    (o.localStorage || []).some(l => l.name === check.name && l.value === check.value)
                );
                if (!hasFlag) {
                    issues.push(`localStorage.${check.name} 标记缺失或值不正确`);
                }
            }
        }
    } catch (e) {
        issues.push(`storage-state.json 解析失败: ${e.message}`);
    }
    
    if (issues.length > 0) {
        return { name: 'auth-config', status: 'warn', message: `认证配置问题: ${issues.join(', ')}` };
    }
    
    return { name: 'auth-config', status: 'pass', message: '认证配置正常' };
}

/**
 * 检查测试文件存在性
 */
function checkTestFiles(testingDir, configPath) {
    const e2eDir = path.join(testingDir, 'scripts', 'e2e', 'tests');
    const apiDir = path.join(testingDir, 'scripts', 'api', 'tests');
    
    let e2eCount = 0;
    let apiCount = 0;
    
    if (fs.existsSync(e2eDir)) {
        const files = fs.readdirSync(e2eDir);
        e2eCount = files.filter(f => f.endsWith('.spec.ts')).length;
    }
    
    if (fs.existsSync(apiDir)) {
        const files = fs.readdirSync(apiDir);
        apiCount = files.filter(f => f.endsWith('.api.test.ts')).length;
    }
    
    if (e2eCount === 0 && apiCount === 0) {
        return { name: 'test-files', status: 'fail', message: '无测试文件，请先执行 run-test' };
    }
    
    return { name: 'test-files', status: 'pass', message: `E2E: ${e2eCount} 个, API: ${apiCount} 个` };
}

function main() {
    const { testingDir, configPath } = parseArgs();
    
    const checks = [];
    
    // 执行所有检查
    checks.push(checkTestConfig(configPath));
    checks.push(checkGateStatus(configPath));
    checks.push(checkApiPrefix(testingDir, configPath));
    checks.push(checkAuthConfig(testingDir, configPath));
    checks.push(checkTestFiles(testingDir, configPath));
    
    // 计算整体状态
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');
    
    let status = 'pass';
    if (hasFail) status = 'fail';
    else if (hasWarn) status = 'warn';
    
    const result = {
        status,
        checks,
        summary: {
            total: checks.length,
            passed: checks.filter(c => c.status === 'pass').length,
            warned: checks.filter(c => c.status === 'warn').length,
            failed: checks.filter(c => c.status === 'fail').length,
            skipped: checks.filter(c => c.status === 'skip').length
        }
    };
    
    console.log(JSON.stringify(result, null, 2));
}

main();
