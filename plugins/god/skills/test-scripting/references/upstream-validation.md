# 上游产物校验

> 由 run-test 在 Step 0 加载，执行案例文档存在性检查和 progress 同步。
> 职责：仅检查脚本生成的上游产物，不重复 gen-test 已检查的 PRD/AC/UI 原型。

## 阻塞检查

### 1. 案例文档存在性检查

1. 检查案例文档：
   - `$WORK_DIR/testing/test-cases/e2e-test-cases.md`（scope 含前端时必须存在）
   - `$WORK_DIR/testing/test-cases/api-flow-test-cases.md`（scope 含后端时，可选）

2. 案例文档存在且 `test-config.json` 已存在时，同步更新 progress 字段：
   ```bash
   node -e "
   const fs=require('fs'),p=process.env.WORK_DIR+'/testing/test-config.json';
   if(fs.existsSync(p)){
     const cfg=JSON.parse(fs.readFileSync(p,'utf-8'));
     if(!cfg.progress) cfg.progress={};
     if(fs.existsSync(process.env.WORK_DIR+'/testing/test-cases/e2e-test-cases.md')) cfg.progress.e2eCases='done';
     if(fs.existsSync(process.env.WORK_DIR+'/testing/test-cases/api-flow-test-cases.md')) cfg.progress.apiCases='done';
     fs.writeFileSync(p,JSON.stringify(cfg,null,2));
   }
   "
   ```

3. 案例文档不存在 → 展示选择面板：
   ```
   ⚠️ 未找到测试案例文档。
   1. 自动执行 /zcode:gen-test {需求编号} 生成案例（推荐）
   2. 手动执行 gen-test 后再回来
   3. 跳过校验继续（记录 skipped-gates）
   ```

4. 用户选择 3 → 追加记录到 skipped-gates.json（必须先读取再追加，禁止直接覆盖写入）：
   ```bash
   node -e "
   const fs=require('fs'),path=require('path');
   const p=process.env.WORK_DIR+'/testing/.cache/skipped-gates.json';
   const arr=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf-8')):[];
   arr.push({command:'run-test',skippedAt:new Date().toISOString(),skippedChecks:['案例文档存在性','ac.md 存在性'],reason:'用户选择跳过'});
   fs.mkdirSync(path.dirname(p),{recursive:true});
   fs.writeFileSync(p,JSON.stringify(arr,null,2));
   "
   ```
   最低要求：探测报告存在（`dom-probe.md` 或 `api-probe.md`）

### 2. testingRepo 配置检查（阻塞）

testingRepo 是集中测试仓库的核心，必须配置：

```bash
node -e "
const fs=require('fs'),p=process.env.WORK_DIR+'/testing/test-config.json';
if(!fs.existsSync(p)){console.log('NO_CONFIG');process.exit(0);}
const cfg=JSON.parse(fs.readFileSync(p,'utf-8'));
const tr=cfg.testingRepo;
if(!tr||!tr.path){console.log('NO_TESTING_REPO');process.exit(0);}
const resolved=tr.path.replace(/\\\\\$JLC_AI_WORKSPACE/g,process.env.JLC_AI_WORKSPACE||'');
if(!fs.existsSync(resolved)){console.log('INVALID_PATH:'+resolved);process.exit(0);}
console.log('OK');
"
```

- `NO_CONFIG` → 阻塞："test-config.json 不存在，请先执行 /zcode:gen-test"
- `NO_TESTING_REPO` → 执行自动探测：
  ```bash
  node "$CLAUDE_PLUGIN_ROOT/scripts/workspace/workspace-check.js" --config "$WORK_DIR/testing/test-config.json"
  ```
  - 探测成功 → 已自动写入 test-config.json → 继续
  - 探测失败 → **阻塞**：
    ```
    ❌ testingRepo 未配置且自动探测失败。

    请选择：
    1. 执行 /zcode:init-workspace 初始化测试仓库（推荐）
    2. 手动配置 test-config.json 的 testingRepo 字段
    ```
- `INVALID_PATH` → 阻塞："测试仓库路径不存在 {path}，请先执行 /zcode:init-workspace"
- `OK` → 继续

### 3. 功能树/菜单树检查与重扫（非阻塞）

```bash
TREE_CTX="$WORK_DIR/testing/.cache/tree-context.json"
NEED_RESCAN=false

if [ ! -f "$TREE_CTX" ]; then
  NEED_RESCAN=true
else
  STATUS=$(node -e "const c=JSON.parse(require('fs').readFileSync('$TREE_CTX','utf-8'));console.log(c.status)" 2>/dev/null || echo "ERROR")
  [ "$STATUS" = "NO_MATCH" ] && NEED_RESCAN=true
fi

if [ "$NEED_RESCAN" = "true" ]; then
  echo "⚠️ 功能树/菜单树未检测到，从需求目录重新扫描..."
  node "$CLAUDE_PLUGIN_ROOT/scripts/workspace/parse-tree.js" \
    --req-dir "$WORK_DIR" \
    --output "$TREE_CTX"
fi
```

> 扫描范围：`$WORK_DIR`（需求根目录），递归查找所有 .md 文件。
> 功能树/菜单树是独立文件（如 function-tree.md、menu-tree.md），通过文件名 + 文件头部关键词识别。
> 功能树缺失时**不阻塞**（影响分析可选），但在进度面板中标注。
>
> **非阻塞 ≠ 可延迟执行**：当 `NEED_RESCAN=true` 时，必须**立即**运行 `extract-tree-context.js`。
> "非阻塞"仅指扫描结果为 `NO_MATCH` 时不阻塞后续流程，而非跳过扫描步骤本身。
> 禁止将扫描推迟到探测阶段或其他后续阶段。

## 非阻塞提示

以下检查项缺失时仅展示提示，不阻塞执行：

| 检查项 | 检测路径 | 缺失提示 |
|--------|---------|---------|
| 探测数据 | `dom-probe.md`、`api-probe.md` | "探测报告缺失，脚本中的选择器和 API 路径可能不准确" |
| 登录态 | `auth/storage-state.json` | "登录态缺失，E2E 脚本执行时需要先执行登录" |

## 功能树加载 + 测试仓库准备

加载 `skills/test-scripting/references/testing-repo-setup.md`，按其流程执行。
完成后将 `{testingRepo.path}`、功能树索引和 `{treeContextPath}` 记录到会话上下文，供阶段二使用。

tree-context.json 存在时，影响分析和选择器生成优先使用 tree-context.json 的 functionTree 数据。
tree-context.json 不存在时，回退到 testingRepo 的 feature-tree/index.json。

## progress 字段定义

```json
{
  "progress": {
    "domProbe": "pending | done | skipped",
    "apiProbe": "pending | done | skipped",
    "e2eCases": "pending | done",
    "apiCases": "pending | done",
    "e2eScripts": "pending | done",
    "apiScripts": "pending | done",
    "apiFlowCases": "pending | done | skipped",
    "apiFlowScripts": "pending | done | skipped",
    "gate": "pending | done"
  }
}
```

## 续生成逻辑

启动时检查 apiFlowCases/apiFlowScripts 状态：
- done/skipped → 跳过流程测试生成
- pending → 从 Step 3 流程测试生成步骤开始
