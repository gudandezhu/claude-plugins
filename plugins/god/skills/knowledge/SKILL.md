---
status: stable
name: knowledge
user-invocable: false
description: |
  知识库自动整理 + 维护（v0.7.4 新增）。**位置 = 项目根 knowledge/**（与 spec/ 平级）。
  prd 阶段 0 派 knowledge-init subagent 扫项目建 INDEX；每个 SC accepted 后派 knowledge-sync subagent 沉淀知识卡。
  主 agent 不维护知识库，只编排。
  触发：prd 阶段 0（初始化）/ SC accepted 后（增量更新）/ 用户显式 /god:knowledge（向后兼容）。
---

# Knowledge（v0.7.4 项目级知识库）

> **v0.7.4 范围**：项目根 `knowledge/` 目录自动整理 + 维护。**OPC 查知识库 = 看 INDEX.md**。
> god 帮 OPC 初始化 + 增量沉淀 + 自动维护——OPC 不必自己写知识卡。

## 调用契约

**调用方**：主 agent 派 2 类 subagent
- `knowledge-init` subagent —— prd 阶段 0 首次初始化
- `knowledge-sync` subagent —— SC accepted 后增量更新

**主 agent 干**：派 subagent、读 subagent 结果、回显
**subagent 干**：扫项目建 INDEX / 读 SC 沉淀知识卡
**subagent 不能做**：弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 spec.state.meta.json

## 知识库目录结构

```
project-root/
└── knowledge/
    ├── INDEX.md              # OPC 唯一入口（看这个）
    ├── 00-overview/          # 项目总览
    │   ├── project-goal.md   # 项目目标 + 范围
    │   └── architecture.md   # 架构图（引用 spec/architecture/）
    ├── 10-domain/            # 业务域知识（1 domain 1 文件）
    │   ├── D-market-data.md
    │   ├── D-ai-report.md
    │   └── ...
    ├── 20-pattern/           # 设计模式 / 复用模式
    │   └── <pattern-name>.md
    ├── 30-decision/          # 关键决策记录（ADR-style）
    │   └── ADR-001-<name>.md
    ├── 40-incident/          # 事故复盘（来自 spec/incidents/）
    │   └── INC-001-<name>.md
    └── 90-trash/             # 失效知识（标注 deprecated）
        └── <topic>.md
```

## INDEX.md 格式

```markdown
# 项目知识库索引

## 总览
- 项目目标: 00-overview/project-goal.md
- 架构图: 00-overview/architecture.md

## 业务域
- D-market-data: 10-domain/D-market-data.md
- D-ai-report: 10-domain/D-ai-report.md

## 模式
- 4 Agent Pipeline: 20-pattern/4-agent-pipeline.md

## 决策
- ADR-001 选 Prisma: 30-decision/ADR-001-prisma.md
- ADR-002 SSE vs WebSocket: 30-decision/ADR-002-sse-websocket.md

## 事故
- INC-001 Prisma 7 vs 5: 40-incident/INC-001-prisma-7-vs-5.md
```

## knowledge-init subagent（prd 阶段 0）

**触发**：prd 阶段 0 自助调研时

**subagent 任务清单**：
1. 扫项目根 `README.md` / `CLAUDE.md` / `docs/` / `package.json` / 已有 `spec/`
2. 写 `knowledge/00-overview/project-goal.md`（从 README 提取）
3. 写 `knowledge/00-overview/architecture.md`（从 spec/architecture/ 引用）
4. 写 `knowledge/INDEX.md`（初始骨架）
5. 完事回主 agent

**主 agent 收尾**：跑 `ls knowledge/` + 读 `INDEX.md` 校验。

## knowledge-sync subagent（SC accepted 后）

**触发**：sign-gate S3 接受后（S3 accept → phase verified → accepted）

**subagent 任务清单**：
1. 读 `spec/state/meta.json`（新 accepted 的 SC）
2. 读 `spec/domains/D-XXX/spec.feature`（新 SC 内容）
3. 判定知识卡类别：
   - 新业务域 → 写 `knowledge/10-domain/D-XXX.md`（首次）
   - 业务域补充 → 增量更新 `knowledge/10-domain/D-XXX.md`
   - 新模式 → 写 `knowledge/20-pattern/<name>.md`
   - 关键决策 → 写 `knowledge/30-decision/ADR-NNN-<name>.md`（**用户必须显式确认** 才写）
   - 事故 → 写 `knowledge/40-incident/INC-NNN-<name>.md`
4. 增量更新 `knowledge/INDEX.md`（加 1 行）
5. 完事回主 agent

**主 agent 收尾**：跑 `cat knowledge/INDEX.md` 校验。

## 知识卡格式

**业务域知识卡**（`knowledge/10-domain/D-XXX.md`）：

```markdown
# D-XXX <域名称>

> 维护: god knowledge-sync subagent
> 来源: spec/domains/D-XXX/
> 更新日期: 2026-06-17

## 核心职责
<一段话>

## 关键 SC
- SC-001 <一句话>
- SC-003 <一句话>

## 数据模型
<主要实体>

## 上下游关系
- 上游: <域列表>
- 下游: <域列表>

## 已知坑
- <问题 + 解决方案>
```

**决策记录**（`knowledge/30-decision/ADR-NNN.md`）：

```markdown
# ADR-NNN <决策名>

> 维护: god knowledge-sync subagent
> 决策日期: 2026-06-17

## 状态
accepted

## 背景
<为什么需要决策>

## 决策
<选了什么>

## 备选
- 选项 B: <描述 + 不选理由>
- 选项 C: <描述 + 不选理由>

## 影响
<这次决策影响什么>
```

## OPC 使用

```bash
# 查知识库：看 INDEX.md
cat knowledge/INDEX.md

# 查业务域：
cat knowledge/10-domain/D-ai-report.md

# 查决策：
cat knowledge/30-decision/ADR-001-prisma.md

# 查事故：
cat knowledge/40-incident/INC-001-prisma-7-vs-5.md
```

**OPC 不必维护**——god 自动整理。

## 阶段 0：环境自检（主 agent 跑）

```bash
ls knowledge/ 2>/dev/null || echo "无知识库（首次跑）"
test -f knowledge/INDEX.md && echo "有 INDEX"
```

判断：
- 无 `knowledge/` → 派 knowledge-init subagent
- 有 `knowledge/INDEX.md` → 派 knowledge-sync subagent（增量）

## 阶段 1：知识库产物生成（派 subagent）

主 agent 派 `knowledge-init` 或 `knowledge-sync` subagent（worktree 隔离）：

**knowledge-init 任务清单**（首次）：
1. 扫项目根 + docs/ + spec/
2. 写 `knowledge/00-overview/*`（项目总览）
3. 写 `knowledge/INDEX.md`（初始骨架）
4. 完事回主 agent

**knowledge-sync 任务清单**（增量）：
1. 读 `spec/state/meta.json` 找新 accepted 的 SC
2. 判定知识卡类别
3. 写/更新对应 `knowledge/<dir>/<file>.md`
4. 增量更新 `knowledge/INDEX.md`
5. 完事回主 agent

## 阶段 2：自检（主 agent 跑 L3 脚本）

```bash
# 2a INDEX.md 存在
test -f knowledge/INDEX.md

# 2b INDEX.md 包含所有知识卡（无悬空链接）
grep -E "^- \[" knowledge/INDEX.md | wc -l
find knowledge -name "*.md" -not -name "INDEX.md" | wc -l
```

**两端数量必须一致**——不一致 → 派 fixer subagent 修 INDEX.md。

## 阶段 3：回显（主 agent）

```
知识库同步完成（v0.7.4）：
- 新增: 1 业务域卡 (knowledge/10-domain/D-ai-report.md)
- 更新: INDEX.md (12 → 13 条目)
- 决策: 0 (需 OPC 显式确认才写 ADR)
- 事故: 0 (无新 incident)

下一步: OPC 可看 knowledge/INDEX.md 查全部知识卡
```

## 不在 v0.7.4 范围（v0.8.0 路线图）

- ❌ 知识库全文检索（grep / ripgrep 集成）
- ❌ 知识图谱（cross-reference 自动生成）
- ❌ 知识库版本控制（knowledge_history/）
- ❌ 与外部知识库集成（Notion / Confluence / Obsidian）
- ❌ AI 主动 push 通知（新知识卡通知）

**理由**：v0.7.4 是 god 的"知识库能落地"里程碑。智能化是另一阶段。

## 衔接

knowledge-sync 完成 → deploy 阶段（如果 spec verified）或 prd 流水线结束。

## 禁止

- ❌ 在 v0.7.4 范围外加知识库特性
- ❌ 主 agent 写知识卡
- ❌ subagent 弹签 / 派 subagent
- ❌ knowledge-init 覆盖已有知识卡（用 sync）
- ❌ OPC 没显式确认就写 ADR（决策类知识卡必 OPC 确认）

## 机制

- **知识库跟随项目**：知识卡从 spec 派生，不独立
- **INDEX.md 是唯一入口**：OPC 必读 INDEX，不遍历
- **决策记录必 OPC 确认**：避免 AI 替 OPC 决策
- **subagent 物理隔离**：knowledge-init / knowledge-sync 独立 session
