#!/usr/bin/env node
/**
 * TASKS.json 操作工具 (Node.js 版本)
 * 用法: node tasks.js <command> [args]
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * 智能检测 ai-docs 目录
 */
function findAiDocsPath() {
    // 1. 优先使用环境变量
    if (process.env.AI_DOCS_PATH) {
        return process.env.AI_DOCS_PATH;
    }

    // 2. 尝试从 git 根目录查找
    try {
        const gitRoot = execSync('git rev-parse --show-toplevel', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
        }).trim();

        if (gitRoot) {
            const gitRootAiDocs = path.join(gitRoot, 'ai-docs');
            if (fs.existsSync(gitRootAiDocs)) {
                return gitRootAiDocs;
            }
        }
    } catch (e) {
        // 不是 git 仓库或 git 命令失败
    }

    // 3. 向上查找 ai-docs 目录
    let currentDir = process.cwd();
    while (currentDir !== path.parse(currentDir).root) {
        const aiDocsPath = path.join(currentDir, 'ai-docs');
        if (fs.existsSync(aiDocsPath)) {
            return aiDocsPath;
        }
        currentDir = path.dirname(currentDir);
    }

    // 4. 再次尝试使用 git 根目录（即使 ai-docs 不存在）
    try {
        const gitRoot = execSync('git rev-parse --show-toplevel', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
        }).trim();

        if (gitRoot) {
            return path.join(gitRoot, 'ai-docs');
        }
    } catch (e) {
        // 不是 git 仓库或 git 命令失败
    }

    // 5. 最后使用当前目录
    return path.join(process.cwd(), 'ai-docs');
}

const AI_DOCS_PATH = findAiDocsPath();
const TASKS_FILE = path.join(AI_DOCS_PATH, 'TASKS.json');

/**
 * 确保 TASKS.json 存在
 */
async function initTasks() {
    try {
        await fsPromises.access(TASKS_FILE);
    } catch {
        await fsPromises.mkdir(path.dirname(TASKS_FILE), { recursive: true });
        await fsPromises.writeFile(TASKS_FILE, JSON.stringify({
            iteration: 1,
            tasks: []
        }, null, 2));
    }
}

/**
 * 读取 TASKS.json
 */
async function readTasks() {
    await initTasks();
    const content = await fsPromises.readFile(TASKS_FILE, 'utf-8');
    return JSON.parse(content);
}

/**
 * 写入 TASKS.json
 */
async function writeTasks(data) {
    await fsPromises.writeFile(TASKS_FILE, JSON.stringify(data, null, 2));
}

/**
 * 列出所有任务
 */
async function listTasks() {
    const data = await readTasks();
    console.log(JSON.stringify(data, null, 2));
}

/**
 * 添加新任务
 * 支持三种格式：
 * 1. 简单格式: node tasks.js add P0 "描述"
 * 2. JSON 文件: node tasks.js add /path/to/task.json
 * 3. JSON 字符串: node tasks.js add '{"priority":"P0","title":"..."}'
 */
