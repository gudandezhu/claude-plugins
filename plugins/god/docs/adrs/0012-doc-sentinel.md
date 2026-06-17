# ADR-0012: doc-sentinel（维护期后台文档巡检 agent）

> **状态**：✅ 已采纳（v0.6.0）
> **作者**：god 架构组
> **前身 RFC**：原 `docs/rfcs/0012-doc-sentinel.md`（v0.6.0 合并后改名 ADR-0012）
> **关联 3 视角**：[`01-ops-runbook.md`](../perspectives/01-ops-runbook.md)（运维视角的"文档运维成本"问题） / [`02-dev-perspective.md`](../perspectives/02-dev-perspective.md) §6.1（开发视角的"门面 outdated"痛点） / [`03-architect-perspective.md`](../perspectives/03-architect-perspective.md) §6（架构视角的"G14 维护期缺口"）
> **关联 roadmap**：[`docs/roadmap.md §1`](../roadmap.md)（G14 速览行）
> **关联 conventions**：[`docs/conventions.md §1.1`](../conventions.md)（顶层目录约束 + 例外条款） / [`docs/conventions.md §1.5`](../conventions.md)（scripts/ 子目录约束 + 例外条款）

---

## 1. 背���

god 插件 G1-G13/D5 全部聚焦**开发期**（prd→dev→test 闭环）：spec-cli 状态机、hooks 防漂移、spec-summary、spec-archive、dev-gen、test-gen、spec-render、measure-opc-cost、god-trends 等。但**维护期完全空白**——god 自身文档没有自动维护机制，症状：

- **根 `README.md`** 仍写"当前为骨架 / 功能待填充"（实测 v0.5.0+ P0 全闭环），与现状严重漂移
- **`docs/CHANGELOG.md`** 4 个版本号（v0.1.0 / v0.2.0 / v0.3.0 / v0.4.1）全标 `2026-06-16` 同日，但 git log 显示真实 commit 日期分散在 6/14 ~ 6/16 3 天
- **`docs/adrs/0009-spec-render.md` + `docs/adrs/0009-god-self-monitoring.md`** — 编号撞了两次（违反 conventions §1.8）
- **3 个 demo 中 2 个半残**：仅 `lead-scoring` 完整（DASHBOARD.md / spec/summary.md / spec/state/.trace / spec/.archive/ 全配齐），`task-tracker` / `url-shortener` 缺 DASHBOARD.md 等
- **0 个 frontmatter status**：38 个 `SKILL.md` + 3 个 `commands/*.md` 全部无 `status:` 字段，草稿/稳定态靠人脑推断
- **`plugin.json` version 0.1.0** ↔ **`docs/CHANGELOG.md` 最新 v0.4.1** — 漂移 4 个 MINOR 跳
- **0 个 agent 注册**（`agents/` 目录不存在），0 个 auto-doc-sync 类脚本/hook

**根本原因**：所有 hooks（G3 pre-commit / post-commit-no-verify / session-end）都是**事件触发**，无**时间触发**维度。开发期一次性写完，维护期无人盯。

**核心价值**：doc-sentinel 是 god 的**维护期外骨骼**。每 4 小时巡检 god 仓库所有文档健康度，自动修复 + `git commit`，本地累积不 push。覆盖 README / CHANGELOG / roadmap / CLAUDE.md / ADR / RFC / demo docs / 踩坑记录 / 代码与文档漂移 9 个维度。

