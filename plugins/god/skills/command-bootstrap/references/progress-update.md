# Progress 字段更新

> 由命令文件在完成阶段加载，同步更新 test-config.json 的 progress 字段。

## 更新脚本模板

```bash
node -e "
const fs=require('fs'),p=process.env.WORK_DIR+'/testing/test-config.json';
if(!fs.existsSync(p)){console.log('[SKIP] test-config.json not found');process.exit(0);}
try{
  const cfg=JSON.parse(fs.readFileSync(p,'utf-8'));
  if(!cfg.progress) cfg.progress={};
  // 按调用方指定的字段更新
  const updates=JSON.parse(process.argv[1]||'{}');
  Object.assign(cfg.progress,updates);
  fs.writeFileSync(p,JSON.stringify(cfg,null,2));
  console.log('[OK] progress updated:',JSON.stringify(updates));
}catch(e){
  console.error('[ERROR] progress update failed:',e.message);
  process.exit(1);
}
" '{更新字段JSON}'
```

## 各命令的更新字段

| 命令 | 更新字段 |
|------|---------|
| gen-test | `{"e2eCases":"done","apiCases":"done","apiFlowCases":"done"}`（按实际存在的文件） |
| run-test | `{"domProbe":"done","apiProbe":"done","e2eScripts":"done","gate":"done"}`（按阶段） |
| run-test | 不更新 progress（run-test 不修改 test-config.json） |
| backend-test | `{"phase.selfTest":"done"}`（按 using-zcode 规则） |

## gen-test 专用更新

案例生成完成后，按实际存在的文件更新：

```bash
node -e "
const fs=require('fs'),p=process.env.WORK_DIR+'/testing/test-config.json';
if(!fs.existsSync(p)){console.log('[SKIP] test-config.json not found');process.exit(0);}
const cfg=JSON.parse(fs.readFileSync(p,'utf-8'));
if(!cfg.progress) cfg.progress={};
if(fs.existsSync(process.env.WORK_DIR+'/testing/test-cases/e2e-test-cases.md')) cfg.progress.e2eCases='done';
if(fs.existsSync(process.env.WORK_DIR+'/testing/test-cases/api-test-cases.md')) cfg.progress.apiCases='done';
if(fs.existsSync(process.env.WORK_DIR+'/testing/test-cases/api-flow-test-cases.md')) cfg.progress.apiFlowCases='done';
fs.writeFileSync(p,JSON.stringify(cfg,null,2));
console.log('[OK] case progress updated');
"
```
