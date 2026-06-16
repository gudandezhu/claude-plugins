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
**S1 出口**：`commands/test.md` S1 自动跑 measure-opc-cost 写验收报告

预算超限 = 系统失败（不是"OPC 加班"）。

---

## 2. 架构（4 层 + 1 中心 + 1 真相源）

```
L1 commands/         编排，subagent 派遣
L2 skills/           方法论，一份一文件
L3 scripts/          机械工具，可独立 node 跑
L4 hooks+templates   平台注入 + 产物模板

中心 = scenarios（spec.feature 的 SC 列表）
真相源 = spec/ 目录
```

**分层职责 & 禁止事项** → 见 [`docs/architecture.md`](docs/architecture.md)

**`spec/` 目录结构** → 见 [`docs/spec-directory.md`](docs/spec-directory.md)

---

## 3. 索引图（god 的所有内容在哪）

```
god/
├── CLAUDE.md                       ← 本文件，宪法
├── README.md                       ← 使用入口
├── docs/                           ← 设计/规范/约定（**新模块先看这**）
│   ├── architecture.md             L1/L2/L3/L4 职责详情
│   ├── spec-directory.md           spec/ 目录结构与产物
│   ├── conventions.md              开发规范（命名/版本/提交流程）
│   ├── human-ai-contract.md        人机协作契约（6 个必介入点）
│   ├── failure-modes.md            失败模式 + 恢复手册
│   └── roadmap.md                  改造优先级（必做/应做/可缓做）
├── spec/                           活规格子系统自身的设计
│   ├── SPEC-FORMAT.md              Gherkin 格式 + SC 绑定规则
│   ├── scripts/
│   │   ├── spec-validate.js        机械校验（14 项）
│   │   ├── spec-cli.js             (规划) SC 状态机
│   │   ├── spec-render.js          (规划) 渲染 review.md
│   │   └── spec-archive.js         (规划) 版本快照
│   └── TESTING.md                  spec 系统自身回归手册
├── commands/                       L1
│   ├── prd.md                      需求 → spec
│   ├── dev.md                      spec → 代码
│   └── test.md                     spec → 测试 → 验收
├── skills/                         L2
│   ├── brainstorm/                 模糊→清晰
│   ├── build-spec/                 sources.md → spec.feature
│   ├── spec-review/                语义评审
│   ├── dev-gen/                    (规划) spec → 代码骨架
│   ├── test-gen/                   (规划) spec → 测试桩
│   ├── spec-render/                (规划) spec → review.md
│   ├── spec-summary/               (规划) spec → 产品说明
│   └── ...                         其余 44 个 skill 按需
├── scripts/                        L3（dev/build/test 等领域工具；原 scripts/hooks/ 7 个孤岛脚本已删，待 G3 重建）
├── workflows/                      L3 workflow（评审/校验/并行）
├── docs/                           v0.2.0 起的设计/规范/约定（**新模块先看这**）
│   ├── architecture.md             L1/L2/L3/L4 职责详情
│   ├── conventions.md              开发规范（命名/版本/提交流程）
│   ├── human-ai-contract.md        人机协作契约（6 个必介入点）
│   ├── failure-modes.md            失败模式 + 恢复手册
│   ├── roadmap.md                  改造优先级（必做/应做/可缓做）
│   ├── incidents/                  事后复盘沉淀（v0.2.0 建）
│   └── spec-directory.md           spec/ 目录结构与产物
├── docs/rfcs/                      RFC 提案（4 位补零编号 NNNN-xxx.md；v0.4.0 起启用）
│   ├── 0001-spec-cli-state-machine.md
│   └── 0002-spec-summary.md
├── docs/adrs/                      ADR 决议（同编号格式；RFC 合并后改名为 ADR-NNNN）
│   ├── 0000-spec-lifecycle-6-vs-4-states.md  基础架构（6 vs 4 状态）
│   ├── 0002-spec-summary.md
│   └── 0003-spec-cli-state-machine.md        G1+G2 捆绑落地
├── hooks/                          L4 顶层 hook 配置目录（roadmap G3 接入 .claude/settings.json 后启用）
├── templates/                      L4 产物模板（task/ + hooks/ v0.2.0 建）
└── docs/perspectives/              v0.4.0 起 3 视角全景演练（业务/开发/设计 4 类闭环）
    ├── 01-ops-runbook.md           OPC 视角跑 5 天 feature 闭环
    ├── 02-dev-perspective.md       god 贡献者视角：RFC→PR→拒稿→合并
    └── 03-architect-perspective.md 架构视角：评审 G8 + 写 ADR/拒绝 PR
```

