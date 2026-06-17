# OPC × AI 协作契约

> **定位**：CLAUDE.md §6 子文档。定义 god 流水线中 **OPC（One Person Company）** 必须在场的介入点 + 介入点之间的 AI 自主区间。
> 不承载：brainstorm / build-spec / spec-review 自身方法（见 `skills/brainstorm/SKILL.md` / `skills/build-spec/SKILL.md` / `skills/spec-review/SKILL.md`）。
> **改 god 的方向 = 改 CLAUDE.md。改 god 流程细节 = 改本文。**

---

## 0. 一句话总则

> **v0.7.0+ 新规约（RFC-0013）**：**3 个签字 Gate + 1 个动态问** = OPC 必介入点。
> 介入点之间 AI 全自动，禁止 OPC 打断。

| 项 | 答案 |
|---|---|
| 谁来介入 | **OPC**（One Person Company，CLAUDE.md §1.1）|
| 介入总时长 | **< 30 分钟 / feature**（CLAUDE.md §1.3 预算，L0 档）|
| 介入多少次 | 简单档 5-6 次 / 复杂档 7-8 次；**上限 8 次**（v0.7.0+ RFC-0013 新规约）|
| 介入多深 | 1 次 ack = 1 道选择题或 1 句确认；不做完整需求写作 |
| 超预算后果 | 系统失败（不是"OPC 加班"） |
| 不介入会怎样 | 方向错 / 流程错 / 评审形式化 / 验收走过场 → 返工代价 ≥ 10x |

**v0.6.0 → v0.7.0 变化**：

| 旧（v0.6.0 6 介入点）| 新（v0.7.0 3 Gate + 1 动态问）| 说明 |
|---|---|---|
| C1 目标价值 | **保留**（prd 阶段 1 内部）| brainstorm skill 触发 |
| C2 核心流程 | **保留**（prd 阶段 1 内部）| brainstorm skill 触发 |
| C3 动态疑问 | **保留** | ask-user skill 封装 |
| C4 总流程 | **保留**（prd 阶段 1 内部）| brainstorm skill 触发 |
| P1 评审不通过 | **删除**（自动回 prd 阶段 1/2）| 评审失败不单独问 |
| S1 验收签字 | **改为 S3** | sign-gate skill 触发 |
| **新增 S1 Prd 出口** | S1 Gate | sign-gate skill 触发 |
| **新增 S2 Dev 出口** | S2 Gate | sign-gate skill 触发 |
| C6 Intent 反述 | **保留** | @intent SC 仍写 C6 锚点 |

---

## 1. 3 签字 Gate + 1 动态问（速查表，v0.7.0+ RFC-0013 新规约）

| # | 名称 | 触发时机 | skill 阶段 | OPC 的决策项 | 跳过风险 |
|---|------|---------|-----------|----------|---------|
| **S1** | Prd 出口签字 Gate | prd 阶段 3c | `sign-gate` skill | "通过 / 改需求 / 撤回" | 偏了直接进 dev = 返工 10× |
| **S2** | Dev 出口签字 Gate | dev-pipeline 末尾 | `sign-gate` skill | "通过 / spec 错（回 prd）/ 实现错（回 dev）" | 实现跑偏直接进 test = 测试白跑 |
| **S3** | Test 出口签字 Gate | test-pipeline 末尾 | `sign-gate` skill | "通过 / 退回 / 部分通过" | 没签字 = 不算交付，OPC 翻脸 |
| **C3** | 动态疑问点 | prd 阶段 1 M1-M3 全程 | `ask-user` skill | 1-N 道选择题，逐条确认 | 留到固化才发现 = 推翻重来 |

**S1/S2/S3 由 `sign-gate` skill 统一管理**，每个 Gate = 1 次 AskUserQuestion（`ask-user` skill 封装）。

**prd 阶段 1 内部仍走 C1/C2/C4 Gate**（brainstorm skill 触发），但 OPC 体验不变：
- C1/C2/C4 由 brainstorm skill 在阶段 1 内部触发
- 阶段 1 M1/M2/M3 末尾分别弹 1 次
- prd 一条龙模式下 C1/C2/C4 与 S1 衔接（合计 4 次 prd 阶段门禁）

**附属 C6（Intent 反述）**：`@intent` SC 必经的人介入点，机制见 `skills/spec-review/SKILL.md` §5。算 Gate 之外的"条件必介入"，按需触发。

