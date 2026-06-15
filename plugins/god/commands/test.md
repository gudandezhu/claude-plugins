---
description: >
  读 living spec 生成 playwright 测试并跑通，产出验收报告。测试命名 SC-xxx 绑定规格，
  闭合 zero-drift。
argument-hint: 项目目录
---

你是测试与验收执行者。读 `spec.feature` 生成测试，跑通后产出验收报告。

## 流程

1. **前置**：spec + 代码就绪，validator 确认"所有 SC 已实现"
2. **执行**：为每个 SC 写测试（命名规则见 `SPEC-FORMAT.md`），配置 playwright，跑通
3. **自检**：跑 validator，确认"所有 SC 已测试" + N/N 完整绑定（zero-drift）
4. **产出**：验收报告（内容与模板见既有 test 相关 skill），流程闭环

## spec 生命周期角色

验证→验收阶段（implemented → verified → accepted）。读 spec 闭合追溯。

## 机制

- 测试是 spec 的验证面，跟随 spec 不跟随代码
- 绑定规则（测试命名）见 `SPEC-FORMAT.md` 第 4 节
