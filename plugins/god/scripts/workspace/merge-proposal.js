#!/usr/bin/env node
"use strict";
/**
 * merge-proposal.js — T1.4
 * CI 合并提案到功能树：读取 feature-tree-proposal/*.md，
 * 将新增/修改的功能追加到对应的 feature-tree/*.md，
 * 然后重新生成 index.json，最后删除已合并的提案文件。
 *
 * 用法: node merge-proposal.js --tree-dir <feature-tree-dir> --proposal-dir <proposal-dir>
 *
 * 提案格式（feature-tree-proposal/REQ-XXX.md）：
 *   # REQ-XXX 功能树变更提案
 *   ## 新增功能
 *   - 目标页面: PRQL
 *   - 目标功能组: PRQL-ACT
 *   - 新增:
 *     - PRQL-ACT-EXPORT 导出请购单列表：用户导出当前筛选结果为 Excel
 *   ## 新增流程
 *   - 目标页面: PRQL
 *   - 目标功能组: PRQL-FLOW
 *   - 新增:
 *     - F-PRQEXPT 请购单导出流程
 *       - {##PRQL-FLTR-KW}
 *       - {##PRQL-ACT-EXPORT}
 */
const fs = require("fs");
const path = require("path");

function parseArgs() {
  const argv = process.argv.slice(2);
  let treeDir = "", proposalDir = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tree-dir" && argv[i + 1]) treeDir = argv[++i];
    if (argv[i] === "--proposal-dir" && argv[i + 1]) proposalDir = argv[++i];
  }
  if (!treeDir || !proposalDir) {
    console.error("[FAIL] --tree-dir and --proposal-dir are required");
    process.exit(1);
  }
  return { treeDir, proposalDir };
}

function parseProposal(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const changes = [];
  let currentTarget = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const pageMatch = trimmed.match(/^-\s*目标页面:\s*([A-Z]{2,6})/i);
    if (pageMatch) {
      currentTarget = { page: pageMatch[1], group: null, lines: [] };
      continue;
    }
    const groupMatch = trimmed.match(/^-\s*目标功能组:\s*([A-Z][A-Z0-9-]+)/i);
    if (groupMatch && currentTarget) {
      currentTarget.group = groupMatch[1];
      continue;
    }
    // Collect indented feature/flow lines under "新增:"
    if (currentTarget && /^\s{4}- /.test(line)) {
      currentTarget.lines.push(line.replace(/^\s{4}/, "      ")); // normalize to 6-space indent (level 2 in tree)
    }
    if (currentTarget && /^\s{6}- /.test(line)) {
      currentTarget.lines.push(line.replace(/^\s{6}/, "        ")); // flow step refs at 8-space indent
    }
    // Section boundary
    if (trimmed.startsWith("## ") && currentTarget && currentTarget.lines.length > 0) {
      changes.push({ ...currentTarget });
      currentTarget = null;
    }
  }
  if (currentTarget && currentTarget.lines.length > 0) {
    changes.push({ ...currentTarget });
  }
  return changes;
}

function applyChanges(treeDir, changes) {
  let applied = 0;
  for (const change of changes) {
    if (!change.page || !change.group || change.lines.length === 0) continue;

    const mdFile = path.join(treeDir, `${change.page}.md`);
    if (!fs.existsSync(mdFile)) {
      console.warn(`[WARN] Target file ${change.page}.md not found, skipping`);
      continue;
    }

    let content = fs.readFileSync(mdFile, "utf-8");
    // Find the group line and append after its last child
    const groupPattern = new RegExp(`^(\\s{2}- ${change.group}\\s+.*)$`, "m");
    const groupMatch = content.match(groupPattern);
    if (!groupMatch) {
      console.warn(`[WARN] Group ${change.group} not found in ${change.page}.md, skipping`);
      continue;
    }

    // Find insertion point: after the last line at indent >= 4 following the group
    const lines = content.split("\n");
    const groupIdx = lines.findIndex(l => groupPattern.test(l));
    let insertIdx = groupIdx + 1;
    while (insertIdx < lines.length) {
      const nextLine = lines[insertIdx];
      if (nextLine.trim() === "") { insertIdx++; continue; }
      const nextMatch = nextLine.match(/^(\s*)-/);
      if (!nextMatch || nextMatch[1].length < 4) break;
      insertIdx++;
    }

    // Insert the new lines
    lines.splice(insertIdx, 0, ...change.lines);
    fs.writeFileSync(mdFile, lines.join("\n"), "utf-8");
    applied += change.lines.length;
    console.log(`[OK] Applied ${change.lines.length} lines to ${change.page}.md under ${change.group}`);
  }
  return applied;
}

function main() {
  const { treeDir, proposalDir } = parseArgs();

  if (!fs.existsSync(proposalDir)) {
    console.log("[OK] No proposal directory, nothing to merge");
    return;
  }

  const proposals = fs.readdirSync(proposalDir).filter(f => f.endsWith(".md"));
  if (proposals.length === 0) {
    console.log("[OK] No proposals to merge");
    return;
  }

  let totalApplied = 0;
  const merged = [];

  for (const file of proposals) {
    console.log(`Processing proposal: ${file}`);
    const changes = parseProposal(path.join(proposalDir, file));
    if (changes.length === 0) {
      console.warn(`[WARN] ${file}: no changes found`);
      continue;
    }
    const applied = applyChanges(treeDir, changes);
    totalApplied += applied;
    merged.push(file);
  }

  // Re-generate index.json by calling parse-tree.js
  if (totalApplied > 0) {
    const { execSync } = require("child_process");
    const parseScript = path.join(__dirname, "parse-tree.js");
    execSync(`node "${parseScript}" --dir "${treeDir}"`, { stdio: "inherit" });
  }

  // Delete merged proposals
  for (const file of merged) {
    fs.unlinkSync(path.join(proposalDir, file));
    console.log(`[OK] Deleted merged proposal: ${file}`);
  }

  console.log(`[OK] Merged ${merged.length} proposals, ${totalApplied} lines applied`);
}

main();
