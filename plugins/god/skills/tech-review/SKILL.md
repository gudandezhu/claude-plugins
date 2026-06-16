---
status: stable
name: tech-review
user-invocable: false
description: >
  评审技术方案文档的质量和完整性，量化评分（满分100，≥90分通过）。
  评估逻辑由 eval-loop（维度名 tech-review）统一执行。
---

# 技术方案评审

## 核心原则

- **不信任作者自述**：独立读取方案每个章节，亲自验证检查内容
- **量化评分**：总分 100 分，≥ 90 分通过，< 90 分不通过

## 工作方式

1. 接收用户提供的技术方案文档路径
2. **执行交付物校验**（见下方），确认所有交付物存在
3. **调用 eval-loop**：`eval-loop(design/目录路径, tech-review, 90, 3)`
   - eval-loop 加载 `eval-loop/references/rubric-tech-review.md`
   - rubric 包含技术规范加载指令（三级优先级：项目 > 团队 > 公司）
   - 循环执行评估+修复，直到 ≥90 分或达到最大迭代次数
4. 返回 eval-loop 的评估报告

## 交付物校验

评审开始前必须先校验所有交付物是否齐全。缺少任何一项交付物，直接判定为不通过。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/dev/check-deliverables.sh" "$WORK_DIR" \
  "技术方案文档|design/tech-design.md" \
  "API文档|design/api/*.md" \
  "数据库脚本|design/sql/*.sql"
```

- 所有条目必须至少匹配到一个文件
- 缺少任何一个 → 直接"不通过"
- 脚本位置：`${CLAUDE_PLUGIN_ROOT}/scripts/dev/check-deliverables.sh`

User input: $ARGUMENTS
