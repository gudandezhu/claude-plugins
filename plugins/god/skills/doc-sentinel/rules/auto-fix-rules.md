---
name: doc-sentinel auto-fix rules
status: stable
description: 9 类 check 的 auto-fix 详细规则。doc-sentinel agent 加载此文件决定每个 finding 的修复方式。
---

# doc-sentinel 9 类 auto-fix 规则

> 主 SKILL.md 引用本文。agent 加载本文件做决策。

---

## V1 版本漂移（check-version-drift.js）

**auto-fix 条件**：plugin.json version 落后 CHANGELOG 最新版本 **且** bump 类型是 PATCH 或 MINOR

**修复步骤**：
1. 读 `docs/CHANGELOG.md` 最新 `## vX.Y.Z` 段
2. 写 `.claude-plugin/plugin.json` 的 `version` 字段为新值
3. 改 CLAUDE.md §10 加新版本行（如 v0.6.0 段）
4. 改 docs/CHANGELOG.md 加新版本段（如果 agent 是触发者）

**禁止**：自动 bump MAJOR 版本（必走 RFC）

**commit 示例**：
```
docs(god): 同步 plugin.json 0.1.0 → 0.4.1（doc-sentinel V1）
```

---

## N1 编号规约（check-numbering.js）

**auto-fix 条件**：3 位编号残留 → 4 位补零（如 `001-x.md` → `0001-x.md`）

**修复步骤**：
1. `git mv docs/rfcs/001-x.md docs/rfcs/0001-x.md`
2. 同步改 `docs/rfcs/0001-x.md` 内部所有 `RFC-001` 引用为 `RFC-0001`
3. 同步改 RFC 编号 4 位补零

**禁止**：
- ❌ 改 RFC/ADR 编号撞车（破坏外部 PR 引用 + 既有 commit hash 引用）
- ❌ 改 RFC 已合并 ADR 的文件名前缀

**commit 示例**：
```
docs(god): 补零 RFC 编号 001-x.md → 0001-x.md（doc-sentinel N1）
```

---

## D1 demo 三件套（check-demo-trio.js）

**auto-fix 条件**：目标 demo 缺 DASHBOARD.md / spec/summary.md / spec/state/.trace **且** lead-scoring 完整

**修���步骤**：
1. `cp demo/lead-scoring/DASHBOARD.md demo/<target>/DASHBOARD.md`
2. `cp demo/lead-scoring/spec/summary.md demo/<target>/spec/summary.md`
3. `cp demo/lead-scoring/spec/state/.trace demo/<target>/spec/state/.trace`
4. 复制后**不**改模板内容（占位待人工填）

**禁止**：写真实数据（不替换 `<placeholder>` 为真实 feature 数据）

**commit 示例**：
```
docs(god): 补齐 demo/task-tracker/ 三件套（doc-sentinel D1）
```

---

## F1 frontmatter status（check-frontmatter.js）

**auto-fix 条件**：SKILL.md / commands.md 顶部无 `status:` 字段

**修复步骤**：
1. 解析文件顶部 `---\n...\n---` 段
2. 若有 frontmatter：插入 `status: stable` 行
3. 若无 frontmatter：顶部加 `---\nstatus: stable\n---\n\n`
4. 跳过骨架文件（含"当前为骨架/待填充"关键词）

**禁止**：
- ❌ 改既有 `status:` 值（避免覆盖）
- ❌ 改 scaffold 模板（如 `templates/spec-summary/v0.1.0.md`）

**commit 示例**：
```
docs(god): 同步 38 个 SKILL.md 加 status: stable（doc-sentinel F1）
```

---

## T1 stale TODO（check-stale-todo.js）

**auto-fix 条件**（agent 决策）：
- 上下文清晰（如 "TODO: 补 X 文档"）→ 替换为实际内容
- 设计意图（如 `dev-gen.js` 桩的 `// TODO: implement SC-001`）→ **保留**
- 占位符（如 "待填充"）→ 替换或加 `<!-- TODO: 原因 + 日期 -->`

**修复步骤**：
1. agent 读 TODO 行上下文（前后 5 行）
2. 判断类型：清晰 / 设计意图 / 占位
3. 清晰 → 替换；意图 → 跳过；占位 → 加 HTML 注释

