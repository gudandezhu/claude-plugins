#!/bin/bash
# pre-commit.test.sh — pre-commit hook 单元测试
#
# 跑法: bash templates/hooks/pre-commit.test.sh
# 退出: 0 全过 / 1 有失败
#
# 注意: 不要 set -e,否则 hook 故意 exit 1 会导致测试提前退出

HOOK="$(cd "$(dirname "$0")" && pwd)/pre-commit.sh"
PLUGIN_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_ROOT="$(mktemp -d -t god-hook-XXXXXX)"
trap "rm -rf '$TMP_ROOT'" EXIT

passed=0; failed=0
# run_assert NAME EXPECTED_EXIT
# HOOK_EXIT == EXPECTED_EXIT → 通过
run_assert() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $name"
    passed=$((passed + 1))
  else
    echo "  ✗ $name (期望 exit=$expected,实际 exit=$actual)"
    failed=$((failed + 1))
  fi
}

# 准备 spec fixture（包含让 spec-cli check / spec-validate 通过的最小集）
setup_spec() {
  local dir="$1"
  local phase="$2"
  local with_s_anchor="$3"  # yes/no
  mkdir -p "$dir/spec/state" "$dir/src" "$dir/tests"
  echo "{\"specId\": \"test\", \"phase\": \"$phase\", \"version\": \"1.0.0\"}" > "$dir/spec/state/meta.json"
  cat > "$dir/spec/spec.feature" <<'EOF'
@spec-version 1.0.0
Feature: test
  @SC-001
  Scenario: a
    Given x
    When y
    Then z
EOF
  # 写代码含 @spec SC-001 标注(spec-validate #7)
  cat > "$dir/src/test.js" <<'EOF'
// @spec SC-001
function x() { return 1; }
module.exports = { x };
EOF
  # 写测试含 SC-xxx: 命名(spec-validate #8)
  cat > "$dir/tests/test.spec.js" <<'EOF'
test('SC-001: a', () => { expect(1).toBe(1); });
EOF
  # sources.md 必含 REQ ↔ SC 绑定(spec-validate #10, 6 列) + C5 锚点
  if [ "$with_s_anchor" = "yes" ]; then
    case "$phase" in
      implemented) ANCHOR="S1 Prd 出口签字" ;;
      verified)    ANCHOR="S2 Dev 出口签字" ;;
      accepted)    ANCHOR="S3 Test 出口签字" ;;
    esac
    cat > "$dir/spec/sources.md" <<EOF
# sources

## Check 结论
- **C5 Spec 评审** (2026-06-17 10:00 / 简单档 / 90 分 / 通过)

## 需求清单
| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|---|---|---|---|---|---|
| REQ-001 | test | happy | Must | M2 | → SC-001 |

- **$ANCHOR** (2026-06-17 10:00 / accept / test)
EOF
  else
    cat > "$dir/spec/sources.md" <<'EOF'
# sources

## Check 结论
- **C5 Spec 评审** (2026-06-17 10:00 / 简单档 / 90 分 / 通过)

## 需求清单
| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|---|---|---|---|---|---|
| REQ-001 | test | happy | Must | M2 | → SC-001 |
EOF
  fi
}

# ---------- 1. idea 阶段无 meta → exit 0 ----------
T1="$TMP_ROOT/t1"
mkdir -p "$T1/spec"
bash "$HOOK" >/dev/null 2>&1
HOOK_EXIT=$?
run_assert "idea 阶段无 meta.json → exit 0" "0" "$HOOK_EXIT"

# ---------- 2. phase=implemented 无 S1 锚点 → exit 1 ----------
T2="$TMP_ROOT/t2"
setup_spec "$T2" "implemented" "no"
CLAUDE_PROJECT_DIR="$T2" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" >/dev/null 2>&1
HOOK_EXIT=$?
run_assert "phase=implemented 无 S1 锚点 → exit 1" "1" "$HOOK_EXIT"

# ---------- 3. phase=implemented 有 S1 锚点 → exit 0 ----------
T3="$TMP_ROOT/t3"
setup_spec "$T3" "implemented" "yes"
CLAUDE_PROJECT_DIR="$T3" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" >/dev/null 2>&1
HOOK_EXIT=$?
run_assert "phase=implemented 有 S1 锚点 → exit 0" "0" "$HOOK_EXIT"

# ---------- 4. phase=verified 无 S2 锚点 → exit 1 ----------
T4="$TMP_ROOT/t4"
setup_spec "$T4" "verified" "no"
CLAUDE_PROJECT_DIR="$T4" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" >/dev/null 2>&1
HOOK_EXIT=$?
run_assert "phase=verified 无 S2 锚点 → exit 1" "1" "$HOOK_EXIT"

# ---------- 5. phase=verified 有 S2 锚点 → exit 0 ----------
T5="$TMP_ROOT/t5"
setup_spec "$T5" "verified" "yes"
CLAUDE_PROJECT_DIR="$T5" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" >/dev/null 2>&1
HOOK_EXIT=$?
run_assert "phase=verified 有 S2 锚点 → exit 0" "0" "$HOOK_EXIT"

# ---------- 6. 错误信息含 S 锚点提示 ----------
T6="$TMP_ROOT/t6"
setup_spec "$T6" "implemented" "no"
if CLAUDE_PROJECT_DIR="$T6" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" 2>&1 | grep -q "S1 Prd 出口签字"; then
  run_assert "错误信息: 含 S 锚点名 (S1 Prd 出口签字)" "0" "0"
else
  run_assert "错误信息: 含 S 锚点名 (S1 Prd 出口签字)" "0" "1"
fi

# ---------- 7. spec-validate 失败 (空 spec.feature) → exit 1 ----------
T7="$TMP_ROOT/t7"
mkdir -p "$T7/spec/state"
echo '{"specId": "test", "phase": "drafted", "version": "1.0.0"}' > "$T7/spec/state/meta.json"
echo "" > "$T7/spec/spec.feature"  # 空 → spec-validate 应 fail
echo "# sources" > "$T7/spec/sources.md"
CLAUDE_PROJECT_DIR="$T7" CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$HOOK" >/dev/null 2>&1
HOOK_EXIT=$?
run_assert "spec-validate 失败 (空 spec.feature) → exit 1" "1" "$HOOK_EXIT"

echo ""
echo "$passed passed, $failed failed"
exit $failed
