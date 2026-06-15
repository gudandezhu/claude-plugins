# API 断言标准

供 backend-test subagent 在验证每个 API 响应时对照。

## 成功响应断言

每个成功调用的 API 必须验证以下 4 项：

### 1. HTTP 状态码

```
Assert: response.status === 200
```

### 2. 响应结构

验证顶层结构包含约定的字段（按项目实际约定）：
```json
{ "code": 0, "data": {...}, "msg": "success" }
```
或
```json
{ "success": true, "data": {...}, "message": "操作成功" }
```

断言：
- code/success 字段表示成功
- data 字段存在（可为 null 但必须存在）
- msg/message 字段为字符串

### 3. 业务字段值

至少验证 **1 个业务字段**的值与预期一致：
- 创建接口：验证返回的 id/key 非空
- 查询接口：验证关键字段值 = 请求中的值
- 分页接口：验证 total ≥ 0、list 为数组
- 更新接口：验证修改后的字段值 = 新值

### 4. 分页结构（分页接口专属）

```json
{ "data": { "list": [...], "total": 100, "pageNum": 1, "pageSize": 10 } }
```

断言：
- list 为数组
- total 为非负整数
- pageNum/pageSize 与请求参数一致

## 失败响应断言

### 参数校验失败

- HTTP 状态码 400（或项目约定的错误码）
- 错误信息中包含具体哪个字段、什么问题
- 不接受模糊的"参数错误"提示

### 业务规则失败

- HTTP 状态码 409/422（或 code = 业务错误码）
- 错误信息描述了具体的业务冲突（如"编码已存在"）
- data 为 null 或包含冲突详情

### 认证失败

- 401 未授权 / 403 无权限
- 不返回敏感数据

### 资源不存在

- 404（或 code = 404）
- 错误信息指明哪个资源不存在

## 多接口一致性断言

联动测试中额外验证：
- Create 返回的 ID → Query 能查到
- Update 修改的字段 → Query 返回新值
- Update 未修改的字段 → Query 返回原值（不变）
- Delete 后 → Query 返回 404
