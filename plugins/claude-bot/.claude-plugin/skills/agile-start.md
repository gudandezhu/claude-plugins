---
name: agile-start
description: 自动任务管理技能：初始化项目（首次）、加载状态、获取下一个任务、引导用户添加任务或开始开发
version: 2.0.0
---

# Agile Start - 自动任务管理技能

## 任务
初始化或恢复敏捷开发流程，检查项目状态，获取下一个待执行任务。

---

## 执行流程

### 第一步：检查项目结构

```bash
# 确保项目目录存在
if [ ! -d "projects/active" ]; then
    echo "创建新项目..."
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
            echo "✅ 已添加 ai-docs/ 到 .gitignore"
        fi
    else
        echo "# Agile Flow - AI 生成的文档" > .gitignore
        echo "ai-docs/" >> .gitignore
        echo "✅ 已创建 .gitignore 并添加 ai-docs/"
    fi

    echo "✅ 项目结构已创建"

    # 初始化 ai-docs 文档模板
    echo "初始化 ai-docs 文档..."

    # PRD.md - 项目需求文档
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

### 功能 2：功能名称
**优先级**: P1
**描述**: 功能描述

## 4. 非功能需求

### 性能要求
- 响应时间 < 200ms
- 并发用户 > 1000

### 安全要求
- 用户认证
- 数据加密

### 可用性要求
- 系统可用性 > 99.9%

## 5. 技术约束

- 技术栈 1
- 技术栈 2

## 6. 里程碑

### 迭代 1（Week 1-2）
- 核心功能开发

### 迭代 2（Week 3-4）
- 次要功能开发

## 7. 风险与依赖

### 风险
- 风险 1：描述和缓解措施

### 依赖
- 外部依赖 1
- 外部依赖 2
EOF

    # PLAN.md - 工作计划和任务清单
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

    # OPS.md - 操作指南
    cat > ai-docs/OPS.md << 'EOF'
# 操作指南 (OPS)

## 环境要求

- Node.js >= 18
- Python >= 3.9
- jq (用于 JSON 处理)

## 快速启动

### 1. 启动敏捷开发流程

```bash
/agile-start
```

### 2. 查看进度看板

```bash
/agile-dashboard
```

### 3. 暂停自动继续

```bash
/agile-pause
```

### 4. 恢复自动继续

```bash
/agile-continue
```

### 5. 生成迭代回顾

```bash
/agile-retrospective
```

## 开发工作流

### TDD 开发流程

1. 编写测试用例
2. 运行测试（预期失败）
3. 编写最少代码使测试通过
4. 运行覆盖率测试（目标 ≥ 80%）
5. 重构代码

### 代码提交

```bash
git add .
git commit -m "feat: 描述变更"
```

## 测试

### 单元测试

```bash
npm run test:unit
# 或
pytest
```

### E2E 测试

```bash
/agile-e2e-test
```

### 覆盖率测试

```bash
npm run test:unit -- --coverage
# 或
pytest --cov
```

## 常见问题

### Q: 如何添加新任务？
A: 直接告诉 AI 你想做什么，例如 "p0: 添加用户登录功能"

### Q: 如何查看进度？
A: 运行 `/agile-dashboard` 查看进度看板

### Q: 如何暂停自动继续？
A: 运行 `/agile-pause` 暂停，`/agile-continue` 恢复
EOF

    # CONTEXT.md - 项目上下文和记忆
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

### 概念 2
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

### 代码风格
- 使用 2 空格缩进
- 单引号优先
- 最大行宽: 80

## 重要文件

- `src/`: 源代码目录
- `tests/`: 测试代码目录
- `projects/active/`: 敏捷开发数据

## 已知问题

### 问题 1
- 描述
- 临时解决方案
- 长期解决方案

## 学习笔记

### 关键知识点
- 知识点 1
- 知识点 2

## 下一步

- [ ] 待办事项 1
- [ ] 待办事项 2
EOF

    # ACCEPTANCE.md - 任务验收报告
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

### 文档验收
- [ ] 代码注释充分
- [ ] API 文档更新
- [ ] 用户文档更新

## 已完成任务

### TASK-XXX: 任务名称
**完成时间**: 待更新
**验收人**: 待更新
**验收结果**: ✅ 通过 / ❌ 未通过

**验收详情**:
- 功能验收: ✅ / ❌
- 质量验收: ✅ / ❌
- 文档验收: ✅ / ❌

**备注**:
验收备注信息

## 待验收任务

- 无

## 验收流程

1. 开发人员完成任务开发
2. 自动运行测试（覆盖率 ≥ 80%）
3. AI 检查验收标准
4. 记录验收结果到此文档
5. 如有问题，自动修复或报告

## 质量指标

- 测试覆盖率目标: ≥ 80%
- 代码通过率目标: 100%
- Linting 通过率: 100%
EOF

    # BUGS.md - 发现的 Bug 列表
    cat > ai-docs/BUGS.md << 'EOF'
# Bug 列表 (BUGS)

## 严重程度说明

- **Critical**: 系统崩溃、数据丢失、安全漏洞
- **High**: 主要功能不可用
- **Medium**: 次要功能受影响
- **Low**: UI 问题、文案错误

## 已修复 Bug

### BUG-XXX: Bug 标题
**严重程度**: Critical
**发现时间**: 待更新
**修复时间**: 待更新
**状态**: ✅ 已修复

**描述**:
Bug 详细描述

**复现步骤**:
1. 步骤 1
2. 步骤 2

**修复方案**:
修复方法说明

## 待修复 Bug

- 无

## Bug 报告流程

1. AI 在测试或开发中发现 Bug
2. 自动记录到此文档
3. 尝试自动修复
4. 如无法自动修复，报告给用户

## 质量趋势

- 本周期 Bug 数: 0
- 修复 Bug 数: 0
- Bug 修复率: 0%
EOF

    # API.md - 项目的 API 清单
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

#### GET /api/users/:id
**描述**: 获取用户信息

**响应**: 200 OK
```json
{
  "id": "string",
  "name": "string",
  "email": "string"
}
```

## 内部 API

### UserService

#### createUser(data: UserCreateInput): Promise<User>
**描述**: 创建新用户
**参数**:
- `data.name`: 用户名
- `data.email`: 邮箱

**返回**: 用户对象

#### getUserById(id: string): Promise<User | null>
**描述**: 根据 ID 获取用户
**参数**:
- `id`: 用户 ID

**返回**: 用户对象或 null

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

    echo "✅ ai-docs 文档模板已创建"
fi
```

