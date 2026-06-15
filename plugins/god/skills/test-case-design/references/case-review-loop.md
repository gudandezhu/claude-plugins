# 案例评审循环流程

> ⚠️ **已废弃**：本文件描述的流程已迁移至 `workflows/quality-fix-loop.js` Workflow。
> 当前 gen-test.md Wave 2 直接调用 `quality-fix-loop` Workflow（通过 scriptPath），不再加载本文件。
> 仅供历史参考，禁止在新流程中使用。

> 来源：gen-test-case.md Step 2-5 + 轮次 2/3
> 用途：~~主会话加载此文件后，按其流程执行覆盖率预检、两层评审、决策和修正~~ 已废弃

## Step 2: 覆盖率预检（脚本+LLM 双层）

> 注意：gen-test-case.md 已在 Step 2a 调用 check-ac-test-compliance.js 进行 AC 覆盖检查。
> 此处的 verify-case-coverage.js 用于更细粒度的覆盖率分析（分类型、分维度）。

### 2a: AC 覆盖检查结果读取

从 `testing/.cache/ac-test-compliance.json` 读取 AC 覆盖检查结果。

如果 `overallStatus=FAIL` 且 `acCoverageGate.passed=false`，直接跳到 Step 5 修正。

### 2b: 细粒度覆盖率检查

从 `testing/.cache/dispatch-decision.json` 或 `gen-status.json` 读取 activeTypes（不存在时使用空值，脚本内部默认全部）：

```bash
# 优先从 dispatch-decision.json 获取 activeTypes
# 回退到 gen-status.json 获取已完成的案例类型
ACTIVE_TYPES=$(node -e "
  try {
    const d = require('$WORK_DIR/testing/.cache/dispatch-decision.json');
    if (d.activeTypes && d.activeTypes.length > 0) {
      console.log(d.activeTypes.join(','));
      process.exit(0);
    }
  } catch(e) {}
  try {
    const s = require('$WORK_DIR/testing/.cache/gen-status.json');
    const types = Object.entries(s.types || {})
      .filter(([k, v]) => v.status === 'success')
      .map(([k]) => k);
    console.log(types.join(','));
  } catch(e) {
    console.log('');
  }
")
```

执行细粒度覆盖率预检：

```bash
node $CLAUDE_PLUGIN_ROOT/skills/test-case-design/scripts/verify-case-coverage.js \
  --testing-dir $WORK_DIR/testing \
  --scope <scope> \
  --active-types "$ACTIVE_TYPES" \
  --threshold <testPolicy.coverageThreshold，默认 80> \
  --ac-threshold 100 \
  --ac-assignment $WORK_DIR/testing/.cache/ac-assignment.json
```

注意：`--ac-file` 参数可省略，脚本会自动从 `$WORK_DIR/design/ac.md` 和 `$WORK_DIR/requirement/ac.md` 查找。`--ac-threshold` 显式传入 100（与文档声明的"AC 覆盖率阈值硬编码为 100%"一致），按缩放规则：AC 类 min(100+5, 100)=100%、UI 类 max(100-10, 60)=90%。`--ac-assignment` 为可选参数，文件不存在时脚本走兼容旧流程。

读取 `testing/.cache/coverage-check-result.json`。

### 2c: 脚本化语义检查（已集成到 verify-case-coverage.js，无需 AI 主观判断）

脚本自动检查以下内容（结果在 coverage-check-result.json 的 `semanticCheck` 字段）：
- PRD 异常场景表中的关键词是否在案例中出现
- businessObjective 中的业务目标关键词是否在案例中体现
- 案例间是否存在步骤签名重复

**禁止 AI 在此步骤做任何主观判断**——所有检查结果以脚本输出为准。

### 决策（以脚本输出的 `action` 字段为准，禁止 AI 自行判断）