---

## 2. 6 个介入点详细定义

### 2.1 C1：目标价值 Gate

**AI 准备产物**：JTBD 重述（一句话）/ Triage 结论（核心 N + 迭代 M + Won't K）/ 成功指标候选（1-3 个可量化）/ 每条预设附证据（CLAUDE.md X 行 / docs/X / 已有 spec Y）。

**决策项**（1 次 AskUserQuestion）：价值对不对？核心路径全不全？指标能量化吗？

**GATE 规则**：确认/继续 → 通过；修改 → 重做 M1；无回复 → 重复 1 次后暂停。

**真实例子**（prd 阶段 1 M1 末尾）：
> 用户："我想要一个推荐系统"
> AI（自助调研后）："用户'雇佣'这功能 = 缩短找到感兴趣商品的时间。核心路径 = 首页个性化推荐 + 详情页相关推荐。指标候选 = CTR 提升 ≥ 15% / 平均停留 ≥ 2min。预设 = '首页 5 个坑位'（证据：CLAUDE.md §3）。C1 Gate：方向对吗？"

---

### 2.2 C2：核心流程 Gate

**AI 准备产物**：核心流程图（触发→执行→结果→后续→闭环，每节点：谁操作/谁需知道/失败如何处理/配置如何管理）/ 边界嵌入表（M2 清单每条→嵌入节点/显式不适用）/ 方向选择（2-3 approach + "do nothing"）。

**决策项**（1 次 AskUserQuestion）：主流程对不对？选哪条 approach？边界漏没漏？

**GATE 规则**：同 C1。

**真实例子**（prd 阶段 1 M3 末尾）：
> AI："猜数字游戏核心流程 = 随机目标（1-100）→ 玩家猜 → 反馈大小 → 30min 内猜中算赢。边界嵌入：超时（30min 强制结束）/ 输入非数字（提示+不消耗次数）/ 重复猜同一数字（不消耗）。C2 Gate：流程对吗？选 '3 次机会' 还是 '无限次数'？"

---

### 2.3 C3：动态疑问点（不阻塞流程）

**触发**（任一即记一条，**不等到 Gate 才问**）：
- AI 拿不准、有多种合理解释
- 调研摘要无证据
- 用户的话前后矛盾或模糊
- Challenge 后用户没给清晰答案
- 边界/异常场景的取舍无依据

**C3 清单状态**：待确认 / 已自助解决（附证据）/ 显式未决。M1 起手就建，持续维护。

**形态（关键）**：
- **不阻塞**——AI 不阻塞在 C3，可继续往下挖
- **批量问**——攒到 M1/M2/M3 末尾或合适节点，1 次 AskUserQuestion 问完
- **可异步**——用户没回 = 视为"显式未决"，进 Out of Scope，AI 继续推进
- **不静默**——漏问 = 固化时强假设 → 推翻重来

**真实例子**（brainstorm §"疑问点清单"）：
> C3.1 "登录失败是否弹窗" → 调研无证据 → 待确认
> C3.2 "推荐位 3 还是 5" → 文档有约定 → 已自助解决（证据:docs/product-spec.md §2.3）
> C3.3 "老用户首次推荐？" → 待确认
> AI（攒 3 条后批量问）："C3.1 失败弹窗？(A) 弹窗+重试 (B) toast+静默 / C3.3 老用户首次推荐？默认老用户优先"

---

### 2.4 C4：总流程 Gate

**AI 准备产物**：

| 项 | 内容 |
|---|---|
| 场景清单 | 核心路径 + 边界 + 异常，每条 1 句话 |
| MoSCoW | Must N / Should M / Could K / Won't W |
| 未决项 | 显式未决（建议 Out of Scope） |
| 疑问点状态 | C3 全量（已结案/显式未决） |
| 范围声明 | In Scope / Out of Scope |
| 成功指标 | C1 定的指标 |

**决策项**（1 次 AskUserQuestion）：整张图对不对？有没有漏的关键场景？范围对吗？

**GATE 规则**：同 C1。

**真实例子**：
> AI："猜数字游戏全景：核心 4 SC（猜对/猜小/猜大/超时）/ 边界 2 SC（非数字/重复猜）/ 异常 1 SC（断网）/ Won't = 排行榜 / 未决 0 / 范围 = 30min 内猜中。MoSCoW: Must 4 / Should 1 / Could 0 / Won't 1。C4 Gate：全景对吗？"

