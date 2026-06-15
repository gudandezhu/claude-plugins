# ac.md 校验

> 由命令文件在初始化阶段加载，执行 ac.md 存在性检查和内容校验。
> 调用方通过 acBlockMessage 参数传入阻塞文案。

## ac.md 查找

**必须执行以下 bash 脚本**定位 ac.md，将结果记录为 `AC_FILE`（后续脚本均使用此变量）。
禁止用 list_dir / ls 结果推断 ac.md 是否存在——ac.md 位于子目录 `design/` 或 `requirement/` 中，仅浏览顶层目录无法发现它：

```bash
WORK_DIR_FWD=$(echo "$WORK_DIR" | tr '\\' '/')
AC_FILE=""
for dir in design requirement; do
  candidate="$WORK_DIR_FWD/$dir/ac.md"
  if [ -f "$candidate" ]; then
    AC_FILE="$candidate"
    break
  fi
done
echo "$AC_FILE"
```

**均不存在（`AC_FILE` 为空）→ 阻塞**，展示：
```
❌ ac.md 不存在，{acBlockMessage}。
ac.md 是 AC 覆盖率 100% 保障的基础，缺失将导致整个 AC 覆盖检查链条失效。

请先执行 /architect 生成 AC 清单。
```

**禁止提供跳过选项**——ac.md 是 AC 覆盖率 100% 保障的前提。

## 三类 AC 非空检查

找到 ac.md 后，用脚本检查三类 AC（GOAL/AC/UI）是否非空，有空类则警告（不阻塞）：

```bash
node -e "
const txt=require('fs').readFileSync(process.argv[1],'utf-8');
const has=t=>/GOAL|G-\d/i.test(t)?'✅':'❌';
const hasAC=t=>/AC-\w+-\d/i.test(t)?'✅':'❌';
const hasUI=t=>/UI-\w+-\d/i.test(t)?'✅':'❌';
console.log('GOAL:'+has(txt)+' AC:'+hasAC(txt)+' UI:'+hasUI(txt));
" "$AC_FILE"
```

## businessObjective 提取（extraValidations 含此项时执行）

用脚本提取 GOAL 类 businessObjective（禁止在主会话中读取 ac.md 全文）：

```bash
node -e "
const fs=require('fs'),p=process.argv[1];
const txt=fs.readFileSync(p,'utf-8');
const goals=[];
txt.replace(/^#+\s*(G-\d+)[：:]\s*(.+)$/gm,(_,id,desc)=>goals.push(id+': '+desc.trim()));
if(!goals.length) txt.replace(/\|\s*(G-\d+)\s*\|[^|]*\|\s*([^|]+)/g,(_,id,desc)=>goals.push(id+': '+desc.trim()));
console.log(goals.join('; ')||'');
" "$AC_FILE"
```

将输出写入 test-config.json 的 businessObjective 字段。
若 test-config.json 已有 businessObjective 字段，覆盖为 ac.md 提取值并提示用户：
`⚠️ businessObjective 已从 ac.md GOAL 类自动更新（原值将被覆盖）`

## 失败回退机制

- ac.md 查找失败 → 直接阻塞，不提供任何跳过选项
- 三类 AC 检查脚本执行失败（如 node 不可用）→ 警告但不阻塞，记录到日志
- businessObjective 提取脚本失败 → 警告，businessObjective 字段留空，不阻塞后续流程
