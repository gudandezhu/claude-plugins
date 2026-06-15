#!/usr/bin/env node
"use strict";

// PostToolUse hook: Write/Edit 完成后检测文件编码问题
// 检测项: U+FFFD(乱码替换符)、BOM标记
// 有问题 → stderr 输出警告，AI 自动感知

const fs = require("fs");

// 跳过二进制/无关文件
const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".zip", ".tar", ".gz", ".jar", ".class",
  ".exe", ".dll", ".so", ".dylib",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".mp3", ".mp4", ".wav", ".avi",
]);

const SKIP_DIRS = ["node_modules", ".git", "dist", "build", "target"];

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf-8"));
} catch (_) {
  process.exit(0);
}

const filePath = (input.tool_input && input.tool_input.file_path) || "";
if (!filePath) process.exit(0);

// 跳过无关文件
const ext = filePath.replace(/\\/g, "/").split("/").pop();
const extMatch = ext.match(/\.[^.]+$/);
if (extMatch && SKIP_EXT.has(extMatch[0].toLowerCase())) process.exit(0);
const normalizedPath = filePath.replace(/\\/g, "/");
if (SKIP_DIRS.some((d) => normalizedPath.includes("/" + d + "/"))) process.exit(0);

// 读取文件原始字节
let buf;
try {
  buf = fs.readFileSync(filePath);
} catch (_) {
  // 文件不存在或无法读取，静默退出
  process.exit(0);
}

const warnings = [];

// 检测 BOM (UTF-8 BOM: EF BB BF)
if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
  warnings.push("检测到 UTF-8 BOM 标记（EF BB BF），建议移除以保持一致性");
}

// 检测 U+FFFD 替换字符 (UTF-8: EF BF BD)
const content = buf.toString("utf-8");
const fffdPositions = [];
for (let i = 0; i < content.length; i++) {
  if (content.charCodeAt(i) === 0xfffd) {
    // 计算行号
    const line = content.substring(0, i).split("\n").length;
    fffdPositions.push(line);
  }
}

if (fffdPositions.length > 0) {
  const uniqueLines = [...new Set(fffdPositions)].slice(0, 5);
  const suffix = fffdPositions.length > 5 ? ` 等 ${fffdPositions.length} 处` : "";
  warnings.push(
    `检测到 ${fffdPositions.length} 处乱码字符(U+FFFD), 位于第 ${uniqueLines.join(", ")} 行${suffix}。` +
    `原始字符已丢失，需要人工确认正确内容后修复。`
  );
}

// 检测 CRLF 混用（同一文件中 LF 和 CRLF 混合出现）
const hasCR = buf.includes(0x0d);
const hasLF = buf.includes(0x0a);
if (hasCR && hasLF) {
  // 检查是否有纯 LF（不含 CRLF）
  let mixed = false;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) continue; // CRLF, OK
    if (buf[i] === 0x0a) {
      mixed = true;
      break;
    }
  }
  if (mixed) {
    warnings.push("检测到 CRLF/LF 行尾混用，建议统一为 LF");
  }
}

if (warnings.length > 0) {
  console.error(
    `[encoding-guard] 文件编码警告: ${filePath.replace(/\\/g, "/")}\n` +
    warnings.map((w) => "  - " + w).join("\n")
  );
  process.exit(0); // 不拦截，仅提示
}

process.exit(0);
