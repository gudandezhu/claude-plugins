# Spring Boot MVC 示例代码

本目录包含完整的 Spring Boot MVC Web 开发示例代码，展示了最佳实践的具体实现。

## 目录结构

```
examples/
├── web-controller/           # Web 控制器示例
│   └── OrderController.java
├── api-controller/           # API 控制器示例（Feign）
│   └── OrderBizController.java
└── domain-models/            # 领域模型示例
    ├── VO_Examples.java      # VO（View Object）示例
    └── DTO_Examples.java     # DTO（Data Transfer Object）示例
```

## 示例说明

### 1. Web 控制器（OrderController.java）

**用途：** 提供给前端页面调用的接口

**特点：**
- 使用 `@RestController` 注解
- 实现 `OrderApi` 接口
- 接收 `*ReqVO` / `*QueryVO` 参数
- 返回 `*RespVO` 响应
- 使用 `HttpResult<T>` 包装响应

**关键模式：**
```java
@Override
public HttpResult<OrderDetailRespVO> getOrderDetail(Long orderId) {
    // 1. 调用 Service 获取 BO
    OrderBO orderBO = orderService.getOrderDetail(orderId);

    // 2. 转换为 RespVO
    OrderDetailRespVO respVO = OrderConvertor.INSTANCE.toRespVO(orderBO);

    // 3. 包装响应
    return HttpResult.success(respVO);
}
```

### 2. API 控制器（OrderBizController.java）

**用途：** 提供给其他微服务调用的接口（通过 Feign）

**特点：**
- 使用 `@RestController` 注解
- 实现 `OrderBizApi` 接口（Feign 接口）
- 接收 `*ReqDTO` / `*QueryDTO` 参数
- 返回 `*RespDTO` 响应
- 使用 `HttpResult<T>` 包装响应

**关键模式：**
```java
@Override
public HttpResult<OrderDetailRespDTO> getOrderDetail(@Valid @RequestBody OrderQueryDTO queryDTO) {
    // 1. 调用 Service 层
    OrderBO orderBO = orderService.getOrderDetail(queryDTO.getOrderId());

    // 2. 转换 BO 为 RespDTO
    OrderDetailRespDTO respDTO = OrderConvertor.INSTANCE.toDetailRespDTO(orderBO);

    // 3. 包装响应
    return HttpResult.success(respDTO);
}
```

### 3. 领域模型示例

#### [PO_Examples.java](domain-models/PO_Examples.java)
展示 Persistent Object 的定义：
- `OrderPO` - 订单持久化对象
- `OrderItemPO` - 订单项持久化对象
- `UserPO` - 用户持久化对象
- `ProductPO` - 商品持久化对象

**特点：**
- 与数据库表一一对应
- 使用 MyBatis Plus 注解
- 定义在 `infrastructure.dataobject` 包

#### [BO_Examples.java](domain-models/BO_Examples.java)
展示 Business Object 的定义：
- `OrderBO` - 订单业务对象
- `OrderBO.OrderItemBO` - 订单项业务对象
- `AddressBO` - 地址业务对象
- `PageBO<T>` - 分页业务对象

**特点：**
- 包含计算字段和业务方法
- 使用 Builder 模式
- 定义在 `service.bo` 包

#### [DTO_Examples.java](domain-models/DTO_Examples.java)
展示 Data Transfer Object 的定义：
- `UserOrderQueryDTO` - 用户订单查询
- `CreateOrderReqDTO` - 创建订单请求（服务间）
- `UpdateOrderStatusReqDTO` - 更新状态请求（服务间）
- `OrderDetailRespDTO` - 订单详情响应（服务间）

**特点：**
- 更简洁，不包含格式化字段
- 使用原始数据类型（BigDecimal, LocalDateTime）
- 定义在 `api.feign.dto` 包

#### [VO_Examples.java](domain-models/VO_Examples.java)
展示 View Object 的定义：
- `OrderQueryVO` - 查询参数
- `CreateOrderReqVO` - 创建订单请求
- `UpdateOrderStatusReqVO` - 更新状态请求
- `OrderListRespVO` - 订单列表响应
- `OrderDetailRespVO` - 订单详情响应

**特点：**
- 包含验证注解（`@NotNull`, `@Size` 等）
- 包含前端格式化字段（金额、时间等）
- 包含业务描述字段（状态描述等）
- 定义在 `api.web.vo` 包

#### [Convertor_Examples.java](domain-models/Convertor_Examples.java)
展示对象转换器的定义：
- `OrderConvertor` - 订单对象转换器
- PO ↔ BO 转换方法
- VO ↔ BO 转换方法
- DTO ↔ BO 转换方法
- List 批量转换方法
- 格式化辅助方法

**特点：**
- 使用 MapStruct 自动生成转换代码
- 处理字段映射差异
- 支持格式化（金额、时间等）

## 使用指南

### 1. 创建新的 Web 控制器

