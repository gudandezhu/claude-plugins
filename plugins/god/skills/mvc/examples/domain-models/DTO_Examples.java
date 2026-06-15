package com.example.app.order.api.feign.dto;

import lombok.Data;
import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

/**
 * DTO (Data Transfer Object) 示例 - 数据传输对象
 *
 * 用途：
 * - 用于服务间通信（RPC/Feign）
 * - 用于跨层数据传输
 *
 *
 * 特点：
 * - 纯数据载体，不包含任何业务逻辑
 * - 更简洁，不包含前端展示相关的格式化字段
 * - 使用 Lombok @Data 注解，只生成 getter/setter
 *
 * 使用规则：
 * ✅ 在 Feign 接口（API 层）使用
 * ✅ 在跨服务调用时使用
 * ⚠️ 如果 API 层定义了 DTO，在调用 Service 时必须转换为 BO
 * ❌ 不要让 Service 层依赖 API 层的 DTO（避免反向依赖）
 * ❌ 不允许包含业务方法（如 validateXxx(), convertXxx() 等）
 * ❌ 不允许包含数据转换方法
 *
 * 注意：
 * - DTO 与 VO 的区别：
 *   - DTO 用于服务间通信，VO 用于前后端通信
 * - 所有转换逻辑应该在 Controller 或 Convertor 中实现
 * - DTO 只负责承载数据，不负责处理数据
 */

/**
 * 用户订单查询 DTO
 */
@Data
public class UserOrderQueryDTO {
    /**
     * 用户ID
     */
    @NotNull(message = "用户ID不能为空")
    private Long userId;

    /**
     * 订单状态（可选）
     */
    private Integer status;

    /**
     * 页码
     */
    private Integer pageNum = 1;

    /**
     * 每页大小
     */
    private Integer pageSize = 10;
}

/**
 * 订单查询 DTO
 */
@Data
public class OrderQueryDTO {
    /**
     * 订单ID
     */
    @NotNull(message = "订单ID不能为空")
    private Long orderId;
}

/**
 * 批量订单查询 DTO
 */
@Data
public class BatchOrderQueryDTO {
    /**
     * 订单ID列表
     */
    @NotEmpty(message = "订单ID列表不能为空")
    private List<Long> orderIds;
}

/**
 * 创建订单请求 DTO
 * 供其他服务调用
 */
@Data
public class CreateOrderReqDTO {
    /**
     * 用户ID
     */
    @NotNull(message = "用户ID不能为空")
    private Long userId;

    /**
     * 收货地址ID
     */
    @NotNull(message = "收货地址不能为空")
    private Long addressId;

    /**
     * 订单项列表
     */
    @NotEmpty(message = "订单项不能为空")
    @Valid
    private List<OrderItemDTO> items;

    /**
     * 备注
     */
    private String remark;

    /**
     * 优惠券ID
     */
    private Long couponId;

    /**
     * 来源渠道
     */
    private String channel;

    @Data
    public static class OrderItemDTO {
        @NotNull(message = "商品ID不能为空")
        private Long productId;

        @NotNull(message = "SKU不能为空")
        private Long skuId;

        @NotNull(message = "数量不能为空")
        @Min(value = 1, message = "数量必须大于0")
        private Integer quantity;
    }
}

/**
 * 更新订单状态请求 DTO
 */
@Data
public class UpdateOrderStatusReqDTO {
    /**
     * 订单ID
     */
    @NotNull(message = "订单ID不能为空")
    private Long orderId;

    /**
     * 新状态
     */
    @NotNull(message = "状态不能为空")
    private Integer status;

    /**
     * 操作人
     */
    private String operator;

    /**
     * 备注
     */
    private String remark;
}

/**
 * 检查订单归属 DTO
 */
@Data
public class CheckOrderOwnerDTO {
    /**
     * 订单ID
     */
    @NotNull(message = "订单ID不能为空")
    private Long orderId;

    /**
     * 用户ID
     */
    @NotNull(message = "用户ID不能为空")
    private Long userId;
}

/**
 * 订单详情响应 DTO
 * 返回给调用方的订单详情
 *
 * 注意：相比 VO，DTO 通常：
 * - 不包含格式化后的字符串（如金额、时间）
 * - 使用原始数据类型（如 BigDecimal, LocalDateTime）
 * - 不包含前端展示用的描述字段
 */
@Data
public class OrderDetailRespDTO {
    /**
     * 订单ID
     */
    private Long id;

    /**
     * 订单号
     */
    private String orderNo;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 用户名
     */
    private String userName;

    /**
     * 订单总金额（原始值，不格式化）
     */
    private BigDecimal totalAmount;

    /**
     * 优惠金额
     */
    private BigDecimal discountAmount;

    /**
     * 实付金额
     */
    private BigDecimal paidAmount;

    /**
     * 订单状态（使用数值，不用描述）
     */
    private Integer status;

    /**
     * 订单项列表
     */
    private List<OrderItemDTO> items;

    /**
     * 创建时间（原始值）
     */
    private LocalDateTime createTime;

    /**
     * 支付时间
     */
    private LocalDateTime payTime;

    @Data
    public static class OrderItemDTO {
        private Long productId;
        private String productName;
        private Long skuId;
        private String skuName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal subtotal;
    }
}

/**
 * 订单简要信息响应 DTO
 * 用于列表查询，只包含核心字段
 */
@Data
public class OrderBriefRespDTO {
    /**
     * 订单ID
     */
    private Long id;

    /**
     * 订单号
     */
    private String orderNo;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 订单金额
     */
    private BigDecimal totalAmount;

    /**
     * 订单状态
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
