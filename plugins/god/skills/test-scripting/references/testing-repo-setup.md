# 测试仓库准备 + 功能树加载

> 此流程在 run-test Step 0.6 调用。完成后将 `{testingRepo.path}` 和功能树索引记录到会话上下文。

## Step 1: testingRepo 强制检查

**testingRepo 是集中测试仓库方案的核心，必须配置。**

检查 test-config.json 中 testingRepo 是否已配置：

```bash
node -e "
const fs=require('fs'),p=process.env.WORK_DIR+'/testing/test-config.json';
if(!fs.existsSync(p)){console.log('NO_CONFIG');process.exit(0);}
const cfg=JSON.parse(fs.readFileSync(p,'utf-8'));
const tr=cfg.testingRepo;
if(!tr||!tr.path){console.log('NO_TESTING_REPO');process.exit(0);}
const resolved=tr.path.replace(/\\\\\$JLC_AI_WORKSPACE/g,process.env.JLC_AI_WORKSPACE||'');
if(tr.projectDir){console.error('[WARN] 检测到旧格式 testingRepo 配置（projectDir=\"'+tr.projectDir+'\"），请迁移到 biz-test-regression');}
console.log(JSON.stringify({path:resolved,branch:tr.branch||''}));
"
```

- 输出 `NO_CONFIG` → 阻塞，提示用户先执行 gen-test 生成配置
- 输出 `NO_TESTING_REPO` → 进入 Step 2 自动探测
- 输出 JSON → 跳过 Step 2，直接进入 Step 3

## Step 2: 自动探测（testingRepo 未配置时）

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/workspace/workspace-check.js" --config "$WORK_DIR/testing/test-config.json"
```

- 输出含 `"error"` 字段 → **报错并阻塞**：
  ```
  ❌ testingRepo 未配置且自动探测失败。

  集中测试仓库是脚本版本化管理的核心，必须配置后才能继续。

  请选择：
  1. 执行 init-workspace 初始化测试仓库（推荐）
  2. 手动配置 testingRepo

  手动配置格式（写入 test-config.json）：
  {
    "testingRepo": {
      "path": "$JLC_AI_WORKSPACE/biz-test-regression",
      "repoUrl": "git@git.jlcops.com:{org}/biz-test-regression.git"
    }
  }
  ```
  **不提供降级兼容**——集中测试仓库是方案核心。
- 输出含 testingRepo 数据（无 `"error"` 字段）→ 探测成功，继续 Step 3

## Step 3: 切换到需求分支

无论 testingRepo 是预配置还是自动探测填充的，此步骤必须执行：

```bash
bash "$CLAUDE_PLUGIN_ROOT/skills/test-scripting/scripts/sync-test-branch.sh" "{testingRepo.path}" "{需求编号}"
```

分支切换成功后，更新 test-config.json 的 branch 字段：
```bash
node -e "
const fs=require('fs');
const cfgPath=process.env.WORK_DIR+'/testing/test-config.json';
if(!fs.existsSync(cfgPath)) process.exit(0);
const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf-8'));
if(cfg.testingRepo) cfg.testingRepo.branch='feature/{需求编号}';
fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2));
console.log('branch updated to feature/{需求编号}');
"
```

## Step 4: 功能树 + 菜单树加载

### 4a: tree-context.json 存在性检查

```bash
TREE_CTX="{WORK_DIR_LITERAL}/testing/.cache/tree-context.json"
if [ -f "$TREE_CTX" ]; then
  echo "[INFO] tree-context.json 已存在（gen-test 阶段生成）"
else
  # 尝试从需求目录解析（扫描需求根目录，不仅限于 requirement/ 子目录）
  node "$CLAUDE_PLUGIN_ROOT/scripts/workspace/parse-tree.js" \
    --req-dir "{WORK_DIR_LITERAL}" \
    --output "$TREE_CTX"
fi
```

### 4b: fallback 机制

如果 tree-context.json 不存在或状态为 NO_MATCH，回退到 testingRepo 现有功能树机制：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-scripting/scripts/load-feature-tree.js" \
  --repo "{testingRepo.path}" \
  --req "{需求编号}" \
  --plugin-dir "$CLAUDE_PLUGIN_ROOT"
```

- 输出 `NO_FEATURE_TREE` / `NO_TEMPLATE` → 警告但不阻塞（功能树是可选索引）
- 输出含 `hasProposal: true` → 提案存在，合并为临时索引供后续影响分析使用

### 4c: 菜单树数据记录到会话上下文

tree-context.json 存在且状态为 OK 时，将路径记录为 `{treeContextPath}` 模板变量，供阶段二消费。
同时将 `{testingRepo.path}` 和功能树索引记录到会话上下文。
