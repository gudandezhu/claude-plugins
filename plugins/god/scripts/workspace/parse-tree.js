#!/usr/bin/env node
"use strict";
/**
 * parse-tree.js — 统一功能树/菜单树解析器
 *
 * 用法 (三合一，根据参数自动选择模式):
 *   node parse-tree.js --dir <feature-tree-dir>                    → 功能树 → index.json
 *   node parse-tree.js --file <menu-tree.md> [--output out.json]   → 菜单树 JSON
 *   node parse-tree.js --req-dir <req-dir> --output <out.json>     → 扫描并解析两种树 → tree-context.json
 */
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════════
// Mode 1: parse-feature-tree (原 parse-feature-tree.js)
// ═══════════════════════════════════════════════════════════════

function parseFeatureTreeMdFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let page = null;
  let currentGroup = null;
  const groups = {};
  const flows = {};
  const features = [];
  const smokeFeatures = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "").trimEnd();
    if (!line.trim() || line.trim().startsWith("<!--")) continue;

    const match = line.match(/^(\s*)- (.+)$/);
    if (!match) continue;

    const indent = match[1].length;
    const text = match[2].trim();
    const isSmoke = /@smoke\b/.test(text);
    const cleanText = text.replace(/@smoke\b/, "").replace(/@infra-dep:\S+/g, "").trim();

    if (indent === 0) {
      const pageMatch = cleanText.match(/^([A-Z]{2,6})\s+(.+?)\s+(\/\S+.*)$/);
      if (pageMatch) {
        page = { abbr: pageMatch[1], name: pageMatch[2], route: pageMatch[3].split("|").map(s => s.trim()).join(" | "), file: path.basename(filePath) };
      }
      continue;
    }

    if (!page) continue;

    if (indent === 2) {
      const groupMatch = cleanText.match(/^([A-Z][A-Z0-9-]{2,15})\s+(.+)$/);
      if (groupMatch) {
        currentGroup = { id: groupMatch[1], name: groupMatch[2] };
        if (!groups[currentGroup.id]) {
          groups[currentGroup.id] = { name: currentGroup.name, features: [], flows: [] };
        }
      }
      continue;
    }

    if (indent >= 4 && currentGroup) {
      const refMatch = cleanText.match(/^\{##([A-Z][A-Z0-9-]+)\}/);
      if (refMatch) {
        const lastFlow = groups[currentGroup.id].flows[groups[currentGroup.id].flows.length - 1];
        if (lastFlow) lastFlow.steps.push(refMatch[1]);
        continue;
      }

      const flowMatch = cleanText.match(/^(F-[A-Z][A-Z0-9]{2,10})\s+(.+)$/);
      if (flowMatch) {
        const flowId = flowMatch[1];
        const flowName = flowMatch[2].split("：")[0].split(":")[0].trim();
        const flowObj = { id: flowId, name: flowName, entryPage: page.abbr, steps: [], crossPages: [page.abbr] };
        groups[currentGroup.id].flows.push(flowObj);
        flows[flowId] = flowObj;
        if (isSmoke) smokeFeatures.push(flowId);
        continue;
      }

      const featMatch = cleanText.match(/^([A-Z][A-Z0-9-]{4,20})\s+(.+)$/);
      if (featMatch) {
        const featId = featMatch[1];
        const featName = featMatch[2].split("：")[0].split(":")[0].trim();
        groups[currentGroup.id].features.push(featId);
        features.push({ id: featId, name: featName, page: page.abbr, group: currentGroup.id });
        if (isSmoke) smokeFeatures.push(featId);
      }
    }
  }

  return { page, groups, flows, features, smokeFeatures };
}

