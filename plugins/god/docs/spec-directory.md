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
└── spec.feature            # 行为规格（build-spec 从 sources.md 翻译）— 真相源
```

扩展可选（评审归档 / 历史快照产生）：

```
spec/
├── sources.md
├── spec.feature
├── archive/
│   └── spec-1.0.0/         # 历史版本快照（spec-archive.js 产出）
│       ├── sources.md
│       └── spec.feature
└── review/                 # spec-review 落档（如评审报告需独立留档）
    └── review-<date>.md    # 评审产物（含 4 维度评分明细）
```

**注**：当前 god 实现里 C5/C6 锚点直接写回 `sources.md` 的 `## Check 结论` 区（见 [[skills/spec-review/SKILL.md#评审产物归档]]）。`review/` 目录是预留扩展位，**默认不存在**，仅当用户显式要求"评审报告独立留档"时才创建。

---

## 2. 文件类型表

| 文件名模式 | 用途 | 生产者 | 消费者 | 关联规范 |
|---|---|---|---|---|
| `SPEC-FORMAT.md` | Gherkin 格式 + SC 绑定规则 + 校验项定义 | god 维护者（人工） | 所有 skill / command | — |
| `sources.md` | 需求清单（REQ + MoSCoW + M1-M3 Snapshot + C1-C6 锚点） | `brainstorm` skill | `build-spec`、`spec-review`、`spec-validate.js`（双向绑定校验） | [[skills/build-spec/SKILL.md#sourcesmd-格式]] |
| `spec.feature` | 行为规格（Gherkin Feature + Scenario + `@SC-xxx`）| `build-spec` skill（唯一入口） | `spec-review`、`/god:dev`、`/god:test`、`spec-validate.js` | [[SPEC-FORMAT.md]] |
| `review/<date>.md` | spec-review 独立报告（4 维度评分 + 扣分明细）| `spec-review` skill | 用户、后续 archive | [[skills/spec-review/SKILL.md]] |
| `TESTING.md` | spec 子系统自身的回归测试手册（L1-L6） | god 维护者（人工） | god 维护者（改 spec 系统前必跑） | [[TESTING.md]] |
| `scripts/spec-validate.js` | 机械校验 14 项 | god 维护者（人工） | `/god:prd` 阶段 3a、`/god:dev` 阶段门禁、CI | [[SPEC-FORMAT.md#7 校验规则]] |
| `scripts/spec-cli.js` | SC 状态机 6 态 + meta.json 读写（v0.4.0 落） | god 维护者（人工） | `build-spec`、`/god:dev`、`/god:test` S1 | [[roadmap.md#§3.2 G1 已落]] |
| `scripts/spec-summary.js` | 渲染 summary.md（v0.4.0 落，11 单元测试） | god 维护者（人工） | `/god:prd` 阶段 2 末尾 | [[roadmap.md#§3.2 G8 已落]] |
| `scripts/spec-render.js` | ⏳ 规划中（P1 G7） | — | — | [[roadmap.md#§3.4 G7]] |
| `scripts/spec-archive.js` | ⏳ 规划中（P1 G4） | — | — | [[roadmap.md#§3.1 G4]] |

---

## 3. spec 生命周期（状态机）

由 `/god:prd` → `/god:dev` → `/god:test` 三个 command 编排，skill 承载方法，validator 守门。

```
                     /god:prd                 /god:dev              /god:test
                     ────────                 ────────              ────────
                     brainstorm              读 spec.feature       读 spec.feature
   (idea)            ↓ load skill             ↓ 实现代码            ↓ 生成测试
                     sources.md 草稿          (标注 @spec SC-xxx)    (命名 SC-xxx:)
                     ↓ build-spec
   ┌─────────┐       spec.feature v1.0.0     src/<file>.<ext>     tests/<file>.spec.*
   │ drafted │ ─────────────────────────→  ─────────────────→  ──────────────→
   └─────────┘                              [implemented]        [verified]
        ↑                                                                │
        │                                                                ↓
        │                                                          /god:test 验收
        │                                                                │
        │   变更回 /god:prd 重走 dev/test（升 MAJOR/MINOR/PATCH）       [accepted]
        └──────────────────────────────────────────────────────────────────┘
```

**6 个状态**：

| 状态 | 含义 | 落档标志 |
|---|---|---|
| (idea) | 仅口头 / 模糊需求 | 无文件 |
| `drafted` | spec.feature + sources.md 完整、双向绑定通过、`@spec-version 1.0.0` | `build-spec` 自检通过 |
| `reviewed` | `drafted` 后跑过 spec-review（≥90 分 或 显式跳过+C5 锚点留痕） | `sources.md` 含 C5 锚点行 |
| `implemented` | 每个 SC 在源码有 `@spec SC-xxx` 标注 | `spec-validate.js` 校验 #7 通过 |
| `verified` | 每个 SC 在测试有 `SC-xxx:` 用例 | `spec-validate.js` 校验 #8 通过 |
| `accepted` | `/god:test` 输出验收报告 + 用户签字 | 验收产物落档 |

**强制流转规则**：

1. `drafted` 之前必经 `/god:prd`（加载 `brainstorm` + `build-spec`），禁止手动写 spec.feature
2. `drafted → reviewed` 必经 `spec-review` skill；用户跳过必须写 C5 锚点"未跑 + 免责确认"行
3. `reviewed → implemented` 必经 `/god:dev`；代码改动必须**含 `@spec SC-xxx` 标注**
4. `implemented → verified` 必经 `/god:test`；测试用例必须**以 `SC-xxx:` 开头命名**
5. `verified → accepted` 必经**用户签字**（6 个必介入点之一）
6. 任意状态变更需求 → **回 `/god:prd` 重走**（不许原地改 spec.feature）

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

| 防什么 | 机制 | 落地文件 / 工具 | 状态（v0.4.0）|
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
| `/god:prd` 阶段 1（brainstorm） | 产出 `spec/sources.md` 草稿 |
| `/god:prd` 阶段 3a（build-spec 自检） | 跑 `spec-validate.js` 校验 #1-6、#10-13 |
| `spec-review` skill | 消费 `spec/sources.md` + `spec/spec.feature`；产出 C5 锚点写回 `sources.md` |
| `/god:dev` | 消费 `spec/spec.feature`；产出代码标注 `@spec SC-xxx` |
| `/god:test` | 消费 `spec/spec.feature` + 代码；产出测试命名 `SC-xxx:` |
| `/god:test` 验收签字 | 写入 `spec/review/`（如启用）|

| spec/ → 下游 | 产物 / 消费 |
|---|---|
| `spec-archive.js`（规划）| 历史版本快照 → `spec/archive/spec-<version>/` |
| `spec-render.js`（规划）| 渲染 review.md 给非作者审阅 |
| `spec-summary.js`（规划）| 渲染产品说明给 OPC（CLAUDE.md §1.1 目标 1）|

---

## 8. 路径与命名约束

| 项 | 约束 |
|---|---|
| `spec/` 目录位置 | 项目根目录的 `spec/`（或 god demo 的根目录），**不可嵌套** |
| `sources.md` 文件名 | 固定，不允许重命名（validator 硬编码） |
| `spec.feature` 文件名 | 固定 |
| 编码 | UTF-8（中文/英文 Gherkin 均可） |
| 一个项目几个 spec.feature | 默认 1 个（一个功能一个文件）；多 feature 项目用目录 `spec/<feature>/spec.feature` 扩展（**当前不支持**，仅作为预留扩展位） |
| `archive/` 命名 | `spec-<MAJOR>.<MINOR>.<PATCH>/`（如 `spec-1.0.0/`）|

---

## 9. 变更本目录的规则

- **加新产物**：必须先在 [[CLAUDE.md#5 系统级缺口]] 注册为 roadmap 项；本文件 + [[CLAUDE.md#3 索引图]] 同步更新
- **改校验项**：先跑 [[TESTING.md]] L1-L6 全过；改 TESTING.md 加对应 L1 单元场景
- **改文件名 / 路径**：视为破坏性变更，需走 RFC；同步改 `spec-validate.js`、`build-spec`、`spec-review` 三处引用
- **删产物**：先确认无下游消费（grep `spec/scripts/`、`commands/`、`skills/`）

---

## 10. 版本

- **v0.1.0** (2026-06-16)：初版。基于 [[SPEC-FORMAT.md]] v1 + [[TESTING.md]] v1 + [[CLAUDE.md]] v0.1.0 同步出齐。
