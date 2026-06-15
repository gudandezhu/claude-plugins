# MyBatis 软删除实现方案

本文档提供原生 MyBatis 的软删除手动实现方案。

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
| `deleted_flag` TINYINT(1) | `Integer deletedFlag` | MyBatis 映射为整数类型，值为 0 或 1 |
| `deleted_time` DATETIME | `LocalDateTime deletedTime` | 删除时间戳 |

**重要：** MyBatis 原生使用整数 0/1，而非布尔值

## 时间处理规范

**原则：使用应用服务器时间，禁止使用数据库 `NOW()` 函数**

**原因：** 服务器和数据库可能部署在不同时区，以应用服务器时间为准

**实现：**
```java
LocalDateTime now = LocalDateTime.now(Clock.systemUTC());
userMapper.softDelete(id, now, now);
```

## Mapper 接口示例

```java
public interface UserMapper {
    // 软删除
    int softDelete(@Param("id") Long id,
                   @Param("deletedTime") LocalDateTime deletedTime,
                   @Param("updateTime") LocalDateTime updateTime);

    int softDeleteBatch(@Param("ids") List<Long> ids,
                        @Param("deletedTime") LocalDateTime deletedTime,
                        @Param("updateTime") LocalDateTime updateTime);

    // 恢复删除
    int restore(@Param("id") Long id,
                @Param("updateTime") LocalDateTime updateTime);

    // 查询（过滤已删除）
    User getById(Long id);
    List<User> listAll();
    List<User> listByStatus(String status);

    // 查询已删除记录
    User getDeletedById(Long id);
    List<User> listDeleted();

    // 物理删除
    int physicalDelete(Long id);
}
```

## XML Mapper 实现示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.UserMapper">

    <resultMap id="BaseResultMap" type="com.example.entity.User">
        <id column="id" property="id"/>
        <result column="username" property="username"/>
        <result column="deleted_flag" property="deletedFlag" javaType="java.lang.Integer"/>
        <result column="deleted_time" property="deletedTime"/>
        <result column="create_time" property="createTime"/>
        <result column="update_time" property="updateTime"/>
    </resultMap>

    <!-- 软删除 -->
    <update id="softDelete">
        UPDATE user
        SET deleted_flag = 1,
            deleted_time = #{deletedTime},
            update_time = #{updateTime}
        WHERE id = #{id} AND deleted_flag = 0
    </update>

    <!-- 批量软删除 -->
    <update id="softDeleteBatch">
        UPDATE user
        SET deleted_flag = 1,
            deleted_time = #{deletedTime},
            update_time = #{updateTime}
        WHERE id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">
            #{id}
        </foreach>
        AND deleted_flag = 0
    </update>

    <!-- 恢复删除 -->
    <update id="restore">
        UPDATE user
        SET deleted_flag = 0,
            deleted_time = NULL,
            update_time = #{updateTime}
        WHERE id = #{id} AND deleted_flag = 1
    </update>

    <!-- 查询：过滤已删除记录 -->
    <select id="getById" resultMap="BaseResultMap">
        SELECT * FROM user
        WHERE id = #{id} AND deleted_flag = 0
    </select>

    <select id="listAll" resultMap="BaseResultMap">
        SELECT * FROM user
        WHERE deleted_flag = 0
        ORDER BY create_time DESC
    </select>

    <select id="listByStatus" resultMap="BaseResultMap">
        SELECT * FROM user
        WHERE status = #{status} AND deleted_flag = 0
        ORDER BY create_time DESC
    </select>

    <!-- 查询已删除记录 -->
    <select id="getDeletedById" resultMap="BaseResultMap">
        SELECT * FROM user
        WHERE id = #{id} AND deleted_flag = 1
    </select>

    <select id="listDeleted" resultMap="BaseResultMap">
        SELECT * FROM user
        WHERE deleted_flag = 1
        ORDER BY deleted_time DESC
    </select>

    <!-- 物理删除 -->
    <delete id="physicalDelete">
        DELETE FROM user WHERE id = #{id}
    </delete>

</mapper>
```

## 最佳实践

### 1. 查询过滤（必须）

所有查询都必须包含 `deleted_flag = 0` 条件：

```xml
<!-- ✅ 正确 -->
<select id="getById" resultMap="BaseResultMap">
    SELECT * FROM user WHERE id = #{id} AND deleted_flag = 0
</select>

<!-- ❌ 错误 -->
<select id="getById" resultMap="BaseResultMap">
    SELECT * FROM user WHERE id = #{id}
</select>
```

### 2. 更新操作防护

更新和删除操作也要检查 `deleted_flag`：

```xml
<!-- ✅ 正确 -->
<update id="update">
    UPDATE user
    SET username = #{username},
        update_time = #{updateTime}
    WHERE id = #{id} AND deleted_flag = 0
</update>

<!-- ❌ 错误 -->
<update id="update">
    UPDATE user
    SET username = #{username}
    WHERE id = #{id}
</update>
```

### 3. 索引优化

```sql
-- 为 deleted_flag 创建索引
CREATE INDEX idx_deleted_flag ON user(deleted_flag);

-- 复合索引
CREATE INDEX idx_status_deleted ON user(status, deleted_flag);
CREATE INDEX idx_create_time_deleted ON user(create_time, deleted_flag);
```
