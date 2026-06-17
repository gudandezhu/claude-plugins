#!/bin/bash
# god session-end hook — 写断点 + 推断下一会话命令
#
# 安装：node spec/scripts/install-hooks.js <项目目录>
# 触发：session 结束（Claude Code session-end 事件）
# 行为：
#   1. 读 spec/state/meta.json 拿 phase
#   2. 写 spec/<phase>-checkpoint.md 断点摘要
#   3. 按 phase 推断下一会话第一条命令
#   4. stdout 输出（不阻塞）
#
# 推断规则：
#   drafted     → /god:prd              (继续 prd 阶段 2-3)
#   reviewed    → /god:prd              (prd 自动接 dev)
#   implemented → /god:dev              (继续 dev 阶段 1)
#   verified    → /god:test             (跑剩余 SC 测)
#   accepted    → /god:prd --mode edit  (改需求)

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_DIR="$PROJECT_DIR/spec"
if [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -d "$CLAUDE_PLUGIN_ROOT/spec/scripts" ]; then
  PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
else
  PLUGIN_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
fi

# 兼容 v0.5.0+ G13: meta.json 在 spec/state/ 下; 老项目在 spec/
META_FILE=""
if [ -f "$SPEC_DIR/state/meta.json" ]; then
  META_FILE="$SPEC_DIR/state/meta.json"
elif [ -f "$SPEC_DIR/meta.json" ]; then
  META_FILE="$SPEC_DIR/meta.json"
fi

if [ -z "$META_FILE" ]; then
  echo "[god session-end] 无 meta.json（idea 阶段）"
  echo "[god session-end] 下一会话: /god:prd  <想法>"
  exit 0
fi

echo "[god session-end] 当前 spec 状态："
PHASE=$(node -e "try{console.log(require('$META_FILE').phase||'unknown')}catch(e){console.log('unknown')}" 2>/dev/null)
node "$PLUGIN_ROOT/spec/scripts/spec-cli.js" status "$PROJECT_DIR" 2>/dev/null

# 写断点
CHECKPOINT="$SPEC_DIR/${PHASE}-checkpoint.md"
if [ -d "$SPEC_DIR" ]; then
  cat > "$CHECKPOINT" <<EOF
# $PHASE 阶段断点

> 日期: $(date -u +%Y-%m-%dT%H:%M:%SZ)
> 阶段: $PHASE

## 本会话做了什么

（AI 填写：列出本会话跑过的阶段 + 已完成 SC 列表）

## 下一会话接续点

（AI 填写：列出未完成 SC + 待跑步骤）

## 风险 / 已知问题

（AI 填写：遗留的 f-01~f-06 崩点 / 软失败 / 拒签归因）
EOF
  echo "[god session-end] 断点写入: $CHECKPOINT"
fi

# 推断下一会话命令
case "$PHASE" in
  drafted)     NEXT="/god:prd              (继续 prd 阶段 2-3)";;
  reviewed)    NEXT="/god:prd              (prd 一条龙会自动接 dev-pipeline)";;
  implemented) NEXT="/god:dev              (继续 dev 阶段 1，跑剩余 SC)";;
  verified)    NEXT="/god:test             (跑剩余 SC 测)";;
  accepted)    NEXT="/god:prd --mode edit  (改需求)";;
  *)           NEXT="（未知 phase，手动 /god:prd 或 /god:dev）";;
esac

echo "[god session-end] 下一会话第一条命令: $NEXT"
echo "[god session-end] 注：断点已写，AI 不会主动弹命令。下一会话启动后跑 sign-gate 会自动从断点接续。"
exit 0
