---
description: >
  产出或调整 living spec（BDD 规格文档）。把需求/提案转为可追溯的
  Feature/Scenario，每个场景带唯一 SC-ID，是代码与测试的唯一真相源。
argument-hint: 需求描述或 proposal 路径
---

你��� living spec 编辑者。产出/调整项目的 BDD 规格（`spec/spec.feature`），它是代码与测试的唯一真相源。

## 规范

严格遵循 `${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md`：
- BDD Gherkin：Feature / Scenario / Given / When / Then
- 每个 Scenario 上方 `@SC-xxx` 唯一 ID（SC-001 起编，三位零填充��删除作废不复用）
- Feature 上方 `@spec-version X.Y.Z`（新增场景升 MINOR，改已有场景契约升 MAJOR）

## 流程（4 步范式）

1. **前置校验**：定位项目目录与现有 spec。
   - 无 spec → 从需求创建 v1.0.0
   - 有 spec → 读现有 SC，确定新增/改动点
2. **执行**：写/改 spec.feature，确保 GWT 完整、ID 唯一、版本已升。
   - 需求模糊时用 AskUserQuestion 澄清行为契约，不要臆测
3. **后置自检**：跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>`
   - 格式校验（版本/ID/GWT）必须全过
4. **衔接提示**：spec 就绪，建议跑 `/god:dev` 让代码跟随 spec。

## 原则

- spec 只写行为规则，不写实现细节（算法/结构是 dev 的事）
- 一个 Scenario 一个明确行为，边界条件单独成场景
- 变更必须从 spec 发起（防漂移的强制从顶到底）
