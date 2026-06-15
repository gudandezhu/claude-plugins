#!/usr/bin/env node
"use strict";
/**
 * TASK-08: dom-infer.js (Vue 适配器)
 * 从 Vue SFC 模板中提取 UI 组件标签，通过 selectorMapping 映射为 CSS 选择器
 *
 * 用法：node dom-infer.js --components "src/views/rule" --adapter adapters/vue/adapter.json
 * 输出：testing/.cache/dom-probe-skeleton.json
 *
 * 注意：此脚本不依赖 @vue/compiler-sfc，使用正则解析 template 部分
 * 如果项目安装了 @vue/compiler-sfc，可以升级为 AST 解析以提高准确率
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
function parseArgs() {
    const argv = process.argv.slice(2);
    let componentsArg = '';
    let adapterPath = '';
    let output = 'testing/.cache/dom-probe-skeleton.json';
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--components' && argv[i + 1])
            componentsArg = argv[++i];
        if (argv[i] === '--adapter' && argv[i + 1])
            adapterPath = argv[++i];
        if (argv[i] === '--output' && argv[i + 1])
            output = argv[++i];
    }
    // 展开 glob（简单实现：如果是目录则递归查找 .vue 文件）
    const components = [];
    if (componentsArg) {
        if (fs.existsSync(componentsArg) && fs.statSync(componentsArg).isDirectory()) {
            function walk(dir) {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory())
                        walk(full);
                    else if (entry.name.endsWith('.vue'))
                        components.push(full);
                }
            }
            walk(componentsArg);
        }
        else {
            // 尝试作为逗号分隔的文件列表
            components.push(...componentsArg.split(',').map(s => s.trim()).filter(Boolean));
        }
    }
    return { components, adapterPath, output };
}
function loadAdapter(adapterPath) {
    if (adapterPath && fs.existsSync(adapterPath)) {
        return JSON.parse(fs.readFileSync(adapterPath, 'utf-8'));
    }
    // 默认 Element Plus 映射
    return {
        framework: 'vue',
        uiLibrary: 'element-plus',
        selectorMapping: {
            'el-button': '.el-button',
            'el-table': '.el-table',
            'el-dialog': '.el-dialog',
            'el-form': '.el-form',
            'el-form-item': '.el-form-item',
            'el-input': '.el-input input',
            'el-select': '.el-select',
            'el-switch': '.el-switch',
            'el-pagination': '.el-pagination',
            'el-tabs': '.el-tabs',
            'el-tag': '.el-tag',
            'el-tree': '.el-tree',
            'el-upload': '.el-upload',
            'el-date-picker': '.el-date-editor',
            'el-checkbox': '.el-checkbox',
            'el-radio': '.el-radio',
            'el-dropdown': '.el-dropdown',
            'el-popover': '.el-popover',
            'el-tooltip': '.el-tooltip',
        },
    };
}
function extractTemplate(vueContent) {
    const match = vueContent.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    return match ? match[1] : '';
}
function inferSelectors(template, adapter, componentFile) {
    const selectors = [];
    const lines = template.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 匹配 UI 框架组件标签
        for (const [tag, cssSelector] of Object.entries(adapter.selectorMapping)) {
            const tagRegex = new RegExp(`<${tag}[\\s>]`, 'g');
            if (tagRegex.test(line)) {
                const attributes = {};
                // 提取常用属性
                const attrPatterns = [
                    ['data-testid', /data-testid=["']([^"']+)["']/],
                    ['id', /\bid=["']([^"']+)["']/],
                    ['class', /\bclass=["']([^"']+)["']/],
                    ['type', /\btype=["']([^"']+)["']/],
                    ['placeholder', /\bplaceholder=["']([^"']+)["']/],
                ];
                for (const [name, regex] of attrPatterns) {
                    const attrMatch = line.match(regex);
                    if (attrMatch)
                        attributes[name] = attrMatch[1];
                }
                // 提取文本内容（如按钮文字）
                const textMatch = line.match(new RegExp(`<${tag}[^>]*>([^<]+)<`));
                if (textMatch)
                    attributes['text'] = textMatch[1].trim();
                // data-testid 优先：有 testid 时用 getByTestId，无则保持 CSS 映射
                const finalSelector = attributes['data-testid']
                    ? `getByTestId('${attributes['data-testid']}')`
                    : cssSelector;
                selectors.push({
                    component: path.basename(componentFile, '.vue'),
                    tag,
                    cssSelector: finalSelector,
                    confidence: attributes['data-testid'] ? 'verified' : 'inferred',
                    attributes,
                    line: i + 1,
                });
            }
        }
        // 提取 data-testid 属性（不限于 UI 框架组件）
        const testIdMatch = line.match(/data-testid=["']([^"']+)["']/);
        if (testIdMatch) {
            const existing = selectors.find(s => s.attributes['data-testid'] === testIdMatch[1]);
            if (!existing) {
                selectors.push({
                    component: path.basename(componentFile, '.vue'),
                    tag: 'custom',
                    cssSelector: `getByTestId('${testIdMatch[1]}')`,
                    confidence: 'verified',
                    attributes: { 'data-testid': testIdMatch[1] },
                    line: i + 1,
                });
            }
        }
    }
    return selectors;
}
function main() {
    const { components, adapterPath, output } = parseArgs();
    const adapter = loadAdapter(adapterPath);
    if (components.length === 0) {
        console.error('[WARN] 未指定组件文件，使用 --components 参数');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify({ components: [], adapter: adapter.uiLibrary }, null, 2));
        process.exit(0);
    }
    const results = [];
    for (const file of components) {
        if (!fs.existsSync(file)) {
            console.warn(`[WARN] 文件不存在: ${file}`);
            continue;
        }
        const content = fs.readFileSync(file, 'utf-8');
        const template = extractTemplate(content);
        if (!template)
            continue;
        const selectors = inferSelectors(template, adapter, file);
        if (selectors.length > 0) {
            results.push({ file, selectors });
        }
    }
    const skeleton = {
        extractedAt: new Date().toISOString(),
        adapter: { framework: adapter.framework, uiLibrary: adapter.uiLibrary },
        componentCount: results.length,
        totalSelectors: results.reduce((sum, r) => sum + r.selectors.length, 0),
        components: results,
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(skeleton, null, 2));
    console.log(`[OK] DOM 推断完成: ${results.length} 个组件, ${skeleton.totalSelectors} 个选择器`);
    for (const r of results.slice(0, 5)) {
        console.log(`  ${path.basename(r.file)}: ${r.selectors.length} 个选择器`);
    }
}
main();
