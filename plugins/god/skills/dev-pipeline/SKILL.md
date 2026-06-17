---
status: stable
name: dev-pipeline
user-invocable: false
description: |
  dev 阶段流水线。读 spec.feature → 写代码 + @spec 标注 + 跑 spec-validate。
  末尾加载 sign-gate skill 弹 S2（放行测试）。prd 全自动跑完后由 prd skill 加载。
  触发：prd S1 签字后 / 用户显式 /god:dev（向后兼容）。
---

# Dev Pipeline

> 读 `spec.feature` 实现代码，**代码是 spec 的从属**。prd 一条龙模式下由 prd skill 阶段 4 自动加载；显式触发保留 `/god:dev` 向后兼容。

## 阶段 0：环境 + 状态机自检

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-lint.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目>  # phase 应为 reviewed
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js check <项目>
```

判断：
- `phase: reviewed` + 全过 → 进阶段 1
- `phase: drafted` → 跑 `spec-cli advance`（前提：C5 锚点齐）
- `phase: implemented/verified/accepted` → 跳过本流水线
- 校验失败 → 回 prd 阶段 1/2 修

## 阶段 1：代码骨架 + 实现

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/dev-gen.js <项目> [--force]
# 读 spec/spec.feature → 写 src/<feature>.{js,ts}
# 每个 SC 一个 export function（含 JSDoc @spec SC-xxx + TODO + GWT）
```

AI 在骨架上改**消解重复劳动**。

## 阶段 2：自检（3 步）

```bash
# 2a 机械校验
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>

# 2b 状态机推进
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js advance <项目>
# reviewed → implemented

# 2c summary 重产
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目>
```

不通过 → 回阶段 1 修（按 validator 报错定位）。

## 阶段 3：S2 签字 Gate

加载 `sign-gate` skill，弹 S2 签字（详见 sign-gate/SKILL.md）。

**关键**：S2 拒签时归因（spec 错 → 回 prd + MAJOR bump；实现错 → 回阶段 1）。

## 衔接

S2 通过 → 加载 `test-pipeline` skill（prd 一条龙模式下自动）。

## 禁止

- ❌ 跳过阶段 0 自检（环境有问题硬写代码 = 把 bug 推进 implemented）
- ❌ 实现完不跑 spec-cli advance（phase 卡 reviewed = test 跑不动）
- ❌ 改 spec.feature（在 dev 阶段改 spec = 绕过 prd = 漂移）
- ❌ 跳过 sign-gate 直接进 test
- ❌ 用 `git commit --no-verify` 跳过 hooks 不写 trace（救命场景可但必留痕）

## 机制

- **代码跟随 spec**：先有 SC 再实现（防漂移铁律 #1）
- **状态机由 spec-cli 守**：phase 不可跳
- **hooks 自动守门**（G3）：git commit 时跑 spec-cli check + spec-validate.js
- **dev-gen phase 前置校验**（G17 RFC-0013）：phase ≠ reviewed/implemented/verified 拒绝
- 绑定规则（`@spec` 标注格式）见 `spec/SPEC-FORMAT.md §4`
