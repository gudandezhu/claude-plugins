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

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add <P0|P1|P2|P3> "任务描述"
```

或使用扩展格式：
```bash
cat > /tmp/task.json << 'EOF'
{
  "priority": "P0",
  "title": "实现用户登录",
  "description": "简短描述",
  "context": {
    "userStory": "作为用户，我希望能够使用邮箱和密码登录",
    "acceptanceCriteria": ["验证邮箱格式", "密码加密"],
    "techNotes": "使用现有认证中间件",
    "dependencies": ["TASK-002"],
    "relatedFiles": ["src/routes/auth.ts"]
  }
}
EOF

node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add /tmp/task.json
```

## 输出

最多一行，如 `✓ 创建 5 个任务: TASK-001~005`
