#!/usr/bin/env bash
# ============================================================
# git-feature-branch.sh — 自动创建并切换 feature 分支
# 用法：bash git-feature-branch.sh -d <项目目录> -r <需求编号>
#
# 功能：
#   1. 构造分支名：feature-{需求编号}
#   2. 如有未提交更改，先 git stash（绝不丢弃）
#   3. 创建或切换到目标分支
# ============================================================

set -euo pipefail

PROJECT_DIR=""
REQ_NUM=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--dir)
            PROJECT_DIR="$2"
            shift 2
            ;;
        -r|--req)
            REQ_NUM="$2"
            shift 2
            ;;
        -h|--help)
            echo "用法: bash git-feature-branch.sh -d <项目目录> -r <需求编号>"
            echo ""
            echo "选项:"
            echo "  -d, --dir <路径>     项目代码目录（必填）"
            echo "  -r, --req <编号>     需求编号（必填）"
            echo "  -h, --help           显示帮助"
            echo ""
            echo "分支命名: feature-{需求编号}"
            echo "工作区有未提交更改时自动 git stash 暂存"
            exit 0
            ;;
        *)
            echo "[ERROR] 未知参数: $1"
            exit 1
            ;;
    esac
done

if [[ -z "$PROJECT_DIR" || -z "$REQ_NUM" ]]; then
    echo "[ERROR] 缺少必要参数。用法: bash git-feature-branch.sh -d <项目目录> -r <需求编号>"
    exit 1
fi

# 支持相对路径
if [[ ! "$PROJECT_DIR" =~ ^/ ]] && [[ ! "$PROJECT_DIR" =~ ^[A-Za-z]: ]]; then
    PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd)" || true
fi

if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "[ERROR] 项目目录不存在: $PROJECT_DIR"
    exit 1
fi

# 校验：只允许 projects/ 下的项目仓库
PROJECTS_ROOT="${JLC_AI_WORKSPACE:-/d/ai-workspace}/projects"
# 统一为绝对路径用于比较
ABS_DIR="$(cd "$PROJECT_DIR" && pwd)"
ABS_ROOT="$(cd "$PROJECTS_ROOT" && pwd)"
if [[ "$ABS_DIR" != "$ABS_ROOT"* ]]; then
    echo "[ERROR] 仅限 projects/ 下的项目仓库。当前路径: $ABS_DIR，期望在: $ABS_ROOT/ 下"
    exit 1
fi

cd "$PROJECT_DIR"

# 检查是否是 git 仓库
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    echo "[ERROR] 不是 git 仓库: $PROJECT_DIR"
    exit 1
fi

BRANCH_NAME="feature-${REQ_NUM}"

# 检查当前是否已在目标分支
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [[ "$CURRENT_BRANCH" == "$BRANCH_NAME" ]]; then
    echo "[OK] 已在目标分支: $BRANCH_NAME ($PROJECT_DIR)"
    exit 0
fi

# 检查工作区是否干净（包含 untracked 文件）
if [[ -n "$(git status --porcelain)" ]]; then
    STASH_MSG="auto-stash: ${BRANCH_NAME} @ $(date +%Y%m%d-%H%M%S)"
    echo "[INFO] 工作区有未提交的更改，执行 git stash..."
    git stash push -u -m "$STASH_MSG"
    echo "[OK] 已暂存: $STASH_MSG"
fi

# 检查目标分支是否已存在
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    echo "[INFO] 分支已存在，切换到: $BRANCH_NAME"
    git checkout "$BRANCH_NAME"
else
    echo "[INFO] 创建新分支: $BRANCH_NAME (基于 $CURRENT_BRANCH)"
    git checkout -b "$BRANCH_NAME"
fi

echo "[OK] 当前分支: $(git branch --show-current) ($PROJECT_DIR)"
