#!/usr/bin/env node
"use strict";

// PostToolUse hook: agent-browser 交互后自动检查 JS 错误 + 网络失败 + 白屏
// 机制: 通过 eval 注入 JS 监听器 → 交互后读取增量 → stderr 报告
// 白屏检测: 检查 body 子元素数 + innerHTML 长度，低于阈值即告警
// 状态: 通过临时文件追踪已报告的错误数，仅输出新增

const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STATE_FILE = path.join(os.tmpdir(), "zcode-browser-monitor.json");
const TIMEOUT = 3000;

// ── 输入解析 ──
let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf-8"));
} catch (_) {
  process.exit(0);
}

const cmd = (input.tool_input && input.tool_input.command) || "";
if (!cmd.includes("agent-browser")) process.exit(0);

// ── 命令分类 ──
const INTERACTION_RE = /\bagent-browser\s+(click|dblclick|fill|type|press|hover|focus|check|uncheck|select|drag|upload|download|scroll|scrollintoview|keyboard)\b/i;
const NAVIGATE_RE = /\bagent-browser\s+(open|back|forward|reload)\b/i;
const isInteraction = INTERACTION_RE.test(cmd);
const isNavigate = NAVIGATE_RE.test(cmd);

if (!isInteraction && !isNavigate) process.exit(0);

// ── 监听器注入代码 ──
const INJECT_SCRIPT = [
  "(function(){",
  "if(window.__bmInstalled) return JSON.stringify({status:'already_installed'});",
  "window.__bmErrors=[];",
  "window.__bmNetwork=[];",
  "window.addEventListener('error',function(e){",
  "  window.__bmErrors.push({m:e.message||'',f:e.filename||'',l:e.lineno||0,t:Date.now()});",
  "});",
  "window.addEventListener('unhandledrejection',function(e){",
  "  window.__bmErrors.push({m:(e.reason&&e.reason.message)||String(e.reason),f:'',l:0,t:Date.now()});",
  "});",
  "var oF=window.fetch;window.fetch=function(){",
  "  var u=arguments[0];",
  "  return oF.apply(this,arguments).then(function(r){",
  "    if(r.status>=400)window.__bmNetwork.push({u:r.url,s:r.status,st:r.statusText,t:Date.now()});",
  "    return r;",
  "  }).catch(function(e){",
  "    window.__bmNetwork.push({u:u||'',s:0,st:e.message,t:Date.now()});throw e;",
  "  });",
  "};",
  "var oX=XMLHttpRequest.prototype.open;",
  "var oS=XMLHttpRequest.prototype.send;",
  "XMLHttpRequest.prototype.open=function(m,u){this.__bu=u;this.__bm=m;return oX.apply(this,arguments);};",
  "XMLHttpRequest.prototype.send=function(){",
  "  var self=this;",
  "  this.addEventListener('loadend',function(){",
  "    if(self.status>=400)window.__bmNetwork.push({u:self.__bu,s:self.status,st:self.statusText,t:Date.now()});",
  "  });",
  "  return oS.apply(this,arguments);",
  "};",
  "window.__bmInstalled=true;",
  "return JSON.stringify({status:'installed'});",
  "})()",
].join("\n");

// ── 读取监控数据代码（含白屏检测） ──
const READ_SCRIPT = [
  "(function(){",
  "var html=document.body?document.body.innerHTML:'';",
  "var text=(document.body?document.body.innerText:'').trim();",
  "var kids=document.body?document.body.children.length:0;",
  "return JSON.stringify({",
  "  installed:!!window.__bmInstalled,",
  "  errors:window.__bmErrors||[],",
  "  network:window.__bmNetwork||[],",
  "  screen:{htmlLen:html.length,textLen:text.length,kids:kids,title:document.title||''}",
  "})})()",
].join("\n");

// 白屏阈值: body 子元素 ≤ 此值 且 纯文本长度 ≤ 此值 视为疑似白屏
const WHITESCREEN_MAX_CHILDREN = 1;
const WHITESCREEN_MAX_TEXT = 20;

