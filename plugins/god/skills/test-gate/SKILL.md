---
status: stable
name: test-gate
user-invocable: false
description: |
  测试产物审核门禁技能。覆盖 gate-check 自动化检查、E2E 脚本质量审核、
  TC 覆盖率验证。
  在 /run-test Phase 4（产物门禁）时加载。
  当需要执行门禁检查、审核脚本质量、验证 TC 覆盖率时，使用此技能。
---

# E2E 脚本质量规则

5 条质量原则的唯一权威源：`references/quality-rules.md`。
quality-auditor 角色和 test-scripting 经验库均从此文件加载，不在各自文件中重复定义。


# 产物审核门禁（run-test Phase 4）

门禁的角色是"找问题"而非"确认没问题"。
看起来没问题不等于验证过——每个步骤必须实际检查，不要因为"前面阶段应该生成了"就跳过。

## 步骤 1.5：质量评测（gate-check 通过后）

gate-check 通过后执行 6 维度质量评测。

### CLI 调用

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-gate/scripts/quality-evaluator.js" \
  --testing-dir "$WORK_DIR/testing/" \
  --gate-result "$WORK_DIR/testing/.cache/gate-result.json"
```

### 6 维度评测模型

| # | 维度 | 检查内容 | 评分阈值 | 驳回类型 |
|---|------|---------|---------|---------|
| 1 | 分支覆盖率 | 方法论产物每个分支是否有对应 TC | ≥95 PASS, ≥80 WARN | Type A → Agent 1 |
| 2 | 边界完整性 | 边界条件（min/max/极值）是否有 TC | ≥95 PASS, ≥80 WARN | Type A → Agent 1 |
| 3 | 异常路径覆盖 | 异常/错误/中断场景是否有 TC | ≥95 PASS, ≥80 WARN | Type A → Agent 1 |
| 4 | 断言准确性 | 预期结果是否具体可验证 + 脚本 expect() 数 | ≥95 PASS, ≥80 WARN | Type B → Agent 2 |
| 5 | 脚本可执行性 | gate-result 4a-4g 质量步骤通过率 | ≥95 PASS, ≥80 WARN | Type B → Agent 2 |
| 6 | 语义一致性 | 案例步骤关键词 vs 脚本内容匹配率 | ≥95 PASS, ≥80 WARN | Type C → Agent 1+2 |

无方法论产物时维度 1-3 走 fallback（边界/异常 TC 占比评估），不崩溃。

### 路由规则

读取 `$WORK_DIR/testing/.cache/evaluation-report.json`：
- **verdict: PASS** → 继续 AC 合规检查
- **verdict: FAIL + Type B**（脚本质量）→ 按 feedback-loop.md Type B 修复脚本（最多 2 轮）
- **verdict: FAIL + Type A**（案例遗漏）→ 按 feedback-loop.md Type A 补充案例（最多 2 轮）
- **verdict: FAIL + Type C**（语义偏差）→ 按 feedback-loop.md Type C 联合修复（最多 1 轮）
- **quality-evaluator.js 执行异常** → 不阻塞，记录 `skipped-gates`，继续

### 输出格式

`evaluation-report.json` 包含：`verdict`, `overallScore`, `mode: "full"`, `summary`, `dimensions`（6 维度各含 score/status/details）, `rejectionItems`（含 type/dimension/message/targetAgent）, `fixInstructions`（targetAgent + instructions）。

## 步骤 1/2/3/5/6/7/8/9/10/11/12/13/14/17：运行 gate-check

testingRepo 参数传递——当 test-config.json 配置了 testingRepo 时，必须将 `--testing-repo` 传递给 gate-check.js，否则门禁会在本地 testing/ 目录查找脚本（脚本实际在集中测试仓库中）。

```bash
# 解析 testingRepo 配置
TESTING_REPO_ARGS=""
if [ -f "$WORK_DIR/testing/test-config.json" ]; then
  TESTING_REPO_ARGS=$(node -e "
    const c=JSON.parse(require('fs').readFileSync('$WORK_DIR/testing/test-config.json','utf-8'));
    if(c.testingRepo&&c.testingRepo.path){
      const p=c.testingRepo.path.replace(/\\$JLC_AI_WORKSPACE/g,process.env.JLC_AI_WORKSPACE||'');
      process.stdout.write('--testing-repo \"'+p+'\"');
    }
  ")
fi

node "$CLAUDE_PLUGIN_ROOT/skills/test-gate/scripts/gate-check.js" --testing-dir "$WORK_DIR/testing/" --scope <scope> $TESTING_REPO_ARGS
```

`$CLAUDE_PLUGIN_ROOT` 为插件实际安装路径（如 plugins/zcode），由 test-execution 的「`$CLAUDE_PLUGIN_ROOT` 解析」章节设置。

### 首轮门禁同时运行评估模式（可选）

ac-assignment.json 存在时，首轮门禁同时运行评估模式，输出端到端质量评估报告：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-gate/scripts/gate-check.js" \
  --testing-dir "$WORK_DIR/testing/" --scope <scope> \
  $TESTING_REPO_ARGS \
  --evaluation-mode \
  --ac-file "$AC_FILE" \
  --ac-assignment "$WORK_DIR/testing/.cache/ac-assignment.json" \
  --eval-output "$WORK_DIR/testing/.cache/evaluation-result.json"
```

评估结果展示：
- PASS → 在门禁结果后附加"✅ 端到端评估通过"
- WARN → 展示建议列表，用户决定是否修正
- FAIL → 标记为需要修正（不阻塞门禁，但在最终报告中标注）

评估模式失败（脚本异常）时不阻塞门禁流程。

脚本自动执行检查，输出 `testing/.cache/gate-result.json`：
- 步骤 1（文件完整性）：检查必需文件是否存在且非空
- 步骤 2（TC 编号比对）：仅检查 E2E（FE-）覆盖率；单接口 API TC（API-DT-/API-SM- 等）由 `gen-test（backend-test skill）` 负责，不在此处检查
- 步骤 3（场景类型覆盖）：关键词匹配正常/异常/边界等场景类型
- 步骤 5（API 配置校验）：检查硬编码 URL、缺少环境变量引用
- 步骤 6（选择器语法校验）：检测 XPath/CSS 混用、XPath 父轴、XPath 属性选择器（❌ 阻塞）
- 步骤 7（路径规范校验）：检测 __dirname 使用、硬编码绝对路径、waitForTimeout（⚠️ 警告）
- 步骤 8（import 来源校验）：检测 spec 文件是否从 '../fixtures' 导入 test（❌ 阻塞）
- 步骤 9（evaluate fetch 检测）：检测 page.evaluate 中调用 fetch 请求后端（跨域必然失败，❌ 阻塞）
- 步骤 10（:visible 伪类检测）：检测 querySelector/waitForSelector 中使用 :visible（原生 DOM 不支持，❌ 阻塞）
- 步骤 11（browser.newPage 检测）：检测 beforeAll/afterAll 中用 browser.newPage() 不带 storageState（❌ 阻塞）
- 步骤 12（nth-of-type 检测）：检测 .el-select:nth-of-type(N) 按 div 类型计数定位（❌ 阻塞）
- 步骤 13（.or() strict 检测）：检测 .or() 复合 locator 配合 toBeVisible()（❌ 阻塞）
- 步骤 14（getByText select 检测）：检测 getByText 使用 placeholder 文字定位 el-select（❌ 阻塞）
- 步骤 15（源码引用扫描）：检测脚本中的 projects/ 和 .vue/.jsx/.tsx 引用（❌ 阻塞）

读取 gate-result.json，对未通过的步骤回到对应阶段补充后重新执行。

> **注意**：`gate-result.json` 中 `steps` 是对象（key-value），不是数组。
> 读取时必须用 `Object.values(result.steps)` 或 `Object.entries(result.steps)`，
> 禁止直接调用 `result.steps.forEach()`（会抛 `TypeError: steps.forEach is not a function`）。
>
> 示例：
> ```bash
> node -e "
> const fs=require('fs');
> const result=JSON.parse(fs.readFileSync('$WORK_DIR/testing/.cache/gate-result.json','utf-8'));
> Object.entries(result.steps).forEach(([name,step])=>{
>   if(step.passed===false) console.log('❌',name,JSON.stringify(step.issues||step.details||[]));
> });
> "
> ```

gate-check 未通过时展示面板（自动修复/查看详情/跳过）。

### 门禁修复 prompt 模板辅助

门禁失败时，按 `prompts/gate-fix.md` 模板组装修复上下文。变量：`{failedScripts}`、`{gateResult}`、`{fixRules}`、`{workDir}`。

修复时按失败类型分组：

| 失败类型 | 包含步骤 | 修复参考 |
|---------|---------|---------|
| 质量类 | 4a-4g（断言、截图、路径等） | 脚本内容 + 质量规则 |
| 选择器类 | 6、9-14（语法、定位方式） | 脚本内容 + dom-probe.md 选择器 |
| 覆盖类 | 2、3、16（TC 编号、场景、AC） | 案例文档 + 脚本内容 |

### 3 轮不过增强处理面板

修复超过 3 轮仍未通过时，展示增强处理面板：

```
⚠️ 门禁修复已进行 3 轮仍未全部通过

当前状态：
  通过: {N}/{M} 步骤
  仍未通过: {失败步骤列表}

请选择：
1. 继续修复（再尝试一轮）
2. 人工检查（输出当前失败详情，由人工判断）
3. 接受当前状态（标记 gate=partial，后续执行可能存在质量问题）
```

## 步骤 2b：API 流程脚本门禁（scope 含后端且用户选 A 时）

在 gate-check.js 通过后，若 `apiFlowScripts` 不为 `skipped`，额外运行：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-gate/scripts/gate-check-flow.js" --testing-dir "$WORK_DIR/testing/" $TESTING_REPO_ARGS
```

输出 `testing/.cache/gate-flow-result.json`，检查：
- 步骤 1（文件完整性）：`*-flow.api.test.ts` 是否存在
- 步骤 2（FLOW TC 覆盖率）：`api-flow-test-cases.md` 中所有 `FLOW-` TC 是否在脚本中实现（❌ 阻塞）
- 步骤 3（数据传递）：是否有 `let` 变量声明（⚠️ 警告）
- 步骤 4（清理逻辑）：是否有 `afterAll`（⚠️ 警告）
- 步骤 5（步骤连续性）：S01→S02→S03 不跳号（❌ 阻塞）

**gate-check-flow 未通过时必须补全缺失流程，不允许跳过。**

步骤 4 的所有质量规则（规则 1-13）已全部迁移到 gate-check.js 的步骤 4a-4g，
通过正则 + test() 块解析实现，无需 LLM 评估。

gate-check.js 步骤 4a-4g 覆盖：
- 4a：`.catch(()=>{})` 吞错误（test() 块内）
- 4b：`if(isVisible)` 包裹整个 test 逻辑
- 4c：test() 缺少 `expect()` 断言
- 4d：`page.evaluate` 中调用 `.click()` 绕过 actionability
- 4e：test() 缺少 `page.screenshot()`
- 4f：`waitForResponse` 中 `r.status() === 200`
- 4g：`waitForResponse` 中硬编码 API 路径（不含 `API_PREFIX`）

规则 8-13（evaluate-fetch/visible/newPage/nth-of-type/.or()/getByText）已在步骤 9-14 中实现。
规则 16-19（捷径检测）在步骤 32-35 中实现：
- 步骤 32（正常流程 mock 检测）：test() 名不含异常关键词但有 `page.route()`（❌ 阻塞）
- 步骤 33（E2E 硬编码表单数据）：`page.fill()` 使用中文或手机号字面量（⚠️ 警告）
- 步骤 34（深度链接检测）：`page.goto()` 路径深度 >2 跳过导航（❌ 阻塞）
- 步骤 35（认证注入检测）：test() 块内 `addCookies` / `localStorage.setItem.*token`（❌ 阻塞）

```
❌ 门禁检查未通过（第 {N}/3 轮）

失败项：
  - 步骤 4c 缺少断言：2 个问题
  - 步骤 4e 缺少截图：1 个问题

请选择：
1. 自动修复（回到阶段三修正后重新检查）
2. 查看详细问题列表
3. 跳过门禁（不推荐，脚本质量无保障）
```

全部 5 步通过后更新 progress：`gate: "done"`。
任何步骤未通过则回到对应阶段补充——不要为了通过门禁而降低标准。

# TC 覆盖率验证

案例和脚本都生成完毕后（无论哪种方式），执行覆盖率检查：

```bash
RESOLVED=$(node "$CLAUDE_PLUGIN_ROOT/scripts/test-exec/resolve-test-paths.js" --config "$WORK_DIR/testing/test-config.json")
TESTING_REPO=$(echo "$RESOLVED" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).repoPath || ''")

node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/verify-skeleton.js" --testing-dir "$WORK_DIR/testing" --testing-repo "$TESTING_REPO" --scope <scope>
```

有缺失时必须补完对应脚本才能进入阶段三。
