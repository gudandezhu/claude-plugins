---
description: >
  需求探索（prd 探索阶段，可独立调用）。加载 brainstorm skill，模糊想法→proposal。
  产出 proposal（需求决策），不产 spec；之后进 /god:prd 固化。
argument-hint: 需求想法或需求文档路径
---

> **定位**：`/god:prd` 的**探索阶段**（可独立调用）。产出 proposal（需求决策），不产 spec；之后进 `/god:prd` 固化为 living spec。

你是需求探索入口。**只编排流程，方法论加载 `brainstorm` skill（不自己写内容）。**

## 流程

1. 加载 `brainstorm` skill，执行其完整探索方法论（动态长度交互、AskUserQuestion、里程碑 1-4、Need Gate）
2. 产出 proposal：`{产出目录}/01-proposal-{slug}.md`
3. Git add + commit（push 等用户确认）
4. 衔接：proposal 就绪 → `/god:prd` 固化为 spec

## 产出物

`{产出目录}/01-proposal-{slug}.md`

## 机制

- 探索产出 **proposal**（不是 spec）；spec 由 `/god:prd` 固化
- proposal 是 `/god:prd` 的需求输入
- 方法论、思考工具、交互规则**全部在 brainstorm skill**，本 command 不重复
