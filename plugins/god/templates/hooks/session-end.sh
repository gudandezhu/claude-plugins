#!/bin/bash
# god session-end hook — 提示当前 spec phase
#
# 安装：node spec/scripts/install-hooks.js <项目目录>
# 触发：session 结束（Claude Code session-end 事件）
# 行为：stdout 打印当前 spec phase + 5 gate 状态；不阻塞

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_DIR="$PROJECT_DIR/spec"
if [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -d "$CLAUDE_PLUGIN_ROOT/spec/scripts" ]; then
  PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
else
  PLUGIN_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
fi

# 兼容 v0.5.0+ G13: meta.json 在 spec/state/ 下; 老项目在 spec/
if [ ! -f "$SPEC_DIR/state/meta.json" ] && [ ! -f "$SPEC_DIR/meta.json" ]; then
  echo "[god session-end] 无 meta.json（idea 阶段）"
  exit 0
fi

echo "[god session-end] 当前 spec 状态："
node "$PLUGIN_ROOT/spec/scripts/spec-cli.js" status "$PROJECT_DIR"
exit 0
