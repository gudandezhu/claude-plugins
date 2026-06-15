#!/usr/bin/env node
/**
 * extract.js
 * 从 session JSONL 提取完整 evidence（thinking chain、tool call 时序、hooks、文件编辑、skill 检测）。
 * Port from forensic/extract.go。
 *
 * 用法：
 *   node extract.js <session-jsonl-path> [--out <dir>] [--slug <name>]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  createExtractResult,
  computeDurationMs,
  truncate,
  extractUserContent,
  detectSkills,
  copyFile,
  aggregateToolInput,
  addToAgg,
  formatDurationMs,
  formatSec,
  formatDuration,
  readJsonlSync,
} = require("./lib");

// ── Main extract logic ───────────────────────────────

function runExtract(jsonlPath, outDir, slug) {
  // Resolve output directory: slug > outDir > auto-derive from session ID
  // Pass outDir=null/undefined to skip file output (programmatic use)
  if (slug) {
    outDir = path.join("docs", "forensics", slug, "evidence");
  } else if (outDir === undefined) {
    const base = path.basename(jsonlPath, ".jsonl");
    if (base.length >= 8) {
      outDir = path.join("docs", "forensics", base, "evidence");
    }
  }

  if (!fs.existsSync(jsonlPath)) {
    console.error(`[ERROR] 文件不存在: ${jsonlPath}`);
    process.exit(1);
  }

  const result = createExtractResult(jsonlPath);

  // Pending tool_use calls for timing: toolUseID -> { ts, tool, line, detail }
  const pending = new Map();
  let firstTS = null, lastTS = null, prevTS = null;

  const lineCount = readJsonlSync(jsonlPath, (entry, lineNum) => {
    // Track git branch
    if (!result.gitBranch && entry.gitBranch) {
      result.gitBranch = entry.gitBranch;
    }

    switch (entry.type) {
      case "assistant": {
        result.summary.llmTurns++;
        const msg = entry.message;
        if (!msg) break;
        const blocks = Array.isArray(msg.content) ? msg.content : [];

        // Token accounting
        if (msg.usage) {
          result.summary.tokens.input += msg.usage.input_tokens || 0;
          result.summary.tokens.output += msg.usage.output_tokens || 0;
          result.summary.tokens.cacheRead += msg.usage.cache_read_input_tokens || 0;
          result.summary.tokens.cacheCreation += msg.usage.cache_creation_input_tokens || 0;
        }

        for (const block of blocks) {
          switch (block.type) {
            case "thinking":
              result.summary.totalThinking++;
              result.thinking.push({
                line: lineNum,
                thinking: truncate(block.thinking, 500),
                stopReason: msg.stop_reason || "",
                model: msg.model || "",
                msgId: msg.id || "",
              });
              if (!result.model && msg.model) result.model = msg.model;
              break;

            case "tool_use":
              result.summary.totalToolCalls++;
              result.summary.toolBreakdown[block.name] = (result.summary.toolBreakdown[block.name] || 0) + 1;
              const inputJSON = JSON.stringify(block.input || {});
              result.toolCalls.push({
                line: lineNum,
                tool: block.name,
                input: truncate(inputJSON, 300),
                stopReason: msg.stop_reason || "",
                msgId: msg.id || "",
              });
              aggregateToolInput(block.name, block.input, result.summary);
              // Record pending tool_use for timing
              if (block.id && entry.timestamp) {
                pending.set(block.id, {
                  ts: entry.timestamp,
                  tool: block.name,
                  line: lineNum,
                  detail: truncate(inputJSON, 120),
                });
              }
              break;
          }
        }

        // Track stop reasons
        if (msg.stop_reason) {
          result.summary.stopReasons[msg.stop_reason] = (result.summary.stopReasons[msg.stop_reason] || 0) + 1;
        }

        // Track timestamps for duration
        let ts = entry.timestamp || entry.snapshot?.timestamp || null;
        if (ts) {
          if (!firstTS) firstTS = ts;
          lastTS = ts;
          if (prevTS) {
            const dur = computeDurationMs(prevTS, ts);
            if (dur > 0) {
              result.summary.thinkingTurns.push({
                line: lineNum,
                seconds: dur / 1000,
                stopReason: msg.stop_reason || "",
                detail: truncate(firstThinking(blocks), 80),
              });
              result.summary.totalThinkingMs += dur;
            }
          }
        }
        break;
      }

      case "user": {
        result.summary.totalUserMsgs++;
        const content = extractUserContent(entry);
        if (content) {
          result.userMsgs.push({
            line: lineNum,
            content: truncate(content, 300),
          });
          detectSkills(content, result.skillsUsed);
        }

        // Extract tool_result metadata
        const msg = entry.message;
        const blocks = Array.isArray(msg?.content) ? msg.content : [];
        for (const block of blocks) {
          if (block.type === "tool_result") {
            // Match with pending tool_use for timing
            const pc = pending.get(block.tool_use_id);
            if (pc) {
              const dur = computeDurationMs(pc.ts, entry.timestamp);
              if (dur >= 0) {
                result.summary.totalToolMs += dur;
                result.summary.topSlowest.push({
                  tool: pc.tool,
                  line: pc.line,
                  seconds: dur / 1000,
                  detail: pc.detail,
                });
              }
              pending.delete(block.tool_use_id);
            }
            result.summary.totalToolResults++;
            const tre = {
              line: lineNum,
              toolUseId: block.tool_use_id || "",
            };
            if (entry.toolUseResult) {
              tre.resultType = entry.toolUseResult.type || "";
              tre.filePath = entry.toolUseResult.filePath || "";
            }
            result.toolResults.push(tre);
          }
        }
        break;
      }

      case "attachment": {
        const att = entry.attachment;
        if (!att) break;

        switch (att.type) {
          case "invoked_skills":
            for (const skill of (att.skills || [])) {
              const name = (skill.name || "").toLowerCase().replace(/^forge:/, "");
              if (name && !result.skillsUsed.includes(name)) {
                result.skillsUsed.push(name);
              }
            }
            break;

          case "hook_success":
            result.hooks.push({
              line: lineNum,
              hookName: att.hookName || "",
              hookEvent: att.hookEvent || "",
              durationMs: att.durationMs || 0,
              exitCode: att.exitCode || 0,
              command: att.command || "",
            });
            addToAgg(result.summary.hookBreakdown, att.hookName || "");
            if (att.exitCode && att.exitCode !== 0) {
              result.summary.hookFailures++;
            }
            break;

          case "edited_text_file":
            if (att.filename) {
              result.filesEdited.push(att.filename);
            }
            break;

          case "compact_file_reference":
            result.summary.compactCount++;
            break;

          case "plan_mode":
          case "plan_mode_exit":
          case "plan_mode_reentry":
            result.summary.planModeCount++;
            break;
        }

        // Track skill invocations from all attachment types
        for (const skill of (att.skills || [])) {
          addToAgg(result.summary.skillInvocations, skill.name || "");
        }
        break;
      }
    }

    // Update prevTS
    const entryTS = entry.timestamp || entry.snapshot?.timestamp || null;
    if (entryTS) prevTS = entryTS;
  });

  result.lines = lineCount;

  // Aggregate timing by tool type and sort topSlowest
  const toolTiming = {};
  for (const t of result.summary.topSlowest) {
    if (!toolTiming[t.tool]) {
      toolTiming[t.tool] = { tool: t.tool, count: 0, total: 0, max: 0 };
    }
    const agg = toolTiming[t.tool];
    agg.count++;
    agg.total += t.seconds;
    if (t.seconds > agg.max) agg.max = t.seconds;
  }
  for (const agg of Object.values(toolTiming)) {
    agg.average = agg.total / agg.count;
    result.summary.timingByTool.push(agg);
  }
  result.summary.timingByTool.sort((a, b) => b.total - a.total);
  result.summary.topSlowest.sort((a, b) => b.seconds - a.seconds);
  if (result.summary.topSlowest.length > 20) {
    result.summary.topSlowest = result.summary.topSlowest.slice(0, 20);
  }

  // Compute subagent count
  for (const a of result.summary.agentsSpawned) {
    result.summary.subagentCount += a.count;
  }

  // Compute token-derived metrics
  const { tokens } = result.summary;
  const totalContextTokens = tokens.input + tokens.cacheRead;
  if (totalContextTokens > 0) {
    tokens.cacheHitRate = Math.round((tokens.cacheRead / totalContextTokens) * 10000) / 100;
  }

  // Compute wall clock seconds
  if (firstTS && lastTS) {
    const totalMs = computeDurationMs(firstTS, lastTS);
    if (totalMs >= 0) {
      result.summary.wallSeconds = Math.round(totalMs / 1000);
    }
  }

  // Compute toolToThinkingRatio
  if (result.summary.totalThinkingMs > 0) {
    result.summary.toolToThinkingRatio = Math.round((result.summary.totalToolMs / result.summary.totalThinkingMs) * 100) / 100;
  }

  // Compute start/end time and duration
  function formatLocalDateTime(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  if (firstTS) {
    result.summary.startTime = formatLocalDateTime(firstTS);
  }
  if (lastTS) {
    result.summary.endTime = formatLocalDateTime(lastTS);
  }
  if (firstTS && lastTS) {
    const totalMs = computeDurationMs(firstTS, lastTS);
    if (totalMs >= 0) {
      result.summary.duration = formatDuration(totalMs);
    }
  }

  // Output
  const out = JSON.stringify(result, null, 2);

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "evidence.json");
    fs.writeFileSync(outPath, out, "utf-8");
    copyFile(jsonlPath, path.join(outDir, path.basename(jsonlPath)));
    console.log(outPath);
    printTimingSummary(result.summary);
  } else {
    console.log(out);
  }

  return result;
}

function firstThinking(blocks) {
  for (const block of blocks) {
    if (block.type === "thinking" && block.thinking) return block.thinking;
  }
  for (const block of blocks) {
    if (block.type === "tool_use") return block.name + "(...)";
  }
  return "";
}

function printTimingSummary(s) {
  const lines = [];
  lines.push("");
  lines.push("Timing Summary:");
  lines.push(`  Session: ${s.startTime} -> ${s.endTime} (${s.duration})`);
  lines.push(`  Tool time: ${formatDurationMs(s.totalToolMs)}  Thinking time: ${formatDurationMs(s.totalThinkingMs)}`);

  if (s.timingByTool.length > 0) {
    lines.push("  By tool:");
    for (const t of s.timingByTool) {
      lines.push(`    ${t.tool.padEnd(12)} ${t.count}x  total=${formatSec(t.total)}  avg=${formatSec(t.average)}  max=${formatSec(t.max)}`);
    }
  }

  if (s.topSlowest.length > 0) {
    lines.push("  Top slowest actions:");
    const limit = Math.min(5, s.topSlowest.length);
    for (const t of s.topSlowest.slice(0, limit)) {
      lines.push(`    ${formatSec(t.seconds).padStart(6)}  ${t.tool.padEnd(12)}  ${truncate(t.detail, 60)}`);
    }
  }

  if (s.thinkingTurns.length > 0) {
    lines.push("  Thinking turns:");
    const limit = Math.min(5, s.thinkingTurns.length);
    for (const t of s.thinkingTurns.slice(0, limit)) {
      lines.push(`    ${formatSec(t.seconds).padStart(6)}  ${truncate(t.detail, 60)}`);
    }
  }

  console.error(lines.join("\n"));
}

// ── CLI ──────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const args = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) args.out = argv[++i];
    else if (argv[i] === "--slug" && argv[i + 1]) args.slug = argv[++i];
    else if (!argv[i].startsWith("--")) positional.push(argv[i]);
  }

  if (positional.length === 0) {
    console.error("用法: node extract.js <session-jsonl-path> [--out <dir>] [--slug <name>]");
    process.exit(1);
  }

  runExtract(positional[0], args.out || "", args.slug || "");
}

module.exports = { runExtract };

if (require.main === module) {
  main();
}
