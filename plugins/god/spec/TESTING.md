# 回归测试手册

> god plugin spec 子系统的回归测试指南。每次改 `spec-validate.js` / `SPEC-FORMAT.md` / `spec-fmt.js` / spec-review SKILL / build-spec SKILL **之前**，**必须**先跑一遍本手册的测试，**全部通过**才能改。

## 为什么需要这手册

god plugin 的 spec 系统是"AI 自动化验收"的核心：spec 写了啥、AI 就实现啥、测试就验证啥。**任何回归**都会让 AI 自动化流程悄悄失效，用户感觉不到，直到系统崩。

历史上**只跑单元测试不跑集成测试**，曾漏掉过 `@intent` SC 被强制要求代码+测试绑定的设计缺陷（commit 3a61ff3）。**集成测试 = 闭环的灵魂**。

---

## 测试分层

| 层 | 路径 | 测什么 | 时间 |
|---|------|-------|------|
| **L1 单元** | `/tmp/god-tag-test/` | 3 个独立校验（C6/sad-path/格式）单独能抓错 | < 1 min |
| **L2 集成** | `/tmp/god-integration/` | 完整 prd→dev→test 产物链 | 5 min |
| **L3 真实场景** | `demo/guess-number/` | 旧 demo 在新机制下行为不变 | < 1 min |
| **L4 边界** | `/tmp/god-integration/` | 0 @intent / 100% sad-path / 多 SC 共享 | 2 min |
| **L5 错误恢复** | `/tmp/god-integration/` | 报错→理解→修复→通过 | 3 min |
| **L6 回归 CLI** | — | `spec-validate.js --help` / `spec-fmt.js --help` | < 1 min |

**全部加起来 < 15 分钟**。每次改 spec 系统前必跑。

---

## L1 单元测试（必跑）

**目的**：每个新加的 tag/校验单独能抓错。

### 准备

```bash
mkdir -p /tmp/god-tag-test/{spec,src,tests}
```

### 场景 A：C6 锚点缺失 → 期望 FAIL

```bash
cat > /tmp/god-tag-test/spec/spec.feature <<'EOF'
@spec-version 1.0.0
Feature: X
  @SC-001 @intent
  Scenario: 反述
    Given 用户原话(2026-06-15):"X"
    When AI 反述:"X"
    Then 用户确认理解

  @SC-002 @happy
  Scenario: 正常
    Given A
    When B
    Then C
EOF
cat > /tmp/god-tag-test/spec/sources.md <<'EOF'
# 需求清单
## Feature 元信息
- **功能名**: X
- **目标价值**: 测试
- **成功指标**: 通过
- **核心用户角色**: 用户
## Check 结论
- **C5 Spec 评审** (2026-06-15 14:30 / 简单档 / 92 分 / 通过)
## 需求清单
| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-001 | 反述 | intent | Must | M1 | → SC-001 |
| REQ-002 | 正常 | happy | Must | M2 | → SC-002 |
EOF
echo '/** @spec SC-002 */ function a() { return "c"; }' > /tmp/god-tag-test/src/x.js
echo "test('SC-002: 正常', () => {});" > /tmp/god-tag-test/tests/x.spec.js

cd /tmp/god-tag-test && \
  node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js .
```

**期望**：报告里**至少有一行**：
```
[✗] C6 Intent 锚点缺失:SC-001 带 @intent tag,...
```

### 场景 B：Given 缺"原话" → 期望 FAIL

```bash
# 场景 A 基础上,修改 .feature:Given 改为不含"原话"
sed -i 's/用户原话(2026-06-15):"X"/AI 内部理解的目标/' /tmp/god-tag-test/spec/spec.feature

# 在 sources.md 加 C6 锚点
sed -i '/\*\*C5 Spec 评审\*\*/a - **C6 Intent 反述** (2026-06-15 14:35 / SC-001 / 用户原话:"X")' /tmp/god-tag-test/spec/sources.md

cd /tmp/god-tag-test && \
  node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js . 2>&1 | grep '@intent'
```

**期望**：
```
[✗] @intent SC-001 Given 必须含"原话"关键词...
```

### 场景 C：@sad-path 缺测试 → 期望 FAIL

