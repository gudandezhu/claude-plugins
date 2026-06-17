---
type: log
status: stable
owner: god 维护组
last_reviewed: 2026-06-16
update_rule: free
related: [../CLAUDE.md, roadmap.md]
---

# plan.md — god 当前现状盘点

> 业务目标达成度 + 工具链全景 + 路径回看 + 下一刀规划。
> **改 god 的方向 = 改 CLAUDE.md。改 god 现状盘点 = 改本文。**

---

## 0. 业务目标达成度（CLAUDE.md §1.1 OPC 视角）

| # | 目标 | 验收手段 | 状态 | 工具/产物 |
|---|---|---|---|---|
| 1 | OPC 说想法 → god 出可验收的 spec | OPC 看 `summary.md`（人话）能签字，**不直接打开 spec.feature** | ✅ | G8 spec-summary + prd 阶段硬挂 |
| 2 | 活规格（可改、改完不漂移）| spec-validate 14 项 + spec-readiness 7 项 + demo 复现 | ✅ | G1+G2 状态机 + G3 hooks + G4 archive + G13.1 结构固化 |
| 3 | OPC 介入总时长 < 30 分钟 / feature | god 自动跑完 prd→dev→test，OPC 只在 3 个 Gate（S1/S2/S3）+ C3 签字 | ✅（D5 3 档分级：L0 30 / L1 60 / L2 90 min）| 全部 4 个 command 接入 + sign-gate + measure-opc-cost |
| 4 | 自动化测试 1:1 绑定 spec | `SC-xxx:` 与 spec.feature SC 一致 | ✅ | spec-validate #7/#8 + dev-gen/test-gen 强制标注 |

**业务目标 1-4 全部达成**。详见 §1 工具链全景 + §2 路径回看。

---

## 1. 工具链全景

### 1.1 spec 子系统（13 脚本 / 238 测试全过）

| 工具 | 命令 | 行数 | 测试 | 落点 |
|---|---|---|---|---|
| **spec-validate** | `node spec-validate.js <项目>` | 25.1K | 8 | `spec/scripts/` |
| **spec-cli** | `status / init / advance / rollback / check` | 16.8K | 34 | `spec/scripts/` |
| **spec-summary** | `gen / validate` | 10.3K | 15 | `spec/scripts/` |
| **install-hooks** | 一键装 pre-commit / session-end | 5.2K | 13 | `spec/scripts/` + `templates/hooks/` |
| **spec-archive** (G4) | `snapshot / list / restore / prune` | 12.6K | 18 | `spec/scripts/` |
| **dev-gen** (G5) | `<项目> [--dry-run] [--force]` | 7.0K | 24 | `spec/scripts/` |
| **test-gen** (G6) | `<项目> [--framework vitest\|playwright]` | 7.8K | 19 | `spec/scripts/` |
| **spec-render** (G7) | `<项目> [--output review.md]` | 12.9K | 0 | `spec/scripts/` |
| **init-spec-dir** (G13.1) | 建 spec/ 子目录结构 | 5.7K | 6 | `spec/scripts/` |
| **spec-lint** (G13.1) | spec/ 结构守门，拦 AI 误建 | 4.0K | 8 | `spec/scripts/` |
| **measure-opc-cost** | `<项目> [--json]` | 8.5K | 27 | `spec/scripts/` |
| **god-trends** | `[--json] [--last N]` | 8.6K | 25 | `spec/scripts/` |
| **spec-readiness** (G15) | 7 项清晰度校验 | 10.3K | 19 | `spec/scripts/` |
| **sign-gate** (G16) | S1/S2/S3 统一签字管理 | 13.2K | 22 | `spec/scripts/` |

### 1.2 doc-sentinel 维护子系统（9 check 脚本 / 6 测试 / 42 测试全过）

| 工具 | 命令 | 行数 | 测试 | 落点 |
|---|---|---|---|---|
| **config** | `config.js get / set` | 4.2K | — | `scripts/doc-sentinel/` |
| **install / uninstall** | `install.js` + `uninstall.js` | 3.9K + 2.9K | — | `scripts/doc-sentinel/` |
| **run-headless** | `run-headless.sh` 调 `claude -p` | 1.8K | — | `scripts/doc-sentinel/` |
| **status** | `status.js` | 2.5K | — | `scripts/doc-sentinel/` |
| **report-format** | `report-format.js` | 3.4K | 3 | `scripts/doc-sentinel/` |
| **9 个 check** | V1/N1/D1/F1/T1/P1/G1/C1/M1 各 1 个 | 平均 4K | 39 | `scripts/doc-sentinel/check-*.js` |

**9 类巡检**：V1 版本漂移 / N1 编号规约 / D1 demo 三件套 / F1 frontmatter / T1 stale TODO / P1 路径引用 / G1 G 状态机 / C1 CHANGELOG 日期 / M1 自检。

### 1.3 合计

- **spec 14 脚本 + doc-sentinel 13 脚本 = 27 脚本**
- **spec 238 + doc-sentinel 42 = 280 测试全过**

