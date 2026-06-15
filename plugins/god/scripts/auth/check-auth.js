#!/usr/bin/env node
"use strict";
/**
 * check-auth.js — 认证有效性检查 (合并版)
 *
 * 合并自: check-auth-validity.js + verify-tgt.js
 *
 * 用法 (根据参数自动选择模式):
 *   node check-auth.js --config <test-config.json>                                  → 预检模式 (检查 TGT 有效性和过期)
 *   node check-auth.js --storage-state <path> --sso-url <url> [-v]                  → TGT 验证模式
 *   node check-auth.js --config <test-config.json> --storage-state <path> ...       → --config 提供默认值，直接传参优先
 */
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════════
// Shared utilities
// ═══════════════════════════════════════════════════════════════

function parseDomain(urlOrDomain) {
  if (!urlOrDomain) return null;
  if (!urlOrDomain.includes("://") && !urlOrDomain.startsWith("/")) return urlOrDomain.toLowerCase();
  try { return new URL(urlOrDomain).hostname.toLowerCase(); } catch { return null; }
}

function cookieMatchesDomain(cookie, domain) {
  const cd = cookie.domain.toLowerCase().replace(/^\./, "");
  const td = domain.toLowerCase().replace(/^\./, "");
  return cd === td || cd === "." + td || ("." + cd) === td || cd.endsWith("." + td) || td.endsWith("." + cd);
}

function findTgtCookie(ssoCookies, extraPatterns) {
  const tgtPatterns = [/^TGT/i, /CASTGC/i, /SESSION/i, /JSESSIONID/i, /ticket/i, /^token$/i, /access_token/i, /refresh_token/i];
  if (extraPatterns) tgtPatterns.push(...extraPatterns);
  return ssoCookies.find(c => tgtPatterns.some(p => p.test(c.name)));
}

// ═══════════════════════════════════════════════════════════════
// Mode 1: pre-check (原 check-auth-validity.js)
// ═══════════════════════════════════════════════════════════════

function modePreCheck(configPath) {
  if (!fs.existsSync(configPath)) { console.error(`[FAIL] 配置文件不存在: ${configPath}`); process.exit(1); }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const configDir = path.dirname(configPath);

  if (!config.auth?.ssoUrl) {
    console.log(JSON.stringify({ skip: true, reason: "no_sso_configured" }));
    process.exit(0);
  }

  const storageStatePath = config.auth?.storageStatePath
    ? path.resolve(configDir, config.auth.storageStatePath)
    : path.resolve(configDir, "auth/storage-state.json");

  if (!fs.existsSync(storageStatePath)) {
    console.error(`[FAIL] storageState 文件不存在: ${storageStatePath}`);
    console.error("[INFO] 请先执行探测脚本获取登录态:");
    console.error(`  node ${path.resolve(__dirname, "probe-with-playwright.js")} --config ${configPath} --headed`);
    console.log(JSON.stringify({ valid: false, reason: "storage_state_not_found" }));
    process.exit(1);
  }

  let state;
  try { state = JSON.parse(fs.readFileSync(storageStatePath, "utf-8")); }
  catch (e) { console.error(`[FAIL] storageState 解析失败: ${e.message}`); console.log(JSON.stringify({ valid: false, reason: "parse_error" })); process.exit(1); }

  const ssoDomain = parseDomain(config.auth.ssoUrl);
  if (!ssoDomain) { console.error(`[FAIL] 无法解析 SSO URL: ${config.auth.ssoUrl}`); console.log(JSON.stringify({ valid: false, reason: "invalid_sso_url" })); process.exit(1); }

  const ssoCookies = (state.cookies || []).filter(c => cookieMatchesDomain(c, ssoDomain));
  if (ssoCookies.length === 0) {
    console.error(`[FAIL] storageState 中未找到 SSO 域 (${ssoDomain}) 的 cookie`);
    console.error("[INFO] 请重新执行探测脚本:");
    console.error(`  node ${path.resolve(__dirname, "probe-with-playwright.js")} --config ${configPath} --headed`);
    console.log(JSON.stringify({ valid: false, reason: "no_sso_cookies" }));
    process.exit(1);
  }

  const tgtCookie = findTgtCookie(ssoCookies);
  if (!tgtCookie) {
    console.log(`[WARN] 未找到标准 TGT cookie，但 SSO 域有 ${ssoCookies.length} 个 cookie`);
    console.log(JSON.stringify({ valid: true, warning: "no_standard_tgt_name", ssoCookies: ssoCookies.map(c => c.name) }));
    process.exit(0);
  }

  if (!tgtCookie.expires || tgtCookie.expires === -1) {
    console.log(`[INFO] TGT (${tgtCookie.name}) 为会话级 cookie，无法判断过期时间`);
    console.log(JSON.stringify({ valid: true, tgtCookie: tgtCookie.name, warning: "session_cookie_no_expiry" }));
    process.exit(0);
  }

  const expiresAt = tgtCookie.expires * 1000;
  const now = Date.now();
  const remainingMs = expiresAt - now;

  if (remainingMs <= 0) {
    console.error(`[FAIL] TGT 已过期 (${tgtCookie.name}), 过期时间: ${new Date(expiresAt).toISOString()}`);
    console.error("[INFO] 请重新执行探测脚本:");
    console.error(`  node ${path.resolve(__dirname, "probe-with-playwright.js")} --config ${configPath} --headed`);
    console.log(JSON.stringify({ valid: false, reason: "tgt_expired", expiredAt: new Date(expiresAt).toISOString() }));
    process.exit(1);
  }

  const remainingMinutes = Math.floor(remainingMs / 60000);
  const result = { valid: true, tgtCookie: tgtCookie.name, remainingMinutes };
  if (remainingMs < 10 * 60 * 1000) {
    console.warn(`[WARN] TGT 即将过期 (${tgtCookie.name}), 剩余 ${remainingMinutes} 分钟`);
    result.warning = "tgt_expiring_soon";
  } else {
    console.log(`[OK] TGT 有效 (${tgtCookie.name}), 剩余 ${remainingMinutes} 分钟`);
  }
  console.log(JSON.stringify(result));
}