```bash
# 场景 B 基础上,恢复 .feature,加 @sad-path SC,故意不写测试
cat > /tmp/god-tag-test/spec/spec.feature <<'EOF'
@spec-version 1.0.0
Feature: X
  @SC-001 @intent
  Scenario: 反述
    Given 用户原话(2026-06-15):"X"
    When AI 反述:"X"
    Then 用户确认理解
  @SC-002 @happy
  Scenario: 正常
    Given A
    When B
    Then C
  @SC-003 @sad-path
  Scenario: 失败
    Given A
    When B
    Then C
EOF

# 给 SC-003 加 @spec 代码标注,但故意不加 SC-003 测试
cat > /tmp/god-tag-test/src/x.js <<'EOF'
/** @spec SC-002,SC-003 */
function a() { return 'c'; }
EOF

# sources.md 加 REQ-003 + C6 锚点
sed -i '/REQ-002.*→ SC-002/a | REQ-003 | 失败 | error | Must | M2 | → SC-003 |' /tmp/god-tag-test/spec/sources.md

cd /tmp/god-tag-test && \
  node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js . 2>&1 | grep 'sad-path'
```

**期望**：
```
[✗] [sad-path] SC-003 缺测试 SC-xxx: 用例:失败模式未覆盖
```

### 清理

```bash
rm -rf /tmp/god-tag-test
```

---

## L2 集成测试（必跑，最重要）

**目的**：完整 prd→dev→test 链路产物一起跑，发现**单元测试发现不了**的设计缺陷。

**历史教训**：单元测试全过，但集成测试发现 `@intent` SC 被强制要求代码+测试绑定 → 不合理（commit 3a61ff3）。

### 准备

```bash
mkdir -p /tmp/god-integration/{spec,src,tests}
```

### 模拟完整 prd→dev→test 产物

#### 1. `spec/sources.md`（prd 阶段产出 + C5/C6 锚点）

```markdown
# 需求清单（spec/sources.md）

## Feature 元信息
- **功能名**: 猜数字游戏
- **目标价值**: 让玩家 30 分钟内能猜中 1-100 的随机数字
- **成功指标**: 80% 玩家在 30 分钟内猜中
- **核心用户角色**: 普通玩家

## Check 结论（追溯锚点）
- **C1 目标价值** (2026-06-15 / 用户原话摘要:猜数字 1-100,30 分钟内猜中)
- **C5 Spec 评审** (2026-06-15 14:30 / 简单档 / 92 分 / 通过)
- **C6 Intent 反述** (2026-06-15 14:35 / SC-001 / 用户原话:"我想要一个 1-100 的猜数字小游戏,30 分钟内能猜中,有大小提示")

## 需求清单
| REQ-ID | 描述（用户视角） | 类别 | MoSCoW | 来源 | 归属 |
|--------|----------------|------|--------|------|------|
| REQ-001 | 反述核心意图(必须意图锁) | intent | Must | M1 用户原话 | → SC-001 |
| REQ-002 | 猜对数字 | happy | Must | M2 用户旅程 | → SC-002 |
| REQ-003 | 输入非数字失败 | error | Must | M2 边界清单 | → SC-003 |
| REQ-004 | 超出范围失败 | error | Should | M2 边界清单 | → SC-004 |
```

#### 2. `spec/spec.feature`（build-spec 阶段产出）

```gherkin
@spec-version 1.0.0
Feature: 猜数字游戏
  作为玩家，我想猜一个 1-100 的数字，以便获得反馈逐步逼近答案

  @SC-001 @intent
  Scenario: 反述核心意图
    Given 用户原话(2026-06-15):"我想要一个 1-100 的猜数字小游戏,30 分钟内能猜中,有大小提示"
    When AI 反述:"你要的是:系统随机 1-100 目标 + 玩家输入数字 + 系统给大小提示 + 30 分钟内能赢"
    Then 用户确认理解:继续

  @SC-002 @happy
  Scenario: 猜对数字
    Given 目标数字是 50
    When 玩家猜测 50
    Then 显示 "猜对了"

  @SC-003 @sad-path
  Scenario: 输入非数字
    Given 目标数字是 50
    When 玩家猜测 "abc"
    Then 显示 "请输入 1-100 的数字"

  @SC-004 @sad-path
  Scenario: 超出范围
    Given 目标数字是 50
    When 玩家猜测 200
    Then 显示 "请输入 1-100 的数字"
```

#### 3. `src/game.js`（dev 阶段产出）

