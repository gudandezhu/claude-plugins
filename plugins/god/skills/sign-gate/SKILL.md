---
status: stable
name: sign-gate
user-invocable: false
description: |
  S1/S2/S3 3 个签字 Gate 统一封装。加载 sign-gate 脚本 + ask-user skill，
  任何 dev / test / accept 启动前必经。命令层 / 其他 skill 不允许直接拼签字选项。
  触发：prd 阶段 3 末尾（放行开发）/ dev-pipeline 末尾（放行测试）/ test-pipeline 末尾（验收）。
---

# Sign Gate（S1/S2/S3 统一封装）

> god 流水线的 3 个硬 Gate。**加载本 skill 后，签字由 sign-gate.js 脚本兜底，AskUserQuestion 选项由 ask-user skill 封装**。

## 三 Gate 时机

| Gate | 触发 | OPC 决策项 | 拒签回退 |
|---|---|---|---|
| **S1** | prd 阶段 3 末尾 | 通过 / 改需求 / 撤回 | 回 prd 阶段 1/2 |
| **S2** | dev-pipeline 末尾 | 通过 / spec 错（回 prd） / 实现错（回 dev） | 见拒签归因 |
| **S3** | test-pipeline 末尾 | 通过 / 退回 / 部分通过 | 回 dev（实现错） / 回 prd（spec 错） |

## 加载流程

1. **加载 `ask-user` skill**（封装 AskUserQuestion）
2. **跑 `node spec/scripts/sign-gate.js <项目>`** — 确认当前可签 gate（status 是默认模式，不需子命令）
3. **跑前置校验**（脚本已自动跑，不重做）：
   - S1：spec-readiness.js（7 项指标）
   - S2：spec-validate.js（#7 SC 标注）
   - S3：spec-validate.js（#8 SC 测试）
4. **展示当前状态**（短）：阶段 + 前置校验结果 + 推 phase 后会到哪
5. **调 ask-user 弹 1 次选项**：
   ```
   header: "S1 签字"
   question: "Prd 阶段 3 已就绪（spec-readiness 6/6 硬过 + 1/1 软免责），是否放行开发？"
   options:
     - 通过：phase reviewed → implemented
     - 改需求：保留 phase reviewed（prd 阶段内部处置）
     - 撤回：回 prd 阶段 1 重新 brainstorm
   ```
6. **调 `node sign-gate.js <项目> --gate S1 --verdict accept` 或 `reject --reason "..."`**
7. **回显结果**（短）：锚点 + phase 推进/回退

## 拒签归因（S2 / S3）

S2/S3 拒签时**必问 OPC**归因，不能 AI 自己脑补：

```
header: "拒签归因"
question: "拒签原因是？(test 失败 = 先查 spec 再查代码，spec 是真相源)"
options:
  - spec 错：回 prd 阶段 1 + @spec-version MAJOR bump
  - 实现错：回 dev-pipeline
  - 我不确定：AI 默认按"先查 spec"处理
```

## 锚点格式（spec/sources.md）

```
- **S1 Prd 出口签字** (2026-06-17 14:30 / accept / spec-readiness:6/6 + 1 软免责)
- **S2 Dev 出口签字** (2026-06-17 14:55 / accept / @spec SC-001~005 标注)
- **S3 Test 出口签字** (2026-06-17 15:10 / accept / 5/5 SC 测过 / L0 30 min)
```

## 禁止

- ❌ 跳过 sign-gate 直接启动 dev / test
- ❌ 在 command / 其他 skill 里直接拼 S1/S2/S3 的 AskUserQuestion
- ❌ 拒签不归因直接退回
- ❌ S2/S3 拒签时 AI 自己脑补"是 spec 错还是实现错"
- ❌ S1 软失败免责时缺 `--soft-ack` 锚点

## 跟其他 skill 的关系

- `prd` skill：阶段 3 末尾加载本 skill 弹 S1
- `dev-pipeline` skill：末尾加载本 skill 弹 S2
- `test-pipeline` skill：末尾加载本 skill 弹 S3
- `ask-user` skill：所有 AskUserQuestion 选项由它封装
