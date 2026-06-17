---
status: stable
name: ask-user
user-invocable: false
description: |
  封装 AskUserQuestion 调用。所有 god 流水线需要问用户的地方，必须经本 skill
  加载，禁止 command / 其他 skill 直接拼 AskUserQuestion 参数。
  触发：command 层或 skill 层需要问用户时。
---

# Ask User（问用户封装）

> 任何 god 流水线需要问用户时，加载本 skill。**禁止**在 command / skill 里直接拼 AskUserQuestion 参数。

## 唯一目的

把"问用户"这件事**集中化、模板化**，避免：

- 各处拼 AskUserQuestion 参数风格不一
- 选项/header 长度超限
- 推荐项位置乱放
- 同一类问题（如 S1 签字）每个调用点重新设计

## 调用模板

**单选 Gate（最常用）**：

```
header: "<≤12 字, 如 'S1 签字'>"
question: "<一句话提问, 含选项关键差异>"
options:
  - label: "<推荐项, 放第 1 个>"
    description: "<为什么选 + 后果>"
  - label: "<备选项>"
    description: "<为什么 + 后果>"
  - label: "<暂不决定>"
    description: "<回到上一阶段 / 暂停>"
```

**多选（确认多项）**：

```
multiSelect: true
options: [...]
```

## 4 条铁律

1. **header ≤ 12 字符**（`S1 签字` / `C3 Q1` / `归因`）
2. **第一项 = 推荐项**（带"为什么"）
3. **必带"暂不决定" / "调整"选项**（避免强制决策）
4. **问题必带差异化**（不要 4 个选项都同方向）

## 禁用

- ❌ 用 AskUserQuestion 问"是否继续？"（Gate 通过默认继续，不问）
- ❌ 用 AskUserQuestion 问"你想怎么实现？"（技术选型，brainstorm 禁）
- ❌ 跳过 AskUserQuestion 直接默认（违反 sign-gate 强制）
- ❌ 单选问题用 multiSelect（除非真要勾选多选）

## 跟其他 skill 的关系

- `sign-gate` skill：用本 skill 调 S1/S2/S3 签字的 AskUserQuestion
- `prd` skill：用本 skill 调 C1/C2/C3/C4 Gate 的 AskUserQuestion
- `prd-edit` skill：用本 skill 调归因（spec 错 / 实现错）选择

## 实际样子

```
# 错误（直接拼）：
AskUserQuestion(options=[{"label":"通过","description":""}, ...])

# 正确（加载本 skill 后）：
load_skill("ask-user")
# 按上面 4 条铁律拼 AskUserQuestion 参数
```