```js
/** @spec SC-002,SC-003,SC-004 */
function checkGuess(guess, target) {
  // SC-003: 非数字输入防护
  if (typeof guess !== 'number' || isNaN(guess)) {
    return '请输入 1-100 的数字';
  }
  // SC-004: 超出范围防护
  if (guess < 1 || guess > 100) {
    return '请输入 1-100 的数字';
  }
  if (guess === target) return '猜对了';
  if (guess < target) return '太小了';
  return '太大了';
}
```

#### 4. `tests/game.spec.js`（test 阶段产出）

```js
test('SC-002: 猜对数字', () => { /* ... */ });
test('SC-003: 输入非数字', () => { /* ... */ });
test('SC-004: 超出范围', () => { /* ... */ });
```

### 跑测试

```bash
cd /tmp/god-integration && \
  node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js .
```

**期望**：
```
结果: 通过 ✅ (4/4 SC 完整绑定)
```

并且报告里看到所有 3 类锚点都✓：
- `[✓] C5 锚点(通过):...`
- `[✓] C6 Intent 锚点存在:SC-001`
- `[✓] @intent SC-001 Given 含"原话":✓`
- `[✓] @intent SC-001 Then 含"确认理解":✓`
- `[✓] [sad-path] SC-003 失败模式有实现+覆盖`
- `[✓] [sad-path] SC-004 失败模式有实现+覆盖`

**如果有任何 ✗，停下来修，不要 commit。**

### 关键观察点

- SC-001（@intent）**没有** `/** @spec SC-001 */` 代码标注 → 不应报错（豁免）
- SC-001（@intent）**没有** `SC-001:` 测试用例 → 不应报错（豁免）
- SC-002/003/004 都有代码标注 + 测试 → 应通过

### 清理

```bash
rm -rf /tmp/god-integration
```

---

## L3 真实场景测试（必跑）

**目的**：验证 god plugin 自己的 demo 在新机制下行为不变。

```bash
node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js \
  $(git rev-parse --show-toplevel)/demo/guess-number
```

**期望**：
- `[✓] 追溯绑定：4/4 SC 完整` —— 旧功能保留
- `[✗] sources.md 不存在` —— 老问题，与新机制**无关**（commit 前就有的债）
- `[✗] C5 锚点缺失` —— 老问题，与新机制**无关**

**关键断言**：
- **不应该**出现任何 `@intent` / `@sad-path` / `C6` 相关错误（旧 demo 不用这些 tag）
- 旧 demo 不被新机制误伤 = 极简原则（零干扰）成立

---

## L4 边界场景测试（必跑）

**目的**：确保 0/极端情况不崩。

### 边界 1：0 个 @intent SC

```bash
mkdir -p /tmp/god-edge/{spec,src,tests}
cat > /tmp/god-edge/spec/spec.feature <<'EOF'
@spec-version 1.0.0
Feature: 普通
  作为用户

  @SC-001 @happy
  Scenario: 一
    Given A
    When B
    Then C
EOF
cat > /tmp/god-edge/spec/sources.md <<'EOF'
# 需求清单
## Feature 元信息
- **功能名**: 普通
- **目标价值**: 测试
- **成功指标**: 通过
- **核心用户角色**: 用户
## Check 结论
- **C5 Spec 评审** (2026-06-15 14:30 / 简单档 / 92 分 / 通过)
## 需求清单
| REQ-ID | 描述 | 类别 | MoSCoW | 来源 | 归属 |
|--------|------|------|--------|------|------|
| REQ-001 | 一 | happy | Must | M2 | → SC-001 |
EOF
echo '/** @spec SC-001 */ function a() { return "c"; }' > /tmp/god-edge/src/x.js
echo "test('SC-001: 一', () => {});" > /tmp/god-edge/tests/x.spec.js

cd /tmp/god-edge && \
  node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js .
```

**期望**：`结果: 通过 ✅` —— **没有** C6 相关校验项（0 个 @intent SC 时 C6 检查整体跳过）

### 边界 2：100% @sad-path SC

```bash
# 改 .feature:全部 @sad-path,补全 REQ
sed -i 's/@SC-001 @happy/@SC-001 @sad-path/' /tmp/god-edge/spec/spec.feature
# ... (加 SC-002 @sad-path,补 REQ-002,补代码/测试标注)
```

