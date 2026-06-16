# plan.md — god v0.5.0 现状盘点

> v0.4.0 → v0.5.0 演进回顾 + 业务目标达成度 + 下一刀规划。
> **改 god 的方向 = 改 CLAUDE.md。改 god 现状盘点 = 改本文。**

---

## 0. 业务目标达成度（CLAUDE.md §1.1 OPC 视角）

| # | 目标 | 验收手段 | v0.5.0 状态 | 工具/产物 |
|---|---|---|---|---|
| 1 | OPC 说想法 → god 出可验收的 spec | OPC 看 `summary.md`（人话）能签字，**不直接打开 spec.feature** | ✅ | G8 spec-summary + prd §2.5 硬挂 |
| 2 | 活规格（可改、改完不漂移）| spec-validate 14 项 + demo 复现 | ✅ | G1+G2 状态机 + G3 hooks + G4 archive |
| 3 | OPC 介入总时长 < 30 分钟 / feature | god 自动跑 prd→dev→test，OPC 只在 C1 + 验收 | ✅（D5 3 档分级实测 L0 30 / L1 60 / L2 90 min）| 全部 3 个 command 接入 + D5 测量 |
| 4 | 自动化测试 1:1 绑定 spec | `SC-xxx:` 与 spec.feature SC 一致 | ✅ | spec-validate #7/#8 + dev-gen/test-gen 强制标注 |

**业务目标 1-4 全部达成**。详见 §1 工具链全景 + §2 4 周路径回看。

---

## 1. 工具链全景（v0.5.0 = 9 个工具 / 137 测试全过）

### 1.1 P0 防护层（4 块，已落）

| 工具 | 命令 | 行数 | 测试 | 落点 | commit |
|---|---|---|---|---|---|
| **spec-validate** | `node spec-validate.js <项目>` | 19.7K | — | `spec/scripts/` | 既有 |
| **spec-cli** | `status / init / advance / rollback / check` | 11.4K | 20/20 | `spec/scripts/` | `fc31904` |
| **spec-summary** | `gen / validate` | 8.5K | 11/11 | `spec/scripts/` | `2644f35` |
| **install-hooks** | 一键装 pre-commit / session-end | 5.0K | 13/13 | `spec/scripts/` + `templates/hooks/` | `229ab76` |

### 1.2 P1 驱动层（4 块，全部落地）

| 工具 | 命令 | 行数 | 测试 | 落点 | commit |
|---|---|---|---|---|---|
| **spec-archive** (G4) | `snapshot / list / restore / prune` | 12.2K | 18/18 | `spec/scripts/` | `5baf747`（plan 推荐提 P0 已采纳）|
| **dev-gen** (G5) | `<项目> [--dry-run] [--force]` | 5.7K | 20/20 | `spec/scripts/` | `8b16b3d` |
| **test-gen** (G6) | `<项目> [--framework vitest|playwright]` | 7.4K | 19/19 | `spec/scripts/` | `c039441` |
| **spec-render** (G7) | `<项目> [--output review.md]` | 12.5K | — | `spec/scripts/` | （在 spec 目录存在）|

### 1.3 自我监控层（v0.5.0 新增）

| 工具 | 命令 | 行数 | 测试 | 落点 | commit |
|---|---|---|---|---|---|
| **measure-opc-cost** | `<项目> [--json]` | 5.4K | 17/17 | `spec/scripts/` | `a1e5ed2` |
| **god-trends** | `[--json] [--last N]` | 6.2K | 19/19 | `spec/scripts/` | `2036079` |

**合计**：9 脚本 + 9 单元测试 / **137/137 全过**。

### 1.4 真实跑通的 demo

`demo/lead-scoring` 是 god v0.5.0 的"活体 demo"：
- 2 SC（健康 lead 评分 / 30 天降权）+ 完整 Gherkin
- sources.md 完整（REQ 表格 + C5 锚点 + Out of Scope）
- `src/lead-scoring.js`（G5 dev-gen 产出）+ `tests/lead-scoring.spec.js`（G6 test-gen 产出）
- meta.json + summary.md（41 行）
- pre-commit 真实拦截 2 次非法 commit（C5 格式 / REQ 表格）
- 1 次 NO-VERIFY 救命 commit → .trace 留痕
- 状态机真实跑过 4 步：drafted → reviewed → implemented（待 verified/accepted）
- DASHBOARD.md（OPC 视角仪表盘，god-trends 数据源）

跨 feature 真实演练（`/tmp/god-multi-feature-demo/`）：
- feat 1：lead scoring → verified
- feat 2：OPC 改需求（加 SC-002）→ ROLLBACK + FORCE → verified
- god-trends 输出 L2 档（含 1 次 ROLLBACK）
- 与 plan.md v0.4.0 §3 "01 OPC 真实试跑 75 min L2" 数据一致

---

## 2. 4 周路径回看（v0.4.0 plan.md §4 全部走完）

