#!/bin/bash
# Agile Flow - 同步 PLAN.md 时间戳
# 更新 PLAN.md 的最后更新时间
#
# 本脚本使用 /shell-scripting 技能实现
# 如需修改或增强，请使用 /shell-scripting 技能
set -e

GREEN='\033[0;32m'
NC='\033[0m'

# 智能检测 ai-docs 目录
find_ai_docs_path() {
    # 1. 优先使用环境变量
    if [ -n "$AI_DOCS_PATH" ]; then
        echo "$AI_DOCS_PATH"
        return
    fi

    # 2. 尝试从 git 根目录查找
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
        local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        if [ -n "$git_root" ] && [ -d "$git_root/ai-docs" ]; then
            echo "$git_root/ai-docs"
            return
        fi
    fi

    # 3. 向上查找 ai-docs 目录
    local current_dir=$(pwd)
    while [ "$current_dir" != "/" ]; do
        if [ -d "$current_dir/ai-docs" ]; then
            echo "$current_dir/ai-docs"
            return
        fi
        current_dir=$(dirname "$current_dir")
    done

    # 4. 使用 git 根目录（即使 ai-docs 不存在）
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
        local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        if [ -n "$git_root" ]; then
            echo "$git_root/ai-docs"
            return
        fi
    fi

    # 5. 最后使用当前目录
    echo "$(pwd)/ai-docs"
}

AI_DOCS_PATH=$(find_ai_docs_path)
plan_file="$AI_DOCS_PATH/PLAN.md"

# 检查 PLAN.md 是否存在
if [ ! -f "$plan_file" ]; then
    echo "❌ PLAN.md 不存在"
    exit 1
fi

# 更新时间戳
current_time=$(date '+%Y-%m-%d %H:%M:%S')

if grep -q '^\*\*最后更新\*\*:' "$plan_file"; then
    # 替换现有时间戳
    sed -i "s/^\*\*最后更新\*\*:.*/\*\*最后更新\*\*: $current_time/" "$plan_file"
else
    # 在文件末尾添加时间戳
    echo "" >> "$plan_file"
    echo "---" >> "$plan_file"
    echo "**最后更新**: $current_time" >> "$plan_file"
fi

echo -e "${GREEN}✅ PLAN.md 已更新${NC}"
echo "   文件: $plan_file"
echo "   时间: $current_time"
