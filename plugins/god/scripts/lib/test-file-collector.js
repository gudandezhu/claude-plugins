/**
 * test-file-collector.js
 * 测试文件收集公共库，支持 legacy、testingRepo(v1) 和 testingRepo(v2/方案C) 三种目录结构
 *
 * 用法：
 *   const { collectTestingRepoTests, collectLegacyTests, detectStructureVersion } = require("./lib/test-file-collector");
 */

"use strict";

const fs = require("fs");
const path = require("path");

/**
 * 递归扫描目录，收集匹配 pattern 的文件
 */
function walkDir(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, pattern));
    else if (entry.name.match(pattern)) results.push(full);
  }
  return results;
}

/**
 * 检测 testingRepo 目录结构版本
 * @param {string} projectRoot - testingRepo 项目根目录
 * @returns {'v2'|'v1'|'legacy'} 结构版本
 */
function detectStructureVersion(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'tests', 'e2e'))) return 'v2';
  if (fs.existsSync(path.join(projectRoot, 'features'))) return 'v1';
  return 'legacy';
}

/**
 * 从 testingRepo 收集测试文件
 * 支持 v2（方案C）和 v1（旧结构）两种模式，v2 优先
 *
 * @param {string} projectRoot - testingRepo 项目根目录
 * @param {'e2e'|'api'} testType - 测试类型
 * @returns {string[]} 测试文件绝对路径列表
 */
function collectTestingRepoTests(projectRoot, testType) {
  const pattern = testType === "e2e" ? /\.spec\.ts$/ : /\.api\.test\.ts$/;
  const version = detectStructureVersion(projectRoot);

  if (version === 'v2') {
    const testsDir = path.join(projectRoot, testType === 'e2e' ? 'tests/e2e' : 'tests/api');
    return walkDir(testsDir, pattern);
  }

  // v1 旧结构 fallback
  return collectV1Tests(projectRoot, testType, pattern);
}

/**
 * v1 旧结构收集逻辑（原 collectTestingRepoTests 逻辑）
 */
function collectV1Tests(projectRoot, testType, pattern) {
  const tests = [];

  if (testType === "e2e") {
    const legacyRepoE2eDir = path.join(projectRoot, "scripts", "e2e");
    if (fs.existsSync(legacyRepoE2eDir)) {
      for (const f of fs.readdirSync(legacyRepoE2eDir)) {
        if (f.match(pattern)) tests.push(path.join(legacyRepoE2eDir, f));
      }
      const testsSubDir = path.join(legacyRepoE2eDir, "tests");
      if (fs.existsSync(testsSubDir)) {
        for (const f of fs.readdirSync(testsSubDir)) {
          if (f.match(pattern)) tests.push(path.join(testsSubDir, f));
        }
      }
    }

    const newE2eDir = path.join(projectRoot, "features", "e2e", "tests");
    if (fs.existsSync(newE2eDir)) {
      for (const f of fs.readdirSync(newE2eDir)) {
        if (f.match(pattern)) tests.push(path.join(newE2eDir, f));
      }
    }

    const featuresDir = path.join(projectRoot, "features");
    if (fs.existsSync(featuresDir)) {
      for (const groupDir of fs.readdirSync(featuresDir, { withFileTypes: true })) {
        if (!groupDir.isDirectory() || groupDir.name === "e2e") continue;
        const testDir = path.join(featuresDir, groupDir.name, "e2e");
        if (fs.existsSync(testDir)) {
          for (const f of fs.readdirSync(testDir)) {
            if (f.match(pattern)) tests.push(path.join(testDir, f));
          }
          const testsSubDir = path.join(testDir, "tests");
          if (fs.existsSync(testsSubDir)) {
            for (const f of fs.readdirSync(testsSubDir)) {
              if (f.match(pattern)) tests.push(path.join(testsSubDir, f));
            }
          }
        }
      }
    }
  } else {
    const apiTestsDir = path.join(projectRoot, "scripts", "api", "tests");
    if (fs.existsSync(apiTestsDir)) {
      for (const f of fs.readdirSync(apiTestsDir)) {
        if (f.match(pattern)) tests.push(path.join(apiTestsDir, f));
      }
    }

    const newApiTestsDir = path.join(projectRoot, "features", "api", "tests");
    if (fs.existsSync(newApiTestsDir)) {
      for (const f of fs.readdirSync(newApiTestsDir)) {
        if (f.match(pattern)) tests.push(path.join(newApiTestsDir, f));
      }
    }

    const featuresDir = path.join(projectRoot, "features");
    if (fs.existsSync(featuresDir)) {
      for (const groupDir of fs.readdirSync(featuresDir, { withFileTypes: true })) {
        if (!groupDir.isDirectory() || groupDir.name === "api") continue;
        const testDir = path.join(featuresDir, groupDir.name, "api");
        if (fs.existsSync(testDir)) {
          for (const f of fs.readdirSync(testDir)) {
            if (f.match(pattern)) tests.push(path.join(testDir, f));
          }
        }
      }
    }
  }

  return tests;
}

/**
 * 从 legacy 目录结构收集测试文件
 * legacy 路径：testing/scripts/e2e/tests/, testing/scripts/api/tests/
 *
 * @param {string} testingDir - testing 目录路径
 * @param {'e2e'|'api'} testType - 测试类型
 * @returns {string[]} 测试文件绝对路径列表
 */
function collectLegacyTests(testingDir, testType) {
  const pattern = testType === "e2e" ? /\.spec\.ts$/ : /\.api\.test\.ts$/;
  const dir = testType === "e2e"
    ? path.join(testingDir, "scripts", "e2e", "tests")
    : path.join(testingDir, "scripts", "api", "tests");

  return walkDir(dir, pattern);
}

/**
 * 根据 test-config.json 配置自动选择收集策略
 *
 * @param {string} testingDir - testing 目录路径
 * @param {object} config - test-config.json 内容
 * @param {'e2e'|'api'} testType - 测试类型
 * @returns {string[]} 测试文件绝对路径列表
 */
function collectTests(testingDir, config, testType) {
  const tr = config.testingRepo;
  if (tr && tr.path) {
    const resolved = tr.path.replace(/\$JLC_AI_WORKSPACE/g, process.env.JLC_AI_WORKSPACE || "");
    const projectRoot = resolved;
    return collectTestingRepoTests(projectRoot, testType);
  }
  return collectLegacyTests(testingDir, testType);
}

module.exports = { collectTestingRepoTests, collectLegacyTests, collectTests, detectStructureVersion, walkDir };
