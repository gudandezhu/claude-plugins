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

echo "=== 初始化 Agile Flow 项目 ==="

# 创建新的目录结构
mkdir -p ai-docs/docs      # 文档目录
mkdir -p ai-docs/data      # 数据文件目录
mkdir -p ai-docs/logs      # 日志目录
mkdir -p ai-docs/run       # 运行时文件目录

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
    local doc_file="ai-docs/docs/$doc_name"

    if [ -f "$doc_file" ]; then
        echo "  ✓ $doc_name 已存在，跳过"
        return 0
    fi

    case "$1" in
        "BUGS.md")
            cat > "$doc_file" << 'EOF'
# Bug 列表 (BUGS)

## 严重程度说明

- **Critical**: 系统崩溃、数据丢失、安全漏洞
- **High**: 主要功能不可用
- **Medium**: 次要功能受影响
- **Low**: UI 问题、文案错误

## 已修复 Bug

暂无

## 待修复 Bug

- 无

## Bug 报告流程

1. AI 在测试或开发中发现 Bug
2. 自动记录到此文档
3. 尝试自动修复
4. 如无法自动修复，报告给用户
EOF
            ;;
        "OPS.md")
            cat > "$doc_file" << 'EOF'
# 操作指南 (OPS)

## 快速启动

### 1. 启动敏捷开发流程
/agile-start

### 2. 停止流程
/agile-stop

### 3. 查看进度
访问 http://localhost:3737

## 开发工作流

### 任务流程
需求 → 任务规划 → TDD开发 → E2E验证 → 完成

### TDD 开发流程

1. 编写测试用例
2. 运行测试（预期失败）
3. 编写最少代码使测试通过
4. 运行覆盖率测试（目标 ≥ 80%）
5. 重构代码

### 代码提交
git add .
git commit -m "feat: 描述变更"

## 测试

### 单元测试
npm run test:unit
# 或
pytest

### 覆盖率测试
npm run test:unit -- --coverage
# 或
pytest --cov

## 常见问题

### Q: 如何添加新需求？
A: 编辑 ai-docs/REQUIREMENTS.md，然后运行 /agile-start

### Q: 如何查看任务？
A: 访问 Web Dashboard: http://localhost:3737

### Q: 如何更新任务状态？
A: node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <task_id> <status>
EOF
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
required_docs=("BUGS.md" "OPS.md")

for doc in "${required_docs[@]}"; do
    create_doc_template "$doc"
done

# 复制 REQUIREMENTS.md 模板
if [ ! -f "ai-docs/REQUIREMENTS.md" ]; then
    cp "${CLAUDE_PLUGIN_ROOT}/scripts/init/templates/REQUIREMENTS.md" ai-docs/REQUIREMENTS.md
    echo "  + REQUIREMENTS.md 已创建"
else
    echo "  ✓ REQUIREMENTS.md 已存在，跳过"
fi

echo ""
echo -e "${GREEN}✅ 项目初始化完成${NC}"
echo ""
echo "💡 提示："
echo "  - 文档目录: ai-docs/docs/"
echo "  - 需求文档: ai-docs/REQUIREMENTS.md"
echo "  - 数据文件: ai-docs/data/TASKS.json (不要手动编辑，使用工具脚本)"
echo "  - 日志目录: ai-docs/logs/"
echo "  - 运行时目录: ai-docs/run/"
echo "  - 添加需求: 编辑 ai-docs/REQUIREMENTS.md"
echo "  - 查看进度: 访问 http://localhost:3737"
echo "  - 更多信息: 查看 ai-docs/docs/OPS.md"
