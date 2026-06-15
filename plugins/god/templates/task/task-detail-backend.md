---
iteration: IT-XX
task-id: BE-XX
task-name: "{实体+操作组，如：供应商管理 CRUD（含列表/新增/编辑/删除/详情）或 用户注册接口 POST /api/v1/users/register}"
role: 后端
microservice: "{微服务名称}"
depends-on: "{依赖任务编号（任务名称）} 或 无"
acceptance-criteria:
  - AC-01: 未验证
tech-design-sections:
  - "{tech-design.md 标准锚点，如：tech-design.md#32-供应商创建接口设计}"
api-docs:
  - "{API文档相对路径，如：../api/POST-suppliers.md}"
tech-design-section-hashes:
  "{标准md锚点，如 tech-design.md#41}": "{一句话内容摘要，如：POST /suppliers 接口，含唯一性校验和状态初始化}"
skipped-gates: []
discovered-sections: []
discovered-dependencies: []
spawned-tasks: []
implementation-notes: ""
---

# {编号} - {任务名称}

<!-- REQUIRED:任务目标 -->
## 任务目标

> 来源：[tech-design.md#章节锚点](../../../design/tech-design.md#章节锚点)

{简要描述本任务要实现的功能，必须与 tech-design.md 中的描述一致，如：实现用户注册接口，完成参数校验、密码加密、数据持久化}
<!-- REQUIRED_END -->

<!-- REQUIRED:API接口文档 -->
## API 接口文档

> 接口定义维护在独立的 API 文档中，前后端共享同一份，避免重复定义。
> 文档路径为相对路径，从当前任务文件位置（`tasks/IT-XX/`）开始 。

### 新增接口

| 接口 | 文档路径                                         |
|------|----------------------------------------------|
| {HTTP方法} {完整接口路径，如 POST /api/v1/users/register} | [../../design/{接口文件名}.md](../api/{接口文件名}.md) |

### 复用接口

> 本任务调用的已有接口/内部服务方法，无需新建 API 文档，但必须说明调用方式和使用的响应字段。

| 接口/方法 | 本任务调用说明 |
|----------|--------------|
| {HTTP方法} {完整接口路径} 或 {Service类名.方法名} | 调用参数：{关键入参说明}；使用响应字段：{本任务实际用到的字段列表} |

<!-- 无复用接口时填"无"，不允许留空 -->
<!-- REQUIRED_END -->


<!-- REQUIRED:核心流程 -->
## 核心流程

> 每个步骤必须与 tech-design.md 中的业务逻辑一致，必须包含以下全部描述项，缺一不可。
> 每个步骤必须标注来源（tech-design.md 章节），不允许无来源的内容。

**1. {步骤名称，如：参数校验}**
- 来源：[tech-design.md#章节锚点](../../../design/tech-design.md#章节锚点)
- 输入：{入参来源与结构，如：RequestBody `{ name, code, phone }` 或 PathVariable `id`}
- 处理逻辑：{具体处理动作，如：校验必填字段非空 → 校验 name 长度 ≤100 → 校验 phone 格式为 11 位数字}
- 校验规则（如有）：
  | 字段 | 规则 | 失败返回 |
  |------|------|---------|
  | {字段名} | {required/maxLength(50)/pattern(正则)/自定义校验} | {HTTP状态码 + errorCode + message，如：400 PARAM_INVALID "供应商名称不能为空"} |
- 输出：{校验通过后传递给下一步的数据结构}
- 异常处理：{校验失败时的具体返回，如：400 PARAM_INVALID "手机号格式不正确"}

**2. {步骤名称，如：业务规则校验}**
- 来源：[tech-design.md#章节锚点](../../../design/tech-design.md#章节锚点)
- 输入：{上一步传递的数据}
- 处理逻辑：{具体业务校验，如：查询数据库检查 code 是否已存在 → SELECT COUNT(*) FROM supplier WHERE code = #{code} AND deleted = 0}
- 数据库操作（如有）：
  | 操作 | SQL 骨架 | 说明 |
  |------|---------|------|
  | {SELECT/INSERT/UPDATE} | {SQL 骨架，含表名、关键字段、WHERE 条件，如：`SELECT COUNT(*) FROM supplier WHERE code = #{code} AND deleted = 0`} | {操作目的，如：检查编码唯一性} |
- 输出：{校验通过后的状态}
- 异常处理：{业务校验失败时的具体返回，如：409 CODE_EXISTS "供应商编码已存在"}

**3. {步骤名称，如：核心业务处理}**
- 来源：[tech-design.md#章节锚点](../../../design/tech-design.md#章节锚点)
- 输入：{上一步传递的数据}
- 处理逻辑：{核心业务动作，如：构建 Supplier 实体 → 设置默认状态为启用(1) → 填充创建人/创建时间}
- 数据转换（如有）：{DTO → Entity 的映射关系，如：`RegisterRequest.name → Supplier.supplierName`，需列出所有非同名映射}
- 事务边界：{是否需要事务，事务范围，如：@Transactional 包裹步骤 3~4，隔离级别默认}
- 输出：{处理后的数据结构}

**4. {步骤名称，如：数据持久化}**
- 来源：[tech-design.md#章节锚点](../../../design/tech-design.md#章节锚点)
- 输入：{上一步构建的实体}
- 处理逻辑：{持久化动作，如：调用 supplierMapper.insert(supplier) 插入数据库}
- 数据库操作：
  | 操作 | SQL 骨架 | 说明 |
  |------|---------|------|
  | {INSERT/UPDATE/DELETE} | {SQL 骨架，如：`INSERT INTO supplier(code, name, contact_name, contact_phone, status, create_by, create_time) VALUES(...)`} | {操作目的} |
- 关联操作（如有）：{如：同步写入操作日志 → INSERT INTO operation_log(...)；发送 MQ 消息 → topic: supplier-created}
- 输出：{持久化结果，如：返回自增主键 id}
- 异常处理：{持久化失败时的处理，如：数据库异常 → 事务回滚 → 500 SYSTEM_ERROR "系统异常，请稍后重试"}

**5. {步骤名称，如：组装响应}**
- 来源：[tech-design.md#章节锚点](../../../design/tech-design.md#章节锚点)
- 输入：{上一步的结果}
- 处理逻辑：{响应组装逻辑，如：将新增记录的 id 封装到 Result.success(data) 中返回}
- 输出：{完整响应结构，如：`{ success: true, code: 200, data: { id: 1 } }`}

<!-- REQUIRED_END -->

<!-- REQUIRED:验收标准 -->
## 验收标准

每条标准必须是 Agent 可通过命令自动判定通过/失败的。按阶段组织，前一阶段全部通过后才可进入下一阶段。

### 阶段 1：开发验收

> 开发完成的基本质量门禁，通过后标记开发列为 `done`。

- [ ] `getDiagnostics` 输出 0 Error
- [ ] 代码可正常编译/构建
- [ ] 单元测试全部通过
- [ ] curl 验证正常返回 200：`curl -X {POST/GET} {完整接口路径} -H 'Content-Type: application/json' -d '{真实请求参数示例}'`
- [ ] curl 数据返回符合业务预期
- [ ] curl 验证异常场景：`curl ...` → 预期返回 {状态码}（{异常场景描述}）

### 阶段 2：自测验收

> 开发者自行验证业务流程，通过后标记自测列为 `done`。

- [ ] API 正向验证（每个 API 至少 1 个正向用例，验证 200 + 响应结构 + 业务数据）
- [ ] API 参数校验验证（每个必填字段至少 1 个缺失/错误用例）
- [ ] API 边界值验证（字符串最大长度、数值边界、空数组，按字段类型）
- [ ] API 业务规则验证（唯一性、状态流转、依赖检查，按 AC 要求）
- [ ] API 异常场景验证（未授权、资源不存在，至少 1 个）
- [ ] 多 API 联动验证（create → query → update → delete，涉及 CRUD 时）
- [ ] 数据持久化验证（数据库记录正确，字段值与预期一致）
- [ ] 自测报告含 API 测试覆盖率摘要


<!-- REQUIRED_END -->
