---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0000: spec 状态机 6 状态（不是 4 状态）

> **状态**：✅ 已接受（v0.4.0 P0）
> **替代**：[`RFC-0001 §3.1`](../rfcs/0001-spec-cli-state-machine.md)
> **决议日**：2026-07-01
> **影响范围**：`docs/spec-directory.md §3` / `commands/prd.md` / `commands/dev.md` / `commands/test.md` / `spec/SPEC-FORMAT.md` / `spec/scripts/spec-cli.js`

---

## 1. 上下文

god 文档历史对 spec 生命周期有两种表述：

| 表述 | 来源 | 状态数 |
|---|---|---|
| A: `drafted → implemented → verified → accepted` | `spec/README.md` 第 16 行 | 4 状态 |
| B: `(idea) → drafted → reviewed → implemented → verified → accepted` | `docs/spec-directory.md §3`（v0.2.0 文档）| 6 状态 |

`docs/roadmap.md` G1 早期版本（修复前）也写 4 状态，与 `spec-directory` 冲突。3 份 perspectives 评审（B-1 阻断项）已识别此矛盾。

## 2. 选项

### 选项 A：4 状态（保留 spec/README.md 现状）

```
drafted → implemented → verified → accepted
```

- **优点**：简洁，状态转移少
- **缺点**：把 `review` 藏在 `drafted` 内是个**不透明子步骤**——drafted 阶段 spec 可能"自评没评完"就被 dev 误读为"可实现"
- **失败案例**：3 份 perspectives 01 §1 D1 11:02 OPC 实测——phase 散落各处，崩了不知道在哪

### 选项 B：6 状态（spec-directory 写法）

```
(idea) → drafted → reviewed → implemented → verified → accepted
```

- **优点**：`reviewed` 是独立 gate，机械可查；`idea` 标识"未开始"
- **缺点**：多 2 个状态，CLI 多 2 个子命令
- **成功案例**：3 份 perspectives 02 §4.3 实战中 PR 检查 phase = `reviewed` 拒绝 dev 写代码

## 3. 决策

**选 B（6 状态）**。原因：

1. **`reviewed` 是独立 gate 不可省**——3 份 perspectives 演练一致表明：把它藏在 `drafted` 内 = 给 F-02（语义模糊）留口子
2. **`idea` 标识有/无 spec.feature 文件**——避免 OPC 想"我还没开始"但 god 误判"已经 drafted"
3. **多 2 状态的成本 < 漏 1 个状态的成本**——`idea` 几乎不触发命令；`reviewed` 是 1 行 advance 转移

## 4. 后果

### 4.1 必修

- `spec/README.md` 状态图改 6 状态（已纳入 v0.4.0 修复清单）
- `docs/roadmap.md §3.2 G1` 状态机改 6 状态（v0.3.0 已修）
- `spec/scripts/spec-cli.js` 实现 6 状态 advance 逻辑

### 4.2 兼容性

- 旧 spec/meta.json（若有）含 `phase: drafted` 不变——cli 6 状态兼容
- 3 份 perspectives 引用"4 状态"处改成"6 状态"（v0.4.0 文档轮次统一）

### 4.3 拒绝

- ❌ 未来 PR 提议"把 reviewed 合并回 drafted"——本 ADR 否决
- ❌ 未来 PR 提议"加 rejected 状态"——走新 RFC 重新决议

## 5. 替代方案（已否决）

### 选项 C：5 状态（去 `idea`）

- 拒因：`idea` 标识"无 spec 文件"，对 OPC 有用（区别"还没想清楚" vs "想了但没写 spec"）

### 选项 D：8 状态（加 `rejected` `archived`）

- 拒因：异常状态太多，CLI 复杂度 ↑；异常走 P1 介入点（人工决策）+ meta.json 字段标识，不用独立状态
