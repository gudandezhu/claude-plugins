---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# ADR-0004: hooks 防漂移（G3）v0.4.0 P0 落地

> **状态**：✅ 已接受（v0.4.0 P0 实现已落）
> **替代**：[`RFC-0003`](../rfcs/0003-hooks-integration.md)
> **决议日**：2026-07-13
> **影响范围**：`templates/hooks/*.sh` / `spec/scripts/install-hooks.js` / `spec/scripts/install-hooks.test.js` / `spec/TESTING.md L1-C`

---

## 1. 上下文

god v0.3.0 已有 `scripts/hooks/` 7 个检测器脚本，但**未挂载到 .claude/settings.json 的 hook 触发链**——本质是脚本孤岛。3 份 perspectives 演练一致表明：G1+G2 落地后 G3 是闭环最后一块。

## 2. 决策

**G3 hooks = v0.4.0 P0 必做**。具体约束：

| 约束 | 决定 |
|---|---|
| 触发点 | `pre-commit`（git commit 前）+ `session-end`（Claude Code session 结束时）+ `post-commit --no-verify`（救命场景留痕）|
| 拒绝条件 | spec-cli check 失败 / spec-validate.js 失败 / SC 缺 `@spec` 标注 |
| 救命场景 | `git commit --no-verify` 必可用；但 `post-commit` 强制写 `.trace` 留痕 |
| 安装位置 | **项目侧** `.git/hooks/` + `.claude/settings.json`（不污染 god 自身）|
| 不覆盖 | 用户已有 hook 追加而非覆盖（`# god-hook-marker` 标识去重）|
| 模板位置 | `templates/hooks/*.sh`（v0.2.0 已建目录）|
| 安装工具 | `spec/scripts/install-hooks.js` 一键装 + 13/13 测试 |

## 3. 后果

### 3.1 必修（v0.4.0 已完成）

- ✅ `templates/hooks/pre-commit.sh`（spec-cli check + spec-validate.js 双校验）
- ✅ `templates/hooks/session-end.sh`（打印当前 phase）
- ✅ `templates/hooks/post-commit-no-verify.sh`（救命场景审计）
- ✅ `spec/scripts/install-hooks.js`（~180 行 CLI：复制 + 合并 + 不覆盖 + 权限位）
- ✅ `spec/scripts/install-hooks.test.js`（13 测试全过）

### 3.2 与 G1/G2 协同

- pre-commit 调 `spec-cli.js check` → 读 `spec/meta.json` 的 phase
- pre-commit 调 `spec-validate.js` → 校验 SC ↔ 代码/测试绑定
- session-end 调 `spec-cli.js status` → 输出 phase 状态

### 3.3 拒绝（明确不做）

- ❌ hooks 阻塞救命场景（`--no-verify` 必须可用）
- ❌ hooks 写进 god 自身 `.claude/settings.json`（污染）
- ❌ hooks 强制覆盖用户已有 hook（用 `# god-hook-marker` 追加 + 去重）
- ❌ hooks 静默失败（失败必须 stderr 打印明确信息）
- ❌ hooks 在非 git 项目自动建 `.git/`（除非 `--allow-mkdir-git`）

## 4. 替代方案（已否决）

### 方案 B：hooks 写进 god 自身 `.claude/settings.json`

- 拒因：污染 god 自身；god 用户用自己的 settings.json

### 方案 C：hooks 必阻塞救命场景

- 拒因：3 份 perspectives 演练一致表明：救命场景必须有，**留痕胜过阻塞**

## 5. 关联

- 上一 ADR：[`ADR-0003 G1+G2 状态机`](0003-spec-cli-state-machine.md)
- 配套：[`RFC-0004` OPC 预算分级归因](../rfcs/)（v0.4.0 待开，D5）
- 3 视角：[`01-ops-runbook.md §1 D3`](../perspectives/01-ops-runbook.md) / [`02-dev-perspective.md §3 CI 红`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §2 拒绝 dev 越权`](../perspectives/03-architect-perspective.md)
