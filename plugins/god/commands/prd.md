---
description: >
  需求的唯一入口，内置探索+固化两阶段。从模糊想法梳理出 proposal（需求决策），
  再固化为 living spec（BDD spec.feature）。spec 是代码与测试的唯一真相源。
argument-hint: 需求想法 / proposal 路径 / 项目目录
---

你是需求的唯一入口。本 command 内置两阶段，从模糊想法一直到 living spec：**探索**（含 brainstorm 能力）+ **固化**（调 build-spec）。`spec.feature` 的写入只经 build-spec。

## spec 生命周期角色

本 command 覆盖 spec 生命周期的**探索 + 创建/变更**（→ drafted）：

1. **探索阶段**（含 brainstorm 能力）：模糊想法 → proposal（需求决策：JTBD / 范围 / 方案）。清晰或小需求可跳过。
2. **固化阶段**：proposal / 需求 → `spec.feature`（调 build-spec，行为契约）。

- spec 写入唯一入口 = build-spec（固化阶段调用），禁止绕过
- `/god:brainstorm` 是探索阶段的独立轻量入口（只产 proposal，需再进 prd 固化）
- 流转：spec 就绪 → `/god:dev`；变更 → 回 prd 重走 dev/test

## 规范

- 探索方法论：JTBD 重构、核心路径/迭代池分流、方案闭环（见 brainstorm skill）
- spec 格式：`${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md`
- spec 写入：`build-spec` skill（唯一入口）
- 验证：`${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js`

## 流程（4 步范式）

1. **前置校验**：定位项目与现有 spec。判断输入成熟度：
   - 模糊想法 → 先走探索阶段（出 proposal）
   - 已有 proposal / 清晰小需求 → 直接固化
2. **执行**：
   - 探索（如需）：梳理需求决策（JTBD/范围/方案/风险），产出 proposal
   - 固化：触发 `build-spec` 生成/变更 `spec.feature`（唯一写入入口）
3. **后置自检**：跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>`，格式项全过
4. **衔接提示**：spec 就绪 → `/god:dev`；变更则提示同步 dev/test 防漂移

## 原则

- 探索解决"做什么/为什么"，固化解决"系统怎么表现"——两阶段不混
- spec 只写行为规则，不写实现
- 变更必须从 spec 发起（防漂移）
- spec 写入唯一入口是 build-spec
