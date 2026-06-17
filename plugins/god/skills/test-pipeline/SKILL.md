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

> 读 `spec.feature` 生成测试 + 跑测试,**测试是 spec 的从属**。prd 一条龙模式下由 prd skill 阶段 5 自动加载;显式触发保留 `/god:test` 向后兼容。

## 调用契约

**主 agent 干**:跑阶段 0 自检 + 读 subagent 结果 + 弹 S3
**test subagent 干**:写测试 + 跑测试(N SC 一次跑完)
**subagent 禁**:弹签 / 派 subagent / 改 meta.json

## 阶段 0：环境 + 状态机自检

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-lint.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目>  # phase = implemented
```

`implemented` + 全过 → 派 subagent;`verified/accepted` → 跳过;校验失败 → 回 prd 修。

## 阶段 1：测试生成 + 运行（派 subagent）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/test-gen.js <项目>
# 读 spec.feature → 写 tests/<feature>.test.{js,ts}
# 每个 SC 一个 describe/it 块(命名 `SC-xxx:`)
```

subagent 任务:1. 跑 test-gen.js 2. 完善测试(N SC) 3. 跑 vitest 4. 写 `spec/verified-test-status.md`(通过 N/失败 M/跳过 K) 5. 回主 agent。

## 阶段 2：自检（3 步）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>  # 2a
npx vitest run --coverage                                        # 2b
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目>  # 2c
```

不通过 → 派 fixer subagent 修(>3 次回 OPC)。

## 阶段 3：S3 签字

加载 `sign-gate` skill,弹 S3。**4 选项**:通过+继续 / 通过+结束本会话 / 退回 / 部分通过(spec 错 → 回 prd + MAJOR bump)。

S3 通过 → 跑 `measure-opc-cost.js` 写 ACCEPTANCE.md。

## 衔接 + 多会话

`subagent 跑不完 N SC` → subagent 写 `spec/verified-test-status.md` 断点 → 下一会话主 agent 读 phase+checkpoint 续派。`OPC 说"结束会话"` → session-end hook 写 `<phase>-checkpoint.md`。

**禁止**:主 agent 跑测试;subagent 弹签/派 subagent;subagent 跑崩后立刻退出(先内部修 3 次,第 4 次回 OPC);跳过阶段 0/状态机/sign-gate;在 test 阶段改 spec.feature。

## 机制

- 测试跟随 spec(防漂移铁律 #1)
- 状态机由 spec-cli 守(phase 不可跳)
- hooks 自动守门(G3)
- test-gen phase 前置校验:phase ≠ implemented 拒绝
- subagent 物理隔离(独立 session 跑 N SC)
- 绑定规则(`SC-xxx:` 命名)见 `spec/SPEC-FORMAT.md §4`
