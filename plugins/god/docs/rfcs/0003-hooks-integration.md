---
type: spec
status: stable
owner: god 架构组
last_reviewed: 2026-06-16
update_rule: rfc-required
related: [../../CLAUDE.md]
---

# RFC-0003: hooks 集成（G3 防漂移落地）

> **状态**：草稿（v0.4.0 P0）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 ADR-NNNN
> **关联 3 视角**：[`01-ops-runbook.md §1 D3`](../perspectives/01-ops-runbook.md) / [`03-architect-perspective.md §2 拒绝`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.2 G3`](../roadmap.md)

---

## 1. 背景

god v0.3.0 已有 `scripts/hooks/` 7 个检测器脚本（prd-sync-detector.js / encoding-guard.js / session-review.js / session-archive.js / browser-monitor.js / session-start.js / run-hook.js），但**未挂载到 .claude/settings.json 的 hook 触发链**——本质是脚本孤岛。

3 份 perspectives 一致表明：G1+G2 落地后，G3 hooks 是闭环最后一块。无 G3 = AI 可绕过 build-spec 改 spec = CLAUDE.md §4.2 防漂移机制是空架子。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | pre-commit hook 跑 spec-cli check | 绕过 build-spec 改 spec.feature → 拒绝 commit |
| 2 | pre-commit hook 跑 spec-validate.js | SC 缺代码或测试 → 拒绝 commit |
| 3 | `--no-verify` 写 trace 留痕 | 即便救命场景也保留审计 |
| 4 | session-end hook 跑 spec-cli status | session 结束时 god 提示当前 phase |
| 5 | hooks 配置在项目侧（不污染 god 自身） | `templates/hooks/` 提供模板，项目方 fork 到 `.claude/settings.json` |

## 3. 详细设计

### 3.1 pre-commit hook 模板

`templates/hooks/pre-commit.sh`：

```bash
#!/bin/bash
# god pre-commit hook — G3 防漂移
# 由 god 用户的项目 .claude/settings.json 挂载
# 拒绝非法 commit（spec 漂移 / phase 与实际产物不一致）

set -e
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_DIR="$PROJECT_DIR/spec"

if [ ! -f "$SPEC_DIR/meta.json" ]; then
  echo "[god] 无 meta.json，跳过检查（idea 阶段合法）"
  exit 0
fi

# 1. 跑 spec-cli check
node "$CLAUDE_PLUGIN_ROOT/spec/scripts/spec-cli.js" check "$PROJECT_DIR" || {
  echo "[god] ✗ spec-cli check 失败"
  echo "[god] 提示：用 git commit --no-verify 救命（会写 trace 留痕）"
  exit 1
}

# 2. 跑 spec-validate.js
node "$CLAUDE_PLUGIN_ROOT/spec/scripts/spec-validate.js" "$PROJECT_DIR" || {
  echo "[god] ✗ spec-validate.js 失败"
  exit 1
}

echo "[god] ✓ pre-commit 检查通过"
```

### 3.2 session-end hook 模板

`templates/hooks/session-end.sh`：

```bash
#!/bin/bash
# god session-end hook — 提示当前 phase
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_DIR="$PROJECT_DIR/spec"

if [ -f "$SPEC_DIR/meta.json" ]; then
  echo "[god] 当前 spec phase："
  node "$CLAUDE_PLUGIN_ROOT/spec/scripts/spec-cli.js" status "$PROJECT_DIR"
fi
```

### 3.3 --no-verify trace 留痕

`templates/hooks/no-verify-trace.sh`：

```bash
#!/bin/bash
# git commit --no-verify 时调用，写一行到 spec/.trace
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SPEC_DIR="$PROJECT_DIR/spec"

if [ -d "$SPEC_DIR" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) NO-VERIFY commit by ${USER:-unknown}" >> "$SPEC_DIR/.trace"
  echo "[god] 已写 .trace 留痕"
fi
```

挂载到 `.git/hooks/post-commit`（注意：不是 hook 阶段，是 commit 已落之后；仅做留痕）。

### 3.4 安装工具

`spec/scripts/install-hooks.js`：

```bash
node spec/scripts/install-hooks.js <项目目录>
# 复制 templates/hooks/* 到 <项目目录>/.claude/settings.json hooks 段
# 复制 pre-commit / post-commit 到 .git/hooks/
# 复制 .git/hooks/ 需 .git 存在
```

## 4. 验收

- [ ] `node spec/scripts/install-hooks.js <demo>` 成功复制 hooks
- [ ] 跳过 build-spec 改 spec.feature → git commit → 拒绝
- [ ] SC 缺 `@spec SC-xxx` 标注 → git commit → 拒绝
- [ ] `git commit --no-verify` → `.trace` 追加 1 行 NO-VERIFY 记录
- [ ] session-end 输出 spec-cli status 信息

## 5. 反模式（明确不做）

- ❌ hooks 阻塞救命场景（`--no-verify` 必须可用）
- ❌ hooks 写进 god 自身的 `.claude/settings.json`（污染 god 自身）
- ❌ hooks 强制覆盖用户已有 hook（用合并逻辑，不覆盖）
- ❌ hooks 静默失败（失败必须 stderr 打印明确信息）

## 6. 开放问题

- [ ] install-hooks.js 是 CLI 还是 npm 包？
- [ ] hooks 是否支持自定义脚本（用户加自己的检查）？

## 7. 时间线

- **Week 1**（2026-07-21 ~ 07-27）：本 RFC 评审 + 模板冻结 + install-hooks.js 骨架
- **Week 2**（2026-07-28 ~ 08-03）：CLI 完成 + 接入测试 + demo 项目演练
- **Week 3**（2026-08-04 ~ 08-10）：RFC 转 ADR + 文档更新
