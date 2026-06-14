---
created: "2026-06-14"
author: "fan"
status: Draft
---

# Proposal: 防漂移活规格 —— AI 编程流水线（living spec 为核心）

## Problem

**表层**：god 插件有 45 skills + 7 workflows 覆盖"需求→验收"全链路，但只 1 个 command（brainstorm），入口缺失，零件串不起来。

**深层（命门）**：AI 无限产代码时代，**代码不再是稀缺资源，需求是唯一方向盘**。但需求文档是"死文档"——不绑定代码/测试、变更不传播、随时间慢慢漂移腐烂。产物松散，无法沉淀为资产。

**业界印证**：2026 SDD 已成主导范式（Gartner/IBM/Google 背书），但 **spec drift（规格漂移）是整个赛道核心未解难题**——GitHub Spec Kit 官方承认"单会话 OK，跨会话 drift 累积"。SDD 批评者共识：静态 spec 必崩溃，解药是 **living executable specification**。

### Evidence
- god 现状：commands/ 仅 brainstorm；其余环节埋在 skills 里触发不了。
- skills 懒加载，"重"的瓶颈在缺入口 + 缺防漂移机制，不在数量。
- 业界：Google/Microsoft 25-30% 新代码 AI 生成 → 验证危机 → spec drift 痛点放大。
- 多源批评：静态 spec 会漂移（drift）、假设能前置想清（waterfall 复辟）、官僚化、自然语言歧义、规模化崩溃。

### Urgency
不补"活规格 + 防漂移"，零件永远是散件，且产出的代码越多，spec 漂移越严重——AI 产码能力放大了死文档的失控。每拖一天，漂移债务累积。

## Proposed Solution

**以 BDD 活规格（living spec）为中心，文档↔代码↔测试三者通过 Scenario ID 双向绑定，变更强制从顶到底（防漂移），4 个 command 围着活规格转。**

```
              BDD 活规格 (living spec)
              系统真相源 · 人唯一认知界面 · 带版本 · 可读性>代码
             ↙            ↑              ↘
        人读         变更强制从顶到底        可执行
      (不读代码)     (spec→code→test)     (Scenario=测试)
          ↓                ↓                  ↓
                   文档 ↔ 代码 ↔ 测试
                   三者 Scenario ID 双向追溯
                   = zero-drift 双向闭环
```

### 四个核心机制

**① BDD 活规格为中心**
规格用 BDD（Given/When/Then）—— 四合一载体：可读（人懂）·可固化（结构化）·可执行（Scenario=测试）·可追溯（带 ID）。规格是人理解系统的唯一界面（代码 AI 产，人不读）。

**② 三者 Scenario ID 双向追溯**
```
文档 SC-001 ←─implements─→ 代码(@SC-001) ←─验证─→ 测试(SC-001)
每个 Scenario 有唯一 ID,串起三产物,双向可查
```

**③ 变更强制从顶到底 + 反向校准（防漂移双向化）**
```
正向(强制): 改 spec SC-001 → diff-analyzer → 增量改代码 → 增量改测试
反向(校准): 代码偏离 spec → 检测 → 提示更新 spec 或回滚
                     = zero-drift 闭环
```
业界主流只做单向（spec→code），我们双向化，比业界单向往前一步。

**④ 4 个 command 围着活规格转（四范式天然分层）**
```
/god:brainstorm → /god:prd → /god:dev → /god:test → (CI deploy)
   Vibes          Spec     Agent+Skills  Agent+Skills
   探索发散        固化规格  实现规格       验证规格
```
command 主导，无中央编排器，靠产物契约软连接。每个 command 4 步范式：前置校验→执行→后置自检→衔接提示。brainstorm=需求探索（人机对话），prd=规格固化（人机对话），dev/test=执行规格（全自动）。

### 三向吸收（来自全方向地图）

| 吸收方向 | 借鉴什么 | 落到哪 |
|---|---|---|
| App-Generator（bolt/lovable）| 快原型入口：小需求先出原型再补 spec | MVP 档 + brainstorm |
| Formal/Proof（Dafny/Lean）| spec 可执行自校验 | living spec 自验证（高阶档）|
| Code-First | spec↔code 反向校准 | 防漂移双向化 |

## Requirements Analysis

### Key Scenarios

