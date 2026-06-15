#!/usr/bin/env node
/**
 * incremental-probe.js
 * DOM 增量探测脚本：二次执行时只探测新增/变更的页面，跳过已探测且未变更的页面。
 *
 * 用法：node incremental-probe.js --testing-dir <testing目录> --prd-dir <PRD目录>
 * 输出：stdout 输出需要探测的页面列表（JSON），exit(0) 表示有增量，exit(2) 表示无需探测
 */
"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = null;
  let prdDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--prd-dir" && argv[i + 1]) prdDir = argv[++i];
  }
  if (!testingDir) { console.error("[ERROR] --testing-dir 参数必填"); process.exit(1); }
  return { testingDir, prdDir };
}

/**
 * 从 PRD 功能列表提取页面/功能名称
 */
function extractPrdPages(prdDir) {
  const pages = new Set();
  if (!prdDir || !fs.existsSync(prdDir)) return pages;

  const files = fs.readdirSync(prdDir).filter(f => f.endsWith(".md"));
  for (const f of files) {
    const content = fs.readFileSync(path.join(prdDir, f), "utf-8");
    // 提取功能模块标题（## 或 ### 级别）
    const headings = content.match(/^#{2,3}\s+(.+)/gm) || [];
    for (const h of headings) {
      const name = h.replace(/^#{2,3}\s+/, "").trim();
      // 过滤掉通用标题
      if (name.length >= 2 && name.length <= 30 &&
          !/^(概述|背景|目标|范围|术语|参考|附录|修订|版本|目录|引言|总结)/.test(name)) {
        pages.add(name);
      }
    }
    // 提取表格中的功能名称（| 功能名 | 描述 | 格式）
    const tableRows = content.match(/\|\s*([^|]+?)\s*\|/g) || [];
    for (const row of tableRows) {
      const cell = row.replace(/^\|\s*/, "").replace(/\s*\|$/, "").trim();
      if (cell.length >= 2 && cell.length <= 20 && /[\u4e00-\u9fa5]/.test(cell) &&
          !/^(字段|类型|说明|描述|备注|序号|编号|状态|操作|必填|默认)/.test(cell)) {
        pages.add(cell);
      }
    }
  }
  return pages;
}

/**
 * 从 dom-probe.md 提取已探测的页面名称
 */
function extractProbedPages(testingDir) {
  const probed = new Map(); // name → { route, timestamp }
  const domProbePath = path.join(testingDir, "dom-probe.md");
  if (!fs.existsSync(domProbePath)) return probed;

  const content = fs.readFileSync(domProbePath, "utf-8");
  // 匹配 "### 页面：{名称}" 格式
  const pagePattern = /###\s*页面[：:]\s*(.+)/g;
  let m;
  while ((m = pagePattern.exec(content)) !== null) {
    const name = m[1].trim();
    // 提取该页面章节的路由
    const afterMatch = content.slice(m.index, m.index + 500);
    const routeMatch = afterMatch.match(/实际路由[：:]\s*([^\n]+)/);
    const route = routeMatch ? routeMatch[1].trim() : "";
    probed.set(name, { route });
  }

  // 提取探测时间戳
  const tsMatch = content.match(/探测时间[：:]\s*([^\n]+)/);
  const timestamp = tsMatch ? tsMatch[1].trim() : null;
  if (timestamp) {
    for (const [, v] of probed) v.timestamp = timestamp;
  }

  return probed;
}

/**
 * 从 routes.json 提取路由信息
 */
function extractRoutes(testingDir) {
  const routesPath = path.join(testingDir, ".cache", "routes.json");
  if (!fs.existsSync(routesPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(routesPath, "utf-8"));
  } catch (e) {
    return [];
  }
}

function main() {
  const { testingDir, prdDir } = parseArgs();

  const prdPages = extractPrdPages(prdDir);
  const probedPages = extractProbedPages(testingDir);
  const routes = extractRoutes(testingDir);

  // 判断哪些页面需要探测
  const needProbe = [];
  const skipped = [];

  for (const page of prdPages) {
    const isProbed = probedPages.has(page) ||
      [...probedPages.keys()].some(p => page.includes(p) || p.includes(page));
    if (isProbed) {
      skipped.push(page);
    } else {
      needProbe.push({ name: page, reason: "PRD 中存在但 dom-probe.md 中未探测" });
    }
  }

  // 检查 routes.json 中是否有新路由未探测
  const probedRoutes = new Set([...probedPages.values()].map(v => v.route).filter(Boolean));
  for (const route of routes) {
    const routePath = route.path || route.route || "";
    if (routePath && !probedRoutes.has(routePath)) {
      const alreadyInList = needProbe.some(p => p.route === routePath);
      if (!alreadyInList) {
        needProbe.push({
          name: route.name || routePath,
          route: routePath,
          reason: "routes.json 中存在但 dom-probe.md 中未探测",
        });
      }
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    totalPrdPages: prdPages.size,
    totalProbedPages: probedPages.size,
    needProbe: needProbe.length,
    skipped: skipped.length,
    pages: needProbe,
    skippedPages: skipped,
  };

  // 输出结果
  console.log(JSON.stringify(result, null, 2));

  if (needProbe.length === 0) {
    console.error(`[OK] 所有页面已探测完毕（${probedPages.size} 页），无需增量探测`);
    process.exit(2);
  } else {
    console.error(`[INFO] 需要增量探测 ${needProbe.length} 个页面（已跳过 ${skipped.length} 个已探测页面）`);
    for (const p of needProbe) {
      console.error(`  - ${p.name}: ${p.reason}`);
    }
    process.exit(0);
  }
}

main();
