# Living Spec 子系统

god 插件的 living-spec 子系统：以 BDD 活规格为真相源，spec/代码/测试三者通过 Scenario ID 双向绑定，command 主导 spec 生命周期流转，validator 防漂移。自包含，不耦合任何特定工具链。

## 组成

| 组件 | 作用 |
|---|---|
| `SPEC-FORMAT.md` | spec 固定格式规范（Gherkin + `@SC-xxx` + `@spec-version` + 绑定标注）|
| `spec/scripts/spec-validate.js` | 验证手段（14 项校验，zero-drift 检测，仅依赖 Node 内置）|
| `skills/brainstorm` | 探索方法论 skill（**被 prd 加载**，模糊→proposal）|
| `skills/build-spec` | spec 创建/变更唯一入口（**被 prd 调用，不游离**）|
| `commands/prd` `dev` `test` | spec 生命周期各阶段的 command 入口 |

## spec 生命周期（command 流转，skill 承载方法）

```
 /god:prd                              /god:dev          /god:test
  探索 + 创建/变更                       实现              验证→验收
  [brainstorm skill]→proposal→spec      读spec→代码       读spec→测试→报告
          ↓(build-spec)
       drafted ──────────────→ implemented ──────→ verified → accepted
          ↑                                                     │
          └───── 变更回 prd 重走 dev/test ──────────────────────┘
```

- **`spec.feature` 是贯穿所有 command 的真相源**
- **prd 是需求唯一入口**，加载 `brainstorm` skill（探索）+ `build-spec` skill（固化）
- `brainstorm` 是 **skill**（不是 command），由 prd 加载，产 proposal
- `build-spec` 只被 prd 调用（spec 写入唯一能力，不游离）
- 变更从 prd 发起（防漂移：从顶到底强制传播）

## command 职责（生命周期角色）

| command | 生命周期角色 | 输入 | 输出 |
|---|---|---|---|
| `/god:prd` | 探索+创建/变更（→ drafted）| 想法 / proposal | `spec.feature` |
| `/god:dev` | 实现（→ implemented）| `spec.feature` | 代码（`@spec SC-xxx`）|
| `/god:test` | 验证→验收（→ accepted）| spec + 代码 | 测试（`SC-xxx:`）+ 验收报告 |

> `brainstorm` 是 skill（探索方法论），不是 command；由 `/god:prd` 加载。

## 强制规则

1. **spec 写入唯一入口**：`spec.feature` 的创建与变更只能经 `build-spec` skill（由 `/god:prd` 触发），禁止绕过直接编辑。
2. **变更从顶到底**：改 spec（prd）→ 改代码（dev）→ 改测试（test），不许跳过 spec。
3. **每个 command 后自检**：跑 `spec-validate.js`，保证三者绑定一致（zero-drift）。

## 分层原则

- **command 只含流程/机制/架构**（何时做什么、触发条件、边界、衔接）
- **skill 承载具体技巧/说明**（怎么做、工具、详细方法）
- command 不内联 skill 内容，靠加载/引用

## 复现

`demo/guess-number/` 是完整闭环示例（已有 spec v1.0.0 → 改需求 → v1.1.0 → dev → test → 验收报告）。
