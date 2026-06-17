---
type: runbook
status: stable
owner: god 维护组
last_reviewed: 2026-06-16
update_rule: pr-required
related: [../CLAUDE.md, conventions.md]
---

# 失败模式与恢复手册

> god 流程"崩了怎么办"。**目标**：6 个已知崩点 + 等级分类 + 命令行级恢复步骤 + 事后复盘模板。
> 改方向前先看 [[CLAUDE]] §7。
> 范围：prd / dev / test 三个 command + spec 子系统 + AI 协作流程。
> 配套：[[SPEC-FORMAT]] §4 防漂移机制 + [[commands/dev]] C5 门禁 + [[commands/prd]] §3a/3b 评审。

---

## 0. 文档定位

- **本文 = 救火手册**：崩点识别 → 命令级恢复 → 防再发
- **不承载**：正常流程说明（看 [[commands/prd]] / [[commands/dev]] / [[commands/test]]）
- **前置知识**：懂 [[SPEC-FORMAT]] §4（漂移检测）+ [[commands/dev]] C5 锚点
- **触发时机**：validator 报错 / AI 卡住 / 评审不通过 / 数据看起来"漂"了
- **更新规则**：每发生一次未在册的崩点 → 补一条"崩点 N+1"+ 跑 `spec/TESTING.md` L5

---

## 1. 崩溃等级表

> **4 级** = 数据/逻辑/流程/体验，**严重度从 L1 到 L4 递减**。

| 等级 | 名称 | 影响 | 恢复时限 | 触发条件 |
|---|---|---|---|---|
| **L1** | 数据丢失 | spec/代码/测试被覆盖、回滚找不到 | 立即（< 5 min） | `git status` 异常 / `spec.feature` 不存在 / 提交后 SC 凭空消失 |
| **L2** | 逻辑错误 | SC 错位 / 评审被绕过 / 漂移未捕获 | 当下（< 30 min） | validator 报"漂移" / C5 锚点缺失 / 评审 < 90 分但已固化 |
| **L3** | 流程卡死 | 人等 AI / AI 等人 / 评审循环超限 | 当下（< 1 h） | spec-review 3 轮不通过 / brainstorm 反复问已答过的问题 |
| **L4** | 体验差 | 多轮来回 / 错误信息看不懂 / 命令冗长 | 下次迭代 | 报错不含 SC ID / 修复要 > 3 步 |

**铁律**：L1/L2 → **立即停手** → 按本手册恢复；L3 → 主 agent 决策是否介入；L4 → 记入复盘，不阻塞流程。

---

## 2. 6 个已知崩点

> 排序按"发生概率 × 修复成本"。

### F-01 漂移：代码 @spec 标了 spec 没有的 SC（孤儿代码）

**症状**

- `spec-validate.js` 报错：`[✗] 孤儿代码标注：SC-xxx 在代码有 @spec 但 spec 无此 Scenario`
- 反向：报错 `[✗] SC-xxx 绑定不完整（代码 N 处 / 测试 M 处）`

**根因**

| 触发场景 | 描述 |
|---|---|
| A. 绕过 build-spec 改 spec | 直接编辑 `spec.feature` 删 SC，但代码 `@spec` 标注未同步删除 |
| B. 改 SC 内容改了 ID | 改 Scenario 时重命名 ID，旧 ID 的 `@spec` 标注成孤儿（违反 [[SPEC-FORMAT]] §3.2）|
| C. 重构代码保留旧标注 | 函数被拆/合并，旧的 `@spec` 注释未迁移 |
| D. 团队两人并行改 spec+code | 各自 commit，merge 时 spec 已删但 code 注释还在 |

**L 等级**：**L2**（逻辑错误）。不会立即崩，但 validator 必拦，**会**阻塞 `/god:dev` → `/god:test` 衔接。

**恢复步骤**（3 步）

```bash
# 1. 定位孤儿 SC 的代码位置
node spec/scripts/spec-validate.js <项目目录> 2>&1 | grep "孤儿"
# 输出: 孤儿代码标注:SC-007 在代码有 @spec 但 spec 无此 Scenario

# 2. 决策：删代码标注 OR 还原 spec
#   - 若代码注释是历史遗留（函数已重构）→ 删标注
grep -rn "@spec.*SC-007" src/ tests/
# 手动编辑文件，删除 /** @spec SC-007 */ 注释行
#   - 若代码逻辑仍对应新需求 → 还原 spec（重跑 build-spec 补 SC）

# 3. 复跑验证
node spec/scripts/spec-validate.js <项目目录>
# 期望: [✓] 无孤儿代码标注
```