---

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 每 4 小时自动巡检 god 仓库文档健康度 | CronCreate 调度 + `docs/doc-sentinel/runs/*.json` 累计 |
| 2 | 9 类 check 全覆盖（V1/N1/D1/F1/T1/P1/G1/C1/M1）| `node scripts/doc-sentinel/check-facade.js .` 输出 9 项 status |
| 3 | auto-fix 类 finding 直接改文件 + git commit | `git log --grep="docs(god):"` |
| 4 | commit 格式遵循 conventions §3.1：`docs(god): <中文 subject>` | `git log --oneline` 全 doc-sentinel commit 命中格式 |
| 5 | 巡检报告入 git，便于跨次对比 | `docs/doc-sentinel/runs/<ISO>.json` 累计增长 |
| 6 | 不 git push（本地累积，由人工 push） | `git log origin/main..HEAD` 含 doc-sentinel commits，origin/main 不含 |
| 7 | 误改 spec/ 真相源 → 拦截 | agent prompt 显式禁改 + check-self.js 巡检时校验 |
| 8 | agent 可被 cc CronCreate + durable=true 激活 | `~/.claude/scheduled_tasks.json` 含任务 |

---

## 3. 详细设计

### 3.1 架构：agent + skill + scripts 三件套

```
cc CronCreate ("17 */4 * * *", durable=true)
  ↓ 触发
~/.claude/scheduled_tasks.json  (CC 持久化)
  ↓ enqueue prompt
Claude Code session
  ↓ Task(general-purpose) 派发
doc-sentinel (agents/doc-sentinel/AGENT.md)
  ├─→ skills/doc-sentinel/SKILL.md (决策树)
  └─→ scripts/doc-sentinel/check-facade.js (机械检查)
       ├─ check-version-drift.js   (V1)
       ├─ check-numbering.js       (N1)
       ├─ check-demo-trio.js       (D1)
       ├─ check-frontmatter.js     (F1)
       ├─ check-stale-todo.js      (T1)
       ├─ check-path-references.js (P1)
       ├─ check-g-state-machine.js (G1)
       ├─ check-changelog-dates.js (C1)
       └─ check-self.js            (M1)
  ↓ auto-fix 改文件 + git add + git commit
docs/doc-sentinel/runs/<ISO>.json  (跑报告入 git)
❌ 不 git push
```

**为什么是三件套**（不是单一形态）：

| 形态 | 单独成立? | 理由 |
|---|---|---|
| **agent（决策）** | ✓ | 必须有"读文件→判断→改文件→git commit"的决策回路 |
| **script（机械）** | ✓ | 9 类 check 中 5 类是纯机械的（grep/ls/diff/lint），用 Node.js 最稳定 |
| **skill（方法论）** | ✓ | "巡检决策树 / 修复策略选择"是 L2 方法论 |
| command | ✗ | commands 上限 3（prd/dev/test，conventions §1.2），不占槽位 |
| workflow | △ | workflow 是单步编排，doc-sentinel 是 cron 任务，更像 agent |

### 3.2 9 类 check 详表

