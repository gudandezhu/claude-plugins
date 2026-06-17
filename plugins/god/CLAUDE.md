# god 设计文档

> god 插件的**索引地图**。本文只放：定位、架构、约束、指向具体文档的链接。
> 不放技能细节、知识沉淀、实现方案（那些在独立文件里）。
> **改 god 的方向 = 改本文。改 god 的实现 = 改对应子文档。**

---

## 0. 文档定位

- **本文件是 god 的"宪法"**：定方向、定架构、定约束
- **本文件不承载**：技能细节、知识沉淀、代码示例、规范全文
- **新功能 PR 之前**：先看本文 §3 索引图，找到对应子文档，再动笔
- **改本文档**：需走 RFC（设计变更），不接受随手 PR

### 0.1 文档纪律（必读）

**文档只写当前事实，不写历史版本。**

- ❌ 禁止在文档里写"v0.5.0 时 X" / "v0.6.0 之前是 Y" / "v0.7.0 落地时改了 Z" 这类**历史叙事**
- ❌ 禁止"撤回说明"段（"v0.6.0 引入的 X 是错的，v0.7.0 撤回"——已撤回的就不写）
- ❌ 禁止"过渡说明"段（"v0.6.0 过渡用 cron，v0.7.0 主线用 SessionStart"——只写 SessionStart）
- ❌ 禁止"已变更"注脚（"v0.6.0 老式 X 已于 v0.7.0 取消"）
- ❌ 禁止"文档版本"段（§10 / "v0.x.0 (YYYY-MM-DD)"——版本信息在 git 里，不在文档里）
- ✅ **当前事实**直接写："X 是 Y"（不写"X 之前是 Z"）
- ✅ **git log** 是历史真相源（不在文档里复制）
- ✅ 删了的东西**就当不存在**（不在文档里留"撤回说明"）

**理由**：版本信息 / 变更历史 / 撤回说明 → AI 读时增加认知负担，**降低文档信噪比**。git 是版本历史权威，文档是当前规范。

---

## 1. 目标（god 是什么）

### 1.1 4 个产品目标（OPC 视角）

> **OPC = One Person Company**。god 的唯一用户是 OPC（不是 PM/AI/程序员的协作，是一个人 + AI 外骨骼）。

| # | 目标 | 验证手段 |
|---|---|---|
| 1 | OPC 说想法 → god 出可验收的 spec | OPC 看 `summary.md`（人话）能签字，**不直接打开 spec.feature** |
| 2 | 活规格（可改、改完不漂移）| spec-validate 14 项全过 + demo 复现新行为 |
| 3 | OPC 介入总时长 < 30 分钟 / feature | god 自动跑完 prd→dev→test，OPC 只在 C1 入口 + 验收出口 |
| 4 | 自动化测试 1:1 绑定 spec | `SC-xxx:` 测试与 spec.feature SC 编号一致 |

### 1.2 1 个系统目标

> **god 是 OPC 的软件交付外骨骼。想法→demo 是唯一闭环。**
> spec 是 OPC 想法的可追溯投影，不是 god 的全部。

任何功能先问"这对 OPC 的注意力预算有什么影响"，再问"怎么落到 spec"。

### 1.3 OPC 注意力预算（3 档分级归因，v0.4.0 起）

> **修订**：3 份 perspectives 演练一致表明硬 30 min 阈值不可达（[ADR-0005](docs/adrs/0005-opc-cost-tiered.md)）。改 3 档分级。

| 档位 | 触发条件 | 预算 | 含义 |
|---|---|---|---|
| **L0 纯流程** | 无 F-XX 崩点 + 无 S1 翻脸 | **30 min** | god v0.4.0+ 目标态 |
| **L1 含 1 崩** | 1 次 F-XX 修复（f-01~f-06）| **60 min** | god 自身 bug 导致多花 |
| **L2 含 1 翻脸** | OPC 验收拒绝重做 | **90 min** | OPC 主观不满意导致返工 |
| **L3 多次崩/翻脸** | 累计 ≥ 2 次 | 标"超预算" | 系统失败信号 |

