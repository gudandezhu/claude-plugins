---
type: spec
status: stable
owner: god 维护组
last_reviewed: 2026-06-16
update_rule: pr-required
related: [../CLAUDE.md, architecture.md]
---

# god 开发规范

> god 内部约束：命名、版本、提交、PR、文件结构。
> 宪法 → [[CLAUDE.md]]；架构 → [[architecture.md]]；spec 目录 → [[spec-directory.md]]；人机契约 → [[human-ai-contract.md]]。
> 本文件不重复"为什么"（在 CLAUDE.md §4 铁律），只定"怎么做"。

---

## 0. 适用范围

- 改 god 自身代码 / 文档 / spec / 脚本 / workflow → 必读
- 用 god 交付外部项目 → 优先沿用；可按本项目 [[spec-directory.md]] 覆盖
- 违反 = PR 不收（CLAUDE.md §9 兜底）

---

## 1. 命名规范

### 1.1 顶层目录

| 目录 | 用途 | 来源 |
|---|---|---|
| `commands/` | L1 编排入口（prd / dev / test / doc-sentinel）| CLAUDE.md §2 |
| `skills/` | L2 方法论（一 skill 一目录）| CLAUDE.md §2 |
| `scripts/` | L3 机械工具（node 可跑）| CLAUDE.md §2 |
| `workflows/` | L3 评审/校验 workflow | CLAUDE.md §2 |
| `hooks/` | L4 顶层 hook 配置（roadmap G3 待集成）| CLAUDE.md §3 |
| `templates/` | L4 产物模板 | CLAUDE.md §3 |
| `spec/` | 活规格子系统自身 | CLAUDE.md §3 |
| `docs/` | 设计/规范/约定 | CLAUDE.md §3 |
| `.claude-plugin/` | 插件元数据 | Claude Code 平台约定 |

> 顶层不增目录。新增模块先问：放哪个 L？问完仍答不出 = 走 RFC。
>
> **例外**：`commands/` 上限 3→4，`doc-sentinel.md` 是第 4 个编排入口（on/off/status/review）。理由：doc-sentinel 是"用户主动开关"的编排动作，不是方法论。详见 [ADR-0012](adrs/0012-doc-sentinel.md)。

### 1.2 commands/

- 文件名 = `/<kebab-case>.md`，**与文件内 command 名一致**
- 数量上限 3：`prd.md` / `dev.md` / `test.md`（[[spec/README.md]] 明确）
- 命名原则：**角色动词**（梳理 / 实现 / 验证），不写技术词（build / generate）
- 例外：commit `306e0ef` 把 `brainstorm.md` 删了，**因为 brainstorm 是 skill 不是编排入口**（bd51203 定型）
- **例外**：`doc-sentinel.md` 由 [ADR-0012](adrs/0012-doc-sentinel.md) 提案为第 4 个 command（维护期编排入口：on/off/status/review 4 子命令）。理由：doc-sentinel 的"用户主动开启/关闭/查看"是**编排动作**而非方法论，符合 command 定位。后续编排类 command 走相同 RFC 路径。

### 1.3 skills/

- 目录名 = `kebab-case`（如 `build-spec` / `spec-review` / `eval-loop`）
- **必带 `SKILL.md`**（平台加载锚点，大写全拼）
- 子目录约定：

| 子目录 | 用途 | 例 |
|---|---|---|
| `rules/` | 强约束规则文档 | `brainstorm/rules/challenge-protocol.md` |
| `phases/` | 多阶段方法论的阶段说明 | `pencil/phases/prototype-creation.md` |
| `prompts/` | 复用 prompt 片段 | `prd/prompts/prd-expert-review.md` |
| `references/` | 长篇参考（容许 1000+ 行）| `prd/references/prd-write-workflow.md` (1455 行) |
| `templates/` | 产出模板 | `prd/templates/prd-consistency-checklist.md` |
| `types/` | 类型/枚举/分类定义 | `eval-loop/types/` |
| `examples/` | 示例（不参与加载）| `mvc/examples/README.md` |
| `scripts/` | skill 自带工具 | `eval-loop/scripts/` |

- 命名原则：**领域 + 动作**（`spec-review` / `tech-selection` / `api-creator`），不写人称（不用 `my-` / `claude-`）

### 1.4 spec 文件

