# god

> **god 是 OPC（One Person Company）的软件交付外骨骼。**
> **想法 → demo 是唯一闭环。spec 是 OPC 想法的可追溯投影，不是 god 的全部。**

---

## 1. 目标（4 + 1）

| # | 目标 | 验证手段 |
|---|---|---|
| 1 | OPC 说想法 → god 出可验收的 spec | OPC 看 `summary.md`（人话）能签字，不直接打开 `spec.feature` |
| 2 | 活规格（可改、改完不漂移）| `spec-validate` 14 项全过 + demo 复现新行为 |
| 3 | OPC 介入总时长 < 30 分钟 / feature（L0 纯流程）| god 自动跑完 prd→dev→test，OPC 只在 C1 入口 + 验收出口 |
| 4 | 自动化测试 1:1 绑定 spec | `SC-xxx:` 测试与 `spec.feature` SC 编号一致 |

**3 档分级预算**：L0 30 min（纯流程）/ L1 60 min（1 次 F-XX 崩点）/ L2 90 min（1 次 S1 翻脸）/ L3 标"超预算"（系统失败信号）。

---

## 2. 架构（4 层 + 1 中心 + 1 真相源）

```
L1 commands/         路由表（≤ 30 行/个，v0.7.0+ RFC-0013）
L2 skills/           方法论（≤ 100 行/个，PR review 硬卡）
L3 scripts/          机械工具，可独立 node 跑
L4 hooks+templates   平台注入 + 产物模板

中心 = scenarios（spec.feature 的 SC 列表）
真相源 = spec/ 目录
```

**v0.7.0+ 命令层变化**：命令层 = 路由表（不写方法论），遇 gate 必停下经 `sign-gate` 弹 `AskUserQuestion`，禁止直接拼 `AskUserQuestion`（经 `ask-user` skill 封装）。dev/test 命令已迁到 `skills/dev-pipeline` + `skills/test-pipeline`。

---

## 3. 入口

**主入口**：`/god:prd`（v0.7.0+ RFC-0013 落地，prd skill 一条龙）

```
prd（0 调研 → 1 brainstorm → 2 build-spec → 2.5 readiness → 3a/3b 评审 → 3c S1 签字）
  → dev-pipeline（自动跑 → 末尾 S2 签字放行测试）
  → test-pipeline（自动跑 → 末尾 S3 验收）
```

**OPC 介入点**：3 签字 Gate（S1/S2/S3）+ 1 动态问（C3）。除此外其他环节 AI 全自主。

**OPC 注意力预算**（3 档分级）：L0 30 min / L1 60 min / L2 90 min / L3 = 系统失败。S3 出口自动跑 `measure-opc-cost.js` 算 5 维归因并写验收报告。

---

## 4. 核心约束（3 条铁律 + 5 大防漂移）

1. **需求是入口，规格是中间态，代码/测试是产出**（凭空改代码 = 孤儿代码）
2. **人看得懂是 spec 的第一约束**，AI 看得懂是第二（评审卡住 = 系统失败）
3. **改 spec 是单一入口**（漂移 = 资产腐烂）

**5 大防漂移** v0.4.0 全部落地：spec 状态机 / meta.json / hooks 拦截 / archive 快照 / 3 者绑定（spec ↔ 代码 ↔ 测试 ↔ SC-xxx）。

---

## 5. 维护期

**doc-sentinel 后台文档巡检**（v0.7.2，G14）：

- **机制**：CC `CronCreate` 调度（durable=true），每 30 分钟巡检 9 类文档健康度，按决策树 auto-fix + `git commit`（不 push）
- **9 类 check**：V1 版本漂移 / N1 编号规约 / D1 demo 三件套 / F1 frontmatter / T1 stale TODO / P1 路径引用 / G1 G 状态机 / C1 CHANGELOG 日期 / M1 自检
- **保护**：`spec/spec.feature` / `spec/sources.md` / `docs/adrs/*` 编号 / `commands/*.md` / `spec/scripts/*.js` / MAJOR 版本 = 禁止 auto-fix
- **开关**：`/god:doc-sentinel on [N] | off | status | review`
- **详情**：[`docs/adrs/0012-doc-sentinel.md`](docs/adrs/0012-doc-sentinel.md) + [`skills/doc-sentinel/SKILL.md`](skills/doc-sentinel/SKILL.md)

---

## 6. 已落地的 P0 + P1

| 块 | 落点 | commit |
|---|---|---|
| G1+G2 | spec-cli.js + meta.json schema | `fc31904` |
| G3 | templates/hooks/ + install-hooks.js | `229ab76` |
| G4 | spec-archive.js（18 测）| `5baf747` |
| G5 | dev-gen.js（20 测）| `8b16b3d` |
| G6 | test-gen.js（19 测）| `c039441` |
| G7 | spec-render.js（RFC-0010）| `ddb406b` |
| G8 | spec-summary.js（11 测）| `2644f35` |
| G10 | templates/domain.md v0.1.0 | — |
| G11 | incidents→ADR（templates/incident.md）| — |
| G13 | spec/ 子目录分层 | — |
| G13.1 | init-spec-dir.js（5 测） + spec-lint.js（8 测）| — |
| G14 | doc-sentinel（commands/ + skills/ + 9 scripts/ + cron.js）| v0.7.2 |
| G15 | spec-readiness（RFC-0013，17 测）| v0.7.0 |
| G16 | sign-gate（RFC-0013，18 测）| v0.7.0 |
| G17 | dev-gen phase 前置校验（4 测）| v0.7.0 |
| D5 | measure-opc-cost.js + god-trends.js | v0.5.0 |

**剩余**：P2 = G9 4 视角评审（等 ≥ 3 个真实项目验证后启动）。

---

## 7. 索引地图

详细见 [`CLAUDE.md` §3](CLAUDE.md) 索引图。

- **架构**：[`docs/architecture.md`](docs/architecture.md)
- **spec/ 目录**：[`docs/spec-directory.md`](docs/spec-directory.md)
- **开发规范**：[`docs/conventions.md`](docs/conventions.md)
- **人机协作**：[`docs/human-ai-contract.md`](docs/human-ai-contract.md)
- **失败模式 + 恢复**：[`docs/failure-modes.md`](docs/failure-modes.md)
- **roadmap**：[`docs/roadmap.md`](docs/roadmap.md)
- **变更历史**：[`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- **3 视角演练**：[`docs/perspectives/`](docs/perspectives/)
- **RFC / ADR**：[`docs/rfcs/`](docs/rfcs/) + [`docs/adrs/`](docs/adrs/)
