---
status: stable
name: prd-edit
user-invocable: false
description: |
  轻量 prd 流水线。已存在 spec.feature，改需求时用。跳过阶段 0 调研、brainstorm 走 diff 模式。
  命令层 /god:prd --mode edit 加载。
---

# PRD Edit（轻量走法）

> 已存在 `spec.feature` 时改需求用。**比 prd 省 15 min OPC 注意力**（跳过阶段 0 调研 + brainstorm M1/M2 全量）。

## 触发

`/god:prd --mode edit` → 加载本 skill。

## 跳过什么

| 跳过 | 为什么 |
|---|---|
| 阶段 0 调研 | 旧 spec 已是调研产物，复用 |
| brainstorm M1（目标价值）| 旧 spec 已有 C1 锚点 |
| brainstorm M2（核心用户旅程）| 旧 spec 已有 MoSCoW + 流程 |
| user-perspective-analyzer | 旧 spec 已有 _summary.md + 角色文档 |

## 保留什么

| 阶段 | 加载/跑 |
|---|---|
| 阶段 1 brainstorm（diff 模式）| `brainstorm` skill，但只跑 M3（看新增/修改/删除）+ C3 疑问 |
| 阶段 2 build-spec | `build-spec` skill（**只改** spec.feature，不重写）|
| 阶段 2.5 readiness | spec-readiness.js |
| 阶段 3a/3b/3c | 同 prd（机械 + 评审 + S1）|
| 阶段 4-6 | 同 prd |

## 流程

### 阶段 1：brainstorm（diff 模式）

1. 读旧 `spec/sources.md` + `spec.feature` + `state/meta.json`
2. 跑 brainstorm skill 的 M3 阶段**仅 diff**：
   - 用户说"改 XX" → 标 `XX` 对应 REQ 修改（升 MAJOR）/ 新增（升 MINOR）/ 修文字（升 PATCH）
   - 不重跑 M1/M2
3. C3 疑问（动态）— 仅问"diff 范围之外的影响"

### 阶段 2：build-spec

- 按 diff 改 spec.feature
- 升 `@spec-version`（按 diff 分类自动）
- 新增 SC 用下一个未占用号（spec-cli add 自动）
- 改 SC 行为升 MAJOR（ID 不变）

### 阶段 2.5-3c：同 prd

### 阶段 4-6：同 prd

## 软失败处理

- readiness 软失败（sad-path 覆盖不足）常见于轻量模式——已有 spec 写完后 1 项软失败可走
- 但**仍需**写软失败免责锚点

## 适用 vs 不适用

| 适用 | 不适用 |
|---|---|
| 改 1 个 SC 文字 | 改整个功能方向 |
| 加 1 个 SC 边界 | 加 1 个新功能 |
| 删 1 个 SC（ID 废弃）| 合并 2 个 feature |
| 修 GWT 措辞 | 重写核心流程 |

**不适用场景** → 走 prd skill（不用 --mode edit）。

## 禁止

- ❌ 轻量模式跑 M1/M2（违反 diff 模式契约）
- ❌ 不升 @spec-version（违反防漂移铁律 #3）
- ❌ 复用旧 SC ID 删后重建（ID 一经分配不复用）
- ❌ 改 SC 行为不升 MAJOR（违反版本规则）
