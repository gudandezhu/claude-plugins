# MyBatis Plus 软删除实现方案

本文档提供 MyBatis Plus 的软删除手动实现方案。

## 数据库示例

**新项目标准：**

```sql
CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50),
    deleted_flag TINYINT(1) DEFAULT 0 COMMENT '0-未删除, 1-已删除',
    deleted_time DATETIME COMMENT '删除时间',
    UNIQUE KEY uk_username_deleted (username, deleted_time, deleted_flag)
);
```

**必需字段：**
- `deleted_flag` TINYINT(1)：删除标志，0 表示未删除，1 表示已删除
- `deleted_time` DATETIME：删除时间，用于审计

**旧项目兼容：**
- 部分旧项目使用 `is_deleted` 字段（功能相同）
- 迁移时建议保持原有字段名，避免大规模修改
- 新项目统一使用 `deleted_flag`

**字段类型映射：**

| 数据库字段 | Java 属性 | 说明 |
|-----------|----------|------|
| `deleted_flag` TINYINT(1) | `Boolean deletedFlag` | MyBatis Plus 自动映射为布尔类型 |
| `deleted_time` DATETIME | `LocalDateTime deletedTime` | 删除时间戳 |

**重要：** MyBatis Plus 会自动将 TINYINT(1) 映射为 Boolean 类型

## 时间处理规范

**原则：使用应用服务器时间，禁止使用数据库 `NOW()` 函数**

**原因：** 服务器和数据库可能部署在不同时区，以应用服务器时间为准

**实现：**
```java
LocalDateTime now = LocalDateTime.now(Clock.systemUTC());
```

## Entity 实体类示例

```java
@Data
@TableName("user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    private Boolean deletedFlag;

    private LocalDateTime deletedTime;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
```

## 操作数据的方法示例

```java
     /**
     * 软删除单条记录
     */
    public boolean softDelete(Long id) {
        return lambdaUpdate()
                .eq(User::getId, id)
                .eq(User::getDeletedFlag, Boolean.FALSE)
                .set(User::getDeletedFlag, Boolean.TRUE)
                .set(User::getDeletedTime, LocalDateTime.now(Clock.systemUTC()))
                .set(User::getUpdateTime, LocalDateTime.now(Clock.systemUTC()))
                .update();
    }

    /**
     * 批量软删除
     */
    public boolean softDeleteBatch(List<Long> ids) {
        if (CollectionUtils.isEmpty(ids)) {
            return false;
        }
        return lambdaUpdate()
                .in(User::getId, ids)
                .eq(User::getDeletedFlag, Boolean.FALSE)
                .set(User::getDeletedFlag, Boolean.TRUE)
                .set(User::getDeletedTime, LocalDateTime.now(Clock.systemUTC()))
                .set(User::getUpdateTime, LocalDateTime.now(Clock.systemUTC()))
                .update();
    }

    /**
     * 恢复删除
     */
    public boolean restore(Long id) {
        return lambdaUpdate()
                .eq(User::getId, id)
                .eq(User::getDeletedFlag, Boolean.TRUE)
                .set(User::getDeletedFlag, Boolean.FALSE)
                .set(User::getDeletedTime, null)
                .set(User::getUpdateTime, LocalDateTime.now(Clock.systemUTC()))
                .update();
    }

    /**
     * 批量恢复删除
     */
    public boolean restoreBatch(List<Long> ids) {
        if (CollectionUtils.isEmpty(ids)) {
            return false;
        }
        return lambdaUpdate()
                .in(User::getId, ids)
                .eq(User::getDeletedFlag, Boolean.TRUE)
                .set(User::getDeletedFlag, Boolean.FALSE)
                .set(User::getDeletedTime, null)
                .set(User::getUpdateTime, LocalDateTime.now(Clock.systemUTC()))
                .update();
    }

    /**
     * 查询（过滤已删除）
     */
    public List<User> listAll() {
        return lambdaQuery()
                .eq(User::getDeletedFlag, Boolean.FALSE)
                .orderByDesc(User::getCreateTime)
                .list();
    }

    /**
     * 根据 ID 查询（过滤已删除）
     */
    public Optional<User> getById(Long id) {
        return lambdaQuery()
                .eq(User::getId, id)
                .eq(User::getDeletedFlag, Boolean.FALSE)
                .oneOpt();
    }

    /**
     * 根据条件查询（过滤已删除）
     */
    public List<User> listByCondition(String status, String keyword) {
        return lambdaQuery()
                .eq(User::getDeletedFlag, Boolean.FALSE)
                .eq(StringUtils.isNotBlank(status), User::getStatus, status)
                .like(StringUtils.isNotBlank(keyword), User::getUsername, keyword)
                .orderByDesc(User::getCreateTime)
                .list();
    }

    /**
     * 分页查询（过滤已删除）
     */
    public IPage<User> page(int pageNum, int pageSize, String keyword) {
        return lambdaQuery()
                .eq(User::getDeletedFlag, Boolean.FALSE)
                .like(StringUtils.isNotBlank(keyword), User::getUsername, keyword)
                .orderByDesc(User::getCreateTime)
                .page(new Page<>(pageNum, pageSize));
    }

    /**
     * 查询已删除记录
     */
    public List<User> listDeleted() {
        return lambdaQuery()
                .eq(User::getDeletedFlag, Boolean.TRUE)
                .orderByDesc(User::getDeletedTime)
                .list();
    }

    /**
     * 查询已删除记录（根据 ID）
     */
    public Optional<User> getDeletedById(Long id) {
        return lambdaQuery()
                .eq(User::getId, id)
                .eq(User::getDeletedFlag, Boolean.TRUE)
                .oneOpt();
    }

    /**
     * 更新（防护已删除记录）
     */
    public boolean update(User user) {
        return lambdaUpdate()
                .eq(User::getId, user.getId())
                .eq(User::getDeletedFlag, Boolean.FALSE)  // 只更新未删除的记录
                .update(user);
    }
```

