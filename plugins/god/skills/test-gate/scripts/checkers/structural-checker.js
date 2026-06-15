#!/usr/bin/env node
"use strict";
/**
 * structural-checker.js
 * 文件完整性（步骤 1）、TC 编号比对（步骤 2）、场景类型覆盖（步骤 3）、
 * API 配置校验（步骤 5）、路径规范（步骤 7）、import 来源（步骤 8）。
 */
const fs = require("fs");
const path = require("path");
const { findFiles, readFileContent, extractTcIds, walkSpecFiles } = require("./shared-utils");

/**
 * @param {string} testingDir
 * @param {string} scope
 * @param {object} sharedUtils
 * @param {object} options
 * @returns {object}
 */
module.exports = function checkStructural(testingDir, scope, sharedUtils, options) {
    // ─── 步骤 1：文件完整性 ─────────────────────────────────
    function checkFileIntegrity() {
        const required = [
            { file: 'test-plan/test-plan.md', condition: 'always', hint: '所有 scope 必需，由 gen-test 生成' },
        ];
        const optional = [];
        if (scope !== 'backend') {
            required.push({ file: 'dom-probe.md', condition: 'frontend' }, { file: 'test-cases/e2e-test-cases.md', condition: 'frontend' });
            const legacyPwConfig = path.join(testingDir, 'scripts/e2e/playwright.config.ts');
            if (fs.existsSync(legacyPwConfig)) {
                required.push({ file: 'scripts/e2e/playwright.config.ts', condition: 'frontend' });
            }
        }
        if (scope !== 'frontend') {
            required.push({ file: 'api-probe.md', condition: 'backend' });
            required.push({ file: 'test-cases/api-flow-test-cases.md', condition: 'backend', hint: 'API 流程案例文档，由 gen-test 生成' });
            optional.push({ file: 'test-cases/api-test-cases.md', condition: 'backend', hint: '单接口 API 案例由 backend-test 生成' });
        }
        const details = [];
        let allPassed = true;
        for (const { file, hint } of required) {
            const fullPath = path.join(testingDir, file);
            if (!fs.existsSync(fullPath)) {
                details.push(`[FAIL] 缺失: ${file}${hint ? '（' + hint + '）' : ''}`);
                allPassed = false;
            }
            else {
                const stat = fs.statSync(fullPath);
                if (stat.size === 0) {
                    details.push(`[FAIL] 空文件: ${file}`);
                    allPassed = false;
                }
                else {
                    const content = fs.readFileSync(fullPath, 'utf-8').trim();
                    const nonEmptyLines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
                    if (nonEmptyLines.length <= 1 && /^#\s/.test(content)) {
                        details.push(`[FAIL] 占位文件: ${file}（仅含标题行，无实际内容）`);
                        allPassed = false;
                    }
                    else {
                        details.push(`[OK] ${file}`);
                    }
                }
            }
        }
        for (const { file, hint } of optional) {
            const fullPath = path.join(testingDir, file);
            if (!fs.existsSync(fullPath)) {
                details.push(`[WARN] 缺失: ${file}${hint ? '（' + hint + '）' : ''}`);
            }
            else {
                const stat = fs.statSync(fullPath);
                if (stat.size === 0) {
                    details.push(`[WARN] 空文件: ${file}`);
                }
                else {
                    details.push(`[OK] ${file}`);
                }
            }
        }
        if (scope !== 'backend') {
            const specFiles = findFiles(path.join(testingDir, 'scripts/e2e/tests'), /\.spec\.ts$/);
            if (specFiles.length === 0) {
                details.push('[FAIL] scripts/e2e/tests/ 下无 .spec.ts 文件');
                allPassed = false;
            }
            else {
                details.push(`[OK] ${specFiles.length} 个 E2E 脚本文件`);
            }
        }
        if (scope !== 'frontend') {
            const testFiles = findFiles(path.join(testingDir, 'scripts/api/tests'), /\.api\.test\.ts$/);
            if (testFiles.length === 0) {
                details.push('[WARN] scripts/api/tests/ 下无 .api.test.ts 文件（由 gen-test（backend-test skill） 生成，不阻塞）');
            }
            else {
                details.push(`[OK] ${testFiles.length} 个 API 脚本文件`);
            }
        }
        return { passed: allPassed, details };
    }

    // ─── 步骤 2：TC 编号比对 ─────────────────────────────────
    function checkTcCoverage() {
        const details = [];
        const allMissing = [];
        let e2eRate = 'N/A';
        let apiRate = 'N/A';
        const tcPattern = /\b((?:FE|API)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)\b/g;
        if (scope !== 'backend') {
            const casesContent = readFileContent(path.join(testingDir, 'test-cases/e2e-test-cases.md'));
            const caseIds = extractTcIds(casesContent, new RegExp(tcPattern.source, 'g'));
            const specFiles = findFiles(path.join(testingDir, 'scripts/e2e/tests'), /\.spec\.ts$/);
            const scriptContent = specFiles.map(f => readFileContent(f)).join('\n');
            const scriptIds = extractTcIds(scriptContent, new RegExp(tcPattern.source, 'g'));
            const missing = caseIds.filter(id => id.startsWith('FE-') && !scriptIds.includes(id));
            allMissing.push(...missing);
            const covered = caseIds.filter(id => id.startsWith('FE-')).length - missing.length;
            const total = caseIds.filter(id => id.startsWith('FE-')).length;
            e2eRate = total > 0 ? `${Math.round((covered / total) * 100)}%` : 'N/A';
            if (missing.length > 0) {
                details.push(`[FAIL] E2E 缺失 ${missing.length} 个 TC: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
            }
            else {
                details.push(`[OK] E2E TC 覆盖率 100% (${total} 个)`);
            }
        }
        if (scope !== 'frontend') {
            apiRate = 'N/A（由 backend-test 负责）';
            details.push('[INFO] 单接口 API TC 覆盖率跳过（由 gen-test（backend-test skill） 生成，不在此处检查）');
        }
        return { passed: allMissing.length === 0, details, missing: allMissing, e2eRate, apiRate };
    }

    // ─── 步骤 3：场景类型覆盖 ──────────────────────────────────
    function checkScenarioTypes() {
        const keywords = {
            '正常流程': /正常|happy.?path|成功|正确/i,
            '异常流程': /异常|错误|失败|error|fail/i,
            '边界值': /边界|最大|最小|空值|空字符|boundary|max|min/i,
            '表单验证': /表单|必填|格式|校验|验证|required|valid/i,
            '交互状态': /加载|分页|排序|筛选|loading|pagination/i,
        };
        const details = [];
        let allPassed = true;
        const casesFiles = [];
        if (scope !== 'backend')
            casesFiles.push(path.join(testingDir, 'test-cases/e2e-test-cases.md'));
        if (scope !== 'frontend') {
            casesFiles.push(path.join(testingDir, 'test-cases/api-flow-test-cases.md'));
            const singleApiCases = path.join(testingDir, 'test-cases/api-test-cases.md');
            if (fs.existsSync(singleApiCases)) casesFiles.push(singleApiCases);
        }
        const allContent = casesFiles.map(f => readFileContent(f)).join('\n');
        for (const [type, regex] of Object.entries(keywords)) {
            if (regex.test(allContent)) {
                details.push(`[OK] ${type}`);
            }
            else {
                details.push(`[FAIL] 缺少 ${type} 场景`);
                allPassed = false;
            }
        }
        return { passed: allPassed, details };
    }

    // ─── 步骤 5：API 配置校验 ──────────────────────────────────
    function checkApiConfig() {
        const details = [];
        let allPassed = true;
        const testFiles = findFiles(path.join(testingDir, 'scripts/api/tests'), /\.api\.test\.ts$/);
        for (const file of testFiles) {
            const content = readFileContent(file);
            const fileName = path.relative(testingDir, file);
            const hardcodedUrl = /['"`](https?:\/\/localhost[^'"`]*|https?:\/\/\d+\.\d+\.\d+\.\d+[^'"`]*)['"`]/g;
            const matches = content.match(hardcodedUrl);
            if (matches) {
                const realHardcoded = matches.filter(m => {
                    const idx = content.indexOf(m);
                    const before = content.substring(Math.max(0, idx - 50), idx);
                    return !before.includes('process.env') && !before.includes('||');
                });
                if (realHardcoded.length > 0) {
                    details.push(`[FAIL] ${fileName}: 硬编码 URL: ${realHardcoded[0]}`);
                    allPassed = false;
                }
            }
            const usesEnvVar = content.includes('BASE_URL') || content.includes('API_BASE_URL') || content.includes('process.env');
            const usesHelper = content.includes('import') && (content.includes('helpers/') || content.includes('helper') || content.includes('apiRequest') || content.includes('request'));
            if (!usesEnvVar && !usesHelper) {
                details.push(`[FAIL] ${fileName}: 未使用环境变量引用 BASE_URL（直接或通过 helper）`);
                allPassed = false;
            }
            const apiPrefixMisusePatterns = [
                /(?:get|post|put|del)\s*\(\s*[`'"]\s*\$\{API_PREFIX\}/,
                /(?:get|post|put|del)\s*\(\s*[`'"][^'"`]*API_PREFIX/,
            ];
            for (const pattern of apiPrefixMisusePatterns) {
                if (pattern.test(content)) {
                    details.push(`[FAIL] ${fileName}: API 测试脚本误用了 API_PREFIX，会导致路径重复。API 测试应使用相对路径：get('/path') 而非 get(\`\${API_PREFIX}/path\`)`);
                    allPassed = false;
                    break;
                }
            }
        }
        if (allPassed && testFiles.length > 0) {
            details.push(`[OK] ${testFiles.length} 个 API 脚本配置校验通过`);
        }
        return { passed: allPassed, details };
    }

    // ─── 步骤 7：路径规范校验 ──────────────────────────────────
    function validatePathConventions() {
        const warnings = [];
        const e2eDir = path.join(testingDir, 'scripts/e2e/tests');
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.includes('__dirname')) {
                warnings.push(`${path.basename(filePath)}: 使用了 __dirname，应改用 process.env.WORK_DIR`);
            }
            const absPathPat = /[A-Z]:\\[^\s'")\]]+|\/home\/[^\s'")\]]+|\/Users\/[^\s'")\]]+/;
            if (absPathPat.test(content)) {
                warnings.push(`${path.basename(filePath)}: 包含硬编码绝对路径`);
            }
            if (/waitForTimeout\s*\(/.test(content)) {
                warnings.push(`${path.basename(filePath)}: 使用了 waitForTimeout，应改用 waitForResponse/expect 等确定性等待`);
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return warnings;
    }

    // ─── 步骤 8：import 来源校验 ───────────────────────────────
    function validateImportSource() {
        const issues = [];
        const e2eDir = path.join(testingDir, 'scripts/e2e/tests');
        function checkFile(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (/import\s+\{[^}]*\btest\b[^}]*\}\s+from\s+['"]@playwright\/test['"]/.test(content)) {
                issues.push(`${path.basename(filePath)}: 应从 '../fixtures' 导入 test，而非 '@playwright/test'`);
            }
        }
        walkSpecFiles(e2eDir, checkFile);
        return issues;
    }

    // ─── scriptFile 一致性校验（原 test-scripting/references/script-file-consistency.md）──
    function checkScriptFileConsistency() {
        const issues = [];
        if (scope === 'backend') return { passed: true, details: ['跳过（scope 不含前端）'] };
        const casesContent = readFileContent(path.join(testingDir, 'test-cases/e2e-test-cases.md'));
        if (!casesContent) return { passed: true, details: ['跳过（e2e-test-cases.md 不存在）'] };
        const lines = casesContent.split('\n').filter(l => l.includes('scriptFile') && l.includes('.spec.ts'));
        const files = new Set(lines.map(l => l.match(/[\w-]+\.spec\.ts/)?.[0]).filter(Boolean));
        if (files.size === 1 && lines.length > 1) {
            issues.push(`所有 scriptFile 指向同一文件: ${[...files][0]} — 疑似全局替换错误`);
        }
        return {
            passed: issues.length === 0,
            details: issues.length > 0 ? issues : [`scriptFile 引用多样，共 ${files.size} 个不同脚本文件`],
        };
    }

    // ─── 执行所有 structural 检查 ───────────────────────────────
    const fileIntegrity = checkFileIntegrity();
    const tcCoverage = checkTcCoverage();
    const scenarioTypes = checkScenarioTypes();
    const apiConfig = scope !== 'frontend' ? checkApiConfig() : { passed: true, details: ['跳过（scope 不含后端）'] };
    const pathWarnings = scope !== 'backend' ? validatePathConventions() : [];
    const importIssues = scope !== 'backend' ? validateImportSource() : [];
    const scriptFileConsistency = checkScriptFileConsistency();

    return {
        fileIntegrity,
        tcCoverage,
        scenarioTypes,
        apiConfig,
        pathConventions: {
            name: '路径规范校验',
            passed: pathWarnings.length === 0,
            warnings: pathWarnings,
        },
        importSource: {
            name: 'import 来源校验',
            passed: importIssues.length === 0,
            issues: importIssues,
        },
        scriptFileConsistency,
    };
};
