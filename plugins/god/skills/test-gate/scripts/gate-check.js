#!/usr/bin/env node
"use strict";
/**
 * gate-check.js
 * 产物门禁自动化 — 编排器
 *
 * 检查逻辑已拆分到 4 个 checker 模块：
 *   - checkers/structural-checker.js （步骤 1, 2, 3, 5, 7, 8）
 *   - checkers/syntax-checker.js     （步骤 6, 9, 10, 11, 12, 13, 14, 20, 21, 22）
 *   - checkers/coverage-checker.js   （步骤 0, 16, 18, 19）
 *   - checkers/semantic-checker.js   （步骤 4a-4g, 15, 17, 20b, 23-35）
 * 共享工具函数在 checkers/shared-utils.js
 *
 * 用法：node gate-check.js --testing-dir testing/ --scope fullstack
 * 输出：testing/.cache/gate-result.json
 */
const fs = require("fs");
const path = require("path");
const { runEvaluationMode } = require("./evaluation-check");
const { loadAcAssignment } = require("../../scripts/lib/ac-assignment-loader");

// ─── 检查器模块 ─────────────────────────────────────────
const checkStructural = require("./checkers/structural-checker");
const checkSyntax = require("./checkers/syntax-checker");
const checkCoverage = require("./checkers/coverage-checker");
const checkSemantic = require("./checkers/semantic-checker");
const sharedUtils = require("./checkers/shared-utils");

// ─── 参数解析 ───────────────────────────────────────────────
function parseArgs() {
    const argv = process.argv.slice(2);
    let testingDir = 'testing';
    let scope = 'fullstack';
    let testingRepo = '';
    let evaluationMode = false;
    let acFile = null;
    let acAssignment = null;
    let evalOutput = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--testing-dir' && argv[i + 1])
            testingDir = argv[++i];
        if (argv[i] === '--scope' && argv[i + 1])
            scope = argv[++i];
        if (argv[i] === '--testing-repo' && argv[i + 1])
            testingRepo = argv[++i];
        if (argv[i] === '--evaluation-mode')
            evaluationMode = true;
        if (argv[i] === '--ac-file' && argv[i + 1])
            acFile = argv[++i];
        if (argv[i] === '--ac-assignment' && argv[i + 1])
            acAssignment = argv[++i];
        if (argv[i] === '--eval-output' && argv[i + 1])
            evalOutput = argv[++i];
    }
    return { testingDir, scope, testingRepo, evaluationMode, acFile, acAssignment, evalOutput };
}

