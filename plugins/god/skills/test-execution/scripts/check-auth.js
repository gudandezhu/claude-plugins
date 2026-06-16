#!/usr/bin/env node
"use strict";
/**
 * check-auth.js
 * 检查 storageState.json 的登录态状态。
 * 封装公共的 storageState 检查逻辑，供 test-probing 和 test-debug 共用。
 *
 * 用法：node check-auth.js --storage-state <path>
 * 输出 JSON：{ status, details }
 *   status: "valid" | "not_found" | "expired_cookie" | "auth_flag_false"
 *           | "no_lsid_session_only" | "session_only" | "parse_error"
 */
const fs = require("fs");
const path = require("path");

function parseArgs() {
  const argv = process.argv.slice(2);
  let storagePath = "";
  let ssoUrl = "";
  let localStorageChecks = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--storage-state" && argv[i + 1]) storagePath = argv[++i];
    if (argv[i] === "--sso-url" && argv[i + 1]) ssoUrl = argv[++i];
    if (argv[i] === "--local-storage-checks" && argv[i + 1]) localStorageChecks = argv[++i];
  }
  return { storagePath, ssoUrl, localStorageChecks };
}

function checkAuth(storagePath, ssoUrl = "") {
  if (!fs.existsSync(storagePath)) {
    return { status: "not_found", details: `文件不存在: ${storagePath}` };
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  } catch (e) {
    return { status: "parse_error", details: `JSON 解析失败: ${e.message}` };
  }

  const cookies = state.cookies || [];
  if (cookies.length === 0) {
    return { status: "not_found", details: "storageState 中无 cookie" };
  }

  const now = Date.now() / 1000;
  const sessionCookies = cookies.filter((c) => c.expires === -1);
  const expiredCookies = cookies.filter(
    (c) => c.expires > 0 && c.expires < now
  );
  const validCookies = cookies.filter(
    (c) => c.expires === -1 || c.expires > now
  );

  // 全部过期
  if (expiredCookies.length === cookies.length) {
    return {
      status: "expired_cookie",
      details: `全部 ${cookies.length} 个 cookie 已过期`,
    };
  }

  // 有过期 cookie（部分过期）
  if (expiredCookies.length > 0) {
    return {
      status: "expired_cookie",
      details: `${expiredCookies.length}/${cookies.length} 个 cookie 已过期`,
    };
  }

  // 全部是 session cookie（expires=-1），服务端 session 可能已失效
  if (sessionCookies.length === cookies.length) {
    // 检查是否有 lsId 等关键 cookie
    const hasLsId = cookies.some(
      (c) => c.name === "lsId" || c.name === "JSESSIONID"
    );
    if (hasLsId) {
      return {
        status: "session_only",
        details: `${sessionCookies.length} 个 session cookie，含 lsId/JSESSIONID`,
      };
    }
    return {
      status: "no_lsid_session_only",
      details: `${sessionCookies.length} 个 session cookie，无 lsId`,
    };
  }

  // 检查 localStorage 中的认证标志（从配置读取，向后兼容）
  // auth.storageStatePatches.localStorage 配置需要检查的标志
  // 未配置时跳过检查，保持向后兼容
  const lsItems = (state.origins || []).flatMap(o => o.localStorage || []);
  
  // 获取配置的 localStorage 检查项（从环境变量传入）
  const localStorageChecksJson = process.env.AUTH_LOCAL_STORAGE_CHECKS || "";
  let localStorageChecks = [];
  if (localStorageChecksJson) {
    try {
      localStorageChecks = JSON.parse(localStorageChecksJson);
    } catch (e) {
      // 解析失败，使用空数组
    }
  }
  
  // 检查每个配置的标志
  for (const check of localStorageChecks) {
    const item = lsItems.find(i => i.name === check.name);
    if (item && item.value !== check.value) {
      return {
        status: "auth_flag_false",
        details: `localStorage.${check.name}=${item.value}（期望 "${check.value}"），前端路由守卫会拦截所有页面并重定向到登录页`,
        flagName: check.name,
        expectedValue: check.value,
        actualValue: item.value,
      };
    }
  }

  // CAS 场景：检查 SSO 域 cookie（TGT）是否存在
  // 缺少 TGT 时 Playwright 加载 storageState 后仍会被重定向到 CAS 登录页
  if (ssoUrl) {
    let ssoDomain = ssoUrl;
    try {
      ssoDomain = new URL(ssoUrl.startsWith("http") ? ssoUrl : `https://${ssoUrl}`).hostname;
    } catch { /* keep as-is */ }
    const hasSsoCookie = cookies.some(c =>
      c.domain && (c.domain.includes(ssoDomain) || ssoDomain.includes(c.domain.replace(/^\./, "")))
    );
    if (!hasSsoCookie) {
      return {
        status: "cas_tgt_missing",
        details: `storageState 中未找到 CAS/SSO 域（${ssoDomain}）的 cookie（TGT）。请运行 auth-login.js 重新获取登录态（必须经 Playwright context.storageState() 输出）`,
      };
    }
  }

  // 有有效的非 session cookie
  return {
    status: "valid",
    details: `${validCookies.length} 个有效 cookie（${sessionCookies.length} 个 session）`,
  };
}

function main() {
  const { storagePath, ssoUrl, localStorageChecks } = parseArgs();
  if (!storagePath) {
    console.error("用法: node check-auth.js --storage-state <path> [--sso-url <sso域名>] [--local-storage-checks <json数组>]");
    process.exit(1);
  }

  // 将 localStorageChecks 传入环境变量，供检查逻辑使用
  if (localStorageChecks) {
    process.env.AUTH_LOCAL_STORAGE_CHECKS = localStorageChecks;
  }

  const result = checkAuth(storagePath, ssoUrl);
  console.log(JSON.stringify(result));
  // 非 valid/session_only 状态退出码为 1
  if (result.status !== "valid" && result.status !== "session_only") {
    process.exit(1);
  }
}

main();
