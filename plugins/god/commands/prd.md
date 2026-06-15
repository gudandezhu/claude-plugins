---
description: >
  产出或调整 living spec（BDD 规格文档）。需求经 build-spec skill 转为
  可追溯的 Feature/Scenario，每个场景带唯一 SC-ID。spec 是代码与测试的唯一真相源。
argument-hint: 需求描述或 proposal 路径
---

你是 living spec 流程的触发器。`spec.feature` 的创建与变更**必须经 `build-spec` skill**（唯一入口），本 command 不直接编辑 spec。

## spec 生命周期角色

本 command 负责 spec 生命周期的**创建/变更**阶段（→ drafted）：需求 → `spec.feature`。
- spec 写入的唯一能力是 `build-spec` skill，本 command 触发它（不直接编辑 spec）
- 流转：spec 就绪后交给 `/god:dev`（实现）；变更则需重走 dev/test（防漂移）

## 规范

- spec 生成与变更 → `build-spec` skill（唯一入口，禁止绕过）
- 格式标准 → `${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md`
- 验证 → `${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js`

## 流程（4 步范式）

1. **前置校验**：定位项目目录与现有 spec（`spec/spec.feature`）。
   - 无 spec → 创建路径
   - 有 spec → 读现有版本与 SC，确定新增/改动点
   - 需求模糊时用 AskUserQuestion 澄清行为契约，不要臆测
2. **执行**：触发 `build-spec` skill 生成/变更 `spec.feature`（创建或修改 spec 的唯一入口，禁止绕过直接编辑）。
3. **后置自检**：跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>`
   - 格式项（版本/ID 唯一/GWT）必须全过
4. **衔接提示**：spec 就绪，建议跑 `/god:dev` 让代码跟随 spec；变更则提示同步 dev/test 防漂移。

## 原则

- spec 只写行为规则，不写实现细节
- 变更必须从 spec 发起（防漂移的强制从顶到底）
- spec 创建/变更的唯一入口是 `build-spec`，保证质量与可追溯
