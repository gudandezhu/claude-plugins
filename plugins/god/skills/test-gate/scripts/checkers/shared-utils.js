#!/usr/bin/env node
"use strict";
/**
 * shared-utils.js
 * gate-check 各 checker 模块共享的工具函数和缓存。
 */
const fs = require("fs");
const path = require("path");

// ─── 文件列表缓存 ─────────────────────────────────────────
const _fileListCache = new Map();
const _fileContentCache = new Map();

/**
 * 递归查找匹配正则的文件
 * @param {string} dir
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function findFiles(dir, pattern) {
    const cacheKey = `${dir}::${pattern.source}`;
    if (_fileListCache.has(cacheKey)) return _fileListCache.get(cacheKey);
    const results = [];
    if (!fs.existsSync(dir)) {
        _fileListCache.set(cacheKey, results);
        return results;
    }
    function walk(d) {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (pattern.test(entry.name)) results.push(full);
        }
    }
    walk(dir);
    _fileListCache.set(cacheKey, results);
    return results;
}

/**
 * 带缓存读取文件内容
 * @param {string} filePath
 * @returns {string}
 */
function readFileContent(filePath) {
    if (_fileContentCache.has(filePath)) return _fileContentCache.get(filePath);
    const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    _fileContentCache.set(filePath, content);
    return content;
}

/**
 * 提取 test() 块内容（追踪花括号深度），供步骤 4a-4e 复用
 * @param {string} content
 * @returns {Array<{name: string, start: number, end: number, body: string}>}
 */
function extractTestBlocks(content) {
    const blocks = [];
    const testStartPat = /\btest\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*async\s*\([^)]*\)\s*=>\s*\{/g;
    let m;
    while ((m = testStartPat.exec(content)) !== null) {
        const name = m[1];
        const start = m.index + m[0].length - 1; // 指向开括号 {
        let depth = 1, i = start + 1;
        while (i < content.length && depth > 0) {
            if (content[i] === '{') depth++;
            else if (content[i] === '}') depth--;
            i++;
        }
        blocks.push({ name, start, end: i, body: content.slice(start + 1, i - 1) });
    }
    return blocks;
}

/**
 * 提取 TC 编号列表（去重）
 * @param {string} content
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function extractTcIds(content, pattern) {
    const ids = [];
    let match;
    while ((match = pattern.exec(content)) !== null) {
        ids.push(match[1] || match[0]);
    }
    return [...new Set(ids)];
}

/**
 * 通用的 E2E spec 文件遍历检查函数
 * @param {string} e2eDir - E2E 测试目录
 * @param {function(string): void} checkFile - 单文件检查回调
 * @param {RegExp} [filePattern] - 文件名匹配正则，默认 /\.spec\.ts$/
 */
function walkSpecFiles(e2eDir, checkFile, filePattern) {
    if (!fs.existsSync(e2eDir)) return;
    const pat = filePattern || /\.spec\.ts$/;
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(fp);
            else if (pat.test(entry.name)) checkFile(fp);
        }
    }
    walk(e2eDir);
}

module.exports = {
    _fileListCache,
    _fileContentCache,
    findFiles,
    readFileContent,
    extractTestBlocks,
    extractTcIds,
    walkSpecFiles,
};