## 最佳实践

### 1. 查询过滤（必须）

所有查询都必须包含 `deletedFlag = false` 条件：

```java
// ✅ 正确
public List<User> listAll() {
    return lambdaQuery()
            .eq(User::getDeletedFlag, Boolean.FALSE)
            .list();
}

// ❌ 错误
public List<User> listAll() {
    return list();  // 会包含已删除记录
}
```

### 2. 更新操作防护

更新操作也要检查 `deletedFlag`：

```java
// ✅ 正确
public boolean update(User user) {
    return lambdaUpdate()
            .eq(User::getId, user.getId())
            .eq(User::getDeletedFlag, Boolean.FALSE)  // 只更新未删除的记录
            .update(user);
}

// ❌ 错误
public boolean update(User user) {
    return updateById(user);  // 可能更新已删除的记录
}
```

### 3. 使用 Lambda 链式调用

推荐使用 lambda 链式调用，类型安全且可读性强：

```java
// ✅ 推荐：使用 lambda
lambdaQuery()
    .eq(User::getDeletedFlag, Boolean.FALSE)
    .like(User::getUsername, keyword)
    .list();

// ❌ 不推荐：使用字符串字段名
queryWrapper
    .eq("deleted_flag", false)
    .like("username", keyword)
    .list();
```

## 注意事项

### 不要使用 @TableLogic

本方案采用手动实现，不使用 MyBatis Plus 的 `@TableLogic` 注解。

**原因：**
1. 手动实现更灵活，便于控制时间字段
2. 避免 `deletedTime` 自动填充问题
3. 统一使用应用服务器时间

### 所有查询数据方法都要过滤

每个查询数据的方法都应该包含 `deletedFlag` 过滤：

```java
// ✅ 正确：包含过滤条件
public Optional<User> getByUsername(String username) {
    return lambdaQuery()
            .eq(User::getUsername, username)
            .eq(User::getDeletedFlag, Boolean.FALSE)
            .oneOpt();
}
```
