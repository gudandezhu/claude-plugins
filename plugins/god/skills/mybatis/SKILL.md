---
name: mybatis
user-invocable: false
description: Guide for developing data access layer with MyBatis/MyBatis Plus best practices. Use when needs to implement database operations. 
---

# MyBatis/MyBatis Plus 数据访问层开发指南

## 工作流程

### 1. 检测框架依赖

如果未指明所使用的框架，则执行下面的命令：

```bash
# 检测 MyBatis Plus
bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh --dep-tree -d <项目路径> | grep -i "mybatis-plus"
```

**判断：**
- ✅ 存在 `mybatis-plus-boot-starter` → 使用 **MyBatis Plus** 模式
- ❌ 仅 `mybatis-spring-boot-starter` → 使用 **原生 MyBatis** 模式

### 2. 选择对应的开发模式

**MyBatis Plus 模式**
- **查询策略：** 简单查询用 `lambdaQuery()`，复杂查询用 `baseMapper`
- **详细指南：** [MyBatis Plus 最佳实践](./references/mybatis-plus-guide.md)

**原生 MyBatis 模式**
- **原则：** 所有 SQL 在 XML 中定义
- **详细指南：** [MyBatis 最佳实践](./references/mybatis-guide.md)

### 3. 读取对应开发模式的指南
MyBatis Plus 模式：读取 ./references/mybatis-plus-guide.md
原生 MyBatis 模式：读取 ./references/mybatis-guide.md

## 核心原则清单

### ✅ 必须遵守

- [ ] **参数化查询**：始终使用 `#{param}`，禁止 `${}` 拼接（防止 SQL 注入）
- [ ] **软删除**：采用软删除而非物理删除，详见对应框架的软删除实现指南
- [ ] **查询过滤**：所有查询必须过滤已删除记录
- [ ] **时间处理**：使用应用服务器时间，禁止数据库函数（如 `NOW()`）
- [ ] **参数命名**：多参数使用 `@Param("name")` 注解

### 🎯 推荐实践

- [ ] **MyBatis Plus**：简单查询用 `lambdaQuery()`，复杂查询用 `baseMapper`
- [ ] **返回值**：单条查询优先返回 `Optional<T>`
- [ ] **命名规范**：遵循 `getByXxx` / `listByXxx` / `searchXxx` 规范
- [ ] **动态 SQL**：使用 `<if test="param != null">` 处理可选条件

### ⚠️ 性能优化

- [ ] **索引**：WHERE 条件和排序字段建立索引
- [ ] **分页**：使用 LIMIT 或分页插件
- [ ] **字段选择**：明确列出所需字段，避免 `SELECT *`

## 参考文档

### 核心指南（必读）
根据检测到的框架类型，阅读对应的开发指南：

- [MyBatis Plus 最佳实践](./references/mybatis-plus-guide.md) - MyBatis Plus 开发完整指南
- [MyBatis 最佳实践](./references/mybatis-guide.md) - 原生 MyBatis 开发指南

### 软删除实现（必读）
每个框架的软删除除实现方案（包含完整的代码示例）：

- [MyBatis Plus 软删除实现](./references/mybatis-plus-soft-delete.md) - 使用 lambdaQuery 的软删除方案
- [MyBatis 软删除实现](./references/mybatis-soft-delete.md) - XML 方式的软删除方案

### 高级主题（按需参考）
遇到以下场景时参考：

- [MyBatis 高级主题](./references/mybatis-advanced.md)
  - **动态表名**：需要按表名动态查询时
  - **字段名不匹配**：数据库字段与 Java 属性不匹配时
  - **时区问题**：日期时间处理遇到时区问题时
  - **大数据量查询**：需要流式查询避免内存溢出时
  - **N+1 查询问题**：优化关联查询性能时
