#!/usr/bin/env node
"use strict";
/**
 * gen-selectors.js — T2.3
 * 从探测数据 + 功能树生成共享选择器模块（selectors/{page}-selectors.ts）
 *
 * 用法:
 *   node gen-selectors.js --probe <probe.json> --tree-index <index.json> --page <PAGE> --output <selectors-dir>
 *   node gen-selectors.js --probe-dir <probe-data-dir> --tree-index <index.json> --output <selectors-dir>
 *   node gen-selectors.js --dom-probe <dom-probe.md> [--tree-index <index.json>] --output <selectors-dir>
 *
 * 输出: selectors/{page}-selectors.ts
 * --tree-index 可选：存在时按功能树分组，不存在时按页面名分组
 *
 * 选择器类型：
 *   - CSS 选择器 → 字符串常量
 *   - getByRole/getByLabel/getByPlaceholder/getByText → 工厂函数 (page: Page) => Locator
 *
 * diff 粒度：按选择器常量级别对比（新增/替换/跳过）
 */
const fs = require("fs");
const path = require("path");
const { safeReadJson } = require("../lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  let probe = "", probeDir = "", domProbe = "", treeIndex = "", page = "", output = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--probe" && argv[i + 1]) probe = argv[++i];
    if (argv[i] === "--probe-dir" && argv[i + 1]) probeDir = argv[++i];
    if (argv[i] === "--dom-probe" && argv[i + 1]) domProbe = argv[++i];
    if (argv[i] === "--tree-index" && argv[i + 1]) treeIndex = argv[++i];
    if (argv[i] === "--page" && argv[i + 1]) page = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
  }
  if (!output) { console.error("[FAIL] --output is required"); process.exit(1); }
  if (!probe && !probeDir && !domProbe) { console.error("[FAIL] --probe, --probe-dir, or --dom-probe is required"); process.exit(1); }
  return { probe, probeDir, domProbe, treeIndex, page, output };
}

/**
 * Convert a feature/element description to camelCase selector name.
 * "关键词搜索" → "searchInput", "查询按钮" → "searchBtn"
 * Falls back to sanitized original if no mapping found.
 */
function toSelectorName(description, elementType) {
  // Common suffix mappings based on element type
  const typeSuffix = {
    input: "Input", select: "Select", button: "Btn",
    textarea: "Textarea", checkbox: "Checkbox", radio: "Radio",
    link: "Link", table: "Table", row: "Row", cell: "Cell",
  };
  // Clean description: remove Chinese punctuation, take first meaningful part
  const clean = description.replace(/[：:，,。.；;（()）\s]+/g, " ").trim().split(" ")[0];
  // Simple pinyin-free approach: use description as-is for now, AI will refine
  const suffix = typeSuffix[elementType] || "";
  const base = clean.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
  return base + suffix;
}

/**
 * Determine if a selector string is a Playwright semantic selector (needs factory function)
 * vs a plain CSS selector (string constant).
 */