- action=`ac-coverage-gap`（AC 覆盖率 < 100%）→ 跳到 Step 5（修正，补充 AC 覆盖）
- action=`subagent-coverage-gap`（某个 subagent 类型的覆盖率 < 95%，即使 overall 达标）→ 跳到 Step 5（修正），只修正覆盖率不达标的 subagent 类型（例：e2e 覆盖率 100% 但 flow 覆盖率 90% → 只启动 flow case-designer subagent 修正）
- action=`ac-op-gap`（AC-OP 操作仅声明未在步骤中执行，或 AC-OP 未覆盖）→ 跳到 Step 5（修正，补充实际操作步骤）
- action=`state-transition-gap`（状态转换路径未完整覆盖）→ 跳到 Step 5（修正，补充状态转换案例）
- action=`embedded-rule-gap`（AC-STS-/AC-CALC-/AC-FMT-/AC-PERM-/AC-RULE- 嵌入覆盖 < 100%）→ 跳到 Step 5（修正，在步骤中补充规则验证点）
- action=`coverage-gap`（功能点覆盖率 < `testPolicy.coverageThreshold`，默认 80%）→ 跳到 Step 5（修正）
- action=`semantic-gap`（语义检查不通过）→ 跳到 Step 5（修正，补充缺失场景）
- action=`continue`（均达标）→ 进入 Step 3（两层评审）

## Step 3: 脚本化结构检查（第一层评审）

### 并行评审调度（按 activeTypes 分组）

从 `$ACTIVE_TYPES` 确定需要评审的案例类型。按类型并行启动评审 subagent：

| activeTypes 值 | 启动的评审 subagent |
|---------------|-------------------|
| `e2e` | E2E 案例评审（读取 e2e-test-cases.md） |
| `api` | API 案例评审（读取 api-test-cases.md） |
| `flow` | Flow 案例评审（读取 api-flow-test-cases.md） |
| 全量 | 并行启动所有存在案例文件的类型 |

**调度策略**：
- 1 种类型 → foreground subagent（直接执行）
- 2+ 种类型 → 并行启动 background subagent（间隔 5s，避免 API 限流）
- 预估时长上限：180 秒/类型
- 超时策略：单个评审 subagent 超过 180s 未返回时降级为跳过该类型评审（记录 `[降级模式]`）

每个评审 subagent 只读取对应类型的案例文件 + 精简的 input-digest（从 `testing/.cache/input-digest.json` 提取对应类型的摘要）。

各 subagent 执行：

```bash
node $CLAUDE_PLUGIN_ROOT/skills/test-case-design/scripts/review-case-quality.js \
  --testing-dir $WORK_DIR/testing \
  --scope <scope> \
  --active-types "<当前subagent负责的类型>" \
  --pass-score <testPolicy.reviewPassScore，默认 80> \
  --fix-score 60 \
  --output $WORK_DIR/testing/.cache/review-result-<type>.json
```

### 合并评审结果

所有评审 subagent 完成后（或超时降级后），合并结果：

```bash
node $CLAUDE_PLUGIN_ROOT/skills/test-case-design/scripts/merge-review-results.js \
  --testing-dir $WORK_DIR/testing \
  --types "$ACTIVE_TYPES" \
  --output $WORK_DIR/testing/.cache/merged-review-result.json
```

读取 `testing/.cache/merged-review-result.json`（合并后格式兼容原 review-case-quality.js 输出）。

脚本化评审维度（满分 100，直接加和计入综合分）：

| 维度 | 分值 | 检查方式 |
|------|------|---------|
| 结构完整性 | 25 | 步骤无编号每个扣 3 分（上限 12），前置条件为空每个扣 2 分（上限 8） |
| 内容精确度 | 30 | 模糊操作描述（"等操作"、"同上"等）每处扣 2 分（上限 15），缺少具体数据值每个扣 2 分（上限 15） |
| 场景覆盖度 | 30 | 无异常场景（E 编号）扣 15 分，不足扣 8 分；无边界值（B 编号）扣 10 分，不足扣 5 分 |
| 断言有效性 | 15 | 无预期结果每个扣 4 分（上限 10），模糊预期结果（"正常"、"成功"等）每个扣 3 分（上限 5） |