function buildFeatureTreeIndex(dir) {
  const mdFiles = fs.readdirSync(dir).filter(f => f.endsWith(".md") && f !== "README.md");
  if (mdFiles.length === 0) {
    console.error("[FAIL] No .md files found in " + dir);
    process.exit(1);
  }

  const index = {
    version: new Date().toISOString().slice(0, 10),
    pageAbbreviations: {},
    pages: {},
    flows: {},
    featureIndex: {},
    deprecatedIds: [],
    smokeFeatures: [],
  };

  for (const file of mdFiles) {
    const result = parseFeatureTreeMdFile(path.join(dir, file));
    if (!result.page) {
      console.warn(`[WARN] ${file}: no page definition found, skipping`);
      continue;
    }

    const p = result.page;
    index.pageAbbreviations[p.abbr] = p.name;

    const pageGroups = {};
    for (const [gid, g] of Object.entries(result.groups)) {
      pageGroups[gid] = { name: g.name, features: g.features };
    }

    index.pages[p.abbr] = { name: p.name, route: p.route, file: p.file, groups: pageGroups };

    for (const [fid, f] of Object.entries(result.flows)) {
      const crossPages = new Set([f.entryPage]);
      for (const step of f.steps) {
        if (!step.startsWith("F-")) {
          const stepPage = step.split("-")[0];
          if (stepPage) crossPages.add(stepPage);
        }
      }
      index.flows[fid] = { name: f.name, entryPage: f.entryPage, steps: f.steps, crossPages: [...crossPages] };
    }

    for (const feat of result.features) {
      index.featureIndex[feat.id] = { page: feat.page, group: feat.group };
    }

    index.smokeFeatures.push(...result.smokeFeatures);
  }

  return index;
}

function modeFeatureTree(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`[FAIL] Directory not found: ${dir}`);
    process.exit(1);
  }
  const index = buildFeatureTreeIndex(dir);
  const outPath = path.join(dir, "index.json");
  fs.writeFileSync(outPath, JSON.stringify(index, null, 2), "utf-8");
  const pageCount = Object.keys(index.pages).length;
  const featCount = Object.keys(index.featureIndex).length;
  const flowCount = Object.keys(index.flows).length;
  console.log(`[OK] Parsed ${pageCount} pages, ${featCount} features, ${flowCount} flows → ${outPath}`);
}

// ═══════════════════════════════════════════════════════════════
// Mode 2: 菜单树 ASCII 解析
// ═══════════════════════════════════════════════════════════════

function parseFailObject(str) {
  const result = {};
  const pairs = str.matchAll(/(\w+)\s*:\s*(?:toast\("([^"]+)"\)|"([^"]+)"|(\S+))/g);
  for (const m of pairs) {
    const key = m[1];
    const value = m[2] || m[3] || m[4];
    if (key && value) {
      result[key] = m[2] !== undefined ? { type: "toast", message: value } : value;
    }
  }
  return result;
}

function parseStateBlock(lines, startIdx) {
  const stateObj = {};
  let j = startIdx;
  let braceDepth = 0;
  let foundOpen = false;
  while (j < lines.length) {
    const line = lines[j];
    if (line.includes("{")) { braceDepth += (line.match(/{/g) || []).length; foundOpen = true; }
    if (line.includes("}")) { braceDepth -= (line.match(/}/g) || []).length; }
    const cleanLine = line.replace(/^[│\s]+/, "");
    const stateMatch = cleanLine.match(/^(loading|empty|error)\s*:\s*(.+?)[,}\s]*$/);
    if (stateMatch) { stateObj[stateMatch[1]] = stateMatch[2].trim().replace(/[,}]\s*$/, ""); }
    if (foundOpen && braceDepth <= 0) break;
    j++;
  }
  return stateObj;
}