**Happy path**：想法 → brainstorm 探索 → prd 产出 BDD 规格（带 Scenario ID）→ dev 实现代码（标注 implements SC-xxx）→ test 生成测试（绑定 SC-xxx）→ 推送 CI deploy。

**小需求快通道**：MVP 档，brainstorm 先出可跑原型 → 用户验证方向 → 再补 BDD 规格 → dev/test。不全链。

**变更传播**：改 SC-001 → diff-analyzer 找 implements SC-001 的代码 + SC-001 的测试 → 增量重做，不全量。

**反向校准**：用户/CI 改了代码偏离 spec → 下次跑 command 检测到 → 提示"代码偏离 SC-001，更新 spec 还是回滚？"

**防漂移**：跨会话、跨时间，spec 与代码/测试始终一致。Scenario ID 是漂移检测的锚点。

**失败场景**：dev 代码跑挂 → 停在 dev 报错；test 通过率不达标 → 不放行 CI，报告失败 Scenario。

### Non-Functional Requirements
- **轻量**：无编排器进程、无配置文件，纯 command + 约定路径。
- **可拆卸**：任一 command 不触发即不存在。
- **防漂移**：zero-drift 作为硬约束（强制从顶到底 + 双向追溯 + 反向校准）。
- **上下文隔离**：执行区每 command 用 subagent，主对话只读产物摘要。
- **spec 渐进**：三档（MVP/标准/完整），不全量铺；AI 产码越强 spec 越往"只写规则"收敛越轻。

### Constraints & Dependencies
- 产物存放路径约定（workspace 标准目录），所有 command 读写同一套路径。
- deploy 归 CI 基础设施，插件只到验收报告。
- spec 边界：只写规则（行为/数据/接口/状态），不写实现（算法/结构）；体验类（UI 审美/手感）靠门禁人验收。
- 复用现有 45 skills + 7 workflows（含 diff-analyzer、requirement-parser、test-generator）作支撑层。

## Alternatives & Industry Benchmarking

| Approach | 代表 | Verdict |
|----------|------|---------|
| Do nothing | — | Rejected: 入口缺失 + 死文档失控 |
| 中央编排器 | n8n/Airflow 式 | Rejected: 违背 command 主动触发，无法门禁 |
| 插件内 deploy | — | Rejected: 职责越界，归 CI |
| 纯 SDD 工具（同赛道硬刚）| Kiro/Spec Kit/Tessl | Rejected: 赛道拥挤且预测崩溃，不拼"spec 全" |
| Code-First | "spec is the code"派 | 部分吸收: 反向校准防漂移 |
| App-Generator | bolt/lovable/Replit | 部分吸收: 快原型入口 |
| Formal/Proof | Dafny/Lean/Code Metal | 部分吸收: spec 自验证（高阶档）|
| **Chosen: Spec 家族 living spec 变体 + 三向吸收** | 本方案 | **Selected: 命中 spec drift 未解难题 + 平民化 + 轻** |

## Feasibility Assessment

### Technical Feasibility
无平台约束。command + skill + workflow 是 Claude Code 原生三层。BDD/追溯靠 Scenario ID 标注 + diff-analyzer 扫描，技术成熟。复用 god 已有的 BDD 基础（extract-ac 已产 Gherkin、requirement-parser 已解析、test-generator 已生成、diff-analyzer 已分析影响）。

### Resource & Timeline
产品 + AI 协作。command 是 markdown（prompt 编排），防漂移逻辑复用现有 agent/workflow。范围现实。

### Dependency Readiness
45 skills + 7 workflows 就绪，BDD 四件套（extract-ac/parser/generator/diff-analyzer）已埋地基。CI 外部既有。无阻塞。

## Assumptions Challenged

| Assumption | Finding |
|------------|---------|
| 需要中央编排器串联流水线 | **Overturned**：用户驱动 command 本身即编排，编排器多余 |
| 环节配置需要配置文件/参数 | **Overturned**：用户触发 command 已天然可组合，配置层多余 |
| skill 层是设计重点 | **Refined**：skill 是支撑库，焦点在 command 入口 + 活规格 |
| design 需独立 command | **Confirmed**：并入 dev，dev=设计+开发 |
| deploy 由插件 command 完成 | **Overturned**：归 CI，职责单一 |
| 这是全新方法论 | **Overturned**：内核是 SDD/BDD，不重新发明，价值在执行层 |
| SDD 是唯一可行方向 | **Overturned**：5 大阵营并存；对产品/长周期/追溯场景，Spec 家族正确 |
| 静态 spec 够用 | **Overturned**：必须 living spec 防漂移（命中业界未解难题）|
| spec 描述所有切面 | **Overturned**：规格集（主干 BDD + 附件按需），只写规则不写实现 |
| 单向 spec→code | **Refined**：双向 spec↔code 防漂移，比业界单向往前 |
| 一份大 spec 文档 | **Overturned**：spec 三档（MVP/标准/完整），渐进，AI 时代更轻 |

