# API 快速测试清单

精简自 `test-case-design/references/api-case-design.md` 覆盖完整性章节。
供 backend-test subagent 在自测阶段逐条对照执行。

## 1. 正向用例（必做）

**要求**：每个 API 至少 1 个合法参数的正确响应验证。

验证点：
- 状态码 200
- 响应结构包含 code + data + msg（或项目约定的响应结构）
- data 中关键字段有值（非 null/空数组）
- 分页接口验证 total > 0、list 非空

示例：
```
POST /api/v1/suppliers
Body: { "name": "测试供应商", "code": "TEST001", "status": 1 }
Assert: 200, code=0, data.id 存在
```

## 2. 参数校验（必做）

**要求**：每个必填字段至少 1 个缺失或类型错误用例。

验证点：
- 必填字段缺失 → 返回明确错误信息
- 类型错误（字符串传数字、数字传字母）→ 参数校验拦截
- 非法值（负数、超长字符串、特殊字符）→ 按业务规则返回

同类型异常可合并（如 name 和 code 都是必填字符串，可一个用例覆盖两个缺失场景）。

示例：
```
POST /api/v1/suppliers
Body: { "code": "TEST001" }  // 缺少 name
Assert: 400 或 code=-1, msg 包含 "名称" 相关提示
```

## 3. 边界值（按字段类型选做）

**要求**：根据字段类型选择相关边界值测试。

| 字段类型 | 边界值 |
|----------|--------|
| String | 最大长度（如 255 字符）、空字符串 |
| Number | 0、负数、最大值（如 9999999.99） |
| Array | 空数组 `[]`、超长数组（50+ 条） |
| Date | 过去日期、未来日期、闰年 |

示例：
```
POST /api/v1/suppliers
Body: { "name": "A".repeat(256), "code": "TEST001" }
Assert: 返回参数校验错误，提示长度超限
```

## 4. 业务规则（按 AC 要求）

**要求**：按 AC 中定义的业务规则逐条验证。

常见业务规则：
- 唯一性校验：重复创建相同唯一标识 → 返回冲突错误
- 状态流转：未满足前置条件时操作 → 返回状态错误
- 依赖检查：引用不存在的关联数据 → 返回依赖错误
- 权限校验：无权限时操作 → 返回权限错误

示例：
```
POST /api/v1/suppliers
Body: { "name": "已存在的供应商", "code": "EXISTING_CODE" }
Assert: 409 或 code=409, msg 包含 "编码已存在"
```

## 5. 异常场景（至少 1 个）

**要求**：每个 API 至少验证 1 个异常场景。

常见异常：
- 未授权（不带 token 或无效 token）→ 401
- 资源不存在（不存在的 ID）→ 404 或 code=404
- 并发冲突（乐观锁版本不匹配）→ 409

示例：
```
DELETE /api/v1/suppliers/999999
Assert: 404 或 code=404, msg 包含 "不存在"
```

## 6. 接口联动（涉及 CRUD 时必做）

**要求**：任务涉及多个相关接口时，验证 CRUD 完整链路。

验证流程：
1. **Create** → 创建测试数据，记录返回的 ID/key
2. **Query** → 用创建的 ID 查询，验证数据一致
3. **Update** → 修改数据，再用 Query 验证修改生效
4. **Delete** → 删除数据，再用 Query 验证已删除

示例：
```
1. POST /suppliers → 返回 id=123
2. GET /suppliers/123 → name="测试供应商"
3. PUT /suppliers/123 → name="修改后"
4. GET /suppliers/123 → name="修改后" ✅
5. DELETE /suppliers/123 → 200
6. GET /suppliers/123 → 404 ✅
```
