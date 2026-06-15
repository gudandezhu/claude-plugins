---
name: spec-review
user-invocable: false
description: |
  PRD 语义评审。build-spec 完成后跑,对 `spec/sources.md` + `spec/spec.feature`
  做用户视角/可验证性/绑定一致性三维质量门禁,≥90 分通过。
  关键:失败时 skill 只汇总不修复,把决策权交回主 agent(回 brainstorm / build-spec / 显式跳过)。
  触发词:spec 评审、spec 审查、spec-review、PRD 评审。
---

# Spec Review

## 定位

PRD 流水线中**build-spec 完成后、/god:dev 之前**的一道**独立语义质量门禁**。

| 项目 | 决策 |
|---|---|
| 评审产物 | `spec/sources.md` + `spec/spec.feature` |
| 评分 | 100 分制,≥90 通过 |
| 分档 | 简单 / 复杂两档(由本 SKILL 在调用前判定) |
| **循环模式** | **主 agent ↔ reviewer subagent**:派 subagent 评分 → 不通过则主 agent 修复 → 再派 subagent 复评 → 通过或超上限终止 |
| **失败处理** | **subagent 只检查不修**,主 agent 拿到报告后决策(回 brainstorm / build-spec / 显式跳过) |
| **跳过机制** | 用户必须明确输入"我确认跳过 spec-review",并写入 spec 元信息 |

## 与 eval-loop 默认行为的差异

`eval-loop` skill 提供方法论(rubric + reviewer/fixer 角色规范)。**本 SKILL 不调 eval-loop workflow,改为派单个 reviewer subagent**,原因:
- `sources.md` 和 `spec.feature` 是作者(brainstorm + build-spec)产物,自动 fixer 仍继承作者范式,无法独立视角
- **修复必须跳出 SKILL 边界**:由主 agent 决定回 brainstorm / build-spec / 显式 Out of Scope
- 循环控制(派→评→修→再派)由主 agent 编排,不依赖 workflow 脚本

## 工作流程

### 阶段 1:简单/复杂档判定

在调用 reviewer 之前,先**询问用户确认档位**(M1 triage 的核心路径条数 + 是否跨系统/权限/计费):

| 档 | 触发条件 | 评审深度 | 耗时 |
|---|---|---|---|
| **简单档** | happy REQ ≤ 5 | 每个维度抽样 1 SC | 5-10 min |
| **复杂档** | happy REQ > 5 / 权限 / 计费 / 跨系统 | 全量评审 | 15-25 min |

**GATE**:用户必须明确选择档位(简单/复杂),不选不继续。

### 阶段 2:主 agent 派 reviewer subagent(单轮)

**调用方式**:主 agent 通过 `Agent` 工具派 subagent,**不调 workflow 脚本**。

```
Agent({
  subagent_type: "general-purpose",
  prompt: <reviewer prompt 模板>,
  isolation: "worktree"  // 避免污染主目录
})
```

**reviewer prompt 模板**(主 agent 拼装后传入):

```
你是一个独立 spec 评审员。请严格按 Rubric 对目标内容进行量化评分。

## 评审技能(必须先 Read)
Read 评审技能文件,按其专业流程执行: ${CLAUDE_PLUGIN_ROOT}/skills/spec-review/SKILL.md

## 模板文件
Read reviewer 模板了解完整评分规则: ${CLAUDE_PLUGIN_ROOT}/skills/eval-loop/prompts/reviewer.md

## 目标内容路径
<项目目录>/spec
(同时含 sources.md 和 spec.feature,缺失由 PreCheck 拦截)

## Rubric 路径
${CLAUDE_PLUGIN_ROOT}/skills/eval-loop/references/rubric-spec-review.md

## 通过阈值
90

## 评审范围限定(档位)
{简单档:抽样评审 / 复杂档:全量评审}

## 执行要求
1. 先跑 PreCheck:bash "${CLAUDE_PLUGIN_ROOT}/scripts/dev/check-deliverables.sh" "<项目目录>/spec" "需求清单|spec/sources.md" "行为规格|spec/spec.feature"
   缺失 → 直接返回 preCheckPassed=false
2. Read Rubric 和目标内容(目录则 Glob)
3. 按 Rubric 逐项评分(通过=满分,部分通过=50%,不通过=0)
4. 汇总得分,结构化输出

## 禁止
- 禁止修改任何文件
- 禁止不读内容就评分
- 禁止给模糊评价
- 只评估,不修复
```

