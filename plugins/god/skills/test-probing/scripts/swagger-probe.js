#!/usr/bin/env node
"use strict";
/**
 * TASK-01: swagger-probe.js
 * 从 Swagger/OpenAPI JSON 自动生成 api-probe.md + api-skeleton.json
 *
 * 用法：
 *   node swagger-probe.js --url http://localhost:8080/v3/api-docs
 *   node swagger-probe.js --file ./swagger.json
 *   node swagger-probe.js --url http://localhost:8080/v3/api-docs --tags "rule,finance" --output testing
 *   node swagger-probe.js --url http://localhost:8080/v3/api-docs --paths "/finance/statement-rules" --output testing
 *
 * 过滤参数（不传则提取所有接口）：
 *   --tags "tag1,tag2"     按 Swagger tag 过滤，逗号分隔，模糊匹配
 *   --paths "/prefix1,/prefix2"  按路径前缀过滤，逗号分隔
 *
 * 输出：
 *   成功 → testing/api-probe.md + testing/.cache/api-skeleton.json
 *   失败 → testing/.cache/swagger-probe-result.json（含 status + reason）
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
const https = __importStar(require("https"));
const http = __importStar(require("http"));
function parseArgs() {
    const args = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--url' && argv[i + 1])
            args.url = argv[++i];
        else if (argv[i] === '--file' && argv[i + 1])
            args.file = argv[++i];
        else if (argv[i] === '--output' && argv[i + 1])
            args.output = argv[++i];
        else if (argv[i] === '--tags' && argv[i + 1])
            args.tags = argv[++i].split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        else if (argv[i] === '--paths' && argv[i + 1])
            args.paths = argv[++i].split(',').map(p => {
                let v = p.trim();
                // 修复 Windows Git Bash MSYS 路径转换：
                // "/finance/xxx" 被转换为 "C:/Program Files/Git/finance/xxx"
                if (/^[A-Z]:.*\/Git\//i.test(v)) {
                    v = '/' + v.replace(/^[A-Z]:.*\/Git\//i, '');
                }
                return v;
            }).filter(Boolean);
        else if (argv[i] === '--auto-filter' && argv[i + 1])
            args.autoFilterDir = argv[++i];
        else if (argv[i] === '--cache' && argv[i + 1])
            args.cacheFile = argv[++i];
        else if (argv[i] === '--summary')
            args.summary = true;
        else if (argv[i] === '--base-url' && argv[i + 1])
            args.baseUrl = argv[++i];
        else if (argv[i] === '--token' && argv[i + 1])
            args.token = argv[++i];
        else if (argv[i] === '--verify')
            args.verify = true;
    }
    return args;
}
// ─── HTTP 获取 ──────────────────────────────────────────────
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 15000 }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJson(res.headers.location).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            }
            let data = '';
            res.setEncoding('utf-8');
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error(`Response is not valid JSON (starts with: ${data.substring(0, 50)})`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    });
}
const MAX_REF_DEPTH = 10;
function isOpenApi(doc) {
    return !!(doc.openapi || doc.swagger);
}
function getOpenApiVersion(doc) {
    return doc.openapi || doc.swagger || 'unknown';
}
function getBasePath(doc) {
    // OpenAPI 3.x
    if (doc.servers && doc.servers.length > 0) {
        return doc.servers[0].url || '';
    }
    // Swagger 2.0
    return doc.basePath || '';
}
function resolveRef(doc, ref, depth = 0) {
    if (depth > MAX_REF_DEPTH)
        return { type: 'object', description: '[max depth exceeded]' };
    if (!ref || !ref.startsWith('#/'))
        return null;
    const parts = ref.replace('#/', '').split('/');
    let current = doc;
    for (const part of parts) {
        current = current?.[part];
        if (!current)
            return null;
    }
    // Recursively resolve nested $ref
    if (current.$ref)
        return resolveRef(doc, current.$ref, depth + 1);
    return current;
}
function resolveSchema(doc, schema, depth = 0) {
    if (!schema || depth > MAX_REF_DEPTH)
        return schema;
    if (schema.$ref) {
        const resolved = resolveRef(doc, schema.$ref, depth);
        return resolveSchema(doc, resolved, depth + 1);
    }
    if (schema.allOf) {
        const merged = { type: 'object', properties: {} };
        for (const sub of schema.allOf) {
            const resolved = resolveSchema(doc, sub, depth + 1);
            if (resolved?.properties) {
                Object.assign(merged.properties, resolved.properties);
            }
        }
        return merged;
    }
    if (schema.oneOf || schema.anyOf) {
        const variants = schema.oneOf || schema.anyOf;
        return resolveSchema(doc, variants[0], depth + 1);
    }
    if (schema.properties) {
        const resolved = { ...schema, properties: {} };
        for (const [key, val] of Object.entries(schema.properties)) {
            resolved.properties[key] = resolveSchema(doc, val, depth + 1);
        }
        return resolved;
    }
    if (schema.items) {
        return { ...schema, items: resolveSchema(doc, schema.items, depth + 1) };
    }
    return schema;
}
function extractRefName(ref) {
    if (!ref)
        return '';
    const parts = ref.split('/');
    return parts[parts.length - 1];
}
function inferWrapperClass(doc) {
    const schemas = doc.components?.schemas || doc.definitions || {};
    let wrapperClass = null;
    let paginationClass = null;
    const paginationFields = {};
    for (const [name, schema] of Object.entries(schemas)) {
        const lowerName = name.toLowerCase();
        // Detect wrapper: Result, Response, ApiResult, R
        if (/^(result|response|apiresult|r)$/i.test(name) || /^(result|response)</.test(lowerName)) {
            if (schema.properties?.code !== undefined && schema.properties?.data !== undefined) {
                wrapperClass = name;
            }
        }
        // Detect pagination: Page, PageResult, PageInfo, IPage
        if (/page/i.test(name) && !wrapperClass?.includes(name)) {
            const props = schema.properties || {};
            const propNames = Object.keys(props);
            if (propNames.some(p => /total|count/i.test(p)) && propNames.some(p => /list|records|items|content|rows/i.test(p))) {
                paginationClass = name;
                for (const p of propNames) {
                    if (/total/i.test(p))
                        paginationFields.total = p;
                    if (/list|records|items|content|rows/i.test(p))
                        paginationFields.list = p;
                    if (/page.*num|current/i.test(p))
                        paginationFields.pageNum = p;
                    if (/page.*size|size/i.test(p))
                        paginationFields.pageSize = p;
                }
            }
        }
    }
    return { wrapperClass, paginationClass, paginationFields };
}
function extractParameters(doc, operation) {
    const params = [];
    // Path/query/header parameters
    for (const p of operation.parameters || []) {
        const resolved = p.$ref ? resolveRef(doc, p.$ref) : p;
        if (!resolved)
            continue;
        params.push({
            name: resolved.name,
            in: resolved.in,
            type: resolved.schema?.type || resolved.type || 'string',
            required: !!resolved.required,
            description: resolved.description || '',
            example: resolved.example || resolved.schema?.example,
        });
    }
    return params;
}
function extractRequestBody(doc, operation) {
    const body = [];
    // OpenAPI 3.x requestBody
    const rb = operation.requestBody;
    if (rb) {
        const resolved = rb.$ref ? resolveRef(doc, rb.$ref) : rb;
        const content = resolved?.content?.['application/json'];
        if (content?.schema) {
            const schema = resolveSchema(doc, content.schema);
            if (schema?.properties) {
                for (const [name, prop] of Object.entries(schema.properties)) {
                    body.push({
                        name,
                        in: 'body',
                        type: prop.type || 'object',
                        required: (schema.required || []).includes(name),
                        description: prop.description || '',
                        example: prop.example,
                    });
                }
            }
        }
    }
    // Swagger 2.0 body parameter
    for (const p of operation.parameters || []) {
        if (p.in === 'body' && p.schema) {
            const schema = resolveSchema(doc, p.schema);
            if (schema?.properties) {
                for (const [name, prop] of Object.entries(schema.properties)) {
                    body.push({
                        name,
                        in: 'body',
                        type: prop.type || 'object',
                        required: (schema.required || []).includes(name),
                        description: prop.description || '',
                        example: prop.example,
                    });
                }
            }
        }
    }
    return body;
}
function extractResponseSchema(doc, operation) {
    const response = operation.responses?.['200'] || operation.responses?.['201'];
    if (!response)
        return { schema: null, ref: null };
    let rawSchema = null;
    let refName = null;
    // OpenAPI 3.x
    const content = response.content?.['application/json'] || response.content?.['*/*'];
    if (content?.schema) {
        refName = content.schema.$ref ? extractRefName(content.schema.$ref) : null;
        rawSchema = resolveSchema(doc, content.schema);
    }
    // Swagger 2.0
    if (!rawSchema && response.schema) {
        refName = response.schema.$ref ? extractRefName(response.schema.$ref) : null;
        rawSchema = resolveSchema(doc, response.schema);
    }
    if (!rawSchema)
        return { schema: null, ref: refName };
    const properties = {};
    if (rawSchema.properties) {
        for (const [key, val] of Object.entries(rawSchema.properties)) {
            properties[key] = {
                type: val.type || (val.items ? `array<${val.items.type || 'object'}>` : 'object'),
                description: val.description,
                ref: val.$ref ? extractRefName(val.$ref) : undefined,
            };
        }
    }
    return {
        schema: {
            type: rawSchema.type || 'object',
            properties,
            wrapperClass: refName || undefined,
        },
        ref: refName,
    };
}
function parseOpenApi(doc, filterTags, filterPaths) {
    const version = getOpenApiVersion(doc);
    const basePath = getBasePath(doc);
    const { wrapperClass, paginationClass, paginationFields } = inferWrapperClass(doc);
    const endpoints = [];
    const paths = doc.paths || {};
    for (const [pathStr, pathItem] of Object.entries(paths)) {
        // 路径前缀过滤
        if (filterPaths && filterPaths.length > 0) {
            if (!filterPaths.some(prefix => pathStr.includes(prefix))) continue;
        }
        for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
            const operation = pathItem[method];
            if (!operation)
                continue;
            // tag 过滤（模糊匹配）
            if (filterTags && filterTags.length > 0) {
                const opTags = (operation.tags || []).map(t => t.toLowerCase());
                if (!filterTags.some(ft => opTags.some(ot => ot.includes(ft)))) continue;
            }
            const parameters = extractParameters(doc, operation);
            const requestBody = extractRequestBody(doc, operation);
            const { schema, ref } = extractResponseSchema(doc, operation);
            endpoints.push({
                path: pathStr,
                method: method.toUpperCase(),
                operationId: operation.operationId || `${method}_${pathStr.replace(/\//g, '_')}`,
                tags: operation.tags || [],
                summary: operation.summary || '',
                parameters,
                requestBody,
                responseSchema: schema,
                responseRef: ref,
            });
        }
    }
    return {
        openApiVersion: version,
        basePath,
        wrapperClass,
        paginationClass,
        paginationFields,
        endpoints,
    };
}
// ─── 输出生成 ───────────────────────────────────────────────
function generateApiProbeMd(skeleton) {
    const lines = [
        '# API 响应探测报告',
        '',
        '## 探测信息',
        `- 探测方式：swagger-probe`,
        `- 探测时间：${new Date().toISOString()}`,
        `- OpenAPI 版本：${skeleton.openApiVersion}`,
        `- BasePath：${skeleton.basePath || '(无)'}`,
        '',
    ];
    if (skeleton.wrapperClass) {
        lines.push('## 统一响应结构');
        lines.push(`- 包装类：${skeleton.wrapperClass}`);
        lines.push('');
    }
    if (skeleton.paginationClass) {
        lines.push('## 分页响应结构');
        lines.push(`- 分页类：${skeleton.paginationClass}`);
        const pf = skeleton.paginationFields;
        if (pf.total)
            lines.push(`- 总数字段：${pf.total}`);
        if (pf.list)
            lines.push(`- 列表字段：${pf.list}`);
        if (pf.pageNum)
            lines.push(`- 页码字段：${pf.pageNum}`);
        if (pf.pageSize)
            lines.push(`- 页大小字段：${pf.pageSize}`);
        lines.push('');
    }
    lines.push('## 接口探测结果');
    lines.push('');
    for (const ep of skeleton.endpoints) {
        lines.push(`### ${ep.method} ${ep.path} [verified]`);
        if (ep.summary)
            lines.push(`- 描述：${ep.summary}`);
        if (ep.tags.length)
            lines.push(`- 标签：${ep.tags.join(', ')}`);
        lines.push(`- 探测来源：swagger-probe`);
        if (ep.parameters.length > 0) {
            lines.push('- 请求参数：');
            for (const p of ep.parameters) {
                lines.push(`  - ${p.name} (${p.in}, ${p.type}${p.required ? ', 必填' : ''})${p.description ? ': ' + p.description : ''}`);
            }
        }
        if (ep.requestBody.length > 0) {
            lines.push('- 请求体：');
            for (const p of ep.requestBody) {
                lines.push(`  - ${p.name} (${p.type}${p.required ? ', 必填' : ''})${p.description ? ': ' + p.description : ''}`);
            }
        }
        if (ep.responseSchema) {
            const props = Object.entries(ep.responseSchema.properties);
            if (props.length > 0) {
                lines.push('- 响应字段：');
                for (const [key, val] of props) {
                    lines.push(`  - ${key}: ${val.type}${val.description ? ' — ' + val.description : ''}`);
                }
            }
        }
        lines.push('');
    }
    return lines.join('\n');
}

