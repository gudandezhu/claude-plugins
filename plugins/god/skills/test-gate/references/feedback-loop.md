# 反馈闭环协议

> 来源：架构设计文档 2.2 反馈闭环 + 2.3 驳回模式
> 用途：定义 Agent 3 质量评测驳回后如何驱动 Agent 1/2 修正

## 驳回类型

| 类型 | 触发条件 | 流向 | 修复方式 | 维度 |
|------|---------|------|---------|------|
| **A: 分支遗漏** | 分支覆盖/边界/异常 < 80%（FAIL） | Agent 3 → Agent 1 | 重启 case-designer 补充缺失项 | branchCoverage, boundaryCompleteness, exceptionPathCoverage |
| **B: 脚本质量** | 脚本可执行性/断言 < 80%（FAIL） | Agent 3 → Agent 2 | 重启 script-writer 修复质量问题 | scriptExecutability, assertionAccuracy |
| **C: 业务理解偏差** | 语义一致性 < 80%（FAIL） | Agent 3 → Agent 1 + 2 | 联合修复案例逻辑+脚本语义 | semanticConsistency |

> **阈值说明**：quality-evaluator.js 中 80% 为硬阻断阈值（FAIL，触发驳回），80-94% 为警告阈值（WARN，verdict=PASS，不触发修复但记录到报告）。架构设计文档中的 95% 是长期目标阈值，后续 Phase 通过调整硬编码值为目标值。

## 当前模式

- **Phase 2**: `mode: "full"` — Type A/B/C 全部启用，6 维度评测

## Type B 反馈流程（脚本质量）

```
quality-evaluator.js 输出 evaluation-report.json
  │
  ├─ verdict: PASS → 继续现有 AC 合规检查
  │
  └─ verdict: FAIL + Type B items
      │
      ▼
  读取 rejectionItems 中 type="B" 的项
  提取 vagueAssertions / gate-result 失败步骤
      │
      ▼
  构造修复 prompt（基于 gate-fix.md 模板）:
    - 注入具体质量问题（来自 evaluation-report.json）
    - 注入 gate-result.json 中的失败步骤详情
    - 注入 dom-probe.md / api-probe.md 路径
      │
      ▼
  启动 script-writer SubAgent（foreground, mode=fix）
      │
      ▼
  SubAgent 修复后:
    1. 重新执行 gate-check.js
    2. 重新执行 quality-evaluator.js
    3. 仍然 FAIL → 第 2 轮修复
    4. 2 轮不过 → 展示增强处理面板
```

## Type A 反馈流程（分支遗漏/边界缺失/异常缺失）

```
quality-evaluator.js 输出 evaluation-report.json
  │
  └─ verdict: FAIL + Type A items
      │
      ▼
  读取 rejectionItems 中 type="A" 的项，聚合:
    - uncoveredBranches（分支遗漏）
    - uncoveredBoundaries（边界缺失）
    - missingExceptionPaths（异常路径缺失）
      │
      ▼
  构造补充 prompt:
    - 注入具体遗漏列表
    - 注入方法论产物路径（methodology JSON）
    - 注入已有案例文档路径
    - 注入 AC 文档路径（如存在）
    - mode=supplement，仅生成遗漏项
      │
      ▼
  启动 case-designer SubAgent（foreground, mode=supplement）
      │
      ▼
  SubAgent 补充后:
    1. 仅对新增 TC 重新执行 script-writer（增量生成）
    2. 重新执行 gate-check.js
    3. 重新执行 quality-evaluator.js
    4. 仍然 FAIL → 第 2 轮补充
    5. 2 轮不过 → 展示增强处理面板
```

## Type C 反馈流程（语义偏差）

```
quality-evaluator.js 输出 evaluation-report.json
  │
  └─ verdict: FAIL + Type C items
      │
      ▼
  读取 rejectionItems 中 type="C" 的项
  提取 mismatches 列表（案例步骤 vs 脚本断言偏差详情）
      │
      ▼
  并行启动两个修复动作:
    1. 构造 case-fix prompt → 启动 case-designer（mode=fix）:
       - 注入 mismatches 详情
       - 注入偏差涉及的 TC ID
       - 修正案例步骤/预期结果以对齐脚本行为
    2. 构造 script-fix prompt → 启动 script-writer（mode=fix）:
       - 注入 mismatches 详情
       - 注入偏差涉及的 TC ID
       - 修正脚本步骤/断言以对齐案例意图
      │
      ▼
  修复后:
    1. 重新执行 gate-check.js
    2. 重新执行 quality-evaluator.js
    3. 仍然 FAIL → 展示增强处理面板（Type C 最多 1 轮）
```

### 增强处理面板

```
⚠️ 质量评测修复已达到上限仍未通过

当前状态：
  综合分: {overallScore}%
  维度 1 分支覆盖率: {score}%  {status}
  维度 2 边界完整性: {score}%  {status}
  维度 3 异常路径覆盖: {score}%  {status}
  维度 4 断言准确性: {score}%  {status}
  维度 5 脚本可执行性: {score}%  {status}
  维度 6 语义一致性: {score}%  {status}
  驳回项: {N} 个

请选择：
1. 继续修复（再尝试一轮）
2. 人工检查（输出当前失败详情，由人工判断）
3. 接受当前状态（标记 evaluation=partial，记录到 gateOverrides）
```

## 迭代限制

| 类型 | 最大迭代 | 原因 |
|------|---------|------|
| Type A | 2 | 补充分支成本低 |
| Type B | 2 | 修复脚本成本低 |
| Type C | 1 | 全链路修复成本高 |

自动模式（run-test --auto）：超限后直接记录 `gateOverrides` 降级通过，不展示面板。

## evaluation-report.json 关键字段

编排层按以下字段路由：
- `verdict`：`PASS` → 继续；`FAIL` → 按 rejectionItems 路由
- `rejectionItems[].type`：`A`（案例补充）→ case-designer；`B`（脚本修复）→ script-writer；`C`（联合修复）→ case-designer + script-writer
- `rejectionItems[].dimension`：对应 6 维度名称
- `fixInstructions`：`targetAgent` + `instructions` 给 SubAgent 的具体修复指引
- `dimensions.{name}.score`：各维度分数
- `dimensions.{name}.status`：`PASS`/`WARN`/`FAIL`/`SKIP`
