#!/usr/bin/env node
"use strict";
/**
 * coverage-checker.js
 * 案例设计质量前置检查（步骤 0）、AC 注释覆盖验证（步骤 16）、
 * 选择器集中度检查（步骤 18）、@smoke 覆盖率检查（步骤 19）。
 */
const fs = require("fs");
const path = require("path");
const { findFiles, readFileContent } = require("./shared-utils");

/**
 * @param {string} testingDir
 * @param {string} scope
 * @param {object} sharedUtils
 * @param {object} options - { acAssignmentPath, loadAcAssignment }
 * @returns {object}
 */
module.exports = function checkCoverage(testingDir, scope, sharedUtils, options) {
    const { loadAcAssignment } = options;

    // ─── 步骤 0：案例设计质量前置检查 ──────────────────────────
    function checkCoverageMode() {
        const cacheDir = path.join(testingDir, '.cache');
        const typedFiles = ['e2e', 'api', 'flow'].map(t => path.join(cacheDir, `${t}-case-design-summary.json`)).filter(p => fs.existsSync(p));
        const legacyPath = path.join(cacheDir, 'case-design-summary.json');
        const summaryPaths = typedFiles.length > 0 ? typedFiles : (fs.existsSync(legacyPath) ? [legacyPath] : []);
        if (summaryPaths.length === 0) {
            return { skipped: true, details: ['[INFO] case-design-summary.json 不存在，跳过步骤 0（降级场景兼容）'] };
        }
        const details = [];
        const warnings = [];
        let mergedFeatureCoverage = {};
        let coverageMode = null;
        for (const summaryPath of summaryPaths) {
            let summary;
            try {
                summary = JSON.parse(readFileContent(summaryPath));
            } catch (e) {
                return { skipped: false, passed: false, details: [`[FAIL] ${path.basename(summaryPath)} 解析失败: ${e.message}`] };
            }
            if (summary.featureCoverage) Object.assign(mergedFeatureCoverage, summary.featureCoverage);
            if (summary.coverageMode && !coverageMode) coverageMode = summary.coverageMode;
        }
        const summary = { featureCoverage: mergedFeatureCoverage, coverageMode };
        if (!summary.featureCoverage || Object.keys(summary.featureCoverage).length === 0) {
            warnings.push('featureCoverage 字段为空');
            details.push('[WARN] case-design-summary.json 的 featureCoverage 字段为空');
        } else {
            details.push('[OK] featureCoverage 字段非空');
        }
        const validModes = ['ac-driven', 'feature-driven'];
        if (!summary.coverageMode) {
            warnings.push('coverageMode 字段缺失');
            details.push('[WARN] coverageMode 字段缺失（不阻塞）');
        } else if (!validModes.includes(summary.coverageMode)) {
            warnings.push(`coverageMode 值无效: "${summary.coverageMode}"`);
            details.push(`[WARN] coverageMode 值无效: "${summary.coverageMode}"，期望 "ac-driven" 或 "feature-driven"（不阻塞）`);
        } else {
            details.push(`[OK] coverageMode: ${summary.coverageMode}`);
        }
        return { skipped: false, warnings, details };
    }

    // ─── 步骤 16：AC 注释覆盖验证 ──────────────────────────────
    function checkAcAnnotationCoverage() {
        const acAssignmentPath = options.acAssignmentPath;
        const workDir = path.dirname(path.resolve(testingDir));
        const acCandidates = [
            path.join(workDir, 'design', 'ac.md'),
            path.join(workDir, 'requirement', 'ac.md'),
        ];
        const acFile = acCandidates.find(p => fs.existsSync(p));
        if (!acFile) return { skipped: false, passed: false, details: ['[FAIL] ac.md 不存在，AC 注释覆盖验证无法执行（ac.md 是 AC 覆盖率 100% 保障的前提）'] };

        const caseFiles = [
            path.join(testingDir, 'test-cases/e2e-test-cases.md'),
            path.join(testingDir, 'test-cases/api-flow-test-cases.md'),
            path.join(testingDir, 'test-cases/api-test-cases.md'),
        ];
        const existingCaseFiles = caseFiles.filter(f => fs.existsSync(f));
        const caseTcToAc = {};
        for (const cf of existingCaseFiles) {
            const content = fs.readFileSync(cf, 'utf-8');
            const blocks = content.split(/(?=###\s+(?:FE|API|FLOW)-)/);
            for (const block of blocks) {
                const tcMatch = block.match(/(?:###\s+|用例ID\s*[|｜]\s*)((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/);
                const coverMatch = block.match(/覆盖\s*AC\s*(?:[:：]|[|｜])\s*([\w\-.\s,，;；（()）]+)/i);
                if (tcMatch && coverMatch) {
                    const acIds = coverMatch[1].split(/[,，;；\s]+/)
                        .map(id => id.trim().replace(/[（(].*$/, ''))
                        .filter(id => id && /^(AC|UI)-/.test(id));
                    if (acIds.length > 0) caseTcToAc[tcMatch[1]] = acIds;
                }
            }
        }

        if (existingCaseFiles.length > 0 && Object.keys(caseTcToAc).length === 0) {
            return {
                skipped: false, passed: false,
                totalAcInCases: 0, totalAcInScripts: 0, coveredCount: 0, missingCount: 0, uncoveredCount: 0,
                details: ['[FAIL] 案例文档中未找到任何 AC-/UI- 格式的"覆盖AC"注释，请确认格式为 覆盖AC: AC-XXX 或 UI-XXX（gate-check 步骤 16 依赖此格式）'],
                missingAnnotations: [], uncoveredAcInScripts: [],
            };
        }

        const scriptDirs = [
            path.join(testingDir, 'scripts/e2e/tests'),
            path.join(testingDir, 'scripts/flow'),
            path.join(testingDir, 'scripts/api/tests'),
        ];
        const scriptTcToAc = {};
        for (const dir of scriptDirs) {
            const files = findFiles(dir, /\.(spec|test)\.ts$/);
            for (const f of files) {
                const content = readFileContent(f);
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const acMatch = lines[i].match(/\/\/\s*覆盖\s*AC\s*[:：]\s*(.+)/);
                    if (!acMatch) continue;
                    const acListRaw = acMatch[1];
                    for (let j = i + 1; j < Math.min(i + 31, lines.length); j++) {
                        const testMatch = lines[j].match(/test(?:\.skip)?\s*\(\s*['"`]([^'"`]+)/);
                        if (testMatch) {
                            const tcId = testMatch[1].match(/((?:FE|API|FLOW)-[A-Z]+-\d{3}(?:-\d{2})?(?:-[EB]\d{2})?)/);
                            const acIds = acListRaw.split(/[,，\s]+/)
                                .map(id => id.trim().replace(/[（(].*$/, ''))
                                .filter(id => /^(AC|UI)-/.test(id));
                            if (tcId && acIds.length > 0) scriptTcToAc[tcId[1]] = acIds;
                            break;
                        }
                        if (lines[j].match(/\/\/\s*覆盖\s*AC/)) break;
                    }
                }
            }
        }

        const assignmentData = loadAcAssignment(acAssignmentPath);
        const excludedAcSet = new Set();
        if (assignmentData) {
            (assignmentData.assignment.excluded.ids || []).forEach(id => excludedAcSet.add(id));
        }

        const details = [];
        const missingAnnotations = [];
        const allCaseAcIds = new Set();
        const allScriptAcIds = new Set();

        for (const [tc, acIds] of Object.entries(caseTcToAc)) {
            const filteredAcIds = acIds.filter(id => !excludedAcSet.has(id));
            filteredAcIds.forEach(id => allCaseAcIds.add(id));
            const scriptAcIds = scriptTcToAc[tc] || [];
            scriptAcIds.forEach(id => allScriptAcIds.add(id));
            const missing = filteredAcIds.filter(id => !scriptAcIds.includes(id));
            if (missing.length > 0) {
                missingAnnotations.push({ tc, missingAc: missing });
            }
        }

        const uncoveredAcInScripts = [...allCaseAcIds].filter(id => !allScriptAcIds.has(id));

        if (missingAnnotations.length > 0) {
            details.push(`[FAIL] ${missingAnnotations.length} 个 TC 的脚本缺少 AC 注释:`);
            for (const { tc, missingAc } of missingAnnotations.slice(0, 10)) {
                details.push(`  - ${tc}: 缺少 ${missingAc.join(', ')}`);
            }
        }
        if (uncoveredAcInScripts.length > 0) {
            details.push(`[FAIL] ${uncoveredAcInScripts.length} 个 AC 编号在脚本注释中未出现: ${uncoveredAcInScripts.slice(0, 10).join(', ')}`);
        }
        if (missingAnnotations.length === 0 && uncoveredAcInScripts.length === 0) {
            details.push(`[OK] 脚本 AC 注释覆盖完整（案例声明 ${allCaseAcIds.size} 个 AC，脚本注释 ${allScriptAcIds.size} 个 AC）`);
        }

        return {
            skipped: false,
            passed: missingAnnotations.length === 0 && uncoveredAcInScripts.length === 0,
            totalAcInCases: allCaseAcIds.size,
            totalAcInScripts: allScriptAcIds.size,
            coveredCount: allCaseAcIds.size - uncoveredAcInScripts.length,
            missingCount: missingAnnotations.length,
            uncoveredCount: uncoveredAcInScripts.length,
            details,
            missingAnnotations: missingAnnotations.slice(0, 20),
            uncoveredAcInScripts,
        };
    }

    // ─── 步骤 18：选择器集中度检查 ──────────────────────────────
    function validateSelectorCentralization() {
        const result = { passed: true, rate: 0, total: 0, hardcoded: 0, issues: [], threshold: 5 };
        const phase2Dirs = ['features', 'flows'].map(d => path.join(testingDir, '..', d)).filter(d => fs.existsSync(d));
        if (phase2Dirs.length === 0) {
            return { ...result, skipped: true, skipReason: 'Phase 2 目录结构不存在（features/ 或 flows/），跳过选择器集中度检查' };
        }
        const specFiles = [];
        for (const dir of phase2Dirs) {
            specFiles.push(...findFiles(dir, /\.spec\.ts$/));
        }
        if (specFiles.length === 0) return { ...result, skipped: true };

        const semanticSelectorPattern = /(?:getByRole|getByLabel|getByPlaceholder|getByText)\s*\(/g;
        const importSelectorPattern = /import\s*\{[^}]*\}\s*from\s*['"][^'"]*selectors[^'"]*['"]/;

        for (const file of specFiles) {
            const content = readFileContent(file);
            if (!content) continue;
            const hasSelectorsImport = importSelectorPattern.test(content);
            const matches = content.match(semanticSelectorPattern) || [];
            result.total += matches.length;
            if (!hasSelectorsImport && matches.length > 0) {
                result.hardcoded += matches.length;
                result.issues.push({
                    file: path.relative(testingDir, file),
                    count: matches.length,
                    message: `${matches.length} 个语义选择器未通过 selectors/ 模块引入`,
                });
            }
        }
        if (result.total > 0) {
            result.rate = Math.round((result.hardcoded / result.total) * 100);
            result.passed = result.rate <= result.threshold;
        }
        return result;
    }

    // ─── 步骤 19：@smoke 覆盖率检查 ──────────────────────────────
    function validateSmokeCoverage() {
        const result = { passed: true, issues: [], skipped: false };
        const possiblePaths = [
            path.join(testingDir, '..', 'feature-tree', 'index.json'),
            path.join(testingDir, '..', '..', 'feature-tree', 'index.json'),
        ];
        let indexPath = possiblePaths.find(p => fs.existsSync(p));
        if (!indexPath) {
            return { ...result, skipped: true, message: 'feature-tree/index.json not found' };
        }
        let index;
        try { index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')); } catch (e) {
            return { ...result, skipped: true, message: 'feature-tree/index.json parse error' };
        }
        const smokeFeatures = new Set(index.smokeFeatures || []);
        if (smokeFeatures.size === 0) {
            result.issues.push({ message: '功能树中未标记任何 @smoke 功能' });
            result.passed = false;
            return result;
        }
        for (const [pageId, page] of Object.entries(index.pages || {})) {
            const pageFeatures = [];
            for (const group of Object.values(page.groups || {})) {
                pageFeatures.push(...(group.features || []));
            }
            const hasSmoke = pageFeatures.some(f => smokeFeatures.has(f));
            if (!hasSmoke) {
                result.issues.push({ page: pageId, message: `页面 ${pageId} 缺少 @smoke 冒烟用例` });
            }
        }
        for (const flowId of Object.keys(index.flows || {})) {
            if (!smokeFeatures.has(flowId)) {
                result.issues.push({ flow: flowId, message: `流程 ${flowId} 缺少 @smoke 标记` });
            }
        }
        result.passed = true; // smoke coverage is advisory
        return result;
    }

    // ─── 执行所有 coverage 检查 ───────────────────────────────────
    const coverageMode = checkCoverageMode();
    const acAnnotation = checkAcAnnotationCoverage();
    const selectorCentralization = scope !== 'backend' ? validateSelectorCentralization() : { passed: true, skipped: true };
    const smokeCoverage = validateSmokeCoverage();

    return {
        coverageMode,
        acAnnotation,
        selectorCentralization,
        smokeCoverage,
    };
};
