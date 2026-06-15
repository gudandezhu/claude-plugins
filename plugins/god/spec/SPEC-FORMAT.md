# Living Spec 格式规范

> god 插件 living-spec 子系统的规格语言。
> 设计依据：`01-proposal-dev-pipeline.md`（防漂移活规格为核心）。
> 自包含，零外部依赖，不耦合任何特定工具链。

---

## 1. 设计理念

**当代码可被 AI 无限产出，需求规格是唯一的真相源（source of truth）。**

- spec 是**人理解系统的唯一界面**（可读性 > 代码）
- 代码是 spec 的**实现**（从属，跟随 spec 变）
- 测试是 spec 的**验证**（Scenario = 用例）
- 三者通过 **Scenario ID 双向绑定**，变更从 spec ��制传播到代码/测试
- 绑定 + 强制传播 = 一致性 = 不腐烂 = **资产**

本格式的设计目标：**机械可解析、可校验、可追溯**，杜绝 spec drift。

---

## 2. 文件约定

| 项 | 约定 |
|---|---|
| 文件名 | `spec.feature`（一个功能一个文件）|
| 位置 | 项目的 `spec/` 目录，或 demo 的根目录 |
| 编码 | UTF-8 |
| 语言 | Gherkin（中文/英文均可）|

---

## 3. 格式语法

基于 Gherkin，扩展三个**自定义 tag** 实现可追溯：

```gherkin
@spec-version 1.0.0
Feature: 功能名称
  作为<角色>，我想<动作>，以便<价值>

  @SC-001 @happy
  Scenario: 场景标题
    Given 前置条件
    When 动作
    Then 预期结果
```

### 3.1 三个自定义 tag（可追溯的核心）

| Tag | 必填 | 作用 | 位置 |
|---|---|---|---|
| `@spec-version X.Y.Z` | 是 | spec 整体版本（语义化）| Feature 上方，每文件唯一 |
| `@SC-xxx` | 是 | Scenario 唯一 ID | 每个 Scenario 上方，全文件唯一 |
| `@happy`/`@edge`/`@error` | 否 | 场景分类（便于筛选）| Scenario tag |
| `@intent` | 否 | 标记"意图反述" Scenario：强制 AI 把需求反述给人类确认（锚点写 C6）| Scenario tag |
| `@sad-path` | 否 | 标记失败模式 Scenario：要求测试必须覆盖，零容忍跳过 | Scenario tag |

### 3.2 Scenario ID 规则

- 格式：`SC-` + 三位数字，零填充（`SC-001`、`SC-012`）
- 全文件唯一，不可重复
- 一经分配**不复用**：删除场景时其 ID 作废，新增场景用下一个号
- 变更场景只改内容，**不改 ID**（ID 是追溯锚点，改了就断链）

### 3.3 版本规则

- `@spec-version` 用语义化版本：`MAJOR.MINOR.PATCH`
  - PATCH：修文字、补边界，不改行为契约
  - MINOR：新增 Scenario（新需求）
  - MAJOR：改动已有 Scenario 的行为契约（破坏性）
- 每次改 spec 必须升版本（validator 强制）

### 3.4 两个语义 tag（AI 防跑偏）

复用 Gherkin tag 机制，零新增解析器。规则：

**`@intent` — 意图反述（防需求漂移）**

对"需求敏感、容易理解错"的 Scenario 加此 tag。约束：
- **Given 必须是用户原话摘抄**（一字不改的引用，含日期或出处标记），便于机械校验
- **Then 必须含"确认理解"关键词**（`确认理解` / `acknowledge`），表示该 SC 的存在意义就是反述
- 配套 `spec/sources.md` 的 **C6 锚点**：`- **C6 Intent 反述** (YYYY-MM-DD HH:MM / SC-xxx[,SC-yyy] / 用户原话:<短摘>)`，证明"AI 反述过 + 用户确认过"
- **豁免代码+测试绑定**：反述场景不是被测对象，被人类确认已保证"意图被锁"，不再要求 `@spec` 代码标注和 `SC-xxx:` 测试用例
- 锚点缺失 / Given 缺"原话" / Then 缺"确认理解" → validator FAIL，dev 阶段被门禁拦截

**`@sad-path` — 失败模式（防测试漏覆盖）**

对"系统出错 / 异常 / 边界失败"类 Scenario 加此 tag。约束：
- 与普通 SC 一样要 `@spec SC-xxx` 代码标注 + `SC-xxx:` 测试
- **额外**：tag 单独标注后，validate 阶段会显式提示"该 SC 是 sad-path，必有失败用例"，让测试缺失一眼可见
- 错误信息前缀加 `[sad-path]`，与普通 SC 错误区分
- 零额外成本——只多了个 tag 字符 + 一行 validator 提示

两者均不改变 Gherkin 执行语义，**只是给 AI agent 看的语义标识**。
语义正交：可与 `@happy`/`@edge`/`@error` 共存（如 `@SC-005 @sad-path @edge`），互不冲突。

---

## 4. 三者绑定规则（防漂移）

spec 必须能追溯到**代码实现**和**测试验证**。靠标注：

### 4.1 代码标注

实现的代码**必须**标注它实现哪些 Scenario。注释格式：

```js
// @spec SC-001,SC-002,SC-003
function checkGuess(guess, target) {
  // ...
}
```

