#!/usr/bin/env node
"use strict";
/**
 * auto-login.js — JLC Passport 通用登录（纯 API）
 *
 * 用法：
 *   node auto-login.js --domain dev --username 00012A --password a222222
 *   node auto-login.js --domain dev --appId JLC_PORTAL_PC --redirectUrl "https://dev.jlc.com/" \
 *                      --username 00012A --password a222222 --output ./storage-state.json
 *
 * 原理：
 *   1. SM2 加密账密（Base64 → SM2 → 04前缀）
 *   2. get-init-session 获取 device_id + lsId cookie
 *   3. with-password 获取 authCode + TGT + CAS-SID
 *
 * 依赖：sm-crypto（npm install sm-crypto）
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ═══════════════════════════════════════════════════════════════
// sm-crypto 加载（多路径探测）
// ═══════════════════════════════════════════════════════════════

let sm2;
function loadSm2() {
  if (sm2) return sm2;
  // 全局 npm 路径（Windows + Unix）
  const globalNpmPaths = [
    path.join(process.env.APPDATA || "", "npm", "node_modules"),
    "/usr/local/lib/node_modules",
    "/usr/lib/node_modules",
  ];
  const candidates = [
    // 1. NODE_PATH 环境变量
    process.env.NODE_PATH ? path.join(process.env.NODE_PATH, "sm-crypto") : null,
    // 2. 全局 npm
    ...globalNpmPaths.map(p => path.join(p, "sm-crypto")),
    // 3. 直接 require（依赖 NODE_PATH 或 cwd 下有 node_modules）
    "sm-crypto",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const mod = require(p);
      sm2 = mod.sm2;
      return sm2;
    } catch { /* next */ }
  }
  console.error("[FAIL] 找不到 sm-crypto，请全局安装：npm install -g sm-crypto");
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// 常量 & 配置
// ═══════════════════════════════════════════════════════════════

// SM2 公钥（passport 服务端固定公钥）
const SM2_PUBLIC_KEY =
  "04949f75abc2a3a91c2bb701a5bc06d623ce17f5b97846a02a141582b24b104cef34e816726c76e6fd5a2ce98e507fa5cca174d65aa87dd9ab27b24d83e1ada0a3";

// 环境域名映射
const DOMAIN_MAP = {
  dev: "dev-passport.jlc.com",
  fat: "fat-passport.jlc.com",
  uat: "uat-passport.jlc.com",
  prd: "passport.jlc.com",
};

// 固定浏览器指纹 headers（模拟 Chrome 146）
const STATIC_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "X-JLC-ClientInfo":
    "eyJjbGllbnRUeXBlIjoiUEMtV0VCIiwib3NOYW1lIjoiV2luZG93cyIsIm9zVmVyc2lvbiI6IjEwIiwiYnJvd3Nlck5hbWUiOiJDaHJvbWUiLCJicm93c2VyVmVyc2lvbiI6IjE0Ni4wLjAuMCIsImJyb3dzZXJFbmdpbmUiOiJCbGluayIsImJyb3dzZXJFbmdpbmVWZXJzaW9uIjoiMTQ2LjAuMC4wIiwic2NyZWVuV2lkdGgiOjE5MjAsInNjcmVlbkhlaWdodCI6MTA4MCwiZHByIjoxLCJjb2xvckRlcHRoIjozMiwicGl4ZWxEZXB0aCI6MzIsImdwdVZlbmRvciI6Ikdvb2dsZSBJbmMuIChJbnRlbCkiLCJncHVSZW5kZXJlciI6IkFOR0xFIChJbnRlbCwgSW50ZWwoUikgVUhEIGdyYXBoaWNzIDYzMCAoMHgwMDAwM0U5OCkgRGlyZWN0M0QxMSB2c181XzAgcHNfNV8wLCBEM0QxMSkiLCJjcHVBcmNoaXRlY3R1cmUiOiJhbWQ2NCIsImhhcmR3YXJlQ29uY3VycmVuY3kiOjgsImxhbmd1YWdlIjoiemgtQ04iLCJ0aW1lWm9uZSI6IkFzaWEvU2hhbmdoYWkiLCJ0aW1lem9uZU9mZnNldCI6LTQ4MCwibmV0VHlwZSI6IjRnIn0=",
  "JSec-X-Df":
    "04b07577e6dd0b016d23f2e70eec4325883b59e63d974edbbdf403d195b8bc3cc1b2dc8ade8a57e515bc82275ab07377b376a1bbc3fd2b6c92012013b7d7da642e5a83d66352f94246a83d806e1e417ecdcfe6b317b972feef7ddb09e6ffbf2697f179f6babf3be03fc10bcd817739b9174f4e56e726620210dd0e72f75b1b51f07945f57cb3abd3a5aa5fb4d7",
  "Accept-Sev-Twe": "Win32;-480;zh-CN;Chrome;8;8",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Support-Cookie-SameSite": "true",
};

