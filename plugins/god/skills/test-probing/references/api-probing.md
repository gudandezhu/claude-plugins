# API 响应探测（scope 含后端时）

## 禁读源码

禁止在探测过程中直接读取 projects/ 下的源码文件来推断 API 结构。
API 信息必须来自 Swagger/OpenAPI 文档或运行时实际调用。
手动探测降级时，源码分析仅作为辅助参考，最终以运行时验证结果为准。

## API 接口来源优先级

### 优先级一：本地接口文档

检查 `$WORK_DIR/${paths.apiDocs}/` 目录是否存在接口文档（`paths.apiDocs` 从 test-config.json 读取，默认 `tasks/api`）：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/parse-api-docs.js" \
    --api-docs-dir "$WORK_DIR/${paths.apiDocs}" \
    --format "${paths.apiDocsFormat:-auto}" \
    --output "$WORK_DIR/testing/.cache/api-sources.json"
```

输出 `status: "success"` → 使用本地接口文档，跳过 Swagger 探测。

**支持的格式**：
- Markdown（`.md`）：解析 `### POST /api/path` 格式的接口定义
- OpenAPI/Swagger（`.json`、`.yaml`、`.yml`）：解析标准 OpenAPI 文档

### 优先级二：运行时实际调用验证（强制）

无论使用本地文档还是 Swagger，都必须执行运行时验证。swagger-probe.js 的 `--verify` 参数会对分页接口发起真实请求，验证字段映射：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/swagger-probe.js" \
    --url "${swagger.url}" \
    --tags "${swagger.tagFilter}" \
    --output "$WORK_DIR/testing" \
    --verify \
    --base-url "${backend.baseUrl}" \
    --token "$AUTH_TOKEN"
```

验证结果写入 `testing/.cache/api-probe-summary.json` 的 `fieldMapping` 字段，包含：
- `listField`：列表数据路径（如 `data.list`、`data.data.records`）
- `totalField`：总数路径（如 `data.total`、`data.totalRows`）
- `successCode`：成功码（如 `{field: "code", value: 0}`）
- `dataField`：数据包装字段名（如 `data`）
- `apiPrefix`：从多个 API 共同前缀自动提取

脚本生成时从 `api-probe-summary.json` 读取正确字段名，直接写入脚本（静态写入，非运行时动态读取）。

### 优先级三：Swagger（仅补充参考）

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/swagger-probe.js" \
    --url "${swagger.url}" \
    --tags "${swagger.tagFilter}" \
    --output "$WORK_DIR/testing"
```

**标签过滤**（推荐）：
- `--tags "finance-module,material-management"`：按 Swagger tag 过滤，只提取当前需求涉及的模块
- `--paths "/finance/rules,/inventory/material"`：按路径前缀过滤

不传过滤参数会提取整个系统所有接口（可能几百个），导致 gen-skeleton 生成大量无关文件。

## 优先使用 swagger-probe 脚本

swagger-probe.js 能从 Swagger/OpenAPI JSON 自动提取全部接口的路径、参数、响应结构，
输出结构化的 api-skeleton.json 和可读的 api-probe.md。
脚本处理比手动逐个接口探测快一个数量级，且不会遗漏接口。

脚本位于技能目录 `scripts/swagger-probe.js`，用 `node` 直接运行，只需要 Node.js。

### 执行流程

```bash
# 按 tag 过滤（推荐，只提取当前需求涉及的模块）：
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/swagger-probe.js" --url <swagger.url> --tags "<模块tag>" --output "$WORK_DIR/testing"
# 按路径前缀过滤：
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/swagger-probe.js" --url <swagger.url> --paths "/finance/statement-rules" --output "$WORK_DIR/testing"
# 离线模式 + 过滤：
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/swagger-probe.js" --file <swagger.json> --tags "<tag>" --output "$WORK_DIR/testing"
```

过滤参数从接口文档或 PRD 中获取：接口文档中的模块名对应 Swagger tag，接口路径前缀对应 --paths。
不传过滤参数会提取整个系统所有接口（可能几百个），导致 gen-skeleton 生成大量无关文件。

Windows Git Bash 环境下 `--paths "/finance/xxx"` 可能被 MSYS 转换为 Windows 路径，
脚本内部会自动修复。如果仍有问题，用 `--tags` 代替 `--paths` 过滤，或加 `MSYS_NO_PATHCONV=1` 前缀。

检查输出：
- 成功 → `testing/api-probe.md` + `testing/.cache/api-skeleton.json` 已生成
- 失败 → 读取 `testing/.cache/swagger-probe-result.json` 中的 status + reason

