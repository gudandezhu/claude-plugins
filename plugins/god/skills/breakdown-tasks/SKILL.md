---
status: stable
name: breakdown-tasks
user-invocable: false
description: |
  将技术方案拆分为可执行的任务列表。以**迭代（=一个页面完整 CRUD）**为最小执行单元，每次调用产出一个迭代对应的 task-list.json 与任务详情。

  **输入：**
  - `$WORK_DIR`：需求目录路径
  - 迭代 scope（可选）：单个迭代的边界信息（编号、页面、接口、表、AC 范围、跨迭代依赖）

  触发词：任务拆分、拆分任务、breakdown-tasks、/breakdown-tasks。

  **注意：** 本技能仅负责任务拆分，不生成 SQL 脚本和 API 文档。SQL 脚本由后端开发技能在开发阶段生成，API 文档由 api-creator 技能独立生成。
---

# 任务拆分 Skill

## 核心原则

1. **内容可溯源**：每条业务逻辑、交互、异常分支必须能在 tech-design.md / PRD / UI 设计稿中找到来源
2. **迭代即页面**：一个页面（含完整 CRUD）= 一个迭代，每个迭代独立可验收
3. **粒度适中**：每个任务充分利用 Agent 单 session 容量，同实体 CRUD 默认合并，仅在复杂度超限时拆分
4. **职责边界**：仅负责任务拆分，不生成 SQL 脚本和 API 文档

---

## 输入契约：迭代 scope

本 skill 的所有产出都以**单个迭代**为单元。调用方通过迭代 scope 告知 skill "处理哪个迭代、边界是什么"。

**迭代 scope 数据结构**：

```
迭代编号: IT-XX
页面: [{路由, 组件}]
接口: [{方法, 路径}]
数据库表: [{表名}]
AC范围: [AC-XX..AC-YY]
跨迭代依赖: 如 "IT-02.BE-01 → IT-01.INFRA-01"
```

**两种调用入口**：

| 入口 | 触发条件 | 行为 |
|------|---------|------|
| 完整入口 | 未传入 scope | 执行 **Step 1～2** 自行规划所有迭代，然后**对每个迭代依次执行 Step 3～8** |
| 迭代入口 | 已传入单个 scope | 跳过 Step 1～2，**直接对传入的迭代执行 Step 3～8** |

两种入口的 Step 3～8 完全一致，差异仅在于 scope 是 skill 内部规划还是外部注入。这避免了"主流程 / 旁路"双轨——只有一条管道，入口决定从哪一步起。

> 典型场景：breakdown-task command 完成迭代规划后，对每个迭代独立执行本 skill 的 Step 3～8。

---

## Step 1: 加载全局上下文（仅完整入口执行）

读取以下文档（**必须在生成任何任务前完成**）：
- `$WORK_DIR/design/tech-design.md`
- `$WORK_DIR/requirement/**`
- `$JLC_AI_WORKSPACE/biz-tech-docs/INDEX.md`（通过路由表定位数据库设计等文档）

**GOAL 全局上下文**：将 ac.md 中 GOAL 类 AC（GOAL-XX）作为全局决策指南，贯穿后续所有步骤。拆分决策有歧义时以 GOAL 为准。

## Step 2: 迭代规划（仅完整入口执行）

**必须先列出 tech-design.md 中所有页面/功能模块清单，再划分迭代。**

- 一个页面（含完整 CRUD）对应一个迭代
- 迭代编号：`IT-{两位序号}`
- 每个迭代明确：编号与名称、目标、功能范围（来源章节）、前置依赖
- 输出每个迭代的 scope（见上方契约）

完成后**对每个迭代依次执行 Step 3～8**。所有迭代完成后，额外执行**跨迭代自检**（覆盖、依赖无环、AC 全覆盖），详见 Step 7。

---

## Step 3: 当前迭代上下文加载

无论入口路径，本步起锁定**当前迭代**（完整入口取自 Step 2，迭代入口取自调用方传入）。

读取以下文档（**必须在生成任何任务前完成**）：
- `$WORK_DIR/design/tech-design.md`（全局技术方案）
- `$WORK_DIR/design/ac.md`（优先）→ `$WORK_DIR/requirement/ac.md`（次选），按当前迭代 AC 范围筛选
- 当前迭代涉及的 API 文档（`design/api/` 下对应文件）
- 当前迭代涉及的 UI 设计稿（`requirement/ui/` 下对应文件）

GOAL 类 AC 继续作为决策指南。

---

## Step 4: 功能点溯源表

**必须在拆分任务前完成。** 列出当前迭代涉及的所有功能点，每个功能点标注四个来源文档的锚点，写入 `task-list.json` 的 `features` 数组。

