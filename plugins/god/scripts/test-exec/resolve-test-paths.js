#!/usr/bin/env node
/**
 * resolve-test-paths.js
 * 解析测试仓库执行路径，判断使用 testing-repo 模式还是 legacy 模式。
 *
 * 用法：
 *   node resolve-test-paths.js --config <test-config.json 路径>
 *
 * 输出（stdout JSON）：
 *   testing-repo 模式：{ "mode": "testing-repo", "repoPath": "...", "projectRoot": "...", ... }
 *   legacy 模式：{ "mode": "legacy" }
 *   无配置：{ "mode": "no-config" }
 */
const fs = require('fs');
const path = require('path');
const { safeReadJson } = require('../lib/safe-json');
const { normalizeMsysPath } = require('../lib/path-utils');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) result.config = args[++i];
  }
  return result;
}

function main() {
  const { config: rawCfgPath } = parseArgs();
  const cfgPath = normalizeMsysPath(rawCfgPath);
  if (!cfgPath || !fs.existsSync(cfgPath)) {
    console.log(JSON.stringify({ mode: 'no-config' }));
    process.exit(0);
  }

  const cfg = safeReadJson(cfgPath, { fallback: {} });
  const tr = cfg.testingRepo;
  if (!tr || !tr.path) {
    console.log(JSON.stringify({ mode: 'legacy' }));
    process.exit(0);
  }

  const resolved = normalizeMsysPath(tr.path.replace(/\$JLC_AI_WORKSPACE/g, process.env.JLC_AI_WORKSPACE || ''));
  const projectRoot = resolved;

  // 检查目录结构是否存在（v2 方案C 优先检测）
  const hasNewE2e = fs.existsSync(path.join(projectRoot, 'tests', 'e2e'));
  const hasNewApi = fs.existsSync(path.join(projectRoot, 'tests', 'api'));
  const hasFeatures = fs.existsSync(path.join(projectRoot, 'features'));
  const hasFlows = fs.existsSync(path.join(projectRoot, 'flows'));
  const hasScriptsApi = fs.existsSync(path.join(projectRoot, 'scripts', 'api', 'tests'));
  const hasScriptsE2e = fs.existsSync(path.join(projectRoot, 'scripts', 'e2e', 'tests'));

  const structureVersion = hasNewE2e ? 'v2' : (hasFeatures ? 'v1' : 'legacy');

  // 配置文件查找优先级：项目根（方案C）> features/e2e/（旧结构）
  const playwrightConfig = [
    path.join(projectRoot, 'playwright.config.ts'),
    path.join(projectRoot, 'features', 'e2e', 'playwright.config.ts'),
  ].find(p => fs.existsSync(p)) || path.join(projectRoot, 'playwright.config.ts');

  const vitestConfig = [
    path.join(projectRoot, 'vitest.config.ts'),
    path.join(projectRoot, 'features', 'api', 'vitest.config.ts'),
  ].find(p => fs.existsSync(p)) || path.join(projectRoot, 'vitest.config.ts');

  if (hasNewE2e || hasNewApi || hasFeatures || hasFlows || hasScriptsApi || hasScriptsE2e) {
    console.log(JSON.stringify({
      mode: 'testing-repo',
      repoPath: resolved,
      projectRoot,
      branch: tr.branch || '',
      affectedGroups: tr.affectedGroups || [],
      affectedFlows: tr.affectedFlows || [],
      changeType: cfg.changeType || 'feature',
      enforceTestingRepo: true,
      structureVersion,
      playwrightConfig,
      vitestConfig,
      storageState: path.join(resolved, '.cache', '.auth', 'storage-state.json'),
    }));
  } else {
    console.log(JSON.stringify({ mode: 'legacy' }));
  }
}

main();
