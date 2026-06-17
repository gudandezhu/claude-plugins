---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0008: test-gen G6 落地（plan.md §4 Week 3 C）

> **状态**：✅ 已接受（v0.4.0+ 实现已落）
> **替代**：[`RFC-0008`](../rfcs/0008-test-gen.md)
> **决议日**：2026-07-13
> **影响范围**：`spec/scripts/test-gen.js` / `spec/scripts/test-gen.test.js` / `commands/test.md` 阶段 2

---

## 1. 上下文

G5 dev-gen 出代码骨架后，**测试**还从零写。plan.md §4 Week 3 C 决定实现 G6 test-gen 出测试桩。

## 2. 决策

**G6 test-gen = v0.4.0+ 必做**（roadmap P1）。具体约束：

| 约束 | 决定 |
|---|---|
| 输入 | `spec/spec.feature`（@SC-xxx + tag） |
| 输出语言 | 跟 dev-gen 一致（TS / JS） |
| 测试框架 | 默认 vitest；`vitest.config.*` / `package.json` 推断；`--framework` 强制 |
| 文件位置 | `tests/<feature-slug>.spec.<ext>` |
| 用例名 | `SC-XXX: <name>` 严格格式（spec-validate #8 必填） |
| @sad-path | `it.todo(...)` 强提示 AI 必填（不留 expect 桩） |
| 普通 SC | `it('SC-XXX: ...', () => { expect(feat.scN()).toBeDefined() })` 桩 |
| 失败回滚 | 写失败 → 自动恢复原文件 |

## 3. 后果

### 3.1 必修（v0.4.0+ 已完成）

- ✅ `spec/scripts/test-gen.js`（~250 行：解析 + 框架推断 + 桩生成 + 写失败回滚）
- ✅ `spec/scripts/test-gen.test.js`（19 测试全过：解析 + 推断 + 生成 + CLI + TS/JS + vitest/jest）
- ✅ demo/lead-scoring 跑通：产 tests/lead-scoring.spec.js（vitest + 1 normal + 1 sad-path）
- ✅ spec-validate #8 "所有 SC 已实现且已测试" 通过

### 3.2 与 G5 协同

- G5 dev-gen 产 src/<feature>.js（含 export scN）
- G6 test-gen 产 tests/<feature>.spec.js（含 import + expect(feat.scN)）
- G5 + G6 = 完整代码 + 测试骨架

### 3.3 拒绝（明确不做）

- ❌ test-gen 写真实断言 —— 留 TODO 给 AI
- ❌ 推断 SC 函数参数 —— 留 `/* TODO */` 占位
- ❌ 自动跑 test-gen —— 必须显式
- ❌ 跨 feature 共用 test 文件

## 4. 替代方案（已否决）

### 方案 B：@sad-path 用 it.skip

- 拒因：it.skip 会被静默跳过；it.todo 强提示"待补"

### 方案 C：test-gen 写真实 expect 桩（如 toBe(80)）

- 拒因：AI 写实现时要重写 expect；浪费

## 5. 关联

- 上一 ADR：[`ADR-0007 dev-gen`](0007-dev-gen.md)
- RFC：[`RFC-0008`](../rfcs/0008-test-gen.md)
- 下一 RFC：[`RFC-0009 spec-render`](../rfcs/)（v0.4.0+ 待开）
