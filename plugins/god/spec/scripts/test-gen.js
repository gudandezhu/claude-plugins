#!/usr/bin/env node
/**
 * test-gen.js — spec → 测试桩（roadmap G6）
 *
 * 用法:
 *   node test-gen.js <项目目录>
 *     读 spec/spec.feature → 写 tests/<feature>.spec.<ts|js>
 *
 *   node test-gen.js <项目目录> --dry-run
 *     预览不写
 *
 *   node test-gen.js <项目目录> --force
 *     覆盖已有
 *
 *   node test-gen.js <项目目录> --framework vitest
 *     强制框架（默认按 vitest.config / jest.config 推断）
 *
 * 设计依据: docs/rfcs/0008-test-gen.md
 * 零外部依赖，纯 Node 内置模块。
 */

'use strict';

const fs = require('fs');
const path = require('path');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
function findSpecDir(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'spec', 'spec.feature'))) {
    return path.join(projectDir, 'spec');
  }
  if (fs.existsSync(path.join(projectDir, 'spec.feature'))) {
    return projectDir;
  }
  return null;
}

function parseScenarios(specContent) {
  // 解析 @SC-xxx + tag (happy/sad-path/edge) + Scenario: <name> + GWT
  const lines = specContent.split('\n');
  const scenarios = [];
  let current = null;
  for (const line of lines) {
    const tagMatch = line.match(/^\s*@(SC-\d{3})(?:\s+(@\S+))*/);
    if (tagMatch) {
      if (current) scenarios.push(current);
      const allTags = (line.match(/@(\S+)/g) || []).map(t => t.slice(1));
      current = { id: tagMatch[1], tags: allTags, name: '', gwt: [] };
    } else if (current) {
      const nameMatch = line.match(/^\s*Scenario:\s*(.+)$/);
      if (nameMatch) {
        current.name = nameMatch[1].trim();
      } else {
        const gwtMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/);
        if (gwtMatch) {
          current.gwt.push({ keyword: gwtMatch[1], text: gwtMatch[2].trim() });
        }
      }
    }
  }
  if (current) scenarios.push(current);
  return scenarios;
}

function detectFramework(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'vitest.config.js')) ||
      fs.existsSync(path.join(projectDir, 'vitest.config.ts')) ||
      fs.existsSync(path.join(projectDir, 'vitest.config.mjs'))) {
    return 'vitest';
  }
  if (fs.existsSync(path.join(projectDir, 'jest.config.js')) ||
      fs.existsSync(path.join(projectDir, 'jest.config.ts'))) {
    return 'jest';
  }
  if (fs.existsSync(path.join(projectDir, 'package.json'))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
    if (pkg.devDependencies && pkg.devDependencies.vitest) return 'vitest';
    if (pkg.devDependencies && pkg.devDependencies.jest) return 'jest';
  }
  return 'vitest';  // 默认
}

function isTypeScriptProject(projectDir) {
  return fs.existsSync(path.join(projectDir, 'tsconfig.json'));
}

