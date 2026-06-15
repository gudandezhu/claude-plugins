# 接口文档校验

> 由 gen-test Step 0.2 加载，scope 含后端（backend/fullstack）时执行。

## 校验流程（本地优先）

按以下优先级查找接口文档：

1. **本地接口文档目录**（最高优先级）：
   - `$WORK_DIR/design/task/api/`
   - `$WORK_DIR/requirement/api/`
   - 任一目录存在且包含 `.md` 文件 → 直接使用，设置 `source: "local"`，跳过后续步骤

2. **test-config.json 配置路径**：
   - 读取 `paths.apiDocs` 字段
   - 路径存在且非空 → 使用配置路径

3. **自动扫描**：
   - 扫描 `$WORK_DIR/` 下的常见接口文档位置：
     - `$WORK_DIR/requirement/api/`、`$WORK_DIR/design/api/`、`$WORK_DIR/design/task/api/`
     - `$WORK_DIR/` 下的 `*.swagger.json`、`*.openapi.json`、`*-api.md`
   - 找到候选文件时，展示给用户确认

4. **Swagger URL**（如已配置）：
   - test-config.json 的 `swagger.url` 非空 → 使用 Swagger

5. **全部缺失** → 展示选择面板

## 本地文档检测逻辑

```bash
# 检测本地接口文档
API_LOCAL=""
for dir in "design/task/api" "requirement/api"; do
  if [ -d "$WORK_DIR/$dir" ] && [ -n "$(ls $WORK_DIR/$dir/*.md 2>/dev/null)" ]; then
    API_LOCAL="$WORK_DIR/$dir"
    break
  fi
done

if [ -n "$API_LOCAL" ]; then
  echo "✅ 使用本地接口文档: $API_LOCAL (source=local)"
fi
```

## 全部缺失时的选择面板

```
⚠️ 未找到接口文档，这将导致：
- 案例中的接口路径和 HTTP 方法可能不准确（标注"⚠️待验证"）
- 无法识别写操作接口（POST/PUT/DELETE），可能遗漏创建/修改/删除流程

A) 输入接口文档路径（推荐）
B) 跳过，继续生成（案例质量可能受影响）
```

## 用户选择处理

- 用户选择 A → 记录路径到 test-config.json 的 apiDocPaths 字段
- 用户选择 B → 记录到 `skipped-gates.json`，并在后续 case-designer subagent 的 prompt 中追加提示：
  `⚠️ 接口文档缺失，请从 PRD 的接口描述章节推断接口路径和方法，所有接口标注"⚠️待验证-无接口文档"`

## skipped-gates 记录

```bash
node -e "
const fs=require('fs'),path=require('path');
const p=process.env.WORK_DIR+'/testing/.cache/skipped-gates.json';
const arr=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf-8')):[];
arr.push({command:'gen-test',skippedAt:new Date().toISOString(),skippedChecks:['接口文档校验'],reason:'用户选择跳过'});
fs.mkdirSync(path.dirname(p),{recursive:true});
fs.writeFileSync(p,JSON.stringify(arr,null,2));
"
```
