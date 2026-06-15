# API 流程测试脚本编写规范

产出：`{apiScriptsOutputDir}*-flow.api.test.ts`（由主会话展开为绝对路径后传入）

## 共享 Helper 层（强制）

所有 API 测试脚本必须使用共享 helper，禁止在每个文件中重复定义 post/get/req 函数或 createClient 工厂：
- `import { post, get, put, del } from '../helpers/api-client';`

gen-skeleton.js 会自动生成 helpers/ 目录，包含 api-client.ts 和 auth.ts。

## 脚本结构

```typescript
import { post, get, put, del } from '../helpers/api-client';

const TEST_PREFIX = `FLOW测试_${Date.now()}`;

describe('FLOW-{模块}-001: {流程描述}', () => {
  let bizKey: string; // 步骤间数据传递

  afterAll(async () => {
    // 双重清理：先尝试删除，再通过列表接口按前缀批量清理
    // 注意：删除方法需根据实际接口适配（可能是 POST 而非 DELETE）
    if (bizKey) {
      try {
        await del(`/path/${bizKey}`);
      } catch {}
    }
  });

  test('FLOW-{模块}-001-S01: 创建', async () => { ... });
  test('FLOW-{模块}-001-S02: 查询验证', async () => { ... });
  test('FLOW-{模块}-001-S03: 编辑', async () => { ... });
  test('FLOW-{模块}-001-S04: 删除', async () => { ... });
});
```

## 步骤间数据传递

- 使用 describe 级别的 let 变量声明
- 每个步骤的返回值赋给变量，下一步骤使用
- 前置步骤失败时显式报错，禁止静默 return（CI 会误判为 PASS）

```typescript
test('S02: 查询验证', async () => {
  // 前置步骤失败时显式报错，禁止静默 return（CI 会误判为 PASS）
  expect(bizKey, '前置步骤 S01 未获取到 bizKey').toBeTruthy();
  // ...
});
```

## 双重清理策略

1. afterAll 中按 bizKey 精确删除
2. 如果精确删除失败，通过列表接口按 TEST_PREFIX 前缀批量查询并删除

## 覆盖要求

- 每个流程至少包含完整的正常路径（S01→S02→...）
- 每个流程至少 1 个异常中断案例（E 编号）
- 步骤连续性：S01→S02→S03，不跳号

## 禁止事项

- 禁止 Mock 任何接口
- 禁止使用 `API测试_` 前缀——与单接口测试冲突
- 禁止在 beforeAll 中创建测试数据——流程测试的第一步就是创建
- 禁止使用 `if (!key) return` 静默跳过——CI 会将 return 的测试报告为 PASS，
  必须使用 `expect(key, '描述').toBeTruthy()` 显式失败
- 禁止在每个文件中重复定义 post/get/req 函数或 createClient 工厂——必须使用共享 helper

## 数据变更验证模式

涉及数据变更的写操作步骤（创建/编辑/删除/状态变更），必须实现变更后数据验证断言：

```typescript
// 写操作后查询实体，确认字段变更正确
test('FLOW-MOD-001-S03: 编辑', async () => {
  const before = await get(`/api/entity/${bizKey}`);
  await put(`/api/entity/${bizKey}`, updatePayload);
  const after = await get(`/api/entity/${bizKey}`);

  // 断言变更正确
  expect(after.data.name).toBe(updatePayload.name);
  // 断言未修改的字段确实没变
  expect(after.data.code).toBe(before.data.code);
});
```

关键规则：
- 查询操作不生成独立 test()，在同一个 test() 块内作为断言前置步骤
- 必须验证未修改的字段确实没变（`expect(after.field).toBe(before.field)`）
- 创建操作验证返回值的关键字段即可，无需 before 查询
