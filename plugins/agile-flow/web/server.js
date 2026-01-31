#!/usr/bin/env node
/**
 * Agile Flow Web Server
 * 提供 Dashboard 和需求管理接口
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3737;
const HOST = '127.0.0.1'; // 只监听本地，提高安全性

// 获取项目根目录（支持环境变量和命令行参数）
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_ROOT || process.cwd();
const AI_DOCS_PATH = path.join(PROJECT_ROOT, 'ai-docs');
const PLAN_FILE = path.join(AI_DOCS_PATH, 'PLAN.md');
const PRD_FILE = path.join(AI_DOCS_PATH, 'PRD.md');

// 中间件
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

/**
 * HTML 转义函数（防止 XSS）
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 解析 PLAN.md 中的任务数据
 */
async function parsePlan() {
    try {
        const content = await fs.readFile(PLAN_FILE, 'utf-8');
        const lines = content.split('\n');

        const result = {
            iteration: '1',
            total: 0,
            completed: 0,
            pending: [],
            inProgress: [],
            testing: [],
            tested: [],
            bug: [],
            completed: []
        };

        let currentSection = null;

        for (const line of lines) {
            // 提取迭代编号
            const iterMatch = line.match(/\*\*迭代编号\*\*:\s*(\d+)/);
            if (iterMatch) {
                result.iteration = iterMatch[1];
            }

            // 识别章节（使用严格匹配）
            const trimmedLine = line.trim();
            if (trimmedLine === '### 待办' || trimmedLine === '### 待办') currentSection = 'pending';
            else if (trimmedLine === '### 进行中' || trimmedLine === '### 进行中') currentSection = 'inProgress';
            else if (trimmedLine === '### 待测试' || trimmedLine === '### 待测试') currentSection = 'testing';
            else if (trimmedLine === '### 已测试' || trimmedLine === '### 已测试') currentSection = 'tested';
            else if (trimmedLine === '### BUG' || trimmedLine === '### BUG') currentSection = 'bug';
            else if (trimmedLine === '### 已完成' || trimmedLine === '### 已完成') currentSection = 'completed';

            // 提取任务
            if (currentSection && line.trim().startsWith('-')) {
                // 支持两种格式：[- [P0]] 和 [- [P0] ]
                const match = line.match(/\[([P0-3])\]\s*\[?\s*(TASK-\d+)\]?\s*:\s*(.+)/);
                if (match) {
                    const task = {
                        priority: match[1],
                        id: match[2] || `TASK-${result.total + 1}`,
                        description: match[3].trim()
                    };
                    result[currentSection].push(task);
                    result.total++;
                    if (currentSection === 'completed') {
                        result.completed++;
                    }
                }
            }
        }

        const progress = result.total > 0 ? Math.round((result.completed / result.total) * 100) : 0;

        return { ...result, progress };
    } catch (error) {
        console.error('Error parsing PLAN.md:', error.message);
        return {
            iteration: '1',
            total: 0,
            completed: 0,
            progress: 0,
            pending: [],
            inProgress: [],
            testing: [],
            tested: [],
            bug: [],
            completed: []
        };
    }
}

/**
 * GET /api/dashboard - 获取看板数据
 */
app.get('/api/dashboard', async (req, res) => {
    try {
        const data = await parsePlan();

        // 转义所有输出内容，防止 XSS
        const sanitizedData = {
            ...data,
            pending: data.pending.map(t => ({...t, description: escapeHtml(t.description)})),
            inProgress: data.inProgress.map(t => ({...t, description: escapeHtml(t.description)})),
            testing: data.testing.map(t => ({...t, description: escapeHtml(t.description)})),
            tested: data.tested.map(t => ({...t, description: escapeHtml(t.description)})),
            bug: data.bug.map(t => ({...t, description: escapeHtml(t.description)})),
            completed: data.completed.map(t => ({...t, description: escapeHtml(t.description)}))
        };

        res.json(sanitizedData);
    } catch (error) {
        console.error('Error in /api/dashboard:', error);
        res.status(500).json({ error: '获取看板数据失败' });
    }
});

/**
 * POST /api/requirement - 提交需求到需求池
 */
app.post('/api/requirement', async (req, res) => {
    const { requirement } = req.body;

    // 验证输入
    if (!requirement || typeof requirement !== 'string') {
        return res.status(400).json({ error: '需求内容不能为空' });
    }

    // 限制长度（防止 DOS）
    if (requirement.length > 5000) {
        return res.status(400).json({ error: '需求内容过长（最多5000字符）' });
    }

    // 过滤危险字符
    const sanitized = requirement.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    try {
        // 确保目录存在
        await fs.mkdir(AI_DOCS_PATH, { recursive: true });

        // 追加到 PRD.md
        const timestamp = new Date().toLocaleString('zh-CN');
        const entry = `\n## 需求 ${timestamp}\n\n${sanitized}\n\n---\n`;

        await fs.appendFile(PRD_FILE, entry);

        res.json({ success: true, message: '需求已添加到需求池' });
    } catch (error) {
        console.error('Error saving requirement:', error);
        res.status(500).json({ error: '保存需求失败' });
    }
});

/**
 * GET /health - 健康检查
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '4.0.0'
    });
});

/**
 * 错误处理中间件
 */
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: '服务器内部错误' });
});

/**
 * 启动服务器
 */
const server = app.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║     🚀 Agile Flow Web Server                 ║
║                                              ║
║     Dashboard: http://${HOST}:${PORT}          ║
║     API: http://${HOST}:${PORT}/api/*            ║
║     项目目录: ${PROJECT_ROOT}     ║
╚══════════════════════════════════════════════╝
    `);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
