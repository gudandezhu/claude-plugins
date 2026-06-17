---
status: stable
name: test-pipeline
user-invocable: false
description: |
  test 阶段流水线。**主 agent 派 test subagent 跑 N SC 测试**——主 agent 不跑测试，只编排。
  末尾加载 sign-gate skill 弹 S3（验收）。prd 全自动跑完后由 prd skill 加载。
  触发：prd S2 签字后 / 用户显式 /god:test（向后兼容）。
---

# Test Pipeline

> 读 `spec.feature` 生成测试 + 跑测试，**测试是 spec 的从属**。prd 一条龙模式下由 prd skill 阶段 5 自动加载；显式触发保留 `/god:test` 向后兼容。

## 调用契约

**调用方**：主 agent（prd skill 阶段 5）派 `test` subagent
**主 agent 干**：跑阶段 0 自检、读 subagent 结果、弹 S3 签字
**test subagent 干**：跑阶段 1 写测试 + 跑阶段 2 跑测试（**N SC 一次跑完**）
**subagent 不能做**：弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 spec.state.meta.json
**subagent 完事回主 agent**，主 agent 跑 test-gen.js 二次校验 + 弹 S3

## 阶段 0：环境 + 状态机自检（主 agent 跑 L3 脚本）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-lint.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目>  # phase 应为 implemented
```

判断：
- `phase: implemented` + 全过 → 派 test subagent
- `phase: verified/accepted` → 跳过本流水线
- 校验失败 → 回 prd 阶段 1/2 修

## 阶段 1：测试生成 + 运行（派 test subagent）

主 agent 派 `test` subagent（worktree 隔离）：

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/test-gen.js <项目>
# 读 spec/spec.feature → 写 tests/<feature>.test.{js,ts}
# 每个 SC 一个 describe/it 块（命名 `SC-xxx:`）
```

**subagent 任务清单**：
1. 跑 test-gen.js 生成测试桩
2. 完善测试用例（**一次跑完 N SC 测试**）
3. 跑 vitest 全部测试
4. 写 `spec/verified-test-status.md` 状态摘要（通过 N / 失败 M / 跳过 K）
5. 完事回主 agent

**主 agent 收尾**：读 subagent 报告 + 跑 spec-validate.js 二次校验。

## 阶段 2：自检（3 步）

```bash
# 2a 机械校验（主 agent 跑）
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>

# 2b 测试覆盖率（主 agent 跑）
npx vitest run --coverage  # 验 spec.feature 的 SC 全有对应测试

# 2c summary 重产（主 agent 跑）
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目>
```

不通过 → 派 fixer subagent 修（按测试失败定位），不通过超过 3 次回主 agent 问 OPC。

## 阶段 3：S3 签字 Gate（主 agent 弹签）

加载 `sign-gate` skill，弹 S3 签字（详见 sign-gate/SKILL.md）。

**关键**：
- S3 拒签时归因（spec 错 → 回 prd + MAJOR bump；实现错 → 派 dev subagent 修）
- **4 选项**：通过+继续 / 通过+结束本会话 / 退回 / 部分通过

## 衔接

S3 通过 → 跑 `measure-opc-cost.js` 写 ACCEPTANCE.md。

## 多会话接续

> **subagent 跑不完 N SC 测试** 是 subagent 自己的事——subagent 写 `spec/verified-test-status.md` 断点。

| 触发 | 处理者 | 动作 |
|---|---|---|
| test subagent 跑不完 N SC 测试 | subagent 内部 | 写 `spec/verified-test-status.md`（通过 N / 失败 M / 剩余 K）→ 退出 |
| OPC 说"结束会话" | 主 agent | 跑 session-end hook 写 `spec/<phase>-checkpoint.md` |
| 下一会话启动 | 主 agent | 读 phase + checkpoint → 重新派 test subagent → subagent 读 status 续跑 |

**禁止**：

- ❌ 主 agent 跑测试
- ❌ subagent 弹签 / 派 subagent
- ❌ 主 agent 主动建议"下一会话跑 /god:test"
- ❌ subagent 把"OPC 注意力预算"当成"该退出"（由 OPC 主动说）

## 禁止

- ❌ 跳过阶段 0 自检
- ❌ 跳过 sign-gate 直接进 S3 验收
- ❌ 改 spec.feature（在 test 阶段改 spec = 绕过 prd = 漂移）
- ❌ 主 agent 跑测试

## 机制

- **测试跟随 spec**：先有 SC 再测试（防漂移铁律 #1）
- **状态机由 spec-cli 守**：phase 不可跳
- **hooks 自动守门**（G3）
- **test-gen phase 前置校验**：phase ≠ implemented 拒绝
- **subagent 物理隔离**：test subagent 独立 session 跑 N SC，主 agent 不知道测试细节
- 绑定规则（`SC-xxx:` 命名格式）见 `spec/SPEC-FORMAT.md §4`
