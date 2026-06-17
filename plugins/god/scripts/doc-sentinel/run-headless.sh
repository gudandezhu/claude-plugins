#!/usr/bin/env bash
# run-headless.sh — 脱机跑 doc-sentinel 巡检（claude -p 后台）
#
# 用法: run-headless.sh <项目根>
#
# 不占主 cc 窗口，输出落 docs/doc-sentinel/runs/<ISO>.json
# 去重：距上次跑 < 4h 跳过
#
# 设计依据: docs/adrs/0012-doc-sentinel.md v0.7.0 扩展

set -euo pipefail

PROJECT_ROOT="${1:-$(pwd)}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
MIN_INTERVAL_SEC=14400  # 4h

# 项目根检查
if [[ ! -d "$PROJECT_ROOT" ]]; then
  echo "✗ 项目根不存在: $PROJECT_ROOT" >&2
  exit 1
fi
if [[ ! -d "$PROJECT_ROOT/.git" ]] && [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
  echo "✗ cwd 不是项目根: $PROJECT_ROOT（需含 .git 或 package.json）" >&2
  exit 1
fi

# 启用检查
CONFIG_FILE="$PROJECT_ROOT/.god/doc-sentinel.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "⊘ doc-sentinel 未启用（$CONFIG_FILE 不存在）" >&2
  exit 0
fi
if grep -q '"enabled":\s*false' "$CONFIG_FILE"; then
  echo "⊘ doc-sentinel 已禁用" >&2
  exit 0
fi

# 去重：距上次跑 < 4h 跳过
RUNS_DIR="$PROJECT_ROOT/docs/doc-sentinel/runs"
LAST_RUN=$(ls -t "$RUNS_DIR"/*.json 2>/dev/null | head -1 || true)
if [[ -n "$LAST_RUN" ]]; then
  LAST_TS=$(basename "$LAST_RUN" .json | sed 's/\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/')
  LAST_EPOCH=$(date -j -f "%Y-%m-%dT%H-%M-%S" "$LAST_TS" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  ELAPSED=$((NOW_EPOCH - LAST_EPOCH))
  if [[ $ELAPSED -lt $MIN_INTERVAL_SEC ]]; then
    REMAINING=$(( (MIN_INTERVAL_SEC - ELAPSED) / 60 ))
    echo "⊘ 距上次跑 < 4h（剩 ${REMAINING} 分钟），跳过" >&2
    exit 0
  fi
fi

# 跑 check-facade.js（纯脚本，无 LLM 介入）
echo "→ 跑 check-facade.js ..."
node "$PLUGIN_ROOT/scripts/doc-sentinel/check-facade.js" "$PROJECT_ROOT"
echo "✓ 巡检完成"

exit 0