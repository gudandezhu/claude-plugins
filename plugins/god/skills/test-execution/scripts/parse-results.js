#!/usr/bin/env node
"use strict";
/**
 * TASK-05: parse-results.js
 * 解析 Playwright/vitest JSON reporter 输出，生成精简摘要 test-summary.json
 *
 * 用法：node parse-results.js --api testing/.cache/api-raw.json --e2e testing/.cache/e2e-raw.json --output testing/.cache/test-summary.json
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
const { getSuggestedAction, classifyPlaywrightError, classifyVitestError } = require("./lib/error-classifier");
const { extractTcIdFromTitle } = require("../../../scripts/lib/tc-id-extractor");
// ─── 参数解析 ───────────────────────────────────────────────
function parseArgs() {
    const argv = process.argv.slice(2);
    let api;
    let e2e;
    let output = 'testing/.cache/test-summary.json';
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--api' && argv[i + 1])
            api = argv[++i];
        if (argv[i] === '--e2e' && argv[i + 1])
            e2e = argv[++i];
        if (argv[i] === '--output' && argv[i + 1])
            output = argv[++i];
    }
    return { api, e2e, output };
}
function parsePlaywrightJson(raw) {
    const failures = [];
    let total = 0, passed = 0, failed = 0, skipped = 0;
    function walkSuite(suite, parentFile) {
        const file = suite.file || parentFile || '';
        for (const sub of suite.suites || [])
            walkSuite(sub, file);
        for (const spec of suite.specs || []) {
            for (const test of spec.tests) {
                for (const result of test.results) {
                    total++;
                    if (result.status === 'passed') {
                        passed++;
                        continue;
                    }
                    if (result.status === 'skipped') {
                        skipped++;
                        continue;
                    }
                    failed++;
                    const errorMsg = result.error?.message || '';
                    const tcId = extractTcIdFromTitle(spec.title);
                    const eType = classifyPlaywrightError(errorMsg);
                    failures.push({
                        tcId: tcId || spec.title,
                        file: file,
                        testName: spec.title,
                        errorType: eType,
                        suggestedAction: getSuggestedAction(eType),
                        message: errorMsg.substring(0, 500),
                        duration: result.duration,
                    });
                }
            }
        }
    }
    if (raw.suites) {
        for (const suite of raw.suites)
            walkSuite(suite);
    }
    return { total, passed, failed, skipped, failures };
}
// ─── Vitest JSON 解析 ───────────────────────────────────────
function parseVitestJson(raw) {
    const failures = [];
    let total = 0, passed = 0, failed = 0, skipped = 0;
    const testResults = raw.testResults || raw.results || [];
    if (testResults.length === 0 && !raw.testResults && !raw.results) {
        // 未知格式：输出诊断信息而非静默返回空
        console.warn('[WARN] vitest JSON 格式未识别');
        console.warn('   顶层键:', Object.keys(raw).join(', '));
        console.warn('   请检查 vitest 版本和 --reporter=json 输出格式');
        return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [],
                 parseError: `未识别的 vitest JSON 格式，顶层键: ${Object.keys(raw).join(', ')}` };
    }
    for (const fileResult of testResults) {
        const file = fileResult.name || fileResult.file || '';
        const tests = fileResult.assertionResults || fileResult.tests || [];
        for (const test of tests) {
            total++;
            const status = test.status || test.state;
            if (status === 'passed') {
                passed++;
                continue;
            }
            if (status === 'skipped' || status === 'pending') {
                skipped++;
                continue;
            }
            failed++;
            const errorMsg = (test.failureMessages || []).join('\n') || test.message || '';
            const tcMatch = extractTcIdFromTitle(test.fullName || test.title || '');
            const eType = classifyVitestError(errorMsg);
            failures.push({
                tcId: tcMatch || (test.title || test.fullName || 'unknown'),
                file,
                testName: test.fullName || test.title || '',
                errorType: eType,
                suggestedAction: getSuggestedAction(eType),
                message: errorMsg.substring(0, 500),
                duration: test.duration || 0,
            });
        }
    }
    return { total, passed, failed, skipped, failures };
}
// ─── 主流程 ─────────────────────────────────────────────────
function main() {
    const args = parseArgs();
    const summary = {
        timestamp: new Date().toISOString(),
        api: { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] },
        e2e: { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] },
    };
    // 解析 API 结果
    if (args.api && fs.existsSync(args.api)) {
        try {
            const content = fs.readFileSync(args.api, 'utf-8');
            // vitest JSON 输出可能包含非 JSON 前缀，尝试找到 JSON 开始位置
            const jsonStart = content.indexOf('{');
            if (jsonStart >= 0) {
                const raw = JSON.parse(content.substring(jsonStart));
                if (raw.error && !raw.testResults && !raw.results) {
                    // 进程超时或异常退出，无有效测试结果
                    console.error(`[WARN] API 测试进程异常: ${raw.error}`);
                    summary.api = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [],
                                    processError: raw.error, killed: raw.killed || false };
                } else {
                    summary.api = parseVitestJson(raw);
                }
            }
        }
        catch (err) {
            console.error(`[WARN] 解析 API 结果失败: ${err.message}`);
            summary.api = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [], parseError: err.message };
        }
    }
    // 解析 E2E 结果
    if (args.e2e && fs.existsSync(args.e2e)) {
        try {
            const content = fs.readFileSync(args.e2e, 'utf-8');
            const jsonStart = content.indexOf('{');
            if (jsonStart >= 0) {
                const raw = JSON.parse(content.substring(jsonStart));
                if (raw.error && !raw.suites) {
                    // 进程超时或异常退出，无有效测试结果
                    console.error(`[WARN] E2E 测试进程异常: ${raw.error}`);
                    summary.e2e = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [],
                                    processError: raw.error, killed: raw.killed || false };
                } else {
                    summary.e2e = parsePlaywrightJson(raw);
                }
            }
        }
        catch (err) {
            console.error(`[WARN] 解析 E2E 结果失败: ${err.message}`);
            summary.e2e = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [], parseError: err.message };
        }
    }
    // 写入输出
    const outputDir = path.dirname(args.output);
    fs.mkdirSync(outputDir, { recursive: true });

    // ─── 全量失败启发式：>90% 相同错误模式 → 大概率环境问题 ───
    for (const section of [summary.api, summary.e2e]) {
        if (section.failures.length > 3) {
            const defectFailures = section.failures.filter(f => f.suggestedAction === 'report-defect');
            if (defectFailures.length / section.failures.length > 0.9) {
                const patterns = defectFailures.map(f => {
                    if (/tobevisible|not visible|to be visible/i.test(f.message)) return 'not-visible';
                    if (/navigation|navigate|invalid url/i.test(f.message)) return 'navigation';
                    if (/timeout/i.test(f.message)) return 'timeout';
                    if (/toHaveCount|toHaveText|toContainText/i.test(f.message)) return 'assertion';
                    return 'other';
                });
                const uniquePatterns = new Set(patterns);
                const envPatterns = new Set(['not-visible', 'navigation', 'timeout']);
                const allEnvRelated = [...uniquePatterns].every(p => envPatterns.has(p));
                if (uniquePatterns.size <= 2 && allEnvRelated) {
                    const dominantPattern = [...uniquePatterns].join('+');
                    for (const f of defectFailures) {
                        f.suggestedAction = 'check-environment';
                        f.originalAction = 'report-defect';
                        f.message = `[全量失败模式: ${dominantPattern}，可能是环境/认证问题] ` + f.message;
                    }
                }
            }
        }
    }

    fs.writeFileSync(args.output, JSON.stringify(summary, null, 2));
    // 输出摘要
    console.log('[STATS] 测试结果摘要:');
    // 进程异常时优先输出错误信息
    if (summary.api.processError) {
        console.log(`  API: [WARN] 进程异常 — ${summary.api.processError}${summary.api.killed ? '（执行超时被终止）' : ''}`);
    } else {
        console.log(`  API: ${summary.api.passed}/${summary.api.total} 通过, ${summary.api.failed} 失败`);
    }
    if (summary.e2e.processError) {
        console.log(`  E2E: [WARN] 进程异常 — ${summary.e2e.processError}${summary.e2e.killed ? '（执行超时被终止）' : ''}`);
    } else {
        console.log(`  E2E: ${summary.e2e.passed}/${summary.e2e.total} 通过, ${summary.e2e.failed} 失败`);
    }
    if (summary.api.failures.length > 0 || summary.e2e.failures.length > 0) {
        console.log('\n失败分类:');
        const allFailures = [...summary.api.failures, ...summary.e2e.failures];
        const byType = {};
        for (const f of allFailures) {
            byType[f.errorType] = (byType[f.errorType] || 0) + 1;
        }
        for (const [type, count] of Object.entries(byType)) {
            console.log(`  ${type}: ${count}`);
        }
    }
}
main();
