#!/usr/bin/env node
/**
 * load-feature-tree.js
 * 功能树自动同步（从插件模板初始化）+ 加载索引 + 提案检测。
 *
 * 用法：
 *   node load-feature-tree.js --repo <testingRepo.path> --req <需求编号> [--plugin-dir <CLAUDE_PLUGIN_ROOT>]
 *
 * 输出（stdout JSON）：
 *   成功：{ "pages": N, "features": N, "flows": N, "hasProposal": bool, "treeInitialized": bool }
 *   无功能树：{ "status": "NO_FEATURE_TREE" }
 *   无模板：{ "status": "NO_TEMPLATE", "treeInitialized": false }
 */
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) result.repo = args[++i];
    if (args[i] === '--req' && args[i + 1]) result.req = args[++i];
    if (args[i] === '--plugin-dir' && args[i + 1]) result.pluginDir = args[++i];
  }
  return result;
}

function main() {
  const { repo: repoPath, req: reqId, pluginDir } = parseArgs();
  if (!repoPath) {
    console.log(JSON.stringify({ error: 'NO_REPO_PATH' }));
    process.exit(1);
  }

  const treeDir = path.join(repoPath, 'feature-tree');
  let treeInitialized = false;

  // 功能树不存在时，从插件模板初始化
  if (!fs.existsSync(path.join(treeDir, 'index.json'))) {
    const templateDir = pluginDir
      ? path.join(pluginDir, 'skills/test-scripting/templates/feature-tree')
      : '';
    if (!templateDir || !fs.existsSync(templateDir)) {
      console.log(JSON.stringify({ status: 'NO_TEMPLATE', treeInitialized: false }));
      process.exit(0);
    }
    fs.mkdirSync(treeDir, { recursive: true });
    for (const f of fs.readdirSync(templateDir)) {
      fs.copyFileSync(path.join(templateDir, f), path.join(treeDir, f));
    }
    try {
      const { execSync } = require('child_process');
      execSync('git add feature-tree/ && git commit -m "feat: initialize feature tree from plugin template"', {
        cwd: repoPath, stdio: 'pipe'
      });
    } catch (e) { /* ignore */ }
    treeInitialized = true;
  }

  // 加载功能树索引
  const treePath = path.join(treeDir, 'index.json');
  if (!fs.existsSync(treePath)) {
    console.log(JSON.stringify({ status: 'NO_FEATURE_TREE' }));
    process.exit(0);
  }

  const index = JSON.parse(fs.readFileSync(treePath, 'utf-8'));
  const proposalPath = path.join(repoPath, 'feature-tree-proposal', (reqId || '') + '.md');
  const hasProposal = fs.existsSync(proposalPath);

  console.log(JSON.stringify({
    pages: Object.keys(index.pages || {}).length,
    features: Object.keys(index.featureIndex || {}).length,
    flows: Object.keys(index.flows || {}).length,
    hasProposal,
    proposalFile: hasProposal ? proposalPath : '',
    treeInitialized
  }));
}

main();
