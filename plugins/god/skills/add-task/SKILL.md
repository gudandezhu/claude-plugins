---
name: add-task
user-invocable: false
description: |
  快速补充遗漏的任务。开发阶段发现架构设计遗漏业务逻辑时使用。
  原子更新 tech-design.md + 创建任务文件 + 更新 task-list.json，不影响已有任务状态。

  **输入：** 目标迭代编号 + 遗漏描述（如 "IT-02 缺少供应商状态变更接口" 或 "IT-01 缺少批量删除功能"）

  触发词：补充任务、add-task、/add-task。
---

# 快速补充任务 Skill

## 核心原则

1. **原子一致**：tech-design.md、任务详情、task-list.json 三者同步更新，不存在中间状态
2. **不破坏已有**：永不修改已完成任务的 phase 状态，永不重编号
3. **内容可溯源**：新增内容的每个步骤标注 tech-design.md 来源章节
4. **复用现有规范**：任务模板复用 `${CLAUDE_PLUGIN_ROOT}/templates/task/`

---

## 执行流程

### 快速通道规则

> /add-task 是开发过程中发现遗漏的快速通道，产出的任务自动标记 `skipped-gates: ["fast-track: add-task 补充"]`。

**各场景最低前置要求**（不满足则终止，不允许跳过）：

| 场景 | 最低前置要求 | 终止条件 |
|------|-------------|---------|
| ADD-BE | tech-design.md 存在、ac.md 存在、目标迭代 task-list.json 存在 | 任一缺失则终止 |
| ADD-FE | 同 ADD-BE，且所需后端接口已在 task-list 或 api/ 中定义 | 后端接口未定义则升级为 ADD-FLOW |
| ADD-FLOW | 同 ADD-BE | 任一缺失则终止 |

> **注意**：本 skill 仅用于新增任务。如果已拆分的任务有问题，请使用 `/feedback` 反馈，在对话中说明不对的点，直接让 CC 修正。

### Step 1: 意图解析 & 上下文加载

**解析用户输入**，提取结构化信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| `targetIteration` | 目标迭代编号 | IT-02 |
| `addType` | 补丁类型（见 Step 2） | ADD-BE |
| `description` | 遗漏的具体内容 | 缺少供应商状态变更接口 |

**加载上下文**（必须在任何操作前完成）：

- `$WORK_DIR/design/tech-design.md` — 现有技术方案
- `$WORK_DIR/tasks/IT-*/task-list.json` — 所有迭代的任务列表
- 目标迭代下的所有任务详情文件（`BE-*.md`、`FE-*.md`、`TS-*.md`）
- `$WORK_DIR/requirement/ac.md` — AC 清单（按优先级查找：`$WORK_DIR/design/ac.md` → `$WORK_DIR/requirement/ac.md`），新增任务需声明 `acceptance-criteria` 引用
- 如涉及新 API：读取 `$JLC_AI_WORKSPACE/tech-specs/api-spec/` 接口规范
- 如涉及数据库：查看 `$JLC_AI_WORKSPACE/biz-tech-docs/INDEX.md` 路由表定位数据库设计相关文档

---

### Step 2: 补丁分类

根据用户输入自动分类：

| 类型 | 代码 | 涉及产物 |
|------|------|---------|
| 新增后端 | `ADD-BE` | tech-design + BE 任务 |
| 新增前端 | `ADD-FE` | tech-design + FE 任务 |
| 新增流程 | `ADD-FLOW` | tech-design + 多个任务 |

**自动升级规则**：
- `ADD-FE` 如需的后端接口不存在 → 升级为 `ADD-FLOW`
- `ADD-BE` 如涉及数据库新表 + 领域模型 → 仍为 `ADD-BE`

---

### Step 3: 更新 tech-design.md

详见 → [`modules/tech-design-update.md`](modules/tech-design-update.md)

**核心操作**：
1. 在 tech-design.md 末尾追加新章节，用 `<!-- ADD-TASK:{日期}:{任务ID}:START reason="..." -->` 标记包裹
2. **禁止修改已有内容**：已有章节的标题、锚点、正文均不可变动，否则会破坏其他任务的锚点引用
3. 新任务的 `tech-design-sections` 引用新追加的章节锚点

---

### Step 4: 生成任务文件

**编号策略**：

```
新任务编号 = 目标迭代中同角色已有最大编号 + 1
```

**双重检查**：从 `task-list.json` 的 tasks 数组中筛选同角色前缀的 id 取最大编号 + 1，同时扫描文件系统（`tasks/{iteration}/` 下 `BE-*.md`、`FE-*.md`、`TS-*.md`）确认不存在同名文件（防止孤立文件导致编号冲突）。

示例：IT-02 已有 BE-01、BE-02、BE-03、FE-01 → 新 BE 任务为 BE-04，新 FE 任务为 FE-02

**模板复用**：使用 `${CLAUDE_PLUGIN_ROOT}/templates/task/` 下的模板：
- 后端任务：`task-detail-backend.md`
- 前端任务：`task-detail-frontend.md`
- 测试任务：`task-detail-test.md`

