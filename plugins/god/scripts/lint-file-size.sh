#!/bin/bash
# god lint-file-size.sh — god 自身文件大小门禁（RFC-0013 承诺，v0.7.0+）
#
# 用途：PR review 前跑，超出阈值 exit 1
# 阈值（RFC-0013 §3.1）：
#   L1 commands/*.md ≤ 30 行（路由型，禁 SOP）
#   L2 skills/*/SKILL.md ≤ 100 行（防 skill 膨胀成 SOP）
#
# 跑法：
#   bash scripts/lint-file-size.sh
#
# 设计依据: docs/rfcs/0013-prd-pipeline.md §3.1
# 零外部依赖。

set -e

# 解析 god 仓根。
# 默认：脚本在 god/scripts/ 下,God 根 = 父目录
# 测试场景：脚本被复制到 mock god 根(目录直接含 commands/),God 根 = 自身
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/commands" ]; then
  # 脚本所在目录就是 god 根(测试场景)
  GOD_ROOT="$SCRIPT_DIR"
else
  GOD_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

L1_MAX=30
L2_MAX=100

# v0.7.0+ RFC-0013: 老 skill (v0.7.0 前已存在) 走过渡期,不卡 100 行
# 新 skill 严格 ≤ 100,白名单外的超限必瘦身后入白名单(走 RFC)
# 白名单依据: docs/rfcs/0013-prd-pipeline.md §3.1 (RFC 落地前 god v0.6.0 已有 skill)
LEGACY_SKILLS=(
  api-creator
  arch-design
  auto-login-passport
  backend-test
  brainstorm
  breakdown-tasks
  breakdown-tasks-review
  build-spec
  db-migration
  doc-sentinel
  eval-loop
  extract-ac
  frontend-coding-standard
  frontend-selftest-guide
  frontend-test
  init-workspace
  java-unit-test
  mvc
  mybatis
  pencil
  playwright-bdd
  product-mgr
  prototype-iterate
  spec-review
  systematic-debugging
  tdd
  tech-review
  tech-selection
  test-case-design
  test-execution
  test-gate
  test-probing
  test-scripting
  ui-ux-pro-max
  user-perspective-analyzer
  using-zcode
  prd          # RFC-0013 自己写的 skill 含编排表,允许 124 行
  prd-edit     # 同上
)

is_legacy_skill() {
  local name="$1"
  for legacy in "${LEGACY_SKILLS[@]}"; do
    if [ "$name" = "$legacy" ]; then
      return 0
    fi
  done
  return 1
}

violations=0

# ---------- L1 commands ----------
echo "[lint-file-size] 检查 L1 commands/*.md (≤ ${L1_MAX} 行)..."
for f in "$GOD_ROOT/commands/"*.md; do
  [ -f "$f" ] || continue
  lines=$(wc -l < "$f" | tr -d ' ')
  name=$(basename "$f")
  if [ "$lines" -gt "$L1_MAX" ]; then
    echo "  ✗ commands/$name: ${lines} 行（超 L1_MAX=${L1_MAX}）"
    violations=$((violations + 1))
  else
    echo "  ✓ commands/$name: ${lines} 行"
  fi
done

# ---------- L2 skills ----------
echo ""
echo "[lint-file-size] 检查 L2 skills/*/SKILL.md (≤ ${L2_MAX} 行,白名单内老 skill 跳过)..."
for f in "$GOD_ROOT/skills/"*/SKILL.md; do
  [ -f "$f" ] || continue
  lines=$(wc -l < "$f" | tr -d ' ')
  rel="${f#$GOD_ROOT/skills/}"
  name="${rel%/SKILL.md}"
  if is_legacy_skill "$name"; then
    echo "  ⊘ skills/$name/SKILL.md: ${lines} 行（白名单老 skill,跳过）"
    continue
  fi
  if [ "$lines" -gt "$L2_MAX" ]; then
    echo "  ✗ skills/$name/SKILL.md: ${lines} 行（超 L2_MAX=${L2_MAX}）"
    violations=$((violations + 1))
  else
    echo "  ✓ skills/$name/SKILL.md: ${lines} 行"
  fi
done

# ---------- 总结 ----------
echo ""
if [ "$violations" -gt 0 ]; then
  echo "[lint-file-size] ✗ 违规 ${violations} 项（阈值 L1=${L1_MAX} / L2=${L2_MAX}）"
  echo "[lint-file-size] 修复指引："
  echo "  - L1 commands 写成路由表（不要 SOP）"
  echo "  - L2 新 skill 严格 ≤ 100 行（老 skill 走白名单过渡）"
  echo "  - 例外需走 RFC（修改本脚本或 RFC-0013）"
  exit 1
fi

echo "[lint-file-size] ✓ 全部合规（L1 ≤ ${L1_MAX} / L2 新 skill ≤ ${L2_MAX}）"
exit 0
