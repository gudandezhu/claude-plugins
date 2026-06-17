---
description: PRD编写 - 建模阶段：ER图、用例图、上下文快照（各 step 可独立或并行执行）
---

# PRD编写 - 建模阶段

> 本文件由 `/zcode:prd` 命令 Phase 3.5 的 subagent 加载。L1 命令层控制并行调度，本文件只定义各 step 的执行规范。

## 角色

PRD建模阶段执行者。完成数据建模、用例分析和上下文梳理，为PRD编写提供输入依据。

## 执行模式

本阶段支持三种执行模式：

**串行模式**（手动激活时）：按 03 → 04 → 05 顺序逐步完成，每步等待用户确认。

**并行模式**（L1 命令层调度时）：L1 命令分别传入 `step=er` 和 `step=usecase` 给两个独立 subagent 并行执行。步骤3由 L1 命令在两者完成后汇总。

**参数说明**：
- `step=er` → 只执行步骤1（ER图）
- `step=usecase` → 只执行步骤2（用例图）
- 无 step 参数 → 串行执行全部步骤

---

### 步骤1：ER图（04a-er-diagram.drawio）

> 可独立执行（step=er）。输入：01-requirements-analysis.md + 02-feature-scope.mm

根据需求分析和功能范围，梳理核心数据实体及其关系：
- 识别核心实体（如：工具、分类、用户等）
- 定义实体属性
- 明确实体间关系（一对多、多对多等）
- 输出 Draw.io 格式的 ER 图，保存为 `$PROJECT_DIR/04a-er-diagram.drawio`

**Draw.io 文件格式要求**（⚠️ 强制，03和04均适用）：
- `<mxfile>` 标签必须包含 `host="app.diagrams.net" modified="日期" type="device"` 属性
- 表格实体使用 `shape=table` + 子元素用简单 `text` 样式
- 连线（edge）元素必须包含 `<mxGeometry relative="1" as="geometry"/>` 子元素
- 连线标签使用 `edgeLabel` 样式，嵌套在 edge 的 parent 中
- 参考模板：`AI编程Wiki图片功能优化/04a-er-diagram.drawio`

**独立执行时的输出**：
- ER 图文件
- 返回摘要：实体数量、关键关系列表

**GATE（串行模式）: 禁止进入下一步。必须等待用户确认后才能继续。如果用户未回复，重复询问一次后停止。**

---

### 步骤2：用例图与流程图（04b-use-cases.drawio）

> 可独立执行（step=usecase）。输入：01-requirements-analysis.md + 02-feature-scope.mm

根据用户角色和功能清单，绘制用例图和关键流程图：
- 识别参与者（Actor）及其用例
- 绘制用例图
- 绘制关键业务流程图
- 输出 Draw.io 格式，保存为 `$PROJECT_DIR/04b-use-cases.drawio`

**独立执行时的输出**：
- 用例图 + 流程图文件
- 返回摘要：参与者数量、用例数量、关键流程列表

**GATE（串行模式）: 禁止进入下一步。必须等待用户确认后才能继续。如果用户未回复，重复询问一次后停止。**

---

### 步骤3：上下文快照（05-context-snapshot.md）

> 依赖步骤1和步骤2的产出。并行模式下由 L1 命令层在两个 subagent 都完成后执行。

汇总当前需求的完整上下文信息，作为 PRD 编写的输入：
- 需求背景摘要
- 关键决策记录
- 用户确认的功能范围
- 数据模型摘要（来自步骤1的 ER 图）
- 用例摘要（来自步骤2的用例图）
- 待确认/待决事项

使用 `${CLAUDE_PLUGIN_ROOT}/skills/prd/templates/context-snapshot.md` 模板，填写"需求摘要"和"功能架构摘要"区块。
保存为 `$PROJECT_DIR/05-context-snapshot.md`

**GATE: 禁止进入PRD编写阶段。必须等待用户确认后才能继续。如果用户未回复，重复询问一次后停止。**

---

## 输出

完成后返回结构化摘要数据（由 L1 命令层（主 agent） 写入 snapshot）：
- ER 图实体数量和关键关系
- 用例数量和角色清单

---

## Context Snapshot 协作

### 启动时读取
读取 `$PROJECT_DIR/05-context-snapshot.md` 中的以下区块：
- 「需求摘要」— 了解需求名称、优先级、核心目标、用户角色
- 「功能架构摘要」— 了解核心模块和功能点（如已有）

### 完成时返回数据（由 L1 命令层（主 agent） 写入 snapshot）
返回以下结构化数据：
- 核心实体列表（从 ER 图提取）
- 实体关系（关键的一对多/多对多关系）
- 用户角色-功能矩阵（从用例图提取）
- 阶段完成状态
