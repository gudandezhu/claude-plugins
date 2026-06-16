#!/usr/bin/env node
/**
 * Acceptance report generator for god's BDD suite.
 * Mirrors the demo/ pattern: spec → feature → step → test → report.
 */
const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, 'features');
const RUN_LOG = path.join(__dirname, '.results', 'run.log');
const RESULTS_JSON = path.join(__dirname, '.results', 'results.json');
const OUT_MD = path.join(__dirname, 'reports', 'ACCEPTANCE.md');
const OUT_JSON = path.join(__dirname, 'reports', 'acceptance.json');

function parseFeatures(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.feature')) continue;
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const featureName = (text.match(/^Feature:\s*(.+)$/m) || [, ''])[1].trim();
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*(Scenario|Scenario Outline):\s*(.+)$/);
      if (m) {
        const tags = [];
        for (let j = i - 1; j >= 0; j--) {
          const tm = lines[j].match(/^\s*((?:@\S+\s*)+)$/);
          if (tm) tags.unshift(...tm[1].trim().split(/\s+/).filter(Boolean));
          else if (lines[j].trim() === '') continue;
          else break;
        }
        out.push({ feature: featureName, tags, title: m[2].trim(), file: f });
      }
    }
  }
  return out;
}

function indexResults(json) {
  const results = new Map();
  function walk(node, depth = 0) {
    if (depth > 12 || !node) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    if (typeof node === 'object') {
      if (typeof node.title === 'string' && typeof node.ok === 'boolean') {
        results.set(node.title, node.ok);
      }
      for (const k of Object.keys(node)) walk(node[k], depth + 1);
    }
  }
  walk(json);
  return results;
}

function scOf(s) {
  const t = s.tags.find((x) => /^@SC-\d+$/i.test(x));
  return t ? t.slice(1).toUpperCase() : null;
}

function main() {
  let jsonText;
  if (fs.existsSync(RESULTS_JSON) && fs.statSync(RESULTS_JSON).size > 10) {
    jsonText = fs.readFileSync(RESULTS_JSON, 'utf8');
  } else if (fs.existsSync(RUN_LOG)) {
    const log = fs.readFileSync(RUN_LOG, 'utf8');
    const start = log.indexOf('{');
    jsonText = log.slice(start);
    fs.writeFileSync(RESULTS_JSON, jsonText);
  } else {
    console.error('✘ Missing results. Run: npm run bdd:test');
    process.exit(1);
  }

  const features = parseFeatures(FEATURES_DIR);
  const testResults = indexResults(JSON.parse(jsonText));
  const rows = features.map((s) => {
    const sc = scOf(s);
    const ok = testResults.get(s.title);
    return { sc, title: s.title, tags: s.tags, status: ok === true ? 'pass' : (ok === false ? 'fail' : 'unknown') };
  });
  const total = rows.length;
  const pass = rows.filter((r) => r.status === 'pass').length;
  const fail = total - pass;
  const verdict = fail === 0 ? '✅ PASS' : '❌ FAIL';
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const byFeature = new Map();
  for (const r of rows) {
    const key = (features.find((f) => f.title === r.title) || {}).file || '?';
    if (!byFeature.has(key)) byFeature.set(key, []);
    byFeature.get(key).push(r);
  }
  for (const list of byFeature.values()) list.sort((a, b) => (a.sc || 'zz').localeCompare(b.sc || 'zz'));

  let md = `# 验收报告 (Acceptance Report)\n\n`;
  md += `- 时间: ${ts}\n`;
  md += `- 范围: ${features.length} scenario(s) across ${byFeature.size} feature file(s)\n`;
  md += `- 通过: ${pass} / ${total}\n`;
  md += `- 结论: **${verdict}**\n\n`;
  md += `## spec → test 追溯表\n\n`;
  for (const [file, items] of byFeature) {
    md += `### ${file}\n\n| SC | 场景 | Tags | 状态 |\n|---|---|---|---|\n`;
    for (const r of items) {
      md += `| ${r.sc || '—'} | ${r.title} | ${r.tags.join(' ')} | ${r.status === 'pass' ? '✅' : '❌'} |\n`;
    }
    md += `\n`;
  }
  md += `## 闭环说明（god 主项目）\n\n`;
  md += `- **BDD feature**: \`tests/bdd/features/*.feature\`\n`;
  md += `- **step 定义**: \`tests/bdd/steps/*.js\` + \`tests/bdd/fixtures.js\`\n`;
  md += `- **生成 spec**: \`tests/bdd/bdd-gen/features/*.feature.spec.js\`\n`;
  md += `- **执行**: \`npm run bdd:test\`\n`;
  md += `- **报告**: 本文件 + \`tests/bdd/reports/acceptance.json\`\n\n`;
  md += `## god 流水线覆盖（被测对象）\n\n`;
  md += `| 步骤 | 脚本 | 断言 |\n|---|---|---|\n`;
  md += `| dev-gen | \`spec/scripts/dev-gen.js\` | 产出带 \`@spec SC-xxx\` 标注 |\n`;
  md += `| test-gen | \`spec/scripts/test-gen.js\` | 产出带 \`SC-xxx:\` 命名 |\n`;
  md += `| spec-validate | \`spec/scripts/spec-validate.js\` | 退出码 0 |\n`;
  md += `| spec-render | \`spec/scripts/spec-render.js\` | 产出 D1-D4 review.md |\n`;

  fs.writeFileSync(OUT_MD, md);
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: ts, total, pass, fail, verdict, rows }, null, 2));
  console.log(`✔ ${verdict}  ${pass}/${total}`);
  console.log(`  → ${OUT_MD}`);
  console.log(`  → ${OUT_JSON}`);
}

main();