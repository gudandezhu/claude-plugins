#!/bin/bash
# god post-commit --no-verify hook — 救命场景审计留痕
#
# 安装：node spec/scripts/install-hooks.js <项目目录>
# 触发：git commit --no-verify 完成后（即使 pre-commit 被跳过）
# 行为：写一行到 spec/.trace，标 NO-VERIFY + 用户 + commit hash
# 关键：这不是阻拦，是审计。救命场景可执行，但留痕不可少。

set -e
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_DIR="$PROJECT_DIR/spec"

if [ ! -d "$SPEC_DIR" ]; then
  exit 0
fi

USER_NAME="${USER:-unknown}"
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# 救命场景分类: 演练/破环/rehearsal/test/test-only/test-fix 显式豁免崩点计数
# 设: GOD_NOVERIFY_REASON="rehearsal" git commit --no-verify -m "..."
REASON="${GOD_NOVERIFY_REASON:-救命}"
if [ -n "$GOD_NOVERIFY_REASON" ]; then
  echo "$TIMESTAMP NO-VERIFY $REASON commit by $USER_NAME hash=$COMMIT_HASH" >> "$SPEC_DIR/.trace"
  echo "[god post-commit] ✗ --no-verify 留痕: reason=$REASON"
else
  echo "$TIMESTAMP NO-VERIFY commit by $USER_NAME hash=$COMMIT_HASH" >> "$SPEC_DIR/.trace"
  echo "[god post-commit] ✗ --no-verify 救命场景：已写 .trace 留痕"
fi
exit 0