function isSemanticSelector(selector) {
  return /^getBy(Role|Label|Placeholder|Text|TestId)\(/.test(selector);
}

/**
 * Generate TypeScript code for a single selector constant.
 */
function generateSelectorCode(name, selector, elementType) {
  if (isSemanticSelector(selector)) {
    // Factory function: (page: Page) => page.getByRole(...)
    return `    ${name}: (page: Page) => page.${selector},`;
  }
  // Plain CSS string
  return `    ${name}: '${selector.replace(/'/g, "\\'")}',`;
}

/**
 * Parse probe data JSON and extract selectors grouped by feature group.
 * Probe data format (from dom-probe):
 *   { pages: [{ route, elements: [{ selector, type, description, group? }] }] }
 */
function parseProbeData(probeData, pageId, index) {
  const page = index.pages[pageId];
  if (!page) return {};

  const groupedSelectors = {};
  const groups = page.groups || {};

  // Initialize groups from feature tree
  for (const [groupId, group] of Object.entries(groups)) {
    groupedSelectors[groupId] = {
      name: group.name,
      selectors: [],
    };
  }

  // Map probe elements to groups (by description matching or explicit group tag)
  const elements = probeData.elements || probeData.selectors || [];
  for (const el of elements) {
    const groupId = el.group || guessGroup(el, groups, pageId);
    if (!groupId || !groupedSelectors[groupId]) {
      // Create a catch-all group for unmatched elements
      if (!groupedSelectors[`${pageId}-MISC`]) {
        groupedSelectors[`${pageId}-MISC`] = { name: "其他元素", selectors: [] };
      }
      groupedSelectors[`${pageId}-MISC`].selectors.push(el);
    } else {
      groupedSelectors[groupId].selectors.push(el);
    }
  }

  return groupedSelectors;
}

/**
 * Guess which feature group an element belongs to based on description keywords.
 */
function guessGroup(element, groups, pageId) {
  const desc = (element.description || element.label || "").toLowerCase();
  for (const [groupId, group] of Object.entries(groups)) {
    const groupName = (group.name || "").toLowerCase();
    // Simple keyword matching
    if (desc.includes(groupName) || groupName.includes(desc.slice(0, 4))) {
      return groupId;
    }
  }
  return null;
}

/**
 * Parse dom-probe.md (markdown) to extract pages and selectors.
 * Returns a map of pageId → { name, selectors: [{ selector, type, description }] }
 */
function parseDomProbeMarkdown(content) {
  const pages = {};
  if (!content) return pages;
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const pageRegex = /### 页面：(.+)\n/g;
  let match;
  while ((match = pageRegex.exec(normalized)) !== null) {
    const pageName = match[1].trim();
    const pageStart = match.index;
    const nextPage = normalized.indexOf("### 页面：", pageStart + 1);
    const pageContent = nextPage > 0
      ? normalized.substring(pageStart, nextPage)
      : normalized.substring(pageStart);
    // Extract selectors from tables: | description | `selector` | verified/inferred | type |
    const selectors = [];
    const selectorRegex = /\|\s*(.+?)\s*\|\s*`(.+?)`\s*\|\s*(?:verified|inferred)\s*\|\s*(.+?)\s*\|/g;
    let sMatch;
    while ((sMatch = selectorRegex.exec(pageContent)) !== null) {
      selectors.push({
        description: sMatch[1].trim(),
        selector: sMatch[2].trim(),
        type: sMatch[3].trim(),
      });
    }
    // Also extract form field selectors from interaction probing sections
    const fieldRegex = /\|\s*(.+?)\s*\|\s*`(.+?)`\s*\|\s*(input|select|textarea|date|number|radio|checkbox|switch)\s*\|/gi;
    let fMatch;
    while ((fMatch = fieldRegex.exec(pageContent)) !== null) {
      // Avoid duplicates with key element selectors
      if (!selectors.some(s => s.selector === fMatch[2].trim())) {
        selectors.push({
          description: fMatch[1].trim(),
          selector: fMatch[2].trim(),
          type: fMatch[3].trim(),
        });
      }
    }
    // Use page name as key (keep Chinese characters for readability)
    const pageId = pageName.replace(/[^\w一-龥]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "page";
    pages[pageId] = { name: pageName, selectors };
  }
  return pages;
}

/**
 * Generate the full selectors TypeScript file for a page.
 */
function generateSelectorsFile(pageId, groupedSelectors, pageName) {
  const lines = [];
  lines.push(`// selectors/${pageId.toLowerCase()}-selectors.ts`);
  lines.push(`// ${pageName}选择器——由 gen-selectors.js 从探测数据自动生成`);
  lines.push(`//`);
  lines.push(`// 选择器类型说明：`);
  lines.push(`//   - CSS 选择器字符串：直接用于 page.locator()`);
  lines.push(`//   - 工厂函数 (page) => Locator：用于 Playwright 语义选择器`);
  lines.push(``);
  lines.push(`import { Page, Locator } from '@playwright/test';`);
  lines.push(``);
  lines.push(`/** 解析选择器：字符串走 locator()，函数走直接调用 */`);
  lines.push(`export type Selector = string | ((page: Page) => Locator);`);
  lines.push(`export function $(page: Page, selector: Selector): Locator {`);
  lines.push(`  return typeof selector === 'function' ? selector(page) : page.locator(selector);`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export const ${pageId} = {`);

  for (const [groupId, group] of Object.entries(groupedSelectors)) {
    if (group.selectors.length === 0) continue;
    const shortGroup = groupId.replace(`${pageId}-`, "");
    lines.push(`  // --- ${groupId} ${group.name} ---`);
    lines.push(`  ${shortGroup}: {`);
    for (const el of group.selectors) {
      const name = el.name || toSelectorName(el.description || el.label || "element", el.type);
      const selector = el.selector || el.css || "";
      if (!selector) continue;
      lines.push(`  ${generateSelectorCode(name, selector, el.type)}`);
    }
    lines.push(`  },`);
    lines.push(``);
  }

  lines.push(`} as const;`);
  lines.push(``);
  return lines.join("\n");
}

/**
 * Diff existing selectors file with new data at constant level.
 * Returns: { added: [], changed: [], unchanged: [], removed: [] }
 */
function diffSelectors(existingContent, newContent) {
  const extractConstants = (content) => {
    const map = {};
    const regex = /(\w+):\s*(?:'([^']*)'|(\(page:\s*Page\)\s*=>\s*page\.\w+\([^)]*\)))/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      map[m[1]] = m[2] || m[3];
    }
    return map;
  };

  const existing = extractConstants(existingContent);
  const updated = extractConstants(newContent);

  const added = [], changed = [], unchanged = [], removed = [];
  for (const [name, value] of Object.entries(updated)) {
    if (!(name in existing)) added.push(name);
    else if (existing[name] !== value) changed.push(name);
    else unchanged.push(name);
  }
  for (const name of Object.keys(existing)) {
    if (!(name in updated)) removed.push(name);
  }

  return { added, changed, unchanged, removed };
}

function main() {
  const { probe, probeDir, domProbe, treeIndex, page, output } = parseArgs();

  let resolvedIndex = null;
  if (treeIndex && fs.existsSync(treeIndex)) {
    const index = safeReadJson(treeIndex, { fallback: {} });
    resolvedIndex = index.functionTree && index.status ? index.functionTree : index;
  }

  // --dom-probe mode: parse markdown directly (no tree-index required)
  if (domProbe) {
    if (!fs.existsSync(domProbe)) {
      console.error(`[FAIL] --dom-probe file not found: ${domProbe}`);
      process.exit(1);
    }
    const content = fs.readFileSync(domProbe, "utf-8");
    const domProbePages = parseDomProbeMarkdown(content);
    const pageIds = Object.keys(domProbePages);
    if (pageIds.length === 0) {
      console.log("[WARN] dom-probe.md contains no page sections, skipping selector generation");
      process.exit(0);
    }
    fs.mkdirSync(output, { recursive: true });
    let totalGenerated = 0;
    for (const [pageId, pageInfo] of Object.entries(domProbePages)) {
      if (!pageInfo.selectors || pageInfo.selectors.length === 0) {
        console.log(`[WARN] No selectors found for page "${pageInfo.name}", skipping`);
        continue;
      }
      const groupedSelectors = {
        [pageId]: { name: pageInfo.name, selectors: pageInfo.selectors }
      };
      const fileContent = generateSelectorsFile(pageId, groupedSelectors, pageInfo.name);
      const outputFile = path.join(output, `${pageId}-selectors.ts`);
      if (fs.existsSync(outputFile)) {
        const existing = fs.readFileSync(outputFile, "utf-8");
        const diff = diffSelectors(existing, fileContent);
        if (diff.added.length === 0 && diff.changed.length === 0) {
          console.log(`[OK] ${pageId}: no changes (${diff.unchanged.length} selectors unchanged)`);
          continue;
        }
        fs.writeFileSync(outputFile, fileContent, "utf-8");
        console.log(`[OK] ${pageId}: updated (+${diff.added.length} added, ~${diff.changed.length} changed)`);
      } else {
        fs.writeFileSync(outputFile, fileContent, "utf-8");
        console.log(`[OK] ${pageId}: generated (${pageInfo.selectors.length} selectors)`);
        totalGenerated++;
      }
    }
    // Generate index.ts
    const indexLines = [`// selectors/index.ts — 统一导出`, ``];
    for (const pageId of pageIds) {
      const fileName = `${pageId}-selectors`;
      const filePath = path.join(output, `${fileName}.ts`);
      if (fs.existsSync(filePath)) {
        indexLines.push(`export { ${pageId} } from './${fileName}';`);
      }
    }
    if (pageIds.length > 0) {
      indexLines.push(`export type { Selector } from './${pageIds[0]}-selectors';`);
      indexLines.push(`export { $ } from './${pageIds[0]}-selectors';`);
    }
    indexLines.push(``);
    fs.writeFileSync(path.join(output, "index.ts"), indexLines.join("\n"), "utf-8");
    console.log(`\n[OK] Bootstrap selectors from dom-probe.md: ${totalGenerated} pages`);
    return;
  }

  // Original mode: JSON probe data + tree-index
  if (!resolvedIndex) {
    console.error("[FAIL] --tree-index is required when not using --dom-probe");
    process.exit(1);
  }

  fs.mkdirSync(output, { recursive: true });

  // Determine which pages to process
  const pagesToProcess = page ? [page] : Object.keys(resolvedIndex.pages);

  let totalGenerated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const pageId of pagesToProcess) {
    const pageInfo = resolvedIndex.pages[pageId];
    if (!pageInfo) {
      console.log(`[WARN] Page ${pageId} not found in index, skipping`);
      continue;
    }

    // Find probe data for this page
    let probeData = null;
    if (probe) {
      probeData = safeReadJson(probe, { fallback: null });
    } else if (probeDir) {
      const probePath = path.join(probeDir, `${pageId}.probe.json`);
      if (fs.existsSync(probePath)) {
        probeData = safeReadJson(probePath, { fallback: null });
      }
    }

    if (!probeData) {
      console.log(`[WARN] No probe data for ${pageId}, skipping selector generation`);
      totalSkipped++;
      continue;
    }

    // Parse and group selectors
    const groupedSelectors = parseProbeData(probeData, pageId, resolvedIndex);

    // Generate new content
    const newContent = generateSelectorsFile(pageId, groupedSelectors, pageInfo.name);

    // Check if file exists for diff
    const outputFile = path.join(output, `${pageId.toLowerCase()}-selectors.ts`);
    if (fs.existsSync(outputFile)) {
      const existingContent = fs.readFileSync(outputFile, "utf-8");
      const diff = diffSelectors(existingContent, newContent);

      if (diff.added.length === 0 && diff.changed.length === 0) {
        console.log(`[OK] ${pageId}: no changes (${diff.unchanged.length} selectors unchanged)`);
        totalSkipped++;
        continue;
      }

      // Write updated file
      fs.writeFileSync(outputFile, newContent, "utf-8");
      console.log(`[OK] ${pageId}: updated (+${diff.added.length} added, ~${diff.changed.length} changed, ${diff.unchanged.length} unchanged)`);
      totalUpdated++;
    } else {
      // New file
      fs.writeFileSync(outputFile, newContent, "utf-8");
      const selectorCount = (newContent.match(/:\s*(?:'|(\(page))/g) || []).length;
      console.log(`[OK] ${pageId}: generated (${selectorCount} selectors)`);
      totalGenerated++;
    }
  }

  // Generate index.ts (type-only re-export)
  const indexLines = [`// selectors/index.ts — 统一导出（脚本推荐直接 import 具体页面文件）`, ``];
  for (const pageId of pagesToProcess) {
    const fileName = `${pageId.toLowerCase()}-selectors`;
    const filePath = path.join(output, `${fileName}.ts`);
    if (fs.existsSync(filePath)) {
      indexLines.push(`export { ${pageId} } from './${fileName}';`);
    }
  }
  indexLines.push(`export type { Selector } from './${pagesToProcess[0]?.toLowerCase() || "prql"}-selectors';`);
  indexLines.push(`export { $ } from './${pagesToProcess[0]?.toLowerCase() || "prql"}-selectors';`);
  indexLines.push(``);
  fs.writeFileSync(path.join(output, "index.ts"), indexLines.join("\n"), "utf-8");

  console.log(`\n[OK] Selectors: ${totalGenerated} generated, ${totalUpdated} updated, ${totalSkipped} skipped`);
}

main();