- 文件名 = `spec.feature`（一个功能一个文件，见 `spec/SPEC-FORMAT.md §2`）
- **位置**：`项目的 spec/ 目录` 或 `demo/ 根目录`
- **多 feature 项目**：当前 god 仓**不支持**多 spec 共享目录，规划方向见 [[roadmap]]（如需扩展，目录模式 `spec/<feature>/spec.feature`）
- 配套文件（`spec/sources.md`、`spec/plan.md`）命名按 SPEC-FORMAT §2 约定，**不加 `<name>` 前缀**（与 spec.feature 同目录）

### 1.5 scripts/ 与 workflows/

- 文件名 = `kebab-case.js` / `kebab-case.sh`
- **动词开头**（命令式）：`validate-*` / `check-*` / `gen-*` / `parse-*` / `extract-*` / `init-*` / `merge-*` / `archive-*` / `collect-*`
- 子目录 = 领域：`auth/` / `dev/` / `test/` / `test-design/` / `test-exec/` / `db-design/` / `forensic/` / `workspace/` / `metrics/` / `hooks/` / `lib/` / `__tests__/`（共 12 个）
- 命名原则：**领域即目录**。新脚本先查 12 个现有子目录，找不到再增（`scripts/lib/` 是工具类，跨领域通用）
- 历史注意：曾列 `adapters/` 子目录，但当前 god 仓**未建** `scripts/adapters/`，写文档时不引用
- 测试文件 = `<name>.test.js`，与被测文件同目录（见 `scripts/test/task-cli.test.js` 模式）
- **例外**：`scripts/doc-sentinel/` 由 [ADR-0012](adrs/0012-doc-sentinel.md) 提案为第 13 个领域子目录（后台文档巡检 agent 的机械 check 脚本）

### 1.6 templates/

- 模板 = `<用途>.md` 或 `<用途>.json`
- 前缀 = 角色 / 阶段：`task-detail-backend.md` / `task-list.json` / `iteration-*.md`
- 模板内占位符 = `{花括号}` 包裹，与变量同名（如 `{microservice}` / `{task-name}`），不混用 `<% %>` / `$()`

### 1.7 docs/

- 一级文件 = 索引图指向的子文档（`architecture.md` / `spec-directory.md` / `conventions.md` / `human-ai-contract.md` / `failure-modes.md` / `roadmap.md`）
- 编号子文档（`01-proposal-*.md`）保留在 `proposals/` 子目录，不进 `docs/`
- 跨文档引用 = `[[name]]` 形式（指向文档名，不带 .md 后缀）

### 1.8 docs/rfcs/ + docs/adrs/ 编号规约

> 3 份 perspectives 演练发现 god 历史 PR/RFC 编号格式混乱（0001/001/0008 三种并存），定死规约。

| 项 | 规则 | 例 |
|---|---|---|
| **编号格式** | **4 位补零**，从 0001 开始 | `0001` / `0042` / `0256` |
| **编号永不重置** | god 项目期内连续递增；不复用 | 删了 RFC 0003 不补 0004 |
| **R 命名** | `docs/rfcs/NNNN-<short-kebab>.md` | `0001-spec-cli-state-machine.md` |
| **A 命名** | `docs/adrs/NNNN-<short-kebab>.md` | `0001-spec-lifecycle-6-vs-4-states.md` |
| **R vs A 区别** | **R 描述要做什么**（提案）；**A 描述已经定下什么**（决议）。R 一旦合并 = 改名 A | `0001-rfc-spec-cli` → 合并 → `0001-adr-spec-cli-approved` |
| **谁可以加编号** | 任何人可起草，但 PR 合并前 = 草稿（不占号风险：合同时才正式编号）| — |

**核心数据改 = 必走 RFC**（写进 PR 模板必填段）：

| 改什么 | 是否必走 RFC | 写 ADR 还是 RFC |
|---|---|---|
| spec 状态机增/减状态 | **是** | RFC → 合并 → ADR |
| 三大铁律 | **是** | RFC → 合并 → ADR（CLAUDE.md §0）|
| L1/L2/L3/L4 边界 | **是** | RFC → 合并 → ADR（CLAUDE.md §2）|
| 6 介入点 | **是** | RFC → 合并 → ADR（CLAUDE.md §6）|
| 校验 14 项 | 是（新增项）| RFC（小改动可走 PR）|
| skill/command 增删 | 否（走 PR）| — |
| scripts/ 子目录增删 | **是**（conventions §5 改）| RFC（小改动可走 PR）|
| 命名/版本规则 | 否（走 PR）| — |

**PR 模板必含**：