- 标注放在**函数/模块**上方，`@spec` 后跟逗号分隔的 SC ID 列表
- 一个函数可标注多个 SC（实现多场景）
- validator 扫描所有源码的 `@spec SC-xxx` 标注，建立 SC → 代码映射

### 4.2 测试标注

测试用例**必须**以 `SC-xxx:` 开头命名，绑定它验证的 Scenario：

```js
test('SC-001: 猜对数字', async ({ page }) => { /* ... */ });
test('SC-002: 猜小了', async ({ page }) => { /* ... */ });
```

- validator 扫描测试文件中所有 `SC-xxx:` 命名的用例，建立 SC → 测试映射
- 一个 SC 可有多个测试，但**每个 SC 至少一个**测试

### 4.3 追溯矩阵

validator 汇总三方，输出每个 SC 的：

```
SC-001 → 代码:game.js:checkGuess  测试:guess.spec.ts#SC-001  ✓完整
SC-002 → 代码:game.js:checkGuess  测试:guess.spec.ts#SC-002  ✓完整
SC-003 → 代码:(缺失)              测试:(缺失)                ✗孤儿(漂移!)
```

**任一 SC 缺代码或缺测试 = 漂移**，validator 报错。

---

## 5. 变更流程（防漂移的强制顺序）

> **spec 的创建与变更统一由 `build-spec` skill 完成（唯一入口）。** 手动编辑 `spec.feature` 必须经该 skill 流程，禁止绕过，以保证格式合规、质量可追溯、防漂移。

需求变更**必须从 spec 发起**，自顶向下传播：

```
1. 改 spec.feature（加/改 Scenario，升 @spec-version）
2. 改代码（实现新/改的 SC，标注 @spec）
3. 改测试（为新/改的 SC 写/改用例，命名 SC-xxx:）
4. 跑 spec-validate.js → 三者绑定一致才算闭环
```

**跳过 spec 直接改代码 = 制造孤儿代码 = 债务**，validator 会因"代码有 @spec SC-xxx 但 spec 无此 SC"报错。

---

## 6. 完整示例（猜数字游戏）

`spec.feature`：
```gherkin
@spec-version 1.0.0
Feature: 猜数字游戏
  作为玩家，我想猜一个 1-100 的数字，以便获得反馈逐步逼近答案

  @SC-001 @happy
  Scenario: 猜对数字
    Given 目标数字是 50
    When 玩家猜测 50
    Then 显示 "猜对了"

  @SC-002 @edge
  Scenario: 猜小了
    Given 目标数字是 50
    When 玩家猜测 30
    Then 显示 "太小了"

  @SC-003 @edge
  Scenario: 猜大了
    Given 目标数字是 50
    When 玩家猜测 80
    Then 显示 "太大了"

  @SC-004 @intent
  Scenario: 反述"猜数字游戏"核心意图
    Given 用户原话(2026-06-15):"我想要一个 1-100 的猜数字,玩 30 分钟内能猜中"
    When AI 反述意图:"你要的是:随机目标 + 每次猜给大小提示 + 30 分钟内能赢"
    Then 用户确认理解:继续实现

  @SC-005 @sad-path
  Scenario: 输入非数字
    Given 目标数字是 50
    When 玩家猜测 "abc"
    Then 显示 "请输入 1-100 的数字"
```

代码 `game.js`：
```js
/** @spec SC-001,SC-002,SC-003 */
function checkGuess(guess, target) {
  if (guess === target) return '猜对了';
  if (guess < target) return '太小了';
  return '太大了';
}
```

测试 `guess.spec.ts`：
```js
test('SC-001: 猜对数字', async ({ page }) => { /* ... */ });
test('SC-002: 猜小了', async ({ page }) => { /* ... */ });
test('SC-003: 猜大了', async ({ page }) => { /* ... */ });
```

---

## 7. 校验规则（validator 检查项）

`spec-validate.js` 机械执行以下检查，任一失败即报错：

| # | 检查项 | 失败含义 |
|---|---|---|
| 1 | spec.feature 存在 | 无规格 |
| 2 | 含 1 个 Feature | 格式错误 |
| 3 | 含 `@spec-version` 且语义化 | 缺版本 |
| 4 | 每个 Scenario 有 `@SC-xxx` tag | 缺 ID |
| 5 | 所有 SC ID 唯一 | ID 冲突 |
| 6 | 每个 Scenario 有 Given/When/Then | 结构残缺 |
| 7 | 每个 SC 在源码有 `@spec SC-xxx` 标注 | 未实现（漂移）|
| 8 | 每个 SC 在测试有 `SC-xxx:` 用例 | 未验证（漂移）|
| 9 | 代码无 `@spec` 标注了 spec 不存在的 SC | 孤儿代码（漂移）|
| 10 | `spec/sources.md` 需求清单 ↔ spec.feature SC 双向引用一致 | 需求漏嵌 / 凭空多写 |
| 11 | `spec/sources.md` 含 C5 Spec 评审锚点（通过/未跑，格式见 `skills/spec-review/SKILL.md` 阶段 4） | spec-review 被绕过 |
| 12 | 带 `@intent` 的 SC 在 `spec/sources.md` 有对应 C6 锚点 | 意图反述被绕过 |
| 13 | `@intent` SC 的 Given 含"原话"、Then 含"确认理解" | 反述形式化走过场 |
| 14 | 带 `@sad-path` 的 SC 在源码 + 测试均有绑定（同普通 SC，仅错误前缀区分）| 失败模式无覆盖 |

通过 = 三者绑定一致 = zero-drift。