### 第二步：检查当前迭代

```bash
# 读取当前迭代编号
if [ -f "projects/active/iteration.txt" ]; then
    iteration=$(cat projects/active/iteration.txt)
    echo "当前迭代: ${iteration}"
else
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
fi

iteration_dir="projects/active/iterations/${iteration}"
```

### 第三步：清理暂停标记

```bash
# 删除暂停标记（如果存在）
if [ -f "projects/active/pause.flag" ]; then
    echo "检测到暂停标记，已清除"
    rm -f projects/active/pause.flag
fi
```

### 第四步：加载状态

```bash
# 读取状态索引
if [ -f "${iteration_dir}/status.json" ]; then
    status_json=$(cat ${iteration_dir}/status.json)

    # 提取当前任务
    current_task_id=$(echo $status_json | jq -r '.current_task.id // empty')

    # 提取待办任务
    pending_count=$(echo $status_json | jq '.pending_tasks | length')

    echo "项目状态:"
    echo "  - 迭代: ${iteration}"
    echo "  - 当前进度: $(echo $status_json | jq -r '.progress.tasks_completed')/$(echo $status_json | jq -r '.progress.tasks_total') 任务完成"
    echo "  - 待办任务: ${pending_count}"
else
    echo "警告：状态文件不存在，将重新生成"
    /agile-dashboard
fi
```

### 第五步：获取下一个任务

```bash
# 优先级：current_task > pending_tasks[0]
if [ -n "$current_task_id" ] && [ "$current_task_id" != "null" ]; then
    # 有当前任务，继续执行
    next_task_id=$current_task_id
    echo "继续当前任务: ${next_task_id}"
elif [ "$pending_count" -gt 0 ]; then
    # 获取第一个待办任务
    next_task_id=$(echo $status_json | jq -r '.pending_tasks[0].id')
    echo "下一个待办任务: ${next_task_id}"
else
    # 无待办任务
    echo "当前无待办任务"

    # 检查是否需要创建下一迭代
    tasks_total=$(echo $status_json | jq -r '.progress.tasks_total')
    tasks_completed=$(echo $status_json | jq -r '.progress.tasks_completed')

    if [ "$tasks_total" -gt 0 ] && [ "$tasks_completed" -eq "$tasks_total" ]; then
        echo "✅ 当前迭代所有任务已完成"

        # 询问是否创建下一迭代
        echo "是否创建下一迭代？"
        echo "使用 /agile-retrospective 生成迭代回顾后，手动创建迭代 $((iteration + 1))"
        exit 0
    else
        echo "请先创建用户故事和任务卡片："
        echo "  1. /agile-product-analyze - 分析需求并创建用户故事"
        echo "  2. /agile-tech-design - 拆分技术任务"
        exit 0
    fi
fi
```