function parseNavigationPath(lines) {
  let l1Entry = "", l1Click = "", l2Click = "";
  const pathParts = [];
  for (const line of lines) {
    const l1Match = line.match(/^L1:\s*(.+?)(?:\s*\[|$)/);
    if (l1Match) { l1Entry = l1Match[1].trim(); pathParts.push(`L1:${l1Entry}`); continue; }
    const l2Match = line.match(/^L2:\s*(.+?)(?:\s*\[|$)/);
    if (l2Match) { l2Click = l2Match[1].trim(); pathParts.push(`L2:${l2Click}`); continue; }
    const clickMatch = line.match(/click\s*\[([^\]]+)\]/);
    if (clickMatch && !l1Click) { l1Click = `click [${clickMatch[1]}]`; }
    else if (clickMatch && l1Click && !l2Click) { l2Click = `click [${clickMatch[1]}]`; }
  }
  return { l1Entry, l1Click: l1Click || (l1Entry ? `click [${l1Entry}]` : ""), l2Click, fullPath: pathParts.join(" → ") };
}

function parseMenuTreeContent(content) {
  const normalized = content.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const pages = [];
  let currentPage = null, currentInteraction = null, currentLayout = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trimEnd();
    if (!trimmedLine || trimmedLine.startsWith("<!--")) continue;

    const pageMatch = trimmedLine.match(/^(L\d+):\s*(.+?)\s*\[(\S区)[^\]]*\]/);
    if (pageMatch) {
      if (currentPage) pages.push(currentPage);
      currentPage = { id: pageMatch[1], name: pageMatch[2].trim(), zone: pageMatch[3], navigation: {}, interactions: [], states: {} };
      currentInteraction = null; currentLayout = null;
      continue;
    }
    if (!currentPage) continue;

    const layoutMatch = trimmedLine.match(/^[│ ]*[├└]──\s*布局:\s*(.+)/);
    if (layoutMatch) { currentLayout = layoutMatch[1].trim(); currentInteraction = null; continue; }

    const rowOpMatch = trimmedLine.match(/^[│ ]*[├└]──\s*行操作区:/);
    if (rowOpMatch) { currentLayout = "行操作区"; currentInteraction = null; continue; }

    const nodeMatch = trimmedLine.match(/^([│ ]*)[├└]──\s+([A-Z][A-Z0-9-]*)\s+(.+)/);
    if (nodeMatch) {
      const rest = nodeMatch[3];
      const actionMatch = rest.match(/(click|input|select|hover)\s*\[([^\]]+)\]/);
      const action = actionMatch ? `${actionMatch[1]} [${actionMatch[2]}]` : rest.split("→")[0].trim();
      const toastMatch = rest.match(/→\s*L\d+:\s*toast\("([^"]+)"\)/) || rest.match(/→\s*toast\("([^"]+)"\)/);
      const targetToast = toastMatch ? toastMatch[1] : null;
      const arrowMatch = !targetToast ? rest.match(/→\s*(L\d+:\s*[^[\]]+)/) : null;
      const target = arrowMatch ? arrowMatch[1].trim() : null;
      const targetZoneMatch = rest.match(/→[^[]*\[(\S区)[^\]]*\]/);
      const targetZone = targetZoneMatch ? targetZoneMatch[1] : null;
      const plainTarget = !targetToast && !target ? (rest.match(/→\s*(.+)/) || [])[1] : null;
      currentInteraction = {
        featureId: nodeMatch[2], action, target: targetToast || target || plainTarget || null,
        zone: targetZone || currentPage.zone, layout: currentLayout || null,
        transition: null, fail: null, precondition: null, expect: null,
      };
      currentPage.interactions.push(currentInteraction);
      continue;
    }

    const navClickMatch = trimmedLine.match(/^[│ ]*[├└]──\s*click\s*\[([^\]]+)\]\s*→\s*(L\d+:\s*[^[\]]+)/);
    if (navClickMatch) {
      currentInteraction = {
        featureId: null, action: `click [${navClickMatch[1]}]`, target: navClickMatch[2].trim(),
        zone: currentPage.zone, layout: currentLayout || null,
        transition: null, fail: null, precondition: null, expect: null,
      };
      currentPage.interactions.push(currentInteraction);
      continue;
    }

    if (currentInteraction) {
      const strippedProp = trimmedLine.replace(/^[│\s]+/, "");
      const propMatch = strippedProp.match(/^(transition|fail|precondition|expect)\s*:\s*(.+)/);
      if (propMatch) {
        let value = propMatch[2].trim();
        if (propMatch[1] === "fail" && value.startsWith("{")) {
          if (!value.includes("}") || value.endsWith("{")) {
            let collected = value;
            let j = i + 1;
            while (j < lines.length) { collected += " " + lines[j].trim(); if (lines[j].includes("}")) break; j++; }
            value = parseFailObject(collected);
          } else { value = parseFailObject(value); }
        }
        currentInteraction[propMatch[1]] = value;
        continue;
      }
    }

    const strippedState = trimmedLine.replace(/^[│\s]+/, "");
    if (strippedState.match(/^state\s*:\s*\{/)) {
      const stateObj = parseStateBlock(lines, i);
      if (Object.keys(stateObj).length > 0) currentPage.states = stateObj;
      continue;
    }

    if (currentPage && !currentPage.navigation.fullPath) {
      const navMatch = trimmedLine.match(/^(L[12]):\s*(.+?)(?:\s*\[|$)/);
      if (navMatch) {
        const level = navMatch[1], label = navMatch[2].trim();
        if (level === "L1") { currentPage.navigation.l1Entry = label; currentPage.navigation.l1Click = `click [${label}]`; }
        else if (level === "L2") { currentPage.navigation.l2Click = `click [${label}]`; }
        currentPage.navigation.fullPath = [
          currentPage.navigation.l1Entry ? `L1:${currentPage.navigation.l1Entry}` : "",
          currentPage.navigation.l2Click ? `L3:${currentPage.name}` : "",
        ].filter(Boolean).join(" → ");
      }
    }
  }
  if (currentPage) pages.push(currentPage);
  return { pages };
}

function parseMenuTreeFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const result = parseMenuTreeContent(content);
  const lines = content.split("\n");
  for (const page of result.pages) {
    if (!page.navigation.fullPath) {
      const pageIdx = lines.findIndex(l => l.includes(page.name));
      const headerLines = pageIdx >= 0 ? lines.slice(0, pageIdx) : [];
      const nav = parseNavigationPath(headerLines);
      if (nav.fullPath) { page.navigation = nav; page.navigation.fullPath += ` → L3:${page.name}`; }
      else { page.navigation.fullPath = `L3:${page.name}`; }
    }
  }
  return result;
}

function modeMenuTree(file, output) {
  if (!fs.existsSync(file)) { console.error(`[FAIL] File not found: ${file}`); process.exit(1); }
  const result = parseMenuTreeFile(file);
  const pageCount = result.pages.length;
  const interactionCount = result.pages.reduce((sum, p) => sum + p.interactions.length, 0);
  const json = JSON.stringify(result, null, 2);
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json, "utf-8");
    console.log(`[OK] Parsed ${pageCount} pages, ${interactionCount} interactions → ${output}`);
  } else {
    console.log(json);
  }
}

// ═══════════════════════════════════════════════════════════════
// Mode 3: extract-tree-context (原 extract-tree-context.js)
// ═══════════════════════════════════════════════════════════════

function findMdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findMdFiles(fullPath));
    else if (entry.name.endsWith(".md") && entry.name !== "README.md") results.push(fullPath);
  }
  return results;
}

