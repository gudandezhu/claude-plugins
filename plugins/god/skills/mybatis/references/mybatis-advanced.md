# MyBatis 高级主题

## 动态表名

使用 `${}` 拼接表名

**⚠️ 警告：** 必须确保表名来源可信，防止 SQL 注入

```xml
<select id="listByTableName" resultMap="BaseResultMap">
    SELECT * FROM ${tableName}
    WHERE deleted_flag = 0
</select>
```

```java
// Java 代码中验证表名
public List<User> listByTableName(String tableName) {
    // 白名单验证
    if (!Arrays.asList("user", "user_archive", "user_history").contains(tableName)) {
        throw new IllegalArgumentException("Invalid table name");
    }
    return userMapper.listByTableName(tableName);
}
```

## 常见问题解决

### 问题 1: 字段名与属性名不匹配

**解决方案 1: 使用别名**
```xml
<select id="getById" resultMap="BaseResultMap">
    SELECT id, user_name as userName, email_address as emailAddress
    FROM user
    WHERE id = #{id}
</select>
```

**解决方案 2: 配置自动映射**
```yaml
mybatis:
  configuration:
    map-underscore-to-camel-case: true
```

### 问题 2: 日期时间处理

**时区问题：**
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/db?useTimezone=true&serverTimezone=Asia/Shanghai
```

### 问题 3: 大数据量查询内存溢出

**使用流式查询：**
```java
@Select("SELECT * FROM user WHERE deleted_flag = 0")
@Options(resultSetType = ResultSetType.FORWARD_ONLY, fetchSize = Integer.MIN_VALUE)
Cursor<User> streamAll();
```

**使用：**
```java
try (Cursor<User> cursor = userMapper.streamAll()) {
    cursor.forEach(user -> {
        // 处理每条记录
    });
}
```

### 问题 4: N+1 查询问题

**问题：** 查询用户列表时，每个用户都要再查询一次部门

**解决：** 使用 JOIN 一次性查询
```xml
<select id="listWithDepartment" resultMap="UserWithDeptMap">
    SELECT u.*, d.id as dept_id, d.name as dept_name
    FROM user u
    LEFT JOIN department d ON u.dept_id = d.id
    WHERE u.deleted_flag = 0
</select>
```
