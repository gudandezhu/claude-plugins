#!/usr/bin/env node
"use strict";
/**
 * verify-skeleton.js
 * 验证测试案例与脚本的 TC 编号覆盖率。
 * 在 run-test 阶段二结束时自动运行，确保每个案例都有对应脚本。
 *
 * 用法：node verify-skeleton.js --testing-dir testing/ --scope fullstack [--testing-repo <path>]
 * 输出：testing/.cache/verify-skeleton-result.json
 * 退出码：0=全覆盖，1=有缺失
 */
const fs = require("fs");
const path = require("path");

// ─── 参数解析 ───────────────────────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  let testingDir = "testing";
  let testingRepo = "";
  let scope = "fullstack";
  let threshold = 80;
  let type = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--testing-dir" && argv[i + 1]) testingDir = argv[++i];
    if (argv[i] === "--testing-repo" && argv[i + 1]) testingRepo = argv[++i];
    if (argv[i] === "--scope" && argv[i + 1]) scope = argv[++i];
    if (argv[i] === "--threshold" && argv[i + 1]) threshold = parseInt(argv[++i], 10);
    if (argv[i] === "--type" && argv[i + 1]) type = argv[++i];
  }
  return { testingDir, testingRepo, scope, threshold, type };
}

// ─── 工具函数 ───────────────────────────────────────────────
function findFiles(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(entry.name)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

function readSafe(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

function extractTcIds(content, prefix) {
  const pattern = new RegExp(
    `\\b(${prefix}-[A-Z]+-\\d{3}(?:-\\d{2})?(?:-[EB]\\d{2})?)\\b`,
    "g"
  );
  const ids = new Set();
  let m;
  while ((m = pattern.exec(content)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

// ─── 检查逻辑 ───────────────────────────────────────────────

function checkE2e(testingDir, repoRoot) {
  const casesFile = path.join(testingDir, "test-cases/e2e-test-cases.md");
  const skeletonFile = path.join(
    testingDir,
    "test-cases/e2e-test-cases-skeleton.md"
  );
  const casesContent = readSafe(casesFile) || readSafe(skeletonFile);
  if (!casesContent) {
    return {
      type: "e2e",
      caseIds: [],
      scriptIds: [],
      missing: [],
      extra: [],
      rate: "N/A",
      warning: "案例文件不存在",
    };
  }

  const caseIds = extractTcIds(casesContent, "FE");

  let specFiles;
  if (repoRoot) {
    // testingRepo 模式：优先扫描方案 C 结构 tests/e2e/
    specFiles = [];
    const newE2eDir = path.join(repoRoot, "tests", "e2e");
    if (fs.existsSync(newE2eDir)) {
      // 方案 C：递归扫描 tests/e2e/
      specFiles.push(...findFiles(newE2eDir, /\.spec\.ts$/));
    } else {
      // v1 旧结构 fallback
      const featuresDir = path.join(repoRoot, "features");
      if (fs.existsSync(featuresDir)) {
        for (const d of fs.readdirSync(featuresDir, { withFileTypes: true })) {
          if (d.isDirectory()) {
            specFiles.push(...findFiles(path.join(featuresDir, d.name, "e2e", "tests"), /\.spec\.ts$/));
            specFiles.push(...findFiles(path.join(featuresDir, d.name, "e2e"), /\.spec\.ts$/));
          }
        }
      }
      const flowsDir = path.join(repoRoot, "flows");
      if (fs.existsSync(flowsDir)) {
        for (const d of fs.readdirSync(flowsDir, { withFileTypes: true })) {
          if (d.isDirectory()) {
            specFiles.push(...findFiles(path.join(flowsDir, d.name, "e2e", "tests"), /\.spec\.ts$/));
            specFiles.push(...findFiles(path.join(flowsDir, d.name, "e2e"), /\.spec\.ts$/));
          }
        }
      }
      const scriptsE2eDir = path.join(repoRoot, "scripts", "e2e");
      if (fs.existsSync(scriptsE2eDir)) {
        specFiles.push(...findFiles(scriptsE2eDir, /\.spec\.ts$/));
      }
    }
  } else {
    specFiles = findFiles(path.join(testingDir, "scripts/e2e/tests"), /\.spec\.ts$/);
  }

  const scriptContent = specFiles.map((f) => readSafe(f)).join("\n");
  const scriptIds = extractTcIds(scriptContent, "FE");

  const missing = caseIds.filter((id) => !scriptIds.includes(id));
  const extra = scriptIds.filter((id) => !caseIds.includes(id));
  const covered = caseIds.length - missing.length;
  const rate =
    caseIds.length > 0 ? Math.round((covered / caseIds.length) * 100) : 0;

  return {
    type: "e2e",
    caseIds,
    scriptIds,
    missing,
    extra,
    rate: `${rate}%`,
  };
}

function checkApi(testingDir, repoRoot) {
  const casesFile = path.join(testingDir, "test-cases/api-test-cases.md");
  const skeletonFile = path.join(
    testingDir,
    "test-cases/api-test-cases-skeleton.md"
  );
  const casesContent = readSafe(casesFile) || readSafe(skeletonFile);
  if (!casesContent) {
    return {
      type: "api",
      caseIds: [],
      scriptIds: [],
      missing: [],
      extra: [],
      rate: "N/A",
      warning: "案例文件不存在",
    };
  }

  const caseIds = extractTcIds(casesContent, "API");

  // testingRepo 模式：优先扫描方案 C tests/api/；fallback features/api/tests/；legacy：testingDir/scripts/api/tests
  let apiTestDir;
  if (repoRoot) {
    const newApiDir = path.join(repoRoot, "tests", "api");
    if (fs.existsSync(newApiDir)) {
      apiTestDir = newApiDir;
    } else {
      apiTestDir = path.join(repoRoot, "features", "api", "tests");
    }
  } else {
    apiTestDir = path.join(testingDir, "scripts/api/tests");
  }
  const testFiles = findFiles(apiTestDir, /\.api\.test\.ts$/);

  const scriptContent = testFiles.map((f) => readSafe(f)).join("\n");
  const scriptIds = extractTcIds(scriptContent, "API");

  const missing = caseIds.filter((id) => !scriptIds.includes(id));
  const extra = scriptIds.filter((id) => !caseIds.includes(id));
  const covered = caseIds.length - missing.length;
  const rate =
    caseIds.length > 0 ? Math.round((covered / caseIds.length) * 100) : 0;

  return {
    type: "api",
    caseIds,
    scriptIds,
    missing,
    extra,
    rate: `${rate}%`,
  };
}

// ─── 主流程 ─────────────────────────────────────────────────
function main() {
  const { testingDir, testingRepo, scope, threshold, type } = parseArgs();
  const repoRoot = testingRepo || null;
  const cacheDir = path.join(testingDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  const results = { timestamp: new Date().toISOString(), checks: [], threshold };
  let hasFailure = false;

  // E2E 检查
  if ((scope !== "backend") && (!type || type === "e2e")) {
    const e2e = checkE2e(testingDir, repoRoot);
    results.checks.push(e2e);
    if (e2e.missing.length > 0) hasFailure = true;
  }

  // API 检查
  if ((scope !== "frontend") && (!type || type === "api")) {
    const api = checkApi(testingDir, repoRoot);
    results.checks.push(api);
    if (api.missing.length > 0) hasFailure = true;
  }

  // Flow 检查（--type flow 时）
  if ((scope !== "frontend") && type === "flow") {
    const flowCasesFile = path.join(testingDir, "test-cases/api-flow-test-cases.md");
    const flowCasesContent = fs.existsSync(flowCasesFile) ? fs.readFileSync(flowCasesFile, "utf-8") : "";
    if (flowCasesContent) {
      const flowCaseIds = extractTcIds(flowCasesContent, "FLOW");

      let flowScriptFiles;
      if (repoRoot) {
        // testingRepo 模式：扫描 flows/*/api/*flow.api.test.ts
        flowScriptFiles = [];
        const flowsDir = path.join(repoRoot, "flows");
        if (fs.existsSync(flowsDir)) {
          for (const d of fs.readdirSync(flowsDir, { withFileTypes: true })) {
            if (d.isDirectory()) {
              flowScriptFiles.push(...findFiles(path.join(flowsDir, d.name, "api"), /flow\.api\.test\.ts$/));
            }
          }
        }
      } else {
        const flowScriptDir = path.join(testingDir, "scripts/api/tests");
        flowScriptFiles = findFiles(flowScriptDir, /flow\.api\.test\.ts$/);
      }

      let flowScriptContent = "";
      for (const f of flowScriptFiles) {
        flowScriptContent += fs.readFileSync(f, "utf-8") + "\n";
      }
      const flowScriptIds = extractTcIds(flowScriptContent, "FLOW");
      const missing = flowCaseIds.filter(id => !flowScriptIds.includes(id));
      const extra = flowScriptIds.filter(id => !flowCaseIds.includes(id));
      const rate = flowCaseIds.length > 0
        ? `${Math.round(((flowCaseIds.length - missing.length) / flowCaseIds.length) * 100)}%`
        : "N/A";
      results.checks.push({
        type: "flow", caseIds: flowCaseIds, scriptIds: flowScriptIds,
        missing, extra, rate,
      });
      if (missing.length > 0) hasFailure = true;
    }
  }

  results.passed = !hasFailure;

  // 写入结果
  const outputFile = path.join(cacheDir, "verify-skeleton-result.json");
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  // 输出摘要
  console.log(
    results.passed
      ? "[OK] TC 覆盖率验证通过"
      : "[FAIL] TC 覆盖率验证未通过 — 以下案例缺少对应脚本"
  );
  console.log("");

  for (const check of results.checks) {
    const icon = check.missing.length === 0 ? "[OK]" : "[FAIL]";
    console.log(
      `  ${icon} ${check.type.toUpperCase()}: 案例 ${check.caseIds.length} 个, 脚本 ${check.scriptIds.length} 个, 覆盖率 ${check.rate}`
    );

    if (check.missing.length > 0) {
      console.log(`     缺失脚本的案例 (${check.missing.length}):`);
      for (const id of check.missing) {
        console.log(`       - ${id}`);
      }
    }
    if (check.extra.length > 0) {
      console.log(
        `     [WARN] 脚本中有但案例中没有的 TC (${check.extra.length}):`
      );
      for (const id of check.extra.slice(0, 5)) {
        console.log(`       - ${id}`);
      }
      if (check.extra.length > 5)
        console.log(`       ... 还有 ${check.extra.length - 5} 个`);
    }
  }

  if (!results.passed) {
    console.log("");
    console.log("[TIP] 请为以上缺失的 TC 编号补充对应的测试脚本后重新验证。");
    process.exit(1);
  }
}

main();