swagger-probe 成功后：

1. 过滤接口范围：api-skeleton.json 包含 Swagger 中所有接口，但当前需求只涉及部分模块。
   根据 PRD 功能范围和接口文档，从 api-probe.md 中只保留当前需求涉及的接口，
   删除无关接口的章节。不过滤会导致 gen-skeleton 生成几百个无关的测试文件。

2. 验证响应结构：用一个实际 API 调用验证响应结构是否与探测结果一致：
- 调用一个分页查询接口，对比实际响应的嵌套层级（如 `data.list` vs `data.data.list`）
- 检查实际的成功码（如 code=0 vs code=200 vs success=true）
- 不一致时修正 api-probe.md 中的字段映射

Swagger 文档反映的是代码注解定义的"理想"结构，统一包装类可能增加额外嵌套层级，
不做这一步验证，首次执行时断言路径大概率不对。

### 脚本失败时的降级处理

展示失败原因，让用户选择：
```
⚠️ Swagger 探测失败：{reason}

请选择：
  1. 修正 Swagger 地址后重试
  2. 提供 Swagger JSON 文件路径（离线模式）
  3. 回退到手动探测（逐接口分析源码/实际调用）
```

选 3 时按下方「手动探测」章节执行。

## 手动探测（swagger-probe 不可用时的降级方案）

### 探测来源优先级

1. **Swagger/OpenAPI 文档**（运行时获取或从源码注解提取）
   - 提取所有接口的路径、HTTP 方法、请求参数（query/body/path）、响应结构
   - 这是最准确的来源——它直接反映代码实现，不是人工编写的文档
2. **项目源码**（test-config.json 中 projects.backend 不为 null 时）
   - 根据接口路径搜索 Controller 类
   - 从 Controller 方法返回类型找到 Response VO/DTO 类
   - 提取字段名、类型、嵌套结构
   - 特别关注统一响应包装类和分页响应的字段名
3. **运行时实际调用**（后端服务已运行时）
   - 对每个待测接口发送一次合法请求
   - 使用 `test-config.json` 中的 `backend.baseUrl` + `backend.apiPrefix` 构建请求 URL
   - 如果需要认证，先通过登录接口获取 token
   - 记录实际响应 JSON 结构
4. **手写接口文档**（兜底）
   - 仅基于 `$WORK_DIR/${paths.apiDocs}/*.md` 生成（`paths.apiDocs` 从 test-config.json 读取，默认 `tasks/api`）
   - 不要猜测字段名——标记为"未验证"比猜错更有价值

当不同来源不一致时，在探测报告中标注差异和采用值。

### 置信度标记

每个接口的探测结果必须标记置信度：

| 标记 | 含义 | 来源 |
|------|------|------|
| `verified` | 已通过运行时调用或 Swagger 验证 | swagger-probe / 实际调用 |
| `inferred` | 从源码推断，未经运行时验证 | 源码分析 |
| `missing` | 无法获取，需要人工补充 | 手写文档或无来源 |

gen-skeleton.js 会根据置信度决定是否在生成的脚本中添加 `// TODO: 未验证` 注释。

## 产出：`$WORK_DIR/testing/api-probe.md`

```markdown
# API 响应探测报告

## 探测信息
- 探测方式：swagger-probe.js / 后端源码分析 / 实际调用 / 接口文档（未验证）
- 探测时间：{时间戳}
- 后端地址：{baseUrl}{apiPrefix}

## 统一响应结构
- 包装类：com.xxx.common.Result<T>
- 字段映射：code（0=成功）、msg、data
- 注意：实际响应可能有多层嵌套（如 `data.data.list` 而非 `data.list`），
  swagger-probe 从文档提取的结构可能少一层包装，首次执行时需要根据实际响应调整断言路径

## 分页响应结构
- 分页类：com.xxx.common.PageResult<T>
- 字段映射：totalRows（注意：不是 total）、list（注意：不是 records）、pageNum、pageSize

## 接口探测结果

### GET {apiPrefix}/rule/list [verified]
- 响应结构：{ "code": 0, "data": { "totalRows": 100, "list": [...] } }
- 探测来源：swagger-probe.js
```

## 更新配置

更新 `test-config.json`：
- `apiProbe.status`：设为 `"done"`
- `apiProbe.probedAt`：填入时间戳
- `progress.apiProbe`：设为 `"done"`

scope 为 frontend 时，`apiProbe.status` 和 `progress.apiProbe` 设为 `"skipped"`。
