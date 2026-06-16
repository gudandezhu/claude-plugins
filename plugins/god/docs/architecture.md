# god 架构（4 层 + 1 中心 + 1 真相源）

> 兑现 `CLAUDE.md` §2 承诺：定义 L1/L2/L3/L4 + 中心 + 真相源的**职责边界、跨层调用、禁止事项**。
>
> **本文件 = "为什么这样分"（架构层）**；具体怎么放、命名、文件大小、PR 流程 → [[conventions.md]]（规范层）。
>
> 改 god 方向 → `CLAUDE.md` §2；改本文 → 走 RFC。
> 产物格式 → [[spec-directory.md]]；Gherkin 语法 → [[../spec/SPEC-FORMAT.md]]；评审契约 → [[../skills/spec-review/SKILL.md]]。

---

## 1. 分层总览

```
┌──────────────────────────────────────────────────────────────────────┐
│ L1 commands/      编排（subagent 派遣、阶段门禁）         入口       │
├──────────────────────────────────────────────────────────────────────┤
│ L2 skills/        方法论（一文件一方法，SKILL.md）         脑         │
├──────────────────────────────────────────────────────────────────────┤
│ L3 scripts/ + workflows/  机械工具（独立 node 可跑）       手         │
├──────────────────────────────────────────────────────────────────────┤
│ L4 hooks/ + templates/    平台注入 + 产物模板             骨         │
├──────────────────────────────────────────────────────────────────────┤
│ 中心 = scenarios（spec.feature 的 SC 列表）                心         │
│ 真相源 = spec/（spec.feature + sources.md）              唯一真相     │
└──────────────────────────────────────────────────────────────────────┘
```

- **中心**：scenarios = 系统一切行为的索引。任何功能/修复/Bug 必先回答"对应哪个 SC"。
- **真相源**：spec/ 是唯一可信来源；L1-L4 都不持有真相，只引用/操作真相。

---

## 2. 各层职责（必查表）