function getFeatureSlug(specDir, meta) {
  if (meta && meta.specId) {
    return meta.specId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  }
  const sources = readFileSafe(path.join(specDir, 'sources.md'));
  if (sources) {
    const h1 = sources.match(/^#\s+(.+)$/m);
    if (h1) return h1[1].trim().replace(/[^a-zA-Z0-9一-龥-]/g, '-').toLowerCase();
  }
  return 'feature';
}

function generateTestStub(scenarios, featureSlug, framework, useTs) {
  const ext = useTs ? 'ts' : 'js';
  let code = '';

  if (framework === 'vitest') {
    if (useTs) {
      code += `import { describe, it, expect } from 'vitest';\n`;
      code += `import * as feat from '../src/${featureSlug}.js';\n\n`;
    } else {
      code += `import { describe, it, expect } from 'vitest';\n`;
      code += `import * as feat from '../src/${featureSlug}.js';\n\n`;
    }
  } else {  // jest
    code += `const { describe, it, expect } = require('@jest/globals');\n`;
    code += `const feat = require('../src/${featureSlug}.js');\n\n`;
  }

  code += `describe('${featureSlug}', () => {\n`;

  for (const sc of scenarios) {
    const isSad = sc.tags.includes('sad-path');
    const testName = `${sc.id}: ${sc.name}`;

    if (isSad) {
      // sad-path: it.todo 不写实现
      code += `  // ${sc.id}: ${sc.name} (@sad-path — 失败模式必须覆盖)\n`;
      code += `  it.todo('${testName}');\n\n`;
    } else {
      code += `  // ${sc.id}: ${sc.name}\n`;
      code += `  it('${testName}', () => {\n`;
      code += `    // TODO: implement test\n`;
      for (const g of sc.gwt) {
        code += `    //   ${g.keyword}: ${g.text}\n`;
      }
      code += `    expect(feat.sc${sc.id.replace('SC-', '').replace(/^0+/, '') || sc.id}(/* TODO */)).toBeDefined();\n`;
      code += `  });\n\n`;
    }
  }

  code += `});\n`;

  return { code, ext };
}

function main() {
  const projectDir = process.argv[2];
  if (!projectDir) {
    console.error('用法: node test-gen.js <项目目录> [--dry-run] [--force] [--framework vitest|jest]');
    process.exit(1);
  }
  if (!fs.existsSync(projectDir)) {
    console.error(`✗ 项目目录不存在: ${projectDir}`);
    process.exit(1);
  }
  const opts = {
    dryRun: process.argv.includes('--dry-run'),
    force: process.argv.includes('--force'),
    framework: null,
  };
  const fwIdx = process.argv.indexOf('--framework');
  if (fwIdx !== -1 && process.argv[fwIdx + 1]) {
    opts.framework = process.argv[fwIdx + 1];
  }

  const specDir = findSpecDir(projectDir);
  if (!specDir) {
    console.error('✗ 找不到 spec 目录');
    process.exit(1);
  }
  const specContent = readFileSafe(path.join(specDir, 'spec.feature'));
  if (!specContent) {
    console.error('✗ 找不到 spec.feature');
    process.exit(1);
  }
  // v0.5.0+ G13: meta 在 state/ 下;兼容旧路径
  const metaPathNew = path.join(specDir, 'state', 'meta.json');
  const metaPathOld = path.join(specDir, 'meta.json');
  const metaContent = readFileSafe(fs.existsSync(metaPathNew) ? metaPathNew : metaPathOld);
  const meta = metaContent ? JSON.parse(metaContent) : null;
  const featureSlug = getFeatureSlug(specDir, meta);
  const framework = opts.framework || detectFramework(projectDir);
  const useTs = isTypeScriptProject(projectDir);
  const scenarios = parseScenarios(specContent);

  if (scenarios.length === 0) {
    console.error('✗ spec.feature 无 SC 解析');
    process.exit(1);
  }

  const { code, ext } = generateTestStub(scenarios, featureSlug, framework, useTs);
  const testsDir = path.join(projectDir, 'tests');
  const outPath = path.join(testsDir, `${featureSlug}.spec.${ext}`);

  if (opts.dryRun) {
    console.log(`[dry-run] 将写：${outPath}\n`);
    console.log('--- 测试桩预览 ---');
    console.log(code);
    return;
  }

  if (fs.existsSync(outPath) && !opts.force) {
    console.error(`✗ ${outPath} 已存在（用 --force 覆盖）`);
    process.exit(1);
  }

  fs.mkdirSync(testsDir, { recursive: true });
  // 写失败回滚
  let backup = null;
  if (fs.existsSync(outPath)) {
    backup = fs.readFileSync(outPath, 'utf8');
  }
  try {
    fs.writeFileSync(outPath, code, 'utf8');
  } catch (e) {
    if (backup !== null) fs.writeFileSync(outPath, backup);
    throw e;
  }

  const sadCount = scenarios.filter(s => s.tags.includes('sad-path')).length;
  const normalCount = scenarios.length - sadCount;
  console.log(`✓ test-gen 完成：${outPath}`);
  console.log(`  feature: ${featureSlug}`);
  console.log(`  framework: ${framework}`);
  console.log(`  language: ${useTs ? 'TypeScript' : 'JavaScript'}`);
  console.log(`  scenarios: ${scenarios.length} (${normalCount} normal + ${sadCount} sad-path)`);
  console.log(`  size: ${(code.length / 1024).toFixed(1)} KB`);
  console.log(`\n下一步：跑 spec-validate.js #8 确认 SC-xxx: 用例名通过`);
}

if (require.main !== module) {
  module.exports = {
    parseScenarios,
    detectFramework,
    isTypeScriptProject,
    getFeatureSlug,
    generateTestStub,
  };
} else {
  main();
}
