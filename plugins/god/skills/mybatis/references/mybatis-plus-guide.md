# MyBatis Plus 最佳实践指南

本文档提供 MyBatis Plus 的核心开发指南。

## 架构设计

### 四层架构（推荐）

**分层**：Service → DAO → Mapper → Mapper XML

1. **Service**：不继承任何接口，ServiceImpl 只实现 Service 接口
2. **DAO**：继承 `ServiceImpl<Mapper, Entity>`，封装所有数据库操作
3. **Mapper**：继承 `BaseMapper<Entity>`
4. **Mapper XML**：承载复杂操作的 SQL

**推荐理由：**
- DAO 层封装了基于 `lambdaQuery()` 和 `lambdaUpdate()` 构造的数据库操作, 便于对 Service 和 DAO 分别进行单元测试
- Service 专注于业务逻辑，DAO 专注于数据访问

### 三层架构（兼容旧项目）

**分层**：Service → Mapper → Mapper XML

1. **Service**：继承 `IService<Entity>` 接口
   - ServiceImpl 继承 `ServiceImpl<Mapper, Entity>` 并实现 Service 接口
2. **Mapper**：继承 `BaseMapper<Entity>`
3. **Mapper XML**：承载复杂操作的 SQL

**适用场景：** 部分旧项目使用三层架构，需兼容

### 查询优先级

1. 简单查询 → `lambdaQuery()` （推荐）
2. 复杂查询 → `baseMapper.method()`

## 核心规范

### 1. 查询方法选择

**简单查询：** 使用 `lambdaQuery()`
- 类型安全：方法引用 `Entity::getField`
- 链式调用：清晰可读
- 自动过滤软删除：添加 `.eq(Entity::getDeletedFlag, Boolean.FALSE)`

**复杂查询：** 使用 `baseMapper`
- 多表 JOIN
- 子查询
- 复杂聚合

### 2. 软删除规范

**强制** 详见 [MyBatis Plus 软删除实现](./mybatis-plus-soft-delete.md)

**数据库字段：**
- `deleted_flag` TINYINT(1)：0-未删除，1-已删除
- `deleted_time` DATETIME：删除时间

**Java 实体：**
- `Boolean deletedFlag`：映射为布尔类型
- `LocalDateTime deletedTime`：删除时间

**核心要求：**
- 软删除时必须同时设置 `deletedFlag = true` 和 `deletedTime`
- 时间使用 `LocalDateTime.now(Clock.systemUTC())`
- 所有查询必须过滤 `deletedFlag = false`

**完整实现代码请参考：** [MyBatis Plus 软删除实现](./mybatis-plus-soft-delete.md)

**⚠️ 不使用 @TableLogic 的原因：**
1. 手动实现更灵活，便于控制 `deletedTime` 字段
2. 统一使用应用服务器时间（`Clock.systemUTC()`）
3. 避免 MyBatis Plus 自动填充时区问题


### 3. Lambda 查询规范

**方法引用：** 始终使用 `Entity::getField`，禁止字符串字段名

**返回值：**
- 单条：`.oneOpt()` 返回 `Optional<T>`
- 列表：`.list()` 返回 `List<T>`
- 分页：`.page(new Page<>(pageNum, pageSize))`

**条件控制：**
```java
// 使用条件参数避免 if 语句
.like(StringUtils.isNotBlank(keyword), User::getUsername, keyword)
.eq(status != null, User::getStatus, status)
```

### 4. 命名规范

**DAO 方法命名（四层架构）：**
- `getByXxx()` - 单条查询，返回 `Optional<T>` 或实体
- `listByXxx()` - 列表查询，返回 `List<T>`
- `searchXxx()` - 复杂查询（调用 baseMapper）
- `softDelete()` - 软删除操作
- `restore()` - 恢复删除

**Mapper 方法命名（仅用于复杂查询）：**
- 继承 `BaseMapper` 的基础方法足够简单查询使用
- 仅在 `baseMapper` 无法满足时才定义自定义方法
- 自定义方法命名同 DAO 方法规范

**Service 方法命名：**
- 与 DAO 层方法命名保持一致
- 可根据业务语义增加前缀（如 `find`、`query`）

## Lambda 查询速查

**条件：**
```java
.eq(field, value)        // =
.like(field, value)      // LIKE '%value%'
.in(field, values)       // IN (...)
.gt(field, value)        // >
```

**条件控制：**
```java
.eq(condition, field, value)  // condition 为 true 时才添加
```

**排序：**
```java
.orderByDesc(field)
.orderByAsc(field)
```

**结果：**
```java
.oneOpt()    // Optional<T>
.list()      // List<T>
.page()      // IPage<T>
```

## 常识要点

- **类型安全：** 使用方法引用避免字段名错误
- **空值安全：** 单条查询用 `oneOpt()`
- **软删除：** 查询必须过滤 `deletedFlag = false`
- **性能：** 避免 SELECT *，合理使用索引

## 高级主题

遇到以下场景时，参考 [MyBatis 高级主题](./mybatis-advanced.md)：

- **动态表名**：需要根据业务动态切换查询的表名
- **字段名不匹配**：数据库字段与 Java 属性无法自动映射
- **时区问题**：日期时间存储或读取时出现时区偏差
- **大数据量查询**：查询结果集过大导致内存溢出
- **N+1 查询问题**：关联查询时产生大量重复查询，影响性能

## 相关文档

- [MyBatis Plus 软删除实现](./mybatis-plus-soft-delete.md) - 软删除完整实现方案
