#!/bin/bash
# Agile Flow - 同步 PLAN.md 时间戳
# 更新 PLAN.md 的最后更新时间
#
# 本脚本使用 /shell-scripting 技能实现
# 如需修改或增强，请使用 /shell-scripting 技能
set -e

GREEN='\033[0;32m'
NC='\033[0m'

# 检查 ai-docs 目录
if [ ! -d "ai-docs" ]; then
    echo "❌ 项目未初始化"
    exit 1
fi

plan_file="ai-docs/PLAN.md"

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
