# RFC-0001: spec-cli 状态机（roadmap G1+G2 捆绑）

> **状态**：草稿（v0.4.0 P0）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 `0003-spec-cli-state-machine.md`
> **关联 3 视角**：[`01-ops-runbook.md §1 D1`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §2-3`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §2`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.2 G1+G2`](../roadmap.md)

---

## 1. 背景

god 当前 spec 生命周期 6 状态（`(idea) → drafted → reviewed → implemented → verified → accepted`）只在 `spec/README.md` 文字描述，无任何机器可读状态。后果：

- OPC 想知道"现在 spec 到哪了"——必须看 git log + 脑补
- `/god:dev` 写代码时不知道 spec 是否已 `reviewed`，可能写了不可实现的代码
- `/god:test` 跑测试不知道 spec 是否已 `implemented`，可能测试白跑
- failure-mode F-02（语义模糊）可悄悄发生，无机械拦截

3 份 perspectives 演练结论一致：G1（状态机 CLI）+ G2（meta.json 持久化）**必须捆绑**——只有 G2 的 schema 才能让 G1 的 phase 有"家"。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 6 状态可机械查询 | `spec-cli status` 输出 phase + 5 个 gate 状态 |
| 2 | 状态转移不可跳过 | `drafted → verified` 拒绝（必经 `reviewed`）|
| 3 | 状态有持久化载体 | `spec/meta.json` 含 phase/version/owner/relatedPR/last-transition |
| 4 | 每次转移有 trace | `spec/.trace` 追加一行 `2026-07-02 14:25:00 drafted → reviewed` |
| 5 | hooks 可读 phase | G3 hooks 落地后能 query phase 拒绝非法 commit |

## 3. 详细设计

### 3.1 状态机

```
(idea) → drafted → reviewed → implemented → verified → accepted
            ↑           │           │            │
            └───────────┴───────────┴────────────┘  （变更回 prd 重走）
```

6 状态定义见 [`docs/spec-directory.md §3`](../spec-directory.md#3-spec-生命周期状态机)。

### 3.2 spec/meta.json schema

```json
{
  "specId": "lead-scoring",
  "version": "2.0.1",
  "phase": "reviewed",
  "owner": "fan",
  "createdAt": "2026-07-01T10:00:00Z",
  "updatedAt": "2026-07-02T14:25:00Z",
  "relatedPR": [42, 44],
  "scopes": ["lead-scoring"],
  "c5": {
    "passed": true,
    "score": 91,
    "at": "2026-07-02T13:50:00Z"
  },
  "c6": ["SC-001"],
  "gates": {
    "drafted": "2026-07-01T11:30:00Z",
    "reviewed": "2026-07-02T14:25:00Z"
  }
}
```

### 3.3 CLI 子命令

```bash
# 查状态
$ node spec/scripts/spec-cli.js status .
spec-id: lead-scoring
phase: reviewed
@spec-version: 2.0.1
relatedPR: [#42, #44]
last-transition: 2026-07-02 14:25:00 (drafted → reviewed)
gates: ✓ drafted ✓ reviewed ○ implemented ○ verified ○ accepted

# 推进
$ node spec/scripts/spec-cli.js advance .
✓ phase reviewed → implemented
✓ spec/.trace appended

# 拒绝非法转移
$ node spec/scripts/spec-cli.js advance .
✗ rejected: implemented → verified 跳过 reviewed phase
```

### 3.4 落点

- `spec/scripts/spec-cli.js`（G1 实现）
- `spec/meta.json`（G2 产物，由 G1 读写）
- `spec/.trace`（G1 每次 advance 追加）
- `spec-validate.js` 阶段 3a 校验 `meta.json` 存在 + phase 合法

## 4. 验收

- [ ] `node spec/scripts/spec-cli.js status` 在 v0.4.0 demo 项目上输出 5 个 gate 状态
- [ ] `node spec/scripts/spec-cli.js advance .` 拒绝 `drafted → verified` 跳级
- [ ] `spec/meta.json` 在 v0.4.0 demo 项目上含 6 个状态之一 phase
- [ ] `spec/.trace` 含至少 1 行转移记录
- [ ] `spec-validate.js` 14 项校验全过 + 状态机独立校验 = 双重门禁

## 5. 反模式（明确不做）

- ❌ 用文件系统目录结构表示状态（`spec/drafted/` `spec/reviewed/`）—— 难回滚
- ❌ 状态写在 `spec.feature` 文件头注释里—— 不可机器查询
- ❌ 状态写在 git commit message—— 跨分支时无意义
- ❌ 状态机含 "rejected" "skipped" 等额外状态—— 6 状态足够，异常走 P1 决策点

## 6. 开放问题

- [ ] meta.json 的 `relatedPR` 怎么自动同步？目前手动写
- [ ] `spec/.trace` 需不需要 rotate？演练期 5 天 5 行不 rotate 没问题，1 年后呢

## 7. 时间线

- **Week 1**（2026-07-07 ~ 07-13）：RFC 评审 + ADR 决议 + spec-cli.js 骨架
- **Week 2**（2026-07-14 ~ 07-20）：meta.json schema 冻结 + advance 转移 + 拒绝逻辑
- **Week 3**（2026-07-21 ~ 07-27）：v0.4.0 demo 项目演练 + RFC 转 ADR + 文档更新
