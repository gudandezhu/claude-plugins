# 领域模型指南

本文档说明 Spring Boot MVC 应用中领域模型的核心规则和命名约定。

## 模型分类

### 1. PO (Persistent Object) - 持久化对象

**用途：** 与数据库表结构一一对应的实体类，由 ORM 框架使用。

**核心特点：**
- 一个 PO 对应数据库中的一张表
- 字段与表列一一对应

**使用规则：**
- ✅ 在 Mapper 接口中使用
- ✅ 在数据层（Repository/DAO）中使用
- ❌ 不要在 Service 层返回给上层
- ❌ 不要在 Controller 层使用
- ❌ 不允许直接暴露给前端

**示例：** 参见 [完整代码示例](../examples/domain-models/PO_Examples.java)

---

### 2. BO (Business Object) - 业务对象

**用途：** 封装业务数据的对象，由 Service 层输出，包含经过处理的业务数据。

**核心特点：**
- 纯数据载体，**不包含任何业务逻辑**
- 可能包含多个 PO 的数据组合
- 可能包含计算字段（由 Service 层计算并填充）
- 是 Service 层对外的主要数据载体

**使用规则：**
- ✅ 在 Service 层内部使用
- ✅ 作为 Service 方法的返回值
- ❌ 不允许直接传递给前端（需要转换为 VO/DTO）
- ❌ 不允许包含业务方法（如 calculateXxx(), canXxx() 等）
- ❌ 不允许包含数据转换方法

**重要说明：**
- 所有业务逻辑必须在 Service 层实现
- BO 只负责承载数据，不负责处理数据
- 使用 Lombok @Data 注解，只生成 getter/setter

**示例：** 参见 [完整代码示例](../examples/domain-models/BO_Examples.java)

---

### 3. DTO (Data Transfer Object) - 数据传输对象

**用途：** 用于 API 层、Service 层、Manager 层之间数据传输的对象。

**核心特点：**
- 用于服务间通信（RPC/Feign）
- 用于跨层传输
- 纯数据载体，不包含任何业务逻辑

**使用规则：**
- ✅ 在 API 层（Feign 接口）使用
- ✅ 在跨服务调用时使用
- ⚠️ 如果 API 层定义了 DTO，在调用 Service 时必须转换为 BO
- ❌ 不要让 Service 层依赖 API 层的 DTO（避免反向依赖）
- ❌ 不允许包含业务方法（如 validateXxx(), convertXxx() 等）
- ❌ 不允许包含数据转换方法

**重要说明：**
- 所有转换逻辑应该在 Controller 或 Convertor 中实现
- DTO 只负责承载数据，不负责处理数据
- 使用 Lombok @Data 注解，只生成 getter/setter

**示例：** 参见 [完整代码示例](../examples/domain-models/DTO_Examples.java)

---

### 4. VO (View Object) - 展示层对象

**用途：** 专门用于 Web 层的请求和响应的数据对象。

**核心特点：**
- 与前端页面或 API 契约对应
- 可能包含前端特定的字段格式化（如金额、时间格式化为字符串）
- 分为 ReqVO（请求）和 RespVO（响应）
- 纯数据载体，不包含任何业务逻辑

**使用规则：**
- ✅ 在 Web Controller 中使用
- ✅ 作为 Controller 方法的参数和返回值
- ⚠️ 在调用 Service 前必须转换为 BO
- ❌ 不要在 Service 层中使用
- ❌ 不允许包含业务方法（如 validateXxx(), formatXxx() 等）
- ❌ 不允许包含数据转换方法

**重要说明：**
- 所有格式化、验证逻辑应该在 Controller 或 Convertor 中实现
- VO 只负责承载数据，不负责处理数据
- 字段格式化（如金额、时间）应该在 Convertor 中完成
- 使用 Lombok @Data 注解，只生成 getter/setter

**示例：** 参见 [完整代码示例](../examples/domain-models/VO_Examples.java)

---

## 命名约定

### 请求对象命名

| 后缀 | 用途 | 层次 | 示例 |
|------|------|------|------|
| `*QueryVO` | Web 层查询入参 | Controller 层 | `OrderQueryVO` |
| `*QueryDTO` | API 层查询入参 | Feign 接口 | `OrderQueryDTO` |
| `*ReqVO` | Web 层请求数据 | Controller 层 | `CreateOrderReqVO` |
| `*ReqDTO` | API 层请求数据 | Feign 接口 | `CreateOrderReqDTO` |

### 响应对象命名

| 后缀 | 用途 | 层次 | 示例 |
|------|------|------|------|
| `*RespVO` | Web 层响应数据 | Controller 层 | `OrderDetailRespVO` |
| `*RespDTO` | API 层响应数据 | Feign 接口 | `OrderDetailRespDTO` |

---

## 数据转换流程

### Web 端点数据流

```text
Client Request
     ↓
*QueryVO / *ReqVO (Controller 参数)
     ↓ 转换
*BO (Service 参数/返回值)
     ↓ 转换
*RespVO (Controller 返回值)
     ↓
Client Response
```

### API 端点数据流

```text
Other Service Request
     ↓
*QueryDTO / *ReqDTO (Feign 参数)
     ↓ 转换
*BO (Service 参数/返回值)
     ↓ 转换
*RespDTO (Feign 返回值)
     ↓
Other Service Response
```

---

## 转换工具

推荐使用 **MapStruct** 进行对象转换：