### 1.4 真实跑通的 demo

`demo/lead-scoring` 是 god 的"活体 demo"：
- 2 SC（健康 lead 评分 / 30 天降权）+ 完整 Gherkin
- sources.md 完整（REQ 表格 + C5 锚点 + Out of Scope）
- `src/lead-scoring.js`（G5 dev-gen 产出）+ `tests/lead-scoring.spec.js`（G6 test-gen 产出）
- meta.json + summary.md
- pre-commit 真实拦截非法 commit
- 1 次 NO-VERIFY 救命 commit → .trace 留痕
- 状态机真实跑过完整闭环：drafted → reviewed → implemented → verified → accepted
- DASHBOARD.md（OPC 视角仪表盘，god-trends 数据源）

跨 feature 真实演练（`/tmp/god-multi-feature-demo/`）：
- feat 1：lead scoring → accepted
- feat 2：OPC 改需求（加 SC-002）→ ROLLBACK + FORCE → accepted
- god-trends 输出 L2 档（含 1 次 ROLLBACK）

---

## 2. 路径回看

| 周/阶段 | 任务 | 落点 | commit 锚点 |
|---|---|---|---|
| **P0 规范层** | G1 状态机 + G2 meta.json | spec-cli + meta.json schema | `fc31904` |
| **P0 防护层** | G3 hooks 防漂移 | templates/hooks/ 3 模板 + install-hooks.js | `229ab76` |
| **P0 呈现层** | G8 spec-summary | spec-summary.js + 模板 | `2644f35` |
| **P1 驱动层** | G4 spec-archive | spec-archive.js + 18 测 | `5baf747` |
| **P1 驱动层** | G5 dev-gen | dev-gen.js + 20 测 | `8b16b3d` |
| **P1 驱动层** | G6 test-gen | test-gen.js + 19 测 | `c039441` |
| **P1 呈现层** | G7 spec-render | spec-render.js + RFC-0010 | `ddb406b` |
| **P1 增强** | D5 OPC 成本监控 | measure-opc-cost + god-trends + 2-feature 演练 | `a1e5ed2` / `2036079` |
| **P1 验证** | 多 feature 真实演练报告 | perspectives 演练 | `3e8a677` |
| **P2 基础** | G10 domain.md 模板 | templates/domain.md | （见 §2.1 沉淀） |
| **P2 基础** | G11 知识沉淀（incidents→ADR）| templates/incident.md + incidents/0001 + adrs/0011 | （见 §2.1 沉淀） |
| **G13 规范层升级** | spec/ 子目录分层（state/review/domain）| 8 脚本双路径兼容 | （见 §2.1 沉淀）|
| **G13.1 结构固化** | init-spec-dir + spec-lint | 拦 AI 误建 | （见 §2.1 沉淀）|
| **G14 维护期** | doc-sentinel 后台文档巡检 | commands/doc-sentinel.md + skills/doc-sentinel/ + scripts/doc-sentinel/ | （见 §2.1 沉淀）|
| **G15-G17 命令层重塑** | spec-readiness + sign-gate + dev-gen phase 校验 | RFC-0013 / ADR-0013 命令层 ≤30 行 + 3 Gate + 1 动态问 | （见 §2.1 沉淀）|

### 2.1 沉淀（CLAUDE.md §5 commit 锚点）

- G10：templates/domain.md v0.1.0
- G11：templates/incident.md + docs/incidents/0001-multi-feature-rollback.md + docs/adrs/0011-c4-check-mandatory.md
- G13：spec/ 子目录分层（state/review/domain），8 脚本双路径兼容
- G13.1：init-spec-dir.js 5 测 + spec-lint.js 8 测，拦 AI 误建文件
- G14：doc-sentinel 后台文档巡检（commands/doc-sentinel.md 4 子命令 + skills/doc-sentinel/ 方法论 + scripts/doc-sentinel/ 9 check + 42 测）
- G15：spec-readiness 7 项清晰度校验（17 单元测试）
- G16：sign-gate S1/S2/S3 统一签字管理（18 单元测试）
- G17：dev-gen phase 前置校验（4 单元测试）

### 2.2 关键决策

- **D 提 P0 已采纳**（G4 spec-archive 提 P0）
- **G15-G17 命令层重塑**（RFC-0013）：commands 退化为 ≤30 行路由表，dev/test command 取消（迁 skills/dev-pipeline + skills/test-pipeline），3 签字 Gate + 1 动态问
- **doc-sentinel 默认关闭**：项目级 on/off 开关，`claude -p` 脱机跑，不污染主 cc 窗口
- **god 自身仓 on doc-sentinel**：dogfooding 价值 > pre-commit 独占巡检的纯粹性

### 2.3 已闭环

- **P0 4 块**（G1/G2/G3/G8）全落
- **P1 4 块**（G4/G5/G6/G7）全落
- **P1 增强 2 块**（D5 OPC 监控 / 演练报告）全落
- **G10/G11/G13/G13.1/D5/G14 维护期**全落
- **G15/G16/G17 命令层重塑**全落

