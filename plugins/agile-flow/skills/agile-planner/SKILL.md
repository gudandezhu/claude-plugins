---
name: agile-planner
description: 需求规划技能：分析需求文档、评估优先级、生成任务列表
version: 8.0.0
---

# Agile Planner

分析 `ai-docs/REQUIREMENTS.md`，生成任务列表。

## 执行步骤

1. 读取需求文档
2. 评估优先级（P0/P1/P2/P3）
3. 拆分为可执行任务
4. 写入 `ai-docs/data/TASKS.json`

## 创建任务

每个任务必须包含完整上下文：

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add '{
  "priority": "P0",
  "title": "实现用户登录",
  "description": "简短描述",
  "context": {
    "userStory": "作为用户，我希望能使用邮箱和密码登录系统",
    "acceptanceCriteria": ["验证邮箱格式", "密码使用 bcrypt 加密"],
    "techNotes": "使用现有认证中间件，参考 src/auth/",
    "dependencies": ["TASK-002"],
    "relatedFiles": ["src/routes/auth.ts", "src/middleware/auth.ts"]
  }
}'
```

**必需字段**：
- `priority`: P0/P1/P2/P3
- `title`: 任务标题
- `context.userStory`: 用户故事
- `context.acceptanceCriteria`: 验收标准（数组）

**可选字段**：
- `context.techNotes`: 技术说明
- `context.dependencies`: 依赖任务 ID
- `context.relatedFiles`: 相关文件

## 输出

`✓ 创建 5 个任务: TASK-001~005`
