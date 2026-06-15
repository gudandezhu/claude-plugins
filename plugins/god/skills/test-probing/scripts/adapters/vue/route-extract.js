#!/usr/bin/env node
"use strict";
/**
 * TASK-08: route-extract.js (Vue 适配器)
 * 从 Vue Router 配置文件提取路由信息
 *
 * 用法：node route-extract.js --project /path/to/frontend
 * 输出：testing/.cache/routes.json
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
    let project = '.';
    let output = 'testing/.cache/routes.json';
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--project' && argv[i + 1])
            project = argv[++i];
        if (argv[i] === '--output' && argv[i + 1])
            output = argv[++i];
    }
    return { project, output };
}
function findRouterFiles(projectDir) {
    const candidates = [
        'src/router/index.ts',
        'src/router/index.js',
        'src/router.ts',
        'src/router.js',
    ];
    const found = [];
    for (const c of candidates) {
        const full = path.join(projectDir, c);
        if (fs.existsSync(full))
            found.push(full);
    }
    // 递归搜索 router 目录下的所有 ts/js 文件
    const routerDir = path.join(projectDir, 'src/router');
    if (fs.existsSync(routerDir)) {
        function walk(dir) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory())
                    walk(full);
                else if (/\.(ts|js)$/.test(entry.name) && !found.includes(full))
                    found.push(full);
            }
        }
        walk(routerDir);
    }
    return found;
}
function extractRoutes(content) {
    const routes = [];
    // 正则匹配路由定义：{ path: '...', name: '...', component: ... }
    // 支持单引号和双引号
    const routePattern = /\{\s*path:\s*['"`]([^'"`]+)['"`](?:[\s\S]*?name:\s*['"`]([^'"`]*)['"`])?(?:[\s\S]*?component:\s*(?:(?:\(\)\s*=>\s*import\(['"`]([^'"`]+)['"`]\))|([A-Za-z_$][A-Za-z0-9_$]*)))?/g;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
        const routePath = match[1];
        const name = match[2] || null;
        const componentImport = match[3] || match[4] || null;
        // 跳过重定向路由和布局路由
        if (routePath === '/' && !name)
            continue;
        if (routePath === '*' || routePath === '/:pathMatch(.*)')
            continue;
        routes.push({
            path: routePath,
            name,
            component: componentImport,
            children: [],
            meta: {},
        });
    }
    return routes;
}
function main() {
    const { project, output } = parseArgs();
    if (!fs.existsSync(project)) {
        console.error(`[FAIL] 项目目录不存在: ${project}`);
        process.exit(1);
    }
    const routerFiles = findRouterFiles(project);
    if (routerFiles.length === 0) {
        console.error(`[WARN] 未找到路由配置文件`);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify({ routes: [], files: [] }, null, 2));
        process.exit(0);
    }
    const allRoutes = [];
    for (const file of routerFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const routes = extractRoutes(content);
        allRoutes.push(...routes);
    }
    // 去重
    const seen = new Set();
    const uniqueRoutes = allRoutes.filter(r => {
        const key = r.path;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    const result = {
        extractedAt: new Date().toISOString(),
        files: routerFiles.map(f => path.relative(project, f)),
        routeCount: uniqueRoutes.length,
        routes: uniqueRoutes,
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(`[OK] 提取 ${uniqueRoutes.length} 条路由 (从 ${routerFiles.length} 个文件)`);
    for (const r of uniqueRoutes.slice(0, 10)) {
        console.log(`  ${r.path}${r.name ? ` (${r.name})` : ''}`);
    }
    if (uniqueRoutes.length > 10)
        console.log(`  ... 共 ${uniqueRoutes.length} 条`);
}
main();
