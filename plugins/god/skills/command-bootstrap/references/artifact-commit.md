# 产物提交

> 由命令文件在完成阶段加载，按 commitStrategy 执行 git 提交。

## 提交策略

读取 `test-config.json` 的 `testPolicy.commitStrategy` 字段，按策略执行：

### A) 推新分支（commitStrategy=branch，默认）

**target=process-docs 时**：
```bash
cd "$JLC_AI_WORKSPACE/process-docs"
git pull
git add "{需求编号}/"          # 只暂存本需求目录，禁止 git add -A
git commit -m "#0000 feat({需求编号}): {提交信息}"
git push origin HEAD:refs/heads/feat/{需求编号}-{命令标识}
```

**target=testingRepo 时**：
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
  execSync('git add -A',{cwd:repoPath,stdio:'pipe'});
  const status=execSync('git status --porcelain',{cwd:repoPath,encoding:'utf-8'}).trim();
  if(!status){console.log('[OK] No changes to commit');process.exit(0);}
  const reqId=process.argv[1]||'unknown';
  const cmdId=process.argv[2]||'generate';
  const fmt=(cfg.git&&cfg.git.commitFormat)||'test({scope}): {message}';
  const msg=fmt.replace('{scope}',reqId).replace('{message}',cmdId);
  execSync('git commit -m \"'+msg.replace(/\"/g,'\\\\\"')+'\"',{cwd:repoPath,stdio:'pipe'});
  console.log('[OK] Committed to '+tr.branch);
  try{execSync('git push',{cwd:repoPath,stdio:'pipe'});console.log('[OK] Pushed to remote');}
  catch(e){console.log('[WARN] Push failed (may need manual push): '+e.message);}
}catch(e){console.log('[WARN] Commit failed: '+e.message);}
" "{需求编号}" "{命令标识}"
```

### B) 直接推 main（commitStrategy=main）

同 A，但 push 到 `origin main`。

### C) 不提交（commitStrategy=none）

跳过 git 操作，仅展示文件路径。

## 注意事项

- `process-docs` 仓库应在 `.gitignore` 中排除 `**/node_modules/` 和 `**/testing-*/auth/`
- 禁止 `git add -A`（process-docs 模式）——只暂存本需求目录
- testingRepo 模式允许 `git add -A`（测试仓库只含测试产物）
