---
type: log
status: stable
owner: god 维护组
last_reviewed: 2026-06-16
update_rule: free
related: [../CLAUDE.md]
---

# god 文档 changelog

> CLAUDE.md §10 的详细变更历史。**本文件不重复 CLAUDE.md 摘要**，只展开每版做了什么。
>
> **日期说明**：本文件单文件累加，**所有 `## vX.Y.Z` 段括号内日期 = 该文件最后修改日**（不一定是该版本首次 commit 日）。各版本首发 commit 日期以 `git log --diff-filter=A -- <versioned-file>` 为准。

## v0.7.4 (2026-06-17)

**3 项新能力落地**：业务项目 `context/` 知识库 / 本地 deploy / CI/CD（v0.8.0 路线图）。

- **业务项目目录扩义为 `context/`**（新建 `skills/docs/SKILL.md` + 删 `skills/knowledge/SKILL.md`）：`context/README.md` 总览 + `context/feature/` 活规格（强校验）+ `context/domain/D-XXX/`（README + context + incident 三件套）+ `context/{adr,pattern,incident}/` 跨域平铺
- **命名澄清**：业务项目用 `context/`（= 项目上下文）；god 自身保留 `spec/`（= 活规格子系统名）—— **目录名只是壳**
- **新 skills**：`skills/docs/SKILL.md`（业务项目 `context/` 自动整理 + 维护）、`skills/deploy/SKILL.md`（本地 docker compose 部署）
- **新调用契约**：prd 阶段 0 派 `docs-init` subagent 建 `context/`（无 `context/README.md` 时触发）；SC accepted 后派 `docs-sync` subagent 沉淀到 `context/domain/D-XXX/` 或 `context/{adr,pattern,incident}/`；test 阶段 `verified` 后派 `deploy` subagent 写 `Dockerfile` + `docker-compose.yml` + `.env.example`
- **新产物**：`Dockerfile`（多阶段构建）+ `docker-compose.yml`（服务 + 网络 + volume）+ `.env.example`（占位环境变量）+ `context/README.md` + `context/domain/D-XXX/{README,context,incident}.md` + `context/adr/ADR-NNN-*.md` + `context/incident/INC-NNN-*.md`
- **强校验边界（约定）**：`context/feature/*.feature` 强校验（spec-validate 14 项）+ `context/domain/D-XXX/README.md` 强校验（必填字段）。**v0.7.4 仅口头约定，对应 L3 脚本（`context-lint.js`）v0.8.0 落地**。
- **决策类 ADR 必 OPC 显式确认**才写（避免 AI 替 OPC 决策）
- **范围明确**：v0.7.4 **不涉及** k8s / 云 / GitHub Actions / 监控告警 / 全文检索 / 知识图谱（v0.8.0 路线图）
- **不弹 S4 签**：deploy 完成后主 agent 跑回显（产物列表 + OPC 手动 `docker compose up` 步骤）
- **改** `commands/prd.md`：路由表加 `verified` → `sign-gate` → `deploy`；加"知识库契约"和"deploy 契约"段
- **改** `docs/architecture.md` §2.5：阶段 × 架构矩阵加 deploy / docs 列
- **改** `docs/spec-directory.md` §1 + §8：`context/` 扩义说明（业务项目用 / god 自身保留 `spec/`）+ 路径约束表重写

**v0.7.4 不含 HTML 测试报告**——v0.7.4 旧 CHANGELOG 曾宣称"vitest --reporter=html（零成本）"，但实际未实施。**HTML 报告 = v0.8.0 路线图**（test-pipeline skill 加 vitest 配置 + HTML 产物落点规则）。

## v0.7.3 (2026-06-17)

**主 agent 编排契约 + 业务域拆分 + 多会话断点落地**。

- **新编排铁律**：主 agent 永远只编排不干具体活（subagent 物理隔离干具体活）
- **新业务域架构**：`spec/domains/D-XXX/` 目录结构（1 domain 1 spec.feature + 1 README）
- **业务架构真相源修正**：v0.7.4 后 `D-XXX/README.md` 是真相源，`business.md` 由 `arch-summary.js` 派生
- **新 sign-gate 选项**：S1/S2/S3 必含"通过 + 结束本会话"——OPC 主动断点
- **新 session-end hook**：写 `<phase>-checkpoint.md` + 推断下一会话命令
- **新 test-pipeline skill**（之前缺失）：dev → test 链路补齐
- **新图**：`docs/architecture-flow.drawio`（4 阶段 × 6 横切）+ `docs/artifact-flow.drawio`（4 阶段 × 3 产物桶）

## v0.7.2 (2026-06-17)

**doc-sentinel 调度从 SessionStart 钩子 + claude -p 脱机跑改为 CC CronCreate（durable=true）**。