**预防机制**（已部分实现）

- [[SPEC-FORMAT]] §4.3 追溯矩阵：validator 自动扫 `@spec` 标签（已实现）
- 规范铁律："删 SC 不改 ID，改 ID 不删 SC"（[[SPEC-FORMAT]] §3.2）
- **缺失**：CI pre-commit hook 自动跑 `spec-validate.js`（roadmap 待建，见 [[CLAUDE]] §5）

---

### F-02 漂移：spec 改了代码没改（SC 未实现）

**症状**

- `spec-validate.js` 报错：`[✗] SC-xxx 绑定不完整（代码 0 处 / 测试 N 处）`
- 阶段：prd 已固化、dev 阶段开始时 validator 拦截
- 错位表现：可能是代码整函数缺失 / 部分函数缺 `@spec` 标注

**根因**

| 触发场景 | 描述 |
|---|---|
| A. dev 漏标 `@spec` | 实现了逻辑但忘了在函数上方写注释（违反 [[commands/dev]] 流程）|
| B. dev 改了代码 SC ID 漂移 | 代码侧的注释 SC-001 改成 SC-002 但 spec 没动 |
| C. spec 加 SC 未传达到 dev | build-spec 加了 SC-005 但没派 dev subagent 去看 |

**L 等级**：**L2**（逻辑错误）。dev 阶段就拦下，**不会**到 test 阶段。

**恢复步骤**（4 步）

```bash
# 1. 看哪些 SC 没实现
node spec/scripts/spec-validate.js <项目目录> 2>&1 | grep "绑定不完整"
# 输出: SC-005 绑定不完整（代码 0 处 / 测试 0 处）

# 2. 查 spec 该 SC 的行为契约
grep -A 5 "@SC-005" spec/spec.feature

# 3. 派 dev subagent 重实现 / 补标注
# 加载 /god:dev 子流程，对 SC-005 实现 + 标 /** @spec SC-005 */

# 4. 复跑
node spec/scripts/spec-validate.js <项目目录>
# 期望: [✓] 所有 SC 已实现且已测试
```

**预防机制**

- [[commands/dev]] 阶段 3 强制自检：跑 validator 确认"所有 SC 已实现"（已实现）
- dev 阶段**禁止**改 spec（"实现阶段只读 spec"，见 [[commands/dev]] "spec 生命周期角色"）
- **缺失**：dev 完成后 hook 阻断 `git commit`（roadmap 待建）

---

### F-03 C5 锚点缺失：spec-review 被绕过

**症状**

- `spec-validate.js` 报错：
  - `C5 锚点缺失：sources.md 的 Check 结论区必须含 - **C5 Spec 评审** (...) 行`
  - `C5 锚点格式错：找到 N 行 C5，但均不符合两种合法格式之一`
  - `C5 锚点矛盾：锚点写"通过"但得分 X < 90`
- 阶段：prd 阶段 3a 拦截（[[commands/prd]] §3a）

**根因**

| 触发场景 | 描述 |
|---|---|
| A. 主 agent 跳过 spec-review 直接固化 | 怕被 reviewer 打回分，伪造 C5 锚点但分 < 90 |
| B. 用户主动跳但锚点格式错 | 写了"跳过"但没写"未跑 / 免责确认:..."，或时间戳格式错 |
| C. 复评改了分没改锚点 | 复评 N 轮后分数 92，但锚点还写第一轮的 75 |
| D. spec 从老 demo 迁过来 | 旧 demo 没 C5 锚点，迁移到新机制下 validator 拦 |

**L 等级**：**L2**（逻辑错误）。prd 阶段就拦，**不会**到 dev 阶段。

**恢复步骤**（5 步）

