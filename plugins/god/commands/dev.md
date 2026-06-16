---
description: >
  读 living spec 实现代码。为每个 Scenario 实现，代码标注 @spec SC-xxx 绑定规格。
  v0.4.0 起接入 G1+G2+G3+G8 工具链（spec-cli advance + spec-validate + summary）。
  代码是 spec 的从属实现。
argument-hint: 项目目录
---

你是代码实现者。读 `spec.feature` 实现代码——代码是 spec 的从属。
**v0.4.0 起本阶段接入 god 工具链**（不再是裸跑）。

## 流程

### 阶段 0：环境与状态机自检（必跑，v0.4.0 起）

跑 3 个并行检查，任一失败 → 回 `/god:prd`：

```bash
# 1. spec-validate.js 确认 spec 格式合格（prd 阶段 3a 已挂，本步骤冗余保险）
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>

# 2. spec-cli status 确认 phase = reviewed
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目目录>
# phase 应为 reviewed；否则 advance 或回 prd

# 3. spec-summary check 确认 summary.md 4 项校验过
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js check <项目目录>
```

**判断**：
- `phase: reviewed` + 校验全过 → 进 dev 阶段 1
- `phase: drafted` → 跑 `spec-cli advance`（前提：C5 锚点齐）
- `phase: implemented/verified/accepted` → 已实现，跳过本阶段
- 校验失败 → 回 `/god:prd` 修复

### 阶段 1：实现代码（v0.4.0+ 含 G5 dev-gen）

**G5 dev-gen**（v0.4.0+ P1 已落）：先跑 `node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/dev-gen.js <项目目录>` 出骨架：

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/dev-gen.js <项目目录> [--force]
# 读 spec/spec.feature → 写 src/<feature-slug>.js 或 .ts
# 每个 SC 一个 export function（含 JSDoc @spec SC-xxx + TODO + GWT 注释）
```

**AI 在骨架上改**——消解"读 spec → 想函数签名 → 写 @spec 标注"重复劳动。

**禁止**：
- 绕过 build-spec 直接改 spec.feature（防漂移机制 #1）
- 改代码不写 `@spec` 标注（spec-validate #7 FAIL）
- 给 spec 没有的 SC 加 `@spec` 标注（spec-validate #9 FAIL）
- 删除 dev-gen 生成的 `@spec` 标注（必须保留以通过 validator #7）

### 阶段 2：自检（必跑，3 步）

#### 2a 机械校验

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>
```

**校验项全过**：
- #7 SC 在源码有 `@spec` 标注
- #8 SC 在测试有 `SC-xxx:` 用例
- #9 孤儿代码（代码 `@spec` 标了 spec 没的 SC）| 不应出现
- #10 sources.md ↔ spec.feature 双向绑定
- #11 C5 锚点
- #12 C6 锚点（@intent SC）
- #13 @intent SC 的 Given/Then 形态
- #14 @sad-path SC 绑定

**不通过 → 回阶段 1 修**（按 validator 报错定位）。

#### 2b 状态机推进（v0.4.0 G1 P0）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js advance <项目目录>
# reviewed → implemented
# 失败则报 spec-validate 报错，按 2a 修复
```

#### 2c summary 重产（v0.4.0 G8 P0）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目目录>
# 重产 summary.md（含实现进展的"角色 + 核心流程"段）
```

### 阶段 3：衔接

代码就绪 + phase=implemented + summary.md 最新 → `/god:test`

## spec 生命周期角色

实现阶段（reviewed → implemented）。**只读 spec，不碰 build-spec**。

## 机制

- **代码跟随 spec**：先有 SC 再实现（防漂移铁律）
- **状态机由 spec-cli 守**：phase 不可跳
- **hooks 自动守门**（G3 P0）：git commit 时跑 spec-cli check + spec-validate.js
- 绑定规则（`@spec` 标注格式）见 `SPEC-FORMAT.md` 第 4 节

## 反模式（明确不做）

- ❌ 跳过阶段 0 自检（环境/状态机有问题时硬写代码 = 把 bug 推进 implemented）
- ❌ 实现完不跑 spec-cli advance（phase 卡在 reviewed = test 阶段跑不动）
- ❌ 改 spec.feature（在 dev 阶段改 spec = 绕过 prd = 漂移）
- ❌ 用 `git commit --no-verify` 跳过 hooks 不写 trace（救命场景可以但必留痕）
