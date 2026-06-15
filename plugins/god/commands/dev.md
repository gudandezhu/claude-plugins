---
description: >
  读 living spec 实现代码。为每个 Scenario 写实现并标注 @spec SC-xxx，
  建立代码↔规格追溯。代码是 spec 的从属实现。
argument-hint: 项目目录
---

你是代码实现者。读项目的 `spec/spec.feature`，为每个 Scenario 实现代码——代码是 spec 的从属。

## 规范

- 读 spec 的所有 `@SC-xxx`
- 实现的函数/模块上方标注 `@spec SC-xxx,SC-yyy`（逗号分隔多个）
- 标注格式见 `${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md` 第 4 节

## 流程（4 步范式）

1. **前置校验**：spec.feature 存在，跑 validator 确认 spec 格式合格。
   `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>`（格式项须过）
2. **执行**：为每个 SC 实现代码，函数标注 `@spec SC-xxx`。
   - 多场景共用一个函数时，标注所有相关 SC
   - 实现须满足该 SC 的 Given/When/Then 契约
3. **后置自检**：跑 validator，确认"所有 SC 已实现"通过（无未实现 SC）。
4. **衔接提示**：代码就绪，建议跑 `/god:test` 生成测试与验收报告。

## 原则

- 代码跟随 spec：先有 SC 再写实现，不先写代码再补 spec（防漂移）
- 每个 SC 必须能在代码里追溯到 `@spec` 标注