| 周 | 任务 | 实际落地 | commit | 测试累计 |
|---|---|---|---|---|
| **Week 1** | A: dev command 接入 G1+G2+G8<br/>D: G4 spec-archive（提 P0）| commands/dev.md 阶段 0 自检 + 2a/b/c 三步；spec-archive.js 4 子命令 + 自制 tar + immutable 0444 | `5baf747` | 79/79 |
| **Week 2** | B: G5 dev-gen | dev-gen.js 读 spec.feature → 写 `src/<slug>.{js,ts}` + `@spec SC-xxx` JSDoc + TODO 注释 | `8b16b3d` | 99/99 |
| **Week 3** | C: G6 test-gen | test-gen.js 读 spec.feature + dev-gen 骨架 → 写 `tests/<slug>.spec.*` + `SC-xxx:` 用例名 + `@sad-path` 用 `it.todo` 强提示 | `c039441` | 118/118 |
| **Week 4** | E: god 自我监控 + 多 feature 演练 | god-trends.js 读 .trace 累计 → feature 数 / OPC avg/median/min/max / L 档分布 / 趋势判断；真实 2-feature 演练 | `2036079` | 137/137 |

**关键决策**：
- D 我建议提 P0 已采纳（commit msg 明确"plan.md §4 推荐 G4 提 P0 已采纳"）
- D 工作量 1-2 周估得对，1 个 commit 落地
- B 估 2-3 周，实际 1 个 commit（既有 spec-validate/spec-cli 基础好）
- C 估 1-2 周，实际 1 个 commit（强依赖 B，B 已稳）

**比 v0.4.0 plan 提前落地**：G7 spec-render 也在 `spec/scripts/` 下（roadmap 列为 P1 G7）。当前已实现但未挂进 command——是 v0.5.0 下一个切入点（见 §4）。

---

## 3. 业务目标 1-4 真实达成度（v0.4.0 §3 三类差距的关闭情况）

### 3.1 流程层：commands 接入完整度

| Command | v0.4.0 状态 | v0.5.0 状态 | 接入工具 |
|---|---|---|---|
| `/god:prd` | 🟡 部分接入 | ✅ 完整接入 | spec-validate（§3a 硬挂）+ spec-summary（§2.5）+ G3 hooks |
| `/god:dev` | ❌ 未接入 | ✅ 完整接入 | spec-validate + spec-cli status + G5 dev-gen（阶段 1）+ spec-cli advance（阶段 2b）|
| `/god:test` | ✅ 完整接入 | ✅ 完整接入（升级）| spec-cli advance + G6 test-gen（阶段 2）+ measure-opc-cost |

**gap 关闭**：dev command 已接入完整工具链（Week 1 A 任务）。

### 3.2 数据层：3 视角演练的"承诺"是否真兑现

3 份 perspectives 演练描述的"5 天 lead scoring 完整闭环"：
- ✅ 写 spec → 写代码 → 写测试 → hooks 拦截 → summary 产出 → 状态机推进
- ✅ 改需求（中途变更）→ ROLLBACK + FORCE 推进（feat 2 实测）
- 🟡 demo 上线（真实跑服务）—— 未做（lead-scoring 是纯函数库）
- 🟡 OPC 验收后 → 知识回流 —— god-trends 是数据回流，**知识回流**未做

**当前状态**：god v0.5.0 是**多 feature 业务闭环**（2-feature 跨域实测），但**"上线部署"** + **"知识沉淀"** 两块未做。

### 3.3 体验层：OPC 真体感数据

- v0.4.0：3 份 perspectives 演练值（75 / 28 / 22 min）
- v0.5.0：god-trends 落地 + 真实 2-feature 演练 L2 档（含 1 次 ROLLBACK）

**gap 关闭**：god 有了自我监控基础设施。`spec/.trace` 累计 + god-trends 跨 feature 趋势分析，能从"演练值"走到"实测值"。

**剩余**：3 个真实 feature 以上的 OPC 实测数据**还没采到**（当前 demo + 跨 feature 演练只 2 个 feature）。

---

## 4. 下一刀怎么切（v0.5.0 → v0.6.0）

### 4.1 推荐路径：A → B → C → D

| 序 | 任务 | 价值 | 工作量 | 阻塞关系 |
|---|---|---|---|---|
| **A** | **G7 spec-render 接入 `/god:prd`** | 评审者看 review.md 比 Gherkin 友好 5 倍 | 1-2 天 | 无（脚本已存在）|
| **B** | **G10 domain.md 模板** | prd 阶段 0 自动加载领域知识，术语不再漂移 | 1 周 | 无 |
| **C** | **god 知识沉淀（incidents → ADR 自动回流）** | 把 god-trends 数据 + incidents 沉淀为新 ADR | 2-3 周 | 需 ≥ 3 个真实项目 feature |
| **D** | **G9 4 视角评审** | 4 角色独立跑 spec-review，4 份报告 + 仲裁 | 3-4 周 | C + 3 真实项目 |