// ═══════════════════════════════════════════════════════════════
// Mode 2: verify-tgt (原 verify-tgt.js)
// ═══════════════════════════════════════════════════════════════

function modeVerifyTGT(options) {
  const { storageState, ssoUrl, verbose } = options;

  if (!storageState || !fs.existsSync(storageState)) {
    console.error("[FAIL] storageState 文件不存在:", storageState || "(未指定)");
    return { valid: false, reason: "file_not_found" };
  }

  let state;
  try { state = JSON.parse(fs.readFileSync(storageState, "utf-8")); }
  catch (e) { console.error("[FAIL] 无法解析 storageState:", e.message); return { valid: false, reason: "parse_error" }; }

  if (!state.cookies || !Array.isArray(state.cookies)) {
    console.error("[FAIL] storageState 格式无效：缺少 cookies 数组");
    return { valid: false, reason: "invalid_format" };
  }

  const ssoDomain = parseDomain(ssoUrl);
  if (!ssoDomain) { console.error("[FAIL] 无法解析 SSO URL:", ssoUrl || "(未指定)"); return { valid: false, reason: "invalid_sso_url" }; }

  console.log(`[INFO] 检查 SSO 域 ${ssoDomain} 的 TGT cookie...`);
  const ssoCookies = state.cookies.filter(c => cookieMatchesDomain(c, ssoDomain));

  if (verbose) {
    console.log(`[INFO] storageState 共有 ${state.cookies.length} 个 cookie`);
    console.log(`[INFO] SSO 域 ${ssoDomain} 有 ${ssoCookies.length} 个 cookie`);
  }

  if (ssoCookies.length === 0) {
    console.error(`[FAIL] 未找到 SSO 域 ${ssoDomain} 的任何 cookie`);
    console.log("[INFO] 解决方案：使用 probe-with-playwright 重新探测");
    return { valid: false, reason: "no_sso_cookies" };
  }

  console.log(`[INFO] 找到 ${ssoCookies.length} 个 SSO 域 cookie:`);
  ssoCookies.forEach(c => {
    console.log(`  - ${c.name} (domain: ${c.domain}, expires: ${c.expires ? new Date(c.expires * 1000).toISOString() : "session"})`);
  });

  const tgtCookie = findTgtCookie(ssoCookies);
  if (!tgtCookie) {
    console.warn("[WARN] 未找到标准 TGT cookie");
    return { valid: true, reason: "no_standard_tgt", cookies: ssoCookies.map(c => c.name) };
  }

  console.log(`[OK] 找到 TGT cookie: ${tgtCookie.name} (domain: ${tgtCookie.domain})`);
  if (tgtCookie.expires) {
    const expiresAt = new Date(tgtCookie.expires * 1000);
    if (expiresAt < new Date()) { console.warn(`[WARN] Cookie 已过期: ${expiresAt.toISOString()}`); return { valid: false, reason: "cookie_expired", expiredAt: expiresAt }; }
    console.log(`[OK] 有效期至: ${expiresAt.toISOString()}`);
  } else {
    console.log("[OK] 有效期: 会话级");
  }

  return { valid: true, tgtCookie: tgtCookie.name, domain: tgtCookie.domain, expires: tgtCookie.expires };
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

function main() {
  const argv = process.argv.slice(2);
  let config = null, storageState = null, ssoUrl = null, verbose = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config" && argv[i + 1]) config = argv[++i];
    else if (argv[i] === "--storage-state" && argv[i + 1]) storageState = argv[++i];
    else if (argv[i] === "--sso-url" && argv[i + 1]) ssoUrl = argv[++i];
    else if (argv[i] === "--verbose" || argv[i] === "-v") verbose = true;
  }

  // --config provides defaults for storage-state and sso-url
  if (config && fs.existsSync(config)) {
    const cfg = JSON.parse(fs.readFileSync(config, "utf-8"));
    const cfgDir = path.dirname(config);
    if (!storageState) {
      storageState = cfg.auth?.storageStatePath ? path.resolve(cfgDir, cfg.auth.storageStatePath) : path.resolve(cfgDir, "auth/storage-state.json");
    }
    if (!ssoUrl) ssoUrl = cfg.auth?.ssoUrl || null;
  }

  // Route to correct mode
  if (storageState && ssoUrl) {
    // verify-tgt mode
    const result = modeVerifyTGT({ storageState, ssoUrl, verbose });
    if (result.valid) { console.log("\n[OK] TGT 验证通过"); process.exit(0); }
    else { console.log("\n[FAIL] TGT 验证失败"); process.exit(1); }
  } else if (config) {
    // pre-check mode (only --config, no explicit storage-state + sso-url)
    modePreCheck(config);
  } else {
    console.error("用法:");
    console.error("  node check-auth.js --config <test-config.json>");
    console.error("  node check-auth.js --storage-state <path> --sso-url <url> [-v]");
    console.error("  node check-auth.js --config <cfg> --storage-state <path> --sso-url <url>");
    process.exit(1);
  }
}

main();
