#!/bin/bash
# lint-file-size.test.sh — lint-file-size.sh 单元测试
#
# 跑法: bash scripts/lint-file-size.test.sh
# 退出: 0 全过 / 1 有失败

set -e

LINT="$(cd "$(dirname "$0")" && pwd)/lint-file-size.sh"
TMP_ROOT="$(mktemp -d -t god-lint-XXXXXX)"
trap "rm -rf '$TMP_ROOT'" EXIT

passed=0; failed=0
run_assert() {
  local name="$1"
  local cond="$2"
  if [ "$cond" = "0" ]; then
    echo "  ✓ $name"
    passed=$((passed + 1))
  else
    echo "  ✗ $name"
    failed=$((failed + 1))
  fi
}

# 准备 god 根 mock 结构
setup_god_root() {
  local dir="$1"
  mkdir -p "$dir/commands" "$dir/skills/new-skill" "$dir/skills/legacy-skill"
}

# ---------- 1. L1 commands 超 30 行 exit 1 ----------
T1="$TMP_ROOT/t1"
setup_god_root "$T1"
for i in $(seq 1 31); do echo "line $i"; done > "$T1/commands/big.md"
bash "$LINT" >/dev/null 2>&1
run_assert "L1: commands/xxx.md 超 30 行 → exit 1" "$?"

# ---------- 2. L1 commands 30 行整 exit 0 ----------
T2="$TMP_ROOT/t2"
setup_god_root "$T2"
for i in $(seq 1 30); do echo "line $i"; done > "$T2/commands/exact.md"
bash "$LINT" >/dev/null 2>&1
run_assert "L1: commands/exact.md 30 行整 → exit 0" "$?"

# ---------- 3. L2 新 skill 100 行整 exit 0 ----------
T3="$TMP_ROOT/t3"
setup_god_root "$T3"
for i in $(seq 1 100); do echo "line $i"; done > "$T3/skills/new-skill/SKILL.md"
bash "$LINT" >/dev/null 2>&1
run_assert "L2: 新 skill 100 行整 → exit 0" "$?"

# ---------- 4. L2 新 skill 101 行 exit 1 ----------
T4="$TMP_ROOT/t4"
setup_god_root "$T4"
for i in $(seq 1 101); do echo "line $i"; done > "$T4/skills/new-skill/SKILL.md"
bash "$LINT" >/dev/null 2>&1
run_assert "L2: 新 skill 101 行 → exit 1" "$?"

# ---------- 5. L2 老 skill 超 100 行仍 exit 0（白名单） ----------
T5="$TMP_ROOT/t5"
setup_god_root "$T5"
for i in $(seq 1 200); do echo "line $i"; done > "$T5/skills/legacy-skill/SKILL.md"
bash "$LINT" >/dev/null 2>&1
run_assert "L2: 老 skill 超 100 行 → exit 0 (白名单)" "$?"

# ---------- 6. 白名单机制存在 ----------
if grep -q "LEGACY_SKILLS" "$LINT"; then
  run_assert "白名单机制: LEGACY_SKILLS 数组存在" "0"
else
  run_assert "白名单机制: LEGACY_SKILLS 数组存在" "1"
fi

# ---------- 7. 白名单含 RFC-0013 落地的 prd / prd-edit ----------
if grep -E "^  prd\b" "$LINT" >/dev/null && grep -E "^  prd-edit\b" "$LINT" >/dev/null; then
  run_assert "白名单: prd / prd-edit 在列表 (RFC-0013 落地)" "0"
else
  run_assert "白名单: prd / prd-edit 在列表 (RFC-0013 落地)" "1"
fi

# ---------- 8. 输出含 [lint-file-size] 前缀 ----------
T8="$TMP_ROOT/t8"
setup_god_root "$T8"
echo "# skill" > "$T8/skills/new-skill/SKILL.md"
if bash "$LINT" 2>&1 | grep -q "lint-file-size"; then
  run_assert "输出: 含 [lint-file-size] 前缀" "0"
else
  run_assert "输出: 含 [lint-file-size] 前缀" "1"
fi

# ---------- 9. 违规时输出修复指引 ----------
# 把 lint 脚本复制到 mock god 根,让 PLUGIN_ROOT 反推正确
T9="$TMP_ROOT/t9"
setup_god_root "$T9"
for i in $(seq 1 31); do echo "line $i"; done > "$T9/commands/big.md"
cp "$LINT" "$T9/lint.sh"
chmod +x "$T9/lint.sh"
if bash "$T9/lint.sh" 2>&1 | grep -q "修复指引"; then
  run_assert "输出: 违规时含修复指引" "0"
else
  run_assert "输出: 违规时含修复指引" "1"
fi

# ---------- 10. 空目录（无 commands/ 无 skills/）不崩 ----------
T10="$TMP_ROOT/t10"
mkdir -p "$T10/commands"
cp "$LINT" "$T10/lint.sh"
chmod +x "$T10/lint.sh"
if bash "$T10/lint.sh" 2>&1 | grep -q "✓ 全部合规"; then
  run_assert "边界: 空 commands 目录不崩 + 合规" "0"
else
  run_assert "边界: 空 commands 目录不崩 + 合规" "1"
fi

# ---------- 11. mock 老 skill 超 100 行 = 临时加白名单(测试) ----------
# 把 legacy-skill 加入白名单(临时改 lint 副本),验证 200 行老 skill 不被卡
T11="$TMP_ROOT/t11"
setup_god_root "$T11"
for i in $(seq 1 200); do echo "line $i"; done > "$T11/skills/legacy-skill/SKILL.md"
cp "$LINT" "$T11/lint.sh"
chmod +x "$T11/lint.sh"
# 在 LEGACY_SKILLS 数组加 legacy-skill
sed -i.bak '/^LEGACY_SKILLS=(/,/^)/ s/^)$/  legacy-skill\n)/' "$T11/lint.sh"
if bash "$T11/lint.sh" >/dev/null 2>&1; then
  run_assert "白名单机制: 加白名单后老 skill 超 100 行不卡" "0"
else
  run_assert "白名单机制: 加白名单后老 skill 超 100 行不卡" "1"
fi

echo ""
echo "$passed passed, $failed failed"
exit $failed