```markdown
## 关联 RFC / ADR
- [ ] 关联 RFC NNNN: <标题或 "无">
- [ ] 关联 ADR NNNN: <标题或 "无">
- [ ] 若改核心数据（状态机/铁律/分层/介入点）= 必走 RFC；本 PR 已挂载编号
```

---

## 2. 版本号

### 2.1 god 插件版本（`.claude-plugin/plugin.json`）

- 字段：`version: "MAJOR.MINOR.PATCH"`（semver）
- 当前：`<项目>/.claude-plugin/plugin.json` 实际值（git 是真相源）
- 升版触发（**绑 PR 一起改**）：

| 变动 | 升位 |
|---|---|
| 改 CLAUDE.md §1/§2/§4/§6 任一（方向/架构/铁律/介入点）| MAJOR |
| 新增 skill / command / workflow 入口 | MINOR |
| 新增 spec 校验项 / hook / 模板 | MINOR |
| 修复单条 P0/P1 缺陷（不破坏 API）| PATCH |
| 文档润色 / 注释 / typo | PATCH（可攒批）|

> MAJOR 改前必走 RFC（CLAUDE.md §0）。MINOR/PATCH 在 PR 描述里声明即可。

### 2.2 spec 版本（`@spec-version`）

- 字段：`@spec-version X.Y.Z`，Feature 上方，**全文件唯一**
- 规则（`spec/SPEC-FORMAT.md §3.3`）：

| 变 | 升位 | 例 |
|---|---|---|
| 改已有 SC 的行为契约（Given/When/Then 实质改）| MAJOR | `1.x.x → 2.0.0` |
| 新增 SC（新需求）| MINOR | `1.0.0 → 1.1.0` |
| 改文字 / 补边界，不改行为 | PATCH | `1.0.0 → 1.0.1` |
| 删除 SC | MAJOR（ID 作废，**不重用**）| 视同破坏性 |

- **每次改 spec 必升版**（validator 强制，缺升版 = FAIL）

### 2.3 Scenario ID（`SC-xxx`）

- 格式：`SC-` + 三位数字零填充（`SC-001` / `SC-099`）
- 全文件唯一
- **一经分配不复用**（删除 SC 其 ID 永久作废，追溯锚点不能断）
- 改 SC 内容不改 ID

---

## 3. 提交规范

### 3.1 Conventional Commits（god 实际用法）

格式：`<type>(<scope>): <subject>`

| type | 用途 | 实测 commit |
|---|---|---|
| `feat` | 新增能力 / skill / command / hook | `feat(god): @intent & @sad-path 语义 tag` |
| `fix` | 修复缺陷（含 P0/P1 改进）| `fix(brainstorm): Top3 P0 改进(单一事实源+运行模式+证据视角)` |
| `refactor` | 不变行为的代码重组 | `refactor(commands): command 只含流程/机制, 技巧进 skill` |
| `docs` | 文档 / 注释 | `docs(god): spec 系统回归测试手册` |
| `test` | 测试新增/修改 | （与 `fix`/`feat` 合并提交时省略）|
| `chore` | 初始化 / 杂项 | `chore: 初始化 god 插件核心内容` |

### 3.2 scope 规则（从 god git log 提炼）

scope = **改动的子系统 / 目录名**，从下面选：

| scope | 何时用 |
|---|---|
| `god` | 跨子系统（CLAUDE.md / docs / 版本号）|
| `spec` | spec 格式 / validator / SPEC-FORMAT.md |
| `prd` / `dev` / `test` | 对应 command 修改 |
| `commands` | 跨 command 的编排改动 |
| `<skill-name>` | 单个 skill 改动（`brainstorm` / `build-spec` / `spec-review`）|
| `<script-area>` | `auth` / `db-design` / `forensic` 等 scripts 子目录 |
| 不带 scope | 跨多领域且不可枚举时（少见）|

### 3.3 subject 规则

- 中文（与 god 现有 commit 一致，全部中文 subject）
- 一行 ≤ 50 字，动词开头
- 禁：`update` / `change` / `improve` 这类无信息词
- 推荐：`新增` / `删除` / `合并` / `薄化` / `强化` / `豁免` / `重命名` / `修复` / `回归`

### 3.4 body 必含字段

实测 commit 提炼，**body 不超过 6 行**：

```
<一行动机/背景：为什么需要>

- 改动 1: <具体内容>
- 改动 2: <具体内容>
...

设计原则 / 为什么: <一句话，不写口号>
```

修复类必含：

```
集成验证: <场景 1> <场景 2> ...
边界验证: <场景>
回归验证: <旧行为零干扰 / 完全保留>
```