| ID | 名称 | 脚本 | 检测方法 | 修复策略 | auto-fix? |
|---|---|---|---|---|---|
| **V1** | 版本漂移 | `check-version-drift.js` | `jq` plugin.json version + grep CHANGELOG `## v` | PATCH auto；MINOR/MAJOR 报告人工 | 半 |
| **N1** | 编号规约 | `check-numbering.js` | `ls docs/rfcs/ docs/adrs/ \| sort` 检查重复 + 3 位编号 | 撞车**不 auto-fix**（破坏外部引用）；3 位 → 4 位补零是 | 半 |
| **D1** | demo 三件套 | `check-demo-trio.js` | `find demo/* -name DASHBOARD.md` + summary.md + .trace | 从 lead-scoring 复制模板填占位 | 是 |
| **F1** | frontmatter 缺失 | `check-frontmatter.js` | 解析 SKILL.md / commands.md 顶部 `---` 段 | 加 `status: stable`（除非是骨架）| 是 |
| **T1** | stale TODO | `check-stale-todo.js` | grep `TODO\|FIXME\|XXX\|待补充\|待填充` 排除 node_modules | "待填充"换实际内容（上下文清晰）| 半 |
| **P1** | 路径引用 | `check-path-references.js` | grep `\(.*\.md\)` 提取 + `fs.existsSync` | 删失效引用 / 改路径 | 是 |
| **G1** | G 状态机 | `check-g-state-machine.js` | CLAUDE.md §5 vs roadmap §1 vs spec/scripts/*.js 4 路对齐 | 4 路中 3 路一致时 fix 第 4 路 | 半 |
| **C1** | CHANGELOG 日期 | `check-changelog-dates.js` | `git log --format=%ad` 真实日期 vs 文件 | 用 commit 真实日期回填 | 是 |
| **M1** | 自检 | `check-self.js` | 上次 runs/*.json status + 本次 check 脚本可执行性 | 报告 | 否 |

### 3.3 统一报告 schema（`report-format.js`）

```json
{
  "timestamp": "2026-06-16T17:00:00Z",
  "duration_ms": 12000,
  "checks": [
    {
      "id": "V1",
      "name": "版本漂移",
      "status": "ok|warn|fail|skip",
      "findings": [
        { "file": ".claude-plugin/plugin.json", "issue": "version 0.1.0", "fix": "→ 0.6.0", "auto_fixed": true }
      ]
    }
  ],
  "summary": { "total": 9, "ok": 7, "warn": 2, "fail": 0, "auto_fixed_count": 12 }
}
```

### 3.4 commit 规范

**格式**（遵循 conventions §3.1）：

```
docs(god): <中文 subject，动词开头，≤ 50 字>

- 改动 1
- 改动 2

doc-sentinel 自动巡检发现。来源: plugins/god/scripts/doc-sentinel/check-<id>.js
```

**commit 切分**：按检查项分 commit（不是按文件数），每类 0~1 个 commit，0 finding 跳过。

**author**：使用 git config user（`fan`），commit message 末尾**不**加 `Co-Authored-By: Claude`（机器 commit 与人工 commit 区分）。

**pre-commit hook**：默认**不**走 `--no-verify`（实测 doc-sentinel 改动不触发 spec-validate 失败范围）。

### 3.5 CronCreate 接入

**cron 表达式**：`17 */4 * * *`（避开 :00 / :30 高峰）

**触发时间**：02:17 / 06:17 / 10:17 / 14:17 / 18:17 / 22:17

**agent prompt 模板**：

```
你是 doc-sentinel。任务：每 4 小时巡检 plugins/god 仓库文档健康度，自动修复后 git commit。

工作目录: /Users/puyifan/project/github/claude-plugins/plugins/god

执行步骤（机械顺序，不要跳）:
1. cd 到工作目录
2. 跑统一入口: node scripts/doc-sentinel/check-facade.js .
3. 读返回的 JSON 报告
4. 按 skills/doc-sentinel/SKILL.md 决策树分类每个 finding
5. 对 auto-fix 类的 finding 直接改文件
6. 按检查项分类 git add + git commit（commit message 见 SKILL.md §commit 规范）
7. 写本次跑报告: docs/doc-sentinel/runs/<ISO 时间戳>.json
8. ❌ 不 git push
9. exit 0

