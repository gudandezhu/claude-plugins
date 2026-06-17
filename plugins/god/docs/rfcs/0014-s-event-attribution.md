# RFC-0014: S 事件归因（sign-gate 拒签归因到 OPC 注意力预算）

> **状态**：已合并（v0.7.0+）
> **关联**：[`docs/roadmap.md` G18](../roadmap.md) + [`spec/scripts/sign-gate.js`](../../spec/scripts/sign-gate.js) + [`spec/scripts/measure-opc-cost.js`](../../spec/scripts/measure-opc-cost.js)
> **配套**：[RFC-0013](0013-prd-pipeline.md)（prd 一条龙 / 3 签字 Gate）

---

## 1. 动机

RFC-0013 引入 S1/S2/S3 三个签字 Gate。OPC 在每个 Gate 拒签时需归因（spec 错 / 实现错 / 验收错），但 god 缺少**自动归因**——AI 拒签后需人工把"拒签类型"和"OPC 预算"挂上钩。

G18 解决：**sign-gate 拒签事件写 trace → measure-opc-cost 5 维归因自动分类**。

---

## 2. 设计

### 2.1 事件类型

| 事件 | 触发 | 归因档位 |
|---|---|---|
| `S1 reject-spec` | OPC 在 S1 拒签"spec 错" | **L2 翻脸**（OPC 主观不满意）|
| `S2 reject-impl` | OPC 在 S2 拒签"实现错" | **L1 崩点**（dev 阶段 bug）|
| `S3 reject-accept` | OPC 在 S3 拒签"验收错" | **L2 翻脸**（终验不通过）|

### 2.2 trace 格式

`spec/state/.trace` 追加：
```
S1 reject-spec 2026-06-17T... user-reason="spec 与需求不符"
S2 reject-impl 2026-06-17T... user-reason="..."
S3 reject-accept 2026-06-17T... user-reason="..."
```

### 2.3 归因算法

`measure-opc-cost.js`：
- 读 `.trace`
- 累计 S 拒签事件
- 累加预算：L1 = 60min、L2 = 90min

---

## 3. 落点

- `spec/scripts/sign-gate.js`：S 拒签时写 trace（已实现，commit 含 G18 注释）
- `spec/scripts/measure-opc-cost.js`：5 维归因 + S 事件分类（已实现）
- `spec/scripts/measure-opc-cost.test.js`：7 个 G18 单元测试（已过）
- `spec/scripts/god-trends.test.js`：G18 事件趋势测试

---

## 4. 验收

- 7 个 G18 单元测试全过（commit `5acdd66`）
- measure-opc-cost 输出含 `S reject-spec` / `S reject-impl` 段