**禁止 AI 在此步骤做任何主观判断**——所有检查结果以脚本输出为准。

## Step 3.5 ~ Step 4: AI 评审 + 综合分计算 + 决策

加载 ~~`references/review-scoring-rules.md`~~（文件不存在，已废弃），执行 AI 业务语义评审 + 综合分计算 + 决策。

## Step 5: 修正（多维度缺口合并）

### 5a: 缺口分组决策（双来源）

**双来源读取**：
1. `coverage-check-result.json` 的 `actions` 和 `allGaps`（覆盖率维度）
2. `merged-review-result.json` + `biz-review-result.json` 的 `suggestions`（评审维度，仅当从 Step 4b 进入时读取）
3. Step 4b 的 decision action（`high-impact-fix` / `auto-fix`，仅当从 Step 4b 进入时存在）

**触发来源判断**：
- 从 Step 2 决策进入（覆盖率缺口）→ 以 coverage-check-result.json 为主
- 从 Step 4b 决策进入（评审问题）→ 以 review suggestions 为主，同时检查 coverage-check-result.json 是否有残留缺口
- 同时从两边触发（罕见：覆盖率修复后评审又发现新缺口）→ 合并两个来源

**分组逻辑**（按优先级匹配，命中即停止）：

0. **评审触发**（Step 4b decision = `high-impact-fix` 或 `auto-fix`）：
   - 覆盖率 actions 非空 → 合并覆盖缺口 + 评审 suggestions（同一次 fix subagent 处理）
   - 覆盖率 actions 为空 → 只传评审 suggestions
   - suggestions 来源：merged-review-result.json + biz-review-result.json，按 severity 过滤（`high-impact-fix` 只取 high，`auto-fix` 取 high+medium）
   - 按案例类型分组，启动对应 fix subagent
   - 修正后重新执行 Step 2b + Step 3~4（完整验证）
1. 覆盖率 actions 为空 **且** 无 Step 4b decision → 跳过修正，进入 Step 3
2. actions 包含 `ac-coverage-gap`：
   - AC 覆盖是其他维度的前置依赖（嵌入规则、AC-OP 等都依赖 AC 先覆盖完）
   - 只修复 AC 覆盖缺口，传入 coverageGaps = allGaps.acCoverage.uncovered
   - 修复后重新执行 Step 2b，可能揭示其他维度缺口
3. actions 包含 `subagent-coverage-gap`（无 `ac-coverage-gap`）：
   - 从 allGaps.subagentCoverage 提取不达标的类型
   - 只启动不达标类型的 case-designer subagent（mode=fix）
   - 其他维度缺口（embedded-rule 等）合并到同一次修复
   - 不启动已达标类型的 subagent（避免过度修正）
4. actions 不包含上述特殊值但有其他缺口：
   - 合并所有缺口，一次性传给 subagent
   - coverageGaps = 合并 allGaps 中所有非 null 的缺口详情
   - 按案例类型（e2e/api/flow）分组

### 5b: 启动 fix subagent

传入 mode=fix，根据 5a 触发来源选择参数组合：

| 触发来源 | 必传参数 | 可选参数 |
|---------|---------|---------|
| 覆盖率触发（Step 2） | `--coverage-gaps-json` | `--coverage-gaps` |
| 评审触发（Step 4b） | `--suggestions` | `--coverage-gaps-json`（覆盖率有残留缺口时） |
| 合并触发 | 两个都传 | — |

```bash
node $CLAUDE_PLUGIN_ROOT/skills/test-case-design/scripts/prepare-subagent-prompt.js \
  --type <type> --mode fix \
  --work-dir $WORK_DIR --plugin-dir $CLAUDE_PLUGIN_ROOT \
  --business-objective "<objective>" \
  --coverage-gaps-json $WORK_DIR/testing/.cache/coverage-check-result.json \
  --suggestions "<suggestions>" --coverage-gaps "<coverageGaps>"
```