## Scope

### Core Path（核心路径 — 本轮交付）
- 4 个 command：`brainstorm`（已有）、`prd`、`dev`、`test`（新建 3 个）
- BDD 活规格格式：Feature/Scenario + Scenario ID + 版本
- 三者双向追溯：文档↔代码↔测试 通过 Scenario ID 绑定
- 变更强制从顶到底（防漂移正向）+ 反向校准（防漂移反向）= zero-drift 闭环
- 每个 command 4 步范式（前置校验/执行/后置自检/衔接提示）
- spec 三档（MVP/标准/完整）+ MVP 快原型入口（brainstorm 吸收 App-Gen）
- 产物契约：workspace 标准路径（proposal → prd+ac → design+task+commit → test-summary+验收报告 → CI）
- 统一入口内部分流（轻/中/重）

### Iteration Pool（迭代池 — 后续轮次）
- spec 高阶档：引入 Formal 可证明（吸收证明家族）——推迟原因：先做 living spec 自验证
- 多技术栈适配（现偏 Java/Vue）——推迟原因：先跑通一种
- 失败自愈/断点续跑——推迟原因：MVP 先"失败即停+明确报错"
- 跨项目资产复用（规格库，可搬的 BDD 规格+代码+测试）——推迟原因：先单项目沉淀
- 流水线模板（预设环节组合）——推迟原因：先验证裸 command 可组合
- 每阶段拆独立子插件——推迟原因：单插件内 command 已满足可拆卸

### Out of Scope
- deploy/上线（归 CI）
- 单个 skill 内容优化（skill 自治）
- CI/CD 流水线搭建与配置
- 运维监控、日志告警

## Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| spec 漂移（核心风险）| H | H | 防漂移三件套：强制从顶到底 + 双向追溯 + 反向校准 |
| spec 维护变重 | M | M | 三档 + 只写规则 + AI 产码越强 spec 越轻 |
| 大厂碾压（Kiro/Spec Kit）| M | M | 差异化守：防漂移双向 + 平民化（面向产品）+ 轻（plugin 非 IDE）|
| 需求质量差被 dev/test 放大 | M | H | prd 前置 AC 完整性校验（self-check-gate）|
| spec 自然语言歧义 | M | M | BDD 结构化（Given/When/Then）降歧义 |
| 上下文跑爆 | M | M | 执行区每 command 用 subagent 隔离 |
| 业界 spec drift 难题本身难解 | M | M | 聚焦 Scenario ID 粒度（不追求全局零漂移），渐进逼近 |

## Success Criteria

- [ ] 4 个 command 各自可独立触发，不依赖任何外部编排器
- [ ] BDD 规格带 Scenario ID，文档/代码/测试三者可双向追溯（给定 SC-xxx 能找到三处）
- [ ] 变更强制从顶到底：改 spec → 自动检测 → 增量改绑定的代码/测试，不全量重做
- [ ] 反向校准：代码偏离 spec 时可被检测并提示
- [ ] zero-drift：同一 spec 在多次会话后，其绑定的代码/测试一致率 ≥ 95%
- [ ] 需求区 2 command（brainstorm/prd）人机对话产出 BDD 规格；执行区 2 command（dev/test）内部全自动
- [ ] MVP 档支持"先原型后 spec"快通道
- [ ] 产物落在固定路径，下游 command 可读取衔接，全链路 brainstorm→test 打通交付 CI

## Next Steps

- 将本提案正式化为 PRD（核心路径详细规格：4 command + 防漂移三件套 + spec 三档）
- 可选：深读 GitHub Spec Kit 仓库 + Martin Fowler SDD 文章，借鉴业界 spec 结构，避免闭门造
- 迭代池需求后续通过本命令继续讨论，或单独处理
