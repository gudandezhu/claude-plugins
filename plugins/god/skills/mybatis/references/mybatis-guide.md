# MyBatis 最佳实践指南

本文档提供原生 MyBatis 的核心开发指南。

## 架构设计

**分层：** Service → Mapper Interface → Mapper XML

**原则：**
- Mapper 接口仅定义方法签名
- 所有 SQL 在 XML 中实现
- Service 层直接注入 Mapper
- 采用软删除

## 核心规范

### 1. 软删除规范

**强制** 详见 [MyBatis 软删除实现](./mybatis-soft-delete.md)

**数据库字段：**
- `deleted_flag` TINYINT(1)：0-未删除，1-已删除
- `deleted_time` DATETIME：删除时间

**查询过滤：** 所有查询必须包含 `deleted_flag = 0`

```xml
<!-- ✅ 正确 -->
<select id="getById" resultMap="BaseResultMap">
    SELECT * FROM user
    WHERE id = #{id} AND deleted_flag = 0
</select>

<!-- ❌ 错误：缺少 deleted_flag 过滤 -->
<select id="getById" resultMap="BaseResultMap">
    SELECT * FROM user WHERE id = #{id}
</select>
```

**删除操作：** 使用 UPDATE 设置标志位和时间，而非 DELETE

**完整实现代码请参考：** [MyBatis 软删除实现](./mybatis-soft-delete.md)


### 2. 参数传递规范
必须使用 `@Param` 注解

**单参数：** 
```java
User getById(@Param("id")Long id);
```

**多参数：** 
```java
List<User> listByCondition(@Param("keyword") String keyword,
                           @Param("status") String status);
```

### 3. 动态 SQL 规范

**可选条件：** 使用 `<if test="param != null and param != ''">`
```xml
<if test="keyword != null and keyword != ''">
    AND username LIKE concat('%', #{keyword}, '%')
</if>
```

**集合遍历：** 使用 `<foreach>`
```xml
<foreach collection="ids" item="id" open="(" separator="," close=")">
    #{id}
</foreach>
```

### 4. 性能优化规范

**字段复用：** 使用 `<sql id="Base_Column_List">` 定义公共字段

**避免 SELECT *：** 明确列出所需字段

**合理索引：** WHERE 条件和排序字段建立索引

## 命名规范

**Mapper 接口方法命名：**
- `getByXxx()` - 单条查询，返回实体对象
- `listByXxx()` - 列表查询，返回 `List<T>`
- `searchXxx()` - 复杂搜索（多条件、分页）
- `countByXxx()` - 计数查询，返回 `Integer` 或 `Long`
- `softDelete()` - 软删除操作
- `restore()` - 恢复删除

**XML ID：** 与 Mapper 接口方法名保持一致

**Service 方法命名：**
- 与 Mapper 方法命名保持一致
- 可根据业务语义调整（如 `find`、`query`）

## 常识要点

- **参数化查询：** 使用 `#{param}`，禁止 `${}` 拼接
- **LIKE 查询：** 使用 `concat('%', #{param}, '%')`
- **结果映射：** 简单类型用 `resultType`，复杂对象用 `resultMap`
- **配置：** 开启 `map-underscore-to-camel-case` 自动转换
- **扫描：** 启动类添加 `@MapperScan("com.example.mapper")`

## 高级主题

遇到以下场景时，参考 [MyBatis 高级主题](./mybatis-advanced.md)：

- **动态表名**：需要根据业务动态切换查询的表名
- **字段名不匹配**：数据库字段与 Java 属性无法自动映射
- **时区问题**：日期时间存储或读取时出现时区偏差
- **大数据量查询**：查询结果集过大导致内存溢出
- **N+1 查询问题**：关联查询时产生大量重复查询，影响性能

## 相关文档

- [MyBatis 软删除实现](./mybatis-soft-delete.md) - 软删除完整实现方案
