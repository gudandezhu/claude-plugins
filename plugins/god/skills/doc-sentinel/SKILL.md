---
name: doc-sentinel
status: stable
description: doc-sentinel 后台文档巡检 agent 的方法论决策树。CC CronCreate 每 4h 自动调起；agent 加载本 SKILL.md 决定每个 finding 是 auto-fix / 报告 / 跳过。
---

# doc-sentinel

> god 插件**维护期外骨骼**。每 4 小时巡检 god 仓库所有文档健康度，自动修复 + git commit（**不 push**）。
>
> 设计依据：[`docs/rfcs/0012-doc-sentinel.md`](../../rfcs/0012-doc-sentinel.md) / 合并后 ADR-0012
> 入口：[`agents/doc-sentinel/AGENT.md`](../../agents/doc-sentinel/AGENT.md)
> 机械工具：[`scripts/doc-sentinel/`](../../scripts/doc-sentinel/)（9 个 check 脚本 + 1 个 facade）

---

## 0. 适用场景

- **CC CronCreate 调度**：每 4h 触发 1 次（durable=true）
- **手动触发**：`cd plugins/god && node scripts/doc-sentinel/check-facade.js .` 看报告
- **修复模拟**：`node scripts/doc-sentinel/check-frontmatter.js . --fix`（仅 F1 支持 dry-fix）

---

## 1. 决策树（每 finding 一棵树）

```
finding 来自 9 类 check 中的 1 类
  ↓
属于 auto-fix 范畴？────────────────────────────────────── 否 → 仅报告
  ↓ 是                                                       （写入 runs/<ISO>.json + stderr）
属于 "破坏外部引用" 类？────────────────────────────────── 是 → 报告 + 警告
  ↓ 否                                                       （不 auto-fix，等人工 RFC）
有多个候选 fix？──────────────────────────────────────── 是 → 选最保守
  ↓ 否                                                       （如 N1 撞车只报不改号）
4 路对齐类（G1）→ 4 路中 ≥3 路一致？───────────────────── 是 → 改第 4 路
                                                       否 → 报告
commit 风格？
  - type  = docs(god)
  - scope = god
  - subject = 中文，动词开头，≤ 50 字
  - body = 改动列表 + 来源标识
  - 每 finding 一 commit（不堆叠）
  - 不 git push
  ↓
git commit
  ↓
写 runs/<ISO>.json
  ↓
exit
```

---

## 2. 9 类 check 的修复策略

详见 [`rules/auto-fix-rules.md`](rules/auto-fix-rules.md)。速查：

| ID | auto-fix? | 修复方式 |
|---|---|---|
| V1 版本漂移 | **半** | PATCH 是；MINOR 是（v0.6.0 内）；MAJOR **否**（必走 RFC）|
| N1 编号规约 | **半** | 3 位→4 位补零是；撞车 **否** |
| D1 demo 三件套 | **是** | 从 lead-scoring 复制模板 |
| F1 frontmatter | **是** | 加 `status: stable` |
| T1 stale TODO | **半** | 上下文清晰是；设计意图（dev-gen 桩）跳过 |
| P1 路径引用 | **是** | 删失效引用 / 改路径（agent 选最保守）|
| G1 G 状态机 | **半** | 4 路中 3 路一致时改第 4 路 |
| C1 CHANGELOG 日期 | **是** | 用 commit 真实日期回填 |
| M1 自检 | **否** | 仅报告（脚本可执行性 + 历史对比）|

---

## 3. commit 规范

**格式**（遵循 conventions §3.1）：

```
docs(god): <中文 subject，动词开头，≤ 50 字>

- 改动 1
- 改动 2
- 改动 3

doc-sentinel 自动巡检发现。来源: plugins/god/scripts/doc-sentinel/check-<id>.js
```

**示例**：

```
docs(god): 同步 plugin.json 0.1.0 → 0.4.1（doc-sentinel V1）

- 修复 plugin.json version 漂移
- 对齐 CHANGELOG.md v0.4.1

doc-sentinel 自动巡检发现。来源: plugins/god/scripts/doc-sentinel/check-version-drift.js
```

**作者**：使用 git config user（`fan`），commit message 末尾**不**加 `Co-Authored-By: Claude`（机器 commit 与人工 commit 区分）。

**pre-commit hook**：默认**不**走 `--no-verify`（实测 doc-sentinel 改动不触发 spec-validate 失败范围）。

**禁止 push**：commit 完**不** `git push`，本地累积。

---

## 4. 流程（agent prompt 中也用此流程）

1. **cd 到工作目录**：`cd /Users/puyifan/project/github/claude-plugins/plugins/god`
2. **跑统一入口**：`node scripts/doc-sentinel/check-facade.js .`（或 `--dry-run`）
3. **读 JSON 报告**（agent 用 `cat` 读）
4. **按决策树分类每个 finding**（见 §1）
5. **对 auto-fix 类的 finding 直接改文件**
6. **按检查项分类 `git add` + `git commit`**
7. **写本次跑报告**：`docs/doc-sentinel/runs/<ISO>.json`（facade 自动写）
8. ❌ **不 git push**
9. **exit 0**

---

## 5. 禁止事项（agent prompt 强约束）

- ❌ 改 `spec/spec.feature` / `spec/sources.md`（真相源保护）
- ❌ 改 `docs/adrs/*.md` 的编号（破坏外部引用）
- ❌ 改 `commands/*.md`（commands 上限 3 强约束）
- ❌ 改 `spec/scripts/*.js`（spec 子系统自身，需走 PR）
- ❌ `git push`（用户决策：本地累积）
- ❌ 自动 bump MAJOR 版本（必走 RFC）
- ❌ 加 `Co-Authored-By: Claude`（与人工 commit 区分）
- ❌ 跑超过 30 分钟（防止 agent 跑飞）

---

## 6. 失败兜底

| 场景 | 检测 | 兜底 |
|---|---|---|
| cron 没触发 | 24h 内 0 个新 commit | `CronList` 查任务；不存在则重建 |
| git commit 冲突 | exit code ≠ 0 | 写 runs/.json 的 `error` 字段，不重试 |
| agent 跑飞 > 30min | CC idle timeout | 不删未完成候选；下 cycle 续做 |
| 巡检脚本挂 | exit 2 | runs/.json 写 `fatal`，下 cycle 优先重跑 |
| 7 天 cron 过期 | durable=true 也最多 7 天 | 短期人工每周重建（30s）；中期加周续期 cron |

---

## 7. 与其他文档的关系

| 章节 | 详细在哪 |
|---|---|
| §2 修复策略细节 | [`rules/auto-fix-rules.md`](rules/auto-fix-rules.md) |
| §3 commit 格式来源 | [`../../docs/conventions.md` §3.1](../../conventions.md) |
| §4 agent prompt 模板 | [`../../agents/doc-sentinel/AGENT.md`](../../agents/doc-sentinel/AGENT.md) |
| §5 禁止事项来源 | [`../../docs/rfcs/0012-doc-sentinel.md` §6](../../rfcs/0012-doc-sentinel.md) |
| §6 失败兜底 | [`../../docs/failure-modes.md`](../../failure-modes.md)（新增"doc-sentinel 故障"段）|