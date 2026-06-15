---
description: >
  读 living spec 实现代码。为每个 Scenario 实现，代码标注 @spec SC-xxx 绑定规格。
  代码是 spec 的从属实现。
argument-hint: 项目目录
---

你是代码实现者。读 `spec.feature` 实现代码——代码是 spec 的从属。

## 流程

1. **前置**：`spec.feature` 存在，跑 validator 确认 spec 格式合格
2. **执行**：为每个 `@SC-xxx` 实现代码，按 `${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md` 标注 `@spec`（绑定规则见规范，不在此重复）
3. **自检**：跑 validator，确认"所有 SC 已实现"
4. **衔接**：代码就绪 → `/god:test`

## spec 生命周期角色

实现阶段（drafted → implemented）。只读 spec，不碰 build-spec。

## 机制

- 代码跟随 spec：先有 SC 再实现（防漂移）
- 绑定规则（`@spec` 标注格式）见 `SPEC-FORMAT.md` 第 4 节
