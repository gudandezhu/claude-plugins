#!/usr/bin/env node
"use strict";
/**
 * semantic-checker.js
 * catch 吞错误（步骤 4a）、条件跳过（步骤 4b）、缺少断言（步骤 4c）、
 * evaluate 绕过（步骤 4d）、缺少截图（步骤 4e）、status===200（步骤 4f）、
 * 硬编码 API 路径（步骤 4g）、源码引用扫描（步骤 15）、dom-probe 真实性（步骤 17）、
 * el-table .first()（步骤 20b）、dom-probe API 路径（步骤 23）、
 * API 静默跳过（步骤 24）、API 弱断言（步骤 25）、API helper 重复（步骤 26）、
 * E2E mock 清理（步骤 27）、占位符 API 路径（步骤 28）、硬编码数据值（步骤 29）、
 * playwright 配置（步骤 30）、Element Plus 状态断言（步骤 31）。
 */
const fs = require("fs");
const path = require("path");
const { findFiles, readFileContent, extractTestBlocks, walkSpecFiles } = require("./shared-utils");

/**
 * @param {string} testingDir
 * @param {string} scope
 * @param {object} sharedUtils
 * @param {object} options
 * @returns {object}
 */
module.exports = function checkSemantic(testingDir, scope, sharedUtils, options) {
    const e2eDir = path.join(testingDir, 'scripts/e2e/tests');
    const apiDir = path.join(testingDir, 'scripts/api/tests');

    // ─── 步骤 4a：catch 吞错误检测（test() 块内） ─────────────
    function validateCatchSwallow() {
        const issues = [];
        const catchPat = /\.catch\s*\(\s*(?:\(\s*\w*\s*\)|_|\w+)\s*=>\s*\{\s*\}\s*\)/g;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            for (const block of extractTestBlocks(content)) {
                catchPat.lastIndex = 0;
                if (catchPat.test(block.body)) {
                    issues.push(`${path.basename(filePath)}: test() 块内用了 .catch(()=>{}) 吞掉错误，失败静默通过等于没测`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 4b：条件跳过整个 test 逻辑检测 ─────────────────
    function validateConditionalSkip() {
        const issues = [];
        const ifVisiblePat = /if\s*\(\s*await\s+\S+\.(?:isVisible|isEnabled|isChecked)\s*\(\s*\)\s*\)/;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            for (const block of extractTestBlocks(content)) {
                const trimmed = block.body.trim();
                if (!ifVisiblePat.test(trimmed)) continue;
                const firstStmt = trimmed.replace(/^\s*(\/\/[^\n]*\n\s*)*/, '');
                if (!ifVisiblePat.test(firstStmt.slice(0, 200))) continue;
                const ifIdx = firstStmt.search(ifVisiblePat);
                const braceIdx = firstStmt.indexOf('{', ifIdx);
                if (braceIdx === -1) continue;
                let depth = 1, i = braceIdx + 1;
                while (i < firstStmt.length && depth > 0) {
                    if (firstStmt[i] === '{') depth++;
                    else if (firstStmt[i] === '}') depth--;
                    i++;
                }
                const ifBlockSize = i - braceIdx;
                if (ifBlockSize / trimmed.length > 0.6) {
                    issues.push(`${path.basename(filePath)}: test() 块内用 if(isVisible/isEnabled) 包裹整个逻辑，元素不可见时静默跳过而非失败`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 4c：test() 缺少 expect() 断言检测 ──────────────
    function validateMissingAssertion() {
        const issues = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            for (const block of extractTestBlocks(content)) {
                if (!/\bexpect\s*\(/.test(block.body)) {
                    issues.push(`${path.basename(filePath)}: test(${block.name}) 缺少 expect() 断言，仅验证"没报错"等于没测`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 4d：page.evaluate 绕过 actionability 检测 ───────
    function validateEvaluateBypass() {
        const issues = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const evalPat = /page\.evaluate\s*\(/g;
            let m;
            while ((m = evalPat.exec(content)) !== null) {
                let depth = 1, i = m.index + m[0].length;
                const bodyStart = i;
                while (i < content.length && depth > 0) {
                    if (content[i] === '(') depth++;
                    else if (content[i] === ')') depth--;
                    i++;
                }
                const callBody = content.slice(bodyStart, i - 1);
                if (/\.click\s*\(\s*\)/.test(callBody)) {
                    issues.push(`${path.basename(filePath)}: page.evaluate 中调用了 .click()，绕过 Playwright actionability 检查，会掩盖遮罩等真实问题`);
                    break;
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 4e：test() 缺少 screenshot() 检测 ──────────────
    function validateMissingScreenshot() {
        const issues = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            for (const block of extractTestBlocks(content)) {
                if (!/page\.screenshot\s*\(/.test(block.body)) {
                    issues.push(`${path.basename(filePath)}: test(${block.name}) 结束前缺少 page.screenshot()，截图是验收报告的证据链`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 4f：waitForResponse status === 200 检测 ─────────
    function validateStatusStrictEqual() {
        const issues = [];
        const strictPat = /\.\s*status\s*\(\s*\)\s*===\s*200\b/g;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            strictPat.lastIndex = 0;
            if (strictPat.test(content)) {
                issues.push(`${path.basename(filePath)}: waitForResponse 中用了 .status() === 200，接口可能返回 204 等 2xx 导致监听器永远不触发，改用 >= 200 && < 300`);
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 4g：waitForResponse 硬编码 API 路径检测 ─────────
    function validateHardcodedApiPath() {
        const issues = [];
        const waitForRespPat = /waitForResponse\s*\(\s*(?:async\s*)?\w+\s*=>/g;
        const hardcodedUrlPat = /\.url\s*\(\s*\)\s*\.(?:includes|startsWith|match)\s*\(\s*['"`]\/[a-zA-Z]/;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            waitForRespPat.lastIndex = 0;
            let m;
            while ((m = waitForRespPat.exec(content)) !== null) {
                let depth = 0, i = m.index;
                while (i < content.length && content[i] !== '(') i++;
                depth = 1; i++;
                const bodyStart = i;
                while (i < content.length && depth > 0) {
                    if (content[i] === '(') depth++;
                    else if (content[i] === ')') depth--;
                    i++;
                }
                const callBody = content.slice(bodyStart, i - 1);
                if (hardcodedUrlPat.test(callBody) && !callBody.includes('API_PREFIX') && !callBody.includes('${')) {
                    issues.push(`${path.basename(filePath)}: waitForResponse 中硬编码了 API 路径，API_PREFIX 不同时 URL 匹配不到，改用 \${API_PREFIX} + 具体路径`);
                    break;
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 15：源码引用扫描（禁读 projects/ 源码）───
    function validateSourceCodeReferences() {
        const issues = [];
        const dirs = [
            path.join(testingDir, 'scripts/e2e/tests'),
            path.join(testingDir, 'scripts/api/tests'),
        ];
        const sourceRefPat = /(?:projects\/|\.vue['"`]|\.jsx['"`]|\.tsx['"`])/gi;
        for (const dir of dirs) {
            const files = findFiles(dir, /\.(spec|test)\.ts$/);
            for (const filePath of files) {
                const content = readFileContent(filePath);
                sourceRefPat.lastIndex = 0;
                let match;
                while ((match = sourceRefPat.exec(content)) !== null) {
                    issues.push(`${path.basename(filePath)}: 引用了源码路径 "${match[0]}"，禁止在测试脚本中引用 projects/ 下的源码`);
                }
            }
        }
        return issues;
    }

    // ─── 步骤 17：dom-probe.md 真实性检查 ─────────────────────
    function checkDomProbeAuthenticity() {
        if (scope === 'backend') return { skipped: true, details: ['跳过（scope=backend）'] };
        const probePath = path.join(testingDir, 'dom-probe.md');
        if (!fs.existsSync(probePath)) return { skipped: true, details: ['dom-probe.md 不存在，由文件完整性检查处理'] };
        const content = fs.readFileSync(probePath, 'utf-8');
        const issues = [];
        const tsMatch = content.match(/探测时间[：:]\s*(\S+)/);
        if (tsMatch) {
            const ts = tsMatch[1];
            if (/T\d{2}:00:00\.000Z/.test(ts) || /T\d{2}:30:00\.000Z/.test(ts)) {
                issues.push(`[FAIL] dom-probe.md 探测时间戳为整点（${ts}），疑似 LLM 伪造而非 agent-browser 真实探测`);
            }
        }
        const hasSnapshotEvidence = /snapshot|agent-browser|可交互元素|role=|aria-/i.test(content);
        const isPrdDriven = /交互清单（PRD \+ UI 原型驱动）/.test(content);
        if (isPrdDriven && !hasSnapshotEvidence) {
            issues.push('[FAIL] dom-probe.md 仅包含"交互清单（PRD + UI 原型驱动）"内容，缺少 agent-browser snapshot 运行时数据，疑似未执行真实探测');
        }
        const selectors = [...content.matchAll(/\|\s*(\.[\w-]+(?:\s*[\w:[\]"'=.*>+~]+)*)\s*\|/g)].map(m => m[1].trim());
        if (selectors.length > 3) {
            const allGeneric = selectors.every(s => /^\.el-/.test(s));
            if (allGeneric) {
                issues.push('[WARN] dom-probe.md 中所有选择器均为标准 .el- 前缀，未发现自定义组件选择器。如页面使用了自定义组件（如 SuperTable），请重新执行 agent-browser 探测');
            }
        }
        const passed = issues.filter(i => i.startsWith('[FAIL]')).length === 0;
        return { passed, issues, details: issues.length === 0 ? ['[OK] dom-probe.md 真实性检查通过'] : issues };
    }

    // ─── 步骤 20b: 检测 .el-table 选择器上的 .first()（Element Plus 影子表问题） ──
    function validateElTableFirst() {
        const issues = [];
        const elTableFirstPat = /\.locator\s*\(\s*['"`]([^'"`]*\.el-table[\w-]*)['"`]\s*\)\s*\.first\s*\(/g;
        const selVarFirstPat = /\.locator\s*\(\s*(SEL\.\w+)\s*\)\s*\.first\s*\(/g;
        const elTableSelNames = new Set();
        const selectorsDir = path.join(testingDir, 'scripts/e2e');
        if (fs.existsSync(selectorsDir)) {
            for (const entry of fs.readdirSync(selectorsDir, { withFileTypes: true })) {
                if (entry.isFile() && entry.name.endsWith('.ts') && entry.name.toLowerCase().includes('selector')) {
                    const selContent = fs.readFileSync(path.join(selectorsDir, entry.name), 'utf-8');
                    const selPat = /(\w+)\s*:\s*['"`]([^'"`]*\.el-table[\w-]*)['"`]/g;
                    let sm;
                    while ((sm = selPat.exec(selContent)) !== null) {
                        elTableSelNames.add(sm[1]);
                    }
                }
            }
        }
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            elTableFirstPat.lastIndex = 0;
            let m;
            while ((m = elTableFirstPat.exec(content)) !== null) {
                issues.push(`${fileName}: .el-table 选择器 "${m[1]}" 使用 .first()，Element Plus 固定列场景下第一个是隐藏影子表，必须用 .last() 或 :visible 过滤`);
            }
            if (elTableSelNames.size > 0) {
                selVarFirstPat.lastIndex = 0;
                while ((m = selVarFirstPat.exec(content)) !== null) {
                    const selRef = m[1];
                    const selName = selRef.replace('SEL.', '');
                    if (elTableSelNames.has(selName)) {
                        issues.push(`${fileName}: ${selRef} (值含 .el-table) 使用 .first()，Element Plus 固定列场景下第一个是隐藏影子表，必须用 .last() 或 :visible 过滤`);
                    }
                }
            }
            const bareElTablePat = /\.locator\s*\(\s*['"`]([^'"`]*\.el-table[\w-]*)['"`]\s*\)/g;
            bareElTablePat.lastIndex = 0;
            while ((m = bareElTablePat.exec(content)) !== null) {
                const selector = m[1];
                const afterLocator = content.slice(m.index + m[0].length);
                const hasModifier = /^\s*\.(last|nth|first)\s*\(/.test(afterLocator) ||
                    selector.includes(':visible');
                if (!hasModifier) {
                    issues.push(`${fileName}: .el-table 选择器 "${selector}" 未使用 .last()/:visible/.nth() 修饰，Element Plus 固定列场景下会匹配影子表导致 strict mode violation`);
                }
            }
            if (elTableSelNames.size > 0) {
                const selVarBarePat = /\.locator\s*\(\s*(SEL\.\w+)\s*\)/g;
                selVarBarePat.lastIndex = 0;
                while ((m = selVarBarePat.exec(content)) !== null) {
                    const selRef = m[1];
                    const selName = selRef.replace('SEL.', '');
                    if (elTableSelNames.has(selName)) {
                        const afterLocator = content.slice(m.index + m[0].length);
                        const hasModifier = /^\s*\.(last|nth|first)\s*\(/.test(afterLocator);
                        if (!hasModifier) {
                            issues.push(`${fileName}: ${selRef} (值含 .el-table) 未使用 .last()/.nth() 修饰，Element Plus 固定列场景下会匹配影子表导致 strict mode violation`);
                        }
                    }
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 23：dom-probe.md API 路径记录表缺失检测 ─────────────
    function validateDomProbeApiPaths() {
        if (scope === 'backend') return [];
        const issues = [];
        const probePath = path.join(testingDir, 'dom-probe.md');
        if (!fs.existsSync(probePath)) return issues;
        const content = fs.readFileSync(probePath, 'utf-8');
        if (!/####\s*API\s*路径记录/i.test(content)) {
            issues.push('dom-probe.md 缺少 "#### API 路径记录" 表格——script-writer 写 waitForResponse 路径的唯一权威来源，缺失时会错误使用 api-probe.md 路径导致超时；请重新执行 agent-browser 探测并记录每次交互触发的实际 API 请求');
        }
        return issues;
    }

    // ─── 步骤 24：API 静默跳过检测 ──────────────────────────────
    function validateApiSilentSkip() {
        const issues = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const silentSkipPat = /if\s*\(\s*![\w.]+\s*\)\s*\{?\s*(?:console\.warn\([^)]*\)\s*;?\s*)?return\s*;?\s*\}?/g;
            let match;
            while ((match = silentSkipPat.exec(content)) !== null) {
                issues.push(`${path.basename(filePath)}: 检测到静默跳过模式 "${match[0].trim().slice(0, 60)}"，CI 会误判为 PASS，请替换为 expect(xxx).toBeTruthy()`);
            }
        }
        walkSpecFiles(apiDir, checkFile, /\.api\.test\.ts$/);
        return issues;
    }

    // ─── 步骤 25：API 弱断言检测 ──────────────────────────────
    function validateApiWeakAssertion() {
        const warnings = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            for (const block of extractTestBlocks(content)) {
                const expects = block.body.match(/expect\s*\([^)]*\)\s*\.\s*\w+/g) || [];
                const weakOnly = expects.length > 0 && expects.every(e => /toBeTruthy|toBeDefined/.test(e));
                if (weakOnly && expects.length <= 2) {
                    warnings.push(`${path.basename(filePath)}: test(${block.name}) 仅使用弱断言（toBeTruthy/toBeDefined），建议补充字段级断言`);
                }
            }
        }
        walkSpecFiles(apiDir, checkFile, /\.api\.test\.ts$/);
        return warnings;
    }

    // ─── 步骤 26：API Helper 重复检测 ──────────────────────────
    function validateApiHelperDuplication() {
        const warnings = [];
        const helperPat = /(?:async\s+)?function\s+(post|get|put|del|createClient)\s*\(/;
        const filesWithHelpers = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (helperPat.test(content)) {
                filesWithHelpers.push(path.basename(filePath));
            }
        }
        walkSpecFiles(apiDir, checkFile, /\.api\.test\.ts$/);
        if (filesWithHelpers.length > 1) {
            warnings.push(`${filesWithHelpers.length} 个 API 测试文件包含本地 helper 定义（${filesWithHelpers.slice(0, 5).join(', ')}），建议抽取到 helpers/api-client.ts`);
        }
        return warnings;
    }

    // ─── 步骤 27：E2E mock 清理检测 ──────────────────────────
    function validateMockCleanup() {
        const issues = [];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const routeCalls = content.match(/page\.route\s*\(/g) || [];
            const unrouteCalls = content.match(/page\.unroute\s*\(/g) || [];
            if (routeCalls.length > unrouteCalls.length) {
                issues.push(`${path.basename(filePath)}: ${routeCalls.length} 个 page.route() 但只有 ${unrouteCalls.length} 个 page.unroute()，缺少 mock 清理`);
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 28：waitForResponse 占位符 API 路径检测 ──────────
    function validatePlaceholderApiPath() {
        const issues = [];
        const placeholderPatterns = [
            /\$\{API_PREFIX\}\/list['"`\s)]/,
            /\$\{API_PREFIX\}\/具体接口路径/,
            /\$\{API_PREFIX\}\/xxx/,
            /\$\{API_PREFIX\}\/path['"`\s)]/i,
            /\$\{API_PREFIX\}\/summaryList['"`\s)]/,
        ];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            for (const pat of placeholderPatterns) {
                if (pat.test(content)) {
                    issues.push(`${fileName}: waitForResponse 使用了占位符 API 路径，必须替换为 dom-probe.md "API 路径记录" 表中的实际路径`);
                    break;
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 29：API 脚本硬编码占位值检测 ──────────────────────
    function validateHardcodedDataValues() {
        const issues = [];
        const stubPattern = /(?:get|post|put|del|req)\s*\([^)]*['"`]STUB[^'"`]*['"`]/gi;
        const objStubPattern = /['"`]STUB\d*['"`]\s*[,\s}\])]/gi;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            const stubMatches = content.match(stubPattern) || [];
            const objMatches = content.match(objStubPattern) || [];
            const total = stubMatches.length + objMatches.length;
            if (total > 0) {
                issues.push(`${fileName}: 检测到 ${total} 处硬编码占位值（STUB），关联字段应通过 beforeAll 从列表接口动态获取有效值`);
            }
        }
        walkSpecFiles(apiDir, checkFile, /\.api\.test\.ts$/);
        return issues;
    }

    // ─── 步骤 30：playwright.config.ts 配置完整性检查 ──────────
    function validatePlaywrightConfig() {
        if (scope === 'backend') return [];
        const issues = [];
        const configPath = path.join(testingDir, 'test-config.json');
        const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};
        const tr = config.testingRepo;
        let projectRoot = null;
        if (tr && tr.path) {
            const resolved = tr.path.replace(/\$JLC_AI_WORKSPACE/g, process.env.JLC_AI_WORKSPACE || '');
            projectRoot = resolved;
        }
        const pwConfigCandidates = projectRoot ? [
            path.join(projectRoot, 'playwright.config.ts'),
            path.join(projectRoot, 'features', 'e2e', 'playwright.config.ts'),
        ] : [];
        pwConfigCandidates.push(path.join(testingDir, 'scripts/e2e/playwright.config.ts'));
        let pwConfigPath = null;
        for (const candidate of pwConfigCandidates) {
            if (fs.existsSync(candidate)) {
                pwConfigPath = candidate;
                break;
            }
        }
        if (!pwConfigPath) return [];
        const content = fs.readFileSync(pwConfigPath, 'utf-8');
        if (config.frontend?.baseUrl && !content.includes('baseURL')) {
            issues.push(`playwright.config.ts 缺少 baseURL——test-config.json 配置了 frontend.baseUrl="${config.frontend.baseUrl}"，测试使用相对路径时会全部导航失败（navigation-error）`);
        }
        if (config.auth && !content.includes('storageState')) {
            issues.push('playwright.config.ts 缺少 storageState——有 auth 配置但测试无法复用登录态，所有需要认证的操作会失败');
        }
        if (!content.includes('testDir')) {
            issues.push('playwright.config.ts 缺少 testDir——Playwright 无法定位测试文件');
        }
        if (!content.includes('screenshot')) {
            issues.push('playwright.config.ts 缺少 screenshot 配置——测试失败时无截图，无法诊断问题');
        }
        return issues;
    }

    // ─── 步骤 31：Element Plus 状态断言合理性检查 ──────────────
    function validateStateAssertionQuality() {
        if (scope === 'backend') return [];
        const issues = [];
        const wrongAssertionPatterns = [
            { pattern: /toHaveClass\s*\(\s*\/active\/\s*\)/g, message: '使用了 toHaveClass(/active/)，Element Plus 不使用 .active class。按钮激活应使用 el-button--primary，Tab 应使用 is-active，开关应使用 is-checked' },
            { pattern: /toHaveClass\s*\(\s*['"`]active['"`]\s*\)/g, message: '使用了 toHaveClass("active")，Element Plus 不使用 .active class。参考 element-plus-scripting-rules.md "组件状态断言规则"章节' },
        ];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            for (const { pattern, message } of wrongAssertionPatterns) {
                pattern.lastIndex = 0;
                if (pattern.test(content)) {
                    issues.push(`${fileName}: ${message}`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 32：正常流程 mock 检测（page.route 用于非异常 test） ──
    function validateNormalFlowMock() {
        const issues = [];
        const errorKeywordPat = /error|fail|异常|timeout|500|404|边界|超时|超载|denied|forbidden/i;
        const errorIdPat = /(?:FE|UI)-\w+-E\d{2}/;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            for (const block of extractTestBlocks(content)) {
                if (!/page\.route\s*\(/.test(block.body)) continue;
                const isException = errorKeywordPat.test(block.name) || errorIdPat.test(block.name);
                if (!isException) {
                    issues.push(`${fileName}: test(${block.name}) 正常流程中使用了 page.route() mock，这等于测 mock 而非测系统。仅异常场景允许 mock`);
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 33：E2E 硬编码表单数据检测 ──────────────────────
    function validateHardcodedFormData() {
        const warnings = [];
        const fillPat = /\.(?:fill|type)\s*\(\s*(?:[^,]*,\s*)?['"`]([^'"`]*)['"`]/g;
        const chinesePat = /[一-鿿]/;
        const phonePat = /^\d{11}$/;
        const variablePat = /\$\{|\$\(/;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            let m;
            fillPat.lastIndex = 0;
            while ((m = fillPat.exec(content)) !== null) {
                const value = m[1];
                if (!value || value.length === 0) continue;
                if (variablePat.test(value)) continue;
                if (chinesePat.test(value) || phonePat.test(value)) {
                    // 检查是否在 test() 块内（排除 beforeAll/afterAll）
                    const beforeMatch = content.slice(0, m.index);
                    const lastTestIdx = beforeMatch.lastIndexOf('test(');
                    const lastBeforeAllIdx = beforeMatch.lastIndexOf('beforeAll(');
                    const lastAfterAllIdx = beforeMatch.lastIndexOf('afterAll(');
                    if (lastTestIdx > Math.max(lastBeforeAllIdx, lastAfterAllIdx)) {
                        warnings.push(`${fileName}: 检测到硬编码表单数据 fill/type('${value.slice(0, 20)}')，建议使用前置操作创建的变量`);
                    }
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return warnings;
    }

    // ─── 步骤 34：深度链接检测（page.goto 跳过导航） ──────────
    function validateDeepLink() {
        const issues = [];
        const gotoPat = /page\.goto\s*\(\s*(?:['"`]|`)([^'"`]*)(?:['"`]|`)/g;
        const navKeywordPat = /入口|导航|首页|landing|初始化|setup|beforeEach/i;
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            for (const block of extractTestBlocks(content)) {
                gotoPat.lastIndex = 0;
                let m;
                while ((m = gotoPat.exec(content)) !== null) {
                    // 确认 goto 在当前 test 块范围内
                    const gotoPos = m.index;
                    const blockStart = content.indexOf(block.raw);
                    const blockEnd = blockStart + block.raw.length;
                    if (gotoPos < blockStart || gotoPos > blockEnd) continue;
                    const url = m[1];
                    // 跳过变量引用
                    if (/\$\{|\$\(/.test(url)) continue;
                    // 跳过 hash 路由浅路径（/#/list, /#/）
                    const hashPath = url.match(/#\/([^?]*)/);
                    if (hashPath) {
                        const segments = hashPath[1].split('/').filter(Boolean);
                        if (segments.length <= 1) continue; // /#/ 或 /#/list 浅路径
                    }
                    // 非路由路径（纯域名或根路径）
                    const pathPart = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/#\/?/, '/');
                    const segments = pathPart.split('/').filter(Boolean);
                    if (segments.length <= 1) continue; // 根路径或一级路径
                    if (navKeywordPat.test(block.name)) continue;
                    issues.push(`${fileName}: test(${block.name}) 使用深度链接 page.goto('${url.slice(0, 60)}')，应通过 UI 操作导航到内部页面`);
                    break; // 每个 test 块只报一次
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── 步骤 35：认证注入检测（直接设置 token/cookie） ──────
    function validateAuthInjection() {
        const issues = [];
        const injectionPatterns = [
            { pat: /addCookies\s*\(/g, desc: 'context.addCookies() 直接注入 cookie' },
            { pat: /localStorage\.setItem\s*\(\s*['"`][^'"`]*token/gi, desc: 'localStorage.setItem 设置 token' },
            { pat: /sessionStorage\.setItem\s*\(\s*['"`][^'"`]*token/gi, desc: 'sessionStorage.setItem 设置 token' },
        ];
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            for (const block of extractTestBlocks(content)) {
                for (const { pat, desc } of injectionPatterns) {
                    pat.lastIndex = 0;
                    if (pat.test(block.body)) {
                        issues.push(`${fileName}: test(${block.name}) 使用 ${desc}，认证必须通过 login fixture (storageState) 获取`);
                        break;
                    }
                }
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        walkSpecFiles(apiDir, checkFile, /\.api\.test\.ts$/);
        return issues;
    }

    // ─── 执行所有 semantic 检查 ───────────────────────────────
    const isBackend = scope === 'backend';
    const isFrontend = scope === 'frontend';
    const skipResult = [];

    const catchSwallowIssues = isBackend ? skipResult : validateCatchSwallow();
    const conditionalSkipIssues = isBackend ? skipResult : validateConditionalSkip();
    const missingAssertionIssues = isBackend ? skipResult : validateMissingAssertion();
    const evaluateBypassIssues = isBackend ? skipResult : validateEvaluateBypass();
    const missingScreenshotIssues = isBackend ? skipResult : validateMissingScreenshot();
    const statusStrictEqualIssues = isBackend ? skipResult : validateStatusStrictEqual();
    const hardcodedApiPathIssues = isBackend ? skipResult : validateHardcodedApiPath();
    const sourceRefIssues = validateSourceCodeReferences();
    const domProbeAuthenticity = checkDomProbeAuthenticity();
    const elTableFirstIssues = isBackend ? skipResult : validateElTableFirst();
    const domProbeApiPathsIssues = validateDomProbeApiPaths();
    const apiSilentSkipIssues = isFrontend ? skipResult : validateApiSilentSkip();
    const apiWeakAssertionWarnings = isFrontend ? skipResult : validateApiWeakAssertion();
    const apiHelperDuplicationWarnings = isFrontend ? skipResult : validateApiHelperDuplication();
    const mockCleanupIssues = isBackend ? skipResult : validateMockCleanup();
    const placeholderApiPathIssues = isBackend ? skipResult : validatePlaceholderApiPath();
    const hardcodedDataIssues = isFrontend ? skipResult : validateHardcodedDataValues();
    const playwrightConfigIssues = validatePlaywrightConfig();
    const stateAssertionIssues = validateStateAssertionQuality();
    const normalFlowMockIssues = isBackend ? skipResult : validateNormalFlowMock();
    const hardcodedFormWarnings = isBackend ? skipResult : validateHardcodedFormData();
    const deepLinkIssues = isBackend ? skipResult : validateDeepLink();
    const authInjectionIssues = validateAuthInjection();

    return {
        catchSwallow: { name: 'catch 吞错误检测', passed: catchSwallowIssues.length === 0, issues: catchSwallowIssues },
        conditionalSkip: { name: '条件跳过整个 test 检测', passed: conditionalSkipIssues.length === 0, issues: conditionalSkipIssues },
        missingAssertion: { name: 'test() 缺少 expect() 检测', passed: missingAssertionIssues.length === 0, issues: missingAssertionIssues },
        evaluateBypass: { name: 'evaluate 绕过 actionability 检测', passed: evaluateBypassIssues.length === 0, issues: evaluateBypassIssues },
        missingScreenshot: { name: 'test() 缺少 screenshot() 检测', passed: missingScreenshotIssues.length === 0, issues: missingScreenshotIssues },
        statusStrictEqual: { name: 'waitForResponse status===200 检测', passed: statusStrictEqualIssues.length === 0, issues: statusStrictEqualIssues },
        hardcodedApiPath: { name: 'waitForResponse 硬编码路径检测', passed: hardcodedApiPathIssues.length === 0, issues: hardcodedApiPathIssues },
        sourceCodeReferences: {
            name: '源码引用扫描',
            passed: sourceRefIssues.length === 0,
            issues: sourceRefIssues,
        },
        domProbeAuthenticity: {
            name: 'dom-probe.md 真实性检查',
            skipped: domProbeAuthenticity.skipped || false,
            passed: domProbeAuthenticity.skipped || domProbeAuthenticity.passed,
            details: domProbeAuthenticity.details,
            issues: domProbeAuthenticity.issues || [],
        },
        elTableFirst: {
            name: '.el-table .first() 影子表检测',
            passed: elTableFirstIssues.length === 0,
            issues: elTableFirstIssues,
        },
        domProbeApiPaths: {
            name: 'dom-probe.md API 路径记录表检测',
            passed: domProbeApiPathsIssues.length === 0,
            issues: domProbeApiPathsIssues,
        },
        apiSilentSkip: {
            name: 'API 静默跳过检测',
            passed: apiSilentSkipIssues.length === 0,
            issues: apiSilentSkipIssues,
        },
        apiWeakAssertion: {
            name: 'API 弱断言检测',
            passed: true, // WARN 级别，不阻塞门禁
            warnings: apiWeakAssertionWarnings,
        },
        apiHelperDuplication: {
            name: 'API Helper 重复检测',
            passed: true, // WARN 级别，不阻塞门禁
            warnings: apiHelperDuplicationWarnings,
        },
        mockCleanup: {
            name: 'E2E mock 清理检测',
            passed: mockCleanupIssues.length === 0,
            issues: mockCleanupIssues,
        },
        placeholderApiPath: {
            name: 'waitForResponse 占位符 API 路径检测',
            passed: placeholderApiPathIssues.length === 0,
            issues: placeholderApiPathIssues,
        },
        hardcodedDataValues: {
            name: 'API 脚本硬编码占位值检测',
            passed: hardcodedDataIssues.length === 0,
            issues: hardcodedDataIssues,
        },
        playwrightConfig: {
            name: 'playwright.config.ts 配置完整性检查',
            passed: playwrightConfigIssues.length === 0,
            issues: playwrightConfigIssues,
        },
        stateAssertion: {
            name: 'Element Plus 状态断言合理性检查',
            passed: stateAssertionIssues.length === 0,
            issues: stateAssertionIssues,
        },
        normalFlowMock: {
            name: '正常流程 mock 检测',
            passed: normalFlowMockIssues.length === 0,
            issues: normalFlowMockIssues,
        },
        hardcodedFormData: {
            name: 'E2E 硬编码表单数据检测',
            passed: true, // WARN 级别，不阻塞门禁
            warnings: hardcodedFormWarnings,
        },
        deepLink: {
            name: '深度链接检测',
            passed: deepLinkIssues.length === 0,
            issues: deepLinkIssues,
        },
        authInjection: {
            name: '认证注入检测',
            passed: authInjectionIssues.length === 0,
            issues: authInjectionIssues,
        },
    };
};
