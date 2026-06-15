# 领域模型代码示例

本目录包含 Spring Boot MVC 应用中各种领域模型的完整代码示例。

## 📁 文件说明

### [PO_Examples.java](./PO_Examples.java)
**持久化对象示例**
- OrderPO - 订单持久化对象
- OrderItemPO - 订单项持久化对象
- UserPO - 用户持久化对象
- ProductPO - 商品持久化对象

**关键特点：**
- 与数据库表一一对应
- 使用 MyBatis Plus 注解
- 纯数据载体，无业务逻辑

### [BO_Examples.java](./BO_Examples.java)
**业务对象示例**
- OrderBO - 订单业务对象
- OrderBO.OrderItemBO - 订单项业务对象
- AddressBO - 地址业务对象
- PageBO<T> - 分页业务对象

**关键特点：**
- 可包含多个 PO 的数据组合
- 可包含计算字段（由 Service 层填充）
- 纯数据载体，无业务逻辑

### [DTO_Examples.java](./DTO_Examples.java)
**数据传输对象示例**
- UserOrderQueryDTO - 用户订单查询
- OrderQueryDTO - 订单查询
- CreateOrderReqDTO - 创建订单请求
- UpdateOrderStatusReqDTO - 更新状态请求
- OrderDetailRespDTO - 订单详情响应

**关键特点：**
- 用于服务间通信（Feign）
- 使用原始数据类型
- 纯数据载体，无业务逻辑

### [VO_Examples.java](./VO_Examples.java)
**展示层对象示例**
- OrderQueryVO - 订单查询参数
- CreateOrderReqVO - 创建订单请求
- UpdateOrderStatusReqVO - 更新状态请求
- OrderListRespVO - 订单列表响应
- OrderDetailRespVO - 订单详情响应

**关键特点：**
- 用于前后端通信
- 包含验证注解（@NotNull, @Size 等）
- 包含格式化字段（金额、时间等）
- 纯数据载体，无业务逻辑

### [Convertor_Examples.java](./Convertor_Examples.java)
**对象转换器示例**
- OrderConvertor - 订单对象转换器
- PO ↔ BO 转换方法
- VO ↔ BO 转换方法
- DTO ↔ BO 转换方法
- List 批量转换方法
- 格式化辅助方法

**关键特点：**
- 使用 MapStruct 自动生成转换代码
- 处理字段映射差异
- 实现格式化逻辑

## 🎯 核心原则

所有模型对象必须遵循：

✅ **允许：**
- 字段定义
- Lombok @Data 注解（只生成 getter/setter）
- 验证注解（如 @NotNull, @Size 等）

❌ **禁止：**
- 业务方法（如 calculateXxx(), canXxx(), validateXxx() 等）
- 数据转换方法（如 toXxx(), fromXxx() 等）
- 格式化方法（如 formatXxx() 等）
- 任何业务逻辑

## 📚 相关文档

- [领域模型核心规则](../../references/domain-models.md) - 详细的核心规则和命名约定
- [MVC 技能主文档](../../SKILL.md) - Spring Boot MVC Web 开发最佳实践