**主 agent 拿到 subagent 返回的 JSON 报告后,继续走阶段 3 决策**。

### 阶段 3:主 agent ↔ reviewer 循环(直到通过或超上限)

subagent 返回报告后,主 agent 按下表分流:

| 评审结果 | 主 agent 动作 |
|---|---|
| `passed=true`(score ≥ 90) | 进入阶段 4(归档) |
| `passed=false`,扣分维度 = D1 漏 REQ/边界 | **回 brainstorm M2/M3** 重走,再 build-spec,再派 reviewer |
| `passed=false`,扣分维度 = D2/D3/D4 | **主 agent 直接修 spec 文件**(重写对应 Scenario 或 REQ),改完派 reviewer 复评 |
| 未结案项 | **主 agent 主动 AskUserQuestion** 问用户,不可静默 |

**循环上限**:同一份 spec 最多派 **3 轮** reviewer subagent(第 1 轮评审 + 最多 2 轮复评)。  
**超上限处理**:第 3 轮仍不通过 → 强制终止循环,渲染给用户:
- 历轮 score 对比表
- 历轮扣分维度变化(说明修了哪些 / 还剩哪些)
- 建议:回 brainstorm 重新梳理 / 显式跳过 / 人工介入

**主 agent 修复约束**(本 SKILL 范围内,主 agent 自己改文件时):
- 最小化修复:只改扣分项直接相关的内容
- 不重构:不重写整个 Feature 文件
- 改完必须再派 reviewer 复评,确认 score 提升(否则视为空转,直接回 brainstorm)

### 阶段 4:跳过机制(用户主动)

用户在任意时刻可输入"我确认跳过 spec-review",效果:
- 后续 `/god:dev` 仍可继续(不阻塞)
- **下游 dev/test 不能引用本次评审结果**
- 但 **spec 历史必留下一行 C5 锚点**——明示"未跑 + 免责确认",后续追溯可见

为防止误跳,跳过需要满足:
- 主 agent **必须二次确认**:把评审未跑的风险说一遍(列出至少 3 类问题不会被抓到)
- 用户**必须**输入完整句子"我确认跳过 spec-review",短词("跳过")不算

### 阶段 5:Intent 反述(@intent 场景必走)

**触发**:`spec.feature` 中有带 `@intent` tag 的 SC(数量由 reviewer 在阶段 2 评分时识别)。

**流程**(与阶段 2 评审**并行**,不阻塞评审本身):

1. **AI 反述**:主 agent 对每个 `@intent` SC,把"用户原话需求"用 AI 自己的话**完整反述一遍**给用户
   - 必须含 SC 标题、关键 Given/When/Then、要解决的业务问题
2. **人类确认**:用户**必须明确回复**"反述正确 / 继续"或纠正;**不回复 = 默认未确认**(reviewer 会把"未确认"标为 D2 失分)
3. **写锚点**:确认后主 agent 写一行到 `spec/sources.md` 的 Check 结论区:
   ```markdown
   - **C6 Intent 反述** (YYYY-MM-DD HH:MM / SC-xxx[,SC-yyy] / 用户原话:<用户原话短摘>)
   ```
4. **下游消费**:`spec-validate.js` 阶段 6.7 机械校验 C6 锚点存在 + Given/Then 形态(强约束),缺则 FAIL,`/god:dev` 阶段门口拦截

**跳过机制**:复用阶段 4 的"我确认跳过"模式——用户输入"我确认跳过 Intent 反述",C6 锚点改写为 `(YYYY-MM-DD HH:MM / 未跑 / 免责确认:...)`。**二次确认 + 锚点留痕**,与 C5 跳过一致。

**与 C5 区别**:C5 = spec 评审发生过;C6 = 每个 @intent SC 的意图被人类确认过。两者正交,各走各的。