> 不写 emoji，不写"🤖 Generated with Claude Code"（与 author trailer 重复）。
> AI 协助 commit 末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`（实测 fan 的 commit 全有）。

### 3.5 一 commit 一事

- 一个 commit = 一个可独立 revert 的改动
- **禁**：把 `feat` + `refactor` 揉一个；把多 skill 修改堆一个
- 允：`fix(brainstorm): P0 改进(单一事实源+运行模式+证据视角)` 这种**同 P 级别多改进项**合并（实测 a35aa80 模式）

---

## 4. PR 流程

### 4.1 分支策略

- 主分支 = `main`（只接受合入，不直接 push）
- 特性分支 = `feat/<scope>-<short-desc>` 或 `fix/<scope>-<short-desc>`
- 命名前缀（与 commit type 对齐）：`feat/` / `fix/` / `refactor/` / `docs/` / `chore/`
- 分支名 ≤ 50 字符，全 kebab-case

### 4.2 PR 描述模板（与 [[CLAUDE.md]] §9 对齐）

```markdown
## 是什么
<一句话改动摘要>

## 为什么（系统意义）
<回答 3 个问题，对齐 CLAUDE.md §9>
1. 这对 god 这个系统意味着什么？
2. 对应 §5 roadmap 哪一块缺口？
3. 与 §4 三条铁律冲突吗？

## 怎么改
- 改动 1
- 改动 2

## 验证
- L1 单元: <跑了什么>
- L2 集成: <跑了什么>
- 回归: <旧行为零干扰证据>

## 关联
- Closes #<issue>
- 关联 commit: <hash 前 7 位>
- 影响子系统: <spec / commands / skills / ...>
```

### 4.3 Checklist（PR 自检，必勾）

- [ ] 提交前跑过 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js`（如改了 spec）
- [ ] 改了 CLAUDE.md 走 RFC（不在 PR 里偷偷改）
- [ ] 改了 spec 同步升 `@spec-version` + 同步改 `spec/TESTING.md` L1 场景
- [ ] 没引入新顶层目录 / 新建子目录不违反 §1
- [ ] SKILL.md / command.md / script.js 没超行上限（§6）
- [ ] commit 走 Conventional Commits（§3）
- [ ] PR 描述回答了 §4.2 三个问题
- [ ] Co-Authored-By 已加（如 AI 协助）

### 4.4 Reviewer 分配

| 改动类型 | 主 reviewer | 必看 reviewer |
|---|---|---|
| CLAUDE.md 任何改动 | RFC 流程（不开 PR）| 全部维护者 |
| spec 格式 / validator | spec 子系统 owner | dev/test command reviewer |
| command 改动 | 对应 command owner | spec 子系统 owner（防漂移）|
| skill 改动 | skill owner | 引用该 skill 的 command owner |
| script / workflow | scripts 域 owner | — |
| docs/ | docs 维护者 | 涉及子系统的 owner |

- **无 owner 资源** = 留 comment 不强求 LGTM，自主合入
- **跨 2+ 子系统** = 至少 2 reviewer

### 4.5 合入策略

- 1 approval + CI 通过 → squash merge
- commit message 主体 = PR 标题
- 详细历史在 PR body，不在 commit history

---

## 5. 目录子结构

### 5.1 commands/ 直平

```
commands/
├── prd.md       # 需求 → spec（探索 + 固化）
├── dev.md       # spec → 代码
└── test.md      # spec → 测试 → 验收
```

不分子目录，不放非 .md 文件。

### 5.2 skills/<name>/ 标准布局

```
skills/<name>/
├── SKILL.md              # 必带，方法论主体
├── rules/                # 可选：强约束
├── phases/               # 可选：多阶段
├── prompts/              # 可选：复用 prompt
├── references/           # 可选：长篇参考（容许 1000+ 行）
├── templates/            # 可选：产出模板
├── types/                # 可选：类型/分类
├── examples/             # 可选：示例
└── scripts/              # 可选：skill 自带工具
```

8 类子目录够用。**不增新的子目录类型**（如 `data/` / `assets/` 走 examples 或 templates）。

### 5.3 scripts/<area>/ 领域布局

```
scripts/
├── __tests__/            # 跨域测试
├── lib/                  # 跨域工具（ac-assignment-loader / case-hash / ...）
├── adapters/             # 外部系统适配
├── auth/                 # 登录 / 鉴权
├── db-design/            # DB schema 校验
├── dev/                  # 开发期工具
├── doc-sentinel/         # 文档巡检 agent 的机械 check 脚本，[ADR-0012](adrs/0012-doc-sentinel.md)
├── forensic/             # 取证 / 反查
├── metrics/              # 指标采集
├── test/                 # 测试域核心
├── test-design/          # 测试设计
├── test-exec/            # 测试执行
└── workspace/            # 工作区
```

