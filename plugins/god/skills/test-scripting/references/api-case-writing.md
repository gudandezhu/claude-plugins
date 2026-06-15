# API 测试案例编写规范

产出：`{apiCasesOutputPath}`（由主会话展开为绝对路径后传入）

生成前必须先读取 `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/api-test-case-template.md` 模板，
按模板的完整表格格式编写每个案例。

基于接口文档和技术方案编写，按接口分组组织。

## 案例格式（强制）

每个案例必须包含以下完整字段，使用模板中的表格格式：

| 项目 | 必填 | 说明 |
|------|------|------|
| 用例ID | ✅ | 正常 API-{模块}-001，异常 API-{模块}-001-E01，边界 API-{模块}-001-B01 |
| 用例描述 | ✅ | 一句话说明验证什么 |
| 优先级 | ✅ | P0（核心）/ P1（重要）/ P2（一般） |
| 测试类型 | ✅ | 功能测试/异常测试/边界测试 |
| 前置条件 | ✅ | 编号列表，每条一行 |
| 测试步骤 | ✅ | 编号列表，每步一行，具体到请求方法、路径、参数 |
| 预期结果 | ✅ | 编号列表，具体到状态码、响应字段值 |

禁止使用简化格式——与 E2E 案例相同，必须使用完整表格。

## 覆盖完整性（强制）

每个接口必须包含以下类型的案例，缺少任何一类都不算覆盖完整：

- 正常请求：每个接口至少 1 个合法参数的正确响应案例
- 参数校验（E 编号）：每个必填参数至少 1 个缺失案例，类型错误、格式错误各至少 1 个
- 边界值（B 编号）：字符串字段最大长度、数值字段边界、空数组、空对象
- 业务规则：唯一性校验、状态流转、关联数据校验（如有）
- 异常场景：未授权、资源不存在、并发冲突、数据库约束违反
- 接口联动：完整的 CRUD 流程至少 1 组（创建→查询→修改→删除）

# API 脚本生成

前置条件：api-probe.md 必须已生成。
接口文档的字段名可能与实际实现不一致（total vs totalRows），不探测就是断言全挂。

脚本生成时必须：
1. 读取 `api-probe.md` 获取真实响应结构、字段名、分页字段映射
   - 接口文档中的字段名（如 ruleType）可能与实际实现（如 statementType）不一致
   - api-probe.md 中的字段名是从 Swagger 或实际调用获取的，以它为准
   - 如果 api-probe.md 中记录了双层嵌套（如 data.data 而非 data.list），断言路径必须匹配
2. 使用 `api-probe.md` 中记录的字段名编写断言，禁止猜测
3. 如果 `api-probe.md` 中某接口标记为"未验证"，脚本注释中标注 `// TODO: 字段名未经验证，首次执行可能需要修正`
4. API 测试（vitest）使用 `get('/path')` 相对路径，禁止拼接 `API_PREFIX`（baseURL 已含前缀）；E2E 测试（Playwright）的 `waitForResponse` 路径使用 `${API_PREFIX}/业务路径`
5. auth 不为 null 时确认 `helpers/auth.ts` 已生成；无需认证时直接发送请求
6. 每个 describe 块必须包含 afterAll 数据清理——创建的测试数据如果不清理，
   重复执行时会因唯一约束冲突导致级联失败
7. 接口联动测试（创建→查询→修改→删除）中，如果创建接口不返回 ID/bizKey，
   必须在创建后通过查询接口获取，不要假设创建接口一定返回标识符

vitest.config.ts 生成时必须排除归档目录，且设置 root 为配置文件所在目录：
```typescript
import path from 'path';
test: {
  root: path.resolve(__dirname),  // 确保从配置文件目录解析 include 路径
  include: ['tests/**/*.api.test.ts'],
  exclude: ['**/test-runs/**', '**/node_modules/**'],
}
```
不设置 root 会导致 vitest 从 cwd（通常是 WORK_DIR）解析 include 路径，找到 0 个测试文件。
不排除 test-runs/ 会导致 vitest 匹配到历史归档中的旧测试文件，产生大量无意义的失败。

代码模板详见 api-script-template.ts（生成脚本前必须加载此模板）。

## 共享 Helper 层（强制）

所有 API 测试脚本必须使用共享 helper，禁止在每个文件中重复定义 post/get/req 函数：
- `import { post, get } from '../helpers/api-client';`
- `import { getAuthToken } from '../helpers/auth';`

gen-skeleton.js 会自动生成 helpers/ 目录，包含 api-client.ts 和 auth.ts。

## API_PREFIX 使用规范（强制）

### 定义与职责

| 变量 | 定义位置 | 职责 | 使用场景 |
|-----|---------|------|---------|
| `API_PREFIX` | test-config.json → run-tests.js 注入 | E2E 测试的 waitForResponse URL 匹配 | Playwright 脚本 |
| `baseURL` | helpers/api-client.ts 内部 | API 测试的请求前缀 | vitest 脚本 |

