#!/bin/bash
# Priority Evaluator - 需求优先级评估脚本
#
# 本脚本使用 /shell-scripting 技能实现
# 如需修改或增强，请使用 /shell-scripting 技能

set -e

# 必须设置 AI_DOCS_PATH 环境变量
if [ -z "$AI_DOCS_PATH" ]; then
    echo "❌ 错误: AI_DOCS_PATH 环境变量未设置" >&2
    exit 1
fi

PRD_FILE="$AI_DOCS_PATH/PRD.md"
PLAN_FILE="$AI_DOCS_PATH/PLAN.md"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 评估优先级
evaluate_priority() {
    local requirement="$1"

    # 关键词评分
    local priority="P2"  # 默认中等优先级

    if echo "$requirement" | grep -qiE "紧急|关键|核心|阻塞|崩溃|安全|漏洞|致命|无法使用"; then
        priority="P0"
    elif echo "$requirement" | grep -qiE "重要|优化|性能|体验|提升|改进"; then
        priority="P1"
    elif echo "$requirement" | grep -qiE "可选|建议|美化|调整|微调"; then
        priority="P3"
    fi

    echo "$priority"
}

# 从 PRD.md 提取需求并转换为任务
process_requirements() {
    if [ ! -f "$PRD_FILE" ]; then
        echo "⚠️  PRD.md 不存在"
        return 0
    fi

    # 读取 PRD.md 中的需求
    # 这里简化处理，实际可以更复杂
    echo -e "${GREEN}📊 正在评估需求优先级...${NC}"

    # 统计需求数量
    local req_count=$(grep -c "^## 需求" "$PRD_FILE" 2>/dev/null || echo "0")

    if [ "$req_count" -eq 0 ]; then
        echo "📋 需求池为空"
        return 0
    fi

    echo "发现 $req_count 个待处理需求"

    # 这里可以添加更复杂的逻辑来处理需求
    # 暂时只显示统计
}

# 主函数
main() {
    # AI_DOCS_PATH 检查已在文件开头完成

    process_requirements
}

main "$@"
