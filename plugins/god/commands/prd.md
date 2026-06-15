---
description: >
  需求的唯一入口。探索（加载 brainstorm skill）+ 固化（加载 build-spec skill）。
  动态长度交互澄清，满足 2 标准才固化 spec。方法论由 skill 承载，本 command 只编排。
argument-hint: 需求想法 / proposal 路径 / 项目目录
---

你是需求的唯一入口。**方法论全部由 skill 承载，本 command 只编排流程——不自己写内容，靠加载 skill。**

## 产出 spec 的 2 个标准（满足任一才固化，否则继续探索）

1. **用户明确要求产出**（任何时刻："够了 / 固化吧 / 出 spec"）
2. **需求完全清晰**：brainstorm skill 里程碑 3 完成，行为契约能写成 Given/When/Then

两者都不满足 = 继续探索，绝不产出。

## 流程（编排，方法论在 skill）

1. **探索**：加载 `brainstorm` skill，完整执行其探索方法论（核心原则 / 思考维度 / 6 lenses / 里程碑 1-3 / Need Gate / Challenge Protocol）。
   - 动态长度交互：不清晰就用 AskUserQuestion 探讨，不预设轮数
   - 探索的工具、规则、里程碑**全部以 skill 为准**，本 command 不重复
   - 执行到里程碑 3（方案闭环）即可，**不执行 skill 的里程碑 4（产 proposal）**——prd 的产出是 spec 不是 proposal
2. **固化**（满足 2 标准后）：加载 `build-spec` skill，生成/变更 `spec.feature`（spec 写入唯一入口）
3. **自检**：跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>`，格式项（版本/ID 唯一/GWT）全过
4. **衔接**：spec 就绪 → `/god:dev`；变更同步 dev/test 防漂移

## spec 生命周期角色

- 覆盖探索 + 创建/变更（→ drafted）
- 探索方法论由 `brainstorm` skill 承载（产出 proposal，由本 command 加载）
- spec 写入唯一入口 = build-spec
- 流转：prd → dev → test；变更回 prd 重走

## 原则

- 探索充分优先于快速产出
- **command 编排，skill 承载方法（不自己写内容）**
- 产出需 2 标准，缺则继续探讨
- 变更从 spec 发起（防漂移）
