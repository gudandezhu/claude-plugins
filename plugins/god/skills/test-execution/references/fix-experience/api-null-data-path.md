# API 返回 data:null，脚本访问 data.bizKey 报错

## 症状

- errorType: `api_path_error`
- message 关键词: `Cannot read properties of null`、`Cannot read properties of undefined`、`data.bizKey`
- 表现：API 创建/更新接口返回 `{ code: 200, data: null }`，脚本假设 `data` 有值并访问 `data.bizKey`

## 根因

部分后端接口（特别是创建、更新、删除操作）成功时返回 `data: null` 而非包含业务字段的对象。
api-probe.md 中记录的响应结构可能来自查询接口（有 data），
但脚本将其应用到了写入接口（data 为 null）。

## 影响范围

系统性 — 所有涉及创建/更新/删除操作的 API 测试脚本都可能受影响。

## 修复方式（脚本层面）

对写入操作的响应做空值保护：

```typescript
// ✗ 错误：直接访问 data 字段
const bizKey = response.data.bizKey;

// ✓ 正确：先检查 data 是否存在
expect(response.code).toBe(200);
if (response.data) {
  expect(response.data.bizKey).toBeDefined();
} else {
  // 创建/更新/删除接口 data 为 null 是正常的，只验证 code
}

// ✓ 或者：用可选链
const bizKey = response.data?.bizKey;
```

## 修复方式（插件层面）

修正 `skills/test-scripting/references/api-case-writing.md`：
- 区分查询接口和写入接口的响应断言策略
- 写入接口（POST/PUT/DELETE）只断言 `code`，不断言 `data` 内部字段
- 查询接口（GET）可以断言 `data` 内部字段

修正 `skills/test-execution/scripts/lib/error-classifier.js`：
- 将 `Cannot read properties of null` + API 测试文件 → 归类为 `api_path_error`

## 预防措施

run-test 生成 API 脚本时：
- 创建/更新/删除接口的断言只验证 `code` 和 `message`
- 需要验证创建结果时，在创建后调用查询接口获取数据
- 所有 `data` 字段访问使用可选链（`data?.field`）