禁止:
- 改 spec/spec.feature / spec/sources.md（真相源保护）
- 改 docs/adrs/*.md 的编号（破坏外部引用）
- 跑超过 30 分钟（防止 agent 跑飞）
```

### 3.6 落点

**新增文件**：

```
plugins/god/
├── agents/doc-sentinel/AGENT.md                              # agent 主体
├── skills/doc-sentinel/
│   ├── SKILL.md                                              # 决策树
│   ├── rules/auto-fix-rules.md                               # 9 类修复模板
│   └── checklists/checklist-categories.md                    # 检查项索引
├── scripts/doc-sentinel/
│   ├── check-facade.js                                       # 统一入口
│   ├── check-version-drift.js      check-version-drift.test.js
│   ├── check-numbering.js          check-numbering.test.js
│   ├── check-demo-trio.js          check-demo-trio.test.js
│   ├── check-frontmatter.js        check-frontmatter.test.js
│   ├── check-stale-todo.js         check-stale-todo.test.js
│   ├── check-path-references.js    check-path-references.test.js
│   ├── check-g-state-machine.js    check-g-state-machine.test.js
│   ├── check-changelog-dates.js    check-changelog-dates.test.js
│   ├── check-self.js               check-self.test.js
│   └── report-format.js
└── docs/doc-sentinel/
    ├── README.md
    ├── runs/.gitkeep
    └── incidents/0001-doc-sentinel-onboard.md
```

**修改文件**：

- `CLAUDE.md` — §3 索引图加 agents/ + scripts/doc-sentinel/ 节点，§5 缺口加 G14，§8 关系表加一行，§10 版本加 v0.6.0 行
- `docs/roadmap.md` — §1 速览表加 G14 行，§5 依赖图加节点
- `docs/conventions.md` — §1.1 顶层目录表加 agents/ 例外条款，§1.5 scripts 子目录加 doc-sentinel/
- `docs/CHANGELOG.md` — 加 v0.6.0 段
- `.claude-plugin/plugin.json` — version 0.1.0 → 0.6.0（MINOR，conventions §2.1）

**RFC/ADR**：

- `docs/rfcs/0012-doc-sentinel.md`（本文件）
- 合并后改名为 `docs/adrs/0012-doc-sentinel.md`

---

## 4. 与 conventions §1.1 / §1.5 冲突的解决方案

**冲突点 1**：conventions §1.1 明确"顶层不增目录，新增模块先问：放哪个 L？答不出走 RFC"。本 RFC 新增 `agents/` 顶层。

**解决方案**：本 RFC 即是 conventions §1.1 兜底的"走 RFC"路径。RFC 通过 = `agents/` 顶层成为 god 插件正式顶层目录。

**冲突点 2**：conventions §1.5 明确 scripts/ 子目录 12 个，新增子目录走 RFC。doc-sentinel 新增 `scripts/doc-sentinel/`。

**解决方案**：本 RFC 一并解决（conventions §1.5 兜底）。RFC 通过后 `scripts/doc-sentinel/` 列为第 13 个领域子目录。

**冲突点 3**：conventions §1.2 明确 commands 数量上限 3。

**解决方案**：doc-sentinel **不**进 commands/，用 skill 入口（`skills/doc-sentinel/SKILL.md`） + `general-purpose` agent 兜底。RFC 通过后再注册 `doc-sentinel` 自有 agent 类型。

---

## 5. 验收

- [ ] `node scripts/doc-sentinel/check-facade.js . --dry-run` 输出 9 类 check 报告
- [ ] 实跑 1 次后 `git log --oneline -10 | grep "^docs(god):"` ≥ 1 行
- [ ] `git log -1 --format=%B | grep "doc-sentinel"` 含来源标识
- [ ] `docs/doc-sentinel/runs/*.json` ≥ 1 份
- [ ] V1 / N1 / F1 / P1 / C1 五类预期 finding 全部命中（基于已知痛点）
- [ ] 9 个 `*.test.js` 单元测试全过
- [ ] `~/.claude/scheduled_tasks.json` 含 doc-sentinel 任务
- [ ] 监控 24h 触发 6 次（每 4h）

---

## 6. 反模式（明确不做）

- ❌ doc-sentinel 改 `spec/spec.feature` / `spec/sources.md`（真相源保护）
- ❌ doc-sentinel 改 `docs/adrs/*.md` 编号（破坏外部引用）
- ❌ doc-sentinel git push（用户决策：本地累积）
- ❌ doc-sentinel 自动 bump MAJOR 版本（必走 RFC）
- ❌ doc-sentinel 改 `commands/*.md`（commands 上限 3 强约束）
- ❌ doc-sentinel 跨仓库聚合（只 god 单仓库）
- ❌ doc-sentinel 报警（只报告，报警是 CI 集成的事）
- ❌ doc-sentinel 加 `Co-Authored-By: Claude`（与 god 既有人工 commit 区分）

---

## 7. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| **7 天 cron 过期** | 高 | 第 2 阶段加周续期 cron `17 9 * * 1`；短期人工每周重建（30s） |
| **首次跑 commit 量爆炸**（41 个 SKILL.md 加 status 预计 1 commit）| 低 | 按 check 分类不按文件分，单次最多 9 commit |
| **plugin.json 0.1.0 → 0.6.0 跨越多版本** | 中 | check-version-drift.js 加 `--max-bump=minor` 默认；MAJOR 必走 RFC |
| **CLAUDE.md 误改** | 中 | SKILL 决策树显式"CLAUDE.md 仅同步 G14 行 + §10 版本行，不动其他段" |
| **误改 spec/ 真相源** | 高 | agent prompt 显式禁改 + check-self.js 巡检时先 git diff name-only 校验 |
| **commit 撞车**（多 agent 并发）| 低 | 跑前 `git status` 检查，dirty 跳过本次 |
| **demo 半残误判** | 低 | D1 明确只复制 lead-scoring 模板，不写真实数据 |

---

## 8. 开放问题

- [ ] 是否在 `commands/dev.md` 加 "跑 doc-sentinel dry-run" 入口？当前仅 cron 触发
- [ ] 是否把 doc-sentinel 巡检报告暴露到 `docs/doc-sentinel/README.md` 顶部 dashboard？当前 runs/ 是 raw JSON
- [ ] 是否集成到 pre-commit hook（如跑 dry-run 报错则 fail）？当前仅 cron + report

---

## 9. 时间线

- **Week 5 Day 1**：RFC 评审 + 目录脚手架 + conventions §1.1/§1.5 改例外条款
- **Week 5 Day 2-3**：9 个 check 脚本 + 9 个测试 + report-format.js
- **Week 5 Day 4**：SKILL 决策树 + agent prompt
- **Week 5 Day 5**：dry-run + 实跑验证 + RFC 转 ADR
- **Week 5 末**：roadmap / CLAUDE.md / plugin.json / CHANGELOG.md 同步 + 启用 incident 沉淀
- **Week 6 起**：CronCreate 激活 + 监控 24h
- **Week 6 末**：周续期 cron 落��

---

## 10. 与其他文档的关系

| 本 RFC 章节 | 详细在哪 |
|---|---|
| §3.2 9 类 check 详表 | `skills/doc-sentinel/SKILL.md`（决策树）+ `rules/auto-fix-rules.md`（修复模板）|
| §3.5 agent prompt | `agents/doc-sentinel/AGENT.md` |
| §3.6 落点文件清单 | `plugins/god/CLAUDE.md §3` 索引图（合并后更新）|
| §4 与 conventions 冲突解决 | `docs/conventions.md §1.1 / §1.5` 例外条款 |
| §7 风险对策 | `docs/failure-modes.md`（新增"doc-sentinel 故障"段）|

---

## 11. 文档版本

- **v0.7.1** (2026-06-17)：**撤销 v0.7.0 的"god 自身仓不巡检"决定**。`commands/doc-sentinel.md` 硬规则 #3 删除；`docs/doc-sentinel/USER-GUIDE.md` §5.6 改为"自身仓可用"。dogfooding 价值 > pre-commit 独占巡检的纯粹性。`install.js` 流程本身已对所有 `isProjectRoot()` 通过的仓一视同仁，无需代码改动。
- **v0.7.0** (2026-06-17)：**v0.6.0 CronCreate 方案废弃**。项目级 on/off 开关 + SessionStart 钩子 + `claude -p` 脱机跑成为主线。v0.6.0 老式 cron 任务 `68de6c0c` 已取消（避免 7 天过期维护负担）。god 自身仓不再用 doc-sentinel 巡检（自身是开发环境，pre-commit hook 守门足够）。详细 v0.7.0 落点见 `docs/CHANGELOG.md` v0.7.0 段 + `commands/doc-sentinel.md` + `docs/doc-sentinel/USER-GUIDE.md`。
- **v0.6.0** (2026-06-16)：RFC 合并 → ADR-0012，状态改"已采纳"，落地实现（9 个 check 脚本 + 1 个 agent + 1 个 skill + 42 测全过）。
- **v0.1.0** (2026-06-16)：初版 RFC。