- **新调度机制**：on 调 CC `CronCreate`（durable=true）注入 prompt 到当前 session 队列；off 调 `CronDelete` 删任务；status 调 `CronList` 交叉验证。**完全无 hook 依赖**。
- **新增** `scripts/doc-sentinel/cron.js`：纯函数调度器（`parseOnArgs` / `buildCronExpr` / `buildPrompt`），cron 表达式偏移 7 分避 :00/:30 高峰。
- **新增** `scripts/doc-sentinel/cron.test.js`：25 个单元测试 case（参数解析 + cron 表达式 + prompt 必含串）。
- **改** `install.js`：去掉 `installHook` SessionStart 钩子注册，新增 `cleanupLegacyHook(cwd)` 防御性清理 v0.7.0/v0.7.1 残留。
- **改** `uninstall.js`：保留 `removeHook` 作兜底（v0.7.0/v0.7.1 残留清理）。
- **改** `status.js`：不再探测 SessionStart 钩子，改读 `.claude/scheduled_tasks.json`（项目级 + 用户级双路径）+ `.god/doc-sentinel.json`，输出 `cron: ✓ id=<id> expr='...' 下次 ~HH:MM`；不一致时给 ⚠️ 警告。
- **改** `config.js`：新增 `cronId` 字段 + `recordCronId()` / `clearCronId()` / `readScheduledTasks()`，disable 同步清 cronId。
- **改** `commands/doc-sentinel.md`：on 改"install.js → cron.js 拿 cron 表达式+prompt → CC CronCreate → recordCronId"；off 改"CronList → CronDelete → uninstall.js"；status 调 status.js + CronList 交叉验证。
- **改** `docs/adrs/0012-doc-sentinel.md`：§3.1 架构图改"CC CronCreate 调度"；§3.5 重写 cron 表达式 + prompt 模板（不再硬编码 god 仓路径，${cwd} 注入）；§5 验收改 7 个测试；§7 删"7 天 cron 过期"加"durable 跨 session 落点"；§10 关系表改指向 cron.js；§11 追加 v0.7.2 行。
- **改** `docs/doc-sentinel/USER-GUIDE.md`：§0 / §1 / §3 / §5 / §6 按新机制重写。
- **改** `CLAUDE.md` §3 索引图（`scripts/doc-sentinel/` 注释 + `agents/` 行删除）+ §5 G14 行（v0.7.0 → v0.7.2，含 cron.js 调度器 + 7 个测试）。
- **改** `docs/roadmap.md` §1 G14 行落点列加 `cron.js 调度器`。
- **改** `.claude-plugin/plugin.json`：`version 0.7.1 → 0.7.2`（PATCH），description 更新。
- **频率**：默认 30 min，可调（`on N`，N 区间 [5, 1440] 分钟）。
- **测试**：新增 `cron.test.js` 25 case；其余 6 个 `*.test.js` 不变；合计 7 文件全过。

## v0.7.1 (2026-06-17)

**dogfooding: god 自身仓启用 doc-sentinel**。

- **撤销 v0.7.0 "god 自身仓不巡检"决定**。`commands/doc-sentinel.md` 硬规则 #3 删除；`docs/doc-sentinel/USER-GUIDE.md §5.6` 改"自身仓可用"。
- **自身仓 on**：`/god:doc-sentinel on` 跑通 → `.god/doc-sentinel.json` (enabled=true) + `.claude/settings.json` SessionStart 钩子 + `docs/doc-sentinel/runs/` 三个产物落盘。
- **零代码改动**：`install.js` 用 `isProjectRoot()` 通判，`package.json` + `.git/` 同时存在即通过。自身仓也是普通项目根。
- **ADR-0012 §11** 追加 v0.7.1 行（撤销 v0.7.0 决定，理由：dogfooding 价值 > pre-commit 独占巡检的纯粹性）。

## v0.7.0 (2026-06-17)

**doc-sentinel 项目级 on/off 开关 + `claude -p` 脱机跑 + commands 上限 3→4**。

- **第 4 个 command**：`commands/doc-sentinel.md`（on/off/status/review 4 子命令）。conventions §1.2 改 3→4 例外条款。
- **项目级配置**：`scripts/doc-sentinel/config.js` 读写 `<项目根>/.god/doc-sentinel.json`（git tracked），含 enabled/scope/mode/schedule/checks schema。
- **SessionStart 钩子**：`scripts/doc-sentinel/install.js` 注册到项目级 `.claude/settings.json`（**不**写 `~/.claude/`），`uninstall.js` 移除（**保留其他钩子**）。
- **3 个新脚本**：`config.js` / `install.js` / `uninstall.js` / `status.js` + `run-headless.sh`。
- **plugin.json v0.7.0** 加 `agents` 字段注册 doc-sentinel。
- **USER-GUIDE.md** 新增（用户视角使用方式）。
- **e2e 测试通过**：临时项目 install → status → run-headless → status → uninstall 全流程；settings 合并不覆盖既有钩子；非项目根拒绝。