**5 维归因**（自动算）：

```
总介入 = prd 阶段 + dev 阶段 + test 阶段 + 崩点修复 + 翻脸决策
```

**工具**：`node spec/scripts/measure-opc-cost.js <项目>` 自动算 + 报告档位
**S3 出口**：`skills/test-pipeline/SKILL.md` 阶段 5 自动跑 measure-opc-cost 写验收报告

预算超限 = 系统失败（不是"OPC 加班"）。

---

## 2. 架构（4 层 + 1 中心 + 1 真相源）

```
L1 commands/         路由表（≤ 30 行/个，v0.7.0 RFC-0013 起）
L2 skills/           方法论，一份一文件（≤ 100 行/个，PR review 硬卡）
L3 scripts/          机械工具，可独立 node 跑
L4 hooks+templates   平台注入 + 产物模板

中心 = scenarios（spec.feature 的 SC 列表）
真相源 = spec/ 目录
```

**v0.7.0+ 命令层变化（RFC-0013）**：

- 命令层 = 路由表，不再是 SOP（不写方法论 / 步骤 / "为什么"）
- 命令层遇 gate 必停下，调 sign-gate skill 弹 AskUserQuestion
- 命令层禁止直接拼 AskUserQuestion，必须经 ask-user skill 封装
- dev / test 命令取消（迁到 skills/dev-pipeline + skills/test-pipeline）

**分层职责 & 禁止事项** → 见 [`docs/architecture.md`](docs/architecture.md)

**`spec/` 目录结构** → 见 [`docs/spec-directory.md`](docs/spec-directory.md)

---

## 3. 索引图（god 的所有内容在哪）