**期望**：`结果: 通过 ✅` —— sad-path 检查正常通过

### 边界 3：C6 锚点多 SC 共享

```bash
# 1 行 C6 锚点包含 "SC-001,SC-002" → 2 个 @intent SC 都识别为已锚定
```

**期望**：2 个 @intent SC 都报 `[✓] C6 Intent 锚点存在:SC-00x`

### 清理

```bash
rm -rf /tmp/god-edge
```

---

## L5 错误恢复测试（必跑）

**目的**：报错 → 理解报错 → 修复 → 通过。验证错误信息**人类可读**。

**起点**：用 L2 集成测试的产物，但**故意制造错误**：

1. **去掉 REQ-004**（制造"sources ↔ feature 不一致"）
2. **去掉 C6 锚点**（制造"C6 Intent 锚点缺失"）
3. 跑 validator，记录报错信息
4. **按报错**修复：补 REQ-004 + C6 锚点
5. 再跑，验证通过

**期望**：
- 报错信息**含 SC ID + 修复指引**（如 `C6 Intent 锚点缺失:SC-001 带 @intent tag,但 sources.md 无...行(见 SPEC-FORMAT.md §3.4)`）
- 修复后**只需 2 步**就能通过

**断言**：如果报错信息含糊、修复要 > 3 步、需要查文档才能懂 → 错误信息**没达到机器友好标准**。

---

## L6 CLI 回归（必跑）

**目的**：确保 CLI 入口没破。

```bash
# spec-validate 不带参数
node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js
# 期望: 报"spec.feature 不存在"或类似,而不是崩溃

# spec-fmt --help
node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-fmt.js --help
# 期望: 打印用法说明

# spec-fmt --next-id
mkdir -p /tmp/god-cli && touch /tmp/god-cli/spec.feature
node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-fmt.js /tmp/god-cli --next-id
# 期望: 输出 "SC-001"
rm -rf /tmp/god-cli
```

---

## 测试前必查清单

- [ ] **当前在主分支**（不是 feature 分支）
- [ ] **工作树干净**（`git status` 无未提交改动）
- [ ] **`spec-validate.js` 可执行**：`node $(git rev-parse --show-toplevel)/plugins/god/spec/scripts/spec-validate.js --help` 或带项目路径能跑

## 测试后必查清单

- [ ] L1 单元 3 个场景都过
- [ ] L2 集成 `结果: 通过 ✅ (4/4 SC 完整绑定)`
- [ ] L3 真实场景旧 demo 行为不变
- [ ] L4 边界 3 个不崩
- [ ] L5 错误恢复 2 步内修通
- [ ] L6 CLI 3 个入口正常
- [ ] **清理所有 /tmp/god-* 临时目录**

## 改完代码后

- [ ] 再跑一次 L1-L6 全部测试
- [ ] 如果新机制有变化，新增对应 L1 场景
- [ ] commit 信息里附"L1-L6 全过"

## 失败处理

| 失败层级 | 处理 |
|---------|------|
| L1 失败 | 99% 是 validator 代码 bug。回滚到上一个 commit，重写。 |
| L2 失败 | **很可能是设计缺陷**（如 commit 3a61ff3 的教训）。先想清楚再改。 |
| L3 失败 | **绝对**是回归。立即停，找回归源（哪个 commit 引入）。 |
| L4 失败 | **多半**是边界处理没考虑到。补充代码，**别删场景**。 |
| L5 失败 | 错误信息不够友好。改文案，让普通用户能看懂。 |
| L6 失败 | 入口崩溃。检查 main() 函数。 |

---

## 与 prd/dev/test command 的关系

- 本手册测的是 **validator + spec 系统**本身的正确性
- 不替代 prd/dev/test command 的端到端测试
- prd 阶段 3a 跑 `spec-validate.js` = 本手册 L1+L2 的子集
- 真正完整的 prd→dev→test 流程要靠人跑（LLM 行为不在本手册范围）

---

## 维护

每次给 spec 系统加新机制（如新 tag、新校验、新 command），**必须**：
1. 加对应的 L1 单元场景
2. 改 L2 集成测试的预期产物
3. 在本手册的"测试前必查清单"里加一行
4. 在 commit 信息里写"扩展 TESTING.md"

**不更新本手册 = 下次测试有缺口 = 回归漏掉**。