function identifyTreeFile(filePath, content) {
  const result = { hasFunctionTree: false, hasMenuTree: false, confidence: 0 };
  const normalized = content.replace(/\r\n/g, "\n");
  const relPath = filePath.replace(/\\/g, "/").toLowerCase();

  const headLines = normalized.split("\n").slice(0, 20).join("\n");
  const declaresFunctionTree = /#{1,3}\s+.*功能树|功能树\s*[：:\n]/.test(headLines);
  const declaresMenuTree = /#{1,3}\s+.*菜单树|菜单树\s*[：:\n]/.test(headLines);

  const pathHintsFeat = ["function-tree", "功能树", "func-tree"];
  const hasPathHintFeat = pathHintsFeat.some(h => relPath.includes(h));
  const featL0 = /^[ ]{0,2}- [A-Z]{2,6}\s+.+\s+`?\/\S+/m;
  const featL1 = /^[ ]{2,4}- [A-Z][A-Z0-9-]{2,15}\s+.+$/m;
  const featL2 = /^[ ]{4,8}- [A-Z][A-Z0-9-]{4,20}\s+.+$/m;

  if (featL0.test(normalized) && featL1.test(normalized) && featL2.test(normalized)) {
    result.hasFunctionTree = true; result.confidence += hasPathHintFeat ? 0.8 : 0.5;
  } else if (hasPathHintFeat && featL0.test(normalized) && featL1.test(normalized)) {
    result.hasFunctionTree = true; result.confidence += 0.6;
  }

  const pathHintsMenu = ["menu-tree", "菜单树"];
  const hasPathHintMenu = pathHintsMenu.some(h => relPath.includes(h));
  const hasTreeChars = /^[│├└]/m.test(normalized);
  const hasZoneMarker = /\[(C区|F区|E区|D区|S区|T区)/.test(normalized);
  const hasLevelMarker = /^L\d+:/m.test(normalized);

  if (hasTreeChars && hasZoneMarker && hasLevelMarker) {
    result.hasMenuTree = true; result.confidence += hasPathHintMenu ? 0.8 : 0.5;
  }
  if (!result.hasMenuTree && hasPathHintMenu && featL0.test(normalized)) {
    result.hasMenuTree = true; result.confidence += 0.4;
  }

  if (!result.hasFunctionTree && declaresFunctionTree) {
    if (/^[\s]*- .+$/m.test(normalized)) { result.hasFunctionTree = true; result.confidence = Math.max(result.confidence, 0.4); }
  }
  if (!result.hasMenuTree && declaresMenuTree) {
    if (/^[\s]*- .+$/m.test(normalized)) { result.hasMenuTree = true; result.confidence = Math.max(result.confidence, 0.4); }
  }
  return result;
}

function parseFunctionTreeContent(content, filePath) {
  const lines = content.split("\n");
  const pages = {}, featureIndex = {}, flows = {};
  let page = null, currentGroup = null, groups = {};

  function flushPage() {
    if (!page) return;
    const pageGroups = {};
    for (const [gid, g] of Object.entries(groups)) pageGroups[gid] = { name: g.name, features: g.features };
    pages[page.abbr] = { name: page.name, route: page.route, file: path.basename(filePath), groups: pageGroups };
    groups = {};
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "").trimEnd();
    if (!line.trim() || line.trim().startsWith("<!--")) continue;
    const match = line.match(/^(\s*)- (.+)$/);
    if (!match) continue;
    const indent = match[1].length;
    const text = match[2].trim();
    const cleanText = text.replace(/@smoke\b/, "").replace(/@infra-dep:\S+/g, "").replace(/`/g, "").trim();

    if (indent === 0) {
      const pageMatch = cleanText.match(/^([A-Z]{2,6})\s+(.+?)\s+(\/\S+.*)$/);
      if (pageMatch) { flushPage(); page = { abbr: pageMatch[1], name: pageMatch[2], route: pageMatch[3] }; currentGroup = null; }
      continue;
    }
    if (!page) continue;
    if (indent === 2) {
      const groupMatch = cleanText.match(/^([A-Z][A-Z0-9-]{2,15})\s+(.+)$/);
      if (groupMatch) { currentGroup = { id: groupMatch[1], name: groupMatch[2] }; if (!groups[currentGroup.id]) groups[currentGroup.id] = { name: currentGroup.name, features: [] }; }
      continue;
    }
    if (indent >= 4 && currentGroup) {
      const refMatch = cleanText.match(/^\{##([A-Z][A-Z0-9-]+)\}/);
      if (refMatch) continue;
      const flowMatch = cleanText.match(/^(F-[A-Z][A-Z0-9]{2,10})\s+(.+)$/);
      if (flowMatch) { const flowId = flowMatch[1]; flows[flowId] = { name: flowMatch[2].split("：")[0].split(":")[0].trim(), entryPage: page.abbr, steps: [], crossPages: [page.abbr] }; continue; }
      const featMatch = cleanText.match(/^([A-Z][A-Z0-9-]{4,20})\s+(.+)$/);
      if (featMatch) { groups[currentGroup.id].features.push(featMatch[1]); featureIndex[featMatch[1]] = { page: page.abbr, group: currentGroup.id }; }
    }
  }
  flushPage();
  return { pages, featureIndex, flows };
}

