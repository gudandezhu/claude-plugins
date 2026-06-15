# Phase 检测 + selectors 引导

> 此流程在探测完成后、脚本生成前执行。testingRepo 必须已配置（run-test 初始化阶段保证）。
> **不存在跳过场景**——阶段 1.5 禁止跳过。

## Phase 模式判断

```bash
# 检测 selectors 模块是否存在
SELECTORS_DIR="{testingRepo.path}/selectors/"
if [ -d "$SELECTORS_DIR" ] && [ "$(ls -A $SELECTORS_DIR 2>/dev/null)" ]; then
  echo "PHASE=2"
else
  echo "PHASE_BOOT"
fi
```

- **PHASE=2**：selectors 已存在 → 影响分析 + selectors 增量更新，脚本输出到 testingRepo
- **PHASE_BOOT**：首次引导 → 从 dom-probe.md 生成 selectors → 升级为 PHASE=2

### Step 1.5-boot：首次 selectors 引导（PHASE_BOOT 时执行）

PHASE_BOOT 意味着 testingRepo 中尚无 selectors 模块。从 dom-probe.md 引导初始 selectors。

**引导流程**：

1. 检查 dom-probe.md 存在性：
   - `$WORK_DIR/testing/dom-probe.md` 存在 → 使用
   - 不存在 → `$WORK_DIR/testing/.cache/dom-probe.md`（容错 fallback）
   - `.cache/` 中存在 → 自动复制到 `testing/` 根目录：
   ```bash
   cp "$WORK_DIR/testing/.cache/dom-probe.md" "$WORK_DIR/testing/dom-probe.md"
   echo "[WARN] dom-probe.md 从 .cache/ 复制到 testing/ 根目录"
   ```
   - 两处都不存在 → **阻塞**："探测报告缺失，需先完成阶段一 DOM 探测"

2. 从 dom-probe.md 引导 selectors：

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/gen-selectors.js" \
  --dom-probe "$WORK_DIR/testing/dom-probe.md" \
  --output "{testingRepo.path}/selectors/"
```

3. 引导完成后重新检测 Phase：
```bash
SELECTORS_DIR="{testingRepo.path}/selectors/"
if [ -d "$SELECTORS_DIR" ] && [ "$(ls -A $SELECTORS_DIR 2>/dev/null)" ]; then
  echo "PHASE=2"
else
  echo "BOOT_FAILED"
fi
```

4. PHASE=2 → 继续执行 Step 1.5.1（影响分析）等后续步骤
5. BOOT_FAILED → **阻塞**："探测报告缺少页面章节数据，请补充探测"

**禁止 LLM 自主判断降级**——必须由编排层统一决策并设置模板变量。

## Step 1.5.1: 影响分析（testingRepo 已配置 + 功能树存在时执行）

优先使用 tree-context.json 的 functionTree 数据，不存在时回退到 feature-tree/index.json：

```bash
TREE_CTX="{WORK_DIR_LITERAL}/testing/.cache/tree-context.json"
FEAT_INDEX=""
if [ -f "$TREE_CTX" ]; then
  # 提取 functionTree 部分作为临时 index
  FEAT_INDEX=$(node -e "
    const ctx=JSON.parse(require('fs').readFileSync('$TREE_CTX','utf-8'));
    if(ctx.functionTree) process.stdout.write(JSON.stringify(ctx.functionTree));
    else process.exit(1);
  " 2>/dev/null && echo "$TREE_CTX" || echo "")
fi

if [ -z "$FEAT_INDEX" ]; then
  FEAT_INDEX="{testingRepo.path}/feature-tree/index.json"
fi

node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/impact-analysis.js" \
  --index "$FEAT_INDEX" \
  --proposal "{testingRepo.path}/feature-tree-proposal/{需求编号}.md" \
  --features "{用户确认的功能编号列表}"
```

- 输出影响范围（directGroups + indirectFlows）→ 展示给用户确认
- 用户确认后写入 test-config.json 的 testingRepo.affectedGroups / affectedFlows
- changeType = "infra" 时提示人工确认回归范围（全量/手动指定/只更新 selectors）

## Step 1.5.2: 选择器模块生成/更新（探测数据存在时执行）

```bash
TREE_INDEX_PATH="{testingRepo.path}/feature-tree/index.json"
# tree-context.json 存在且含 functionTree 时优先使用
TREE_CTX="{WORK_DIR_LITERAL}/testing/.cache/tree-context.json"
if [ -f "$TREE_CTX" ]; then
  HAS_FUNC_TREE=$(node -e "
    const ctx=JSON.parse(require('fs').readFileSync('$TREE_CTX','utf-8'));
    process.stdout.write(ctx.functionTree ? 'yes' : 'no');
  " 2>/dev/null || echo "no")
  if [ "$HAS_FUNC_TREE" = "yes" ]; then
    TREE_INDEX_PATH="$TREE_CTX"
  fi
fi

node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/gen-selectors.js" \
  --probe-dir "{WORK_DIR_LITERAL}/testing/.cache/probe-data/" \
  --tree-index "$TREE_INDEX_PATH" \
  --output "{testingRepo.path}/selectors/"
```

- 探测数据不存在 → 跳过，脚本生成阶段降级为从 dom-probe.md 复制选择器
- 选择器模块已存在 → 按常量级别 diff 更新（新增/替换/跳过）
> **何时手动创建 step-helpers**：
> - 复杂操作（代码行数 ≥5）
> - 高频复用（被 ≥3 个测试使用）
> - 涉及复杂等待/重试逻辑

## Step 1.5.4: AC 变更检测（test-meta.json 存在时执行）

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/lib/case-hash.js" \
  --cases "{WORK_DIR_LITERAL}/testing/test-cases/e2e-test-cases.md" \
  --group "{GROUP_ID}" \
  --meta "{testingRepo.path}/features/{GROUP_DIR}/test-meta.json"
```

- hash 不同 → AC 变更 → 标记该功能组需要重新生成脚本
- hash 相同 → 仅 UI 微调 → 选择器已在 Step 1.5.2 更新，spec.ts 零修改

完成后将 `{TESTING_REPO_LITERAL}` 记录到会话上下文，供阶段二模板变量替换使用。

## Phase 模式输出路径对照

| Phase | 条件 | E2E 脚本输出路径 | API 脚本输出路径 |
|-------|------|-----------------|-----------------|
| PHASE_BOOT→2 | 首次引导成功（有功能树） | `{testingRepo}/tests/e2e/features/{groupDir}/` | `{testingRepo}/tests/api/features/` |
| PHASE_BOOT→2 | 首次引导成功（无功能树） | `{testingRepo}/tests/e2e/features/` | `{testingRepo}/tests/api/features/` |
| 2 | selectors 已存在（增量更新） | 同上（根据功能树有无决定） | `{testingRepo}/tests/api/features/` |

`{groupDir}` 由 `scripts/lib/group-dir-map.js` 的 `buildGroupDirMap()` 从 `tree-context.json` 提取 groupId，直接作为目录名（如 `PRQL-FLTR`）。无功能树时 fallback 到扁平 `tests/e2e/features/`。
