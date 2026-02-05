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

**简单格式**（推荐）：
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add P0 "实现用户登录"
```

**扩展格式**（带上下文）：
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add '{
  "priority": "P0",
  "title": "实现用户登录",
  "description": "简短描述",
  "context": {
    "userStory": "作为用户，我希望能登录",
    "acceptanceCriteria": ["验证邮箱", "密码加密"],
    "dependencies": ["TASK-002"]
  }
}'
```

## 输出

`✓ 创建 5 个任务: TASK-001~005`