// ── T19: 摘要模式输出（精简版，只含路径+方法+描述+参数名列表）──
function generateSummaryMd(skeleton) {
    const lines = [
        '# API 响应探测报告（摘要模式）',
        '',
        '## 探测信息',
        `- 探测方式：swagger-probe (--summary)`,
        `- 探测时间：${new Date().toISOString()}`,
        `- OpenAPI 版本：${skeleton.openApiVersion}`,
        `- BasePath：${skeleton.basePath || '(无)'}`,
        `- 接口总数：${skeleton.endpoints.length}`,
        '',
    ];
    if (skeleton.wrapperClass) {
        lines.push(`## 统一响应结构：${skeleton.wrapperClass}`);
        lines.push('');
    }
    lines.push('## 接口列表');
    lines.push('');
    lines.push('| 方法 | 路径 | 描述 | 参数 |');
    lines.push('|------|------|------|------|');
    for (const ep of skeleton.endpoints) {
        const params = [
            ...ep.parameters.map(p => `${p.name}(${p.in})`),
            ...ep.requestBody.map(p => `${p.name}(body)`),
        ];
        const paramStr = params.length > 0 ? params.join(', ') : '—';
        const desc = (ep.summary || '').replace(/\|/g, '\\|');
        lines.push(`| ${ep.method} | ${ep.path} | ${desc} | ${paramStr} |`);
    }
    lines.push('');
    return lines.join('\n');
}