### 第六步：加载任务详情

```bash
# 读取任务卡片
task_file="${iteration_dir}/tasks/${next_task_id}.md"

if [ ! -f "$task_file" ]; then
    echo "错误：任务文件不存在 ${task_file}"
    exit 1
fi

task_md=$(cat $task_file)

# 提取任务元数据
task_name=$(grep '^name:' "$task_file" | cut -d: -f2 | xargs)
task_status=$(grep '^status:' "$task_file" | cut -d: -f2 | xargs)
task_story=$(grep '^story:' "$task_file" | cut -d: -f2 | xargs)
dependencies=$(grep '^dependencies:' "$task_file" | cut -d: -f2 | xargs)

echo "任务信息:"
echo "  - ID: ${next_task_id}"
echo "  - 名称: ${task_name}"
echo "  - 状态: ${task_status}"
echo "  - 关联故事: ${task_story}"
echo "  - 依赖: ${dependencies}"
```

### 第七步：检查依赖

```bash
# 检查依赖任务是否完成
if [ -n "$dependencies" ] && [ "$dependencies" != "[]" ]; then
    echo "检查依赖任务..."

    # 解析依赖数组（简单处理，实际应使用 jq）
    deps=$(echo $dependencies | sed 's/\[//;s/\]//;s/,//g')

    for dep in $deps; do
        dep_file="${iteration_dir}/tasks/${dep}.md"
        if [ -f "$dep_file" ]; then
            dep_status=$(grep '^status:' "$dep_file" | cut -d: -f2 | xargs)
            if [ "$dep_status" != "completed" ]; then
                echo "❌ 依赖任务 ${dep} 未完成（状态：${dep_status}）"
                echo "请先完成依赖任务"
                exit 1
            else
                echo "✅ 依赖任务 ${dep} 已完成"
            fi
        else
            echo "⚠️  依赖任务文件不存在 ${dep_file}"
        fi
    done
fi
```

### 第八步：读取上下文

```bash
# 读取项目摘要（可选，< 300 tokens）
if [ -f "${iteration_dir}/summary.md" ]; then
    echo ""
    echo "=== 项目摘要 ==="
    cat ${iteration_dir}/summary.md
    echo ""
fi

# 读取关联的用户故事（如需要）
if [ -n "$task_story" ] && [ "$task_story" != "null" ]; then
    story_file="projects/active/backlog/${task_story}.md"
    if [ -f "$story_file" ]; then
        echo "=== 用户故事背景 ==="
        head -30 "$story_file"
        echo ""
    fi
fi
```

### 第九步：输出执行指令

```
🎯 准备执行任务

## 任务信息
- ID: ${next_task_id}
- 名称: ${task_name}
- 状态: ${task_status}
- 关联故事: ${task_story}

## 任务详情
${task_md}

## 💡 下一步操作

**选项1：告诉 AI 你要做什么**
直接描述你的需求，例如：
- "实现用户登录功能"
- "添加数据导出功能"
- "p0: 修复登录 bug"

AI 会自动：
- 解析你的需求
- 创建任务卡片
- 开始 TDD 开发流程

**选项2：直接开始开发此任务**
使用 TDD 开发流程：
1. 编写测试用例
2. 运行测试（预期失败）
3. 编写最少代码使测试通过
4. 运行测试确保覆盖率 ≥ 80%
5. 更新任务状态为 completed

**选项3：查看当前进度**
告诉我 "查看进度" 或 "显示状态"

---

🚀 **推荐方式**：直接告诉我你想做什么，AI 会自动处理！
```

---

## 使用示例

```bash
# 第一次启动（初始化项目）
/agile-start

# 后续启动（自动继续）
/agile-start

# 查看当前状态
/agile-dashboard
```

---

## 配置选项

在 `projects/active/config.json` 中配置：

```json
{
  "continuation": {
    "enabled": true,
    "autoStart": true
  }
}
```

- `enabled`: 是否启用持续运行模式
- `autoStart`: 启动时是否自动执行下一个任务

---

## 注意事项

1. **项目结构**：首次运行会自动创建目录结构
2. **状态文件**：status.json 是核心，由 /agile-dashboard 维护
3. **依赖检查**：确保依赖任务已完成才执行当前任务
4. **Token 预算**：加载的上下文应控制在 2000 tokens 以内
