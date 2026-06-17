---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# RFC-0006: spec-archive（roadmap G4，提 P0）

> **状态**：草稿（v0.4.0 升级 P0，原 P1）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 ADR-NNNN
> **关联 3 视角**：[`01-ops-runbook.md §1 D4`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §2`](../perspectives/02-dev-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.1 G4`](../roadmap.md)
> **关联 plan**：[`docs/plan.md §4 Week 1 D`](../plan.md)

---

## 1. 背景

god 当前 spec 改坏后只能靠 `git diff` 手动 revert——粒度太粗（commit 粒度不是 spec 粒度），无法应对：
- 改了一堆 SC 写错了想回退（10 个 commit 累积）
- 误删了 SC 但其 ID 仍被代码/测试引用
- OPC 改需求时希望对比"上一版本 spec vs 新 spec"差什么

3 份 perspectives 演练 01 §1 D4 痛点："改 spec 改 code 同一 commit 习惯不规范，revert 时需手动对齐"。

**核心判断**（plan.md §4 推论）："改坏 spec 不可回滚"是 god 用户最怕的痛点之一，G4 工作量小（1-2 周）、立竿见影，**应提为 P0**。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | spec 版本快照不可变 | snapshot 后改文件不污染快照 |
| 2 | 历史任意版本可恢复 | restore 命令 + 阶段限制 |
| 3 | 索引单调递增 | `.archive-index` 写一行就不可改 |
| 4 | git 内可追溯 | `spec/.archive/` 在 git 仓库内，git diff 自然看 |
| 5 | 不污染 god 自身 | 快照目录模板在 `templates/spec-archive/` |

## 3. 详细设计

### 3.1 目录结构

```
spec/
├── .archive/                     # 新增（git 内）
│   └── 2026-07-13T14-25-00_v1.2.0.tar.gz   # immutable 快照
└── .archive-index                # 新增（git 内）：1 行 1 快照
```

`.archive-index` 格式（每行）：
```
2026-07-13T14-25-00Z  v1.2.0  tar 2026-07-13T14-25-00_v1.2.0.tar.gz  reason: review 后存档
```

### 3.2 CLI 签名

```bash
# 创建快照
$ node spec/scripts/spec-archive.js snapshot <项目目录> [--reason "<text>"]
# 读 spec/ 整个目录 → 写 .archive/<timestamp>_v<version>.tar.gz
# 追加一行到 .archive-index
# 不改 spec.meta.json（snapshot 不动 phase）

# 列出快照
$ node spec/scripts/spec-archive.js list <项目目录>
# 输出表格：时间 / version / 文件大小 / reason

# 恢复
$ node spec/scripts/spec-archive.js restore <项目目录> --to v1.2.0 [--reason "<text>"]
# 仅在 phase = drafted 时允许
# 恢复 spec.feature + sources.md + meta.json 到快照版本
# 旧版本自动备份到 .archive/（rollback-of-restore 模式）
# 追加 ROLLBACK 行到 spec/.trace
```

### 3.3 关键约束

| 约束 | 决定 |
|---|---|
| 存储位置 | **`spec/.archive/`**（git 内）—— 可追溯；git diff 自然看 |
| 不可变性 | tar.gz 写完 chmod 0444（只读）；追加 .archive-index 即可重索引 |
| 阶段限制 | **restore 仅在 `phase = drafted` 允许**（reviewed 之后改 spec 强制走 prd）|
| 恢复前自动备份 | 强制（防恢复错）—— 当前 spec 状态先 snapshot 再覆盖 |
| 删除 | `node spec/scripts/spec-archive.js prune --older-than <days>` 保留 N 天（默认 30）|

### 3.4 落点

- `spec/scripts/spec-archive.js`（~200 行）
- `spec/scripts/spec-archive.test.js`（~150 行）
- `templates/spec-archive/.archive-index`（空模板）
- `spec/TESTING.md L1-E` 段

## 4. 验收

- [ ] `node spec/scripts/spec-archive.js snapshot demo/lead-scoring` 成功创建 .tar.gz
- [ ] `list` 输出 ≥ 1 个快照 + 索引含 1 行
- [ ] `restore --to v1.0.0` 在 phase=drafted 时成功
- [ ] `restore` 在 phase=reviewed/implemented/verified/accepted 时拒绝
- [ ] snapshot 后改 spec.feature 不污染快照（tar.gz 内容不变）
- [ ] 恢复前自动备份（snapshot + 覆盖两步走）
- [ ] `prune --older-than 7` 删 ≥ 7 天前快照（保留 N 天）
- [ ] 13+ 单元测试全过

## 5. 反模式（明确不做）

- ❌ 存 git 外（独立 `.god/`）—— 不可追溯，与 CLAUDE.md §3 索引图冲突
- ❌ 快照可写 —— 一旦可写就不是"快照"了
- ❌ restore 不限阶段 —— reviewed 之后改 spec 必须走 prd
- ❌ 恢复不备份当前 —— 万一恢复错无法回滚

## 6. 开放问题

- [ ] snapshot 是 commit 时自动（hook 触发）还是手动？
- [ ] restore 是否写 ADR 落档？
- [ ] 跨项目 archive 索引（god 团队内多个 demo 共享）是否需要？

## 7. 时间线

- **Week 1**（2026-07-21 ~ 07-27）：RFC 评审 + spec-archive.js 实现 + 测试
- **Week 1 末**：RFC 转 ADR + 接入 prd/dev/test 阶段提示
- **Week 2**（2026-07-28 ~ 08-03）：demo 演练 + 实测"改坏可回"