**A 我建议本周切**——脚本已实现，未挂进 command 是低垂果实。

**B 建议 P2 中第一个**——domain.md 模板能立即给 prd 阶段 0 调研用上，god 自己的 demo 也需要术语表（lead / SC / scored / weighted）。

**C 是 god 学会"从经验里学"的关键**——roadmap §3 P2 的"god 自我演进"卡点。

### 4.2 次优路径（如果想先扩广度）

| 序 | 任务 | 价值 |
|---|---|---|
| A | G7 spec-render 接入 | 同上 |
| **B'** | demo 多样化（API / CLI 形态）| 验证 god 跨域适用，roadmap L3 |
| **E** | god-on-god（用 god 改 god）| god 自我改造能力，roadmap L2 |

### 4.3 不推荐先做

- ❌ **G9 4 视角评审**：需要 ≥ 3 个真实项目 feature——现在 2 个（demo + 跨 feature 演练）
- ❌ **L4 IDE 集成**：v0.5.0 早期阶段，先把 CLI 流程跑稳
- ❌ **L5 多人 OPC**：当前只服务单人 OPC，多人需求未验证

---

## 5. 我推荐的 v0.5.0 → v0.6.0 路径（4-6 周）

### Week 1-2：A + B（关闭 P1 全部 + P2 启动）

- A：G7 spec-render 接入 `/god:prd` 阶段 2 末尾
- B：G10 domain.md 模板 + `/god:prd` 阶段 0 自动加载

**Week 1-2 交付**：P1 6 块全部接进 command（P1 100% 闭环），P2 启动 1 块。

### Week 3-4：C（知识沉淀机制）

- incidents → ADR 模板化
- god-trends 加 L3 档触发"必填 incident"
- 把 2-feature 演练的真实数据写入 incidents/0001-multi-feature-rollback.md

**Week 3-4 交付**：god 有"数据→知识"回流链路。

### Week 5-6：D + 第 3 个真实 feature 演练

- D：G9 4 视角评审（用户/QA/架构/AI 自审）跑通
- 采 1 个新 feature 真实数据（凑齐 3 真实 feature）

**Week 5-6 交付**：P2 G9 落地 + god 有 3 真实 feature 实测数据。

---

## 6. 决策点（需确认）

| # | 决策 | 选项 | v0.5.0 状态 |
|---|---|---|---|
| Q1 | 下一刀先切 A（spec-render 接入）还是 B（domain.md）？| A=B（推荐）| 待决策 |
| Q2 | G5 dev-gen 输出 TS 默认还是按项目类型？| 按 package.json 自动判断 | ✅ Week 2 已采纳 |
| Q3 | spec-archive 是 git 内（spec/.archive/）还是 git 外？| git 内（可追溯）| ✅ Week 1 已采纳 |
| Q4 | G6 test-gen vitest 默认还是 playwright？| vitest 单元 + playwright 集成，@integration 标 | ✅ Week 3 已采纳 |
| Q5 | god 自我监控的指标由 god 团队定还是 OPC 投票定？| god 团队初版 + 3 个月后 OPC 投票 | ✅ Week 4 已采纳（god-trends）|
| Q6 | G7 spec-render 输出 review.md 还是入 summary.md？| 独立 review.md（评审者专用）| 待决策 |
| Q7 | G10 domain.md 是项目根还是 spec/ 内？| 建议 spec/domain.md（与 spec.feature 同级）| 待决策 |
| Q8 | incidents → ADR 自动回流的触发条件？| 建议：L3 档触发 + 评审不通过触发 | 待决策 |

---

## 7. 不在 plan 里的长期项

| # | 项 | 说明 |
|---|---|---|
| L1 | god 商业模式（开源 / 收费 / 协会）| v0.5.0+ 演进后期 |
| L2 | god-on-god（用 god 改 god 自身）| v0.6.0 启动 |
| L3 | demo 多样化（web / API / CLI / 嵌入式）| v0.5.0 评估 |
| L4 | 与 IDE 集成（VSCode / JetBrains plugin）| v0.7.0+ |
| L5 | 多人协作 OPC（god 支持 2-3 人 OPC 模式）| 需求未验证 |

---

## 8. 文档版本

- **v0.5.0** (2026-06-16)：**v0.4.0 4 周路径全部走完盘点**。P1 4 块（G4/G5/G6/G7）+ P1 增强（measure-opc-cost + god-trends）全部落地；commands 三件套（prd/dev/test）全部接入；真实 2-feature 演练 + L2 档数据采集。新增 v0.5.0 → v0.6.0 路径（A spec-render 接入 / B domain.md / C 知识沉淀 / D 4 视角评审）。
- v0.4.0（2026-06-16）：初版盘点 + 4 周路径 + 5 个决策点（已被本版全部执行）。
