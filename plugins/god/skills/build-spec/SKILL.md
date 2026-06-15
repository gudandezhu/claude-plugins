---
name: build-spec
description: |
  living spec 的创建与变更（唯一入口）。把需求/提案转为 BDD 规格 spec.feature
  （Feature / Scenario / Given-When-Then + @SC-xxx ID + @spec-version），或调整已有 spec。
  触发词：生成spec、创建spec、改spec、变更spec、build-spec、写规格。
  任何 spec.feature 的创建或修改都必须经本 skill，禁止绕过直接编辑。
---

# Build Spec — living spec 创建与变更（唯一入口）

## 定位

本 skill 是 living-spec 子系统中 **`spec.feature` 的唯一创建/变更入口**。

- 创建 spec：从需求生成 v1.0.0
- 变更 spec：新增/修改 Scenario，升版本
- **禁止绕过本 skill 直接编辑 spec.feature**（保证格式合规 + 质量可追溯 + 防漂移）

依据规范：`${CLAUDE_PLUGIN_ROOT}/spec/SPEC-FORMAT.md`
验证手段：`${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js`

> 注：本 skill 服务于 living-spec 子系统（自包含，不耦合任何特定工具链）。其他既有流程的 AC 提取由独立的 `extract-ac` skill 负责，两者不混淆。

## 创建 spec 流程

1. **理解需求**：提取可观察的行为契约（不是实现细节）
2. **划分 Scenario**：一个 Scenario 一个明确行为；边界条件单独成场景
3. **编写 spec.feature**：
   - Feature + 角色价值描述（作为…我想…以便…）
   - 每个 Scenario 上方 `@SC-xxx`（SC-001 起编，三位零填充）
   - Feature 上方 `@spec-version 1.0.0`（初始）
   - Given/When/Then 完整，且**可观察、可验证**
4. **自检**：跑 validator，格式项（版本/ID/GWT）全过

## 变更 spec 流程（防漂移：从 spec 发起）

1. **判定变更类型与版本**：
   - 新增行为 → 加 Scenario，升 **MINOR**
   - 改已有行为契约 → 改 Scenario，升 **MAJOR**
   - 仅补边界/修文字 → 升 **PATCH**
2. **编辑 spec.feature**：
   - ID 不复用（删除的 SC 作废，新增用下一个号）
   - 改 Scenario 内容时**不改其 ID**（ID 是追溯锚点）
3. **升 `@spec-version`**
4. **自检**：跑 validator
5. **衔接**：提示用户跑 `/god:dev` + `/god:test` 同步下游（防漂移从顶到底传播）

## Scenario 编写原则

- 只写行为规则（系统"做什么"），不写实现（"怎么做"是 dev 的事）
- Then 必须可验证（能写成测试断言）
- 体验类（UI 审美/手感）不进 spec，靠门禁验收
- 一个 Feature 文件聚焦一个功能

## 自检命令

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目目录>
```

必须通过：版本存在 / ID 唯一 / GWT 完整。（代码与测试的绑定在 dev/test 阶段补齐。）

## 与其他 skill 的边界

| skill | 职责 |
|---|---|
| `build-spec`（本 skill）| spec.feature 的创建与变更 |
| `/god:dev` | 读 spec 实现代码（标注 `@spec SC-xxx`）|
| `/god:test` | 读 spec 生成测试（命名 `SC-xxx:`）|
