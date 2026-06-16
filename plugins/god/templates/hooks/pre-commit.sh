#!/bin/bash
# god pre-commit hook — G3 防漂移
#
# 安装：node spec/scripts/install-hooks.js <项目目录>
# 触发：git commit 前
# 拒绝条件：
#   1. spec-cli check 失败（phase 非法 / SC 缺代码或测试）
#   2. spec-validate.js 失败（spec 格式错 / 漂移）
# 救命场景：git commit --no-verify（post-commit hook 会写 trace 留痕）

set -e
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_DIR="$PROJECT_DIR/spec"
# PLUGIN_ROOT 解析：从 .git/hooks/pre-commit 反推到 god 仓根
# 1) 优先用 $CLAUDE_PLUGIN_ROOT（标准约定）
# 2) 回退：从 hook 自身路径反推（适合本地开发测试）
if [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -d "$CLAUDE_PLUGIN_ROOT/spec/scripts" ]; then
  PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
else
  # hook 路径: $PROJECT_DIR/.git/hooks/pre-commit → 反推 4 层到 god 仓根
  PLUGIN_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
fi

echo "[god pre-commit] 检查 spec 状态机 + 防漂移..."

# 1. idea 阶段无 meta.json = 合法跳过
# 兼容 v0.5.0+ G13: meta.json 在 spec/state/ 下; 老项目在 spec/
META_JSON=""
if [ -f "$SPEC_DIR/state/meta.json" ]; then
  META_JSON="$SPEC_DIR/state/meta.json"
elif [ -f "$SPEC_DIR/meta.json" ]; then
  META_JSON="$SPEC_DIR/meta.json"
fi
if [ -z "$META_JSON" ]; then
  echo "[god pre-commit] 无 meta.json（idea 阶段合法），跳过检查"
  exit 0
fi

# 2. 跑 spec-cli check
if ! node "$PLUGIN_ROOT/spec/scripts/spec-cli.js" check "$PROJECT_DIR"; then
  echo ""
  echo "[god pre-commit] ✗ spec-cli check 失败"
  echo "[god pre-commit] 提示：git commit --no-verify 救命（会写 trace 留痕）"
  exit 1
fi

# 3. 跑 spec-validate.js
if ! node "$PLUGIN_ROOT/spec/scripts/spec-validate.js" "$PROJECT_DIR"; then
  echo ""
  echo "[god pre-commit] ✗ spec-validate.js 失败"
  echo "[god pre-commit] 提示：git commit --no-verify 救命（会写 trace 留痕）"
  exit 1
fi

echo "[god pre-commit] ✓ 检查通过"
exit 0
