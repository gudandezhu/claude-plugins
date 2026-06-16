---
name: user-perspective-analyzer
user-invocable: false
description: |
  用户视角解析器。从 spec/sources.md 草稿（M3 已对齐核心流程节点）中识别用户角色，
  为每类用户以真实视角提炼业务目标、关键操作流程、跨角色冲突点和隐性需求。
  输出用户视角文档供 prd 阶段 2 build-spec 消费，作为 REQ 命名的语义参考。
  在 prd 阶段 1 brainstorm M3 C2 通过后调用（核心流程节点已固化 = 视角分析的最佳时机）。
  触发词：用户视角分析、角色分析、user-perspective-analyzer、分析用户视角、用户角色分析。
---

# 用户视角解析器 (Agent 0)

## 定位

预处理组件。在 prd 阶段 2 build-spec 之前，以每类用户的真实视角提炼业务目标和价值诉求，避免陷入"功能表面"。

核心价值：从用户目标出发，不是从功能列表出发。

**调用时机**：prd 阶段 1 brainstorm M3 完成、C2 核心流程节点对齐后，C4 总流程 Gate 之前。核心流程节点已固化的时刻，角色视角分析才准确。

## 输入/输出

**输入**：
- `spec/sources.md` 草稿（必填）：M3 Snapshot 已含核心流程节点 + 核心用户角色
- 需求材料（可选）：proposal 文件路径 或 原始需求描述文本
- AC 文件路径（可选）
- UI 原型路径（可选）
- 输出目录（可选）：默认 `<项目目录>/spec/sources/user-perspectives/`

**输出**：
- `{outputDir}/{role-name}.md` — 每类用户独立文档
- `{outputDir}/_summary.md` — 汇总信息（角色清单 + 关键发现 + 跨角色冲突 + 隐性需求）

## 执行流程

### Step 0: 初始化

1. 解析路径（`<项目目录>/spec/sources.md`、输出目录）
2. 创建输出目录（如不存在）。默认：`<项目目录>/spec/sources/user-perspectives/`
3. 检查已有的用户视角文档：
   - 存在且 sources.md 修改时间早于用户视角文档 → 展示复用选项
   - 存在但 sources.md 修改时间晚于用户视角文档 → 提示重新分析
   - 不存在 → 继续

### Step 1: 用户角色识别

从 `spec/sources.md` M3 Snapshot 的"核心用户角色"区 + M3 closure 流程节点中识别用户类型/角色。

**识别来源**（按优先级）：
1. `spec/sources.md` M3 Snapshot 中的"核心用户角色"（必填，已固化）
2. M3 closure 流程节点"每节点业务规则"中的参与者（申请人/审批人/执行人）
3. 需求材料（proposal / 原始需求）中的直接角色声明（补充）
4. 权限差异（不同角色看到不同页面/操作，补充）

**输出**：用户角色列表，包含角色名 + 一句话定义。**用户需在 Step 2 面板确认**。

### Step 2: 角色确认面板

展示识别到的角色列表：

```
📋 识别到 {N} 类用户角色：

  1. {角色名} — {一句话定义}
  2. {角色名} — {一句话定义}
  ...

请确认：
1. 确认无误，开始分析
2. 添加角色：{角色名}
3. 移除角色：{编号}
4. 合并角色：{编号1} + {编号2}
```

### Step 3: 并行角色分析

为每类用户独立分析（可并行执行，最多 4 个并行）。

**分析模板**（`skills/user-perspective-analyzer/prompts/perspective-analyst.md`）：
模板变量：
   - `{roleName}` → 角色名
   - `{sourcesMd}` → `spec/sources.md` 全文（M3 Snapshot + Check 结论 + 流程节点）
   - `{requirementMaterial}` → 需求材料内容（proposal 摘要或原始需求文本）
   - `{reqName}` → 需求/系统名称（从需求材料标题或目录名提取）
   - `{acFilePath}` → AC 文件路径（如存在）
   - `{uiPrototypePaths}` → UI 原型路径（如存在）
   - `{outputPath}` → `{outputDir}/{role-name-slug}.md`
   - `{reqNo}` → 需求编号（用于 _summary.md）

**产出验证**（每个角色分析完成后）：
- 检查输出文件存在且 size > 0.5KB
- 检查包含必要的 markdown 段落标题
- 失败时记录到 `_summary.md`，不阻塞其他角色

### Step 4: 汇总输出

生成 `_summary.md`：

```markdown
# 用户视角分析汇总

## 分析信息
- 需求编号: {reqNo}
- 分析时间: {timestamp}
- 需求材料: {requirementMaterialPaths}
- PRD 文件: {prdPaths}（如有）
- 角色数量: {N}

## 角色清单
| # | 角色 | 核心目标 | 文档路径 |
|---|------|---------|---------|

## 关键发现
- {跨角色共性诉求}
- {角色间冲突点}
- {隐性需求汇总}

## 给下游的输入
- **prd 阶段 2 build-spec**：读 `{outputDir}/_summary.md` + 每个 `{role}.md`，作为 REQ 命名的语义参考（Given 角色 A 在场景 X）；跨角色冲突点须在 build-spec 阶段消解或显式 Out of Scope
- **prd 阶段 2.5 spec-summary**：角色列表 = `_summary.md` 的"角色清单"区，确保 summary.md 的"角色 + 核心流程"章节含所有角色
```

## 渐进式保护

- 需求材料中无法识别用户角色 → 跳过整个分析，记录到 `_summary.md`（`status: skipped`）
- 某角色分析产出为空 → 跳过该角色，不影响其他角色
- 用户视角文档仅作为可选参考，不作为硬性门禁输入
- 方法论文件不存在时，下游自动回退到现有 AC 驱动模式

## 约束

- 禁止读取代码文件（只读 spec/sources.md + AC/UI 原型/需求材料）
- 禁止修改 spec/sources.md（用户视角文档是 read-only 派生产物；如需修改流程节点应回到 brainstorm M3）
- 禁止合并分析（每类用户必须独立分析，避免上下文污染）
- 每类用户一个独立文档，禁止合并到单文件
