---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0007: dev-gen G5 落地（plan.md §4 Week 2 B）

> **状态**：✅ 已接受（v0.4.0+ 实现已落）
> **替代**：[`RFC-0007`](../rfcs/0007-dev-gen.md)
> **决议日**：2026-07-13
> **影响范围**：`spec/scripts/dev-gen.js` / `spec/scripts/dev-gen.test.js` / `skills/dev-pipeline` 阶段 1

---

## 1. 上下文

god v0.4.0 dev 阶段接入工具链但 AI 仍从零写代码。plan.md §4 Week 2 B 决定实现 G5 dev-gen 出确定性骨架，AI 在骨架上改而非从零写。

## 2. 决策

**G5 dev-gen = v0.4.0+ 必做**（roadmap P1）。具体约束：

| 约束 | 决定 |
|---|---|
| 输入 | `spec/spec.feature`（@SC-xxx 列表）|
| 输出语言 | 优先 TS（`tsconfig.json` 存在则用 .ts），否则 JS |
| 文件名 | `<feature-slug>.js/.ts`（feature-slug 从 meta.json specId 或 sources.md H1）|
| 函数名 | `scN`（N = SC 号去零填充） |
| 函数体 | 空 + `// TODO: implement SC-NNN — <name>` + GWT 注释 |
| 标注 | JSDoc `@spec SC-xxx` + `@scenario <name>` |
| 覆盖 | 默认询问；`--force` 跳过 |
| 失败回滚 | 写失败 → 自动恢复原文件 |

## 3. 后果

### 3.1 必修（v0.4.0+ 已完成）

- ✅ `spec/scripts/dev-gen.js`（~250 行：4 函数 + 3 CLI 子命令 + 写失败回滚）
- ✅ `spec/scripts/dev-gen.test.js`（20 测试全过：解析 + 生成 + CLI + TS/JS）
- ✅ demo/lead-scoring 跑通：产 src/lead-scoring.js + spec-validate #7 通过

### 3.2 与 G1/G2 协同

- dev-gen 输出物的 @spec 标注 = spec-validate #7 通过的关键
- dev-gen 不动 spec.meta.json（不破坏 G2 状态机）

### 3.3 拒绝（明确不做）

- ❌ dev-gen 写实现 —— 只写骨架
- ❌ 推断 SC 函数参数 —— 留 `()` 空参，AI 自己加
- ❌ 跨 feature 共用文件 —— 每 feature 一文件
- ❌ 自动跑 dev-gen —— 必须显式调用（避免破坏用户代码）

## 4. 替代方案（已否决）

### 方案 B：每 SC 一个文件

- 拒因：文件爆炸；模块化差；god 鼓励单文件多函数

### 方案 C：dev-gen 写 stub 实现（return null + throw）

- 拒因：与 AI 实现冲突；return 值难猜

## 5. 关联

- 上一 ADR：[`ADR-0006 spec-archive`](0006-spec-archive.md)
- RFC：[`RFC-0007`](../rfcs/0007-dev-gen.md)
- 下一 RFC：[`RFC-0008 test-gen`](../rfcs/)（v0.4.0+ 待开）
