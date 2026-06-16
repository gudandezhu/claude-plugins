// BDD fixtures — wire god's own L3 scripts as the test surface.
// `api` exposes dev-gen / test-gen / spec-validate / spec-render child-process runs.
const { test: base, createBdd } = require('playwright-bdd');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const GOD_ROOT = path.resolve(__dirname, '..', '..'); // god/plugin/god
const SCRIPTS = path.join(GOD_ROOT, 'spec', 'scripts');
const TMP_ROOT = '/tmp/god-bdd-acceptance';

function freshProject() {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP_ROOT, 'spec'), { recursive: true });
  fs.mkdirSync(path.join(TMP_ROOT, 'src'), { recursive: true });
  fs.mkdirSync(path.join(TMP_ROOT, 'tests'), { recursive: true });
}

function runScript(name, args, cwd) {
  // Run god script as child process — isolated, no require-cache pollution.
  const cmd = `node ${path.join(SCRIPTS, name + '.js')} ${args.join(' ')}`;
  try {
    const out = cp.execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return { exitCode: 0, stdout: out, stderr: '' };
  } catch (e) {
    return {
      exitCode: e.status ?? 1,
      stdout: (e.stdout || '').toString(),
      stderr: (e.stderr || '').toString(),
    };
  }
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const test = base.extend({
  api: async ({}, use) => {
    const ctx = { freshProject, runScript, readFile, TMP_ROOT, GOD_ROOT, SCRIPTS };
    freshProject();
    await use(ctx);
    // No cleanup — keeps /tmp/god-bdd-acceptance for post-mortem inspection.
  },
});

const { Given, When, Then } = createBdd(test);
module.exports = { test, Given, When, Then };