**`--suggestions` 参数来源**（按 5a 触发类型选择）：
- 覆盖率触发：从 `coverage-check-result.json` 的 `allGaps` 提取人类可读摘要
- 评审触发：从 `merged-review-result.json` + `biz-review-result.json` 的 `suggestions` 提取
  - `high-impact-fix`：只提取 `severity=high` 的 suggestions
  - `auto-fix`：提取 `severity=high` + `severity=medium` 的 suggestions
- 合并触发：两个来源的 suggestions 合并去重

**保留的 action 特殊处理**：
- `subagent-coverage-gap`：只启动不达标类型的 subagent

### 5.0 修正前备份

对将要修正的每种案例类型，执行备份：

```bash
node $CLAUDE_PLUGIN_ROOT/scripts/lib/backup-cases.js \
  --testing-dir $WORK_DIR/testing --action backup --type <type>
```

不指定 --type 时备份所有案例文件。

### 5.1 并行调度

将需要修正的类型按以下规则调度：
- **1 种类型** → foreground subagent
- **2+ 种类型** → 并行启动 background subagent（间隔 5s）

并行 subagent 修改不同文件（e2e-test-cases.md / api-test-cases.md / api-flow-test-cases.md），无冲突。

启动对应类型的 case-designer subagent（mode=fix），传入修正建议。
subagent 无产出时，同 Step 1 降级策略——派发轻量 writer subagent。禁止在主会话直接生成，禁止退化到主会话。

### 5.2 产出验证（带标注完整性检查）

每个 fix subagent 返回后，执行增强版产出验证：

```bash
node $CLAUDE_PLUGIN_ROOT/skills/test-case-design/scripts/verify-output-exists.js \
  --type <type> --testing-dir $WORK_DIR/testing --mode fix
```

`--mode fix` 自动从 `.cache/backup/<type-filename>.pre-fix.bak` 读取修正前备份（与 5.0 备份路径一致），无需手动指定。

校验内容：
1. 原有检查：文件存在 + 大小 > 1KB + 案例标记存在
2. **新增检查**：覆盖标注完整性 — 修正前后的 AC ID 对比，标注减少则 exit 1

产出验证通过后，更新 case-design-summary.json 统计字段：

```bash
node $CLAUDE_PLUGIN_ROOT/skills/test-case-design/scripts/update-case-summary.js \
  --testing-dir $WORK_DIR/testing --type <type>
```

### 5.3 标注丢失恢复（降级）

如果产出验证 exit 1 且错误为"覆盖标注丢失"：

1. 恢复备份：
   ```bash
   node $CLAUDE_PLUGIN_ROOT/scripts/lib/backup-cases.js \
     --testing-dir $WORK_DIR/testing --action restore --type <type>
   ```
2. 启动轻量 writer subagent（降级），prompt 中额外强调：
   "上次修正导致以下覆盖标注丢失: <lost IDs>。本次修正必须保留这些标注。"
3. 重新执行 5.2 产出验证。
4. 如仍失败，记录到 gen-status.json 并继续下一类型（不再阻塞）。

## 轮次 2（自动修正后，最后一轮修正机会）

重复 Step 2'~4'：覆盖率预检 → 两层评审 → 综合决策。
- 覆盖率预检仍不通过（`actions` 数组非空）→ 再次进入 Step 5 修正（最后一轮修正机会）
- overall ≥ `testPolicy.reviewPassScore` 且无 severity=high 建议 → passed
- overall ≥ `testPolicy.reviewPassScore` 但仍有 severity=high 建议 → 进入 Step 5 修正（最后一轮修正机会，按 5a case 0 评审触发处理，只修 high severity suggestions）
- `fixScore` ≤ overall < `testPolicy.reviewPassScore` → 进入 Step 5 修正（最后一轮修正机会）
- overall < `fixScore` → user-decide

**总修正轮次上限**：2 轮（覆盖率修正 + 评审修正共享计数）。超过 2 轮 → action=final-result，输出未通过维度详情。
如果 AC 覆盖率仍 < 100%，在最终结果中标注 `⚠️ AC 覆盖率未达 100%（{rate}%），建议人工补充后重新执行`。