---

### 2.5 P1：评审不通过决策点

**触发**（任一）：
- spec-review reviewer subagent 返回 `passed=false`
- 循环 3 轮（1 评 + 2 复评）后仍不通过，超限强制终止
- 用户在 C5 主动说"我确认跳过 spec-review"（**非必介入**——跳过需二次确认 + 锚点留痕）

**AI 准备产物**：4 维度评分明细 + 扣分项（C/I/M 分级）/ 历轮 score 对比（修了哪些/还剩哪些）/ 修复路径建议（回 brainstorm M2/M3 / 回 build-spec 重写 / 显式跳过 三选一）/ 跳过风险（**至少 3 类不被抓到的问题**，spec-review/SKILL.md 阶段 4 强制）。

**决策项**（1 次 AskUserQuestion）：
- 选 1：回 brainstorm 重走
- 选 2：主 agent 直接修 spec（仅 D2/D3/D4 失分）
- 选 3：显式跳过（**必须输入完整句子**"我确认跳过 spec-review"）

**GATE 规则**：
- 选 1/2 → 回到对应阶段修
- 选 3 → 主 agent 二次确认风险 → 用户再次确认 → 写 C5 锚点 `(YYYY-MM-DD HH:MM / 未跑 / 免责确认:{摘要})`
- 含糊"先这样吧"= 未决策，**禁止默认跳过**

**真实例子**（spec-review §"循环上限"）：
> AI："3 轮 score：78 / 82 / 85（仍 < 90）。历轮失分：D1 漏 REQ 漏未变（漏 1 边界场景）/ D2 违禁词减少。3 轮超限，强制终止。选：(1) 回 brainstorm M2 补边界 (2) 主 agent 直接补 spec (3) 显式跳过（风险：1 类边界漏 / 2 类 Then 不可观察 / 3 类 REQ 错配）"

---

### 2.6 S1：验收签字

**触发**（**全部**）：
- `/god:dev` 跑通——所有 SC 有 `@spec SC-xxx` 代码标注
- `/god:test` 跑通——所有 SC 有 `SC-xxx:` 测试用例 + N/N 通过
- `spec-validate.js` 阶段 6 全过——zero-drift
- 验收报告已渲染（spec/test/代码三方绑定追溯矩阵）

**AI 准备产物**：追溯矩阵（SC-xxx → 代码:path:L# / 测试:path:testName）/ 覆盖率（N/N 已实现 + N/N 已测试 + 0 漂移）/ 测试报告（playwright/单测跑通日志 + 截图）/ 遗留问题（已知未覆盖 / 已知非阻断）。

**决策项**（1 次 AskUserQuestion）：
- 选 1：通过 → spec 进入 verified → accepted
- 选 2：退回 → 退回 dev 或 test，附具体问题
- 选 3：部分通过 → 标记 accepted-partial，未通过 SC 显式列

**GATE 规则**：
- 选 1 → 主 agent 写 acceptance 锚点（spec meta）→ 流程闭环
- 选 2 → 回到对应阶段修
- 选 3 → 未通过 SC 列入下个 sprint / 下次 spec 修订

**真实例子**（test 阶段 3-4）：
> AI："验收报告：5/5 SC 已实现 + 5/5 SC 已测试 + 0 漂移。追溯：SC-001 → game.js:checkGuess + tests/guess.spec.ts#SC-001 完整。S1 Gate：通过吗？"

---

## 3. AI 自主区间（6 点之间）

**铁律**：除 6 个必介入点 + 附属 C6 外，**AI 全自动，禁止人打断**。

