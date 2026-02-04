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

# 确保 ai-docs 目录存在
mkdir -p ai-docs

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
    local doc_file="ai-docs/$doc_name"

    if [ -f "$doc_file" ]; then
        echo "  ✓ $doc_name 已存在，跳过"
        return 0
    fi

    case "$1" in
        "PRD.md")
            cat > "$doc_file" << 'EOF'
# 项目需求文档 (PRD)

## 项目概述

**项目名称**: 待定义
**版本**: v1.0.0
**最后更新**: 待更新

## 1. 项目背景
描述项目发起的背景和原因。

## 2. 目标用户
### 主要用户群体
- 用户类型 1：描述
- 用户类型 2：描述

### 用户痛点
- 痛点 1
- 痛点 2

## 3. 核心功能
### 功能 1：功能名称
**优先级**: P0
**描述**: 功能描述

**用户故事**:
作为 [用户类型]，我想要 [功能]，以便 [价值]

**验收标准**:
- [ ] 标准 1
- [ ] 标准 2

## 4. 非功能需求
### 性能要求
- 响应时间 < 200ms
- 并发用户 > 1000

### 安全要求
- 用户认证
- 数据加密

## 5. 技术约束
- 技术栈 1
- 技术栈 2

## 6. 里程碑
### 迭代 1（Week 1-2）
- 核心功能开发

## 7. 风险与依赖
### 风险
- 风险 1：描述和缓解措施

### 依赖
- 外部依赖 1
EOF
            ;;
        "TASKS.json")
            cat > "$doc_file" << 'EOF'
{
  "iteration": 1,
  "tasks": []
}
EOF
            ;;
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

### 2. 暂停自动继续
/agile-stop

### 3. 查看进度
/agile-dashboard

## 开发工作流

### 任务流程
需求 -> 任务 -> 测试 -> BUG修复 -> 测试 -> 验收

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

### Q: 如何添加新任务？
A: 通过 Web Dashboard (http://localhost:3737) 提交需求，系统会自动转换为任务

### Q: 如何查看任务？
A:
- Web Dashboard: http://localhost:3737
- 命令行: node \${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list

### Q: 如何更新任务状态？
A: node \${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <task_id> <status>
EOF
            ;;
        "CONTEXT.md")
            cat > "$doc_file" << 'EOF'
# 项目上下文和记忆 (CONTEXT)

## 项目概述

**项目名称**: 待定义
**创建时间**: $(date '+%Y-%m-%d')

## 技术栈

- 前端: 待定义
- 后端: 待定义
- 数据库: 待定义
- 测试框架: 待定义

## 关键概念

### 概念 1
描述和说明

## 架构决策

### 决策 1: 技术选型
**背景**: 问题描述
**决策**: 采用 X 技术
**原因**: 原因说明
**后果**: 影响说明

## 代码约定

### 命名规范
- 文件命名: camelCase 或 kebab-case
- 变量命名: camelCase
- 常量命名: UPPER_CASE

## 重要文件

- `src/`: 源代码目录
- `tests/`: 测试代码目录
- `ai-docs/`: AI 文档目录
EOF
            ;;
        "API.md")
            cat > "$doc_file" << 'EOF'
# API 清单 (API)

## REST API

### 用户相关

#### POST /api/users
**描述**: 创建新用户

**请求**:
```json
{
  "name": "string",
  "email": "string"
}
```

**响应**: 201 Created
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "createdAt": "string"
}
```

## 数据模型

### User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 更新日志

### 待添加
- 新添加的 API
- API 变更记录
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

# 必需文档
required_docs=("TASKS.json" "BUGS.md")
# 可选文档
optional_docs=("PRD.md" "OPS.md" "CONTEXT.md" "API.md" "PLAN.md")

for doc in "${required_docs[@]}"; do
    create_doc_template "$doc"
done

for doc in "${optional_docs[@]}"; do
    create_doc_template "$doc"
done

echo ""
echo -e "${GREEN}✅ 项目初始化完成${NC}"
echo ""
echo "💡 提示："
echo "  - 所有文档位于 ai-docs/ 目录"
echo "  - 任务数据: ai-docs/TASKS.json (不要手动编辑，使用工具脚本)"
echo "  - 添加任务: node \${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add <P0|P1|P2|P3> \"描述\""
echo "  - 查看进度: /agile-dashboard 或访问 http://localhost:3737"
echo "  - 更多信息: 查看 ai-docs/OPS.md"