## 评审产物归档(强制,无论通过/跳过都写)

主 agent **必须**在评审结束后写一行到 `spec/sources.md` 的 Check 结论区,**两种格式二选一**:

**通过时**(最终轮 score):
```markdown
- **C5 Spec 评审** (YYYY-MM-DD HH:MM / {简单档|复杂档} / XX 分 / 通过 / 复评 N 轮)
```

**未通过/终止时**(明示未通过原因):
```markdown
- **C5 Spec 评审** (YYYY-MM-DD HH:MM / {简单档|复杂档} / XX 分 / 未通过 / 卡在:{未结案项|D2违禁词|...})
```

**跳过时**(明示"未跑",不与"通过"混淆):
```markdown
- **C5 Spec 评审** (YYYY-MM-DD HH:MM / 未跑 / 免责确认:{用户原话或短摘要})
```

**这条锚点的强制消费方**:`/god:dev` 阶段会**读 C5 锚点**,无 C5 → 报错(见 `commands/dev.md`)。  
**意义**:spec 历史上任一版本必带 C5 行,不存在"完全没跑过 spec-review"的黑洞。

## 与 zcode requirement-review 的差异

| 维度 | zcode | god spec-review(本 SKILL) |
|---|---|---|
| 形态 | 独立 subagent,作者同主对话 | **主 agent ↔ reviewer subagent 循环**,作者上下文 0 继承 |
| 检查项 | 5/12/18 档,UI 字段/接口/兼容 | 4 维度评分,简单/复杂两档 |
| 检查项来源 | 传统 PRD 字段(技术细节) | BDD 视角(用户/可验证/绑定) |
| 通过门槛 | 用户逐项 ack | ≥90 分量化 gate |
| 失败处理 | 边审边改(同 agent) | **subagent 不改,主 agent 改后派 subagent 复评**(物理隔离 + 循环) |
| 循环上限 | 无 | 3 轮(1 评 + 2 复评),超限强制终止 |
| 未结案项 | 不处理 | **未结案项 → D1 扣分 + 总分封顶 89** |
| 跳过 | 需明确确认 | 需明确确认 + 写入 spec 元信息 |

## 输入 / 输出

**输入**:
- `项目目录`(必需,含 `spec/sources.md` + `spec/spec.feature`)
- `档位`(由本 SKILL 阶段 1 引导用户确认:简单/复杂)

**输出**(由主 agent 渲染给用户):
- 评审得分 + 通过状态
- 4 维度评分明细表
- 扣分详情(Critical / Important / Minor)
- 修复路径建议(回 brainstorm / build-spec / 显式跳过)

## 自检命令

机械前置校验(reviewer 跑分前必须先过):
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/dev/check-deliverables.sh" "$WORK_DIR" \
  "需求清单|spec/sources.md" \
  "行为规格|spec/spec.feature"
```

任一缺失 → 直接 FAIL,跑不到 reviewer。

## 与其他 skill 的边界

| skill | 职责 | 本 SKILL 与之关系 |
|---|---|---|
| `brainstorm` | 梳理需求 → sources.md | **本 SKILL 不替代**;评审失败(D1)可回此 |
| `build-spec` | 翻译 sources.md → spec.feature | **本 SKILL 不替代**;评审失败(D2/D3/D4)可回此 |
| `eval-loop` | 评审方法论(rubric + reviewer prompt 模板) | **本 SKILL 复用其 rubric 和 reviewer 模板,但不调其 workflow;循环由主 agent 编排** |
| `tech-review` / `code-review` / `breakdown-tasks-review` | 其他阶段评审 | **本 SKILL 是它们的 spec 阶段对等** |

## 禁止

- 禁止 reviewer subagent 修改任何 spec 文件
- 禁止主 agent 在 subagent 返回前自己改 spec(必须先看报告,按报告修)
- 禁止循环超过 3 轮(1 评 + 2 复评),超限必须终止
- 禁止跳过档位确认直接进 review
- 禁止把"用户说跳过"记成"已 review 通过"
- 禁止给"看起来不错"等模糊评价(reviewer 输出约束)
