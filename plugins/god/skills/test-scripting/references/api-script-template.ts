// API 脚本代码模板
// 文件路径：scripts/api/tests/{接口名}.api.test.ts
//
// ⚠️ API_PREFIX 使用规范（重要！）
// - API 测试使用 helpers/api-client.ts 的 get/post 函数
// - 这些函数的 baseURL 已包含完整 apiPrefix
// - 请求路径使用相对路径：get('/rule/list')
// - 禁止拼接 API_PREFIX：get(`${API_PREFIX}/rule/list`) ← 会导致 404
// - API_PREFIX 仅用于 E2E 测试的 waitForResponse

import { get, post } from '../helpers/api-client';

describe('接口名称', () => {
  // ---- 动态测试数据（从列表接口获取有效 ID，避免硬编码无效值） ----
  let validId: string | null = null;

  beforeAll(async () => {
    // 从列表接口获取一条有效数据，提取其 ID
    // 替换 '/rule/list' 为当前接口对应的列表接口路径
    const listRes = await get('/rule/list', { pageNum: 1, pageSize: 1 });
    if (listRes.code === 0 && Array.isArray(listRes.data?.list) && listRes.data.list.length > 0) {
      validId = listRes.data.list[0].id || listRes.data.list[0].code || null;
    }
  });

  afterAll(async () => { /* 清理测试数据 */ });

  test('TC-API-001: 正常请求-列表查询', async () => {
    const res = await get('/rule/list', { pageNum: 1, pageSize: 10 });
    expect(res.code).toBe(0);
    // 使用 api-probe.md 中确认的字段名
    expect(res.data.totalRows).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.data.list)).toBe(true);
  });

  test('TC-API-002: 正常请求-详情查询（动态ID）', async () => {
    if (!validId) {
      console.log('⚠️ 无法获取有效的测试数据 ID，跳过详情查询测试');
      return;
    }
    const res = await get('/rule/detail', { id: validId });
    expect(res.code).toBe(0);
    expect(res.data).toBeDefined();
  });

  test('TC-API-003: 参数校验-必填参数缺失', async () => { /* ... */ });
  test('TC-API-004: 未授权访问', async () => { /* ... */ });
});