// ── 工具函数 ──

// 临时 JS 文件目录（避免 Windows heredoc 编码问题）
const TMP_JS_DIR = path.join(os.tmpdir(), "zcode-bm");

function agentExec(js) {
  try {
    // 写 JS 到临时文件，通过 stdin 管道传递给 agent-browser eval
    if (!fs.existsSync(TMP_JS_DIR)) fs.mkdirSync(TMP_JS_DIR, { recursive: true });
    const tmpFile = path.join(TMP_JS_DIR, `bm-${Date.now()}.js`);
    fs.writeFileSync(tmpFile, js, "utf-8");

    const cmd = `agent-browser eval --stdin < "${tmpFile}"`;
    const raw = execSync(cmd, { encoding: "utf-8", timeout: TIMEOUT }).trim();

    // 清理临时文件
    try { fs.unlinkSync(tmpFile); } catch (_) {}

    // eval 输出带引号: "..."，去除首尾引号解析 JSON
    if (raw.startsWith('"') && raw.endsWith('"')) {
      return JSON.parse(raw);
    }
    return raw;
  } catch (_) {
    return null;
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch (_) {
    return { errorCount: 0, networkCount: 0 };
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (_) {
    // 静默
  }
}

// ── 主流程 ──

// 1. 导航命令: 注入监听器 + 重置状态
if (isNavigate) {
  const result = agentExec(INJECT_SCRIPT);
  // 无论注入成功与否，重置计数
  writeState({ errorCount: 0, networkCount: 0 });
  process.exit(0);
}

// 2. 交互命令: 读取增量错误
const data = agentExec(READ_SCRIPT);
if (!data || typeof data === "string") process.exit(0);

let parsed;
if (typeof data === "object") {
  parsed = data;
} else {
  try {
    parsed = JSON.parse(data);
  } catch (_) {
    process.exit(0);
  }
}

// 监听器未安装（页面导航后可能丢失）→ 先安装再退出
if (!parsed.installed) {
  agentExec(INJECT_SCRIPT);
  writeState({ errorCount: 0, networkCount: 0 });
  process.exit(0);
}

const prevState = readState();
const currentErrors = parsed.errors || [];
const currentNetwork = parsed.network || [];

// 计算增量
const newErrors = currentErrors.slice(prevState.errorCount);
const newNetwork = currentNetwork.slice(prevState.networkCount);

// 更新状态文件
writeState({
  errorCount: currentErrors.length,
  networkCount: currentNetwork.length,
});

// ── 输出 ──
const warnings = [];

if (newErrors.length > 0) {
  warnings.push(`[browser-monitor] ${newErrors.length} 个新增 JS 错误:`);
  newErrors.slice(0, 5).forEach((e) => {
    const loc = e.f ? ` (${e.f}:${e.l})` : "";
    warnings.push(`  - ${e.m}${loc}`);
  });
  if (newErrors.length > 5) {
    warnings.push(`  ... 还有 ${newErrors.length - 5} 个`);
  }
}

if (newNetwork.length > 0) {
  warnings.push(`[browser-monitor] ${newNetwork.length} 个新增失败请求:`);
  newNetwork.slice(0, 5).forEach((n) => {
    warnings.push(`  - ${n.s} ${n.st} ${n.u}`);
  });
  if (newNetwork.length > 5) {
    warnings.push(`  ... 还有 ${newNetwork.length - 5} 个`);
  }
}

// 白屏检测
const screen = parsed.screen || {};
if (screen.kids <= WHITESCREEN_MAX_CHILDREN && screen.textLen <= WHITESCREEN_MAX_TEXT) {
  warnings.push(
    `[browser-monitor] ⚠️ 疑似白屏: body 子元素=${screen.kids}, 文本长度=${screen.textLen}, title="${screen.title}"`,
  );
}

if (warnings.length > 0) {
  console.error(warnings.join("\n"));
}

process.exit(0);
