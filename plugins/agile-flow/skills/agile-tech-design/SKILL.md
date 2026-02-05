---
name: agile-tech-design
description: 技术设计技能：拆分用户故事为技术任务，维护项目技术上下文
version: 6.0.0
---

# Agile Tech Design

将用户故事拆分为具体的技术任务。

## 执行步骤

1. 读取 `ai-docs/docs/PRD.md` 查找用户故事
2. 识别技术组件（API、数据模型、前端组件、测试）
3. 拆分为技术任务
4. 更新 `ai-docs/docs/TECH.md`

## 创建任务

**扩展格式**（推荐）：
```bash
cat > /tmp/task.json << 'EOF'
{
  "priority": "P0",
  "title": "实现用户登录功能",
  "description": "简短描述",
  "context": {
    "userStory": "作为用户，我希望能够使用邮箱和密码登录系统",
    "acceptanceCriteria": ["验证邮箱格式", "密码加密（bcrypt）"],
    "techNotes": "使用现有认证中间件，参考 src/auth/ 目录",
    "dependencies": ["TASK-002"],
    "relatedFiles": ["src/routes/auth.ts", "src/middleware/auth.ts"]
  }
}
EOF

node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add /tmp/task.json
```

## 输出要求

- 最多一行（如 `✓ 拆分为 7 个技术任务`）
- 不输出详细内容
- 最多 20 字