**关键设计**：
- god 插件安装 ≠ 自动激活（**默认关闭**）
- 范围 = 单项目（不污染用户全局 / 不污染其他项目）
- `claude -p` 脱机跑（独立进程，不抢主 cc）
- 可关闭（off 删钩子 + 保留 audit config）

## v0.6.0 (2026-06-17)

**G14 doc-sentinel 落地 + ADR-0012 合并 + 维护期机制闭环**。

- **新增 `agents/` 顶层目录**（conventions §1.1 走 RFC-0012 例外条款）
- **新增 `scripts/doc-sentinel/` 第 13 子目录**（conventions §1.5 走 RFC-0012 例外条款）
- **9 个 check 脚本**：`scripts/doc-sentinel/check-{facade,version-drift,numbering,demo-trio,frontmatter,stale-todo,path-references,g-state-machine,changelog-dates,self}.js` + `report-format.js`
- **9 类巡检**：V1 版本漂移 / N1 编号规约 / D1 demo 三件套 / F1 frontmatter / T1 stale TODO / P1 路径引用 / G1 G 状态机 / C1 CHANGELOG 日期 / M1 自检
- **1 个 agent**：`agents/doc-sentinel/AGENT.md`（CC CronCreate 每 4h 调起）—— **v0.7.0 撤回**：CC 平台无 AGENT.md 加载机制，agent 概念错误
- **1 个 skill**：`skills/doc-sentinel/SKILL.md` + `rules/auto-fix-rules.md` + `checklists/checklist-categories.md`（决策树 + 9 类 auto-fix 规则）
- **42 单元测试全过**：6 个 test 文件（check-{version-drift,numbering,frontmatter,path-references,changelog-dates}.test.js + report-format.test.js）
- **巡检报告入 git**：`docs/doc-sentinel/runs/<ISO>.json` 累计
- **conventions §1.1 / §1.5 / §5.3** 同步加例外条款
- **roadmap §1 速览表加 G14 行 + §5 依赖图加节点**
- **CLAUDE.md §3 索引图加 agents/ + §5 加 G14 + §10 加 v0.6.0**
- **plugin.json version 0.1.0 → 0.6.0**（MINOR 触发，新顶层目录 + 新子目录）
- **首跑**：9 类 check 全部跑通，1 ok / 8 warn / 0 fail（详情见 incident 0001）

详细设计：[ADR-0012](adrs/0012-doc-sentinel.md)（前身 RFC-0012 v0.6.0 合并改名）
启用 incident：[docs/doc-sentinel/incidents/0001-doc-sentinel-onboard.md](doc-sentinel/incidents/0001-doc-sentinel-onboard.md)

## v0.4.1 (2026-06-16)

**状态同步** —— v0.4.0 落地后，文档与实现错位修复。

- `docs/roadmap.md`：P0 4 块（G1/G2/G3/G8）标 ✅ 已落；M1 里程碑标"已完成"；删除 P0 详细定义段（落到 RFC/ADR）
- `CLAUDE.md §5`：从"差 10 块"改为"P0 已闭环，剩 6 块"
- `docs/spec-directory.md §2`：去掉 `spec-cli.js` / `spec-summary.js` 的"(规划)"标记
- `CLAUDE.md §10 v0.4.0 段`：压成 2 行，详细 changelog 移本文档

## v0.4.0 (2026-06-16)

**3 视角全景演练 + G8 真实实现**。

- **文档**：`docs/perspectives/` 3 份（01-ops 933 行 / 02-dev 742 行 / 03-architect 796 行），含业务/开发/设计/产品 4 类闭环
- **规约**：`docs/conventions.md §1.8` ADR/RFC 4 位补零编号 + 核心数据改必走 RFC
- **RFC-0001** spec-cli 状态机 + **ADR-0001** 6 vs 4 状态决议
- **G8 真实落地**（D2 P0）：`spec/scripts/spec-summary.js` + 11/11 单元测试 + 模板 v0.1.0 + `commands/prd.md §2.5` 自动跑 gen；RFC-0002 转 ADR-0002
- **v0.4.0+ 演进 4 个未做项**：G1+G2 捆绑实现（RFC-0001 待开）、G3 hooks 集成、OPC 预算分级归因

## v0.3.0 (2026-06-16)

**OPC 定位**。§1.1 4 产品目标 + 1 系统目标 + 6 文档全部从"PM/AI/程序员协作"切到"OPC × AI 外骨骼"。新增 §1.3 OPC 注意力预算（< 30 分钟 / feature）。G8 spec-summary 由 P1 升级为 P0（目标 1 唯一验收手段）。

## v0.2.0 (2026-06-16)

补齐 6 子文档（architecture/conventions/human-ai-contract/failure-modes/roadmap/spec-directory），建 `docs/incidents/` 与 `templates/hooks/` 脚手架。索引图"待建"标识全部清除。

## v0.1.0 (2026-06-16)

初版索引地图。