```java
@Mapper(componentModel = "spring")
public interface OrderConvertor {
    OrderConvertor INSTANCE = Mappers.getMapper(OrderConvertor.class);

    // VO -> BO
    OrderBO toBO(CreateOrderReqVO reqVO);

    // BO -> VO
    OrderDetailRespVO toRespVO(OrderBO bo);

    // DTO -> BO
    OrderBO toBO(CreateOrderReqDTO reqDTO);

    // BO -> DTO
    OrderDetailRespDTO toRespDTO(OrderBO bo);

    // List 转换
    List<OrderDetailRespVO> toRespVOList(List<OrderBO> boList);
}
```

**完整示例：** 参见 [转换工具使用示例](../examples/domain-models/Convertor_Examples.java)

---

## 核心原则

### ✅ 正确做法

1. **层次分明：** 每个层次的模型只在自己负责的层次内使用
2. **及时转换：** 跨层次时必须进行模型转换
3. **使用工具：** 使用 MapStruct 等工具简化转换代码
4. **类型安全：** 使用 `@Valid` 注解确保数据验证
5. **命名清晰：** 严格遵循命名约定，见名知意
6. **单一职责：** 每个模型类只负责一种数据结构
7. **纯数据载体：** 所有模型对象（PO/BO/VO/DTO）都是纯数据载体
   - ✅ 只包含字段和 Lombok @Data 注解
   - ✅ 只生成 getter/setter 方法
   - ❌ 不允许包含业务方法（如 calculateXxx(), validateXxx(), canXxx() 等）
   - ❌ 不允许包含数据转换方法（如 toXxx(), fromXxx() 等）
   - ❌ 不允许包含格式化方法（如 formatXxx() 等）

### ❌ 常见错误

**错误 1：在 BO 中添加业务方法**
```java
// ❌ 错误！BO 不允许包含业务方法
@Data
public class OrderBO {
    private BigDecimal totalAmount;
    private List<OrderItemBO> items;

    // ❌ 错误！业务逻辑应该在 Service 层实现
    public void calculateTotalAmount() {
        this.totalAmount = items.stream()
            .map(OrderItemBO::getSubtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // ❌ 错误！判断逻辑应该在 Service 层实现
    public boolean canCancel() {
        return status == 0 || status == 1;
    }
}
```

**正确做法：**
```java
// ✅ 正确：BO 只包含数据
@Data
public class OrderBO {
    private BigDecimal totalAmount;  // 由 Service 计算并填充
    private Boolean canCancel;       // 由 Service 判断并填充
    private List<OrderItemBO> items;
}

// ✅ 正确：业务逻辑在 Service 层实现
@Service
public class OrderService {
    public OrderBO getOrderDetail(Long orderId) {
        OrderBO bo = // ... 查询数据

        // 计算总金额
        BigDecimal totalAmount = bo.getItems().stream()
            .map(OrderItemBO::getSubtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        bo.setTotalAmount(totalAmount);

        // 判断是否可取消
        bo.setCanCancel(bo.getStatus() == 0 || bo.getStatus() == 1);

        return bo;
    }
}
```

**错误 2：在 VO 中添加格式化方法**
```java
// ❌ 错误！VO 不允许包含格式化方法
@Data
public class OrderDetailRespVO {
    private BigDecimal totalAmount;

    // ❌ 错误！格式化逻辑应该在 Convertor 中实现
    public String getFormattedAmount() {
        return "¥" + totalAmount.setScale(2, RoundingMode.HALF_UP);
    }
}
```

**正确做法：**
```java
// ✅ 正确：VO 直接存储格式化后的字符串
@Data
public class OrderDetailRespVO {
    private String totalAmount;  // 格式化后的金额，如 "¥100.00"
}

// ✅ 正确：格式化逻辑在 Convertor 中实现
@Mapper(componentModel = "spring")
public interface OrderConvertor {
    @Mapping(target = "totalAmount", expression = "java(formatAmount(bo.getTotalAmount()))")
    OrderDetailRespVO toRespVO(OrderBO bo);

    default String formatAmount(BigDecimal amount) {
        return "¥" + amount.setScale(2, RoundingMode.HALF_UP);
    }
}
```

**错误 3：直接暴露 PO 给前端**
```java
// ❌ 错误！
public OrderPO getOrder(Long orderId) {
    return orderMapper.selectById(orderId);
}
```

**正确做法：**
```java
// ✅ 正确：转换为 VO
public HttpResult<OrderDetailRespVO> getOrder(Long orderId) {
    OrderBO bo = orderService.getOrderDetail(orderId);
    OrderDetailRespVO vo = OrderConvertor.INSTANCE.toRespVO(bo);
    return HttpResult.success(vo);
}
```

**错误 4：Service 依赖 VO/DTO**
```java
// ❌ 错误！Service 不应该依赖 Web 层对象
public Long createOrder(CreateOrderReqVO reqVO) {
    // ...
}
```

**正确做法：**
```java
// ✅ 正确：Service 使用 BO
public Long createOrder(OrderBO orderBO) {
    // ...
}

// Controller 负责转换
public HttpResult<Long> createOrder(@Valid @RequestBody CreateOrderReqVO reqVO) {
    OrderBO bo = OrderConvertor.INSTANCE.toBO(reqVO);
    Long orderId = orderService.createOrder(bo);
    return HttpResult.success(orderId);
}
```

---

## 完整示例代码

详细的代码示例请参考：
- [PO 示例](../examples/domain-models/PO_Examples.java)
- [BO 示例](../examples/domain-models/BO_Examples.java)
- [DTO 示例](../examples/domain-models/DTO_Examples.java)
- [VO 示例](../examples/domain-models/VO_Examples.java)
- [转换工具示例](../examples/domain-models/Convertor_Examples.java)
