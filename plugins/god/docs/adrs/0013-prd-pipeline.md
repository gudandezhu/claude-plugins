# ADR-0013: prd 一条龙 + 3 签字 Gate + 命令路由化

> **状态**：✅ 已采纳（v0.7.0）
> **作者**：god 架构组
> **前身 RFC**：[`docs/rfcs/0013-prd-pipeline.md`](../rfcs/0013-prd-pipeline.md)
> **关联 3 视角**：[`01-ops-runbook.md §2 D1`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §4-5`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §3`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md` §3 G15 / G16 / G17](../roadmap.md)
> **替代**：[`commands/prd.md`](../../commands/prd.md) 167 行 SOP + [`commands/dev.md`](../../commands/dev.md) + [`commands/test.md`](../../commands/test.md) + [`docs/human-ai-contract.md`](../human-ai-contract.md) 6 介入点

---

## 1. 背景

god 插件 v0.4.0~v0.6.0 闭环了开发期 + 维护期机制，但**命令层积累的复杂度**已经反向侵蚀产品目标：

### 1.1 三个真实痛点（perspectives 演练一致）

| 痛点 | 现状 | 数据 |
|---|---|---|
| **AI 注意力稀释** | `commands/prd.md` 167 行 + 4 个 gate + N 个阶段细节；AI 一打开就被淹没，跳读细节概率高 | 实测：AI 在长命令下"跳过阶段 0 直接进 build-spec"概率 ≥ 30% |
| **绕过 prd 直接开发** | 用户说"差不多就行" / "先跑起来再补"时，AI 没有硬拦截，可能直接调 dev-gen | 3 份 perspectives 一致报：缺"清晰度可机器测"指标 |
| **中间无签字，返工 10x** | dev → test 无签字直接走，test S1 拒签时已写完代码 + 测试 = 推翻成本 10× | OPC 真实试跑 75 min（含 F-02 修复 60 + S1 翻脸 15）|

### 1.2 架构层 bug

CLAUDE.md §2 把 commands 定义为"编排层"，但 dev.md / test.md 干的是 L1+L3 的事（跑脚本 + AI 写代码），既不是"人驱动的编排入口"，也没真正"派遣 subagent"。**架构和实现对不上**。

| 层 | CLAUDE.md §2 承诺 | dev.md / test.md 实际 |
|---|---|---|
| L1 commands | 编排，subagent 派遣 | 跑脚本 + AI 自写代码 + 6 步 SOP |
| L3 scripts | 机械工具 | 跑 spec-cli + spec-validate + dev-gen + test-gen |

**dev.md 和 test.md 本质是 L3 SOP，不该是 L1 命令**。

### 1.3 6 介入点过多

[`docs/human-ai-contract.md`](../human-ai-contract.md) 定义 6 个必介入点（C1/C2/C3/C4/P1/S1 + 条件 C6），OPC 简单档 4-5 次、复杂档 6-10 次、上限 12 次。**超 12 次 = 流程没走通**——但 6 个 gate 本身已是 OPC 注意力预算的主要消耗。

CLAUDE.md §1.1 第 3 条核心目标：

> OPC 介入总时长 < 30 分钟 / feature，**god 自动跑完 prd→dev→test**，OPC 只在 C1 入口 + 验收出口

现状的 6 介入点 ≠ "C1 入口 + 验收出口"。**OPC 注意力预算和产品目标不对齐**。

---

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 命令层 ≤ 30 行 / 个 | `wc -l commands/*.md` 全 ≤ 30 |
| 2 | 命令层 = 路由表，不含 SOP | 4 关键词 grep："加载" / "跑" / "用" / "如果" — dev/test command 文件中每个 ≤ 1 次 |
| 3 | 清晰度可机器测 | `spec-readiness.js` 6 项硬指标 + 1 项软指标；不通过则 dev-pipeline 启动 exit 1 |
| 4 | 3 个签字 Gate | S1（prd→dev 中间）/ S2（dev→test 中间）/ S3（test→accepted 中间）；每个 = 1 次 AskUserQuestion |
| 5 | dev/test 命令取消 | `commands/dev.md` + `commands/test.md` 删除；逻辑迁�� `skills/dev-pipeline` + `skills/test-pipeline` |
| 6 | 拒签自动回退 | S1 拒绝 → 自动回 prd 阶段 1/2；S2 拒绝 → 自动回 prd（spec 错）/ dev（实现错）；S3 拒绝 → 自动回 dev |
| 7 | 三道闸防绕过 | 命令层（决策树）/ 脚本层（spec-cli phase 前置校验）/ hook 层（pre-commit spec-validate）|

---

## 3. 详细设计

### 3.1 命令层 v3 形态（≤ 30 行 / 个）

**原则**：command = 路由表。所有方法论下沉到 skill，所有 SOP 下沉到 script。

**统一格式**：

```markdown
---
description: <一句话，谁触发，做什么>      ← 用户唯一看的元信息
---

你是<角色>。<1 句定位>。

**遇 gate 必停下，让用户选**。

不要解释方法论（skill 里），不要写步骤（脚本里），不要在命令层解释"为什么"。

路由：
- <phase/state> → <加载哪个 skill>

硬规则（3 条内）：
- <最关键 1>
- <最关键 2>
- <最关键 3>
```

**commands/prd.md 重写后（28 行示例）**：

```markdown
---
description: 需求入口。AI 自动从调研到签字放行开发，你只用在 3 个 gate 签字。
---

你是需求的入口。用户已经给了想法，下面全自动。

**唯一要做的：遇 gate 必停下，把 AskUserQuestion 选项摆给用户，让 ta 选**。

不要写流程细节（方法论在 skill），不要写 SOP（步骤在脚本），不要在命令层解释"为什么"。

路由：
- 无 spec → 加载 prd skill
- 有 spec 要改 → 加载 prd-edit skill
- phase=reviewed → 加载 sign-gate skill（S1：放行开发）
- phase=implemented → 加载 sign-gate skill（S2：放行测试）
- phase=verified → 加载 sign-gate skill（S3：验收）
- 其他 → 加载 sign-gate skill（当前阶段对应 gate）

硬规则：
- 任何 dev/test 启动前必加载 sign-gate skill
- 禁止绕过 prd 改 spec.feature
- 不确定时调 ask-user skill，不要自己拼 AskUserQuestion
```

### 3.2 3 签字 Gate（替换原 6 介入点）

| Gate | 时机 | OPC 决策项 | 拒签回退 | 一句话 |
|---|---|---|---|---|
| **S1 Prd 出口** | prd → dev 中间 | 通过 / 改需求 / 撤回 | 回 prd 阶段 1/2 | "这是你想要的 spec 吗？" |
| **S2 Dev 出口** | dev → test 中间 | 通过 / spec 错（回 prd） / 实现错（回 dev） | 见拒签回退 | "代码实现符合 spec 吗？" |
| **S3 Test 出口** | test → accepted 中间 | 通过 / 退回 / 部分通过 | 回 dev（实现错）/ 回 prd（spec 错）| "跑通能验收吗？" |

**S2 拒签归因判断**（AI 自动 + OPC 1 次确认）：

```
S2 拒签时 AI 问 OPC：
  "S2 拒签归因：
   (1) 实现错（spec 对，代码跑偏）→ 回 dev
   (2) spec 错（测试暴露 spec 本身漏了/写错了）→ 回 prd + @spec-version MAJOR
   (3) 我不确定 → AI 默认按"先检查 spec"（spec 是真相源）处理"
```

**S3 拒签归因同 S2**（test 失败 = 先查 spec 再查代码）。

### 3.3 spec-readiness 6 项硬指标 + 1 项软指标

**新增脚本** `spec/scripts/spec-readiness.js`（L3，P0）。

| # | 维度 | 怎么测 | 阈值 | 软/硬 |
|---|---|---|---|---|
| 1 | 未决项归零 | sources.md 的"未决项"段 | 0 条 | 硬 |
| 2 | REQ 全有 SC | spec-validate #10 | 0 FAIL | 硬 |
| 3 | GWT 无 TBD | regex 扫 `TBD\|待定\|...\|等等` 在 spec.feature | 0 命中 | 硬 |
| 4 | user-perspectives 存在 | `spec/sources/user-perspectives/_summary.md` 文件存在 + 非空 | 必含 | 硬 |
| 5 | summary.md 合规 | spec-summary check（已落）| 4 项全过 | 硬 |
| 6 | C5 锚点 | sources.md 含 `- **C5 Spec 评审**` 行 | 必含 | 硬 |
| 7 | sad-path 覆盖 | spec.feature 中 `@sad-path` SC 数 / SC 总数 | ≥ 30% | **软** |

**软失败规则**：

- 仅 1 项软失败 + OPC 在 S1 签字时显式 ack → 放行（���软失败免责锚点）
- ≥ 2 项软失败 → 阻断（即使 OPC 签字也不放行）
- 硬失败不能免责

**CLI 签名**：

```bash
$ node spec-readiness.js <项目目录>
# 输出 7 项指标 + 阻断/放行 + 软失败清单
# exit 0 = 放行 / exit 1 = 阻断

$ node spec-readiness.js <项目目录> --json
# 输出 JSON 给 sign-gate.js 消费

$ node spec-readiness.js <项目目录> --soft-ack
# 标记软失败已 OPC ack（写免责锚点）
```

### 3.4 sign-gate.js 统一管理 S1/S2/S3

**新增脚本** `spec/scripts/sign-gate.js`（L3，P0）。

```bash
$ node sign-gate.js <项目目录> --gate S1 --verdict accept|reject|reject-spec|reject-impl
# accept → 推 phase 到下一阶段 + 写锚点
# reject → 回退 + 写锚点（含回退路径）
# reject-spec / reject-impl → 同 reject，额外记录归因

$ node sign-gate.js <项目目录> --gate S2 --verdict reject-spec --reason "..."
# 拒签 + 归因 = spec 错 → 自动回 prd 阶段 1/2 + @spec-version MAJOR bump

$ node sign-gate.js <项目目录> --gate S3 --verdict accept
# 放行 → 推 phase = accepted + 触发 measure-opc-cost.js + 写验收报告
```

**锚点格式**（sources.md "S 锚点区"）：

```markdown
- **S1 Prd 出口签字** (2026-06-17 14:30 / accept | spec-readiness:6/7 硬全过+1 软免责 / 免责:{摘要})
- **S2 Dev 出口签字** (2026-06-17 14:55 / accept / @spec SC-001~005 已绑)
- **S3 Test 出口签字** (2026-06-17 15:10 / accept / 5/5 SC 测过+0 漂移 / L0 30 min)
```

**前置校验**（防止 race）：

- 当前 phase 必须允许签字（`spec-cli.js check`）
- S1 签字前必跑 `spec-readiness.js`（exit 0 才放行）
- S2 签字前必跑 `spec-validate.js`（#7 SC 在源码有 @spec 标注全过）
- S3 签字前必跑 `spec-validate.js`（#8 SC 在测试有 SC-xxx: 用例全过）+ `spec-summary check`

### 3.5 9 个 skill 拆分 / 新建

| Skill | 来源 | 行数上限 | 用途 |
|---|---|---|---|
| `prd` | 拆自 commands/prd.md + prd skill 集成 | 100 | 默认走法：完整调研 + brainstorm + build-spec + readiness + S1 |
| `prd-edit` | 拆自 commands/prd.md | 100 | 轻量：旧 spec 改 diff + readiness + S1 |
| `brainstorm` | 已有，瘦身 | 100 | M1/M2/M3 + 4 Gate（C1/C2/C3/C4 改内部，不暴露给 OPC）|
| `build-spec` | 已有，瘦身 | 100 | sources.md → spec.feature 翻译 + 双向绑定 |
| `user-perspective-analyzer` | 已有 | 100 | 角色视角分析（prd 阶段 1 中段加载）|
| `dev-pipeline` | 由 commands/dev.md 转 | 100 | 读 spec → 写代码 + @spec 标注 + 自检 + S2 |
| `test-pipeline` | 由 commands/test.md 转 | 100 | 读 spec → 写测试 + 跑测试 + S3 |
| `sign-gate` | 新建 | 80 | S1/S2/S3 统一封装（含 AskUserQuestion 选项模板）|
| `ask-user` | 新建 | 60 | AskUserQuestion 封装（避免 AI 自己在命令层拼选项）|

**每个 skill ≤ 100 行约束**（防"skill 又膨胀成 SOP"），超出 = PR 不收。

### 3.6 三道闸防"绕过 prd 直接开发"

| 闸 | 谁守 | 怎么守 | 在哪个上下文生效 |
|---|---|---|---|
| **第 1 道：命令层** | `commands/prd.md` 决策树 | command 不提供任何"跳过 prd 直接 dev"的入口；路由表只指向 skill，不指向 dev-pipeline 直接路径 | AI 还没开始干 |
| **第 2 道：脚本层** | `spec-cli.js` + `dev-gen.js` | `phase != reviewed` 时 `dev-gen.js` 拒绝生成代码骨架（exit 1 + 报错"必须先 S1 签字"）| AI 在 prd 阶段主动调 |
| **第 3 道：hook 层** | `templates/hooks/pre-commit.sh` | commit 时跑 spec-validate.js，phase 不对（不是 reviewed/implemented/verified）直接挡 commit | AI 写完代码 commit 时 |

三道闸分别在不同上下文生效，**任何一道都能单独挡住"绕过"**，三道全绕过的概率几乎为 0。

### 3.7 轻量 vs 默认 prd 模式

| 模式 | 触发 | 跳过什么 | 何时用 |
|---|---|---|---|
| **默认（full）** | `/god:prd` 无参数 | 无（完整 6 步）| 新需求首次梳理 |
| **轻量（edit）** | `/god:prd --mode edit` | 阶段 0 自助调研（复用旧 spec 结论）| 已存在 spec.feature，改需求 |

**轻量模式路径**：

```
prd-edit skill 加载
  ↓
读旧 spec.feature + sources.md + meta.json（@spec-version）
  ↓
brainstorm 仅跑 diff 模式（标新增 / 删除 / 修改 REQ）
  ↓
build-spec 仅改 spec.feature（按 diff），自动 bump @spec-version
  ↓
spec-readiness 校验
  ↓
S1 签字
```

**轻量模式节省**：阶段 0 调研（≈ 5 min）+ brainstorm M1/M2 全量（≈ 10 min）= **约 15 min**。

### 3.8 上下文管理 4 机制

| 机制 | 做法 | 解决什么 |
|---|---|---|
| **skill 拆分粒度** | 每个 skill ≤ 100 行 | 防 skill 膨胀成 SOP |
| **失败模式索引化** | `docs/failure-modes.md` 只列"症状 → 查哪节"，不写 SOP | AI 不用全读 |
| **错误回响模板** | 脚本输出固定格式（exit code + 错误码 + 一句人话 + 文档锚点）| AI 不用解析长 stack |
| **上下文清理** | dev-pipeline / test-pipeline 跑完不返回 SOP 全文，只回 1 行结果 | 不刷屏 |

### 3.9 6 介入点 → 3 签字 Gate + 1 动态问

**`docs/human-ai-contract.md` 章节改动**：

| 现状（v0.6.0） | 新规约（v0.7.0） |
|---|---|
| C1 目标价值 Gate | **保留**（prd 阶段 1 内部，由 prd skill 触发）|
| C2 核心流程 Gate | **保留**（prd 阶段 1 内部，由 prd skill 触发）|
| C3 动态疑问点 | **保留**（由 prd skill 触发，批量问）|
| C4 总流程 Gate | **保留**（prd 阶段 1 内部，由 prd skill 触发）|
| P1 评审不通过决策 | **删除**（spec-review 失败自动回 prd 阶段 1/2，不再单独问 OPC）|
| S1 验收签字 | **改为 S3 Test 出口** |
| C6 Intent 反述 | **保留**（@intent SC 仍写 C6 锚点）|
| **新增 S1 Prd 出口签字** | S1 Gate 在 prd 阶段 3c，由 sign-gate skill 触发 |
| **新增 S2 Dev 出口签字** | S2 Gate 在 dev-pipeline 末尾，由 sign-gate skill 触发 |

**OPC 介入总次数**：

| 档位 | 现状 | 新规约 |
|---|---|---|
| 简单档 | 4-5 次（C1+C2+C3+C4+S1）| **3-4 次**（C1+C2+C4 合并可省 + S1 + S2 + S3）|
| 复杂档 | 6-10 次 | **5-7 次** |
| 上限 | 12 次 | **8 次** |

**注意**：prd 阶段 1 的 C1/C2/C4 Gate 仍在 OPC 视野（prd skill 触发），但通过 `ask-user` skill 封装，命令层不写"怎么问"。

---

## 4. 验收

### 4.1 命令层验收

- [ ] `commands/prd.md` ≤ 30 行（路由型��
- [ ] `commands/doc-sentinel.md` ≤ 30 行（路由型）
- [ ] `commands/dev.md` 已删
- [ ] `commands/test.md` 已删
- [ ] 命令层 grep 检查：`grep -c "加载" commands/prd.md` ≤ 5（只允许路由表里的"加载"）

### 4.2 脚本层验收

- [ ] `spec-readiness.js` 实现 + ≥ 15 单元测试
- [ ] `sign-gate.js` 实现 + ≥ 10 单元测试
- [ ] `spec-cli.js` 加 phase 前置校验（`dev-gen` 拒绝非 reviewed）
- [ ] 全量回归：spec/scripts 175+ 单元测试全过

### 4.3 skill 层验收

- [ ] 9 个 skill 全部存在 + 每个 ≤ 100 行
- [ ] `prd` / `prd-edit` skill 加载路径正确
- [ ] `sign-gate` skill 含 S1/S2/S3 选项模板
- [ ] `ask-user` skill 含 AskUserQuestion 调用规范

### 4.4 文档层验收

- [ ] `CLAUDE.md §2` L1 commands 描述改"路由型"
- [ ] `CLAUDE.md §3` 索引图加 9 skill + 2 新脚本
- [ ] `CLAUDE.md §6` 介入点改 3 签字 Gate + C3 动态问
- [ ] `docs/human-ai-contract.md` 6 介入点 → 3 签字 + 1 动态
- [ ] `docs/spec-directory.md` §3 状态机补 S1/S2/S3 + readiness 章节
- [ ] `docs/failure-modes.md` 改"症状索引"形态
- [ ] 新增 `docs/adrs/0013-prd-pipeline.md`

### 4.5 真实项目验收

- [ ] 用 demo/lead-scoring 跑完整 prd �� dev → test 流程
- [ ] spec-readiness 校验 6 项硬 + 1 项软
- [ ] 3 个签字 Gate 都被 OPC 真实 ack（不是 AI 自己签）
- [ ] 命令层不引导 OPC 打开 spec.feature（summary.md 是唯一界面）

---

## 5. 兼容性

### 5.1 向后兼容

- 旧 demo（lead-scoring 等）`spec/state/meta.json` 不动——`spec-cli.js` 双路径兼容已落
- `commands/dev.md` / `commands/test.md` 删除前先确认无 demo 引用
- 旧 prd 4 gate（C1/C2/C3/C4）逻辑下沉到 prd skill 内部，OPC 体验不变

### 5.2 迁移路径

```
v0.6.0（现状）
  ↓ 实施 RFC-0013
v0.7.0
  ↓ 验证 1 个完整 feature（demo）
v0.7.1
  ↓ 全量 demo 回归
v0.8.0（正式发布）
```

### 5.3 风险 + 缓解

| 风险 | 缓解 |
|---|---|
| OPC 觉得"3 次签字"比"1 次验收"更烦 | 3 次签字都是 1 道选择题，3 选 1，总耗时反而更短（避免 1 次拒签推翻重做）|
| prd-edit 模式 AI 漏掉新增边界 | spec-readiness 硬指标 #3（GWT 无 TBD）+ #6（sad-path 覆盖）兜底 |
| sign-gate 拒签自动回退选错路径 | S2/S3 拒签必问 OPC "归因 = spec 错 / 实现错"，不让 AI 自己脑补 |
| 命令层 ≤ 30 行约束被破坏 | PR review 硬卡 + `wc -l` 自动化检查（CI）|

---

## 6. 反模式（明确不做）

- ❌ 命令层写 SOP / 方法论 / 步骤（违反"command = 路由表"原则）
- ❌ 命令层直接调 AskUserQuestion（必须经 ask-user skill 封装）
- ❌ dev/test 重新变成 command（违反分层 L1 = 编排、L3 = SOP）
- ❌ spec-readiness 软失败可无限叠加（最多 1 项 + OPC 显式 ack）
- ❌ S2/S3 拒签不归因直接退回（必须问 OPC "spec 错 / 实现错"）
- ❌ sign-gate 跳过前置校验（spec-readiness / spec-validate 不通过不能签字）
- ❌ 改 spec.feature 在 dev-pipeline 阶段（违反防漂移铁律 #1）

---

## 7. 开放问题

- [ ] 命令层硬规则保留 3 条够吗？还是精简到 2 条（"必走 sign-gate" + "禁改 spec.feature"）？
- [ ] 轻量模式 `--mode edit` 是否要再加 `--force`（绕过 readiness 校验，警告而非阻断）？
- [ ] S1/S2/S3 锚点统一写在 sources.md 还是单独建 `spec/sign-gates.md`？
- [ ] sign-gate skill 是否要支持"批量放行"（如 `--gate S1,S2,S3 --verdict accept`，一次签 3 个）？还是保持每个 gate 必须独立签？

---

## 8. 时间线

- **Week 1**（2026-06-17 ~ 06-23）：RFC 评审 + 9 skill 拆分 / 新建
- **Week 2**（2026-06-24 ~ 06-30）：spec-readiness.js + sign-gate.js 实现 + 单元测试
- **Week 3**（2026-07-01 ~ 07-07）：spec-cli.js 加 phase 前置校验 + commands/prd.md 重写 + commands/dev.md + commands/test.md 删除
- **Week 4**（2026-07-08 ~ 07-14）：文档同步（CLAUDE.md / human-ai-contract.md / spec-directory.md / failure-modes.md）+ RFC 转 ADR
- **Week 5**（2026-07-15 ~ 07-21）：demo/lead-scoring 完整跑通 + 全量回归