---
type: log
status: stable
owner: god 维护组
last_reviewed: 2026-06-16
update_rule: free
related: [../../../CLAUDE.md, ../USER-GUIDE.md]
---

# doc-sentinel 启用 incident

> god 插件 v0.6.0 G14 doc-sentinel 后台文档巡检 agent 启用事故沉淀。
> 关联 ADR：[`../../adrs/0012-doc-sentinel.md`](../../adrs/0012-doc-sentinel.md)
> 关联 SKILL：[`../../../skills/doc-sentinel/SKILL.md`](../../../skills/doc-sentinel/SKILL.md)

---

## 1. 背景

god 插件 v0.4.0 P0 全闭环后，文档维护期完全空白：

- 根 `README.md` 仍是骨架版（写"待填充"），实际 v0.5.0+ P0 已闭环
- `docs/CHANGELOG.md` 5 个版本号全标 `2026-06-16` 同日（git log 真实日期确实同日，但说明版本节奏过快，缺自动同步机制）
- `docs/adrs/0009-spec-render.md` 和 `docs/adrs/0009-god-self-monitoring.md` 编号撞了两次（违反 conventions §1.8）。内部引用已修正：ADR-0009-god-self-monitoring 现指 RFC-0010 god-trends 为前身。
- 3 个 demo 中仅 lead-scoring 完整（DASHBOARD/summary/.trace/archive 全配齐），task-tracker / url-shortener 半残
- 38 个 SKILL.md + 3 个 commands.md 全部无 `status:` frontmatter，草稿/稳定态靠人脑推断
- 0 个 agent 注册（`agents/` 目录不存在），0 个 auto-doc-sync 类脚本/hook

**根本原因**：所有 hooks（G3 pre-commit / post-commit-no-verify / session-end）都是**事件触发**，无**时间触发**维度。开发期一次性写完，维护期无人盯。

---

## 2. 事故

**事故描述**：v0.4.0 阶段 3 视角演练后，god 团队意识到文档维护成本指数增长，但无任何机制拦截。

**影响**：
- README outdated 误导新用户
- ADR/RFC 编号错位破坏外部 PR 引用追溯
- 4 版本同日暴露"无自动版本节奏控制"

**触发**：3 视角演练（`docs/perspectives/03-architect-perspective.md §6`）的"维护期缺口"分析

**修复路径**：ADR-0012 → 9 check + agent + skill → 用户在项目内 `/god:doc-sentinel on` → SessionStart 钩子触发 `claude -p` 脱机跑（v0.7.0+ 主线）

---

## 3. 解决方案

### 3.1 架构

```
cc CronCreate ("17 */4 * * *", durable=true) — **v0.6.0 过渡，v0.7.0 已取消**
  ↓
claude -p "<prompt>" (SessionStart 钩子触发，v0.7.0+ 主线)
  ↓
doc-sentinel 入口
  ├─→ command 编排 (commands/doc-sentinel.md — on/off/status/review 4 子命令)
  ├─→ skill 决策树 (skills/doc-sentinel/SKILL.md)
  └─→ check facade (scripts/doc-sentinel/check-facade.js)
       ├─ V1/N1/D1/F1/T1/P1/G1/C1/M1
       ↓ auto-fix
       git commit (docs(god): xxx)
       ↓ 不 push
       docs/doc-sentinel/runs/<ISO>.json
```

### 3.2 关键设计

1. **三件套混合**（agent + skill + scripts）— 不单一形态
2. **commit 格式**遵循 conventions §3.1 `docs(god): <中文>`
3. **不 git push**（用户决策：本地累积）
4. **9 类 check 全覆盖**（开发期所有痛点维度）
5. **失败兜底**：7 天过期人工续期 / 跑飞不删未完成候选 / git 冲突不重试

### 3.3 与 conventions 冲突的解决

- conventions §1.1 "顶层不增目录" — 走 RFC-0012 例外条款（`agents/` 是新顶层）
- conventions §1.5 "scripts/ 子目录 12 个" — 走 RFC-0012 例外条款（`doc-sentinel/` 是第 13 子目录）
- conventions §1.2 "commands 上限 3" — doc-sentinel 不进 commands/，用 skill 入口

---

## 4. 验证

### 4.1 端到端

```bash
cd /Users/puyifan/project/github/claude-plugins/plugins/god

# 1. dry-run
node scripts/doc-sentinel/check-facade.js . --dry-run

# 2. 实跑（写入 runs/）
node scripts/doc-sentinel/check-facade.js .

# 3. 验证 runs 报告
cat docs/doc-sentinel/runs/<ISO>.json | jq '.summary'

# 4. 跑所有单元测试
for f in scripts/doc-sentinel/*.test.js; do node "$f"; done
```

