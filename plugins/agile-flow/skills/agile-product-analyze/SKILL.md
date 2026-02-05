---
name: agile-product-analyze
description: 产品需求分析技能：分析PRD、评估优先级、创建任务、维护项目业务上下文
version: 6.0.0
---

# Agile Product Analyze

分析 PRD，评估优先级，创建用户故事级任务。

## 执行步骤

1. 读取 `ai-docs/docs/CONTEXT.md` 了解项目状态
2. 读取 `ai-docs/docs/PRD.md` 识别需求
3. 评估优先级（使用 `priority-evaluator.sh`）
4. 创建任务到 `ai-docs/data/TASKS.json`
5. 更新 `ai-docs/docs/CONTEXT.md`

## 创建任务

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add P0 "任务描述"
```

## 输出要求

- 最多一行（如 `✓ 创建 5 个任务: TASK-001~005`）
- 不输出详细内容
- 最多 20 字