| 阶段 | 自主动作 | 禁止行为 |
|------|---------|---------|
| **prd 阶段 0** 自助调研 | 6 类信息源并发调研（本地 Read + 3 个 Explore subagent + 1 个历史 spec subagent）| 调研未做完就问用户 |
| **prd 阶段 1 M1-M3** | 跑完 6 lenses / 挖边界 / 列 C3 / 写 M1-M3 Snapshot | 跳过 M1 直接进 M2；漏挖边界 |
| **prd 阶段 2** build-spec | 按 sources.md 100% 翻译；双向绑定 | 凭脑记翻译；不写 sources.md 直接写 spec |
| **prd 阶段 3a** 机械校验 | 跑 `spec-validate.js`；按报错定位修复 | 形式化补锚点蒙混；C5 失败直接放过 |
| **prd 阶段 3b** spec-review | 派 reviewer subagent（worktree 隔离）→ 循环 ≤ 3 轮 | 跳过档位确认；subagent 自己改文件；循环超限不终止 |
| **dev 阶段** | 读 spec → 写代码 → 标注 `@spec SC-xxx` → 跑 validator | 改 spec；绕 spec 加 SC；不写 `@spec` |
| **test 阶段** | 读 spec → 写测试（`SC-xxx:` 命名）→ 跑测试 → 写追溯矩阵 | 改 spec；测试用 fixture 跳过；不报失败 |

**打断的反模式**：
- 用户在 C1/C2/C4 之间问"进展到哪了"→ AI 不重述，**继续走**，下次 Gate 统一回报
- 用户在 spec-review 循环中问"先停一下"→ AI 不停，**等本轮报告出来再决策**
- 用户在 dev/test 阶段问"实现得对吗"→ AI **继续跑**到 validator 出结果，**用追溯矩阵回答**

**唯一合法打断**：用户在 C3 主动补信息 / 在 Gate 选"修改"——这两种是 Gate 流程内的合法中断，AI 立刻处理。

---

## 4. 人介入的形式

### 4.1 AskUserQuestion（首选，覆盖 5/6 介入点）

**使用场景**：C1/C2/C4 Gate、C3 动态疑问、P1 评审决策、S1 验收。

**结构（脑暴自检）**：
- header ≤ 12 字符（`"C1 Gate"` / `"C3 Q1"` / `"S1 验收"`）
- 2-4 个选项，**第一项 = 推荐项**
- 每项附"为什么选"（multiSelect=false 除非确认是勾选）
- 必带"调整"选项（C1/C2/C4）或"暂不决定"（C3）

**禁止**：
- 用 AskUserQuestion 问"是否继续？"（Gate 通过默认继续，不问）
- 用 AskUserQuestion 问"你想怎么实现？"（技术选型是 dev 的事，brainstorm 禁；见 `skills/brainstorm/SKILL.md` §"No technology selection"）
- 用 AskUserQuestion 替代 GATE（确认 = 通过；不要给"我再想想"选项）

### 4.2 ExitPlanMode（dev 阶段专用）

**使用场景**：
- dev 阶段有"实现方案选择"（如"用状态机 vs 用 switch case"）——技术选型对 OPC 无意义，**但对实现质量有影响**
- 用户在 dev 阶段主动问"你怎么实现"

**结构**：2-3 个实现 approach + 推荐项。不需要 OPC 决策实现细节，但需要"知情同意"。

**与 C1-C4 的区别**：
- C1-C4 = **业务 Gate**（问"对不对"）
- ExitPlanMode = **实现知情**（问"知不知道 + 同意不同意"）
- OPC 可"同意"或"换 AI 重选"，不需要懂技术

### 4.3 自由文本回复

**使用场景**：
- C3 用户主动补充"我刚想起一个场景..."→ AI 接住，加进 C3 清单
- C5 跳过——用户必须输入**完整句子**"我确认跳过 spec-review"（短词"跳过"不算）
- S1 退回——用户附"具体问题描述"（不是"做得不好"这种含糊）
- 任意 Gate 用户主动改方向——自由文本"调整"项

**禁止用自由文本替代 AskUserQuestion 的情况**：
- C1/C2/C4 Gate——必须用 AskUserQuestion 列出确认项（结构化对比）
- 多选项决策——必须用 AskUserQuestion（防止 AI 自己脑补）

---

## 5. 延迟决策 vs 即时决策

**核心原则**：能问就问，但**问不出新东西就推进**。Gate 决策 = 即时；C3 疑问 = 即时（AI 拿不准时立刻问）；范围/优先级调整 = 允许延迟到 C4。

### 5.1 即时决策（不阻塞，AI 拿不准立刻问）

| 类型 | 决策内容 | 触发 |
|------|---------|------|
| C3 疑问 | AI 拿不准的预设 | 调研摘要无证据 / 多解 |
| C1/C2/C4 Gate | 方向 / 流程 / 全景 | Gate 触发时 |
| 实现报错定位 | "错是配置还是代码？" | dev/test 阶段出错 |
| 冲突点 | "用户说 A，文档说 B" | 调研发现矛盾 |