```java
@RestController
public class YourController implements YourApi {

    @Resource
    private YourService yourService;

    @Override
    public HttpResult<YourRespVO> yourMethod(@Valid @RequestBody YourReqVO reqVO) {
        // 1. 转换 ReqVO -> BO
        YourBO bo = YourConvertor.INSTANCE.toBO(reqVO);

        // 2. 调用 Service
        YourBO resultBO = yourService.yourMethod(bo);

        // 3. 转换 BO -> RespVO
        YourRespVO respVO = YourConvertor.INSTANCE.toRespVO(resultBO);

        // 4. 包装响应
        return HttpResult.success(respVO);
    }
}
```

### 2. 创建新的 API 控制器

```java
@RestController
public class YourBizController implements YourBizApi {

    @Resource
    private YourService yourService;

    @Override
    public HttpResult<YourRespDTO> yourMethod(@Valid @RequestBody YourReqDTO reqDTO) {
        // 1. 转换 ReqDTO -> BO
        YourBO bo = YourConvertor.INSTANCE.toBO(reqDTO);

        // 2. 调用 Service
        YourBO resultBO = yourService.yourMethod(bo);

        // 3. 转换 BO -> RespDTO
        YourRespDTO respDTO = YourConvertor.INSTANCE.toRespDTO(resultBO);

        // 4. 包装响应
        return HttpResult.success(respDTO);
    }
}
```

### 3. 定义 VO/DTO

**VO 示例：**
```java
@Data
public class CreateUserReqVO {
    @NotNull(message = "用户名不能为空")
    @Size(min = 2, max = 50, message = "用户名长度必须在2-50之间")
    private String userName;

    @NotNull(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;
}
```

**DTO 示例：**
```java
@Data
public class CreateUserReqDTO {
    @NotNull(message = "用户名不能为空")
    private String userName;

    @NotNull(message = "邮箱不能为空")
    private String email;

    // DTO 通常更简洁，不包含复杂验证
}
```

### 4. 使用 MapStruct 转换器

```java
@Mapper(componentModel = "spring")
public interface OrderConvertor {
    OrderConvertor INSTANCE = Mappers.getMapper(OrderConvertor.class);

    // ReqVO -> BO
    OrderBO toBO(CreateOrderReqVO reqVO);

    // ReqDTO -> BO
    OrderBO toBO(CreateOrderReqDTO reqDTO);

    // BO -> RespVO
    OrderDetailRespVO toRespVO(OrderBO bo);

    // BO -> RespDTO
    OrderDetailRespDTO toRespDTO(OrderBO bo);

    // List 转换
    List<OrderDetailRespVO> toRespVOList(List<OrderBO> boList);
}
```

## 关键要点

### ✅ 正确做法

1. **Controller 只负责转换和调用**
   - 接收 VO/DTO
   - 转换为 BO
   - 调用 Service
   - 转换为 RespVO/RespDTO
   - 包装响应

2. **使用验证注解**
   - 在 VO/DTO 上使用 `@Valid`, `@NotNull` 等注解
   - 在 Controller 方法参数上使用 `@Valid`

3. **使用 HttpResult 包装响应**
   - 统一响应格式
   - 便于前端处理

### ❌ 错误做法

1. **不要在 Controller 中写业务逻辑**
   ```java
   // 错误！
   public HttpResult<OrderRespVO> getOrder(Long id) {
       OrderPO po = orderMapper.selectById(id);
       if (po == null) {
           throw new BusinessException("订单不存在");
       }
       // 复杂的业务逻辑...
   }
   ```

2. **不要让 Service 依赖 VO/DTO**
   ```java
   // 错误！Service 不应依赖 API 层对象
   public Long createOrder(CreateOrderReqVO reqVO) {
       // ...
   }
   ```

3. **不要直接返回 PO**
   ```java
   // 错误！不要暴露数据库实体
   public OrderPO getOrder(Long id) {
       return orderMapper.selectById(id);
   }
   ```

## 相关文档

- [领域模型核心规则](../references/domain-models.md) - PO/BO/DTO/VO 的核心规则和命名约定
- [主技能文档](../SKILL.md) - Spring Boot MVC Web 开发最佳实践

## 最佳实践检查清单

在编写 Controller 时，请检查：

- [ ] Controller 只负责转换和调用 Service
- [ ] 使用了正确的 VO/DTO 类型
- [ ] 所有请求参数都使用了 `@Valid` 验证
- [ ] 响应使用 `HttpResult<T>` 包装
- [ ] 使用了 MapStruct 等工具进行对象转换
- [ ] 日志记录了关键操作
- [ ] HTTP 方法使用正确（GET/POST）
- [ ] 端点路径符合 RESTful 规范
- [ ] 没有在 Controller 中写业务逻辑
- [ ] 没有让 Service 依赖 VO/DTO
- [ ] 没有直接暴露 PO 给前端