```bash
# 1. 看 C5 现状
grep -n "C5 Spec 评审" spec/sources.md

# 2a. 若锚点完全缺失 → 跑 spec-review
/god:prd  # 加载 spec-review skill（prd command 阶段 3b）

# 2b. 若锚点存在但格式错 → 修格式
# 合法格式见 spec/scripts/spec-validate.js validateC5Anchor
# 通过: - **C5 Spec 评审** (YYYY-MM-DD HH:MM / 简单档|复杂档 / XX 分 / 通过)
# 未跑: - **C5 Spec 评审** (YYYY-MM-DD HH:MM / 未跑 / 免责确认:...)

# 2c. 若分 < 90 但写"通过" → 修分（重评）或改锚点为"未通过/未跑"

# 3. 复跑
node spec/scripts/spec-validate.js <项目目录>
# 期望: [✓] C5 锚点(通过):...
```

**预防机制**（已实现）

- C5 锚点机械校验（[[spec/scripts/spec-validate.js]] validateC5Anchor）
- C5 是 [[commands/dev]] 阶段 1 的门禁（无 C5 → 不进 dev）
- **缺失**：复评轮次记录（"复评 N 轮"目前规范里写了但 validator 没强校验）

---

### F-04 评审循环超限：spec-review 3 轮不通过

**症状**

- 主 agent 反复派 reviewer → 评分 < 90 → 修复 → 再派 → 仍 < 90 → ...
- 用户体感：3 轮 = 15-75 min 卡住（简单档 5-10 min × 3 / 复杂档 15-25 min × 3）
- skill 阶段 3 强制终止：第 3 轮不通过 → 渲染历轮对比表 + 建议"回 brainstorm / 显式跳过 / 人工介入"

**根因**

| 触发场景 | 描述 |
|---|---|
| A. 修复方向错了 | 每次修都在原作者范式内打转（如：把"含糊"修成"更含糊"），未跳出 |
| B. 需求本身有矛盾 | brainstorm M2/M3 留了未结案项 → spec 写出来也矛盾 → 评审永远卡 |
| C. reviewer 视角问题 | 派了不熟悉领域的 reviewer，评分维度过严/过松 |
| D. 简单档被误判为复杂档 | 评审粒度太细，5 个 happy REQ 评了 25 个维度 |

**L 等级**：**L3**（流程卡死）。**不崩数据**，但人/AI 互等超过 1 h。

**恢复步骤**（3 步决策树）

```bash
# 1. 看未结案项 + 历轮失分维度
cat spec/sources.md | grep "未决项"
# 找到 历轮 score 对比表（在主对话上下文）

# 2. 决策（按根因）

# 2a. 修复方向错 → 回到 build-spec 重写
/god:prd  # 重跑 build-spec 子流程,加载 fix 视角

# 2b. 需求本身矛盾 → 回到 brainstorm 重新梳理
/god:prd  # 加载 brainstorm skill,主攻 M2/M3 未结案项

# 2c. 评审维度问题 → 显式跳过（用户必须输入完整句子）
# 用户: "我确认跳过 spec-review"
# 写锚点: - **C5 Spec 评审** (YYYY-MM-DD HH:MM / 未跑 / 免责确认:用户原话)

# 3. 写 incident report（见 §4 模板）
```

**预防机制**（部分实现）

- [[skills/spec-review]] 阶段 3 强制 3 轮上限（已实现）
- 失败回 brainstorm / build-spec / 显式跳过 3 选 1（已实现）
- **缺失**：未结案项 → D1 扣分（已实现）+ 总分封顶 89（roadmap 待建）

---

### F-05 SC 状态机死锁：spec 与代码双向回滚失败

**症状**

- 改了 spec → 代码改完发现新需求有 bug → 想回滚 spec 到旧版本 → 代码也得回滚 → 但 `git log` 上 spec 和 code 不在同一次 commit
- 或：archive 机制未实现（roadmap 规划中），想对比"上周版本"找不到

**根因**

| 触发场景 | 描述 |
|---|---|
| A. spec 与代码不在同 commit | 改 spec 一次 commit，改代码 N 次 commit，revert 时需手动对齐 |
| B. 缺 archive 机制 | spec 系统没有"版本快照"功能（roadmap G4 规划中，文件 `spec/scripts/spec-archive.js` 待建）|
| C. SC ID 被复用 | 删除 SC 后新建 SC 复用旧 ID（违反 [[SPEC-FORMAT]] §3.2）|
| D. @spec-version 误升 MAJOR | 本是修文字却升了 MAJOR，触发下游 dev 误判"破坏性变更" |

**L 等级**：**L1**（数据丢失风险）。回滚失败 = spec 历史断链。

