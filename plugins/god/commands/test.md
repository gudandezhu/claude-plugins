---
description: >
  读 living spec 生成 playwright 测试并跑通，产出验收报告。测试命名 SC-xxx 绑定规格，
  闭合 zero-drift。
argument-hint: 项目目录
---

你是测试与验收执行者。读 `spec.feature` 生成测试，跑通后产出验收报告。

## 流程

1. **前置**：spec + 代码就绪，validator 确认"所有 SC 已实现"
2. **执行**：G6 test-gen（v0.4.0+ P1 已落）出测试桩，AI 在桩上写实现：
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/test-gen.js <项目目录> [--force] [--framework vitest|jest]
   # 读 spec/spec.feature → 写 tests/<feature-slug>.spec.<ts|js>
   # 每个 SC 一个 it('SC-XXX: <name>', ...) 桩
   # @sad-path 用 it.todo（强提示 AI 必填）
   ```
   AI 在桩上写真实断言（如 `expect(score(3)).toBeGreaterThanOrEqual(80)`）
3. **自检**：跑 validator，确认"所有 SC 已测试" + N/N 完整绑定（zero-drift）
4. **产出**：验收报告（内容与模板见既有 test 相关 skill），流程闭环
5. **S1 出口 spec-cli advance**（v0.4.0 起，G1 P0）：
   - 跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目目录>` 重新产出 summary.md
   - 跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js check <项目目录>` 校验 4 项
   - 跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js check <项目目录>` 校验状态机合法性
   - 3 项全过后，**S1 签字前**自动跑 `spec-cli advance` 把 phase 推到 `accepted`
   - 任一失败 → S1 不能签字，回退修复
6. **OPC 看 summary.md 签字**（不直接打开 spec.feature）—— 详见 [RFC-0002 spec-summary](../docs/rfcs/0002-spec-summary.md)
7. **S1 出口 OPC 成本归因**（v0.4.0 起，D5 P1）：
   - 跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/measure-opc-cost.js <项目目录> --json` 自动算 5 维归因
   - 把归因结果写入验收报告 "OPC 介入成本" 段
   - 标 L0/L1/L2/L3 档位 + 预算是否在内
   - 详见 [RFC-0005 OPC 预算分级](../docs/rfcs/0005-opc-cost-tiered.md) + [ADR-0005](../docs/adrs/0005-opc-cost-tiered.md)

## spec 生命周期角色

验证→验收阶段（implemented → verified → accepted）。读 spec 闭合追溯。

## 机制

- 测试是 spec 的验证面，跟随 spec 不跟随代码
- 绑定规则（测试命名）见 `SPEC-FORMAT.md` 第 4 节
