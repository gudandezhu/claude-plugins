#!/usr/bin/env node
/**
 * TASKS.json 操作工具 (Node.js 版本)
 * 用法: node tasks.js <command> [args]
 */

const fs = require('fs').promises;
const path = require('path');

const TASKS_FILE = path.join(process.env.AI_DOCS_PATH || './ai-docs', 'TASKS.json');

/**
 * 确保 TASKS.json 存在
 */
async function initTasks() {
    try {
        await fs.access(TASKS_FILE);
    } catch {
        await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true });
        await fs.writeFile(TASKS_FILE, JSON.stringify({
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
    const content = await fs.readFile(TASKS_FILE, 'utf-8');
    return JSON.parse(content);
}

/**
 * 写入 TASKS.json
 */
async function writeTasks(data) {
    await fs.writeFile(TASKS_FILE, JSON.stringify(data, null, 2));
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
 */
async function addTask(priority, description) {
    if (!priority || !description) {
        console.error('Usage: node tasks.js add <P0|P1|P2|P3> <description>');
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

    // 添加任务
    data.tasks.push({
        id: newId,
        priority,
        status: 'pending',
        description
    });

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

    console.log(`${nextTask.id}|${nextTask.priority}|${nextTask.description}`);
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
        console.log(`${task.id}|${task.priority}|${task.description}`);
    }
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
        default:
            console.error(`Unknown command: ${command}`);
            console.error('Usage: node tasks.js <list|add|update|get-next|get-by-status> [args]');
            process.exit(1);
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
