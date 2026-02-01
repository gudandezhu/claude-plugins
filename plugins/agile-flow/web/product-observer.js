#!/usr/bin/env node
/**
 * Product Observer - 产品观察者 (修复版)
 *
 * 持续监控平台，主动发现问题并提出改进建议
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CHECK_INTERVAL = 60000;
const API_BASE = process.env.DASHBOARD_API || 'http://127.0.0.1:3737';
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5173';
const AI_DOCS_PATH = process.env.AI_DOCS_PATH;
const PROJECT_PATH = path.dirname(AI_DOCS_PATH);
const WEBAPP_PATH = path.join(PROJECT_PATH, 'webapp-vue');

// 用于去重的已提交问题
const submittedIssues = new Set();
const MAX_ISSUE_MEMORY = 100;

/**
 * 自定义超时 Fetch
 */
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * 1. Web 应用检查
 */
async function checkWebApp() {
    const observations = [];

    try {
        const startTime = Date.now();
        try {
            const response = await fetchWithTimeout(WEBAPP_URL, { method: 'HEAD' }, 5000);
            const responseTime = Date.now() - startTime;

            if (responseTime > 2000) {
                observations.push({ type: 'performance', priority: 'P1', title: 'Web 应用响应慢', description: `首页加载时间 ${responseTime}ms` });
            } else if (responseTime > 1000) {
                observations.push({ type: 'performance', priority: 'P2', title: 'Web 应用响应可优化', description: `首页加载时间 ${responseTime}ms` });
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                observations.push({ type: 'availability', priority: 'P0', title: 'Web 应用超时', description: '5秒内未响应' });
            } else {
                observations.push({ type: 'availability', priority: 'P1', title: 'Web 应用未运行', description: `无法访问 ${WEBAPP_URL}` });
            }
            return observations;
        }

        // 检查前端代码（带深度限制）
        if (fs.existsSync(WEBAPP_PATH)) {
            const srcPath = path.join(WEBAPP_PATH, 'src');
            if (fs.existsSync(srcPath)) {
                let consoleErrorCount = 0;
                let consoleWarnCount = 0;
                let maxDepth = 5;

                const countConsoles = (dir, depth = 0) => {
                    if (depth > maxDepth) return;

                    try {
                        const files = fs.readdirSync(dir);
                        for (const file of files) {
                            if (file === 'node_modules') continue;

                            const fullPath = path.join(dir, file);
                            try {
                                const stat = fs.statSync(fullPath);
                                if (stat.isDirectory()) {
                                    countConsoles(fullPath, depth + 1);
                                } else if (file.match(/\.(vue|ts|js)$/)) {
                                    const content = fs.readFileSync(fullPath, 'utf-8');
                                    consoleErrorCount += (content.match(/console\.error/g) || []).length;
                                    consoleWarnCount += (content.match(/console\.warn/g) || []).length;
                                }
                            } catch (e) {
                                // 跳过无法访问的文件
                            }
                        }
                    } catch (e) {
                        // 跳过无法访问的目录
                    }
                };

                countConsoles(srcPath);

                if (consoleErrorCount > 10) {
                    observations.push({ type: 'code-quality', priority: 'P1', title: '前端代码存在大量 console.error', description: `发现 ${consoleErrorCount} 处` });
                }
                if (consoleWarnCount > 20) {
                    observations.push({ type: 'code-quality', priority: 'P2', title: '前端代码存在大量 console.warn', description: `发现 ${consoleWarnCount} 处` });
                }
            }
        }
    } catch (error) {
        console.error('Web 应用检查失败:', error.message);
    }

    return observations;
}

/**
 * 2. API 健康检查
 */
async function checkAPIHealth() {
    const observations = [];

    try {
        const startTime = Date.now();
        const response = await fetchWithTimeout(`${API_BASE}/health`, {}, 3000);
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            observations.push({ type: 'availability', priority: 'P0', title: 'Dashboard API 异常', description: `状态码 ${response.status}` });
        }
        if (responseTime > 500) {
            observations.push({ type: 'performance', priority: 'P2', title: 'API 响应慢', description: `${responseTime}ms` });
        }

        const dashStart = Date.now();
        const dashResponse = await fetchWithTimeout(`${API_BASE}/api/dashboard`, {}, 5000);
        const dashTime = Date.now() - dashStart;

        if (!dashResponse.ok) {
            observations.push({ type: 'availability', priority: 'P1', title: 'Dashboard 数据接口异常', description: `状态码 ${dashResponse.status}` });
        }
        if (dashTime > 1000) {
            observations.push({ type: 'performance', priority: 'P2', title: 'Dashboard 数据加载慢', description: `${dashTime}ms` });
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            observations.push({ type: 'availability', priority: 'P0', title: 'API 超时', description: 'API 响应超时' });
        } else {
            observations.push({ type: 'availability', priority: 'P0', title: 'API 不可用', description: error.message });
        }
    }

    return observations;
}