**禁止**：
- ❌ 删 `dev-gen.js` / `test-gen.js` / `RFC-0007` / `RFC-0008` 的 TODO（设计意图）
- ❌ 改 `incidents/` 下的 TODO（事故描述）

**commit 示例**：
```
docs(god): 替换 3 个清晰 TODO 为实际内容（doc-sentinel T1）
```

---

## P1 路径引用（check-path-references.js）

**auto-fix 条件**：CLAUDE.md / docs/*.md 引用了不存在的 .md / .js / .sh 路径

**修复步骤**：
1. agent 读引用行上下文
2. 判定 4 类：
   - 失效引用（文件被删）→ 删该行
   - 改名后路径（agent 推断）→ 改路径
   - 占位符（如 `../api/{接口文件名}.md`）→ 保留
   - 跨仓库引用（如指向 demo 子目录）→ 保留
3. 选最保守的修复

**禁止**：
- ❌ 删 `<!-- LONG: ... -->` 等元注释
- ❌ 改 `[[wikilink]]` 形式（conventions §1.7 约定）
- ❌ 改 `${CLAUDE_PLUGIN_ROOT}/...` 变量引用

**commit 示例**：
```
docs(god): 删 2 个失效 .md 引用（doc-sentinel P1）
```

---

## G1 G 状态机一致性（check-g-state-machine.js）

**auto-fix 条件**：4 路（CLAUDE.md §5 / roadmap §1 / spec/scripts/*.js / docs/rfcs/）中**3 路一致** + 1 路缺

**修复步骤**：
1. 4 路来源比对
2. 3 路一致时改第 4 路：
   - 缺 roadmap §1 → 加 `| G14 | doc-sentinel | ⏳ 规划中 | ... |`
   - 缺 CLAUDE.md §5 → 在 `已落地` 段加 `**G14**：...`
3. 4 路都不一致 → 报告，不 auto-fix

**禁止**：
- ❌ 改 RFC/ADR 文件名编号（破坏外部引用）
- ❌ 改 `spec/scripts/*.js`（spec 子系统自身）

**commit 示例**：
```
docs(god): 补齐 G14 在 roadmap §1 速览表（doc-sentinel G1）
```

---

## C1 CHANGELOG 日期（check-changelog-dates.js）

**auto-fix 条件**：CHANGELOG.md 版本日期与 `git log --format=%ad` 真实日期**不一致**

**修复步骤**：
1. 读 CHANGELOG.md 所有 `## vX.Y.Z (YYYY-MM-DD)` 段
2. 跑 `git log --format=%ad --diff-filter=A -- "docs/CHANGELOG.md"` 找真实日期
3. 替换为真实日期

**禁止**：
- ❌ 改未来日期（> 今天）— 报告
- ❌ 改缺 `## v` 段 — 报告
- ❌ 改 RFC/ADR 内的日期

**commit 示例**：
```
docs(god): 回填 CHANGELOG.md 真实 commit 日期（doc-sentinel C1）
```

---

## M1 自检（check-self.js）

**auto-fix 条件**：**无**（M1 是元检查，不修文件）

**检查内容**：
1. 9 个 check 脚本自身可 require
2. doc-sentinel 自身不在 .gitignore
3. 上次跑报告 status 合理
4. runs/ 累计增长

**commit 示例**：不 commit（仅写入 runs/.json）

---

## 跨类规则

### 优先级（多 finding 时按此序处理）

1. **N1 撞车**（破坏外部引用，**最优先报告**）
2. **V1 MAJOR**（必走 RFC，**最优先报告**）
3. **C1**（CHANGELOG 是文档门面，优先）
4. **F1 / D1**（高频 auto-fix）
5. **G1 / P1**（4 路对齐 / 路径修复）
6. **T1**（上下文依赖最强，放最后）
7. **M1**（无 auto-fix）

### 跨类冲突

如 V1 + C1 都改 plugin.json + CHANGELOG：
- 第一个 check 写文件后，第二个 check 的 finding 应已**自动消除**（写完就不再 finding）
- 若第二个 check 仍报 → agent 跳过（避免覆盖前一个 check 的产出）

### commit 切分

- 一 check = 一 commit（不堆叠）
- 0 finding → 0 commit
- 1 个 finding → 1 commit
- 同 check 多 finding → 1 commit（避免 micro-commit 爆炸）