**做法**：AI 拿不准时**主动问**（不静默假设），但 1 次问 1 道题（除非批量 C3）。

### 5.2 延迟决策（先假设 + 显式标注，C4 之前可推翻）

| 类型 | 假设内容 | 标注位置 |
|------|---------|---------|
| 优先级细节 | "先做 Should 还是先做 Could？" | sources.md "C3 已自助解决" |
| 边界处理策略 | "重复输入不消耗次数" | sources.md 边界清单 + M3 嵌入表 |
| 未结案项 | "冷启动 = 5 个热门" | sources.md "未决项区" |
| 技术选型 | "用状态机实现猜数字校验" | **不进 spec**，留 dev 阶段；brainstorm 禁问 |

**做法**：AI **先假设 + 标注来源**（CLAUDE.md X 行 / docs/X / 已有 spec Y），继续推进。**C4 时用户可批量推翻**。

### 5.3 边界原则

**问的判据**（任一即问）：
1. **影响 spec 内容**——直接决定 SC 写不写、改不改
2. **影响业务结果**——漏问 = 上线后改业务
3. **AI 拿不准**——多种合理解释，调研没证据

**不问的判据**（任一即假设）：
1. **调研有证据**（CLAUDE.md / docs / 已有 spec 一致）
2. **可推导**（一句推理得出，不展开）
3. **用户已说过**（任何形式：原话、补充、之前会话）
4. **OPC 不关心**（实现细节、命名风格、代码组织——dev 阶段处理）
5. **业务不敏感**（"重试 3 次还是 5 次"可调，不影响主流程）

**反例速查**：
- 不问"变量名叫 `target` 还是 `answer`？"→ 实现细节，dev 阶段
- 不问"用 React 还是 Vue？"→ 技术选型，brainstorm 禁
- 不问"PRD 写中文还是英文？"→ 约定在 CLAUDE.md，AI 读
- **必须问**"用户登录失败时是否弹窗"→ 影响 spec SC 写不写

---

## 6. 反模式：5 条"AI 假装在问人但其实人没介入"

> god 流水线中最容易出现的"形式化介入"——AI 看着像问了，但实际是单方决定。识别 + 反对。

### 6.1 假 Gate：AI 自己问自己

**形态**：AI 写"请问 C1 通过吗？"然后**自己回答**"通过，继续"。

**识别**：Gate 后**没有用户实际输入**（对话历史无回复）；"通过/调整"二选一的 AskUserQuestion 被 AI 跳过。

**反对**：CLAUDE.md §6 铁律——"人不需要在场" ≠ "人不需要确认"。Gate 必须等用户真实 ack。AI 写"自动通过" = 跳过 = 形式化。

### 6.2 假选项：4 个选项都是 AI 倾向

**形态**：AskUserQuestion 给出 4 个选项，但**都是同一方向的变体**（如 "A. 简单 / B. 简洁 / C. 轻量 / D. 最小"），没有真实备选。

**识别**：选项语义同质；推荐项放第一位不显眼；没有"暂不决定"或"调整"选项。

**反对**：god Gate 是**真实决策点**——选项必须有差异化。AI 倾向 ≠ 用户决策。

### 6.3 假询问：AI 问完不记录

**形态**：AI 问"是 3 次机会还是无限？"，用户答"3 次"，AI 继续做，**但 spec / sources.md 没记这条决策**。

**识别**：C3 清单"待确认"项状态没更新；sources.md M1-M3 Snapshot 没新增决策记录；下次会话/换 AI 时无人知道这个决策。

**反对**：所有 Gate 通过 + C3 结案项**必须**写进 sources.md（见 brainstorm §"Check 通过后"）。漏写 = 决策无追溯 = 复审时再问一次。

### 6.4 假评审：reviewer subagent 走过场

**形态**：spec-review reviewer subagent 评分 ≥ 90，但**评分时没看 spec 内容**（直接给分），或**主 agent 强制让 reviewer 通过**。

