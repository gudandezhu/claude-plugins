# plan.md — god v0.4.0 现状盘点 + 业务目标 gap

> 写于 2026-06-16。回看 god 设计：**已完成 / 待办 / 距业务目标差距**。
> **改 god 的方向 = 改 CLAUDE.md。改 god 现状 = 改本文。**

---

## 0. 业务目标回顾（CLAUDE.md §1.1 OPC 视角）

| # | 目标 | 验收手段 | 工具/产物 |
|---|---|---|---|
| 1 | OPC 说想法 → god 出可验收的 spec | OPC 看 `summary.md`（人话）能签字，**不直接打开 spec.feature** | ✅ G8 spec-summary |
| 2 | 活规格（可改、改完不漂移）| spec-validate 14 项全过 + demo 复现新行为 | ✅ G1+G2+G3 状态机 + meta.json + hooks |
| 3 | OPC 介入总时长 < 30 分钟 / feature | god 自动跑完 prd→dev→test，OPC 只在 C1 入口 + 验收出口 | ✅ D5 3 档分级（实测 L0 30 / L1 60 / L2 90 min）|
| 4 | 自动化测试 1:1 绑定 spec | `SC-xxx:` 测试与 spec.feature SC 编号一致 | ✅ spec-validate #7/#8 + demo lead-scoring 已绑 |

**业务目标 1-4 全部可达**——工具链 + 验证手段都齐了。

---

## 1. 已完成（v0.4.0 = 6 commits / 5 commits 演进链）

| Commit | 内容 | 测试 |
|---|---|---|
| `6ae0479` | 6 子文档 + 3 视角全景演练（2471 行）| — |
| `2644f35` | D2 G8 spec-summary + D4 ADR/RFC 编号规约 | 11/11 |
| `fc31904` | D1 G1+G2 状态机 CLI + meta.json | 20/20 |
| `229ab76` | D3 G3 hooks 防漂移 + demo lead-scoring 跑通 | 13/13 |
| `a1e5ed2` | D5 OPC 预算 3 档分级归因 | 17/17 |
| **合计** | **5 RFC + 5 ADR + 1 demo + 5 脚本 + 6494 行** | **61/61 全过** |

### 1.1 5 个 P0 缺口全部完成

| 缺口 | 工具 | 落点 | commit |
|---|---|---|---|
| G1 spec-cli 状态机 | `spec-cli.js`（5 子命令 + 6 状态机）| `spec/scripts/` | `fc31904` |
| G2 spec.meta.json | meta.json schema + spec-cli 读写 | `spec/meta.json` | `fc31904` |
| G3 hooks 防漂移 | 3 hook 模板 + install-hooks.js | `templates/hooks/` + `spec/scripts/` | `229ab76` |
| G8 spec-summary | spec-summary.js + 4 项校验 + 1 页纸模板 | `spec/scripts/` + `templates/spec-summary/` | `2644f35` |
| D4 ADR/RFC 规约 | 4 位补零编号 + 核心数据改必走 RFC | `docs/conventions.md §1.8` | `2644f35` |
| D5 OPC 预算分级 | measure-opc-cost.js 3 档 5 维 | `spec/scripts/` | `a1e5ed2` |

### 1.2 真实跑通的 demo

`demo/lead-scoring` 是 god v0.4.0 的"活体 demo"：
- 2 SC（健康 lead 评分 / 30 天降权）+ 完整 Gherkin
- sources.md 完整（REQ 表格 + C5 锚点 + Out of Scope）
- 1 个 lead.js 实现 + 2 个测试用例 + 1 个 meta.json + 1 个 summary.md（41 行）
- pre-commit 真实拦截 2 次非法 commit（C5 格式 / REQ 表格）
- 1 次 NO-VERIFY 救命 commit → .trace 留痕
- 状态机真实跑过 4 步：drafted → reviewed → implemented（待 verified/accepted）
- measure-opc-cost 实测：L1 档 3min33s 在 60min 预算内

---

## 2. 待办（roadmap 剩余 6 块，按优先级）

### 2.1 P1 驱动层（4 块，可并行启动）

