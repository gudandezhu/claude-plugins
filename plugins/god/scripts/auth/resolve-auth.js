#!/usr/bin/env node
"use strict";
/**
 * resolve-auth.js
 * 认证预设解析脚本：读取团队级 test-auth-preset.json，解析凭证，查找缓存。
 *
 * 用法：
 *   node resolve-auth.js --workspace $JLC_AI_WORKSPACE --base-url http://localhost:9090 [--testing-dir path]
 *   node resolve-auth.js --inject --storage-state <path> --frontend-url <url> [--config <cfg>] [--flags <json>]
 *
 * 输出 JSON：
 * {
 *   "status": "ready | no-preset | no-credentials | error",
 *   "preset": { "auth": {...}, "apiAuth": {...} },
 *   "credentials": { "username": "xxx", "password": "xxx", "captcha": "1234" },
 *   "postLoginSteps": [{ "action": "click", "selector": "...", "description": "..." }],
 *   "cachedStorageState": "/path/to/cached/storage-state.json",
 *   "localStorageState": "/path/to/testing/auth/storage-state.json",
 *   "message": "描述信息"
 * }
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { safeReadJson } = require("../lib/safe-json");

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = { workspace: "", baseUrl: "", testingDir: "", inject: false, storagePath: "", frontendUrl: "", flags: "", configPath: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--workspace" && argv[i + 1]) opts.workspace = argv[++i];
    if (argv[i] === "--base-url" && argv[i + 1]) opts.baseUrl = argv[++i];
    if (argv[i] === "--testing-dir" && argv[i + 1]) opts.testingDir = argv[++i];
    if (argv[i] === "--inject") opts.inject = true;
    if (argv[i] === "--storage-state" && argv[i + 1]) opts.storagePath = argv[++i];
    if (argv[i] === "--frontend-url" && argv[i + 1]) opts.frontendUrl = argv[++i];
    if (argv[i] === "--flags" && argv[i + 1]) opts.flags = argv[++i];
    if (argv[i] === "--config" && argv[i + 1]) opts.configPath = argv[++i];
  }
  return opts;
}

function output(result) {
  console.log(JSON.stringify(result, null, 2));
}

function hashBaseUrl(baseUrl) {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    return crypto.createHash("md5").update(url.host).digest("hex").slice(0, 8);
  } catch {
    return null;
  }
}

function resolveCredentials(preset) {
  const creds = preset.auth?.credentials;
  if (!creds) return { ok: false, message: "预设中未配置 credentials" };

  if (creds.source === "preset") {
    // 凭证直接写在预设文件中（适合固定测试账号）
    if (!creds.username || !creds.password) {
      return { ok: false, message: "credentials 中缺少 username 或 password" };
    }
    const result = { ok: true, username: creds.username, password: creds.password };
    if (creds.captcha !== undefined) result.captcha = creds.captcha;
    if (creds.extra) result.extra = creds.extra;
    return result;
  }

  if (creds.source === "env") {
    const uVar = creds.usernameVar || "TEST_USERNAME";
    const pVar = creds.passwordVar || "TEST_PASSWORD";
    const username = process.env[uVar];
    const password = process.env[pVar];
    const missing = [];
    if (!username) missing.push(uVar);
    if (!password) missing.push(pVar);
    if (missing.length > 0) {
      return { ok: false, message: `环境变量未设置: ${missing.join(", ")}` };
    }
    const result = { ok: true, username, password };
    // 验证码：支持固定值或环境变量
    if (creds.captcha !== undefined) result.captcha = creds.captcha;
    else if (creds.captchaVar) {
      const cv = process.env[creds.captchaVar];
      if (cv) result.captcha = cv;
    }
    // 额外登录字段（如租户、域等）
    if (creds.extra) result.extra = creds.extra;
    return result;
  }

  if (creds.source === "config") {
    const configFile = creds.configFile;
    if (!configFile) return { ok: false, message: "credentials.configFile 未指定" };
    const resolved = configFile.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "");
    if (!fs.existsSync(resolved)) {
      return { ok: false, message: `凭证文件不存在: ${configFile}` };
    }
    const data = safeReadJson(resolved, { fallback: null });
    if (!data) {
      return { ok: false, message: `凭证文件解析失败: ${configFile}` };
    }
    if (!data.username || !data.password) {
      return { ok: false, message: "凭证文件缺少 username 或 password 字段" };
    }
    const result = { ok: true, username: data.username, password: data.password };
    if (data.captcha !== undefined) result.captcha = data.captcha;
    if (data.extra) result.extra = data.extra;
    // 也支持预设文件中的固定 captcha 覆盖
    if (creds.captcha !== undefined) result.captcha = creds.captcha;
    if (creds.extra) result.extra = { ...result.extra, ...creds.extra };
    return result;
  }

  return { ok: false, message: `不支持的 credentials.source: ${creds.source}` };
}

function main() {
  const opts = parseArgs();

  if (opts.inject) {
    return modeInject(opts);
  }

  const { workspace, baseUrl, testingDir } = opts;
  if (!workspace) {
    output({ status: "error", message: "必须指定 --workspace 参数" });
    process.exit(0);
  }
  const presetPath = path.join(workspace, "biz-tech-docs", "test-auth-preset.json");

  // 1. 检查预设文件
  if (!fs.existsSync(presetPath)) {
    output({ status: "no-preset", message: "预设文件不存在: " + presetPath });
    return;
  }

  // 2. 解析预设
  const preset = safeReadJson(presetPath, { fallback: null });
  if (!preset) {
    output({ status: "error", message: `预设文件格式错误` });
    return;
  }

  // 3. 基本校验
  if (!preset.auth || !preset.auth.type) {
    output({ status: "error", message: "预设文件缺少 auth.type 字段" });
    return;
  }

  // 4. auth.type = "none" 时不需要凭证
  if (preset.auth.type === "none") {
    output({
      status: "ready",
      preset: { auth: preset.auth, apiAuth: preset.apiAuth || null },
      credentials: null,
      cachedStorageState: null,
      localStorageState: null,
      message: "认证类型为 none，无需凭证",
    });
    return;
  }

  // 5. 解析凭证
  const creds = resolveCredentials(preset);
  if (!creds.ok) {
    output({ status: "no-credentials", preset: { auth: preset.auth, apiAuth: preset.apiAuth || null }, message: creds.message });
    return;
  }

  // 6. 查找 storage-state 缓存
  let localStorageState = null;
  let cachedStorageState = null;

  if (testingDir) {
    const localPath = path.join(testingDir, "auth", "storage-state.json");
    if (fs.existsSync(localPath)) localStorageState = localPath;
  }

  const hash = hashBaseUrl(baseUrl);
  if (hash) {
    const cachePath = path.join(workspace, "biz-tech-docs", ".auth-cache", `storage-state_${hash}.json`);
    if (fs.existsSync(cachePath)) cachedStorageState = cachePath;
  }

  output({
    status: "ready",
    preset: { auth: preset.auth, apiAuth: preset.apiAuth || null },
    credentials: {
      username: creds.username,
      password: creds.password,
      ...(creds.captcha !== undefined ? { captcha: creds.captcha } : {}),
      ...(creds.extra ? { extra: creds.extra } : {}),
    },
    postLoginSteps: preset.auth.postLoginSteps || null,
    cachedStorageState,
    localStorageState,
    message: "预设就绪，凭证已解析",
  });
}

// ═══════════════════════════════════════════════════════════════
// Inject mode (原 inject-auth-flag.js)
// ═══════════════════════════════════════════════════════════════

function getOrigin(url) {
  try { return new URL(url).origin; } catch { return url; }
}

function injectFlags(state, frontendOrigin, flagsToInject) {
  state.origins = state.origins || [];
  let originEntry = state.origins.find(o => o.origin === frontendOrigin);
  if (!originEntry) { originEntry = { origin: frontendOrigin, localStorage: [] }; state.origins.push(originEntry); }
  originEntry.localStorage = originEntry.localStorage || [];

  const injectedFlags = [];
  for (const flag of flagsToInject) {
    const existing = originEntry.localStorage.find(l => l.name === flag.name);
    if (existing) {
      if (existing.value !== flag.value) { existing.value = flag.value; injectedFlags.push({ ...flag, action: "updated" }); }
    } else {
      originEntry.localStorage.push({ name: flag.name, value: flag.value });
      injectedFlags.push({ ...flag, action: "added" });
    }
  }
  return injectedFlags;
}

function fixSecureCookies(state, isHttps) {
  if (isHttps) return [];
  const fixed = [];
  for (const cookie of (state.cookies || [])) {
    if (cookie.secure) { delete cookie.secure; fixed.push(cookie.name); }
    if (cookie.sameSite === "None") cookie.sameSite = "Lax";
  }
  return fixed;
}

function modeInject(opts) {
  if (!opts.storagePath) {
    console.log(JSON.stringify({ status: "error", message: "必须提供 --storage-state 参数" }));
    process.exit(1);
  }
  if (!fs.existsSync(opts.storagePath)) {
    console.log(JSON.stringify({ status: "not_found", message: `storage-state.json 不存在: ${opts.storagePath}` }));
    process.exit(0);
  }

  const defaultFlags = [
    { name: "isLogin", value: "true" },
    { name: "tour-completed", value: "true" },
    { name: "guide-shown", value: "true" },
  ];

  let flagsToInject = defaultFlags;
  if (opts.configPath && fs.existsSync(opts.configPath)) {
    const config = safeReadJson(opts.configPath, { fallback: null });
    if (config) {
      const configFlags = config.auth?.storageStatePatches?.localStorage;
      if (Array.isArray(configFlags) && configFlags.length > 0) flagsToInject = configFlags;
    }
  }
  if (opts.flags) {
    try { const parsed = JSON.parse(opts.flags); if (Array.isArray(parsed)) flagsToInject = parsed; } catch { /* ignore */ }
  }

  const state = safeReadJson(opts.storagePath, { fallback: null });
  if (!state) {
    console.log(JSON.stringify({ status: "error", message: "解析 storage-state.json 失败" }));
    process.exit(1);
  }

  const frontendOrigin = opts.frontendUrl ? getOrigin(opts.frontendUrl) : "";
  const isHttps = opts.frontendUrl?.startsWith("https://");
  const injectedFlags = injectFlags(state, frontendOrigin, flagsToInject);
  const fixedCookies = fixSecureCookies(state, isHttps);
  fs.writeFileSync(opts.storagePath, JSON.stringify(state, null, 2));

  console.log(JSON.stringify({
    status: "success",
    message: `成功注入 ${injectedFlags.length} 个标记，修正 ${fixedCookies.length} 个 cookie`,
    injected: injectedFlags, fixedCookies, storageState: opts.storagePath, origin: frontendOrigin,
  }, null, 2));
}

main();