// ── T10: 从接口文档目录自动提取 API 路径作为过滤参数 ──
function autoFilterFromDocs(dir) {
    if (!dir || !fs.existsSync(dir)) return [];
    const apiPaths = [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const f of files) {
        const content = fs.readFileSync(path.join(dir, f), 'utf-8');
        // 匹配多种格式：路径: /xxx, Path: /xxx, URL: /xxx, `GET /xxx`, `POST /xxx`
        const patterns = [
            /(?:路径|Path|URL|接口地址)\s*[:：]\s*[`"]?([/\w-]+)/gi,
            /`(?:GET|POST|PUT|DELETE|PATCH)\s+([/\w-]+)`/gi,
            /###\s+(?:GET|POST|PUT|DELETE|PATCH)\s+([/\w-]+)/gi,
        ];
        for (const pat of patterns) {
            let m;
            while ((m = pat.exec(content)) !== null) {
                const p = m[1].trim();
                if (p.startsWith('/') && p.length > 1) {
                    // 提取路径前缀（前两段，如 /finance/rules → /finance/rules）
                    const segments = p.split('/').filter(Boolean);
                    if (segments.length >= 2) {
                        const prefix = '/' + segments.slice(0, 2).join('/');
                        if (!apiPaths.includes(prefix)) apiPaths.push(prefix);
                    } else if (segments.length === 1) {
                        const prefix = '/' + segments[0];
                        if (!apiPaths.includes(prefix)) apiPaths.push(prefix);
                    }
                }
            }
        }
    }
    return apiPaths;
}

// ── T15: Swagger JSON 本地缓存（ETag / Last-Modified）──
function fetchJsonWithCache(url, cacheFile) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const headers = {};

        // 读取缓存元数据
        const metaFile = cacheFile + '.meta.json';
        let meta = null;
        if (cacheFile && fs.existsSync(cacheFile) && fs.existsSync(metaFile)) {
            try {
                meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
                if (meta.etag) headers['If-None-Match'] = meta.etag;
                if (meta.lastModified) headers['If-Modified-Since'] = meta.lastModified;
            } catch (e) { meta = null; }
        }

        const reqOpts = typeof url === 'string' ? new URL(url) : url;
        const opts = {
            hostname: reqOpts.hostname,
            port: reqOpts.port,
            path: reqOpts.pathname + (reqOpts.search || ''),
            headers,
            timeout: 15000,
        };

        const req = client.get(opts, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJsonWithCache(res.headers.location, cacheFile).then(resolve, reject);
            }
            // 304 Not Modified → 使用缓存
            if (res.statusCode === 304 && cacheFile && fs.existsSync(cacheFile)) {
                console.log(`[CACHE] Swagger 文档未变化，使用本地缓存: ${cacheFile}`);
                try {
                    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
                    return resolve(cached);
                } catch (e) {
                    // 缓存损坏，重新下载
                }
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            }
            let data = '';
            res.setEncoding('utf-8');
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const doc = JSON.parse(data);
                    // 写入缓存
                    if (cacheFile) {
                        const cacheDir = path.dirname(cacheFile);
                        fs.mkdirSync(cacheDir, { recursive: true });
                        fs.writeFileSync(cacheFile, data, 'utf-8');
                        const newMeta = { url, fetchedAt: new Date().toISOString() };
                        if (res.headers.etag) newMeta.etag = res.headers.etag;
                        if (res.headers['last-modified']) newMeta.lastModified = res.headers['last-modified'];
                        fs.writeFileSync(metaFile, JSON.stringify(newMeta, null, 2), 'utf-8');
                        console.log(`[CACHE] Swagger 文档已缓存到: ${cacheFile}`);
                    }
                    resolve(doc);
                } catch {
                    reject(new Error(`Response is not valid JSON (starts with: ${data.substring(0, 50)})`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    });
}
// ─── 运行时 API 响应验证 ──────────────────────────────────────
function verifyResponseStructure(skeleton, baseUrl, token) {
    const paginationEndpoints = skeleton.endpoints.filter(ep => {
        const hasPageParam = [...ep.parameters, ...ep.requestBody].some(p =>
            /page|pageNum|pageNo|current/i.test(p.name)
        );
        return hasPageParam || (ep.method === 'POST' && ep.path.includes('list'));
    });

    if (paginationEndpoints.length === 0) {
        return Promise.resolve({ verified: false, reason: 'no-pagination-endpoints' });
    }

    const target = paginationEndpoints[0];
    const url = `${baseUrl}${skeleton.basePath}${target.path}`;

    const body = {};
    for (const p of target.requestBody) {
        if (/pageNum|pageNo|current/i.test(p.name)) body[p.name] = 1;
        else if (/pageSize|size/i.test(p.name)) body[p.name] = 1;
    }
    for (const p of target.parameters) {
        if (p.in === 'query') {
            if (/pageNum|pageNo|current/i.test(p.name)) body[p.name] = 1;
            else if (/pageSize|size/i.test(p.name)) body[p.name] = 1;
        }
    }

    const postData = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = token;

    return new Promise((resolve) => {
        const opts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + (parsedUrl.search || ''),
            method: target.method,
            headers,
            timeout: 10000,
        };

        if (target.method === 'POST' || target.method === 'PUT') {
            headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = client.request(opts, (res) => {
            let data = '';
            res.setEncoding('utf-8');
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                if (res.statusCode === 401 || res.statusCode === 403) {
                    return resolve({ verified: false, reason: `auth-required (${res.statusCode})` });
                }
                if (res.statusCode !== 200) {
                    return resolve({ verified: false, reason: `HTTP ${res.statusCode}` });
                }
                try {
                    const json = JSON.parse(data);
                    const fieldMapping = detectFieldMapping(json);
                    resolve({ verified: true, fieldMapping, verifiedEndpoint: `${target.method} ${target.path}`, rawSample: truncateJson(json) });
                } catch {
                    resolve({ verified: false, reason: 'response-not-json' });
                }
            });
        });
        req.on('error', (err) => resolve({ verified: false, reason: err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ verified: false, reason: 'timeout' }); });

        if (target.method === 'POST' || target.method === 'PUT') {
            req.write(postData);
        }
        req.end();
    });
}

function detectFieldMapping(json) {
    const mapping = { successCode: null, listField: null, totalField: null, dataField: null };

    // Detect success code
    if (json.code !== undefined) mapping.successCode = { field: 'code', value: json.code };
    else if (json.status !== undefined) mapping.successCode = { field: 'status', value: json.status };
    else if (json.success !== undefined) mapping.successCode = { field: 'success', value: json.success };

    // Detect data wrapper
    const dataCandidate = json.data || json.result || json.body;
    const dataFieldName = json.data !== undefined ? 'data' : json.result !== undefined ? 'result' : json.body !== undefined ? 'body' : null;
    mapping.dataField = dataFieldName;

    if (dataCandidate && typeof dataCandidate === 'object') {
        // Detect list field inside data
        for (const key of ['list', 'records', 'items', 'content', 'rows', 'data']) {
            if (Array.isArray(dataCandidate[key])) {
                mapping.listField = `${dataFieldName}.${key}`;
                break;
            }
        }
        // Detect total field inside data
        for (const key of ['total', 'totalRows', 'totalCount', 'count', 'totalElements']) {
            if (typeof dataCandidate[key] === 'number') {
                mapping.totalField = `${dataFieldName}.${key}`;
                break;
            }
        }
        // Check nested data (data.data.list pattern)
        if (!mapping.listField && dataCandidate.data && typeof dataCandidate.data === 'object') {
            for (const key of ['list', 'records', 'items', 'content', 'rows']) {
                if (Array.isArray(dataCandidate.data[key])) {
                    mapping.listField = `${dataFieldName}.data.${key}`;
                    break;
                }
            }
            for (const key of ['total', 'totalRows', 'totalCount', 'count']) {
                if (typeof dataCandidate.data[key] === 'number') {
                    mapping.totalField = `${dataFieldName}.data.${key}`;
                    break;
                }
            }
        }
    }

    return mapping;
}

function truncateJson(json) {
    const str = JSON.stringify(json);
    if (str.length <= 500) return json;
    // Return top-level keys only
    if (typeof json === 'object' && json !== null) {
        const summary = {};
        for (const [k, v] of Object.entries(json)) {
            if (Array.isArray(v)) summary[k] = `[Array(${v.length})]`;
            else if (typeof v === 'object' && v !== null) summary[k] = `{${Object.keys(v).join(',')}}`;
            else summary[k] = v;
        }
        return summary;
    }
    return json;
}

// ─── apiPrefix 自动检测 ──────────────────────────────────────
function detectApiPrefix(endpoints) {
    if (endpoints.length < 2) return null;
    const paths = endpoints.map(ep => ep.path);
    // Find common prefix segments
    const segments = paths.map(p => p.split('/').filter(Boolean));
    if (segments.length === 0) return null;

    let commonPrefix = [];
    const first = segments[0];
    for (let i = 0; i < first.length; i++) {
        const seg = first[i];
        // Skip if segment contains path params
        if (seg.startsWith('{')) break;
        if (segments.every(s => s[i] === seg)) {
            commonPrefix.push(seg);
        } else {
            break;
        }
    }

    if (commonPrefix.length === 0) return null;
    const prefix = '/' + commonPrefix.join('/');
    // Only return if it's a meaningful prefix (not just /)
    if (prefix.length > 1) return prefix;
    return null;
}

// ─── 主流程 ─────────────────────────────────────────────────
async function main() {
    const args = parseArgs();
    const outputDir = args.output || 'testing';
    const cacheDir = path.join(outputDir, '.cache');
    // 确保输出目录存在
    fs.mkdirSync(cacheDir, { recursive: true });
    const writeFailure = (reason) => {
        const result = { status: 'failed', reason, timestamp: new Date().toISOString() };
        fs.writeFileSync(path.join(cacheDir, 'swagger-probe-result.json'), JSON.stringify(result, null, 2));
        console.error(`[FAIL] swagger-probe 失败: ${reason}`);
        process.exit(1);
    };
    if (!args.url && !args.file) {
        writeFailure('必须提供 --url 或 --file 参数');
        return;
    }

    // T10: --auto-filter 从接口文档目录自动提取 API 路径
    if (args.autoFilterDir && !args.paths) {
        const autoFilterPaths = autoFilterFromDocs(args.autoFilterDir);
        if (autoFilterPaths.length > 0) {
            args.paths = autoFilterPaths;
            console.log(`[AUTO-FILTER] 从接口文档自动提取 ${autoFilterPaths.length} 个路径前缀: ${autoFilterPaths.join(', ')}`);
        } else {
            console.log(`[AUTO-FILTER] 接口文档目录中未提取到 API 路径，不过滤`);
        }
    }

    // 1. 获取 Swagger JSON（T15: 支持缓存）
    let doc;
    try {
        if (args.file) {
            const content = fs.readFileSync(args.file, 'utf-8');
            doc = JSON.parse(content);
        }
        else if (args.cacheFile) {
            doc = await fetchJsonWithCache(args.url, args.cacheFile);
        }
        else {
            doc = await fetchJson(args.url);
        }
    }
    catch (err) {
        writeFailure(`获取 Swagger 文档失败: ${err.message}`);
        return;
    }
    // 2. 验证 OpenAPI 格式
    if (!isOpenApi(doc)) {
        writeFailure('文档不是有效的 OpenAPI/Swagger 格式（缺少 openapi 或 swagger 字段）');
        return;
    }
    // 3. 解析（支持按 tag 和路径前缀过滤）
    const skeleton = parseOpenApi(doc, args.tags, args.paths);
    if (skeleton.endpoints.length === 0) {
        const filterInfo = [];
        if (args.tags) filterInfo.push(`tags=${args.tags.join(',')}`);
        if (args.paths) filterInfo.push(`paths=${args.paths.join(',')}`);
        writeFailure(filterInfo.length > 0
            ? `过滤后未找到匹配的接口（${filterInfo.join(', ')}）。检查 --tags 或 --paths 参数是否正确`
            : 'Swagger 文档中未找到任何接口（paths 为空）');
        return;
    }
    // 4. 输出（T19: 支持 --summary 摘要模式）
    const apiProbeMd = args.summary ? generateSummaryMd(skeleton) : generateApiProbeMd(skeleton);
    fs.writeFileSync(path.join(outputDir, 'api-probe.md'), apiProbeMd);
    fs.writeFileSync(path.join(cacheDir, 'api-skeleton.json'), JSON.stringify(skeleton, null, 2));

    // 5. apiPrefix 自动检测
    const detectedPrefix = detectApiPrefix(skeleton.endpoints);
    if (detectedPrefix) {
        console.log(`[INFO] 检测到 API 公共前缀 (apiPrefix): ${detectedPrefix}`);
    }

    // 6. 运行时响应验证（--verify + --base-url 时执行）
    let verification = { verified: false, reason: 'not-requested' };
    if (args.verify && args.baseUrl) {
        console.log(`[INFO] 执行运行时 API 响应验证...`);
        verification = await verifyResponseStructure(skeleton, args.baseUrl, args.token);
        if (verification.verified) {
            console.log(`[OK] 运行时验证通过: ${verification.verifiedEndpoint}`);
            console.log(`   listField: ${verification.fieldMapping.listField || '(未检测到)'}`);
            console.log(`   totalField: ${verification.fieldMapping.totalField || '(未检测到)'}`);
            console.log(`   successCode: ${JSON.stringify(verification.fieldMapping.successCode) || '(未检测到)'}`);
        } else {
            console.log(`[WARN] 运行时验证失败: ${verification.reason}（降级使用 Swagger 静态分析结果）`);
        }
    }

    // 7. 写入 api-probe-summary.json
    const summary = {
        status: 'success',
        timestamp: new Date().toISOString(),
        endpointCount: skeleton.endpoints.length,
        wrapperClass: skeleton.wrapperClass,
        paginationClass: skeleton.paginationClass,
        paginationFields: skeleton.paginationFields,
        apiPrefix: detectedPrefix,
        summaryMode: !!args.summary,
        verification,
        fieldMapping: verification.verified ? verification.fieldMapping : {
            successCode: null,
            listField: skeleton.paginationFields.list ? `data.${skeleton.paginationFields.list}` : null,
            totalField: skeleton.paginationFields.total ? `data.${skeleton.paginationFields.total}` : null,
            dataField: 'data',
            source: 'swagger-static'
        },
    };
    fs.writeFileSync(path.join(cacheDir, 'api-probe-summary.json'), JSON.stringify(summary, null, 2));

    const result = {
        status: 'success',
        timestamp: new Date().toISOString(),
        endpointCount: skeleton.endpoints.length,
        wrapperClass: skeleton.wrapperClass,
        paginationClass: skeleton.paginationClass,
        summaryMode: !!args.summary,
    };
    fs.writeFileSync(path.join(cacheDir, 'swagger-probe-result.json'), JSON.stringify(result, null, 2));
    console.log(`[OK] swagger-probe 完成: ${skeleton.endpoints.length} 个接口${args.summary ? '（摘要模式）' : ''}`);
    if (args.tags) console.log(`   过滤 tags: ${args.tags.join(', ')}`);
    if (args.paths) console.log(`   过滤 paths: ${args.paths.join(', ')}`);
    if (detectedPrefix) console.log(`   apiPrefix: ${detectedPrefix}`);
    console.log(`   输出: ${outputDir}/api-probe.md`);
    console.log(`   输出: ${cacheDir}/api-skeleton.json`);
    console.log(`   输出: ${cacheDir}/api-probe-summary.json`);
}
main().catch((err) => {
    console.error('swagger-probe 未预期错误:', err);
    process.exit(1);
});
