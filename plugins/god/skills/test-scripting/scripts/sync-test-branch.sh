#!/bin/bash
# sync-test-branch.sh — T1.7
# 切换集中测试仓库到需求对应的 feature 分支
# 用法: bash sync-test-branch.sh <testing-repo-path> <requirement-id>
# 逻辑:
#   1. 远程存在 feature/{REQ_ID} → checkout + pull
#   2. 本地存在 feature/{REQ_ID} → checkout
#   3. 都不存在 → 从 main 创建并 push

set -e

TESTING_REPO="$1"
REQ_ID="$2"

if [ -z "$TESTING_REPO" ] || [ -z "$REQ_ID" ]; then
  echo "[FAIL] Usage: sync-test-branch.sh <testing-repo-path> <requirement-id>"
  exit 1
fi

if [ ! -d "$TESTING_REPO/.git" ]; then
  echo "[FAIL] Not a git repository: $TESTING_REPO"
  exit 1
fi

TARGET="feature/$REQ_ID"

cd "$TESTING_REPO"
git fetch origin 2>/dev/null || echo "[WARN] git fetch failed, working with local state"

if git show-ref --verify --quiet "refs/remotes/origin/$TARGET" 2>/dev/null; then
  echo "[OK] Remote branch $TARGET exists, checking out"
  git checkout "$TARGET" 2>/dev/null || git checkout -b "$TARGET" "origin/$TARGET"
  git pull origin "$TARGET" 2>/dev/null || echo "[WARN] pull failed, using local state"
elif git show-ref --verify --quiet "refs/heads/$TARGET" 2>/dev/null; then
  echo "[OK] Local branch $TARGET exists, checking out"
  git checkout "$TARGET"
else
  echo "[OK] Branch $TARGET does not exist, creating from main"
  git checkout main 2>/dev/null || git checkout master
  git pull 2>/dev/null || echo "[WARN] pull failed"
  git checkout -b "$TARGET"
  git push -u origin "$TARGET" 2>/dev/null || echo "[WARN] push failed, branch created locally only"
fi

echo "[OK] Now on branch: $(git branch --show-current)"
