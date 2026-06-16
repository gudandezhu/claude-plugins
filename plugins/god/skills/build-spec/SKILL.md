---
name: build-spec
description: |
  living spec 的创建与变更（唯一入口）。把 brainstorm 阶段梳理出的需求清单
  （外部化为 spec/sources.md）100% 翻译为 BDD 规格 spec.feature
  （Feature / Scenario / Given-When-Then + @SC-xxx ID + @spec-version）。
  触发词：生成spec、创建spec、改spec、变更spec、build-spec、写规格。
  任何 spec.feature 的创建或修改都必须经本 skill，禁止绕过直接编辑。
---

# Build Spec — living spec 创建与变更（唯一入口）

## 定位

本 skill 是 living-spec 子系统中 **`spec.feature` 的唯一创建/变更入口**。规范见 `${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md`,验证见 `${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js`。

> 本 skill 服务于 living-spec 子系统（自包含）。其他既有流程的 AC 提取由 `extract-ac` skill 负责,两者不混淆。

## 核心机制：需求清单外部化（无遗漏保证）

**问题**：brainstorm 阶段梳理出的需求（场景/边界/异常/MoSCoW/未决项）原本只存在 AI 对话上下文里,build-spec 阶段靠"凭脑记"翻译成 Scenario——**没有任何机械机制保证不漏**。

**机制**：

1. **`spec/sources.md` 是 spec.feature 的"母本"**——brainstorm 阶段产出,build-spec 阶段翻译。两文件**双向绑定**。
2. **每条需求**在 `sources.md` 有独立条目（带 ID）,明确归属:对应 Scenario ID 或显式 Out of Scope
3. **写 spec.feature 前必须先有 sources.md**——按 sources.md 一条条翻译,不凭脑记
4. **validator 机械校验双向绑定**:
   - sources.md 每条需求都有归属 → 不漏需求
   - spec.feature 每个 Scenario 都能追溯到 sources.md → 不凭空多写

**机械保证** = 任何一条需求"没归宿"都会 validator 报错,build-spec 不能跳过。

## spec/ 目录约定

```
spec/
├── sources.md         # 需求清单（brainstorm 产出,build-spec 翻译的唯一来源）
└── spec.feature       # 行为规格（build-spec 产出,由 sources.md 翻译）
```

## sources.md 格式

```markdown
# 需求清单（spec/sources.md）

## Feature 元信息

- **功能名**: <功能名>
- **目标价值**: <来自 C1>
- **成功指标**: <来自 C1>
- **核心用户角色**: <角色 1、2、3>
- **用户视角文档**: <`spec/sources/user-perspectives/_summary.md` 路径 + 每类角色文档清单；M3 C2 通过后由 user-perspective-analyzer 产出>

## Check 结论（追溯锚点）

- **C1 目标价值** (确认日期 / 用户原话摘要)
- **C2 核心流程** (确认日期 / 用户原话摘要)
- **C3 疑问点** (结案项 + 显式未决项 → 对应"未决项区")
- **C4 总流程** (确认日期 / 用户原话摘要)

## 阶段快照（Stage Snapshot）

借鉴 zcode Context Snapshot 机制:**每阶段完成后把阶段结论固化到这里**,下一阶段只读 snapshot + 当前阶段输入,不靠对话上下文记忆。

brainstorm 阶段每个里程碑 M1/M2/M3 完成时**强制更新对应快照**。

### M1 Snapshot（阶段 1 完成时填写）

- **更新**: <YYYY-MM-DD HH:MM>
- **问题重述 (JTBD)**: <一句话>
- **核心路径 vs 迭代池**: <核心路径 N 条 / 迭代池 M 条>
- **C1 目标价值 Gate**: <通过日期 / 用户原话 / 推荐项是否被采纳>

### M2 Snapshot（阶段 2 完成时填写）

- **更新**: <YYYY-MM-DD HH:MM>
- **业务目标 / 成功指标**: <对齐 C1>
- **核心用户旅程**: <step 1 → 2 → 3 ...>
- **影响范围**: <受影响的现有功能/角色/系统>
- **MoSCoW 分类摘要**: Must N / Should M / Could K / Won't W
- **边界/异常清单**: <M2 挖出的所有边界+异常,带 MoSCW,共 X 条>
- **疑问点清单状态**: 待确认 N / 已结案 M(附证据) / 显式未决 K

### M3 Snapshot（阶段 3 完成时填写）

- **更新**: <YYYY-MM-DD HH:MM>
- **方案选择**: <从 A/B/do-nothing 中选了哪个,理由>
- **核心流程图**: <触发 → 执行 → 结果 → 后续 → 闭环,每节点业务规则>
- **边界/异常嵌入表**: <M2 清单每条 → 嵌入到哪个节点 / 或显式不适用>
- **Adversarial 结论**: <挑战的假设 / 发现的盲点 / 修复>
- **C2 / C4 Gate**: <通过日期 / 用户原话>

## 用户视角参考（来自 user-perspective-analyzer 产出）

> **必读**——本段是 REQ 命名的语义基础。每条 REQ 的"描述（用户视角）"列必须与下方角色视角对齐。

- **汇总**: `spec/sources/user-perspectives/_summary.md`（角色清单 + 关键发现 + 跨角色冲突 + 隐性需求）
- **角色文档**: <列出 `spec/sources/user-perspectives/{role}.md` 每条路径>

**用法**：
1. 跨角色冲突点 → 必须在 build-spec 阶段消解（拆 REQ 或显式 Out of Scope）；不可静默带过
2. 隐性需求 → 转化为 REQ（happy / edge / error 三类）
3. SC 命名参考 → "Given 角色 A 在场景 X" 的语义锚点

## 需求清单

| REQ-ID | 描述（用户视角） | 类别 | MoSCoW | 来源 | 归属 |
|--------|----------------|------|--------|------|------|
| REQ-001 | <happy path 场景> | happy | Must | M2 用户旅程 | → SC-001 |
| REQ-002 | <边界场景> | edge | Must | M2 边界清单 | → SC-002 |
| REQ-003 | <异常场景> | error | Should | M2 边界清单 | → SC-003 |
| REQ-004 | <不做的需求> | oos | Won't | M3 closure | Out of Scope |

**未决项区**（C3 显式未决,已确认不写进 spec）:
- [ ] <未决项描述 + 建议处理>
```

