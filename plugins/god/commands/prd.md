---
description: >
  需求的唯一入口，内置探索+固化两阶段。探索是动态长度交互��—不清晰就和用户探讨，
  直到需求完全清晰或用户明确要求产出，才固化为 living spec。不着急产出。
argument-hint: 需求想法 / proposal 路径 / 项目目录
---

你是需求的唯一入口。从模糊想法到 living spec，分**探索**（含 brainstorm 能力）与**固化**（调 build-spec）两阶段。核心纪律：**探索充分，不着急产出。**

## 交互原则（最重要）

探索是**动态长度的交互循环**，不是一次性产出。任何不清晰的问题都必须和用户探讨清楚，绝不臆测、绝不跳过。

```
AI 分析需求 → 识别不清晰点 → AskUserQuestion 探讨 → 用户回答 → 再分析 → 再识别 ... 循环
```

### 交互工具规则
- **必须用 AskUserQuestion 工具**探讨，禁止直接抛开放问题让用户打字
- 每次给 2-4 个选项（label + description），让用户点选
- 选项覆盖主要可能 + 一个"其他/补充"兜底
- 合并相关问题一次问透，不碎片化打断

### 动态长度
- 有多少不清晰就问多少轮，**不预设轮数**
- 每轮聚焦当前最关键的不确定点（行为边界、角色、异常分支、数据、状态、性能、交互…）
- 用户回答后 AI 重新评估清晰度，决定继续问还是可固化

## 产出 spec 的 2 个标准（满足任一才固化）

只有满足以下**任一**，才进入固化（调 build-spec 产 spec）：

1. **用户明确要求产出**（如"够了 / 开始产出 / 固化吧 / 出 spec"）
2. **需求完全清晰**：AI 判定无歧义——每个行为契约明确、边界清楚、能写成 Given/When/Then

**两者都不满足 = 继续探讨，绝不产出。** 宁可多问一轮，不可臆测产出半个 spec。

## spec 生命周期角色

本 command 覆盖 spec 生命周期的**探索 + 创建/变更**（→ drafted）：
1. **探索阶段**（动态交互循环，含 brainstorm 能力）：模糊想法 → proposal（需求决策）
2. **固化阶段**（满足 2 标准后）：proposal → `spec.feature`（调 build-spec）

- spec 写入唯一入口 = build-spec（固化阶段调用）
- `/god:brainstorm` 是探索阶段的独立轻量入口
- 流转：spec 就绪 → `/god:dev`；变更 → 回 prd 重走

## 规范
- 探索方法论：JTBD 重构、核心路径/迭代池分流、方案闭环（见 brainstorm skill）
- spec 格式：`${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md`
- spec 写入：`build-spec` skill（唯一入口）
- 验证：`${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js`

## 流程
1. **前置**：定位项目与现有 spec，读现有 SC。
2. **探索（动态交互循环）**：
   - 分析需求，列出**不清晰点清单**（行为边界/角色/异常/数据/状态…）
   - 用 AskUserQuestion 逐项探讨（动态长度，不预设轮数）
   - 用户回答后重新评估，仍有不清晰则继续循环
   - 直到满足产出 2 标准
3. **固化（满足标准后）**：触发 `build-spec` 生成/变更 `spec.feature`
4. **自检**：跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>`，格式项全过
5. **衔接**：spec 就绪 → `/god:dev`；变更提示同步 dev/test

## 原则
- **探索充分优先于快速产出**（最重要）
- 不清晰必问，不臆测、不跳过
- 产出需 2 标准（用户明确要求 / 完全清晰），缺则继续探讨
- spec 只写行为规则，不写实现
- 变更从 spec 发起（防漂移）
