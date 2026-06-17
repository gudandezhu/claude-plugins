---
status: stable
name: test-pipeline
user-invocable: false
description: |
  test 阶段流水线。读 spec.feature → 生成 playwright 测试 + 跑通 + 验收报告。
  末尾加载 sign-gate skill 弹 S3（验收）。prd 一条龙模式下由 prd skill 阶段 5 自动加载。
  触发：dev S2 签字后 / 用户显式 /god:test（向后兼容）。
---

# Test Pipeline

> 读 `spec.feature` 生成测试，跑通后产出验收报告。prd 一条龙模式下由 prd skill 阶段 5 自动加载；显式触发保留 `/god:test` 向后兼容。

## 阶段 1：前置检查

```bash
# spec + 代码就绪
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目>
# phase 应为 implemented
```

## 阶段 2：测试桩 + 实现

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/test-gen.js <项目> [--force] [--framework vitest|jest]
# 读 spec/spec.feature → 写 tests/<feature-slug>.spec.{ts,js}
# 每个 SC 一个 it('SC-XXX: <name>', ...) 桩
# @sad-path 用 it.todo（强提示 AI 必填）
```

AI 在桩上写真实断言（如 `expect(score(3)).toBeGreaterThanOrEqual(80)`）。

## 阶段 3：自检

```bash
# 跑测试 + 校验绑定
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目> --phase=verified
# 0 FAIL 即过
```

## 阶段 4：S3 签字 Gate（验收）

加载 `sign-gate` skill，弹 S3 签字（详见 sign-gate/SKILL.md）。

**AI 准备产物**：
- 追溯矩阵（SC-xxx → 代码:path:L# / 测试:path:testName）
- 覆盖率（N/N 已实现 + N/N 已测试 + 0 漂移）
- 测试报告（playwright/单测跑通日志 + 截图）
- 遗留问题（已知未覆盖 / 已知非阻断）

**S3 选项**：
- 通过：phase verified → accepted + 触发 measure-opc-cost
- 退回（实现错）：回 dev-pipeline
- 退回（spec 错）：回 prd + MAJOR bump
- 部分通过：标记 accepted-partial

## 阶段 5：OPC 成本归因

S3 accept 后自动跑（sign-gate.js 内置）：

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/measure-opc-cost.js <项目> --json
# 把 5 维归因 + 档位（L0/L1/L2/L3）写入验收报告
```

## 机制

- 测试是 spec 的验证面，跟随 spec 不跟随代码
- 测试命名 `SC-xxx:` 绑定（spec-validate #8 校验）
- S3 拒签归因由 sign-gate skill 强制问 OPC
- 绑定规则见 `spec/SPEC-FORMAT.md §4`

## 禁止

- ❌ 跳过 sign-gate 直接标记 accepted
- ❌ 改 spec.feature（在 test 阶段改 spec = 绕过 prd = 漂移）
- ❌ 测试用 fixture 跳过失败用例（违反 OPC 验收契约）
- ❌ 拒签不归因直接退回
