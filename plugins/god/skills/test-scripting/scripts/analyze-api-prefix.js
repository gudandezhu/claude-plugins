#!/usr/bin/env node
"use strict";
/**
 * analyze-api-prefix.js
 * 从 dom-probe.md 中提取 API 路径，分析公共前缀，验证 apiPrefix 配置正确性
 *
 * 用法：
 *   node analyze-api-prefix.js --dom-probe testing/.cache/dom-probe.md --config testing/test-config.json
 *
 * 输出 JSON：
 *   { status, configuredPrefix, detectedPrefix, isConsistent, analysis, suggestedAction }
 */
const fs = require('fs');
const path = require('path');

function parseArgs() {
    const argv = process.argv.slice(2);
    let domProbePath = '';
    let configPath = '';
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--dom-probe' && argv[i + 1]) domProbePath = argv[++i];
        if (argv[i] === '--config' && argv[i + 1]) configPath = argv[++i];
    }
    return { domProbePath, configPath };
}

/**
 * 从 dom-probe.md 提取 API 路径
 * 匹配格式：| 序号 | 描述 | `/api/xxx` | 或 | 序号 | 描述 | `GET /api/xxx` |
 */
function extractApiPaths(domProbeContent) {
    const paths = [];
    
    // 匹配 API 路径记录章节中的表格
    // 格式1: | 序号 | 描述 | `/api/path` |
    // 格式2: | 序号 | 描述 | `GET /api/path` |
    // 格式3: | 序号 | 接口 | 路径 | ... 多列格式
    const lines = domProbeContent.split('\n');
    let inApiSection = false;
    
    for (const line of lines) {
        // 检测 API 路径记录章节开始
        if (/#{2,4}\s*API\s*路径记录/i.test(line) || /#{2,4}\s*接口路径/i.test(line)) {
            inApiSection = true;
            continue;
        }
        // 检测新章节开始，退出当前章节
        if (/^#{2,4}\s/.test(line) && !/API\s*路径/i.test(line)) {
            inApiSection = false;
            continue;
        }
        
        if (!inApiSection) continue;
        
        // 提取反引号中的路径
        const backtickMatches = line.match(/`([^`]+)`/g);
        if (backtickMatches) {
            for (const match of backtickMatches) {
                const content = match.slice(1, -1).trim();
                // 可能是纯路径 /api/xxx 或带方法的 GET /api/xxx
                const pathMatch = content.match(/^(?:GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)$/i);
                if (pathMatch) {
                    paths.push(pathMatch[1]);
                } else if (/^\/[\w\-./]+$/.test(content)) {
                    paths.push(content);
                }
            }
        }
    }
    
    // 去重
    return [...new Set(paths)];
}

/**
 * 分析公共前缀
 */
function analyzeCommonPrefix(paths) {
    if (paths.length === 0) return { prefixes: [], recommendation: null };
    
    // 按路径段分析
    const segments = paths.map(p => p.split('/').filter(Boolean));
    const prefixCounts = {};
    
    for (const segs of segments) {
        // 收集所有可能的前缀组合（1-4 段）
        for (let len = 1; len <= Math.min(4, segs.length); len++) {
            const prefix = '/' + segs.slice(0, len).join('/');
            prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
        }
    }
    
    // 按出现频率排序，找到最常见的公共前缀
    const sorted = Object.entries(prefixCounts)
        .sort((a, b) => {
            // 先按出现次数排序，次数相同按长度排序（更短优先）
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].length - b[0].length;
        })
        .filter(([_, count]) => count >= paths.length * 0.6); // 至少 60% 的路径包含
    
    return {
        prefixes: sorted.map(([prefix, count]) => ({
            prefix,
            count,
            percentage: Math.round(count / paths.length * 100)
        })),
        recommendation: sorted[0]?.[0] || null
    };
}

/**
 * 检测前端代理场景（基本版，2 段前缀分析）
 */
function detectProxyScenario(paths) {
    const firstSegments = paths.map(p => {
        const segs = p.split('/').filter(Boolean);
        return segs.length >= 2 ? '/' + segs.slice(0, 2).join('/') : p;
    });

    const twoSegmentCounts = {};
    for (const seg of firstSegments) {
        twoSegmentCounts[seg] = (twoSegmentCounts[seg] || 0) + 1;
    }

    const sorted = Object.entries(twoSegmentCounts)
        .sort((a, b) => b[1] - a[1]);

    if (sorted.length > 0 && sorted[0][1] >= paths.length * 0.8) {
        const mostCommon = sorted[0][0];
        const segs = mostCommon.split('/').filter(Boolean);
        if (segs.length >= 2) {
            return {
                possibleProxyPrefix: '/' + segs[0],
                possibleBusinessPrefix: '/' + segs.slice(1).join('/'),
                fullPrefix: mostCommon,
                confidence: Math.round(sorted[0][1] / paths.length * 100)
            };
        }
    }

    return null;
}

/**
 * 完整代理场景分析（方案八增强）
 * 识别三种代理场景：
 *   场景一：代理 rewrite（前端请求 /api/xxx → 后端 /saas/erp/biz/xxx）
 *   场景二：代理无 rewrite（前端请求 /api/saas/erp/biz/xxx → 后端 /api/saas/erp/biz/xxx）
 *   场景三：无代理，直接请求后端（前端请求 http://backend/saas/erp/biz/xxx）
 */
function analyzeApiPathsWithProxy(paths, frontendConfig) {
    if (paths.length === 0) return { scenario: 'unknown', apiPrefix: '', alternatives: [] };

    const prefixes = analyzeCommonPrefix(paths);
    const firstPrefix = prefixes.recommendation || '';

    // 尝试从前端配置读取代理配置
    let proxyConfig = null;
    if (frontendConfig?.configPath && fs.existsSync(frontendConfig.configPath)) {
        proxyConfig = parseProxyConfig(frontendConfig.configPath);
    }

    // 有代理配置时
    if (proxyConfig) {
        // 场景一：代理 rewrite
        // 前端请求 /api/xxx → 后端 /rewrite-target/xxx
        // dom-probe 记录的是 /api/xxx
        if (proxyConfig.rewrite) {
            return {
                scenario: 'proxy-rewrite',
                apiPrefix: proxyConfig.prefix,      // 如 '/api'
                businessPaths: paths.map(p =>
                    p.startsWith(proxyConfig.prefix)
                        ? p.slice(proxyConfig.prefix.length)
                        : p
                ),
                proxyRewrite: proxyConfig.rewrite,   // 如 '/saas/erp/biz'
                confidence: 'high',
                alternatives: [
                    { apiPrefix: proxyConfig.prefix, description: '前端代理前缀（推荐）' },
                ],
            };
        }
        // 场景二：代理无 rewrite
        // 前端请求 /api/saas/erp/biz/xxx → 后端 /api/saas/erp/biz/xxx
        // dom-probe 记录的是 /api/saas/erp/biz/xxx
        return {
            scenario: 'proxy-no-rewrite',
            apiPrefix: proxyConfig.prefix,
            businessPaths: paths.map(p =>
                p.startsWith(proxyConfig.prefix)
                    ? p.slice(proxyConfig.prefix.length)
                    : p
            ),
            confidence: 'high',
            alternatives: [
                { apiPrefix: proxyConfig.prefix, description: '前端代理前缀（推荐）' },
            ],
        };
    }

    // 无代理配置：从路径分析推断
    if (!firstPrefix) {
        return { scenario: 'no-proxy', apiPrefix: '', alternatives: [] };
    }

    const segments = firstPrefix.split('/').filter(Boolean);

    // 如果前缀超过 2 段（如 /api/saas/erp/biz），可能需要拆分
    if (segments.length > 2) {
        const shortPrefix = '/' + segments[0]; // 如 /api
        const allStartWithShort = paths.every(p => p.startsWith(shortPrefix));

        if (allStartWithShort) {
            return {
                scenario: 'proxy-inferred',
                apiPrefix: shortPrefix,
                businessPaths: paths.map(p => p.slice(shortPrefix.length)),
                needsConfirmation: true,
                confidence: 'medium',
                alternatives: [
                    { apiPrefix: shortPrefix, description: '前端代理前缀（推荐，E2E waitForResponse 使用）' },
                    { apiPrefix: firstPrefix, description: '完整路径前缀（API 单接口测试使用）' },
                ],
            };
        }
    }

    return {
        scenario: 'no-proxy',
        apiPrefix: firstPrefix,
        businessPaths: paths,
        confidence: 'high',
        alternatives: [
            { apiPrefix: firstPrefix, description: '探测到的公共前缀' },
        ],
    };
}

/**
 * 从 vite.config.js / vue.config.js 解析代理配置
 */
function parseProxyConfig(configPath) {
    try {
        const content = fs.readFileSync(configPath, 'utf-8');

        // 匹配 proxy 配置块
        // vite: proxy: { '/api': { target: '...', pathRewrite: { '^/api': '/xxx' } } }
        // vue:  proxy: { '/api': { target: '...', pathRewrite: { '^/api': '/xxx' } } }
        const proxyMatch = content.match(/proxy\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
        if (!proxyMatch) return null;

        const proxyBlock = proxyMatch[1];

        // 提取代理前缀
        const prefixMatch = proxyBlock.match(/['"`](\/[^'"`]+)['"`]\s*:\s*\{/);
        if (!prefixMatch) return null;
        const prefix = prefixMatch[1];

        // 提取 rewrite 目标
        const rewriteMatch = proxyBlock.match(/pathRewrite[^}]*['"`]\^[^'"`]+['"`]\s*:\s*['"`]([^'"`]+)['"`]/);
        const rewrite = rewriteMatch ? rewriteMatch[1] : null;

        return { prefix, rewrite };
    } catch (e) {
        return null;
    }
}

function main() {
    const { domProbePath, configPath } = parseArgs();
    
    if (!domProbePath || !fs.existsSync(domProbePath)) {
        console.log(JSON.stringify({
            status: 'not_found',
            message: 'dom-probe.md 文件不存在',
            configuredPrefix: '',
            detectedPrefix: null,
            isConsistent: false,
            analysis: { totalPaths: 0, prefixes: [] },
            suggestedAction: 'run_dom_probe'
        }));
        return;
    }
    
    const domProbeContent = fs.readFileSync(domProbePath, 'utf-8');
    const apiPaths = extractApiPaths(domProbeContent);
    
    if (apiPaths.length === 0) {
        console.log(JSON.stringify({
            status: 'no_paths',
            message: 'dom-probe.md 中未找到 API 路径记录',
            configuredPrefix: '',
            detectedPrefix: null,
            isConsistent: true, // 无路径时认为一致，不影响流程
            analysis: { totalPaths: 0, prefixes: [] },
            suggestedAction: 'none'
        }));
        return;
    }
    
    const analysis = analyzeCommonPrefix(apiPaths);
    const proxyScenario = detectProxyScenario(apiPaths);

    let config = {};
    if (configPath && fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (e) {
            // 配置文件解析失败，使用默认值
        }
    }

    const configuredPrefix = config.backend?.apiPrefix || '';
    const recommendation = analysis.recommendation || '';

    // 前端代理场景完整分析
    const frontendConfig = {
        configPath: config.frontend?.configPath || null,
        baseUrl: config.frontend?.baseUrl || '',
    };
    const proxyAnalysis = analyzeApiPathsWithProxy(apiPaths, frontendConfig);

    // 判断配置是否与探测结果一致
    let isConsistent = false;
    if (configuredPrefix === recommendation) {
        isConsistent = true;
    } else if (configuredPrefix && apiPaths.every(p => p.startsWith(configuredPrefix) || p === configuredPrefix)) {
        isConsistent = true;
    } else if (!configuredPrefix && !recommendation) {
        isConsistent = true;
    }

    // 判断建议的操作
    let suggestedAction = 'none';
    if (!isConsistent) {
        if (proxyAnalysis.scenario === 'proxy-inferred' && proxyAnalysis.needsConfirmation) {
            suggestedAction = 'confirm_proxy_prefix';
        } else if (proxyScenario && proxyScenario.possibleProxyPrefix === configuredPrefix) {
            suggestedAction = 'verify_proxy_config';
        } else if (recommendation) {
            suggestedAction = 'update_config';
        } else {
            suggestedAction = 'manual_verify';
        }
    }

    const result = {
        status: 'success',
        configuredPrefix,
        detectedPrefix: recommendation,
        isConsistent,
        analysis: {
            totalPaths: apiPaths.length,
            paths: apiPaths.slice(0, 20),
            prefixes: analysis.prefixes.slice(0, 5)
        },
        proxyScenario,
        proxyAnalysis,
        suggestedAction
    };

    console.log(JSON.stringify(result, null, 2));
}

main();
