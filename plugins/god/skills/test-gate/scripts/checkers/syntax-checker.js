#!/usr/bin/env node
"use strict";
/**
 * syntax-checker.js
 * 选择器语法（步骤 6）、evaluate fetch（步骤 9）、:visible 伪类（步骤 10）、
 * browser.newPage（步骤 11）、nth-of-type（步骤 12）、.or() strict mode（步骤 13）、
 * getByText select（步骤 14）、裸 CSS 类选择器（步骤 20）、
 * waitForResponse 渲染等待（步骤 21）、browser.newContext（步骤 22）。
 */
const fs = require("fs");
const path = require("path");
const { walkSpecFiles, extractTestBlocks } = require("./shared-utils");

/**
 * @param {string} testingDir
 * @param {string} scope
 * @param {object} sharedUtils
 * @param {object} options
 * @returns {object}
 */
module.exports = function checkSyntax(testingDir, scope, sharedUtils, options) {
    const e2eDir = path.join(testingDir, 'scripts/e2e/tests');

    // ─── 步骤 6：选择器语法校验 ────────────────────────────────
    function validateSelectorSyntax() {
        const issues = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const locatorPat = /locator\(['"`]([\s\S]+?)['"`]\)/g;
            let m;
            while ((m = locatorPat.exec(content)) !== null) {
                const sel = m[1];
                const trimmed = sel.trim();
                const hasXPath = trimmed.startsWith('//') || trimmed.startsWith('..');
                const hasCssPseudo = /:has-text|:visible|:has\(/.test(sel);
                if (hasXPath && hasCssPseudo) {
                    issues.push(`${path.basename(filePath)}: 混合 XPath/CSS: "${sel.substring(0, 80)}"`);
                }
                if (trimmed.startsWith('..')) {
                    issues.push(`${path.basename(filePath)}: XPath 父轴: "${sel.substring(0, 80)}"`);
                }
                if (/[\s\/]@/.test(sel)) {
                    issues.push(`${path.basename(filePath)}: XPath 属性选择器: "${sel.substring(0, 80)}"`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 9：page.evaluate fetch 跨域检测 ─────────────────
    function validateEvaluateFetch() {
        const issues = [];
        const evalFetchPat = /page\.evaluate\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*fetch\s*\(/gs;
        const evalFetchPat2 = /page\.evaluate\s*\(\s*(?:async\s*)?(?:function[^{]*)\{[^}]*fetch\s*\(/gs;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (evalFetchPat.test(content) || evalFetchPat2.test(content)) {
                issues.push(`${path.basename(filePath)}: page.evaluate 中调用了 fetch，跨域必然失败，改用 page.request`);
            }
            evalFetchPat.lastIndex = 0;
            evalFetchPat2.lastIndex = 0;
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 10：:visible 在 querySelector 中使用检测 ────────
    function validateVisiblePseudo() {
        const issues = [];
        const visiblePat = /(?:querySelector|waitForSelector)\s*\(\s*['"`][^'"`]*:visible[^'"`]*['"`]/g;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const matches = content.match(visiblePat);
            if (matches) {
                issues.push(`${path.basename(filePath)}: querySelector/waitForSelector 中使用了 :visible 伪类（原生 DOM API 不支持），改用 page.locator().waitFor({ state: 'visible' })`);
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 11：browser.newPage() 无 storageState 检测 ──────
    function validateBrowserNewPage() {
        const issues = [];
        const newPagePat = /(?:beforeAll|afterAll)\s*\(async[^)]*\)\s*=>\s*\{[^}]*browser\.newPage\s*\(\s*\)/gs;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (newPagePat.test(content)) {
                issues.push(`${path.basename(filePath)}: beforeAll/afterAll 中用了 browser.newPage()，不继承 storageState，改用 browser.newContext({ storageState }) + context.newPage()`);
            }
            newPagePat.lastIndex = 0;
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 12：nth-of-type 定位 el-select 检测 ─────────────
    function validateNthOfTypeSelect() {
        const issues = [];
        const nthPat = /\.el-select:nth-of-type\s*\(\s*\d+\s*\)/g;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (nthPat.test(content)) {
                issues.push(`${path.basename(filePath)}: 用了 .el-select:nth-of-type(N)，nth-of-type 按 div 标签计数不按 class，改用 form-item label 过滤定位`);
            }
            nthPat.lastIndex = 0;
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 13：.or() locator 配合 toBeVisible 检测 ─────────
    function validateOrLocatorStrict() {
        const issues = [];
        const orVisiblePat = /\.or\s*\([^)]+\)\s*(?:\)?\s*)\.toBeVisible/g;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (orVisiblePat.test(content)) {
                issues.push(`${path.basename(filePath)}: .or() 复合 locator 配合 toBeVisible()，两侧都匹配时触发 strict mode，改用多选择器 CSS 字符串`);
            }
            orVisiblePat.lastIndex = 0;
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 14：getByText 定位 el-select placeholder 检测 ───
    function validateGetByTextElSelect() {
        const issues = [];
        const placeholderPat = /getByText\s*\(\s*['"`][^'"`]*(?:选择|请选|请输入)[^'"`]*['"`]\s*\)\s*\.click/g;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (placeholderPat.test(content)) {
                issues.push(`${path.basename(filePath)}: getByText 使用了 placeholder 文字（含"选择"/"请选"/"请输入"）定位 el-select，会同时匹配 label，改用 form-item label 过滤`);
            }
            placeholderPat.lastIndex = 0;
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 20：裸 CSS 类选择器检测 ────────────────────────────
    function validateBareCssSelector() {
        const issues = [];
        const bareSinglePat = /\.locator\s*\(\s*['"`](\.(?:el|jse)-[\w-]+)['"`]\s*\)(?!\.(?:first|count|filter|nth|all|last|locator|getBy)\s*\()(?!\s*;)/g;
        const bareCompoundPat = /\.locator\s*\(\s*['"`]([\w\s.#[\]"'=*>+~:-]+\.(?:el|jse)-[\w-]+)['"`]\s*\)(?!\.(?:first|count|filter|nth|all|last|locator|getBy)\s*\()(?!\s*;)/g;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            bareSinglePat.lastIndex = 0;
            let m;
            while ((m = bareSinglePat.exec(content)) !== null) {
                issues.push(`${fileName}: 裸 CSS 类选择器 "${m[1]}"，Element Plus 组件结构变化时失效，改用 getByRole/getByLabel/getByTestId`);
            }
            bareCompoundPat.lastIndex = 0;
            while ((m = bareCompoundPat.exec(content)) !== null) {
                const sel = m[1].trim();
                if (!/\s/.test(sel)) continue;
                issues.push(`${fileName}: 复合 CSS 类选择器 "${sel}" 可能匹配多个元素（strict mode 报错），加 .first() 或改用语义选择器`);
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 21：waitForResponse 用作渲染等待检测 ───────────────
    function validateWaitForResponseAsRenderWait() {
        const issues = [];
        const unassignedPat = /^(?![ \t]*(?:const|let|var)\s)[ \t]*await\s+(?:page|frame)\s*\.\s*waitForResponse\s*\(/gm;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            unassignedPat.lastIndex = 0;
            const matches = content.match(unassignedPat);
            if (matches) {
                issues.push(`${path.basename(filePath)}: waitForResponse 未捕获返回值（${matches.length} 处），仅用作渲染等待而非断言请求，渲染等待应改用 expect(locator).toBeVisible({ timeout: 15000 })`);
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ──────── 步骤 22：spec 文件中 test() 块内 browser.newContext() 检测 ──────────
    function validateBrowserNewContext() {
        const issues = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            for (const block of extractTestBlocks(content)) {
                if (/browser\.newContext\s*\(/.test(block.body)) {
                    issues.push(`${path.basename(filePath)}: test() 块内调用了 browser.newContext()，会绕过 fixtures.ts 注入的 el-tour 遮罩抑制；改用 fixtures.ts 提供的 page fixture`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 执行所有 syntax 检查 ───────────────────────────────────
    const isBackend = scope === 'backend';
    const skipResult = [];

    const selectorIssues = isBackend ? skipResult : validateSelectorSyntax();
    const evaluateFetchIssues = isBackend ? skipResult : validateEvaluateFetch();
    const visiblePseudoIssues = isBackend ? skipResult : validateVisiblePseudo();
    const browserNewPageIssues = isBackend ? skipResult : validateBrowserNewPage();
    const nthOfTypeIssues = isBackend ? skipResult : validateNthOfTypeSelect();
    const orLocatorIssues = isBackend ? skipResult : validateOrLocatorStrict();
    const getByTextSelectIssues = isBackend ? skipResult : validateGetByTextElSelect();
    const bareCssSelectorIssues = isBackend ? skipResult : validateBareCssSelector();
    const waitForResponseRenderIssues = isBackend ? skipResult : validateWaitForResponseAsRenderWait();
    const browserNewContextIssues = isBackend ? skipResult : validateBrowserNewContext();

    return {
        selectorSyntax: {
            name: '选择器语法校验',
            passed: selectorIssues.length === 0,
            issues: selectorIssues,
        },
        evaluateFetch: {
            name: 'page.evaluate fetch 跨域检测',
            passed: evaluateFetchIssues.length === 0,
            issues: evaluateFetchIssues,
        },
        visiblePseudo: {
            name: ':visible 伪类误用检测',
            passed: visiblePseudoIssues.length === 0,
            issues: visiblePseudoIssues,
        },
        browserNewPage: {
            name: 'browser.newPage() 无 storageState 检测',
            passed: browserNewPageIssues.length === 0,
            issues: browserNewPageIssues,
        },
        nthOfTypeSelect: {
            name: 'nth-of-type 定位 el-select 检测',
            passed: nthOfTypeIssues.length === 0,
            issues: nthOfTypeIssues,
        },
        orLocatorStrict: {
            name: '.or() locator strict mode 检测',
            passed: orLocatorIssues.length === 0,
            issues: orLocatorIssues,
        },
        getByTextSelect: {
            name: 'getByText 定位 el-select 检测',
            passed: getByTextSelectIssues.length === 0,
            issues: getByTextSelectIssues,
        },
        bareCssSelector: {
            name: '裸 CSS 类选择器检测',
            passed: bareCssSelectorIssues.length === 0,
            issues: bareCssSelectorIssues,
        },
        waitForResponseRender: {
            name: 'waitForResponse 用作渲染等待检测',
            passed: waitForResponseRenderIssues.length === 0,
            issues: waitForResponseRenderIssues,
        },
        browserNewContext: {
            name: 'spec 文件 browser.newContext() 检测',
            passed: browserNewContextIssues.length === 0,
            issues: browserNewContextIssues,
        },
    };
};
