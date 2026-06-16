# RFC-0002: spec-summary（OPC 验收界面，roadmap G8）

> **状态**：草稿（v0.4.0 P0）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 `0002-adr-spec-summary-approved.md`
> **关联 3 视角**：[`01-ops-runbook.md §1 D5 S1`](../perspectives/01-ops-runbook.md) / [`03-architect-perspective.md §3 RFC-001`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.2 G8`](../roadmap.md)（G8 v0.3.0 提 P0）

---

## 1. 背景

god 当前 OPC 验收手段 = 看 `spec.feature`（Gherkin 文本）。问题：

- OPC 不想读 Gherkin（CLAUDE.md §1.1 目标 1 字面写"OPC 看 summary 签字，不直接打开 spec.feature"）
- `/god:test` 阶段 S1 出口产物 = "验收报告"，OPC 看 30+ 页报告 = 注意力爆预算
- 3 份 perspectives 演练一致表明：OPC 3 次不爽，3 次全指向 G8

**核心反模式**：AI 生成的"验收报告"和"spec 摘要"里如果不让 OPC **1 跳回原文**校验 = 给 AI 假装签完的反模式温床。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 1 页纸产物 | `summary.md` ≤ 100 行（v0.4.0 demo 实测 60-80 行） |
| 2 | OPC 不读 Gherkin 也能懂 | summary.md 不出现 `Given/When/Then/SC-xxx` 字眼 |
| 3 | 强制跳回 spec.feature | summary.md 末尾 1 行 `> 详细 spec: spec/SPEC-FORMAT.md#L42-L58` 形式（自动算行号）|
| 4 | 自动跑 | `/god:prd` 阶段 2 末尾 + `/god:test` S1 出口各跑 1 次 |
| 5 | 不在范围内必显 | 1 段 `## 不在范围内` 列 3-7 条 OPC 显式排除项 |

## 3. 详细设计

### 3.1 产物结构

`spec/summary.md`：

```markdown
# <Feature 名> — 1 页纸摘要

> 自动产出（spec/scripts/spec-summary.js v0.1.0）
> 详细 spec：spec/SPEC-FORMAT.md#L<行号>-L<行号>
> 不可手改 —— 修改请改 spec.feature 后重跑

## 目标（1 句）
<一句话说清 OPC 想做什么>

## 角色 + 核心流程（5 行内）
1. <角色 A> → 触发 → <角色 B>
2. ...

## 边界 / 异常清单
- ✅ <正常情况>：<预期>
- ⚠️ <边界情况>：<处理>
- ❌ <异常情况>：<处理>

## 不在范围内（明确排除项）
- <什么不做>（避免验收时翻案）
```

### 3.2 CLI 签名

```bash
$ node spec/scripts/spec-summary.js gen [project]
# 读 spec/spec.feature + spec/sources.md
# 写 spec/summary.md
# 强制跳行号 = 脚本解析 spec.feature 找 "@spec-version" 行 + "Feature:" 行范围

$ node spec/scripts/spec-summary.js check [project]
# 校验 summary.md 存在 + ≤ 100 行 + 含"不在范围内"段 + 末尾有"详细 spec"链接
# exit 0 / exit 1
```

### 3.3 接入 commands/prd 阶段 2 末尾

```
/god:prd 阶段 1（brainstorm M1-M3）→ 阶段 2（build-spec）→ 阶段 2.5（spec-summary 自动跑）→ 阶段 3（spec-review）
```

**关键设计**：
- 阶段 2.5 不阻塞——summary 产出失败不阻塞 prd，warn 一行继续
- OPC 在 S1 出口再次跑 spec-summary —— summary 在"被签字那一刻"必须最新

### 3.4 落点

- `spec/scripts/spec-summary.js`（G8 实现，~300 行）
- `spec/scripts/spec-summary.test.js`（单元测试，~150 行）
- `templates/spec-summary/v0.1.0.md`（1 页纸模板）
- `commands/prd.md` 阶段 2.5 加载 spec-summary
- `commands/test.md` S1 出口加载 spec-summary check

## 4. 验收

- [ ] `node spec/scripts/spec-summary.js gen demo/lead-scoring` 产出 ≤ 100 行 summary.md
- [ ] summary.md 不含 `Given/When/Then/SC-xxx` 任意字眼（grep 验证）
- [ ] summary.md 末尾含 `> 详细 spec: ...#L<num>-L<num>` 链接，跳转行号准确
- [ ] summary.md 含 `## 不在范围内` 段，3-7 条排除项
- [ ] `node spec/scripts/spec-summary.js check demo/lead-scoring` 4 项校验全过
- [ ] v0.4.0 demo（lead scoring）5 天演练：OPC 看 summary 签字，**未打开 spec.feature**

## 5. 反模式（明确不做）

- ❌ summary.md 让 AI 自动总结 spec.feature 自由发挥——必须套模板
- ❌ summary.md 不含"详细 spec"链接——给 AI 假装签完留口子
- ❌ summary.md 含代码片段——OPC 不需要
- ❌ summary.md 含 Gherkin 关键词——违反目标 1 字面
- ❌ 阶段 2.5 阻塞——summary 失败不阻塞 prd

## 6. 开放问题

- [ ] 模板是否支持 OPC 自定义？目前固定 1 个模板（v0.1.0.md）
- [ ] 多个 spec.feature 怎么生成 1 份 summary？（v0.4.0 不支持，roadmap 未来扩展）
- [ ] summary.md 写进 git 还是 .gitignore？目前写进 git（spec 是真相源）

## 7. 时间线

- **Week 1**（2026-07-07 ~ 07-13）：RFC 评审 + 模板冻结 + spec-summary.js 骨架
- **Week 2**（2026-07-14 ~ 07-20）：CLI 完成 + 测试 + 接入 prd 阶段 2.5
- **Week 3**（2026-07-21 ~ 07-27）：v0.4.0 demo 演练 + RFC 转 ADR + 文档更新
