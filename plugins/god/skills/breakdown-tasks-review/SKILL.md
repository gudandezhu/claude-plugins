---
name: breakdown-tasks-review
user-invocable: false
description: >
  评审 breakdown-tasks 产出的任务列表质量，量化评分（满分100，≥90分通过）。
  评估逻辑由 eval-loop（维度名 breakdown-tasks）统一执行。
---

# 任务拆分评审

## 核心原则

- **不信任自检报告**：先校验交付物，再由 eval-loop 独立评估
- **量化评分**：总分 100 分，≥ 90 分通过

## 工作方式

1. 接收 tech-design.md 路径和 tasks/ 目录路径
2. **执行交付物校验**（见下方），确认所有交付物存在
3. **调用 eval-loop**：`eval-loop(tasks/目录路径, breakdown-tasks, 90, 3)`
   - eval-loop 加载 `eval-loop/references/rubric-breakdown-tasks.md`
   - 循环执行评估+修复，直到 ≥90 分或达到最大迭代次数
4. 返回 eval-loop 的评估报告

## 交付物校验

评审开始前必须先校验所有交付物是否齐全。缺少任何一项交付物，直接判定为不通过。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/dev/check-deliverables.sh" "$WORK_DIR" \
  "技术方案文档|design/tech-design.md" \
  "任务列表|tasks/IT-*/task-list.json" \
  "后端任务详情|tasks/IT-*/BE-*.md" \
  "前端任务详情|tasks/IT-*/FE-*.md"
```

- 所有条目必须至少匹配到一个文件
- 缺少任何一个 → 直接"不通过"
- 脚本位置：`${CLAUDE_PLUGIN_ROOT}/scripts/dev/check-deliverables.sh`

User input: $ARGUMENTS
