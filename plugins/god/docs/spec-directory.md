# spec/ 目录约定

> god 活规格子系统的**目录地图**。
> 本文 = `CLAUDE.md` §2/§3 中"spec/ 目录结构"承诺的兑现：树、产物、生命周期、编号、绑定、防漂移落地。
> 详细格式规则 → [[SPEC-FORMAT.md]]；详细校验规则 → [[SPEC-FORMAT.md#7 校验规则]]；评审产物规范 → [[skills/spec-review/SKILL.md]]。

---

## 1. 目录树

最小必含（build-spec 自检通过即存在）：

```
spec/
├── sources.md              # 需求清单（brainstorm 产出 + C1-C6 锚点）— 母本
├── spec.feature            # 行为规格（build-spec 从 sources.md 翻译）— 真相源
└── summary.md              # OPC 验收 1 页纸（顶层，OPC 看的主产物）
```

完整结构（v0.5.0+ G13 落地）：

```
spec/
├── sources.md              # 母本（brainstorm + C1-C6 锚点）
├── spec.feature            # 真相源（Gherkin + @SC-xxx）
├── summary.md              # OPC 验收 1 页纸（G8 自动生成）
├── state/                  # 状态机数据（机器读，不入 git）
│   ├── meta.json           # phase / version / gates / owner
│   └── .trace              # 状态机历史（god-trends 数据源）
├── review/                 # 评审产物（spec-render 产出）
│   └── review-YYYY-MM-DD.md  # 含 D1-D4 自评草稿 + 4 维度评分
├── domain/                 # 领域知识（plan §4.1 B 落地）
│   └── domain.md           # 术语表 / 角色 / 业务流程 / 反模式
└── .archive/               # 历史快照（spec-archive 产出，git 隐藏目录）
    └── <timestamp>_v<version>.tar.gz
    └── .archive-index      # 索引行
```

**目录分组原则**（v0.5.0+）：

| 顶层（OPC 直接看）| 子目录（机器/评审/历史）|
|---|---|
| `sources.md` 母本 | `state/` 状态机数据 |
| `spec.feature` 真相源 | `review/` 评审产物 |
| `summary.md` OPC 验收 | `domain/` 领域知识 |
|  | `.archive/` 历史快照 |

**结构固化**（G13 落地，**所有路径都靠脚本固化，不让 AI 自由放**）：

| 产物 | 固化方式 | 触发命令 |
|---|---|---|
| `state/meta.json` | spec-cli init / advance 自动 | `spec-cli advance <项目>` |
| `state/.trace` | spec-cli advance / rollback 自动 | 同上 |
| `summary.md` | spec-summary gen 自动 | `spec-summary gen <项目>` |
| `review/review-<date>.md` | spec-render 自动（带日期不覆盖）| `spec-render <项目>` |
| `domain/domain.md` | init-spec-dir 建 placeholder，AI 填内容 | `init-spec-dir <项目>` |
| `sources/user-perspectives/_summary.md` | init-spec-dir 建 placeholder | `init-spec-dir <项目>` |
| `domain/`, `review/`, `state/`, `sources/` 子目录 | init-spec-dir 自动 + .gitkeep | `init-spec-dir <项目>` |
| 全部子目录结构 | spec-lint 守门 | `spec-lint <项目>`（prd 3a / dev 0 跑）|

**注**：
- 顶层 3 个文件 OPC 评审/签字时直接看（**prd 全程不许引导 OPC 打开 spec.feature 之外**）
- `state/` / `review/` / `domain/` / `.archive/` 是分组目录，按"谁读"分类：
  - 机器读：state（meta + trace）
  - 评审者读：review
  - 调研者读：domain
  - 历史追溯读：archive
- god 旧版曾把 meta.json / .trace / review.md / domain.md 平铺到 spec/ 顶层，现统一收进子目录
- 兼容：脚本读路径时同时尝试 `state/meta.json` 和 `meta.json`（向后兼容 god 老 demo）

---

## 2. 文件类型表

| 文件名模式 | 位置 | 用途 | 生产者 | 消费者 |
|---|---|---|---|---|
| `SPEC-FORMAT.md` | god 根 | Gherkin 格式 + SC 绑定规则 + 校验项定义 | god 维护者（人工） | 所有 skill / command |
| `sources.md` | spec/ 顶层 | 需求清单（REQ + MoSCoW + M1-M3 Snapshot + C1-C6 锚点）| `brainstorm` skill | `build-spec`、`spec-review`、`spec-validate.js` |
| `spec.feature` | spec/ 顶层 | 行为规格（Gherkin Feature + Scenario + `@SC-xxx`）| `build-spec` skill | `spec-review`、`/god:dev`、`/god:test`、`spec-validate.js` |
| `summary.md` | spec/ 顶层 | OPC 验收 1 页纸（G8 自动生成）| `spec-summary.js` | OPC（不打开 spec.feature 看） |
| `state/meta.json` | spec/state/ | 状态机元数据（phase / version / gates / owner）| `spec-cli.js` | `spec-cli` / `dev-gen` / `test-gen` |
| `state/.trace` | spec/state/ | 状态机历史（god-trends 数据源）| `spec-cli.js` | `god-trends.js` / `measure-opc-cost.js` |
| `review/review-<date>.md` | spec/review/ | 评审 checklist（D1-D4 自评草稿）| `spec-render.js` | `spec-review` 评审者 |
| `domain/domain.md` | spec/domain/ | 领域知识（术语表 / 角色 / 流程 / 反模式）| OPC（prd 阶段 0）| `brainstorm` / `build-spec` / `spec-review` |
| `.archive/<ts>_v<ver>.tar.gz` | spec/.archive/ | 历史快照（git 隐藏）| `spec-archive.js` | `spec-archive restore` |
| `spec/scripts/spec-validate.js` | god spec/scripts/ | 机械校验 14+ 项 | god 维护者 | `/god:prd` 阶段 3a、`/god:dev` 门禁 |
| `spec/scripts/spec-cli.js` | god spec/scripts/ | SC 状态机 6 态 | god 维护者 | `build-spec` / `/god:dev` / `/god:test` S1 |
| `spec/scripts/spec-summary.js` | god spec/scripts/ | 渲染 summary.md | god 维护者 | `/god:prd` 阶段 2.5 |
| `spec/scripts/spec-render.js` | god spec/scripts/ | 渲染 review/<date>.md | god 维护者 | `/god:prd` 阶段 3b |
| `spec/scripts/spec-archive.js` | god spec/scripts/ | 快照 / 回滚 / 列出 | god 维护者 | spec 变更前自动调 |
| `spec/scripts/spec-lint.js` | god spec/scripts/ | spec/ 结构守门 | god 维护者 | `/god:prd` 阶段 3a + `/god:dev` 阶段 0 |
| `spec/scripts/init-spec-dir.js` | god spec/scripts/ | 建好 spec/ 子目录 | god 维护者 | `/god:prd` 阶段 0 一次性 |
| `spec/scripts/dev-gen.js` | god spec/scripts/ | spec → 代码骨架 | god 维护者 | `/god:dev` 阶段 1 |
| `spec/scripts/test-gen.js` | god spec/scripts/ | spec → 测试桩 | god 维护者 | `/god:test` 阶段 2 |
| `spec/scripts/god-trends.js` | god spec/scripts/ | 跨 feature 趋势 | god 维护者 | 自我监控 |
| `spec/scripts/measure-opc-cost.js` | god spec/scripts/ | OPC 介入成本归因 | god 维护者 | `test-pipeline` 阶段 6 出口 |
| `spec/scripts/install-hooks.js` | god spec/scripts/ | 一键装 hooks | god 维护者 | 项目初始化时 |
| `spec/scripts/spec-readiness.js` | god spec/scripts/ | 7 项清晰度校验（[RFC-0013](../rfcs/0013-prd-pipeline.md)）| god 维护者 | prd 阶段 2.5 硬挂 |
| `spec/scripts/sign-gate.js` | god spec/scripts/ | S1/S2/S3 统一签字（[RFC-0013](../rfcs/0013-prd-pipeline.md)）| god 维护者 | 3 个 Gate 必走 |

---

## 3. spec 生命周期（状态机）

由 `/god:prd` 一条龙编排（[RFC-0013](../rfcs/0013-prd-pipeline.md)），skill 承载方法，sign-gate + validator 守门。

```
                    /god:prd 一条龙
                    ─────────────
                    brainstorm  → build-spec  → spec-readiness  → spec-review
   (idea)            ↓             ↓              ↓                  ↓
                     sources.md   spec.feature   7 项校验          D1-D4 评分
                     草稿         v1.0.0         6 硬 + 1 软       ≥ 90 分
                     ↓             ↓              ↓                  ↓
   ┌─────────┐       ╔════ S1 Prd 出口签字 Gate ════╗
   │ drafted │ ────→ ║ reviewed ──→ implemented    ║ → dev-pipeline → S2
   └─────────┘       ╚══════════════════════════════╝
        ↑                                          ↓
        │                                          tests/<file>.spec.*
        │                                          (命名 SC-xxx:)
        │                                          ↓
        │                                    ╔══ S3 Test 出口签字 Gate ══╗
        │                                    ║ verified → accepted         ║
        │                                    ╚═════════════════════════════╝
        │
        │   拒签回退（sign-gate.js 自动处置）:
        │     S1 拒签 → 回 drafted (prd 阶段 1/2 内部)
        │     S2 拒签归因 spec 错 → 回 drafted + @spec-version MAJOR
        │     S2 拒签归因 实现错 → 回 reviewed (重做 dev)
        │     S3 拒签归因 spec 错 → 回 drafted + @spec-version MAJOR
        │     S3 拒签归因 实现错 → 回 implemented (重做 dev)
        └──────────────────────────────────────────────────────────────────
```

**6 个状态**：

| 状态 | 含义 | 落档标志 |
|---|---|---|
| (idea) | 仅口头 / 模糊需求 | 无文件 |
| `drafted` | spec.feature + sources.md 完整、双向绑定通过、`@spec-version 1.0.0` | `build-spec` + spec-validate #1-6 通过 |
| `reviewed` | `drafted` 后跑过 spec-review（≥90 分 或 显式跳过+C5 锚点留痕） | `sources.md` 含 C5 锚点行 |
| `implemented` | 每个 SC 在源码有 `@spec SC-xxx` 标注 | `spec-validate.js` 校验 #7 通过 |
| `verified` | 每个 SC 在测试有 `SC-xxx:` 用例 | `spec-validate.js` 校验 #8 通过 |
| `accepted` | `S3 签字` + 验收报告落档 | S3 锚点 + measure-opc-cost.js 输出 |

**RFC-0013 新规约**：

- **3 签字 Gate** = 状态机硬门禁（不可跳过）
  - S1（reviewed → implemented）= `sign-gate.js --gate S1 --verdict accept`
  - S2（implemented → verified）= `sign-gate.js --gate S2 --verdict accept`
  - S3（verified → accepted）= `sign-gate.js --gate S3 --verdict accept`
- **7 项清晰度校验** = S1 前置（`spec-readiness.js`）
  - 6 硬指标：未决项归零 / REQ 全有 SC / GWT 无 TBD / user-perspectives / summary.md 合规 / C5 锚点
  - 1 软指标：sad-path 覆盖 ≥ 30%
- **拒签自动回退** = 状态机不可跳
  - 拒签必带 `--reason`
  - 拒签归因（spec 错 / 实现错）由 sign-gate skill 强制问 OPC

**强制流转规则**：

1. `drafted` 之前必经 `prd` skill（默认走法）或 `prd-edit` skill（轻量改需求）
2. `drafted → reviewed` 必经 `spec-review` skill；用户跳过必须写 C5 锚点"未跑 + 免责确认"行
3. `reviewed → implemented` 必经 `dev-pipeline` skill + S1 签字 Gate
4. `implemented → verified` 必经 `test-pipeline` skill + S2 签字 Gate
5. `verified → accepted` 必经 S3 签字 Gate（含 measure-opc-cost.js）
6. 任意状态变更需求 → **回 prd 阶段 1/2 重走**（不许原地改 spec.feature）

---

## 4. SC 编号规则

### 4.1 格式与分配

- **格式**：`SC-` + 三位零填充数字（`SC-001`、`SC-012`、`SC-123`）
- **作用域**：全 `spec.feature` 文件内唯一
- **分配方式**：`build-spec` 阶段由 `spec-cli add --req` 强校验自动分配下一个未占用号；CLI 未实现前手动从 `spec-validate.js` 输出中的"已占用 ID"列表挑下一个可用号

### 4.2 复用 / 删除 / 变更

| 操作 | SC ID 行为 | 原因 |
|---|---|---|
| 新增 Scenario | 用下一个未占用号（`spec-cli add --req` 自动 / 手动从 spec-validate 输出挑） | ID 是追溯锚点 |
| 删除 Scenario | **ID 作废不复用** | 历史代码/测试可能仍引用，删除会断链 |
| 改 Scenario 内容 | **不改 ID** | ID 是稳定的语义标识，行为契约变 → 升 MAJOR |
| 改 Scenario tag（如加 `@sad-path`） | 不改 ID | tag 是元数据，不动行为 |
| 把 Scenario 拆成多个 | 原 ID 留给第一个新增场景，其余用新 ID；原 SC 关联的代码/测试需手动迁移 | 保持历史可追溯 |

### 4.3 与版本联动

| `@spec-version` 变更 | SC 操作 | 示例 |
|---|---|---|
| PATCH（修文字、补边界） | 不改 SC | `1.0.0 → 1.0.1` |
| MINOR（新增 Scenario） | 新增 SC 用下一个号 | `1.0.0 → 1.1.0`，加 `SC-005` |
| MAJOR（改已有行为契约） | 改 SC 内容但 ID 不变；如有 SC 被实质替换，标废弃并新增 SC | `1.0.0 → 2.0.0` |

### 4.4 跨 spec.feature 不共享 ID

每个 `spec.feature` 是独立作用域（一个功能一个文件）。SC ID 查重仅在当前文件内执行；跨文件 ID 重号不视为冲突。

---

## 5. REQ ↔ SC 关系

### 5.1 一对多 + 一对一约束

| 方向 | 规则 | 例外 |
|---|---|---|
| REQ → SC | **1 个 REQ 可对应多个 SC**（复杂场景拆分） | `REQ-002 登录` → `SC-003 密码正确`、`SC-004 密码错误` |
| SC → REQ | **1 个 SC 必须对应 1 个 REQ**（双向绑定） | 禁止 SC 无 REQ 归属（孤儿） |
| REQ(oos) → SC | **Out of Scope 不写 SC**，但在 `sources.md` 显式记录（带 REQ-ID） | `REQ-007 不做 SSO` 标 `Out of Scope` |

### 5.2 跨 REQ 共享 SC

**禁止**：1 个 SC 不能同时归属多个 REQ。
**变通**：在 `sources.md` 拆出独立 REQ-id，由 `brainstorm` M2 阶段确认重复 REQ 的合并/拆分。

### 5.3 双向绑定校验

`spec-validate.js` 校验项 #10 强制：

- `sources.md` 每条 REQ 都有归属列（`→ SC-xxx` 或 `Out of Scope`）
- `spec.feature` 每个 SC 都能在 `sources.md` 找到对应 REQ

任一缺失 → FAIL，防止"需求漏嵌"或"凭空多写 Scenario"。

---

## 6. 防漂移机制落地

[[CLAUDE.md#4.2 5 大防漂移机制]] 的逐项落实：

| 防什么 | 机制 | 落地文件 / 工具 | 状态 |
|---|---|---|---|
| 绕过 build-spec 改 spec | `spec-cli.js` 强校验 | `spec/scripts/spec-cli.js` | ✅ 已落（commit `fc31904`）|
| 代码 `@spec` 标了 spec 没的 SC | `spec-validate.js` #9 | `spec/scripts/spec-validate.js` 的 `validate()` 主流程 | ✅ 已实现 |
| spec 加 SC 漏写 REQ | `spec-cli add --req` 强校验 | `spec/scripts/spec-cli.js` | ✅ 已落（commit `fc31904`）|
| spec 改了代码没改 | pre-commit hook 跑 spec-validate | `templates/hooks/pre-commit.sh` + `spec/scripts/install-hooks.js`（装到项目侧）| ✅ 已落（commit `229ab76` G3）|
| OPC 评审缺失（机制名沿用"PM 评审缺失"）| C5 锚点（`sources.md` 强制写入）| `skills/spec-review/SKILL.md#评审产物归档` + `spec-validate.js` #11 | ✅ 已实现 |

**额外已实现的绑定校验**（来自 [[SPEC-FORMAT.md#7 校验规则]]）：

| # | 检查项 | 落地 |
|---|---|---|
| 1-6 | 格式项（文件存在 / Feature 唯一 / version / SC ID 唯一 / GWT 完整）| `spec-validate.js:42-79` |
| 7 | SC 在源码有 `@spec` 标注 | `spec-validate.js:82-97` |
| 8 | SC 在测试有 `SC-xxx:` 用例 | `spec-validate.js:100-` |
| 10 | sources ↔ feature 双向 | `spec-validate.js` #10 |
| 11 | C5 锚点 | `spec-validate.js` #11 |
| 12 | C6 锚点（@intent SC）| `spec-validate.js` #12 |
| 13 | @intent SC 的 Given/Then 形态 | `spec-validate.js` #13 |
| 14 | @sad-path SC 绑定 | `spec-validate.js` #14 |

---

## 7. 与上下游的衔接

| 上游 → spec/ | 产物 / 消费 |
|---|---|
| `/god:prd` 阶段 0（domain.md 加载） | 读 `spec/domain/domain.md` 提供术语统一 |
| `/god:prd` 阶段 1（brainstorm） | 产出 `spec/sources.md` 草稿 |
| `/god:prd` 阶段 2（build-spec） | 产出 `spec/spec.feature` v1.0.0 |
| `/god:prd` 阶段 2.5（spec-readiness） | 跑 `spec-readiness.js` 校验 7 项（6 硬 + 1 软）|
| `/god:prd` 阶段 2.6（spec-summary） | 写 `spec/summary.md`（顶层，OPC 主看）|
| `/god:prd` 阶段 3a（build-spec 自检） | 跑 `spec-validate.js` 校验 #1-6、#10-13 |
| `/god:prd` 阶段 3b（spec-render） | 写 `spec/review/review-<date>.md`（评审 checklist）|
| `/god:prd` 阶段 3c（S1 签字 Gate） | `sign-gate.js --gate S1` 推 phase reviewed → implemented |
| `spec-review` skill | 读 `sources.md` + `spec.feature` + `review/<date>.md`；写 C5 锚点回 `sources.md` |
| `dev-pipeline` skill | 读 `spec.feature`；写代码标注 `@spec SC-xxx`；写 `state/meta.json` 推进 |
| `dev-pipeline` 末尾（S2 签字 Gate） | `sign-gate.js --gate S2` 推 phase implemented → verified |
| `test-pipeline` skill | 读 `spec.feature` + 代码；写测试 `SC-xxx:`；写 `state/.trace` |
| `test-pipeline` 末尾（S3 签字 Gate） | `sign-gate.js --gate S3` 推 phase verified → accepted + 跑 `measure-opc-cost.js` |

| spec/ → 下游 | 产物 / 消费 |
|---|---|
| `spec-archive.js` | 历史快照 → `spec/.archive/<ts>_v<ver>.tar.gz` + `.archive-index` |
| `spec-render.js` | 评审 checklist → `spec/review/review-<date>.md` |
| `spec-summary.js` | OPC 验收摘要 → `spec/summary.md` |
| `god-trends.js` | 读 `spec/state/.trace` 累计 → 跨 feature 报告 |
| `measure-opc-cost.js` | 读 `spec/state/.trace` → OPC 介入 5 维归因 |

---

## 8. 路径与命名约束

| 项 | 约束 |
|---|---|
| `spec/` 目录位置 | 项目根目录的 `spec/`，**不可嵌套** |
| `sources.md` / `spec.feature` / `summary.md` | 顶层，固定文件名（validator 硬编码） |
| `state/` 子目录 | 收 `meta.json` + `.trace`（机器数据）|
| `review/` 子目录 | 收 `review-YYYY-MM-DD.md`（评审产物，日期避免覆盖）|
| `domain/` 子目录 | 收 `domain.md`（领域知识，prd 阶段 0 加载）|
| `.archive/` 子目录 | 收 `<ts>_v<ver>.tar.gz` + `.archive-index`（git 隐藏，spec-archive 产出）|
| 编码 | UTF-8（中文/英文 Gherkin 均可） |
| 一个项目几个 spec.feature | 默认 1 个；多 feature 用 `spec/<feature>/spec.feature` 扩展（**预留**，未实现）|
| 兼容老路径 | 脚本读路径时同时尝试 `state/meta.json` + `meta.json` 等，向后兼容 god 老 demo |

---

## 9. 变更本目录的规则

- **加新产物**：必须先在 [[CLAUDE.md#5 系统级缺口]] 注册为 roadmap 项；本文件 + [[CLAUDE.md#3 索引图]] 同步更新
- **改校验项**：先跑 [[TESTING.md]] L1-L6 全过；改 TESTING.md 加对应 L1 单元场景
- **改文件名 / 路径**：视为破坏性变更，需走 RFC；同步改 `spec-validate.js`、`build-spec`、`spec-review` 三处引用
- **删产物**：先确认无下游消费（grep `spec/scripts/`、`commands/`、`skills/`）

---
