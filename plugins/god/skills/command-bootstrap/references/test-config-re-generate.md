# 重新生成流程

用户选择"重新生成"时，按以下流程执行归档和配置确认。

## 归档

### 测试仓库模式（testingRepo 已配置时）

测试仓库有 git 版本控制，不需要 archive-testing.js 归档。

**重新生成前 git status 检查**：
```bash
node -e "
const fs=require('fs'),{execSync}=require('child_process');
const cfgPath=process.env.WORK_DIR+'/testing/test-config.json';
if(!fs.existsSync(cfgPath)) process.exit(0);
const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf-8'));
const tr=cfg.testingRepo;
if(!tr||!tr.path) process.exit(0);
const repoPath=tr.path.replace(/\\\$JLC_AI_WORKSPACE/g,process.env.JLC_AI_WORKSPACE||'');
try{
  const status=execSync('git status --porcelain',{cwd:repoPath,encoding:'utf-8'}).trim();
  if(status){
    console.log('HAS_UNCOMMITTED');
    console.log(status.split('\\n').slice(0,10).join('\\n'));
  }else{
    console.log('CLEAN');
  }
}catch(e){console.log('GIT_ERROR: '+e.message);}
"
```

- 输出 `CLEAN` → 继续重新生成
- 输出 `HAS_UNCOMMITTED` → 展示选择面板：
  ```
  ⚠️ 测试仓库有未提交的本地修改（可能是手动调整的脚本）。
  1. 自动 stash 后继续（生成完成后提示 git stash pop 合并）
  2. 先手动 commit 后再重新生成
  3. 放弃本地修改，直接覆盖
  ```
  - 用户选择 1 → `git stash push -m "auto-stash-before-regen"`
  - 用户选择 2 → 退出重新生成流程
  - 用户选择 3 → 继续覆盖

**清除 process-docs 中的门禁缓存**：
```bash
node -e "
const fs=require('fs'),path=require('path');
const cacheDir=process.env.WORK_DIR+'/testing/.cache';
const gateFiles=['gate-result.json','gate-flow-result.json','audit-result.json','script-generation-summary.json'];
for(const f of gateFiles){
  const fp=path.join(cacheDir,f);
  if(fs.existsSync(fp)){fs.unlinkSync(fp);console.log('[OK] Removed '+f);}
}
"
```

**重置 progress 脚本字段**：
```bash
node -e "
const fs=require('fs');
const cfgPath=process.env.WORK_DIR+'/testing/test-config.json';
if(!fs.existsSync(cfgPath)) process.exit(0);
const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf-8'));
if(cfg.progress){
  for(const k of ['e2eScripts','apiScripts','apiFlowScripts','gate']){
    if(cfg.progress[k]) cfg.progress[k]='pending';
  }
  fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2));
  console.log('[OK] Progress reset');
}
"
```

直接覆盖测试仓库中受影响的文件（selectors/ + step-helpers/ + features/ + flows/），
不删除不受影响的脚本（影响分析只定位受影响的功能组）。

### 传统模式（testingRepo 未配置时）

run-test 重新生成时，只归档+清除脚本产物，不动案例文档（上游产物）：

```bash
node $CLAUDE_PLUGIN_ROOT/scripts/test-exec/archive-testing.js --work-dir $WORK_DIR --mode script
```

`--mode script` 策略：
- 归档 scripts/e2e/tests/ 和 scripts/api/tests/ 到 `$WORK_DIR/archive/scripts-{timestamp}/`
- 清除门禁缓存（gate-result.json、audit-result.json、script-generation-summary.json）
- 重置 test-config.json 的脚本相关 progress（e2eScripts、apiScripts、apiFlowScripts、gate → pending）
- 保留 test-cases/（gen-test 产物，不动）
- 保留 playwright.config.ts、vitest.config.ts、fixtures.ts（gen-skeleton.js 产物，跨轮复用）
- 保留 node_modules/、auth/、test-config.json、探测报告、探测缓存

gen-test 重新生成时使用 `--mode case`（只归档+清除案例和评审缓存）。
不指定 --mode 时默认 `--mode all`（向后兼容，归档+清除全部产物）。

## 登录态验证

重新生成时如果 auth 不为 null 且 `auth/storage-state.json` 存在，
按 test-probing 的「登录态验证」章节检查 storageState 是否仍然有效。
失效 → 重新获取登录态后再继续。保留过期的 auth/ 等于没保留。

## 配置确认

归档后不进入配置对话（test-config.json 已保留），直接展示配置确认面板：

```
⚙️ 重新生成 — 使用上轮配置

┌─ 当前配置 ──────────────────────────────────────────┐
│  测试范围    前后端                                    │
│  前端地址    http://localhost:9090                     │
│  后端地址    http://localhost:8080                     │
│  API 前缀    （由探测自动填充）                         │
└───────────────────────────────────────────────────────┘

请选择：
1. 确认配置，开始生成
2. 修改配置（输入编号修改，如 "前端地址 http://localhost:3000"）
```

必须等待用户确认，禁止自动开始生成——用户可能需要修改地址。