/**
 * 3. 日志分析
 */
async function analyzeLogs() {
    const observations = [];

    try {
        // 修复：使用正确的日志路径
        const logDir = path.join(__dirname, '.logs');

        const serverLog = path.join(logDir, 'server.log');
        if (fs.existsSync(serverLog)) {
            const content = fs.readFileSync(serverLog, 'utf-8');
            const errorCount = (content.match(/error/gi) || []).length;
            const warnCount = (content.match(/warn/gi) || []).length;

            if (errorCount > 5) {
                observations.push({ type: 'stability', priority: 'P1', title: 'Server 日志存在错误', description: `${errorCount} 处错误` });
            }
            if (warnCount > 10) {
                observations.push({ type: 'stability', priority: 'P2', title: 'Server 日志存在警告', description: `${warnCount} 处警告` });
            }
        }

        const observerLog = path.join(logDir, 'observer.log');
        if (fs.existsSync(observerLog)) {
            const content = fs.readFileSync(observerLog, 'utf-8');
            const errorCount = (content.match(/error/gi) || []).length;
            if (errorCount > 3) {
                observations.push({ type: 'stability', priority: 'P2', title: '观察者日志存在错误', description: `${errorCount} 处错误` });
            }
        }

        // 后端日志
        const backendLog = path.join(PROJECT_PATH, 'logs', 'app.log');
        if (fs.existsSync(backendLog)) {
            const content = fs.readFileSync(backendLog, 'utf-8');
            const lastLines = content.split('\n').slice(-50);
            const recentErrors = lastLines.filter(l => l.toLowerCase().includes('error')).length;
            if (recentErrors > 3) {
                observations.push({ type: 'stability', priority: 'P0', title: '后端日志存在错误', description: `最近 50 行有 ${recentErrors} 处错误` });
            }
        }
    } catch (error) {
        console.error('日志分析失败:', error.message);
    }

    return observations;
}

/**
 * 4. 代码质量检查
 */
async function checkCodeQuality() {
    const observations = [];

    try {
        if (fs.existsSync(WEBAPP_PATH)) {
            const packageJson = path.join(WEBAPP_PATH, 'package.json');
            if (fs.existsSync(packageJson)) {
                const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));

                if (!pkg.devDependencies?.eslint && !pkg.dependencies?.eslint) {
                    observations.push({ type: 'code-quality', priority: 'P2', title: '前端缺少 ESLint', description: '建议添加 ESLint' });
                }

                const hasTest = pkg.devDependencies?.vitest || pkg.devDependencies?.jest || pkg.devDependencies?.['@vue/test-utils'];
                if (!hasTest) {
                    observations.push({ type: 'testing', priority: 'P1', title: '前端缺少测试框架', description: '建议添加 Vitest/Jest' });
                }
            }
        }

        // Python 后端检查
        const pyprojectToml = path.join(PROJECT_PATH, 'pyproject.toml');
        if (fs.existsSync(pyprojectToml)) {
            const content = fs.readFileSync(pyprojectToml, 'utf-8');
            if (!content.includes('pytest')) {
                observations.push({ type: 'testing', priority: 'P1', title: '后端缺少 pytest', description: '建议添加 pytest' });
            }
            if (!content.includes('ruff')) {
                observations.push({ type: 'code-quality', priority: 'P2', title: '后端缺少代码检查工具', description: '建议添加 ruff' });
            }
        }
    } catch (error) {
        console.error('代码质量检查失败:', error.message);
    }

    return observations;
}

/**
 * 5. 项目状态检查
 */
async function checkProjectStatus() {
    const observations = [];

    try {
        const tasksFile = path.join(AI_DOCS_PATH, 'TASKS.json');
        if (fs.existsSync(tasksFile)) {
            const content = fs.readFileSync(tasksFile, 'utf-8');
            const data = JSON.parse(content);

            const pendingTasks = data.tasks.filter(t => t.status === 'pending');
            const bugTasks = data.tasks.filter(t => t.status === 'bug');
            const inProgressTasks = data.tasks.filter(t => t.status === 'inProgress');

            if (pendingTasks.length > 15) {
                observations.push({ type: 'process', priority: 'P1', title: '待办任务严重积压', description: `${pendingTasks.length} 个待办` });
            }
            if (bugTasks.length > 5) {
                observations.push({ type: 'quality', priority: 'P0', title: 'Bug 严重积压', description: `${bugTasks.length} 个 Bug` });
            }
            if (inProgressTasks.length > 3) {
                observations.push({ type: 'process', priority: 'P2', title: '并行任务过多', description: `${inProgressTasks.length} 个进行中` });
            }

            const completedTasks = data.tasks.filter(t => t.status === 'completed');
            const progress = data.total > 0 ? (completedTasks.length / data.total * 100).toFixed(1) : 0;
            if (parseFloat(progress) < 30 && data.total > 10) {
                observations.push({ type: 'process', priority: 'P2', title: '项目进度较慢', description: `完成率 ${progress}%` });
            }
        }

        // 文档检查
        const requiredDocs = ['API.md', 'ACCEPTANCE.md', 'CONTEXT.md'];
        for (const doc of requiredDocs) {
            if (!fs.existsSync(path.join(AI_DOCS_PATH, doc))) {
                observations.push({ type: 'documentation', priority: 'P2', title: `缺少文档 ${doc}`, description: 'ai-docs 目录下缺少' });
            }
        }
    } catch (error) {
        console.error('项目状态检查失败:', error.message);
    }

    return observations;
}