// ═══════════════════════════════════════════════════════════════
// 参数解析
// ═══════════════════════════════════════════════════════════════

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = {
    domain: "",
    appId: "JLC_PORTAL_PC",
    redirectUrl: "",
    username: "",
    password: "",
    output: "",
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--domain" || a === "-d") && argv[i + 1]) opts.domain = argv[++i];
    else if (a === "--appId" && argv[i + 1]) opts.appId = argv[++i];
    else if (a === "--redirectUrl" && argv[i + 1]) opts.redirectUrl = argv[++i];
    else if ((a === "--username" || a === "-u") && argv[i + 1]) opts.username = argv[++i];
    else if ((a === "--password" || a === "-p") && argv[i + 1]) opts.password = argv[++i];
    else if ((a === "--output" || a === "-o") && argv[i + 1]) opts.output = argv[++i];
    else if (a === "--verbose" || a === "-v") opts.verbose = true;
  }
  return opts;
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** SM2 加密：Base64(明文) → SM2 → "04" 前缀 */
function sm2Encrypt(plaintext) {
  const s = loadSm2();
  const b64 = Buffer.from(plaintext, "utf-8").toString("base64");
  return "04" + s.doEncrypt(b64, SM2_PUBLIC_KEY, 1); // cipherMode 1 = C1C3C2
}

/** 生成随机 traceId */
function randomTraceId() {
  return crypto.randomBytes(16).toString("hex");
}

/** 生成 clientUuid */
function randomClientUuid() {
  const uuid = crypto.randomUUID();
  return uuid + "-" + Date.now();
}

/** 解析 set-cookie 头 → cookie 数组 */
function parseSetCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((raw) => {
    const parts = raw.split(";").map((s) => s.trim());
    const [nameValue, ...attrs] = parts;
    const eqIdx = nameValue.indexOf("=");
    const name = nameValue.substring(0, eqIdx);
    const value = nameValue.substring(eqIdx + 1);
    const cookie = { name, value, domain: "", path: "/", secure: false, httpOnly: false };
    for (const attr of attrs) {
      const [k, v] = attr.split("=").map((s) => s.trim());
      const kl = (k || "").toLowerCase();
      if (kl === "domain") cookie.domain = v || "";
      else if (kl === "path") cookie.path = v || "/";
      else if (kl === "expires") {
        const ts = new Date(v).getTime() / 1000;
        if (!isNaN(ts) && ts > 0) cookie.expires = ts;
      } else if (kl === "secure") cookie.secure = true;
      else if (kl === "httponly") cookie.httpOnly = true;
      else if (kl === "samesite") cookie.sameSite = v || "Lax";
    }
    return cookie;
  });
}