function modeExtractContext(reqDir, output) {
  if (!fs.existsSync(reqDir)) {
    console.log("[INFO] 需求目录不存在: " + reqDir);
    const noMatch = { status: "NO_MATCH", sources: { functionTreeFiles: [], menuTreeFiles: [] }, functionTree: null, menuTree: null, extractedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(noMatch, null, 2), "utf-8");
    console.log("[OK] 输出 NO_MATCH → " + output);
    process.exit(0);
  }

  const mdFiles = findMdFiles(reqDir);
  if (mdFiles.length === 0) {
    console.log("[INFO] 需求目录下无 .md 文件: " + reqDir);
    const noMatch = { status: "NO_MATCH", sources: { functionTreeFiles: [], menuTreeFiles: [] }, functionTree: null, menuTree: null, extractedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(noMatch, null, 2), "utf-8");
    console.log("[OK] 输出 NO_MATCH → " + output);
    process.exit(0);
  }

  console.log("[INFO] 扫描 " + mdFiles.length + " 个 .md 文件...");
  const functionTreeFiles = [], menuTreeFiles = [];
  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    const id = identifyTreeFile(filePath, content);
    if (id.hasFunctionTree) { functionTreeFiles.push({ path: filePath, confidence: id.confidence }); console.log("[INFO] 功能树文件: " + path.relative(reqDir, filePath)); }
    if (id.hasMenuTree) { menuTreeFiles.push({ path: filePath, confidence: id.confidence }); console.log("[INFO] 菜单树文件: " + path.relative(reqDir, filePath)); }
  }

  let mergedFunctionTree = null;
  if (functionTreeFiles.length > 0) {
    mergedFunctionTree = { pages: {}, featureIndex: {}, flows: {} };
    for (const { path: filePath } of functionTreeFiles) {
      const parsed = parseFunctionTreeContent(fs.readFileSync(filePath, "utf-8"), filePath);
      for (const [pageId, page] of Object.entries(parsed.pages)) {
        if (!mergedFunctionTree.pages[pageId]) mergedFunctionTree.pages[pageId] = page;
        else Object.assign(mergedFunctionTree.pages[pageId].groups, page.groups);
      }
      Object.assign(mergedFunctionTree.featureIndex, parsed.featureIndex);
      Object.assign(mergedFunctionTree.flows, parsed.flows);
    }
  }

  let mergedMenuTree = null;
  if (menuTreeFiles.length > 0) {
    mergedMenuTree = { pages: [] };
    for (const { path: filePath } of menuTreeFiles) {
      const parsed = parseMenuTreeFile(filePath);
      if (parsed.pages && parsed.pages.length > 0) mergedMenuTree.pages.push(...parsed.pages);
    }
  }

  const hasAnyData = mergedFunctionTree || mergedMenuTree;
  const result = {
    status: hasAnyData ? "OK" : "NO_MATCH",
    sources: { functionTreeFiles: functionTreeFiles.map(f => path.basename(f.path)), menuTreeFiles: menuTreeFiles.map(f => path.basename(f.path)) },
    functionTree: mergedFunctionTree, menuTree: mergedMenuTree, extractedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2), "utf-8");
  console.log("[OK] 输出 → " + output);
}

// ═══════════════════════════════════════════════════════════════
// Main: route to correct mode based on arguments
// ═══════════════════════════════════════════════════════════════

function main() {
  const argv = process.argv.slice(2);
  let dir = "", file = "", output = "", reqDir = "";

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" && argv[i + 1]) dir = argv[++i];
    if (argv[i] === "--file" && argv[i + 1]) file = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
    if (argv[i] === "--req-dir" && argv[i + 1]) reqDir = argv[++i];
  }

  if (reqDir && output) {
    modeExtractContext(reqDir, output);
  } else if (file) {
    modeMenuTree(file, output);
  } else if (dir) {
    modeFeatureTree(dir);
  } else {
    console.error("用法:");
    console.error("  node parse-tree.js --dir <feature-tree-dir>");
    console.error("  node parse-tree.js --file <menu-tree.md> [--output out.json]");
    console.error("  node parse-tree.js --req-dir <req-dir> --output <out.json>");
    process.exit(1);
  }
}

main();