---

## 3. 业务目标真实达成度

### 3.1 流程层：commands 接入完整度

| Command | 状态 | 接入工具 | 行数 |
|---|---|---|---|
| `/god:prd` | ✅ RFC-0013 路由化 | spec-readiness → prd skill → sign-gate（S1/S2/S3） | ≤30 |
| `/god:doc-sentinel` | ✅ 第 4 command | on/off/status/review 4 子命令 | ≤30 |
| dev / test command | ❌ 已取消 | 迁 `skills/dev-pipeline` + `skills/test-pipeline` | — |

**gap 关闭**：命令层退化为路由表，方法论在 skill，SOP 在 script，3 层职责清晰。

### 3.2 数据层：3 视角演练的"承诺"是否真兑现

3 份 perspectives 演练描述的"5 天 lead scoring 完整闭环"：
- ✅ 写 spec → 写代码 → 写测试 → hooks 拦截 → summary 产出 → 状态机推进
- ✅ 改需求（中途变更）→ ROLLBACK + FORCE 推进（feat 2 实测）
- 🟡 demo 上线（真实跑服务）—— 未做（lead-scoring 是纯函数库）
- 🟡 OPC 验收后 → 知识回流 —— god-trends 是数据回流，**知识回流**已做（incidents/0001 + adrs/0011）

**当前状态**：god 是**多 feature 业务闭环**（2-feature 跨域实测）+ **知识回流闭环**（incidents→ADR 模板化）。**"上线部署"**未做（lead-scoring 纯函数库不涉及）。

### 3.3 体验层：OPC 真体感数据

- god-trends 落地 + 真实 2-feature 演练 L2 档（含 1 次 ROLLBACK）
- sign-gate S1/S2/S3 统一签字管理 → OPC 介入点从 6 个收敛到 3 个 Gate + 1 动态问
- measure-opc-cost 5 维归因 → 真实介入时长可测量

**gap 关闭**：god 有了自我监控 + 注意力预算归因基础设施。

**剩余**：3 个真实 feature 以上的 OPC 实测数据**还没采到**（当前 demo + 跨 feature 演练只 2 个 feature）。

---

## 4. 下一刀怎么切

### 4.1 剩余缺口（1 项 P2）

CLAUDE.md §5 当前显示：**P0 + P1 + P2 基础 + G14 + G15-G17 全部落地**，仅剩 P2 G9 4 视角评审。

| 缺口 | 目标 | 启动条件 | 价值 |
|---|---|---|---|
| **G9 4 视角评审** | 4 角色独立跑 spec-review，4 份报告 + 仲裁 | ≥ 3 个真实项目 feature + G7 已落 | 用户/QA/架构/AI 自审 4 份独立报告 → 仲裁汇总 |

### 4.2 启动条件评估

| 条件 | 当前状态 | 差距 |
|---|---|---|
| G7 spec-render 已落 | ✅（`ddb406b`）| 满足 |
| god 在 ≥ 3 个真实项目跑通过 | 🟡 2 个（demo + 跨 feature 演练）| 差 1 个真实项目 |
| 用户反馈"还有这个痛点" | 🟡 未明确反馈 | 需确认 |

**结论**：G9 启动的硬条件 = 第 3 个真实项目 feature。当前 = 2 个。

### 4.3 推荐路径

| 序 | 任务 | 价值 | 工作量 | 阻塞 |
|---|---|---|---|---|
| **A** | **第 3 个真实项目 feature 演练** | 凑齐 G9 启动条件 + 验证 god 在新领域的适用性 | 2-3 周 | 无 |
| **B** | **G9 4 视角评审 RFC** | 评审维度 + 仲裁逻辑 + 4 份报告模板 | 2-3 周 | A 完成后启动 |

**A 我建议先做**——不凑齐 3 个真实项目，G9 设计无法验证（仲裁逻辑凭 2 个 feature 推不出合理阈值）。

### 4.4 不推荐先做

- ❌ **G9 4 视角评审立即启动**：仲裁逻辑需 ≥ 3 个真实项目数据，现在拍脑袋会设计错
- ❌ **L4 IDE 集成**：CLI 流程未充分稳定
- ❌ **L5 多人 OPC**：当前只服务单人 OPC，多人需求未验证

### 4.5 长期项（不在本轮规划）

| # | 项 | 说明 |
|---|---|---|
| L1 | god 商业模式（开源 / 收费 / 协会）| 演进后期 |
| L2 | god-on-god（用 god 改 god 自身）| G9 启动后可考虑 |
| L3 | demo 多样化（web / API / CLI / 嵌入式）| god 跨域适用验证 |
| L4 | 与 IDE 集成（VSCode / JetBrains plugin）| 远期 |
| L5 | 多人协作 OPC（god 支持 2-3 人 OPC 模式）| 需求未验证 |