## 创建 spec 流程

1. **读 brainstorm Handoff 产物 `spec/sources.md` 草稿**（含 REQ + MoSCoW + 元信息 + 未决项区 + M1-M3 Snapshot + Check 结论 + 用户视角文档路径）
2. **读 `spec/sources/user-perspectives/` 下的用户视角文档**（必做）：
   - 先读 `_summary.md` 拿跨角色冲突点 + 隐性需求清单
   - 再按 REQ 涉及的场景读对应角色文档
   - 跨角色冲突点必须在 spec 阶段消解或显式 Out of Scope
3. **完善 sources.md**（必须先于 spec.feature,作为翻译 checklist）:
   - happy / edge / error 场景 → REQ
   - 显式 Out of Scope 需求 → REQ(oos)
   - 每条标注来源 + MoSCoW
4. **逐条翻译**:
   - `happy`/`edge`/`error` REQ → 1 个或多个 Scenario;在 sources.md 填 `→ SC-xxx`
   - `oos` REQ → 填 `Out of Scope`（**不写 Scenario,但显式记录**）
5. **编写 spec.feature**:
   - Feature 上方 `@spec-version 1.0.0`
   - Feature 描述（作为…我想…以便…）+ 目标价值 + 成功指标对齐 C1
   - 每个 Scenario 上方 `@SC-xxx @<category>`;Given/When/Then 完整且**可观察、可验证**
   - SC 中涉及角色的，Given 锚定用户视角文档中的角色名（一致性可机检）
   - 对"需求敏感、容易理解错"的 Scenario 主动加 `@intent` tag(语义见 SPEC-FORMAT.md §3.4)
   - 对"系统会失败/出错"类 Scenario 主动加 `@sad-path` tag
   - `@intent` 与 `@happy`/`@edge`/`@error` 正交,可共存(如 `@SC-005 @sad-path @edge`)
6. **反向校验**:spec.feature 的每个 Scenario 在 sources.md 都能找到对应 REQ
7. **自检**:跑 validator 全过

## 变更 spec 流程（防漂移：从 sources.md 发起）

1. **判定变更类型与版本**:
   - 新增行为 → sources.md 加 REQ、spec.feature 加 Scenario,升 **MINOR**
   - 改已有行为契约 → 改 REQ 描述 + 改 Scenario,升 **MAJOR**
   - 仅补边界/修文字 → 升 **PATCH**
2. **先改 sources.md**,再改 spec.feature（ID 是追溯锚点,改 Scenario 内容不改 ID）
3. **升 `@spec-version`**
4. **自检**:跑 validator（含双向绑定）
5. **衔接**:提示用户跑 `/god:dev` + `/god:test` 同步下游

## Scenario 编写原则

- 只写行为规则（系统"做什么"），不写实现（"怎么做"是 dev 的事）
- Then 必须可验证（能写成测试断言）
- 体验类（UI 审美/手感）不进 spec,靠门禁验收
- 一个 Feature 文件聚焦一个功能

## 自检命令

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>
```

**必须通过**:
- 格式项:版本存在 / ID 唯一 / GWT 完整
- 绑定项:sources.md 每条 REQ 有归属（→ SC-xxx 或 Out of Scope）
- 绑定项:spec.feature 每个 SC 在 sources.md 有对应 REQ
- （代码与测试的绑定在 dev/test 阶段补齐。）

## 与其他 skill 的边界

| skill | 职责 |
|---|---|
| `brainstorm` | 梳理需求 → 产出 sources.md（外部化清单）|
| `build-spec`（本 skill）| 翻译 sources.md → spec.feature;维护双向绑定 |
| `/god:dev` | 读 spec 实现代码（标注 `@spec SC-xxx`）|
| `/god:test` | 读 spec 生成测试（命名 `SC-xxx:`）|