**内容要求**：
- 所有 `<!-- REQUIRED:xxx -->` 区块必须填充实际内容
- 核心流程每个步骤标注来源为 tech-design.md 具体章节
- 验收标准必须 Agent 可自动判定
- 不允许占位符
- frontmatter 必须包含 `acceptance-criteria`（格式为 `- AC-XX: 未验证`，从 ac.md 分配对应 AC 编号，值固定为"未验证"）
- frontmatter 必须包含 `skipped-gates: ["fast-track: add-task 补充"]`
- BE 任务 frontmatter 必须包含 `tech-design-sections`、`api-docs`、`tech-design-section-hashes`
- FE 任务 frontmatter 必须包含 `ui-designs`（UI 设计稿引用）

---

### Step 5: 更新 task-list.json

**task-list.json 禁止直接 Edit/Write**（PreToolUse hook 会拦截）。通过 `task-cli.js add` 追加：

```bash
# 单条任务
node ${CLAUDE_PLUGIN_ROOT}/scripts/dev/task-cli.js add --req {需求编号} --it {迭代} --task '{"id":"BE-04","name":"...",...}'

# 多条任务（通过 stdin 管道传入，无需临时文件）
cat << 'EOF' | node ${CLAUDE_PLUGIN_ROOT}/scripts/dev/task-cli.js add --req {需求编号} --it {迭代}
[
  {"id":"BE-04","name":"...","role":"backend","dependencies":[],"phase":{"dev":"pending","selfTest":"-"},"detailFile":"BE-04.md"},
  {"id":"FE-02","name":"...","role":"frontend","dependencies":["BE-04"],"phase":{"dev":"pending","selfTest":"-"},"detailFile":"FE-02.md"}
]
EOF
```

`add` 命令自动处理：
- `seq` 自动递增（`max(已有 seq) + 1`）
- ID 唯一性校验（重复则报错）
- 已有任务 `phase` 不变性校验（写入后验证，被篡改则回滚）
- `summary` 计数自动更新
- `updatedAt` 自动更新

**新任务必须提供的字段**：`id`, `name`, `role`, `dependencies`, `phase`, `detailFile`
**新任务 `phase` 固定为** `{ "dev": "pending", "selfTest": "-", "integration": "-", "qa": "-" }`

**禁止操作**：
- **永不修改**已有任务的 `phase` 值
- **永不修改**已有任务的 `seq` 值
- **永不删除**已有任务条目

---

### Step 6: 一致性校验

详见 → [`modules/consistency-check.md`](modules/consistency-check.md)

**校验顺序**（前一项失败立即停止）：

1. 状态不变性（保护已有工作）
2. 任务 ID 唯一性
3. DAG 无环验证
4. 文件存在性
5. YAML Frontmatter 完整性
6. REQUIRED 区块完整性
7. 计数一致性
8. tech-design 覆盖性

**全部通过才能继续**。任何一项失败，提示问题并要求修正。

---

### Step 7: 输出变更摘要

简要输出：类型、迭代、新增的任务、tech-design 更新内容。

**后续操作**：新增任务可通过 `/zcode:backend` 或 `/zcode:frontend` 命令开始开发。

---

## 三种场景的处理流程

### 场景 A：ADD-BE（缺少一个后端接口）

输入示例：`"IT-02 缺少供应商状态变更接口 POST /api/v1/suppliers/{id}/status"`

1. tech-design.md：末尾追加补充章节（状态变更接口定义 + 处理流程）
2. 创建 `tasks/IT-02/BE-04.md`（接续已有编号）
3. 更新 `tasks/IT-02/task-list.json`

### 场景 B：ADD-FE（缺少前端逻辑）

输入示例：`"IT-01 供应商列表页缺少批量删除功能"`

1. tech-design.md：末尾追加补充章节（批量删除流程）
2. 创建 `tasks/IT-01/FE-02.md`
3. 更新 `tasks/IT-01/task-list.json`

### 场景 C：ADD-FLOW（缺少完整业务流程）

输入示例：`"IT-02 缺少供应商审批流程，需要提交审批、审批通过、审批驳回三个接口 + 审批页面"`

1. tech-design.md：末尾追加补充章节（审批接口定义 + 审批流程 + 审批表 DDL + 异常场景）
2. 创建多个任务文件（BE + FE + TS），通过 `depends-on` 设置依赖链
3. 更新 `task-list.json`（追加多条，设置依赖链）

---

## 依赖关系处理

### 新任务依赖规则

| 新任务角色 | 依赖目标 |
|-----------|---------|
| BE 任务 | 同迭代的 INFRA 任务、前置 BE 任务（按业务逻辑） |
| FE 任务 | 同迭代的公共组件 FE 任务（如有），不依赖 BE 任务 |
| TS 任务 | 同迭代的 BE + FE 任务 |

### 依赖链插入

- 插入新任务时验证 DAG 无环
- **永不修改**已完成任务（`dev: "done"` 或更高）的依赖关系
- 如需修改未完成任务的依赖，先更新其 `dependencies` 数组

---

## 终止条件

- [ ] 新增的任务详情文件已写入正确路径
- [ ] tech-design.md 已更新且包含 ADD-TASK 标记
- [ ] task-list.json 已追加新任务且 summary 计数正确
- [ ] 所有 REQUIRED 区块已填充（无占位符）
- [ ] 依赖关系无环
- [ ] 已有任务的 phase 状态未被修改
- [ ] 一致性校验全部通过
- [ ] 新增任务的 acceptance-criteria 引用了 ac.md 中的有效 AC 编号
- [ ] 新增任务的 skipped-gates 包含 fast-track 标记