**恢复步骤**（5 步）

```bash
# 1. 找最后一次"spec + code 同步"的 commit
git log --oneline -- spec/spec.feature src/ | head -20
# 找一条 commit 同时改了 spec.feature 和 src/ 的

# 2. 查 archive（如果 spec-archive.js 已实现）
node spec/scripts/spec-archive.js list
# 选一个稳定版本的 archive 路径

# 3. 回滚 spec（保留 code 不动）
git checkout <commit-hash> -- spec/spec.feature spec/sources.md

# 4. 回滚 code（按新 spec 重新跑 dev）
/god:dev  # 按回滚后的 spec 重实现

# 5. 升 @spec-version（修复误升）
# PATCH: 文字改回 → @spec-version 1.0.1
# MINOR: 删 SC → 升 MINOR, 后续 SC 编号接着加（不复用, 见 SPEC-FORMAT §3.2）
```

**预防机制**（部分规划）

- "改 spec 改 code 同一 commit" 写入 [[conventions]]（待建）
- spec-archive.js 版本快照（roadmap 规划中）
- SC ID 不可复用铁律（[[SPEC-FORMAT]] §3.2）
- **缺失**：spec-cli.js 状态机（roadmap 规划中），未实现前主 agent 需自己保证同步

---

### F-06 OPC 评审缺失（机制名沿用 PM）/ 测试与 spec 1:1 漂移

**症状**

- 测试阶段：跑测试发现 `SC-001` 测试过了但 SC-005 漏了用例，validator 报 `[✗] SC-005 缺测试 SC-xxx: 用例`
- 验收阶段：OPC 看验收报告，发现 SC-005 在 spec 但没列在测试覆盖矩阵里
- 反向：测试写了 `SC-099:xxx` 但 spec 无 SC-099 → validator 报孤儿测试

**根因**

| 触发场景 | 描述 |
|---|---|
| A. test 阶段跳 SC | dev 写完代码后 test 直接补"过得了"的用例，**未对照 spec 全量覆盖** |
| B. spec 加 SC 未传达到 test | prd 改了 spec 加了 SC-006，但 test 阶段没看到 |
| C. test 用例命名错 | `test('SC-001的测试', ...)` 没用 `SC-001:` 前缀（违反 [[SPEC-FORMAT]] §4.2）|
| D. test 跑通就 commit | 跑通了 ✓ → commit，但**没**跑 `spec-validate.js` 看绑定 |

**L 等级**：**L2**（逻辑错误）。test 阶段拦截。**L4** 体验（"跑通了为啥还不让 commit"）。

**恢复步骤**（4 步）

```bash
# 1. 找出缺测试的 SC
node spec/scripts/spec-validate.js <项目目录> 2>&1 | grep "缺测试"
# 输出: SC-005 缺测试 SC-xxx: 用例:未验证（漂移）

# 2. 查 spec 该 SC 的行为契约
grep -A 5 "@SC-005" spec/spec.feature

# 3. 写测试（必须以 SC-xxx: 开头）
# tests/game.spec.js
test('SC-005: 场景标题', async ({ page }) => { /* ... */ });

# 4. 复跑
node spec/scripts/spec-validate.js <项目目录>
# 期望: [✓] 所有 SC 已实现且已测试
```

**预防机制**（已实现 + 规划中）

- [[commands/test]] 阶段 3 强制跑 validator 确认 "N/N 完整绑定"（已实现）
- 测试命名 `SC-xxx:` 前缀（[[SPEC-FORMAT]] §4.2 强制）
- **缺失**：test 阶段 hook 阻断 `git commit` if validator FAIL（roadmap 待建）

---

## 3. 恢复手册速查（按崩点）

> **每条命令 = 1 行 shell，可直接复制。** 完整步骤见 §2 对应编号。