/** 构建 cookie 字符串 */
function buildCookieStr(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Playwright storageState 格式 */
function toStorageState(passportDomain, cookies, redirectUrl) {
  const state = { cookies: [], origins: [] };

  // 转换为 Playwright cookie 格式
  for (const c of cookies) {
    state.cookies.push({
      name: c.name,
      value: c.value,
      domain: c.domain || passportDomain,
      path: c.path || "/",
      expires: c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: c.sameSite || "Lax",
    });
  }

  // 如果有 redirectUrl，注入 localStorage 登录标志
  if (redirectUrl) {
    try {
      const origin = new URL(redirectUrl).origin;
      state.origins.push({
        origin,
        localStorage: [
          { name: "isLogin", value: "true" },
          { name: "tour-completed", value: "true" },
          { name: "guide-shown", value: "true" },
        ],
      });
    } catch { /* ignore */ }
  }

  return state;
}

// ═══════════════════════════════════════════════════════════════
// HTTP 请求
// ═══════════════════════════════════════════════════════════════

function httpsRequest(hostname, reqPath, method, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : "";
    const req = https.request(
      {
        hostname,
        port: 443,
        path: reqPath,
        method,
        headers: { ...headers, ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}) },
        rejectUnauthorized: false,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            setCookies: res.headers["set-cookie"] || [],
            data,
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(new Error("timeout")); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════

async function main() {
  const opts = parseArgs();

  // 参数校验
  if (!opts.domain) { console.error("[FAIL] 缺少 --domain 参数 (dev/fat/uat/prd)"); process.exit(1); }
  if (!opts.username) { console.error("[FAIL] 缺少 --username 参数"); process.exit(1); }
  if (!opts.password) { console.error("[FAIL] 缺少 --password 参数"); process.exit(1); }

  const passportHost = DOMAIN_MAP[opts.domain];
  if (!passportHost) { console.error(`[FAIL] 未知环境: ${opts.domain}，支持: dev/fat/uat/prd`); process.exit(1); }

  const appId = opts.appId;
  const redirectUrl = opts.redirectUrl || `https://${opts.domain === "prd" ? "www" : opts.domain}.jlc.com/`;
  const traceId = randomTraceId();
  const clientUuid = randomClientUuid();

  // 构建请求 headers
  const reqHeaders = {
    ...STATIC_HEADERS,
    "Origin": `https://${passportHost}`,
    "Referer": `https://${passportHost}/login?appId=${appId}&redirectUrl=${encodeURIComponent(redirectUrl)}`,
    "X-JLC-CAS-TaceId": traceId,
    "X-JLC-ClientUuid": clientUuid,
    "secretkey": clientUuid.replace(/-/g, ""), // 随机 secretkey
  };

  const allCookies = [];
  const cookieNames = new Set();

  function mergeCookies(newCookies) {
    for (const c of newCookies) {
      if (!cookieNames.has(c.name)) {
        cookieNames.add(c.name);
        allCookies.push(c);
      }
    }
  }

  function cookieHeader() {
    return { "Cookie": buildCookieStr(allCookies) };
  }

  if (opts.verbose) {
    console.error(`[INFO] 环境: ${opts.domain} (${passportHost})`);
    console.error(`[INFO] appId: ${appId}`);
    console.error(`[INFO] redirectUrl: ${redirectUrl}`);
  }

  // ── Step 1: get-init-session ───
  const step1 = await httpsRequest(
    passportHost,
    "/api/cas/login/get-init-session",
    "POST",
    reqHeaders,
    { appId, clientType: "PC-WEB" }
  );

  if (step1.status !== 200) {
    console.error(`[FAIL] get-init-session 失败: HTTP ${step1.status}`);
    console.error(step1.data);
    process.exit(1);
  }

  const step1Data = JSON.parse(step1.data);
  if (!step1Data.success) {
    console.error(`[FAIL] get-init-session 失败: ${step1Data.code} - ${step1Data.message || ""}`);
    process.exit(1);
  }

  mergeCookies(parseSetCookies(step1.setCookies));
  if (opts.verbose) {
    console.error(`[OK] Step 1: get-init-session → cookies: ${step1.setCookies.map((c) => c.split(";")[0]).join(", ")}`);
  }

  // ── Step 2: with-password ──
  const sm2Username = sm2Encrypt(opts.username);
  const sm2Password = sm2Encrypt(opts.password);

  const step2 = await httpsRequest(
    passportHost,
    "/api/cas/login/with-password",
    "POST",
    { ...reqHeaders, ...cookieHeader() },
    { username: sm2Username, password: sm2Password, isAutoLogin: true }
  );

  if (step2.status !== 200) {
    console.error(`[FAIL] with-password 失败: HTTP ${step2.status}`);
    console.error(step2.data);
    process.exit(1);
  }

  const step2Data = JSON.parse(step2.data);
  mergeCookies(parseSetCookies(step2.setCookies));

  if (!step2Data.success) {
    // 风控检测或其他错误
    const errorCode = step2Data.code;
    if (errorCode === 102280) {
      console.error("[FAIL] 风控拦截 (102280) — JSec-X-Df 或设备指纹可能已过期");
      console.error("  解决方案: 更新脚本中 STATIC_HEADERS 的 JSec-X-Df 值");
      console.error("  获取方式: 浏览器 DevTools → passport 页面 → Network → 复制请求头");
    } else {
      console.error(`[FAIL] with-password 失败: code=${errorCode} ${step2Data.message || ""}`);
    }
    process.exit(1);
  }

  const loginData = step2Data.data || {};
  const authCode = loginData.authCode || "";

  if (opts.verbose) {
    console.error(`[OK] Step 2: with-password → code=${step2Data.code}, authCode=${authCode.substring(0, 8)}...`);
    console.error(`       customer: ${loginData.submitCustomerInfo?.accountName || loginData.submitCustomerCode}`);
    console.error(`       cookies: ${step2.setCookies.map((c) => c.split(";")[0]).join(", ")}`);
  }

  // ── 输出结果 ──
  const result = {
    success: true,
    authCode,
    customerCode: loginData.submitCustomerCode || "",
    customerName: loginData.submitCustomerInfo?.accountName || "",
    cookies: allCookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain })),
    cookieStr: buildCookieStr(allCookies),
    passportDomain: passportHost,
    environment: opts.domain,
  };

  // 如果指定了 output，写入 Playwright storageState 格式
  if (opts.output) {
    const storageState = toStorageState(passportHost, allCookies, redirectUrl);
    const outputDir = path.dirname(path.resolve(opts.output));
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.resolve(opts.output), JSON.stringify(storageState, null, 2));
    result.storageStatePath = path.resolve(opts.output);
    if (opts.verbose) {
      console.error(`[OK] storageState 已保存: ${result.storageStatePath}`);
      console.error(`     cookies: ${storageState.cookies.length}, origins: ${storageState.origins.length}`);
    }
  }

  // JSON 输出到 stdout（供其他脚本解析）
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[FAIL] 执行失败:", err.message);
  process.exit(1);
});
