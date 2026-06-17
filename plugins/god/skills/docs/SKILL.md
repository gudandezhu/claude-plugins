---
status: stable
name: docs
user-invocable: false
description: |
  业务项目上下文自动整理 + 维护（v0.7.4 新增，替代 v0.7.4 旧 knowledge/ 方案）。
  **位置 = 项目根 context/**（**业务项目**用 context/；**god 自身**保留 spec/ 作为活规格子系统名）。
  context/ = 项目知识库（合同 + 架构 + 上下文 + 决策 + 事故 + 模式），强校验只对 feature/*.feature。
  prd 阶段 0 派 docs-init subagent 扫项目建库；每个 SC accepted 后派 docs-sync subagent 沉淀知识卡。
  主 agent 不维护 context/，只编排。
  触发：prd 阶段 0（初始化）/ SC accepted 后（增量更新）/ 用户显式 /god:docs（向后兼容）。
---

# Docs（v0.7.4 业务项目 context/）

> **位置 = 项目根 `context/`**（**业务项目**专用；god 自身仍是 `spec/`）。
> god 自动整理 + 维护，OPC 不必手写知识卡。
> 决策类 ADR 必 OPC 显式确认才写（避免 AI 替 OPC 决策）。

## 命名澄清

| 主体 | 目录 | 原因 |
|---|---|---|
| **业务项目** | `context/` | 项目 = 产品（合同 + 上下文 + 决策 + 事故）|
| **god 自身** | `spec/` | god 自身是"活规格子系统"，保留 spec/ 作为子系统名 |

**目录名只是壳**——业务项目用 `context/` 更准确，god 自身保留 `spec/` 是历史兼容（spec/scripts/ 12+ 工具不改名）。

## context/ 目录结构

```
context/
├── README.md                    # 项目总览 + 子目录索引
├── feature/                     # 活规格（合同类，强校验）
│   ├── main.feature             # 主规格
│   ├── state/                   # 状态
│   │   └── meta.json
│   └── domain/                  # 业务域活规格
│       ├── D-market-data.feature
│       └── D-ai-report.feature
├── domain/                      # 业务域知识（1 域 1 目录）
│   ├── D-market-data/
│   │   ├── README.md            # 业务架构（结构化，必填字段，强校验）
│   │   ├── context.md           # 业务上下文（人话，弱校验）
│   │   └── incident.md          # 该域历史事故
│   └── D-ai-report/
│       ├── README.md
│       ├── context.md
│       └── incident.md
├── adr/                         # 跨域决策（ADR-NNN-xxx.md）
├── pattern/                     # 跨域模式
└── incident/                    # 跨域事故
```

**核心设计**：

1. **`context/` 1 个目录管所有**——合同 + 架构 + 上下文 + 决策 + 事故 + 模式
2. **业务域自包含**——`context/domain/D-XXX/` 是该域的"档案夹"（README + context + incident）
3. **`feature/` 强校验**——只对 `*.feature` 跑 spec-validate 14 项
4. **`domain/D-XXX/README.md` 强校验**——必填字段（参考 god architecture.md §2.5）
5. **`context.md` `incident.md` `adr/` `pattern/` 弱校验**——建议有，但无强制

## 调用契约

**主 agent 干**：派 subagent + 读结果 + 回显
**2 类 subagent**：
- `docs-init`（首次建库，prd 阶段 0）
- `docs-sync`（增量更新，SC accepted 后）

**subagent 禁**：弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 `feature/state/meta.json` / 主 agent 写知识卡。

## docs-init subagent（首次，prd 阶段 0）

**触发**：`context/README.md` 不存在时

**subagent 任务清单**：
1. 扫项目根（README / CLAUDE.md / docs / spec / package.json）
2. 读 `context/feature/main.feature` + `context/feature/domain/D-XXX.feature` 找业务域清单
3. 为每个 D-XXX 建 `context/domain/D-XXX/` 3 文件骨架（README + context + incident）
4. 写 `context/README.md`（项目总览 + 子目录索引）
5. 建 `context/adr/` `context/pattern/` `context/incident/` 空目录 + `.gitkeep`
6. 完事回主 agent

**主 agent 收尾**：跑 `ls context/` + `cat context/README.md` 校验。

## docs-sync subagent（SC accepted 后）

**触发**：sign-gate S3 接受后（phase: verified → accepted）

**subagent 任务清单**：
1. 读 `context/feature/state/meta.json`（新 accepted 的 SC）
2. 读 `context/feature/domain/D-XXX.feature`（新 SC 内容）
3. 判定知识卡类别：
   - 新业务域 → 写 `context/domain/D-XXX/README.md`（首次）
   - 业务域补充 → 增量更新 `context/domain/D-XXX/README.md` 或 `context.md`
   - 跨域决策 → 写 `context/adr/ADR-NNN-<name>.md`（**OPC 必须显式确认**）
   - 跨域模式 → 写 `context/pattern/<name>.md`
   - 跨域事故 → 写 `context/incident/INC-NNN-<name>.md`
4. 增量更新 `context/README.md`（加 1 行）
5. 完事回主 agent

**主 agent 收尾**：跑 `cat context/README.md` 校验。

## 业务域 README 必填字段

`context/domain/D-XXX/README.md`（强校验，参考 god architecture.md §2.5）：

```yaml
# context/domain/D-XXX/README.md
- 域 ID: D-XXX
- 域名称: <一句话>
- 核心职责: <一段话>
- 数据模型: <主要实体>
- 输入: <上游域列表 / 外部依赖>
- 输出: <下游域列表 / 外部交付>
- 关系: <与其他 D-XXX 的关系>
```

缺失字段 → 校验 FAIL（v0.8.0 落地 `context-lint.js`，v0.7.4 仅约定不实施）。

## OPC 使用

```bash
cat context/README.md                       # 查项目总览
cat context/domain/D-ai-report/README.md    # 查业务域架构
cat context/domain/D-ai-report/context.md   # 查业务上下文
cat context/adr/ADR-001-prisma.md           # 查决策
cat context/incident/INC-001-prisma-upgrade.md  # 查事故
```

**OPC 不必维护**——god 自动整理。

## CLAUDE.md 联动

业务项目 `CLAUDE.md` 索引（v0.7.4 项目级模板）：

```markdown
# 项目索引

> 项目所有上下文在 context/。业务域看 context/domain/D-XXX/，跨域看 context/{adr,pattern,incident}/。

## 找业务
- 业务域入口: context/domain/D-XXX/
  - 业务架构: context/domain/D-XXX/README.md
  - 业务上下文: context/domain/D-XXX/context.md
  - 域事故: context/domain/D-XXX/incident.md
- 活规格: context/feature/domain/D-XXX.feature

## 找跨域
- 决策: context/adr/
- 模式: context/pattern/
- 事故: context/incident/

## 找代码
- 业务域代码: src/D-XXX/
```

## 阶段 0：环境自检（主 agent 跑）

```bash
ls context/ 2>/dev/null || echo "无 context/（首次跑）"
test -f context/README.md && echo "有 README"
```

判断：
- 无 `context/README.md` → 派 docs-init subagent
- 有 `context/README.md` → 派 docs-sync subagent（增量）

## 阶段 2：自检（主 agent 跑）

```bash
# 2a context/README.md 存在
test -f context/README.md

# 2b 业务域目录与 feature/domain/ 一致
ls context/feature/domain/ | sed 's/\.feature$//' | sort > /tmp/feature-d
ls context/domain/ | sort > /tmp/context-d
diff /tmp/feature-d /tmp/context-d   # 必须为空
```

不一致 → 派 fixer subagent 修。

## 阶段 3：回显（主 agent）

```
context/ 同步完成（v0.7.4）：
- 新增: 1 业务域 (context/domain/D-ai-report/)
- 更新: context/README.md (12 → 13 条目)
- 决策: 0 (需 OPC 显式确认才写 ADR)
- 事故: 0 (无新 incident)

下一步: OPC 可看 context/README.md 查全部上下文
```

## 不在 v0.7.4 范围（v0.8.0 路线图）

- ❌ `context-lint.js` 自动校验（README 必填字段、域一致性）
- ❌ 全文检索（grep / ripgrep 集成）
- ❌ 知识图谱（cross-reference 自动生成）
- ❌ 知识库版本控制（context_history/）
- ❌ 与外部知识库集成（Notion / Confluence / Obsidian）
- ❌ AI 主动 push 通知（新知识卡通知）

**理由**：v0.7.4 是 god 的"context/ 能落地"里程碑。智能化是另一阶段。

## 衔接

docs-sync 完成 → deploy 阶段（如果 spec verified）或 prd 流水线结束。

## 禁止

- ❌ 在 v0.7.4 范围外加 context/ 特性
- ❌ 主 agent 写知识卡
- ❌ subagent 弹签 / 派 subagent
- ❌ docs-init 覆盖已有知识卡（用 sync）
- ❌ OPC 没显式确认就写 ADR（决策类知识卡必 OPC 确认）

## 机制

- **context/ 跟随项目**：知识卡从 feature/ 派生，不独立
- **业务域自包含**：`context/domain/D-XXX/` 1 目录 3 文件（README + context + incident）
- **强校验边界**：`feature/*.feature` 强校验 + `domain/D-XXX/README.md` 强校验（v0.8.0 落地 `context-lint.js`），其他弱
- **决策记录必 OPC 确认**：避免 AI 替 OPC 决策
- **subagent 物理隔离**：docs-init / docs-sync 独立 session