// ─── T3.3: Phase 3 path resolution — symlink legacy paths to new structure ──
let _testingRepo = '';
function setupLegacyPathCompat(testingDir, testingRepo) {
    _testingRepo = testingRepo;
    if (!testingRepo) {
        console.log('[INFO] staging 跳过: testingRepo 未传入（本地模式）');
        return;
    }
    const root = testingRepo;
    const e2eFiles = [];
    const newE2eDir = path.join(root, 'tests', 'e2e');
    const featuresDir = path.join(root, 'features');
    const flowsDir = path.join(root, 'flows');
    const scriptsE2eDir = path.join(root, 'scripts', 'e2e');

    if (fs.existsSync(newE2eDir)) {
        e2eFiles.push(...sharedUtils.findFiles(newE2eDir, /\.spec\.ts$/));
    } else {
        if (fs.existsSync(scriptsE2eDir)) {
            e2eFiles.push(...sharedUtils.findFiles(scriptsE2eDir, /\.spec\.ts$/));
        }
        if (fs.existsSync(featuresDir)) {
            for (const d of fs.readdirSync(featuresDir, { withFileTypes: true })) {
                if (d.isDirectory()) e2eFiles.push(...sharedUtils.findFiles(path.join(featuresDir, d.name, 'e2e'), /\.spec\.ts$/));
            }
        }
        if (fs.existsSync(flowsDir)) {
            for (const d of fs.readdirSync(flowsDir, { withFileTypes: true })) {
                if (d.isDirectory()) {
                    e2eFiles.push(...sharedUtils.findFiles(path.join(flowsDir, d.name, 'e2e'), /\.spec\.ts$/));
                }
            }
        }
    }
    const stagingE2e = path.join(testingDir, 'scripts/e2e/tests');
    const stagingApi = path.join(testingDir, 'scripts/api/tests');
    if (e2eFiles.length === 0) {
        console.warn(`[WARN] staging: testingRepo 目录存在但未找到 E2E 测试文件`);
        console.warn(`  features/ 目录: ${featuresDir} (exists: ${fs.existsSync(featuresDir)})`);
        console.warn(`  flows/ 目录: ${flowsDir} (exists: ${fs.existsSync(flowsDir)})`);
    }
    if (!fs.existsSync(stagingE2e) || sharedUtils.findFiles(stagingE2e, /\.spec\.ts$/).length === 0) {
        if (e2eFiles.length > 0) {
            fs.mkdirSync(stagingE2e, { recursive: true });
            let stagedCount = 0;
            let failedFiles = [];
            for (const f of e2eFiles) {
                const linkPath = path.join(stagingE2e, path.basename(f));
                if (!fs.existsSync(linkPath)) {
                    try { fs.symlinkSync(f, linkPath, 'file'); stagedCount++; } catch (e) {
                        try { fs.copyFileSync(f, linkPath); stagedCount++; } catch (e2) {
                            failedFiles.push({ file: path.basename(f), error: e2.message });
                        }
                    }
                }
            }
            if (failedFiles.length > 0) {
                console.warn(`[WARN] staging E2E: ${stagedCount}/${e2eFiles.length} 成功, ${failedFiles.length} 失败`);
                for (const { file, error } of failedFiles.slice(0, 5)) {
                    console.warn(`  失败: ${file} (${error})`);
                }
            } else {
                console.log(`[OK] staging E2E: ${stagedCount} 个文件已链接到 ${stagingE2e}`);
            }
        }
    }
    const apiFiles = [];
    const featuresApiDir = path.join(root, 'features', 'api', 'tests');
    if (fs.existsSync(featuresApiDir)) {
        apiFiles.push(...sharedUtils.findFiles(featuresApiDir, /\.api\.test\.ts$/));
    }
    if (fs.existsSync(flowsDir)) {
        for (const d of fs.readdirSync(flowsDir, { withFileTypes: true })) {
            if (d.isDirectory()) apiFiles.push(...sharedUtils.findFiles(path.join(flowsDir, d.name, 'api'), /\.api\.test\.ts$/));
        }
    }
    const apiTestsDir = path.join(root, 'api-tests');
    if (fs.existsSync(apiTestsDir)) apiFiles.push(...sharedUtils.findFiles(apiTestsDir, /\.api\.test\.ts$/));
    if (apiFiles.length === 0 && e2eFiles.length === 0) {
        console.warn(`[WARN] staging: testingRepo 目录存在但未找到任何测试文件`);
    }
    if (!fs.existsSync(stagingApi) || sharedUtils.findFiles(stagingApi, /\.api\.test\.ts$/).length === 0) {
        if (apiFiles.length > 0) {
            fs.mkdirSync(stagingApi, { recursive: true });
            let apiStagedCount = 0;
            let apiFailedFiles = [];
            for (const f of apiFiles) {
                const linkPath = path.join(stagingApi, path.basename(f));
                if (!fs.existsSync(linkPath)) {
                    try { fs.symlinkSync(f, linkPath, 'file'); apiStagedCount++; } catch (e) {
                        try { fs.copyFileSync(f, linkPath); apiStagedCount++; } catch (e2) {
                            apiFailedFiles.push({ file: path.basename(f), error: e2.message });
                        }
                    }
                }
            }
            if (apiFailedFiles.length > 0) {
                console.warn(`[WARN] staging API: ${apiStagedCount}/${apiFiles.length} 成功, ${apiFailedFiles.length} 失败`);
                for (const { file, error } of apiFailedFiles.slice(0, 5)) {
                    console.warn(`  失败: ${file} (${error})`);
                }
            } else {
                console.log(`[OK] staging API: ${apiStagedCount} 个文件已链接到 ${stagingApi}`);
            }
        }
    }
}
function cleanupLegacyPathCompat(testingDir) {
    if (!_testingRepo) return;
    const stagingE2e = path.join(testingDir, 'scripts/e2e/tests');
    const stagingApi = path.join(testingDir, 'scripts/api/tests');
    for (const dir of [stagingE2e, stagingApi]) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
            const fp = path.join(dir, f);
            try {
                const stat = fs.lstatSync(fp);
                if (stat.isSymbolicLink()) fs.unlinkSync(fp);
            } catch (e) { /* ignore */ }
        }
    }
}

