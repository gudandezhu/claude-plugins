# 案例生成调度策略

> **已迁移至 Workflow**。本文件仅作文档参考，调度逻辑已内嵌在 `workflows/case-gen-parallel.js`。
>
> `gen-test.md` command 现在通过 `Workflow({ scriptPath: '${CLAUDE_PLUGIN_ROOT}/workflows/case-gen-parallel.js', args: {...} })` 调用，不再加载此文件。

## 迁移说明

原调度流程（Step 0 门禁 + Step 1 并行/串行 subagent + 降级策略）已完整迁移至：
- `workflows/case-gen-parallel.js` — 案例3路并行生成 + 后处理 + 降级重试
- `workflows/user-perspective-analysis.js` — 用户视角分析（原 Agent 0）

## 原设计要点（供参考）

- 上下文保护：reference 文件和 prompt 文件只在构造 subagent 时读取
- 降级策略：同类型重试(1次) → 轻量 writer(1次) → 跳过
- 文件安全：写入前快照备份、写入后大小校验、主会话禁写
- prompt 构造：`prepare-subagent-prompt.js` 脚本化生成，stdout 输出

## 技能按需加载（上下文保护）

**以下文件禁止在主会话中预读取**——只在构造 subagent prompt 时读取：

| 文件 | 传入目标 |
|------|---------|
| `prompts/case-designer.md` | case-designer agent |
| `references/e2e-case-design.md` | E2E agent（传路径） |
| `references/api-case-design.md` | API agent（传路径） |
| `references/api-flow-case-design.md` | Flow agent（传路径） |

## 降级策略

**层级 1**：同类型重试（最多 1 次）
**层级 2**：跳过当前类型，记录失败
**硬性禁止**：禁止在主会话直接生成案例内容
