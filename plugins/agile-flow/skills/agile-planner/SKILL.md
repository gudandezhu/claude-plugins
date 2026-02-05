---
name: agile-planner
description: 需求规划技能：分析需求文档、评估优先级、生成任务列表
version: 8.0.0
---

# Agile Planner

分析需求文档并生成任务列表，合并了原产品需求分析和技术设计的功能。

## 执行步骤

1. **读取需求文档**
   - 读取 `ai-docs/REQUIREMENTS.md`
   - 如果文件不存在，提示用户先运行 `scripts/init/init-project.sh`

2. **分析需求**
   - 解析需求文档中的功能需求
   - 评估优先级（P0/P1/P2/P3）
   - 识别用户故事和验收标准

3. **生成任务列表**
   - 将需求拆分为可执行的任务
   - 使用扩展格式创建任务（包含用户故事、验收标准、技术说明）
   - 写入到 `ai-docs/data/TASKS.json`

4. **输出简洁结果**
   - 最多一行（如 `✓ 创建 5 个任务: TASK-001~005`）
   - 不输出详细内容
   - 最多 20 字

## 创建任务格式

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

- 最多一行（如 `✓ 创建 5 个任务: TASK-001~005`）
- 不输出详细内容
- 最多 20 字