| 层 | 路径 | 输入 | 输出 | 典型产物 | 禁止 |
|---|---|---|---|---|---|
| **L1** | `commands/` | 用户意图（自然语言 + 项目目录）| 编排完成的下一阶段产物 | `prd.md`/`dev.md`/`test.md` | 自己写方法论；直接改 `spec/`；不通过 subagent 派发就改代码；产出方法论白皮书 |
| **L2** | `skills/` | 阶段上下文（如 prd 阶段 1 输入 sources.md 草稿）| 下一阶段可消费的方法结论 + 外部化清单 | SKILL.md（方法论） + `rules/*.md`（子规则） + `templates/*`（可选模板） | 写代码；调 L3 workflow；自作主张跑命令；与同名 L1 command 重复定义边界 |
| **L3** | `scripts/`、`workflows/` | 文件路径 + CLI 参数 | 退出码 0/非 0 + stdout/stderr | 校验报告、代码骨架、并行评审产物 | 内嵌自然语言推理；硬编码路径；产出可读散文而非结构化报告 |
| **L4** | `hooks/`、`templates/` | 平台事件（hook）/ 阶段参数（template）| 自动注入 / 渲染产物 | `.json` + `.sh` + 模板文件 | 写业务逻辑；跨项目复用必须先 RFC；模板变量硬编码 |
| **中心** | `spec/spec.feature` 中 `@SC-xxx` 列表 | — | — | SC-001..SC-NNN | 直接修改 spec（必须经 build-spec skill）；给 SC 改 ID；复用已废 SC-ID |
| **真相源** | `spec/sources.md` + `spec/spec.feature` | REQ 草稿 / 已评审 SC 列表 | 被 dev/test 引用的唯一规格 | 见 [[spec-directory.md#1 目录树]] | L1-L4 直接编辑；旁路 build-spec 手改；与代码/测试单边漂移 |

**核心断言**：L1 编排、L2 思考、L3 执行、L4 注入；中心 = 索引；真相源 = 唯一可改的状态。层间不能错位。

---

## 3. 跨层调用规则

### 3.1 调用图（谁能调谁）

```
              ┌──────────┐
              │  L1 com. │  ← 唯一对外入口（用户调用）
              └────┬─────┘
                   │ 加载（Read + 执行内联流程）
                   ▼
              ┌──────────┐
              │  L2 skl  │  ← 方法论由 SKILL.md 承载
              └────┬─────┘
                   │ 调 node / bash（CLI 边界）
                   ▼
              ┌──────────┐
              │ L3 scr/wf│  ← 独立可跑（人/agent 都能直接调）
              └────┬─────┘
                   │ Read/Write 状态
                   ▼
              ┌──────────┐
              │  真相源  │  ← spec/sources.md + spec/spec.feature
              └──────────┘
                   ▲
                   │ 模板渲染/平台事件
              ┌────┴─────┐
              │ L4 hk/tpl│  ← 平台注入（hook 自动触发）+ 模板渲染
              └──────────┘
```

### 3.2 L1 → L2 → L3 → L4 规则

| 上层 | 可调下层 | 调用方式 | 例 |
|---|---|---|---|
| **L1** | L2（必须）、L3（必要时）、L4 模板（必要时） | L2 = Read SKILL.md 后内联执行方法论；L3 = `node ...` CLI；L4 = 渲染模板 | `commands/prd.md` 调 `skills/brainstorm/SKILL.md`，再 `node spec/scripts/spec-validate.js` |
| **L2** | L3（允许）、其他 L2（按 SKILL.md 引用） | L3 = `node`/`bash`；其他 L2 = 在 SKILL.md 中 Read 引用 | `skills/build-spec/SKILL.md` 调 `spec/scripts/spec-validate.js` |
| **L3** | 无（独立 CLI） | 仅 stdin/stdout/CLI 参数 | `node spec/scripts/spec-validate.js <project>` |
| **L4 hooks** | L3 工具（CLI 调用） | hook JSON 配置 `command` 字段 | `hooks/spec-drift.json` → 调 `spec-validate.js` |
| **L4 templates** | 无（被动渲染） | L1/L2 在 prompt 中按模板变量替换 | `templates/task/task-list.json` 被 L1 消费 |

### 3.3 禁止的调用

| 调用 | 禁止原因 |
|---|---|
| **L2 → L1** | skill 不是入口，被 command 编排 |
| **L2 → L2 直接嵌套**（一个 SKILL.md 内 Read 并执行另一个 SKILL.md 的内联方法）| 违反"一份方法一文件" |
| **L3 → L2/L1** | 脚本不是 agent，不能加载 SKILL.md |
| **L3 → L4** | 脚本不渲染模板，不挂 hook |
| **任何层 → 直接编辑 spec/** | 必须经 build-spec skill（单一入口，CLAUDE.md §4.1 铁律 3）|
| **L1 → 跨项目源码** | god 自身不实现产品代码；产出物只引用产品的 spec/code/test |
| **真相源 → 任何层** | 真相是被动的被引用方，不主动触发 |

---

## 4. 禁止事项清单（13 条 + 反例）

> 每条都有"违反 → 报错机制"，可在 PR review / validator / hook 处机械拦截。

| # | 禁令 | 反例 | 拦截机制 |
|---|---|---|---|
| 1 | L1 command 不得自己写方法论，必须 Read SKILL.md 后内联执行 | `prd.md` 内 30 行"如何做 brainstorm" | PR review 必查 |
| 2 | L2 skill 不得产出代码或 commit，只能产出方法结论 + 外部化清单（如 sources.md 草稿）| `brainstorm` SKILL.md 写"修改 game.js..." | `<HARD-GATE>` 字段 + PR review |
| 3 | L3 script 不得内嵌自然语言推理或 LLM 调用 | `spec-validate.js` 调用 claude API 评分 | 人工 review + 零依赖原则（见 [[../spec/SPEC-FORMAT.md#1 设计理念]]）|
| 4 | 任何层不得直接编辑 `spec/spec.feature` 或 `spec/sources.md`，必须经 build-spec skill | `commands/dev.md` 用 Edit 工具改 spec.feature | `build-spec` 流程 + dev 阶段 validator 校验双向绑定 |
| 5 | 任何层不得复用已废 SC-ID 或给 SC 改 ID | `SC-001` 删除后新建场景仍用 `SC-001` | `spec-validate.js` #4/#5（ID 唯一 + 全文件唯一）|
| 6 | 任何层不得绕过 C5 锚点直接进入 dev 阶段 | dev 阶段 spec 无 C5 锚点直接读 spec.feature | `spec-validate.js` #11 + `commands/dev.md` 阶段 1 机械门禁 |
| 7 | L1 不得直接写产品代码，必须经 `/god:dev` 编排（且 dev 必以 spec 为输入）| `prd.md` 在阶段 4 直接写 game.js | `commands/prd.md` 流程编排 |
| 8 | L2 skill 不得调 L1 command（skill 非入口）| build-spec SKILL.md 内调用 `/god:dev` | 流程边界 + 入口唯一 |
| 9 | L3 workflow 不得在无 inputs/outputs schema 的情况下被 L1 调用 | `eval-loop-review.js` 无 `meta` 字段 | workflow 文件必含 `meta` 导出（见 [[../workflows/eval-loop-review.js#L1]] 现有范式）|
| 10 | L4 hook 不得绕过 spec-validate 写 spec 状态（必须 validator 先通过）| hook 直接 Edit spec.feature | hook 必调用 L3 validator，hook JSON schema 校验 |
| 11 | templates/ 不得硬编码项目路径或业务常量 | 模板含 `/Users/fan/project/...` | 模板变量必走 `${VAR}` 或 mustache 替换 |
| 12 | 任何层不得让 `spec-review` reviewer subagent 改 spec 文件（只评不改）| reviewer 在隔离 worktree 中 Edit spec.feature | reviewer prompt 模板明文禁止 + 物理隔离 worktree |
| 13 | 任何层不得在 spec-review 失败时跳过锚点写"通过" | 无评分结果时 sources.md 写"通过" | `spec-validate.js` #11（格式校验）+ PR review |

---

> §5 文件组织、§6 决策树、§7 索引图对照表 → 已迁出到 [[conventions.md §1.1 + §5 + §6 + §7]]（v0.4.1 集中收敛）。
>
> 本文专注"为什么这样分"（职责边界、跨层规则、禁止事项）。具体"放哪/叫啥/多大"看 conventions.md。

---

## 8. 与三条铁律的对应

| 铁律 | 架构如何保障 |
|---|---|
| **铁律 1**：需求→规格→代码/测试 | L1 编排强制 prd→dev→test 顺序；L2 skills 严格分阶段（brainstorm/build-spec/spec-review 互不替代）|
| **铁律 2**：人看得懂第一 | L2 skill 输出"对话+外部化清单"（如 sources.md）而非直接 spec.feature；L1 命令自带 `<HARD-GATE>` 标注 |
| **铁律 3**：改 spec 是单一入口 | §4 #4 双拦截；任何层绕开 build-spec 改 spec 必报 |

### 5 大防漂移机制的架构落点

| 防什么 | 机制 | 架构落点 |
|---|---|---|
| 绕过 build-spec 改 spec | spec-cli.js 强校验 | L3 `spec/scripts/spec-cli.js`（v0.4.0 落） |
| 代码 `@spec` 标了 spec 没的 SC | spec-validate.js #9 | L3 `spec/scripts/spec-validate.js` |
| spec 加 SC 漏写 REQ | spec-cli add --req 强校验 | L3 `spec/scripts/spec-cli.js`（v0.4.0 落） |
| spec 改了代码没改 | pre-commit hook 跑 spec-validate | L4 `templates/hooks/pre-commit.sh`（v0.4.0 G3 落） + `install-hooks.js` 一键装到项目侧 |
| OPC 评审缺失（机制名沿用 PM）| C5 锚点 | L3 `spec-validate.js` #11 + L1 `commands/prd.md` 阶段 3b |

---

## 9. 自检清单（PR review 用）

每改一处 god，按本表逐项过：

- [ ] 改的是 L1/L2/L3/L4 哪一层？放哪/叫啥/多大 → 看 [[conventions.md §5 + §6 + §1]]
- [ ] 是否触碰 `spec/` 直写？→ 必须经 build-spec skill
- [ ] 新文件大小是否超 conventions §6 上限？
- [ ] 新文件命名是否符合 conventions §1？
- [ ] 新文件头是否含必需 frontmatter / meta？
- [ ] 是否违反 §4 任一禁令？
- [ ] 跨层调用是否符合 §3.2？
- [ ] CLAUDE.md §3 索引图是否需要更新？
- [ ] CLAUDE.md §9 三问（系统意义 / roadmap / 三条铁律）是否答完？

任一未通过 = PR 不收。

---

## 10. 版本

- **v0.1.0** (2026-06-16)：初版，定义 L1-L4 + 中心 + 真相源职责边界、跨层调用、13 条禁令、文件组织、决策树、索引对照。