| 列 | 说明 | 格式要求 |
|----|------|---------|
| 功能点 | 功能点名称（动词+对象，如"新增供应商"） | 简洁明确，不允许模糊描述 |
| tech-design | tech-design.md 中的章节锚点 | `tech-design.md#章节标题锚点`（标准 md 锚点：去掉 §/./* 等特殊字符，空格变 `-`，如标题 `## 4.1 接口总览表` → `tech-design.md#41-接口总览表`） |
| prd | prd.md 中的章节锚点 | `prd.md#章节标题锚点`（同上规则） |
| ac | ac.md 中的验收标准编号 | `ac.md#AC-01`（必须引用具体 AC 编号，不允许模糊引用） |
| ui | UI 设计稿路径 | `ui/模块名/页面名.png` 或 `无`（纯后端功能） |

功能点粒度：一个用户可感知的操作或页面级功能，不是接口级也不是模块级。例如"供应商列表查询"、"新增供应商"、"编辑供应商"是三个功能点，而不是合并为"供应商管理"。

---

## Step 5: E2E 路径规划 & 功能点关联

**必须在拆分任务前完成。** 基于 Step 4 的功能点，规划所有可能的 E2E 操作路径，明确功能点之间的关联关系。

**5.1 功能点关联矩阵**

列出功能点之间的关联关系（依赖、前置、互斥、联动），写入 `task-list.json` 的 `feature-relations` 数组。

| 字段 | 说明 | 示例 |
|------|------|------|
| from | 起始功能点 | 查询供应商列表 |
| to | 目标功能点 | 编辑供应商 |
| relation | 关系类型 | `前置`（必须先完成 from 才能触发 to）、`联动`（from 执行后自动触发 to）、`互斥`（from 和 to 不可同时生效） |

**5.2 E2E 操作路径**

穷举所有可能的用户操作路径（正常流 + 异常流 + 边界流），写入 `task-list.json` 的 `e2e-paths` 数组。

每条路径包含：

| 字段 | 说明 | 示例 |
|------|------|------|
| id | 路径编号 | `PATH-01` |
| name | 路径名称（用户视角） | 供应商完整生命周期 |
| type | 路径类型 | `happy`（正常流）、`error`（异常流）、`edge`（边界流） |
| steps | 有序步骤列表 | `["查询供应商列表", "新增供应商", "编辑供应商", "删除供应商"]` |

**路径规划要求**：
- 从 PRD 用户故事和 UI 交互出发，模拟真实用户操作场景
- 每条路径必须是完整可执行的端到端流程，不允许悬空步骤
- 覆盖所有功能点：每个功能点至少出现在一条 E2E 路径中
- 异常流至少覆盖：必填校验、重复数据、权限不足、数据不存在

**5.3 路径覆盖校验**

对照 Step 4 的功能点清单，验证每个功能点都被至少一条 E2E 路径覆盖。未覆盖的功能点必须补充路径或合并到已有路径中。

---

## Step 6: 拆分任务

**任务拆分**：按角色（基础设施/后端/前端）细化，详见 → [`modules/split-rules.md`](modules/split-rules.md)

**AC 分配要求**：
- 每个任务的 frontmatter 必须填充 `acceptance-criteria` 字段，格式为 `- AC-XX: 未验证`（从 ac.md 中分配对应的 AC 编号，值固定为"未验证"，后续验收时直接修改该值）
- **禁止 AC 为空**：每个任务至少分配一个 AC-XX 或 UI-XX。若任务为纯基础设施类（如 Feign 接口、DTO 定义），从最相关的功能 AC 中分配至少一条，并在任务目标中说明关联原因
- BE 任务必须额外填充 `tech-design-sections`（章节锚点）、`api-docs`（API 文档路径）、`tech-design-section-hashes`（章节内容摘要）
- FE 任务必须额外填充 `ui-designs`（UI 设计稿引用）

## Step 7: 依赖分析 & 编号

分析任务间依赖（含跨迭代），构建 DAG。**前端和后端任务完全独立，互不依赖**，各自在角色内部构建依赖链。

编号规则：迭代内从 01 开始，`{角色前缀}{序号}-{任务简称}`
- `BE-` 后端、`FE-` 前端

**phases 分组规则（拓扑分层）**：
- phases 按**拓扑排序分层**：被依赖的任务排在前面，依赖它的排在后面
- **同层无依赖的任务合并到同一个 phase**，可并行执行
- 不同层（有依赖关系）分属不同 phase，严格串行
- 典型结构：phase 1（基础设施）→ phase 2（后端+前端并行）
- 示例：INFRA-01 + BE-01 + FE-01 → 2 个 phase：`[INFRA-01]`、`[BE-01, FE-01]`

**INFRA 任务规则**：
- 仅以下场景拆分独立 INFRA 任务：数据库迁移（始终独立）、引入新 SDK/依赖（需配置类+初始化）、被两个及以上 BE 任务共享的领域模型/DTO、全局性基础设施
- 只被一个 BE 任务使用的 Entity/DTO/VO，内联到该 BE 任务中，不独立成 INFRA 任务
- INFRA 任务排在所有 BE 任务之前，编号为 `INFRA-01`、`INFRA-02`...
- summary 中 `infra` 计数必须与实际 INFRA 任务数量一致

## Step 8: 自检验证

每完成一个迭代拆分立即自检，详见 → [`modules/self-check.md`](modules/self-check.md)

**AC 全覆盖检查**：自检时额外验证 ac.md 中所有 AC-XX 和 UI-XX 至少被一个任务的 `acceptance-criteria` 引用（GOAL 类作为全局上下文，不要求逐条分配）。

不通过则回到 Step 4 调整。

**跨迭代自检的责任划分**：
- 完整入口：所有迭代完成后由本 skill 统一执行跨迭代自检
- 迭代入口：本 skill 仅做当前迭代内自检，跨迭代自检交由编排器（如 breakdown-task command Phase 3）统一执行

## Step 9: 输出文档

所有产出写入 `tasks/`，YAML frontmatter 和 `<!-- REQUIRED -->` 区块必须填充实际内容，不允许残留占位符。

**task-list.json 必须通过 task-cli.js init 写入，禁止直接 Edit/Write**（PreToolUse hook 会拦截）。

**生成前必须读取模板**：`Read ${CLAUDE_PLUGIN_ROOT}/templates/task/task-list.json`，严格按模板结构输出。特别注意：

| 字段 | 必须 | 说明 |
|------|------|------|
| `tasks[].phase` | 必须为 `phase` | 任务状态字段名**禁止**用 `status`、`state` 等其他名称 |
| `tasks[].phase.dev` | 必须 | 初始值 `"pending"` |
| `tasks[].phase.selfTest` | 必须 | 初始值 `"-"` |

```bash
# 每个迭代的 task-list.json 通过 task-cli.js init 创建：
# 1. 读取模板 ${CLAUDE_PLUGIN_ROOT}/templates/task/task-list.json
# 2. 基于模板填充实际内容
# 3. 通过 stdin 管道调用 task-cli.js init（会校验 schema）

cat << 'EOF' | node ${CLAUDE_PLUGIN_ROOT}/scripts/dev/task-cli.js init --req {需求编号} --it IT-01
{基于模板填充的完整 task-list JSON}
EOF
```

```
tasks/
├── IT-01/
│   ├── task-list.json            # 由 task-cli.js init 生成
│   ├── INFRA-01.md               # 模板：${CLAUDE_PLUGIN_ROOT}/templates/task/task-detail-backend.md（INFRA 复用 backend 模板）
│   ├── BE-01.md                  # 模板：${CLAUDE_PLUGIN_ROOT}/templates/task/task-detail-backend.md
└── FE-01.md                      # 模板：${CLAUDE_PLUGIN_ROOT}/templates/task/task-detail-frontend.md
```

完整入口下，所有迭代处理完成后输出简要汇报：迭代数、任务总数（按角色）、输出路径、各迭代概览。迭代入口下，仅汇报当前迭代。

---

## 终止条件（当前迭代）

- [ ] 当前迭代的 `task-list.json` 与任务详情输出到 `tasks/IT-XX/` 正确路径
- [ ] `task-list.json` 包含 `features` 数组，功能点锚点（tech-design / prd / ac / ui）全部填充，无占位符
- [ ] `task-list.json` 包含 `feature-relations` 数组，功能点关联关系完整
- [ ] `task-list.json` 包含 `e2e-paths` 数组，覆盖所有功能点（正常流 + 异常流 + 边界流）
- [ ] 依赖关系无环，`task-list.json` 包含完整依赖关系
- [ ] 当前迭代所有产出文档无残留占位符，内容质量自检全部通过
- [ ] ac.md 中所有 AC/UI 编号都被至少一个任务的 acceptance-criteria 引用（全局 AC 覆盖由跨迭代自检兜底）
- [ ] 每个任务的 acceptance-criteria 字段至少包含一个 AC-XX 或 UI-XX 引用（反向全覆盖）
- [ ] 每个 BE 任务都有 tech-design-sections 声明
- [ ] 每个 FE 任务都有 ui-designs 引用

**完整入口额外条件**（所有迭代累计）：
- [ ] tech-design.md 中所有页面/功能模块都归属到某个迭代，无遗漏
- [ ] 跨迭代自检通过（覆盖、依赖无环、AC 全覆盖）