| # | 缺口 | 作用 | 工作量 | 依赖 |
|---|---|---|---|---|
| G4 | spec-archive | spec 版本快照/回滚（"改坏 spec 后回滚"靠 git diff 不够）| 1-2 周 | G1, G2 ✅ |
| G5 | dev-gen | 读 spec.feature 产出代码骨架（`/** @spec SC-xxx */` + TODO）| 2-3 周 | G1, G2 ✅ |
| G6 | test-gen | 读 spec.feature + dev-gen 产出 playwright 测试桩（`SC-xxx:` 用例名）| 1-2 周 | G5 |
| G7 | spec-render | 输出 `review.md`（评审者视角 checklist + D1-D4 自评分草稿）| 1 周 | G2 ✅ |

**P1 4 项核心价值**：让 god **自我驱动能力**从 < 50% 升到 ≥ 80%。
- 现在：dev/test 阶段 AI 从零开始写代码/测试
- P1 落地后：dev-gen/test-gen 出骨架，AI 改骨架而非从零写

### 2.2 P2 防护层（2 块，需 P1 全完 + 真实项目验证）

| # | 缺口 | 作用 | 工作量 | 启动条件 |
|---|---|---|---|---|
| G9 | 4 视角评审 | 4 个独立角色（用户/QA/架构/AI 自审）跑 spec-review，4 份报告 + 仲裁 | 3-4 周 | G7 + G8 + ≥ 3 个真实项目 |
| G10 | domain.md | 项目根领域知识入口（术语/角色/业务流程/反模式），prd 阶段 0 自动加载 | 1 周 | — |

**P2 2 项核心价值**：让 god **评审质量** + **领域知识** 沉淀。

---

## 3. 距业务目标的真正差距（不只看 roadmap）

roadmap 描述的是"god 自身缺什么"，但**距离业务目标 1-4 真正可达**，还有 3 类外部差距：

### 3.1 流程层：commands 接入完整度

| Command | 状态 | 接入 god v0.4.0 工具链 |
|---|---|---|
| `/god:prd` | 🟡 部分接入 | §2.5 spec-summary 自动跑 ✅；阶段 3 3a 机械校验写明 spec-validate 但未硬挂 §1/§2 完整跑通；脑暴方法论依赖 brainstorm skill（已存在）|
| `/god:dev` | ❌ 未接入 | 仍是文档式流程，未跑 dev-gen（roadmap G5 待做）|
| `/god:test` | ✅ 完整接入 | §5 spec-cli advance + §7 measure-opc-cost 全部就位 |

**gap**：dev command 没接入 god v0.4.0——AI 在 dev 阶段仍是裸跑（读 spec → 写代码 → @spec 标注）。**这是当前最大 gap**。

### 3.2 数据层：3 视角演练的"承诺"未真兑现

3 份 perspectives 演练描述了"5 天 lead scoring 完整闭环"——但 demo 实际只跑了**单 feature 部分**：
- ✅ 写 spec → 写代码 → 写测试 → hooks 拦截 → summary 产出 → 状态机推进
- ❌ 改需求（中途变更）→ 回流到 spec
- ❌ demo 上线（真实跑服务）
- ❌ OPC 验收后 → 知识回流

**gap**：god v0.4.0 是**单 feature 闭环**，不是**多 feature 业务闭环**。后者的关键能力 = spec-archive (G4) + dev-gen (G5)。

### 3.3 体验层：OPC 真体感未量化

3 份 perspectives 演练 K1 数据：
- 01 OPC 真实试跑：75 min（**L2 档**——含翻脸）
- 02 god 团队试跑：28 min（L0）
- 03 架构师试跑：22 min（L0）

3 个数据现在能归类，但**这只是"演练值"**——god 真实跑 ≥ 3 个 feature 后的数据，**还没采到**。

**gap**：god v0.4.0 没有"god 自我监控"基础设施（埋点、统计、报告）—— measure-opc-cost 只算单 feature，**没有跨 feature 趋势**。

---

## 4. 优先级排序（下一刀怎么切）

### 推荐路径：A → B → C → D