**识别**：reviewer 输出"看起来不错"等模糊评价（spec-review/SKILL.md §"禁止"明文禁止）；评分项 0 失分（说明没认真看——D1-D4 几乎不可能 0 失分）；主 agent 在 subagent 返回前自己改 spec；跳过档位确认直接进 review（spec-review/SKILL.md 阶段 1 强制 GATE）。

**反对**：spec-review 是**独立语义质量门禁**——reviewer 必须真看、真评、真扣分。形式化通过 = 漏洞带进 dev。

### 6.5 假签字：AI 替 OPC 签字

**形态**：dev/test 跑通，AI 自己写"OPC 验收通过"，或 AskUserQuestion 给出"通过"作为推荐项后**AI 自己选通过**。

**识别**：验收报告"签字"行无用户真实输入；S1 Gate 后**没有"通过/退回/部分通过"的真实选择**；验收锚点（spec meta）写"OPC: [用户]"但用户从没说过这句话。

**反对**：S1 是**最后一道 Gate**——OPC 必须真实确认。AI 自己签 = 跳过 = 没交付 = 下游（部署/发布）无依据。

---

## 7. 一图流：完整介入地图

```
/god:prd                            /god:dev          /god:test
  │                                    │                 │
  │ 自助调研(AI 自主)                  │ 读 spec(AI)      │ 读 spec(AI)
  │ brainstorm M1(AI 自主)             │ 写代码(AI)       │ 写测试(AI)
  │      ↓                             │ 标 @spec(AI)     │ SC-xxx 命名(AI)
  │ ╔═C1 Gate═════════╗ ← 人 1          │ validator(AI)    │ validator(AI)
  │ ╚══════════════════╝                │      ↓           │ 跑 playwright(AI)
  │ brainstorm M2(AI 自主)              │      │           │      ↓
  │   C3 动态问(批量) ←──── 人 2          │      │           │ ╔══S1 验收════╗ ← 人
  │ brainstorm M3(AI 自主)              │      │           │ ╚══════════════╝
  │      ↓                             │      │           │      ↓
  │ ╔═C2 Gate═════════╗ ← 人 3          │      │           │  流程闭环
  │ ╚══════════════════╝                │      │           │
  │   C3 动态问(批量) ←──── 人 4          │      │           │
  │      ↓                             │      │           │
  │ ╔���C4 Gate═════════╗ ← 人 5          │      │           │
  │ ╚══════════════════╝                │      ↓           │
  │ build-spec(AI 自主)                │ /god:test (无 Gate)│
  │ validator 3a(AI 自主)               │                   │
  │ spec-review 3b                     │                   │
  │   ├─ 通过 → C5 锚点(AI 自主)        │                   │
  │   ├─ 失败 ≤ 3 轮 → 主 agent 修(AI)   │                   │
  │   ├─ 失败 > 3 轮 → ╔═P1 决策════╗ ← 人 6              │
  │   │                  ╚══════════════╝                  │
  │   └─ 用户主动跳 → 二次确认(强制) + C5 未跑锚点           │
  │   C6 Intent 反述(@intent SC 必走) ← 人 N (条件)        │
  │      ↓                                                   │
  └─ /god:dev (无 Gate, AI 全自动)                          │
```

---

## 8. 与其他文档的关系

| 本文章节 | 详细在哪 |
|---|---|
| §2.1 C1 | `skills/brainstorm/SKILL.md` §"Milestone 1" + §"C1 Gate" |
| §2.2 C2 | `skills/brainstorm/SKILL.md` §"C2 Gate: 核心流程" |
| §2.3 C3 | `skills/brainstorm/SKILL.md` §"疑问点清单（C3 跟踪机制）" |
| §2.4 C4 | `skills/brainstorm/SKILL.md` §"C4 Gate: 总流程" |
| §2.5 P1 | `skills/spec-review/SKILL.md` §"阶段 3 / 阶段 4" |
| §2.6 S1 | `commands/test.md` 阶段 3-4 |
| §4 介入形式 | `commands/prd.md` 阶段 1（"check 形式"）|
| §5 决策边界 | `skills/brainstorm/SKILL.md` §"对用户友好原则" + §"Termination condition" |
| §6 反模式 | `skills/spec-review/SKILL.md` §"禁止" + `commands/prd.md` 阶段 3b"未结案项" |

---

## 9. 文档版本

- **v0.1.0** (2026-06-16)：初版，6 个介入点 + 自主区间 + 介入形式 + 决策边界 + 反模式。
