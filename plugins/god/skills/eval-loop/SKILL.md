---
status: stable
name: eval-loop
user-invocable: false
description: |
  多轮迭代量化评估方法论。定义 reviewer（只评估）和 fixer（只修复）的角色规范、评分维度和循环控制逻辑。
  由 `eval-loop-review.js` workflow 的 agent 加载，提供 rubric 和评分规则。
  支持自定义评估维度（rubric），不传使用默认维度。
  内置维度见 body 中的"内置维度"表。

  触发词：评估循环、多轮评审、eval-loop、/eval-loop

  输入：目标内容路径 + 可选维度参数
  输出：评估报告 + 最终得分
---

# 多轮迭代量化评估

## 参数

`$ARGUMENTS` 格式：`<目标路径> [维度名] [阈值] [最大迭代]`

| 位置 | 默认值 | 说明 |
|------|--------|------|
| 第1个 | — | 目标文件或目录路径（必需） |
| 第2个 | `default` | 评估维度，对应 `references/rubric-{name}.md` |
| 第3个 | `90` | 通过阈值 |
| 第4个 | `3` | 最大迭代（硬上限 5） |

## 流程

> 本 skill 定义评审方法论，由 `eval-loop-review.js` workflow 实际编排执行。

```
解析参数 → 验证路径存在
    ↓
确定 rubric 路径 → 不存在则 fallback 到 rubric-default.md
    ↓
前置检查（脚本化）→ 失败 → ❌ 直接 FAIL
    ↓ 通过
循环（最多 maxIterations 轮）：
    reviewer 阶段（只评估）→ 返回报告
    ↓
    分数 >= 阈值？ → 是 → ✅ 结束
    ↓ 否
    fixer 阶段（根据报告修复）→ 修复完成
    ↓
    继续下一轮（重新评估）
```

## 脚本化前置检查

在评审前，先执行确定性检查：

| 检查项 | 方式 | 适用维度 |
|--------|------|---------|
| 交付物存在性 | check-deliverables.sh | 所有维度 |
| task-list.json 一致性 | 脚本比对 tasks 数组长度 vs 实际文件数 | breakdown-tasks |
| API 文件存在性 | 文件 glob | tech-review |
| SQL 文件存在性 | 文件 glob | tech-review |

前置检查失败 → 直接 FAIL。前置检查通过 → 进入评审循环。

## 角色规范

### Reviewer（评估）

reviewer 角色（详见 `prompts/reviewer.md`）所需输入：

| 占位符 | 替换为 |
|--------|--------|
| `{TARGET_CONTENT_PATH}` | 目标路径 |
| `{RUBRIC_PATH}` | rubric 文件绝对路径 |
| `{THRESHOLD}` | 通过阈值 |
| `{REVIEW_CONTEXT_PATH}` | 额外上下文文件路径（如 code-review 的 git diff 范围），无则为空字符串 |

从 reviewer 返回报告中提取分数。`score >= threshold` 则通过，否则进入 fixer 阶段。

### Fixer（修复）

fixer 角色（详见 `prompts/fixer.md`）所需输入：

| 占位符 | 替换为 |
|--------|--------|
| `{TARGET_CONTENT_PATH}` | 目标路径 |
| `{RUBRIC_PATH}` | rubric 文件绝对路径 |
| `{THRESHOLD}` | 通过阈值 |

额外将上一轮 reviewer 的完整报告作为上下文传入 fixer。

fixer 完成后 `iteration++`，重新进入 reviewer 阶段评估。

达到 maxIterations 仍未通过则结束，输出最终报告。

## 内置维度

| 维度名 | 用途 | 调用方 |
|--------|------|--------|
| `default` | 通用评估（完整性/正确性/清晰性/一致性/可操作性） | 直接调用 |
| `breakdown-tasks` | 任务拆分评审（完整性/粒度/依赖/可构建性/DDL/内容质量/迭代覆盖） | breakdown-tasks-review |
| `tech-review` | 技术方案评审（完整性/合理性/深度/规范性/规范符合性） | tech-review |
| `code-review` | 代码审查（需求合规/代码质量） | code-review |

## 自定义维度

新建 `references/rubric-{name}.md` 即可，要求：总分 100、维度汇总表、检查项标明分值。

使用：`/eval-loop <目标路径> <维度名>`

## 禁止

- 评估与修改必须隔离，禁止自评自改
- 不超过 5 次迭代