> 实际 = 13 子目录（无 `scripts/hooks/`，含 `doc-sentinel/`）。新增 = 先 13 子目录里挑；都不是 = 走 RFC。

### 5.4 workflows/ 直平

```
workflows/
├── <verb>-<object>.js    # 一文件一 workflow
```

例：`case-gen-parallel.js` / `eval-loop-review.js` / `parallel-review.js` / `quality-fix-loop.js` / `user-perspective-analysis.js`

**workflow = 多步编排（常含 subagent 派发）**，单步工具归 `scripts/`，别混淆。

### 5.5 spec/ 子系统布局

```
spec/
├── SPEC-FORMAT.md        # 格式规范
├── TESTING.md            # spec 系统自身回归手册
├── README.md             # 子系统概览
└── scripts/
    ├── spec-validate.js  # 机械校验（14 项）
    ├── spec-cli.js       # SC 状态机 6 态 + meta.json 读写
    ├── spec-summary.js   # summary.md 渲染
    ├── install-hooks.js  # G3 hook 一键安装
    ├── spec-render.js    # ⏳ 规划中（P1 G7）
    └── spec-archive.js   # ⏳ 规划中（P1 G4）
```

**scripts/ 全部命名 `spec-*.js`**（子系统名前缀），便于一眼区分于 `scripts/` 域脚本。

### 5.6 templates/ 一级领域

```
templates/
├── task/                 # 任务模板
│   ├── task-list.json
│   ├── task-detail-backend.md
│   └── task-detail-frontend.md
└── (新增领域/<name>)     # 一级子目录
```

**领域即一级子目录**，不嵌套。

---

## 6. 文件大小上限

| 文件类型 | 上限 | 超出处理 | 实测最大 |
|---|---|---|---|
| `SKILL.md` | **500 行** | 拆 `phases/` / `references/` / `prompts/` | `brainstorm/SKILL.md` 328 行 |
| `command.md` | **300 行** | 引用 skill，不内联 | `prd.md` 120 行（实测） |
| `script.js`（scripts/）| **400 行** | 拆 lib + 域文件 | `task-cli.js` ~600 行（**已超**，需整改）|
| `workflow.js` | **500 行** | 抽 helper | `case-gen-parallel.js` 439 行 |
| `spec/scripts/*.js` | **800 行**（核心工具放宽）| 拆 module | `spec-validate.js` 482 行（OK）|
| `references/*.md` | **1500 行** | 拆成 N 个 references/ | `prd-write-workflow.md` 1455 行（OK）|
| `commands/<cmd>.md` | **300 行** | 抽 SKILL | `prd.md` 120 行 |

**超限处理流程**：
1. 实测已知超限：`scripts/lib/task-cli.js`（约 600 行）→ 整改拆 `task-cli/`
2. 任何 commit 导致文件超限 → PR 必含拆分 commit
3. `references/` 例外（容许长篇）但需在头部加 `<!-- LONG: XXX 行，导航见 §X -->`

---

## 7. 强约束总结（违规即拒）

| # | 约束 | 条款 |
|---|---|---|
| 1 | command 不内联 skill 内容 | §1.2 + CLAUDE.md §2 |
| 2 | skill 必带 SKILL.md | §1.3 |
| 3 | spec 文件名 = `spec.<name>.feature`，位置 = `spec/` | §1.4 |
| 4 | scripts 文件名 = `kebab-case.js`，动词开头 | §1.5 |
| 5 | 改 spec 必升 `@spec-version` | §2.2 |
| 6 | SC-xxx 不重用，删除作废 | §2.3 |
| 7 | commit 走 Conventional Commits + 中文 subject | §3.1 + §3.3 |
| 8 | 一 commit 一事 | §3.5 |
| 9 | 改 CLAUDE.md 走 RFC，不在 PR 里 | §4.3 |
| 10 | 文件超限必拆 | §6 |

---

## 8. 维护规则

- 本文档改一次 = 一次 PR（不攒批）
- 改完同步在 `CLAUDE.md §3 索引图` 标 ✅（如有变更）
- 新增 skill / command / script 子目录时，本文件 §5 同步加一行
- 版本随 god 插件版本（`.claude-plugin/plugin.json`）绑升