| 序 | 任务 | 价值 | 工作量 | 阻塞关系 |
|---|---|---|---|---|
| **A** | **dev command 接入 G1+G2+G8**（用现有工具链） | 把 god 自我闭环率从 60% 提到 90% | 2-3 天 | 无 |
| **B** | **dev-gen (G5)** | AI 不再从零写代码，dev-gen 出骨架 | 2-3 周 | 无 |
| **C** | **test-gen (G6)** | AI 不再从零写测试，test-gen 出桩 | 1-2 周 | 依赖 B |
| **D** | **spec-archive (G4)** | god 有版本回滚能力（"改坏可回"是 P0 不是 P1）| 1-2 周 | 无 |

**D 我建议提到 P0**——"改坏 spec 不可回滚"是 god 用户最怕的痛点之一。G4 工作量小、立竿见影。

### 次优路径（如果想先扩深度而非广度）

| 序 | 任务 | 价值 |
|---|---|---|
| A | dev command 接入 | 同上 |
| D | spec-archive | 同上 |
| **B'** | spec-render (G7) | 评审者看 review.md 比 Gherkin 友好 5 倍 |
| **E** | god 自我监控埋点 | measure-opc-cost 加 .trace 累计趋势 |

### 不推荐先做

- ❌ **G9 4 视角评审**：需要 ≥ 3 个真实项目跑过——现在 0 个
- ❌ **G10 domain.md**：是 G9 评审质量的前置，单独做价值不���

---

## 5. 我推荐的 4 周路径

### Week 1：A + D（快速闭环现有能力）

- A：dev command 接入（用 spec-cli + spec-summary 现有工具）
- D：spec-archive v0.1.0（最小可用：snapshot + list + restore）

**Week 1 交付**：god 真实可用 + 有回滚能力。

### Week 2：B（G5 dev-gen）

- 读 spec.feature 产出代码骨架
- 每个 SC 一个空函数 + `/** @spec SC-xxx */` + TODO
- 产出物通过 spec-validate.js

**Week 2 交付**：AI 不再从零写代码。

### Week 3：C（G6 test-gen）

- 读 spec.feature + dev-gen 产出测试桩
- 每个 SC 一个 `test('SC-xxx: <name>', () => {})` 空函数
- 产出物通过 spec-validate.js

**Week 3 交付**：AI 不再从零写测试。

### Week 4：E（god 自我监控）+ 真实多 feature 演练

- measure-opc-cost 加 .trace 累计趋势报告
- 用 lead scoring + 1-2 个新 feature 跑真实多 feature 闭环
- 采集 OPC 真实体感数据（修正 perspectives 演练的"演练值"）

**Week 4 交付**：god 有数据驱动决策能力。

---

## 6. 不在 plan 里的待办（长期）

| # | 项 | 说明 |
|---|---|---|
| L1 | god 商业模式（开源 / 收费 / 协会）| v0.4.0+ 演进后期 |
| L2 | god-on-god（用 god 改 god 自身）| god 自我改造能力 |
| L3 | demo 多样化（web / API / CLI / 嵌入式）| 验证 god 跨域适用 |
| L4 | 与 IDE 集成（VSCode / JetBrains plugin）| god 入口下沉到 IDE |
| L5 | 多人协作 OPC（god 支持 2-3 人 OPC 模式）| 当前只服务单人 |

---

## 7. 决策点（需确认）

| # | 决策 | 选项 |
|---|---|---|
| Q1 | 下一刀先切 A（dev command 接入）还是 D（spec-archive）？| A=D（推荐）|
| Q2 | G5 dev-gen 输出的代码语言是 TypeScript 默认还是按项目类型？| 建议：按项目 package.json 自动判断 |
| Q3 | spec-archive 是 git 内（spec/.archive/）还是 git 外（独立 .god/）？| 建议：git 内（可追溯）|
| Q4 | G6 test-gen 输出 vitest 默认还是 playwright？| 建议：vitest 单元 + playwright 集成，二选一让用户在 spec.feature 标 `@integration` |
| Q5 | god 自我监控的指标由 god 团队定还是 OPC 投票定？| 建议：god 团队初版 + 3 个月后 OPC 投票修 |

---

## 8. 文档版本

- v0.4.0（2026-06-16）：初版盘点 + 4 周路径 + 5 个决策点