```
god/
├── CLAUDE.md                       ← 本文件，宪法
├── README.md                       ← 使用入口
├── docs/                           ← 设计/规范/约定（**新模块先看这**）
│   ├── architecture.md             L1/L2/L3/L4 职责边界 + 跨层规则
│   ├── spec-directory.md           spec/ 目录结构与产物
│   ├── conventions.md              开发规范（命名/版本/提交流程；文件位置/大小的唯一权威）
│   ├── human-ai-contract.md        人机协作契约（6 个必介入点）
│   ├── failure-modes.md            失败模式 + 恢复手册
│   ├── roadmap.md                  改造优先级（剩余缺口，见 §5）
│   ├── CHANGELOG.md                版本变更详细历史（CLAUDE.md §10 摘要指此）
│   ├── perspectives/               v0.4.0 起 3 视角全景演练（业务/开发/设计 4 类闭环）
│   │   ├── 01-ops-runbook.md
│   │   ├── 02-dev-perspective.md
│   │   └── 03-architect-perspective.md
│   ├── rfcs/                       RFC 提案（4 位补零编号 NNNN-xxx.md）
│   │   ├── 0001-spec-cli-state-machine.md
│   │   ├── 0002-spec-summary.md
│   │   ├── 0003-hooks-integration.md
│   │   ├── 0005-opc-cost-tiered.md
│   │   └── 0013-prd-pipeline.md
│   ├── adrs/                       ADR 决议（同编号格式；RFC 合并后改名为 ADR-NNNN）
│   │   ├── 0000-spec-lifecycle-6-vs-4-states.md
│   │   ├── 0002-spec-summary.md
│   │   ├── 0003-spec-cli-state-machine.md
│   │   ├── 0004-hooks-integration.md
│   │   └── 0013-prd-pipeline.md
│   └── incidents/                  事后复盘沉淀（v0.2.0 建）
├── spec/                           活规格子系统自身的设计
│   ├── SPEC-FORMAT.md              Gherkin 格式 + SC 绑定规则
│   ├── scripts/                    spec 子系统自身的 L3 工具（13 脚本 / 175+ 测全过）
│   │   ├── spec-validate.js        机械校验（14 项 + 3 sad-path）
│   │   ├── spec-cli.js             SC 状态机 6 态 + meta.json 读写（v0.4.0 落）
│   │   ├── spec-summary.js         summary.md 渲染（v0.4.0 落，11 单元测试）
│   │   ├── spec-render.js          review/<date>.md 渲染（v0.5.0 落 G7）
│   │   ├── spec-archive.js         快照 / 回滚 / 列出（v0.5.0 落 G4）
│   │   ├── dev-gen.js              spec → 代码骨架（v0.5.0 落 G5，v0.7.0+ G17 phase 前置校验）
│   │   ├── test-gen.js             spec → 测试桩（v0.5.0 落 G6）
│   │   ├── init-spec-dir.js        建好 spec/ 子目录结构（v0.5.1 落 G13.1，5 测）
│   │   ├── spec-lint.js            spec/ 结构守门，拦 AI 误建（v0.5.1 落 G13.1，8 测）
│   │   ├── god-trends.js           跨 feature 趋势分析（v0.5.0 落 D5）
│   │   ├── measure-opc-cost.js     OPC 介入成本 5 维归因（v0.5.0 落 D5）
│   │   ├── install-hooks.js        G3 hook 一键安装（v0.4.0 落）
│   │   ├── spec-readiness.js       7 项清晰度校验（v0.7.0 落 G15，17 测）
│   │   └── sign-gate.js            S1/S2/S3 统一签字管理（v0.7.0 落 G16，18 测）
│   └── TESTING.md                  spec 系统自身回归手册
├── commands/                       L1 路由表（prd / doc-sentinel，≤ 30 行/个，v0.7.0+ RFC-0013）
├── skills/                         L2（42 个 skill，v0.7.0+ 新增 6 个：prd / prd-edit / dev-pipeline / test-pipeline / sign-gate / ask-user）
├── scripts/                        L3（dev/build/test 等领域工具；v0.4.0 起 `hooks/` 是顶层目录；v0.6.0 起 `doc-sentinel/` 是后台文档巡检 agent 的机械 check 脚本）
├── workflows/                      L3 workflow（评审/校验/并行）
├── hooks/                          L4 hook 模板入口（v0.4.0 G3 落地，install-hooks.js 装到项目侧 .claude/settings.json）
├── templates/                      L4 产物模板
│   ├── task/                       任务模板（task-list.json 等）
│   ├── hooks/                      G3 hook 脚本模板（pre-commit / session-end / post-commit-no-verify）
│   └── spec-summary/               G8 summary 模板（v0.1.0）
└── demo/                           真实项目样例（lead-scoring 等）
```

---

## 4. 核心约束（3 条铁律 + 5 大防漂移）

### 4.1 三条铁律

| # | 铁律 | 违反后果 |
|---|---|---|
| 1 | 需求是入口，规格是中间态，代码/测试是产出 | 凭空改代码 = 孤儿代码 |
| 2 | **人看得懂**是 spec 的第一约束，AI 看得懂是第二 | 评审卡住 = 系统失败 |
| 3 | 改 spec 是单一入口 | 漂移 = 资产腐烂 |

### 4.2 5 大防漂移机制

