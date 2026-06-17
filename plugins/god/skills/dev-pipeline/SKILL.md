---
status: stable
name: dev-pipeline
user-invocable: false
description: |
  dev 阶段流水线。**主 agent 派 dev subagent 跑 N SC**——主 agent 不写代码，只编排。
  末尾加载 sign-gate skill 弹 S2（放行测试）。prd 全自动跑完后由 prd skill 加载。
  触发：prd S1 签字后 / 用户显式 /god:dev（向后兼容）。
---

# Dev Pipeline

> 读 `spec.feature` 实现代码,**代码是 spec 的从属**。prd 一条龙模式下由 prd skill 阶段 4 自动加载;显式触发保留 `/god:dev` 向后兼容。

## 调用契约

**主 agent 干**:跑阶段 0 自检 + 读 subagent 结果 + 弹 S2
**dev subagent 干**:跑阶段 1 写代码 + 阶段 2 自检(N SC 一次跑完)
**subagent 禁**:弹签 / 派 subagent / 改 meta.json

## 阶段 0：环境 + 状态机自检

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-lint.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目>  # phase = reviewed
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js check <项目>
```

`reviewed` + 全过 → 派 subagent;`drafted` → 跑 `spec-cli advance`(需 C5 锚点齐);其他阶段跳过;校验失败 → 回 prd 修。

## 阶段 1：代码骨架 + 实现（派 subagent）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/dev-gen.js <项目> [--force]
# 读 spec/domains/D-XXX/spec.feature → 写 src/D-XXX/<feature>.{js,ts}
# 每个 SC 一个 export function(含 JSDoc @spec SC-xxx + TODO + GWT)
```

subagent 任务:1. 读 `tech.md`(服务/API/DB) 2. 读 `spec.feature`(按 D-XXX) 3. 跑 dev-gen.js 4. 实现 N SC 5. 跑 spec-validate 6. 跑 vitest 7. **同步 tech.md**(dev 发现过期必须更新) 8. 写 `spec/implemented-dev-status.md` 9. 回主 agent。

## 阶段 2：自检（3 步）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>  # 2a
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js advance <项目>  # 2b: reviewed→implemented
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目>  # 2c
```

不通过 → 派 fixer subagent 修(>3 次回 OPC)。

## 阶段 3：S2 签字

加载 `sign-gate` skill,弹 S2。**4 选项**:通过+继续 / 通过+结束本会话 / spec 错 / 实现错(spec 错 → 回 prd + MAJOR bump)。

## 衔接 + 多会话

S2 通过 → 加载 `test-pipeline` skill。

`subagent 跑不完 N SC` → subagent 写 `spec/implemented-dev-status.md` 断点 → 下一会话主 agent 读 phase+checkpoint 续派。`OPC 说"结束会话"` → session-end hook 写 `<phase>-checkpoint.md`。

**禁止**:主 agent 写代码;subagent 弹签/派 subagent;subagent 跑崩后立刻退出(先内部修 3 次,第 4 次回 OPC);跳过阶段 0/状态机/sign-gate;在 dev 阶段改 spec.feature。

## 机制

- 代码跟随 spec(防漂移铁律 #1)
- 状态机由 spec-cli 守(phase 不可跳)
- hooks 自动守门(G3):git commit 跑 spec-cli check + spec-validate
- dev-gen phase 前置校验(G17):phase ≠ reviewed/implemented/verified 拒绝
- subagent 物理隔离(独立 session 跑 N SC)
- 绑定规则(`@spec` 标注)见 `spec/SPEC-FORMAT.md §4`
