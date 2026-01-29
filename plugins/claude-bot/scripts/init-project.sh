#!/bin/bash
# Agile Flow 项目初始化脚本
set -e

echo "=== 初始化 Agile Flow 项目 ==="

# 确保项目目录存在
if [ ! -d "projects/active" ]; then
    echo "创建项目目录结构..."
    mkdir -p projects/active/{iterations,backlog,knowledge-base}
    mkdir -p ai-docs

    # 初始化配置
    cat > projects/active/config.json << EOF
{
  "defaultIterationLength": "1-week",
  "continuation": {
    "enabled": true,
    "autoStart": true,
    "maxIterations": 10,
    "pauseOnBugs": true,
    "pauseOnBlockers": true,
    "pauseOnIterationComplete": false,
    "taskTimeout": 14400
  },
  "contextLimits": {
    "maxTokens": 2000,
    "statusJsonMax": 500,
    "summaryMax": 300,
    "taskMax": 1000
  }
}
EOF

    # 初始化项目清单
    cat > projects/active/project-manifest.md << EOF
# 项目清单

## 项目目标
待定义

## 范围
待定义

## 干系人
待定义

## 技术栈
待定义
EOF

    # 添加 ai-docs 到 .gitignore
    if [ -f ".gitignore" ]; then
        if ! grep -q "^ai-docs/" .gitignore; then
            echo "" >> .gitignore
            echo "# Agile Flow - AI 生成的文档" >> .gitignore
            echo "ai-docs/" >> .gitignore
        fi
    else
        echo "# Agile Flow - AI 生成的文档" > .gitignore
        echo "ai-docs/" >> .gitignore
    fi

    echo "✅ 项目结构已创建"
fi

# 检查并创建文档模板
if [ ! -f "ai-docs/PRD.md" ]; then
    echo "创建文档模板..."

    # PRD.md
    cat > ai-docs/PRD.md << 'EOF'
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

    # PLAN.md
    cat > ai-docs/PLAN.md << 'EOF'
# 工作计划和任务清单

## 当前迭代

**迭代编号**: 1
**时间范围**: 待定义
**目标**: 待定义

## 任务清单

### 进行中 (In Progress)
- 无

### 待办 (Pending)
- 无

### 已完成 (Completed)
- 无

## 优先级说明

- **P0**: 关键任务，阻塞其他功能
- **P1**: 高优先级，重要但不阻塞
- **P2**: 中等优先级，可以延后
- **P3**: 低优先级，有时间再做

## 添加任务

用户可以随时添加新任务：

```
p0: 实现用户认证功能
p1: 添加数据导出功能
```

## 进度跟踪

- 总任务数: 0
- 已完成: 0
- 完成率: 0%
EOF

    # OPS.md
    cat > ai-docs/OPS.md << 'EOF'
# 操作指南 (OPS)

## 快速启动

### 1. 启动敏捷开发流程
/agile-start

### 2. 暂停自动继续
/agile-stop

### 3. 生成迭代回顾
/agile-retrospective

## 开发工作流

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
A: 直接告诉 AI 你想做什么，例如 "p0: 添加用户登录功能"

### Q: 如何查看进度？
A: 运行 /agile-dashboard 查看进度看板
EOF

    # CONTEXT.md
    cat > ai-docs/CONTEXT.md << 'EOF'
# 项目上下文和记忆 (CONTEXT)

## 项目概述

**项目名称**: 待定义
**创建时间**: 待定义

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
- `projects/active/`: 敏捷开发数据
EOF

    # ACCEPTANCE.md
    cat > ai-docs/ACCEPTANCE.md << 'EOF'
# 任务验收报告 (ACCEPTANCE)

## 验收标准

### 功能验收
- [ ] 功能符合需求描述
- [ ] 所有用户场景通过
- [ ] 边界情况处理正确

### 质量验收
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 所有测试通过
- [ ] 代码通过 Linting
- [ ] 代码通过类型检查

## 已完成任务

暂无

## 待验收任务

- 无

## 验收流程

1. 开发人员完成任务开发
2. 自动运行测试（覆盖率 ≥ 80%）
3. AI 检查验收标准
4. 记录验收结果到此文档

## 质量指标

- 测试覆盖率目标: ≥ 80%
- 代码通过率目标: 100%
EOF

    # BUGS.md
    cat > ai-docs/BUGS.md << 'EOF'
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

    # API.md
    cat > ai-docs/API.md << 'EOF'
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

    echo "✅ 文档模板已创建"
fi

# 检查迭代状态
if [ ! -f "projects/active/iteration.txt" ]; then
    # 创建迭代 1
    iteration=1
    echo $iteration > projects/active/iteration.txt

    # 创建迭代目录
    mkdir -p projects/active/iterations/${iteration}/{tasks,tests,development}

    # 初始化状态文件
    cat > projects/active/iterations/${iteration}/status.json << EOF
{
  "iteration": 1,
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "initialized",
  "progress": {
    "stories_completed": 0,
    "stories_total": 0,
    "tasks_completed": 0,
    "tasks_total": 0,
    "test_coverage": 0.0,
    "completion_percentage": 0
  },
  "current_task": null,
  "pending_tasks": [],
  "completed_tasks": [],
  "bugs": [],
  "blockers": [],
  "context_summary_path": "./summary.md",
  "dashboard_path": "./dashboard.html"
}
EOF

    echo "✅ 迭代 ${iteration} 已创建"
else
    iteration=$(cat projects/active/iteration.txt)
    echo "当前迭代: ${iteration}"
fi

echo ""
echo "=== 项目初始化完成 ==="
echo "📁 项目目录: projects/active/"
echo "📚 文档目录: ai-docs/"
echo "🔢 当前迭代: ${iteration}"
echo ""
echo "💡 下一步:"
echo "  - 查看文档: cat ai-docs/PLAN.md"
echo "  - 添加任务: 告诉 AI 'p0: 实现新功能'"
echo "  - 查看进度: /agile-dashboard"
