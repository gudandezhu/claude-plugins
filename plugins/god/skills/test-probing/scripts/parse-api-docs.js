#!/usr/bin/env node
"use strict";
/**
 * parse-api-docs.js
 * 解析本地接口文档（Markdown 或 OpenAPI 格式），提取接口定义
 *
 * 用法：
 *   node parse-api-docs.js --api-docs-dir tasks/api --format markdown --output .cache/api-sources.json
 *
 * 输出格式：
 *   { status, source, path, totalEndpoints, endpoints: [...] }
 */
const fs = require('fs');
const path = require('path');

function parseArgs() {
    const argv = process.argv.slice(2);
    let apiDocsDir = 'tasks/api';
    let format = 'auto';
    let output = '';
    
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--api-docs-dir' && argv[i + 1]) apiDocsDir = argv[++i];
        if (argv[i] === '--format' && argv[i + 1]) format = argv[++i];
        if (argv[i] === '--output' && argv[i + 1]) output = argv[++i];
    }
    return { apiDocsDir, format, output };
}

/**
 * 解析 Markdown 格式的接口文档
 * 支持常见格式：
 *   ### POST /api/path
 *   ## GET /api/path
 *   | 参数名 | 类型 | 说明 | 必填 |
 */
function parseMarkdownApiDoc(content, filePath) {
    const endpoints = [];
    const lines = content.split('\n');
    let currentEndpoint = null;
    let inParamTable = false;
    let inResponseSection = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 匹配接口标题：### POST /api/path 或 ## GET /api/path
        const methodMatch = line.match(/^#{2,4}\s+(GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)/i);
        if (methodMatch) {
            if (currentEndpoint) endpoints.push(currentEndpoint);
            currentEndpoint = {
                method: methodMatch[1].toUpperCase(),
                path: methodMatch[2],
                summary: '',
                tags: [],
                parameters: [],
                requestBody: null,
                responses: null,
                source: filePath
            };
            inParamTable = false;
            inResponseSection = false;
            continue;
        }
        
        if (!currentEndpoint) continue;
        
        // 匹配接口描述
        const summaryMatch = line.match(/^(接口描述|说明|简介|功能)[：:]\s*(.+)/);
        if (summaryMatch) {
            currentEndpoint.summary = summaryMatch[2].trim();
            continue;
        }
        
        // 检测请求参数表格
        if (line.includes('请求参数') || line.includes('参数说明') || line.includes('参数列表')) {
            inParamTable = true;
            continue;
        }
        
        // 检测响应章节
        if (line.includes('响应') || line.includes('返回')) {
            inParamTable = false;
            inResponseSection = true;
            continue;
        }
        
        // 解析参数表格行
        if (inParamTable && line.startsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter(Boolean);
            // 跳过表头和分隔行
            if (cells.length >= 4 && !cells[0].match(/^(参数名|字段名|参数|参数名称)$/i) && !cells[0].match(/^[-:]+$/)) {
                currentEndpoint.parameters.push({
                    name: cells[0],
                    in: cells[1]?.toLowerCase() || 'body',
                    description: cells[2] || '',
                    required: cells[3] === '是' || cells[3] === '必填' || cells[3]?.toLowerCase() === 'true'
                });
            }
        }
        
        // 解析请求体示例
        if (inResponseSection && line.includes('```json')) {
            // 收集 JSON 块
            let jsonStr = '';
            for (let j = i + 1; j < lines.length && !lines[j].includes('```'); j++) {
                jsonStr += lines[j] + '\n';
            }
            try {
                currentEndpoint.responses = JSON.parse(jsonStr);
            } catch (e) {
                // 解析失败，忽略
            }
        }
    }
    
    if (currentEndpoint) endpoints.push(currentEndpoint);
    return endpoints;
}

/**
 * 解析 OpenAPI 格式的接口文档
 */
function parseOpenApiDoc(content, filePath) {
    let doc;
    try {
        doc = JSON.parse(content);
    } catch (e) {
        // 尝试 YAML（简单处理，不支持复杂 YAML）
        return [];
    }
    
    const endpoints = [];
    
    for (const [path, methods] of Object.entries(doc.paths || {})) {
        for (const [method, spec] of Object.entries(methods)) {
            if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
            
            const parameters = (spec.parameters || []).map(p => ({
                name: p.name,
                in: p.in,
                description: p.description || '',
                required: p.required || false
            }));
            
            // 从 requestBody 提取参数
            if (spec.requestBody?.content?.['application/json']?.schema?.properties) {
                const props = spec.requestBody.content['application/json'].schema.properties;
                const required = spec.requestBody.content['application/json'].schema.required || [];
                for (const [name, prop] of Object.entries(props)) {
                    parameters.push({
                        name,
                        in: 'body',
                        description: prop.description || '',
                        required: required.includes(name)
                    });
                }
            }
            
            endpoints.push({
                method: method.toUpperCase(),
                path,
                summary: spec.summary || '',
                tags: spec.tags || [],
                parameters,
                requestBody: spec.requestBody || null,
                responses: spec.responses || null,
                source: filePath
            });
        }
    }
    
    return endpoints;
}

/**
 * 检测文档格式
 */
function detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') return 'openapi';
    if (ext === '.yaml' || ext === '.yml') return 'openapi';
    if (ext === '.md') return 'markdown';
    return 'unknown';
}

/**
 * 递归获取目录下所有文件
 */
function getAllFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

function main() {
    const { apiDocsDir, format: formatArg, output } = parseArgs();
    
    if (!fs.existsSync(apiDocsDir)) {
        const result = {
            status: 'not_found',
            message: `API 文档目录不存在: ${apiDocsDir}`,
            source: 'local',
            path: apiDocsDir,
            totalEndpoints: 0,
            endpoints: []
        };
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    
    const allEndpoints = [];
    const files = getAllFiles(apiDocsDir);
    
    // 支持的文件扩展名
    const supportedExts = ['.md', '.json', '.yaml', '.yml'];
    const supportedFiles = files.filter(f => supportedExts.includes(path.extname(f).toLowerCase()));
    
    console.error(`[INFO] 找到 ${supportedFiles.length} 个接口文档文件`);
    
    for (const file of supportedFiles) {
        const format = formatArg === 'auto' ? detectFormat(file) : formatArg;
        if (format === 'unknown') continue;
        
        try {
            const content = fs.readFileSync(file, 'utf-8');
            let endpoints = [];
            
            if (format === 'markdown') {
                endpoints = parseMarkdownApiDoc(content, file);
            } else if (format === 'openapi') {
                endpoints = parseOpenApiDoc(content, file);
            }
            
            allEndpoints.push(...endpoints);
            console.error(`[INFO] ${file}: ${endpoints.length} 个接口`);
        } catch (e) {
            console.error(`[WARN] 解析失败: ${file} - ${e.message}`);
        }
    }
    
    const result = {
        status: 'success',
        source: 'local',
        path: apiDocsDir,
        totalEndpoints: allEndpoints.length,
        endpoints: allEndpoints
    };
    
    if (output) {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(result, null, 2));
        console.error(`[OK] 输出到: ${output}`);
    }
    
    console.log(JSON.stringify(result, null, 2));
}

main();