function main() {
    const { testingDir, scope, testingRepo, evaluationMode, acFile, acAssignment, evalOutput } = parseArgs();
    const cacheDir = path.join(testingDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    // T3.3: Setup legacy path compatibility for Phase 3 directory structure
    setupLegacyPathCompat(testingDir, testingRepo);

    // 统一路径常量（staging 生效后指向正确位置）
    const E2E_TESTS = path.join(testingDir, 'scripts/e2e/tests');
    const E2E_BASE = path.join(testingDir, 'scripts/e2e');
    const API_TESTS = path.join(testingDir, 'scripts/api/tests');
    const API_BASE = path.join(testingDir, 'scripts/api');
    const FLOW_TESTS = path.join(testingDir, 'scripts/flow');

    // T3.3: 验证 staging 目录是否正确创建（testingRepo 模式）
    if (testingRepo && scope !== 'backend') {
        const stagingE2e = path.join(testingDir, 'scripts/e2e/tests');
        if (!fs.existsSync(stagingE2e) || sharedUtils.findFiles(stagingE2e, /\.spec\.ts$/).length === 0) {
            console.warn('[WARN] testingRepo 模式下 staging 目录创建失败或为空，E2E 相关验证将跳过。请检查 --testing-repo 参数是否正确传入。');
        }
    }

    // ─── 执行所有 checker ─────────────────────────────────────
    const checkerOptions = { acAssignmentPath: acAssignment, loadAcAssignment };

    const structural = checkStructural(testingDir, scope, sharedUtils, checkerOptions);
    const syntax = checkSyntax(testingDir, scope, sharedUtils, checkerOptions);
    const coverage = checkCoverage(testingDir, scope, sharedUtils, checkerOptions);
    const semantic = checkSemantic(testingDir, scope, sharedUtils, checkerOptions);

    // ─── 汇总结果（与原 gate-check.js 格式完全一致） ──────────
    const {
        fileIntegrity, tcCoverage, scenarioTypes, apiConfig, pathConventions, importSource,
    } = structural;
    const {
        selectorSyntax, evaluateFetch, visiblePseudo, browserNewPage,
        nthOfTypeSelect, orLocatorStrict, getByTextSelect,
        bareCssSelector, waitForResponseRender, browserNewContext,
    } = syntax;
    const {
        coverageMode, acAnnotation, selectorCentralization, smokeCoverage,
    } = coverage;
    const {
        catchSwallow, conditionalSkip, missingAssertion, evaluateBypass,
        missingScreenshot, statusStrictEqual, hardcodedApiPath,
        sourceCodeReferences, domProbeAuthenticity, elTableFirst,
        domProbeApiPaths, apiSilentSkip, apiWeakAssertion,
        apiHelperDuplication, mockCleanup, placeholderApiPath,
        hardcodedDataValues, playwrightConfig, stateAssertion,
        normalFlowMock, hardcodedFormData, deepLink, authInjection,
    } = semantic;

    // 解构出 issues 数组，方便 allPassed 判断和 console 输出
    const selectorIssues = selectorSyntax.issues;
    const pathWarnings = pathConventions.warnings;
    const importIssues = importSource.issues;
    const evaluateFetchIssues = evaluateFetch.issues;
    const visiblePseudoIssues = visiblePseudo.issues;
    const browserNewPageIssues = browserNewPage.issues;
    const nthOfTypeIssues = nthOfTypeSelect.issues;
    const orLocatorIssues = orLocatorStrict.issues;
    const getByTextSelectIssues = getByTextSelect.issues;
    const bareCssSelectorIssues = bareCssSelector.issues;
    const waitForResponseRenderIssues = waitForResponseRender.issues;
    const browserNewContextIssues = browserNewContext.issues;
    const sourceRefIssues = sourceCodeReferences.issues;
    const catchSwallowIssues = catchSwallow.issues;
    const conditionalSkipIssues = conditionalSkip.issues;
    const missingAssertionIssues = missingAssertion.issues;
    const evaluateBypassIssues = evaluateBypass.issues;
    const missingScreenshotIssues = missingScreenshot.issues;
    const statusStrictEqualIssues = statusStrictEqual.issues;
    const hardcodedApiPathIssues = hardcodedApiPath.issues;
    const elTableFirstIssues = elTableFirst.issues;
    const domProbeApiPathsIssues = domProbeApiPaths.issues;
    const apiSilentSkipIssues = apiSilentSkip.issues;
    const apiWeakAssertionWarnings = apiWeakAssertion.warnings;
    const apiHelperDuplicationWarnings = apiHelperDuplication.warnings;
    const mockCleanupIssues = mockCleanup.issues;
    const placeholderApiPathIssues = placeholderApiPath.issues;
    const hardcodedDataIssues = hardcodedDataValues.issues;
    const playwrightConfigIssues = playwrightConfig.issues;
    const stateAssertionIssues = stateAssertion.issues;
    const normalFlowMockIssues = normalFlowMock.issues;
    const hardcodedFormWarnings = hardcodedFormData.warnings;
    const deepLinkIssues = deepLink.issues;
    const authInjectionIssues = authInjection.issues;

    const allPassed = fileIntegrity.passed && tcCoverage.passed && scenarioTypes.passed && apiConfig.passed
        && selectorIssues.length === 0 && importIssues.length === 0
        && evaluateFetchIssues.length === 0 && visiblePseudoIssues.length === 0
        && browserNewPageIssues.length === 0 && nthOfTypeIssues.length === 0
        && orLocatorIssues.length === 0 && getByTextSelectIssues.length === 0
        && sourceRefIssues.length === 0
        && acAnnotation.passed
        && (domProbeAuthenticity.skipped || domProbeAuthenticity.passed)
        && catchSwallowIssues.length === 0 && conditionalSkipIssues.length === 0
        && missingAssertionIssues.length === 0 && evaluateBypassIssues.length === 0
        && missingScreenshotIssues.length === 0 && statusStrictEqualIssues.length === 0
        && hardcodedApiPathIssues.length === 0
        && (selectorCentralization.skipped || selectorCentralization.passed)
        && bareCssSelectorIssues.length === 0
        && elTableFirstIssues.length === 0
        && waitForResponseRenderIssues.length === 0
        && browserNewContextIssues.length === 0
        && domProbeApiPathsIssues.length === 0
        && apiSilentSkipIssues.length === 0
        && mockCleanupIssues.length === 0
        && placeholderApiPathIssues.length === 0
        && hardcodedDataIssues.length === 0
        && playwrightConfigIssues.length === 0
        && stateAssertionIssues.length === 0
        && normalFlowMockIssues.length === 0
        && deepLinkIssues.length === 0
        && authInjectionIssues.length === 0;

    const result = {
        passed: allPassed,
        timestamp: new Date().toISOString(),
        steps: {
            coverageMode: coverageMode.skipped
                ? { skipped: true, details: coverageMode.details }
                : { warnings: coverageMode.warnings || [], details: coverageMode.details },
            fileIntegrity: { passed: fileIntegrity.passed, details: fileIntegrity.details },
            tcCoverage: {
                passed: tcCoverage.passed,
                missing: tcCoverage.missing,
                e2eRate: tcCoverage.e2eRate,
                apiRate: tcCoverage.apiRate,
                details: tcCoverage.details,
            },
            scenarioTypes: { passed: scenarioTypes.passed, details: scenarioTypes.details },
            apiConfig: { passed: apiConfig.passed, details: apiConfig.details },
            selectorSyntax,
            pathConventions,
            importSource,
            evaluateFetch,
            visiblePseudo,
            browserNewPage,
            nthOfTypeSelect,
            orLocatorStrict,
            getByTextSelect,
            sourceCodeReferences,
            acAnnotationCoverage: {
                name: 'AC 注释覆盖验证',
                skipped: acAnnotation.skipped || false,
                passed: acAnnotation.passed,
                details: acAnnotation.details,
                missingAnnotations: acAnnotation.missingAnnotations || [],
                uncoveredAcInScripts: acAnnotation.uncoveredAcInScripts || [],
            },
            domProbeAuthenticity,
            catchSwallow,
            conditionalSkip,
            missingAssertion,
            evaluateBypass,
            missingScreenshot,
            statusStrictEqual,
            hardcodedApiPath,
            selectorCentralization: {
                name: '选择器集中度检查',
                skipped: selectorCentralization.skipped || false,
                passed: selectorCentralization.passed,
                rate: selectorCentralization.rate,
                total: selectorCentralization.total,
                hardcoded: selectorCentralization.hardcoded,
                issues: selectorCentralization.issues || [],
            },
            smokeCoverage: {
                name: '@smoke 覆盖率检查',
                skipped: smokeCoverage.skipped || false,
                passed: smokeCoverage.passed,
                issues: smokeCoverage.issues || [],
            },
            bareCssSelector,
            elTableFirst,
            waitForResponseRender,
            browserNewContext,
            domProbeApiPaths,
            apiSilentSkip,
            apiWeakAssertion,
            apiHelperDuplication,
            mockCleanup,
            placeholderApiPath,
            hardcodedDataValues,
            playwrightConfig,
            stateAssertion,
            normalFlowMock,
            hardcodedFormData,
            deepLink,
            authInjection,
        },
    };
    fs.writeFileSync(path.join(cacheDir, 'gate-result.json'), JSON.stringify(result, null, 2));

    // ─── 输出摘要（与原格式完全一致） ──────────────────────────
    console.log(allPassed ? '[OK] 门禁检查通过' : '[FAIL] 门禁检查未通过');
    if (coverageMode.skipped) {
        console.log(`  步骤 0 案例设计质量: [SKIP] 跳过（case-design-summary.json 不存在）`);
    } else {
        const warnCount = (coverageMode.warnings || []).length;
        console.log(`  步骤 0 案例设计质量: ${warnCount === 0 ? '[OK]' : '[WARN] ' + warnCount + ' 个警告（不阻塞）'}`);
    }
    console.log(`  步骤 1 文件完整性: ${fileIntegrity.passed ? '[OK]' : '[FAIL]'}`);
    console.log(`  步骤 2 TC 编号比对: ${tcCoverage.passed ? '[OK]' : '[FAIL]'} (E2E: ${tcCoverage.e2eRate}, API: ${tcCoverage.apiRate})`);
    console.log(`  步骤 3 场景类型覆盖: ${scenarioTypes.passed ? '[OK]' : '[FAIL]'}`);
    console.log(`  步骤 4a catch 吞错误: ${catchSwallowIssues.length === 0 ? '[OK]' : '[FAIL] ' + catchSwallowIssues.length + ' 个问题'}`);
    console.log(`  步骤 4b 条件跳过: ${conditionalSkipIssues.length === 0 ? '[OK]' : '[FAIL] ' + conditionalSkipIssues.length + ' 个问题'}`);
    console.log(`  步骤 4c 缺少断言: ${missingAssertionIssues.length === 0 ? '[OK]' : '[FAIL] ' + missingAssertionIssues.length + ' 个问题'}`);
    console.log(`  步骤 4d evaluate 绕过: ${evaluateBypassIssues.length === 0 ? '[OK]' : '[FAIL] ' + evaluateBypassIssues.length + ' 个问题'}`);
    console.log(`  步骤 4e 缺少截图: ${missingScreenshotIssues.length === 0 ? '[OK]' : '[FAIL] ' + missingScreenshotIssues.length + ' 个问题'}`);
    console.log(`  步骤 4f status===200: ${statusStrictEqualIssues.length === 0 ? '[OK]' : '[FAIL] ' + statusStrictEqualIssues.length + ' 个问题'}`);
    console.log(`  步骤 4g 硬编码路径: ${hardcodedApiPathIssues.length === 0 ? '[OK]' : '[FAIL] ' + hardcodedApiPathIssues.length + ' 个问题'}`);
    console.log(`  步骤 5 API 配置校验: ${apiConfig.passed ? '[OK]' : '[FAIL]'}`);
    console.log(`  步骤 6 选择器语法: ${selectorIssues.length === 0 ? '[OK]' : '[FAIL] ' + selectorIssues.length + ' 个问题'}`);
    console.log(`  步骤 7 路径规范: ${pathWarnings.length === 0 ? '[OK]' : '[WARN] ' + pathWarnings.length + ' 个警告'}`);
    console.log(`  步骤 8 import 来源: ${importIssues.length === 0 ? '[OK]' : '[FAIL] ' + importIssues.length + ' 个问题'}`);
    console.log(`  步骤 9 evaluate fetch: ${evaluateFetchIssues.length === 0 ? '[OK]' : '[FAIL] ' + evaluateFetchIssues.length + ' 个问题'}`);
    console.log(`  步骤 10 :visible 伪类: ${visiblePseudoIssues.length === 0 ? '[OK]' : '[FAIL] ' + visiblePseudoIssues.length + ' 个问题'}`);
    console.log(`  步骤 11 browser.newPage: ${browserNewPageIssues.length === 0 ? '[OK]' : '[FAIL] ' + browserNewPageIssues.length + ' 个问题'}`);
    console.log(`  步骤 12 nth-of-type: ${nthOfTypeIssues.length === 0 ? '[OK]' : '[FAIL] ' + nthOfTypeIssues.length + ' 个问题'}`);
    console.log(`  步骤 13 .or() strict: ${orLocatorIssues.length === 0 ? '[OK]' : '[FAIL] ' + orLocatorIssues.length + ' 个问题'}`);
    console.log(`  步骤 14 getByText select: ${getByTextSelectIssues.length === 0 ? '[OK]' : '[FAIL] ' + getByTextSelectIssues.length + ' 个问题'}`);
    console.log(`  步骤 15 源码引用扫描: ${sourceRefIssues.length === 0 ? '[OK]' : '[FAIL] ' + sourceRefIssues.length + ' 个问题'}`);
    console.log(`  步骤 16 AC 注释覆盖: ${acAnnotation.passed ? '[OK]' : '[FAIL]'}`);
    if (!acAnnotation.passed) {
        for (const d of acAnnotation.details) console.log(`    ${d}`);
    }
    if (!domProbeAuthenticity.skipped) {
        console.log(`  步骤 17 dom-probe 真实性: ${(domProbeAuthenticity.passed) ? '[OK]' : '[FAIL]'}`);
        if (!domProbeAuthenticity.passed) {
            for (const d of domProbeAuthenticity.details) console.log(`    ${d}`);
        }
    }
    // T2.7: Phase 2 新增检查
    if (!selectorCentralization.skipped) {
        const scMsg = selectorCentralization.passed
            ? `[OK] (${selectorCentralization.rate}% hardcoded)`
            : `[FAIL] ${selectorCentralization.rate}% hardcoded (threshold: ${selectorCentralization.threshold}%)`;
        console.log(`  步骤 18 选择器集中度: ${scMsg}`);
    }
    if (!smokeCoverage.skipped) {
        const smIssues = (smokeCoverage.issues || []).length;
        console.log(`  步骤 19 @smoke 覆盖: ${smIssues === 0 ? '[OK]' : '[WARN] ' + smIssues + ' 个缺失（不阻塞）'}`);
    }
    console.log(`  步骤 20 裸 CSS 类选择器: ${bareCssSelectorIssues.length === 0 ? '[OK]' : '[FAIL] ' + bareCssSelectorIssues.length + ' 个问题'}`);
    console.log(`  步骤 20b .el-table .first(): ${elTableFirstIssues.length === 0 ? '[OK]' : '[FAIL] ' + elTableFirstIssues.length + ' 个问题'}`);
    console.log(`  步骤 21 waitForResponse 渲染等待: ${waitForResponseRenderIssues.length === 0 ? '[OK]' : '[FAIL] ' + waitForResponseRenderIssues.length + ' 个问题'}`);
    console.log(`  步骤 22 browser.newContext() 检测: ${browserNewContextIssues.length === 0 ? '[OK]' : '[FAIL] ' + browserNewContextIssues.length + ' 个问题'}`);
    console.log(`  步骤 23 dom-probe API路径记录: ${domProbeApiPathsIssues.length === 0 ? '[OK]' : '[FAIL] ' + domProbeApiPathsIssues.length + ' 个问题'}`);
    console.log(`  步骤 24 API 静默跳过: ${apiSilentSkipIssues.length === 0 ? '[OK]' : '[FAIL] ' + apiSilentSkipIssues.length + ' 个问题'}`);
    if (apiWeakAssertionWarnings.length > 0) {
        console.log(`  步骤 25 API 弱断言: [WARN] ${apiWeakAssertionWarnings.length} 个警告（不阻塞）`);
    } else {
        console.log(`  步骤 25 API 弱断言: [OK]`);
    }
    if (apiHelperDuplicationWarnings.length > 0) {
        console.log(`  步骤 26 API Helper 重复: [WARN] ${apiHelperDuplicationWarnings.length} 个警告（不阻塞）`);
    } else {
        console.log(`  步骤 26 API Helper 重复: [OK]`);
    }
    console.log(`  步骤 27 E2E mock 清理: ${mockCleanupIssues.length === 0 ? '[OK]' : '[FAIL] ' + mockCleanupIssues.length + ' 个问题'}`);
    console.log(`  步骤 28 占位符API路径: ${placeholderApiPathIssues.length === 0 ? '[OK]' : '[FAIL] ' + placeholderApiPathIssues.length + ' 个问题'}`);
    console.log(`  步骤 29 API硬编码占位值: ${hardcodedDataIssues.length === 0 ? '[OK]' : '[FAIL] ' + hardcodedDataIssues.length + ' 个问题'}`);
    console.log(`  步骤 30 playwright配置完整性: ${playwrightConfigIssues.length === 0 ? '[OK]' : '[FAIL] ' + playwrightConfigIssues.length + ' 个问题'}`);
    console.log(`  步骤 31 状态断言合理性: ${stateAssertionIssues.length === 0 ? '[OK]' : '[FAIL] ' + stateAssertionIssues.length + ' 个问题'}`);
    console.log(`  步骤 32 正常流程 mock 检测: ${normalFlowMockIssues.length === 0 ? '[OK]' : '[FAIL] ' + normalFlowMockIssues.length + ' 个问题'}`);
    if (hardcodedFormWarnings.length > 0) {
        console.log(`  步骤 33 E2E 硬编码表单数据: [WARN] ${hardcodedFormWarnings.length} 个警告（不阻塞）`);
    } else {
        console.log(`  步骤 33 E2E 硬编码表��数据: [OK]`);
    }
    console.log(`  步骤 34 深度链接检测: ${deepLinkIssues.length === 0 ? '[OK]' : '[FAIL] ' + deepLinkIssues.length + ' 个问题'}`);
    console.log(`  步骤 35 认证注入检测: ${authInjectionIssues.length === 0 ? '[OK]' : '[FAIL] ' + authInjectionIssues.length + ' 个问题'}`);
    // T3.3: Cleanup temporary staging files (must happen before process.exit)
    cleanupLegacyPathCompat(testingDir);
    if (!allPassed)
        process.exit(1);
    // T8: evaluation-mode（独立于门禁，不影响 allPassed）
    if (evaluationMode) {
        try {
            runEvaluationMode(testingDir, scope, acFile, acAssignment, evalOutput, result);
        } catch (e) {
            console.warn(`[WARN] 评估模式执行异常（不影响门禁结果）: ${e.message}`);
        }
    }
}
main();