/**
 * 6. 生成改进建议
 */
function generateImprovementIdeas() {
    const ideas = [
        { type: 'feature', priority: 'P2', title: '添加暗色主题', description: '支持暗色/亮色主题切换' },
        { type: 'feature', priority: 'P2', title: '添加数据导出', description: '支持导出 CSV/Excel' },
        { type: 'feature', priority: 'P3', title: '添加快捷键', description: '为常用操作添加快捷键' },
        { type: 'performance', priority: 'P1', title: '实现虚拟滚动', description: '大列表性能优化' },
        { type: 'performance', priority: 'P2', title: '添加数据缓存', description: '减少 API 调用' },
    ];

    if (Math.random() > 0.7) {
        return ideas.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 2) + 1);
    }
    return [];
}

/**
 * 提交观察（带去重）
 */
async function submitObservation(observation) {
    const issueKey = `${observation.type}:${observation.title}`;

    // 去重：同一个问题只提交一次
    if (submittedIssues.has(issueKey)) {
        return false;
    }

    // 记录已提交的问题
    submittedIssues.add(issueKey);
    if (submittedIssues.size > MAX_ISSUE_MEMORY) {
        const firstKey = submittedIssues.values().next().value;
        submittedIssues.delete(firstKey);
    }

    try {
        const response = await fetch(`${API_BASE}/api/requirement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requirement: `[${observation.type.toUpperCase()}] ${observation.title}\n\n${observation.description}\n\n优先级: ${observation.priority}`
            })
        });

        if (response.ok) {
            console.log(`✅ ${observation.title}`);
            return true;
        } else {
            console.error(`❌ ${observation.title}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 提交失败: ${observation.title} - ${error.message}`);
        return false;
    }
}

/**
 * 主观察循环
 */
async function observe() {
    console.log('\n🔍 开始观察产品...\n');

    const allObservations = [];

    // 并发执行所有检查
    const checks = [
        checkWebApp(),
        checkAPIHealth(),
        analyzeLogs(),
        checkCodeQuality(),
        checkProjectStatus()
    ];

    const results = await Promise.allSettled(checks);

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            allObservations.push(...result.value);
        } else {
            console.error(`检查 ${index + 1} 失败:`, result.reason.message);
        }
    });

    // 添加改进建议
    const ideas = generateImprovementIdeas();
    allObservations.push(...ideas);

    // 按优先级排序
    allObservations.sort((a, b) => {
        const order = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
        return order[a.priority] - order[b.priority];
    });

    // 提交观察
    if (allObservations.length > 0) {
        console.log(`\n发现 ${allObservations.length} 个问题:\n`);
        let submitted = 0;
        for (const obs of allObservations) {
            if (await submitObservation(obs)) {
                submitted++;
            }
        }
        console.log(`\n✓ 已提交 ${submitted} 个新问题`);
    } else {
        console.log('✓ 未发现问题');
    }

    console.log(`\n⏰ 下次: ${new Date(Date.now() + CHECK_INTERVAL).toLocaleTimeString()}\n`);
}

/**
 * 启动服务
 */
function start() {
    console.log(`
╔══════════════════════════════════════════════╗
║     👁️  Product Observer - 产品观察者        ║
╚══════════════════════════════════════════════╝

项目: ${PROJECT_PATH}
Web: ${WEBAPP_URL}
API: ${API_BASE}
间隔: ${CHECK_INTERVAL / 1000}s

观察: Web、API、日志、代码质量、项目状态
    `);

    observe();
    const interval = setInterval(observe, CHECK_INTERVAL);

    const stop = () => {
        console.log('\n🛑 停止中...\n');
        clearInterval(interval);
        process.exit(0);
    };

    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
}

if (!AI_DOCS_PATH) {
    console.error('❌ AI_DOCS_PATH 环境变量未设置');
    process.exit(1);
}

start();
