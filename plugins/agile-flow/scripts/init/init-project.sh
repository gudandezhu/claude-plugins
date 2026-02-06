#!/bin/bash
# Agile Flow 项目初始化脚本
# 简化版本：基于 ai-docs 目录的文档系统
#
# 本脚本使用 /shell-scripting 技能实现
# 如需修改或增强，请使用 /shell-scripting 技能
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取插件根目录（脚本所在目录向上两级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "=== 初始化 Agile Flow 项目 ==="

# 创建新的目录结构
mkdir -p ai-docs/docs      # 文档目录
mkdir -p ai-docs/data      # 数据文件目录
mkdir -p ai-docs/logs      # 日志目录
mkdir -p ai-docs/run       # 运行时文件目录

# PRD.md 放在 ai-docs 根目录（planner agent 期望的路径）
PRD_PATH="ai-docs/PRD.md"

# 添加 ai-docs 到 .gitignore
if [ -f ".gitignore" ]; then
    echo ".gitignore已存在"
else
    touch .gitignore
fi

if ! grep -q "^ai-docs/" .gitignore; then
    echo "" >> .gitignore
    echo "# Agile Flow - AI 生成的文档" >> .gitignore
    echo "ai-docs/" >> .gitignore
fi


# 文档模板创建函数
create_doc_template() {
    local doc_name=$1
    local doc_file

    # PRD.md 放在 ai-docs 根目录，其他文档放在 docs/ 子目录
    if [ "$doc_name" = "PRD.md" ]; then
        doc_file="ai-docs/$doc_name"
    else
        doc_file="ai-docs/docs/$doc_name"
    fi

    if [ -f "$doc_file" ]; then
        echo "  ✓ $doc_name 已存在，跳过"
        return 0
    fi

    case "$1" in
        "BUGS.md")
            cp "${PLUGIN_ROOT}/scripts/init/templates/BUGS.md" "$doc_file"
            ;;
        "OPS.md")
            cp "${PLUGIN_ROOT}/scripts/init/templates/OPS.md" "$doc_file"
            ;;
        "PRD.md")
            cp "${PLUGIN_ROOT}/scripts/init/templates/PRD.md" "$doc_file"
            ;;
    esac

    echo "  + $doc_name 已创建"
}

# 检查现有文档
echo ""
echo "检测现有文档..."
existing_docs=""
for doc in "PROJECT_STATUS.md" "COMPLETION_REPORT.md" "CLAUDE.md" "AI_CONTEXT.md" "README.md"; do
    if [ -f "$doc" ]; then
        existing_docs="${existing_docs}${doc} "
        echo -e "  ${YELLOW}发现已有文档: $doc${NC}"
    fi
done

# 创建文档模板
echo ""
echo "创建文档模板..."

# 数据文件（放到 data/ 目录）
if [ ! -f "ai-docs/data/TASKS.json" ]; then
    cat > ai-docs/data/TASKS.json << 'EOF'
{
  "iteration": 1,
  "tasks": []
}
EOF
    echo "  + TASKS.json 已创建"
else
    echo "  ✓ TASKS.json 已存在，跳过"
fi

# 必需文档
required_docs=("BUGS.md" "OPS.md" "PRD.md")

for doc in "${required_docs[@]}"; do
    create_doc_template "$doc"
done

echo ""
echo -e "${GREEN}✅ 项目初始化完成${NC}"
echo ""
echo "💡 提示："
echo "  - 需求文档: ai-docs/PRD.md"
echo "  - 文档目录: ai-docs/docs/"
echo "  - 数据文件: ai-docs/data/TASKS.json (不要手动编辑，使用工具脚本)"
echo "  - 日志目录: ai-docs/logs/"
echo "  - 运行时目录: ai-docs/run/"
echo "  - 查看进度: 访问 http://localhost:3737"
echo "  - 更多信息: 查看 ai-docs/docs/OPS.md"