| 崩点 | 一键诊断 | 一键恢复 |
|---|---|---|
| **F-01** 孤儿代码 | `node spec/scripts/spec-validate.js . 2>&1 \| grep "孤儿"` | `grep -rn "@spec.*SC-xxx" src/ tests/` → 删/还原 |
| **F-02** SC 未实现 | `node spec/scripts/spec-validate.js . 2>&1 \| grep "绑定不完整"` | 重跑 `/god:dev` 实现 + 标 `@spec` |
| **F-03** C5 缺失/错 | `grep "C5 Spec 评审" spec/sources.md` | 跑 `spec-review` skill / 修锚点格式 |
| **F-04** 评审卡死 | `cat spec/sources.md \| grep "未决项"` | 决策：回 brainstorm / build-spec / 显式跳过 |
| **F-05** 回滚失败 | `git log --oneline -- spec/spec.feature src/` | `git checkout <hash> -- spec/ spec/sources.md` → 重跑 `/god:dev` |
| **F-06** 测试漏覆盖 | `node spec/scripts/spec-validate.js . 2>&1 \| grep "缺测试"` | 补 `test('SC-xxx: 标题', ...)` → 复跑 validator |

**通用恢复前置**（任何崩点先做）：

```bash
# 备份现状（防 L1）
git stash push -m "failure-recovery-$(date +%Y%m%d-%H%M%S)" -- spec/ src/ tests/

# 看 diff
git diff HEAD -- spec/spec.feature
```

---

## 4. 事后复盘模板

> 崩了修完之后**强制**写 incident report，沉淀到 `docs/incidents/YYYY-MM-DD-<short-id>.md`（目录已建，含 `.gitkeep`）。

```markdown
# Incident: <短标题>

## 元信息
- **崩点编号**：F-0X
- **L 等级**：L1 / L2 / L3 / L4
- **发生时间**：YYYY-MM-DD HH:MM
- **恢复时间**：YYYY-MM-DD HH:MM（耗时 X min）
- **触发 command**：/god:prd / /god:dev / /god:test
- **影响范围**：<哪个 spec / 哪些 SC / 是否影响 commit>

## 时间线
- HH:MM 触发（<做什么时崩了>）
- HH:MM 识别（<报错信息关键句>）
- HH:MM 决策（<回哪一步 / 派谁修>）
- HH:MM 恢复（<修了什么>）
- HH:MM 复跑（<validator 通过 ✓>）

## 根因
<一句话根因 + 引用 §2 对应崩点的"根因表"行号>

## 修复 diff
```diff
- <删了啥>
+ <加了啥>
```

## 预防动作
- [ ] 是否要在 [[conventions]] 加一条规范？
- [ ] 是否要在 [[spec/TESTING]] 加 L1 场景？
- [ ] 是否要在 roadmap 加 hook / 校验项？
- [ ] 是否要更新本文 §2 崩点描述？

## 沉淀
- **新知识**：<这条 incident 教会我们什么>
- **新机制**：<要不要在 spec 系统加一条自动校验>
- **流程改动**：<人/AI 协作哪一步要改>
```

**复盘产出流向**：

| 类型 | 沉淀到 | 由谁改 |
|---|---|---|
| 规范/约定 | [[conventions]] | 文档官 |
| 测试场景 | [[spec/TESTING]] | spec 维护者 |
| 校验逻辑 | `spec-validate.js` | spec 维护者 |
| 崩点本身 | 本文 §2 | 文档官 |
| 新增 hook | `hooks/` | 平台层（roadmap） |

---

## 5. 与 god 其他文档的关系

| 本文章节 | 详细在哪 |
|---|---|
| §1 等级定义 | [[CLAUDE]] §1.2（"系统级失败也是失败"）|
| §2 崩点根因表 | [[SPEC-FORMAT]] §4（5 大防漂移机制）|
| F-01/F-02 漂移 | [[commands/dev]] §3 自检 |
| F-03 C5 缺失 | [[commands/prd]] §3a 阶段 3a 机械门禁 |
| F-04 评审卡死 | [[skills/spec-review]] 阶段 3 强制终止 |
| F-05 回滚失败 | [[conventions]] "spec+code 同 commit"（待建）|
| F-06 测试漂移 | [[commands/test]] §3 自检 + [[SPEC-FORMAT]] §4.2 |
| §3 速查命令 | [[spec/scripts/spec-validate.js]] |
| §4 复盘模板 | [[docs/incidents/]]（待建目录）|

---

## 6. 维护

- **每次崩点发生**：先按 §3 恢复 → 再按 §4 写 incident → 最后决定是否补 §2 崩点描述
- **每加新机制**：在 [[spec/TESTING]] L5 加对应错误恢复场景
- **roadmap 推进**：F-01/F-02/F-06 的"hook 阻断 commit"由 spec-drift hook 统一兜底（规划中）