### API 测试脚本（vitest + axios）

**禁止使用 `API_PREFIX` 环境变量**。API 测试使用 `helpers/api-client.ts` 中的 `get/post/put/del` 函数，这些函数内部的 axios 实例 baseURL 已包含完整 apiPrefix。

```typescript
// ✗ 错误：重复拼接，导致 404
const res = await get(`${API_PREFIX}/rule/list`);
// 实际请求 → /saas/erp/biz/saas/erp/biz/rule/list

// ✓ 正确：使用相对路径
const res = await get('/rule/list');
// 实际请求 → baseURL + /rule/list = /saas/erp/biz/rule/list
```

### E2E 测试脚本（Playwright）

E2E 测试的 `waitForResponse` 需要用 `API_PREFIX` 拼接匹配 URL。

**关键**：从 `api-probe.md` 读取的路径已包含 apiPrefix，必须剥离：

```typescript
// api-probe.md 记录：### GET /saas/erp/biz/finance/rules
// test-config.json 中 backend.apiPrefix = '/saas/erp/biz'

// ✓ 正确：剥离 apiPrefix，只保留业务路径
page.waitForResponse(r => r.url().includes(`${API_PREFIX}/finance/rules`))
// 运行时 → '/saas/erp/biz/finance/rules' ✓

// ✗ 错误：直接用完整路径
page.waitForResponse(r => r.url().includes(`${API_PREFIX}/saas/erp/biz/finance/rules`))
// 运行时 → '/saas/erp/biz/saas/erp/biz/finance/rules' ✗
```

### 自动剥离逻辑

生成脚本时自动检测并剥离：

```typescript
// 伪代码
const apiPrefix = readTestConfig().backend.apiPrefix;
const fullPath = readApiProbePath(); // "/saas/erp/biz/finance/rules"

const businessPath = fullPath.startsWith(apiPrefix)
  ? fullPath.slice(apiPrefix.length) // "/finance/rules"
  : fullPath;

// 在 waitForResponse 中使用
`r.url().includes(\`${API_PREFIX}${businessPath}\`)`
```

## 测试数据获取规范（强制）

### 禁止硬编码关联 ID

禁止在请求体中使用以下占位值作为业务标识符：
- `'STUB'`、`'TEST'`、`'DUMMY'` 等字符串占位
- 硬编码数字 ID（如 `'12345'`、`1`、`100`）
- 任意生成的随机字符串（如 `Math.random().toString()`）

外键字段（如 `consigneeId`、`userId`、`materialId`、`bizKey`）必须从真实的列表接口动态获取有效值。

### 动态数据获取模式

所有需要有效关联 ID 的测试必须在 `beforeAll` 中从列表接口获取：

```typescript
// ---- 动态测试数据（从列表接口获取有效 ID，避免硬编码无效值） ----
let validConsigneeId: string | null = null;
let validBizKey: string | null = null;

beforeAll(async () => {
  // 从列表接口获取一条有效数据
  const listRes = await get('/consignee/list', { pageNum: 1, pageSize: 1 });
  if (listRes.code === 0 && Array.isArray(listRes.data?.list) && listRes.data.list.length > 0) {
    validConsigneeId = listRes.data.list[0].id || null;
  }
});
```

### 获取失败时的跳过策略

关联数据不可用时，使用 `if (!validId) return;` 跳过测试，不要让测试带着无效数据继续执行（必然 400/404，无断言价值）：

```typescript
test('TC-API-002: 使用有效 consigneeId 创建', async () => {
  if (!validConsigneeId) {
    console.log('⚠️ 无法获取有效的 consigneeId，跳过测试');
    return;
  }
  const res = await post('/order/create', { consigneeId: validConsigneeId });
  expect(res.code).toBe(0);
});
```

代码模板详见 `api-script-template.ts`（第 14-24 行的 beforeAll 动态获取模式）。

## 断言质量要求（强制）

禁止使用以下弱断言模式：
- `expect(res).toBeTruthy()` — 只验证非空，不验证结构
- `expect(res.success).toBe(true)` 后不验证 data 结构

正常路径断言必须包含：
1. `expect(res.code).toBe(0);`
2. `expect(res.data).toBeDefined();`
3. 至少验证 1 个业务字段：`expect(res.data.fieldName).toBe(expectedValue);`
   或结构验证：`expect(res.data).toHaveProperty('fieldName');`

分页查询断言必须包含：
1. `expect(Array.isArray(res.data?.list || res.data?.records)).toBe(true);`
2. `expect(res.data.totalRows).toBeGreaterThanOrEqual(0);`

异常路径断言必须包含：
1. `expect(res.code).not.toBe(0);`
2. `expect(res.code).toBe(expectedCode);` 或 `expect([400, 403, 404]).toContain(res.code);`