**v0.4.0 全部落地**。详细机制 + 落点 → [docs/architecture.md §8](docs/architecture.md#8-与三条铁律的对应) + [spec/SPEC-FORMAT.md §4](spec/SPEC-FORMAT.md#4-三者绑定规则防漂移)。

---

## 5. 系统级缺口（v0.6.0 已闭环开发期+维护期）

**P0 4 块 + P1 4 块 + P1 增强 2 块 + G10/G11/G13/G13.1/D5 + **G14 维护期** 全部落地**。**剩余 2 块**（P2）详情见 [`docs/roadmap.md`](docs/roadmap.md)：

- **P2 锦上添花（2 块）**：G9 4 视角评审 —— 等 ≥ 3 个真实项目验证后启动

**已落地的 P0 + P1 + G14**（commit 锚点）：
- G1+G2：commit `fc31904`（spec-cli.js + meta.json schema）
- G8：commit `2644f35`（spec-summary.js + 11 单元测试 + 模板 v0.1.0）
- G3：commit `229ab76`（templates/hooks/ 3 模板 + install-hooks.js）
- G4：commit `5baf747`（spec-archive.js + 18 单元测试，提 P0 已采纳）
- G5：commit `8b16b3d`（dev-gen.js + 20 单元测试）
- G6：commit `c039441`（test-gen.js + 19 单元测试）
- G7：commit `ddb406b`（spec-render.js + RFC-0010）
- **G10**：templates/domain.md v0.1.0（domain.md 模板）
- **G11**：incidents→ADR 知识沉淀（templates/incident.md + docs/incidents/0001 + docs/adrs/0011）
- **G13**：spec/ 子目录分层（state/review/domain），8 脚本双路径兼容
- **G13.1**：结构固化（init-spec-dir.js 5 测 + spec-lint.js 8 测，拦 AI 误建文件）
- **D5**：measure-opc-cost.js + god-trends.js（自我监控）
- **G14**：doc-sentinel 后台文档巡检（v0.7.0，[ADR-0012](docs/adrs/0012-doc-sentinel.md)；`commands/doc-sentinel.md` 4 子命令 + `skills/doc-sentinel/` 方法论 + `scripts/doc-sentinel/` 9 check 脚本 + 42 单元测试全过）
- **G15**：spec-readiness 7 项清晰度校验（v0.7.0 RFC-0013，17 单元测试）
- **G16**：sign-gate S1/S2/S3 统一签字管理（v0.7.0 RFC-0013，18 单元测试）
- **G17**：dev-gen phase 前置校验（v0.7.0 RFC-0013，4 单元测试）
- **总测试**：spec 13 单元测试 175+/175+ + doc-sentinel 6 测试 42/42 全过

---

## 6. OPC 在哪介入（OPC 注意力预算的落点）

**v0.7.0+ 新规约（RFC-0013）**：

- **3 签字 Gate**（S1/S2/S3）+ **1 动态问**（C3）→ 见 [`docs/human-ai-contract.md`](docs/human-ai-contract.md)
- S1 = prd → dev 中间（"这是你想要的 spec 吗？"）
- S2 = dev → test 中间（"代码实现符合 spec 吗？"）
- S3 = test → accepted 中间（"跑通能验收吗？"）
- 拒签必归因：spec 错 → 回 prd；实现错 → 回 dev

**铁律**：除 3 签字 Gate + C3 动态问外，其他环节 AI 全自主，**OPC 不需要在场**。
**预算**：OPC 介入总时长按 3 档分级（见 §1.3）。L3 = 系统失败。

---

## 7. 失败模式（崩了怎么办）

**6 个已知崩点 + 恢复手段** → 见 [`docs/failure-modes.md`](docs/failure-modes.md)

---

## 8. 与子文档的关系

| 本文件章节 | 详细在哪 |
|---|---|
| §2 架构 | `docs/architecture.md` |
| §3 索引图 | 各对应子目录的 SKILL.md / SPEC-FORMAT.md |
| §4 防漂移 | `spec/SPEC-FORMAT.md` §4 |
| §5 缺口 | `docs/roadmap.md` |
| §6 人机协作 | `docs/human-ai-contract.md` |
| §7 失败模式 | `docs/failure-modes.md` |

---

## 9. 新功能 PR 流程（3 步必走）

```
1. 读本文 §3 索引图 → 找到对应子文档
2. 答 3 个问题（写在 PR 描述里）：
   - 这对 god 这个系统意味着什么？
   - 对应 §5 roadmap 哪一块缺口？
   - 与 §4 三条铁律冲突吗？
3. 按对应子文档的规范动手
```

**违反 = PR 不收**。