---

## 4. 核心约束（3 条铁律 + 5 大防漂移）

### 4.1 三条铁律

| # | 铁律 | 违反后果 |
|---|---|---|
| 1 | 需求是入口，规格是中间态，代码/测试是产出 | 凭空改代码 = 孤儿代码 |
| 2 | **人看得懂**是 spec 的第一约束，AI 看得懂是第二 | 评审卡住 = 系统失败 |
| 3 | 改 spec 是单一入口 | 漂移 = 资产腐烂 |

### 4.2 5 大防漂移机制（详情见 [spec/SPEC-FORMAT.md §4](spec/SPEC-FORMAT.md)）

| 防什么 | 机制 | 在哪 |
|---|---|---|
| 绕过 build-spec 改 spec | spec-cli.js 强校验 | 规划中 |
| 代码 `@spec` 标了 spec 没的 SC | spec-validate.js #9 | 已实现 |
| spec 加 SC 漏写 REQ | spec-cli add --req 强校验 | 规划中 |
| spec 改了代码没改 | spec-drift hook | 规划中 |
| OPC 评审缺失（机制名沿用 PM）| C5 锚点 | 已实现 |

---

## 5. 系统级缺口（roadmap 一句话版）

god 当前 vs 完整 god 还差 10 块。**完整 roadmap、优先级、依赖关系** → 见 [`docs/roadmap.md`](docs/roadmap.md)

按性质归并：
- **规范层**：spec-cli 状态机、spec.meta.json
- **呈现层**：spec-render、spec-summary
- **驱动层**：dev-gen、test-gen、archive
- **防护层**：hooks、4 视角评审、domain.md
- **战略/体验/工程/流程/运营/稳定/合规/元层**：见 roadmap

---

## 6. OPC 在哪介入（OPC 注意力预算的落点）

**6 个必介入点**（C1/C2/C4 Gate + C3 动态问 + 评审不通过决策 + 验收签字）→ 见 [`docs/human-ai-contract.md`](docs/human-ai-contract.md)

**铁律**：除 6 个必介入点外，其他环节 AI 全自主，**OPC 不需要在场**。
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

---

## 10. 文档版本

- **v0.4.0** (2026-06-16)：**3 视角全景演练 + G8 真实实现**。
  - 文档：`docs/perspectives/` 3 份（01-ops 933 行 / 02-dev 742 行 / 03-architect 796 行），含业务/开发/设计/产品 4 类闭环。
  - 规约：`docs/conventions.md §1.8` ADR/RFC 4 位补零编号 + 核心数据改必走 RFC。
  - RFC-0001 spec-cli 状态机 + ADR-0001 6 vs 4 状态决议。
  - **G8 真实落地**（D2 P0）：`spec/scripts/spec-summary.js` + 11/11 单元测试 + 模板 v0.1.0 + `commands/prd.md §2.5` 自动跑 gen；RFC-0002 转 ADR-0002。
  - 提供 v0.4.0+ 演进 4 个未做项：G1+G2 捆绑实现（RFC-0001 待开）、G3 hooks 集成、OPC 预算分级归因。
- **v0.3.0** (2026-06-16)：**OPC 定位**。§1.1 4 产品目标 + 1 系统目标 + 6 文档全部从"PM/AI/程序员协作"切到"OPC × AI 外骨骼"。新增 §1.3 OPC 注意力预算（< 30 分钟 / feature）。G8 spec-summary 由 P1 升级为 P0（目标 1 唯一验收手段）。
- **v0.2.0** (2026-06-16)：补齐 6 子文档（architecture/conventions/human-ai-contract/failure-modes/roadmap/spec-directory），建 `docs/incidents/` 与 `templates/hooks/` 脚手架。索引图"待建"标识全部清除。
- **v0.1.0** (2026-06-16)：初版索引地图。