### 4.2 首跑结果（v0.6.0）

| Check | status | findings |
|---|---|---|
| V1 版本漂移 | warn | 3 |
| N1 编号规约 | warn | 1 |
| D1 demo 三件套 | warn | 4 |
| F1 frontmatter | warn | 42 |
| T1 stale TODO | warn | 49 |
| P1 路径引用 | warn | 58 |
| G1 G 状态机 | warn | 8 |
| C1 CHANGELOG 日期 | **ok** | 0 |
| M1 自检 | warn | 1 |
| **汇总** | **1 ok / 8 warn / 0 fail** | **166** |

**注意**：
- **C1 反预期 ok**：探查阶段假设"4 版本同日 = bug"，实际 git log 真实日期也是 `2026-06-16`（god v0.4.0+ 集中 2 天打穿），C1 不报假阳性，逻辑正确
- **T1 命中过多（49）**：含设计意图 TODO（dev-gen/test-gen 桩），需收紧排除规则（见 §6 后续）

### 4.3 单元测试

42/42 全过：
- `check-version-drift.test.js`: 10
- `check-numbering.test.js`: 6
- `check-frontmatter.test.js`: 8
- `check-path-references.test.js`: 7
- `check-changelog-dates.test.js`: 5
- `report-format.test.js`: 6

---

## 5. 后续待办

### 5.1 ✅ Phase 6（v0.6.0 落地）— 已完成

- [x] 在 cc 会话中执行 `CronCreate(cron="17 */4 * * *", prompt=<agent prompt>, recurring=true, durable=true)` — job `68de6c0c`
- [x] 监控首 24h 确认触发 6 次（每 4h）+ `docs/doc-sentinel/runs/` 增长 6 份 — 实际 9 份（含手动触发）
- [x] 写 `docs/doc-sentinel/README.md` 含"恢复方式"段

### 5.2 ✅ Phase 7（v0.7.0 落地）— 已完成

- [x] 项目级 on/off 开关：`commands/doc-sentinel.md`（4 子命令）+ `scripts/doc-sentinel/{config,install,uninstall,status}.js`
- [x] SessionStart 钩子注册到项目级 `.claude/settings.json`（**不**写 `~/.claude/`）
- [x] e2e 测试：临时项目 install/status/run-headless/uninstall 全流程通过
- [x] USER-GUIDE.md 新增
- [x] T1 收紧排除规则（待 v0.8.0）

### 5.3 v0.8.0 路线

**v0.7.0 已砍掉 cron 路线**——SessionStart 钩子（项目级 .claude/settings.json）是 v0.7.0+ 主线，**无过期、无续期、零维护成本**。god 自身仓的 CronCreate 任务 `68de6c0c` 已取消（v0.7.0 落地时）。

剩余 v0.8.0 待办：

- [ ] T1 收紧排除规则（过滤"SC-XXX 格式说明"等设计意图）
- [ ] `pre-commit.sh` 白名单段（若 future regression 防 spec-validate 误报）
- [ ] agent 类型从 `general-purpose` 升级为 `doc-sentinel` 自有类型
- [ ] 巡检报告暴露到 `docs/doc-sentinel/README.md` 顶部 dashboard
- [ ] GitHub Actions 备选触发（云端跨机器，仅供团队项目可选）

---

## 6. 已知误判（T1 优先）

T1 stale TODO 当前报 49 个文件，需收紧：

- 设计意图类（**应保留**）：
  - `spec/scripts/dev-gen.js:104` `// TODO: implement ${sc.id} — ${sc.name}`
  - `spec/scripts/test-gen.js:131,135` `// TODO: implement test` / `expect(...).toBeDefined();`
  - `docs/rfcs/0007-dev-gen.md:50` / `0008-test-gen.md:52,56` 故意含 TODO 示例
  - `docs/incidents/` 下事故描述中的 TODO

- 格式说明类（**应跳过**）：
  - `SC-XXX` / `AC-XXX` / `FE-XXX` 等格式示例
  - `// Heading format: ### FE-XXX-001 描述`
  - `covers: ["AC-XXX"]` 配置示例

- 真正 stale 类（**应替换**）：
  - `README.md` "当前为骨架 / 功能待填充"
  - 过期 RFC 中的 `// TODO: 实现 X` 但 X 已实现

**修复方向**：在 `check-stale-todo.js` 加 EXCLUDE_PATTERNS，匹配"格式说明类"。

---

## 7. 文档版本

- **v0.7.0** (2026-06-17)：v0.7.0 项目级 on/off 落地（commands + config + install/uninstall + claude -p 脱机 + e2e 测试）。Phase 5/6 标记完成，新增 v0.8.0 路线。
- **v0.1.0** (2026-06-16)：初版 incident 沉淀。