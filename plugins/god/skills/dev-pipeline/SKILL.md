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

> 读 `spec.feature` 实现代码，**代码是 spec 的从属**。prd 一条龙模式下由 prd skill 阶段 4 自动加载；显式触发保留 `/god:dev` 向后兼容。

## 调用契约

**调用方**：主 agent（prd skill 阶段 4）派 `dev` subagent
**主 agent 干**：跑阶段 0 自检、读 subagent 结果、弹 S2 签字
**dev subagent 干**：跑阶段 1 写代码 + 跑阶段 2 自检（**N SC 一次跑完**）
**subagent 不能做**：弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 spec.state.meta.json
**subagent 完事回主 agent**，主 agent 跑 dev-gen.js 二次校验 + 弹 S2

## 阶段 0：环境 + 状态机自检（主 agent 跑 L3 脚本）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-lint.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目>  # phase 应为 reviewed
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js check <项目>
```

判断：
- `phase: reviewed` + 全过 → 派 dev subagent
- `phase: drafted` → 跑 `spec-cli advance`（前提：C5 锚点齐）
- `phase: implemented/verified/accepted` → 跳过本流水线
- 校验失败 → 回 prd 阶段 1/2 修

## 阶段 1：代码骨架 + 实现（派 dev subagent）

主 agent 派 `dev` subagent（worktree 隔离）：

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/dev-gen.js <项目> [--force]
# 读 spec/domains/D-XXX/spec.feature → 写 src/D-XXX/<feature>.{js,ts}
# 每个 SC 一个 export function（含 JSDoc @spec SC-xxx + TODO + GWT）
```

**subagent 任务清单**：
1. **读 `spec/architecture/tech.md`**（技术架构——服务划分、API 契约、DB schema、通信方式）
2. 读 `spec/domains/D-XXX/spec.feature`（按业务域拆分的 spec）
3. 跑 dev-gen.js 生成代码骨架（按 D-XXX 目录组织 `src/D-XXX/`）
4. 在骨架上实现所有未完成 SC（**一次跑完 N SC**）
5. 跑 spec-validate.js 校验 @spec 标注
6. 跑 dev 子测试（vitest 跑通已实现 SC）
7. **同步 `spec/architecture/tech.md`**（如果 dev 发现 tech.md 过期——API 实际是 X 不是 Y、DB schema 改了——必须更新）
8. 写 `spec/implemented-dev-status.md` 状态摘要
9. 完事回主 agent

**主 agent 收尾**：读 subagent 报告 + 跑 spec-validate.js 二次校验 + 验证 tech.md 已同步。

## 阶段 2：自检（3 步）

```bash
# 2a 机械校验（主 agent 跑）
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>

# 2b 状态机推进（主 agent 跑）
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js advance <项目>
# reviewed → implemented

# 2c summary 重产（主 agent 跑）
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目>
```

不通过 → 派 fixer subagent 修（按 validator 报错定位），不通过超过 3 次回主 agent 问 OPC。

## 阶段 3：S2 签字 Gate（主 agent 弹签）

加载 `sign-gate` skill，弹 S2 签字（详见 sign-gate/SKILL.md）。

**关键**：
- S2 拒签时归因（spec 错 → 回 prd + MAJOR bump；实现错 → 派 dev subagent 修）
- **4 选项**：通过+继续 / 通过+结束本会话 / spec 错 / 实现错

## 衔接

S2 通过 → 加载 `test-pipeline` skill（prd 一条龙模式下自动）。

## 多会话接续

> **subagent 跑不完 N SC** 是 subagent 自己的事——subagent 写 `spec/implemented-dev-status.md` 断点，主 agent 不知道也不该知道细节。

| 触发 | 处理者 | 动作 |
|---|---|---|
| dev subagent 跑不完 N SC | subagent 内部 | 写 `spec/implemented-dev-status.md`（已做 N SC + 剩余 M SC + 端到端验证）→ 退出 |
| OPC 说"结束会话" | 主 agent | 跑 session-end hook 写 `spec/<phase>-checkpoint.md` |
| 下一会话启动 | 主 agent | 读 phase + checkpoint → 重新派 dev subagent → subagent 读 status 续跑 |

**禁止**：

- ❌ 主 agent 写代码 / 跑测试
- ❌ subagent 弹签 / 派 subagent
- ❌ 主 agent 主动建议"下一会话跑 /god:dev --scope IT-01"
- ❌ subagent 把"OPC 注意力预算"当成"该退出"（由 OPC 主动说）
- ❌ dev subagent 跑崩后立刻退出（先内部修 3 次，第 4 次再回主 agent 问 OPC）

## 禁止

- ❌ 跳过阶段 0 自检（环境有问题硬写代码 = 把 bug 推进 implemented）
- ❌ 实现完不跑 spec-cli advance（phase 卡 reviewed = test 跑不动）
- ❌ 改 spec.feature（在 dev 阶段改 spec = 绕过 prd = 漂移）
- ❌ 跳过 sign-gate 直接进 test
- ❌ 用 `git commit --no-verify` 跳过 hooks 不写 trace（救命场景可但必留痕）
- ❌ 主 agent 写代码（主 agent 只编排）

## 机制

- **代码跟随 spec**：先有 SC 再实现（防漂移铁律 #1）
- **状态机由 spec-cli 守**：phase 不可跳
- **hooks 自动守门**（G3）：git commit 时跑 spec-cli check + spec-validate.js
- **dev-gen phase 前置校验**（G17 RFC-0013）：phase ≠ reviewed/implemented/verified 拒绝
- **subagent 物理隔离**：dev subagent 独立 session 跑 N SC，主 agent 不知道 SC 细节
- 绑定规则（`@spec` 标注格式）见 `spec/SPEC-FORMAT.md §4`