async function addTask(priority, description) {
    if (!priority) {
        console.error('Usage: node tasks.js add <P0|P1|P2|P3> <description> | <json_file> | <json_string>');
        process.exit(1);
    }

    const data = await readTasks();

    // 生成新的任务 ID
    const maxId = data.tasks
        .map(t => parseInt(t.id.replace('TASK-', '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a)[0] || 0;

    const newNum = maxId + 1;
    const newId = `TASK-${String(newNum).padStart(3, '0')}`;

    let taskData = {
        id: newId,
        status: 'pending'
    };

    // 检测参数格式
    // 1. 检查是否是文件路径
    if (fs.existsSync(priority)) {
        // JSON 文件模式
        try {
            const fileContent = await fsPromises.readFile(priority, 'utf-8');
            const jsonTask = JSON.parse(fileContent);
            taskData = { ...taskData, ...jsonTask, id: newId };
        } catch (err) {
            console.error(`Failed to read or parse JSON file: ${err.message}`);
            process.exit(1);
        }
    }
    // 2. 检查是否是 JSON 字符串
    else if (priority.startsWith('{')) {
        try {
            const jsonTask = JSON.parse(priority);
            taskData = { ...taskData, ...jsonTask, id: newId };
        } catch (err) {
            console.error(`Failed to parse JSON string: ${err.message}`);
            process.exit(1);
        }
    }
    // 3. 简单格式（向后兼容）
    else {
        taskData.priority = priority;
        taskData.description = description;
    }

    // 确保 title 字段存在（用于 get-next 输出）
    if (!taskData.title) {
        taskData.title = taskData.description || 'Untitled';
    }

    // 添加任务
    data.tasks.push(taskData);
    await writeTasks(data);
    console.log(newId);
}

/**
 * 更新任务状态
 */
async function updateTask(taskId, newStatus) {
    if (!taskId || !newStatus) {
        console.error('Usage: node tasks.js update <task_id> <status>');
        process.exit(1);
    }

    const data = await readTasks();

    const task = data.tasks.find(t => t.id === taskId);
    if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
    }

    task.status = newStatus;
    await writeTasks(data);
    console.log(`Updated ${taskId} to ${newStatus}`);
}

/**
 * 获取下一个要处理的任务
 */
async function getNextTask() {
    const data = await readTasks();

    // 优先级顺序
    const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    const statusOrder = ['bug', 'inProgress', 'testing', 'tested', 'pending'];

    const sortedTasks = data.tasks.sort((a, b) => {
        const statusDiff = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        if (statusDiff !== 0) return statusDiff;
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const nextTask = sortedTasks.find(t => t.status !== 'completed');
    if (!nextTask) {
        console.log('No pending tasks');
        return;
    }

    // 使用 title 字段（优先）或 description（向后兼容）
    const displayTitle = nextTask.title || nextTask.description;
    console.log(`${nextTask.id}|${nextTask.priority}|${displayTitle}`);
}

/**
 * 按状态获取任务
 */
async function getByStatus(status) {
    if (!status) {
        console.error('Usage: node tasks.js get-by-status <status>');
        process.exit(1);
    }

    const data = await readTasks();
    const tasks = data.tasks.filter(t => t.status === status);

    for (const task of tasks) {
        console.log(`${task.id}|${task.priority}|${task.title || task.description}`);
    }
}

/**
 * 获取任务详情（完整上下文）
 * 输出格式：JSON
 */
async function getTaskDetail(taskId) {
    if (!taskId) {
        console.error('Usage: node tasks.js get-detail <task_id>');
        process.exit(1);
    }

    const data = await readTasks();
    const task = data.tasks.find(t => t.id === taskId);

    if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
    }

    // 输出完整 JSON（包含 context 和 implementation）
    console.log(JSON.stringify(task, null, 2));
}

/**
 * 获取任务状态（仅状态字符串）
 */
async function getTaskStatus(taskId) {
    if (!taskId) {
        console.error('Usage: node tasks.js get-status <task_id>');
        process.exit(1);
    }

    const data = await readTasks();
    const task = data.tasks.find(t => t.id === taskId);

    if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
    }

    console.log(task.status);
}

/**
 * 主函数
 */
async function main() {
    const command = process.argv[2] || 'list';

    switch (command) {
        case 'list':
            await listTasks();
            break;
        case 'add':
            await addTask(process.argv[3], process.argv.slice(4).join(' '));
            break;
        case 'update':
            await updateTask(process.argv[3], process.argv[4]);
            break;
        case 'get-next':
            await getNextTask();
            break;
        case 'get-by-status':
            await getByStatus(process.argv[3]);
            break;
        case 'get-detail':
            await getTaskDetail(process.argv[3]);
            break;
        case 'get-status':
            await getTaskStatus(process.argv[3]);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            console.error('Usage: node tasks.js <list|add|update|get-next|get-by-status|get-detail|get-status> [args]');
            process.exit(1);
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
