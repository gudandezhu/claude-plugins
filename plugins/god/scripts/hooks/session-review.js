#!/usr/bin/env node
"use strict";

/**
 * Stop hook: 会话回顾 — 新发现沉淀检查
 *
 * 条件满足时输出 additionalContext，让 Claude 多做一个 turn：
 *   1. 回顾本次对话新发现（领域规则、隐性约束、常见错误）
 *   2. 生成当前仓库 CLAUDE.md 更新建议
 *   3. AskUserQuestion 由用户确认后写入
 *
 * 触发条件（全部满足）：
 *   - stop_hook_active === false（非 hook 引起的继续）
 *   - CWD 在 JLC_AI_WORKSPACE 内
 *   - 会话时长 > ZCODE_REVIEW_MIN_DURATION（默认 15 分钟）
 *   - 文件编辑次数 > 0
 *   - 冷却期内未触发过（ZCODE_REVIEW_COOLDOWN，默认 30 分钟）
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ---------------------------------------------------------------------------
// Read stdin (Claude Code Stop hook provides JSON)
// ---------------------------------------------------------------------------
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }
  main(data);
});

// ---------------------------------------------------------------------------
// Main logic
// ---------------------------------------------------------------------------
function main(data) {
  // Guard 1: stop_hook_active → don't loop
  if (data.stop_hook_active) process.exit(0);

  // Guard 2: workspace check
  const jlcWorkspace = process.env.JLC_AI_WORKSPACE || "";
  if (!jlcWorkspace) process.exit(0);
  const cwd = (data.cwd || process.cwd()).replace(/\\/g, "/");
  const ws = jlcWorkspace.replace(/\\/g, "/");
  if (cwd !== ws && !cwd.startsWith(ws + "/")) process.exit(0);

  // Guard 3: session id
  const sessionId = data.session_id || process.env.CLAUDE_CODE_SESSION_ID || "";
  if (!sessionId) process.exit(0);

  // Guard 4: cooldown — skip if triggered recently
  const cooldownMin = parseInt(process.env.ZCODE_REVIEW_COOLDOWN || "30", 10);
  const reviewDir = path.join(os.homedir(), ".zcode", "session-reviews");
  const cooldownFile = path.join(reviewDir, `${sessionId}.cooldown`);
  if (fs.existsSync(cooldownFile)) {
    const lastTs = parseInt(fs.readFileSync(cooldownFile, "utf-8").trim(), 10);
    if (Date.now() - lastTs < cooldownMin * 60 * 1000) process.exit(0);
  }

  // Locate transcript
  const transcriptPath = (data.transcript_path || "")
    .replace(/^~/, os.homedir())
    .replace(/\\/g, "/");
  if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

  // Lightweight transcript analysis
  const stats = analyzeTranscript(transcriptPath);

  // Guard 5: minimum duration
  const minDurationMin = parseInt(
    process.env.ZCODE_REVIEW_MIN_DURATION || "15",
    10
  );
  if (stats.durationMs < minDurationMin * 60 * 1000) process.exit(0);

  // Guard 6: must have file edits
  if (stats.fileEdits === 0) process.exit(0);

  // --- All guards passed: trigger review ---

  // Write cooldown timestamp
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(cooldownFile, String(Date.now()));

  // Clean up old cooldown files (> 7 days)
  try {
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(reviewDir)) {
      const fp = path.join(reviewDir, f);
      const stat = fs.statSync(fp);
      if (Date.now() - stat.mtimeMs > maxAge) fs.unlinkSync(fp);
    }
  } catch {
    /* ignore cleanup errors */
  }

  const durationMin = Math.round(stats.durationMs / 60000);

  // --- Build prompt ---
  // Line 1-2: brief user-facing notification (what user sees at a glance)
  // Rest: full instructions for Claude (preserved verbatim, not shortened)
  const prompt =
    `📋 会话回顾：${stats.turns} 轮 / ${stats.fileEdits} 次编辑 / ${durationMin} 分钟\n\n` +
    `请回顾本次对话中的新发现，识别可沉淀到当前仓库 CLAUDE.md 的信息：\n\n` +
    `**沉淀范围**：\n` +
    `1. **领域规则** — 发现的业务规则、技术约束、数据约束\n` +
    `2. **隐性约束** — 项目隐含的命名规范、架构约束、依赖关系\n` +
    `3. **常见错误** — 踩过的坑、易犯的错误、调试经验\n\n` +
    `**操作要求**：\n` +
    `- 只更新**当前仓库**的 CLAUDE.md（通过 \`git rev-parse --show-toplevel\` 定位仓库根目录），不修改工作空间或其他仓库的 CLAUDE.md\n` +
    `- 先读取当前仓库的 CLAUDE.md 了解已有内容\n` +
    `- 只提取本次对话中**新发现**的信息，不重复已有内容\n` +
    `- 使用 AskUserQuestion 展示建议的更新内容（包含具体文本），由用户确认后再写入\n` +
    `- 如果没有值得沉淀的新发现，简短告知即可，不需要写入`;

  console.log(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: prompt,
      },
    })
  );
}

// ---------------------------------------------------------------------------
// Lightweight JSONL analysis — only reads first/last timestamps + edit count
// ---------------------------------------------------------------------------
function analyzeTranscript(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(4096);

  let turns = 0;
  let fileEdits = 0;
  let firstTs = null;
  let lastTs = null;

  let leftover = "";

  // Read line by line using a sliding buffer
  function readLines() {
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
    if (bytesRead === 0) return false;
    const chunk = leftover + buf.toString("utf-8", 0, bytesRead);
    const lines = chunk.split("\n");
    leftover = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        processEntry(entry);
      } catch {
        /* skip malformed lines */
      }
    }
    return true;
  }

  function processEntry(entry) {
    // Timestamps
    if (entry.timestamp) {
      const ts = new Date(entry.timestamp).getTime();
      if (!isNaN(ts)) {
        if (!firstTs || ts < firstTs) firstTs = ts;
        if (!lastTs || ts > lastTs) lastTs = ts;
      }
    }

    // Count assistant turns
    if (entry.type === "assistant") turns++;

    // Count file edits from tool_use blocks
    if (entry.message && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) {
        if (
          block.type === "tool_use" &&
          (block.name === "Edit" || block.name === "Write")
        ) {
          fileEdits++;
        }
      }
    }
  }

  while (readLines()) {
    // Process entire file
  }

  // Process remaining leftover
  if (leftover.trim()) {
    try {
      processEntry(JSON.parse(leftover));
    } catch {
      /* ignore */
    }
  }

  fs.closeSync(fd);

  const durationMs = firstTs && lastTs ? lastTs - firstTs : 0;
  return { turns, fileEdits, durationMs };
}
