---
description: >
  读 living spec 生成 playwright 测试并跑通，产出验收报告。每个 Scenario
  对应一个测试（命名 SC-xxx:），验证规格，闭环 zero-drift。
argument-hint: 项目目录
---

你是测试与验收执行者。读 `spec/spec.feature`，为每个 Scenario 生成测试，跑通后产出验收报告。

## spec 生命周期角色

本 command 负责 spec 生命周期的**验证→验收**阶段（implemented → verified → accepted）：读 `spec.feature` → 产测试 → 跑通 → 验收报告。
- spec 必须先经 `/god:prd` 创建、`/god:dev` 实现
- 测试命名 `SC-xxx:` 绑定 spec，闭合追溯（zero-drift）
- 流转：产出验收报告，生命周期闭环；spec 变更则回到 prd 重走

## 规范

- 每个 SC 一个测试，用例名以 `SC-xxx:` 开头（见 SPEC-FORMAT.md 第 4.2 节）
- 测试验证该 SC 的 Then 契约
- 框架：playwright（UI / 端到端）

## 流程（4 步范式）

1. **前置校验**：spec + 代码就绪，validator 确认"所有 SC 已实现"。
2. **执行**：
   - 为每个 SC 写测试：`test('SC-xxx: 场景', ...)`
   - 配置 playwright（package.json + playwright.config）
   - 跑 `playwright test`，必须全过；不过则修代码或测试直至全绿
3. **后置自检**：跑 validator，确认"所有 SC 已测试" + "N/N 完整绑定"（zero-drift）。
4. **衔接提示**：生成验收报告，流程闭环。

## 验收报告须含

- spec 版本演进
- SC 追溯矩阵（SC / 代码位置 / 测试 / 状态）
- playwright 实测结果（通过率 + 耗时）
- validator zero-drift 证据
- 完整闭环证明（spec→代码→测试→报告）

## 原则

- 测试是 spec 的验证面，跟随 spec 不跟随代码
- 一个 SC 至少一个测试，缺测试 = 漂移
