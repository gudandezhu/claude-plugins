package com.example.app.order.api.web.vo;

import lombok.Data;
import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * VO (View Object) 示例 - 展示层对象
 *
 * 用途：
 * - 专门用于 Web 层的请求和响应
 * - 与前端页面或 API 契约对应
 * - 可能包含前端特定的字段格式化
 *
 *
 * 特点：
 * - 纯数据载体，不包含任何业务逻辑
 * - 分为 ReqVO（请求）和 RespVO（响应）
 * - ReqVO 包含验证注解
 * - RespVO 包含格式化字段（金额、时间等）
 * - 使用 Lombok @Data 注解，只生成 getter/setter
 *
 * 使用规则：
 * ✅ 在 Web Controller 中使用
 * ✅ 作为 Controller 方法的参数和返回值
 * ⚠️ 在调用 Service 前必须转换为 BO
 * ❌ 不要在 Service 层中使用
 * ❌ 不允许包含业务方法（如 validateXxx(), formatXxx() 等）
 * ❌ 不允许包含数据转换方法
 *
 * 注意：
 * - 所有格式化、验证逻辑应该在 Controller 或 Convertor 中实现
 * - VO 只负责承载数据，不负责处理数据
 * - 字段格式化（如金额、时间）应该在 Convertor 中完成
 */

// ==================== 查询 VO ====================

/**
 * 订单查询 VO（特殊的 ReqVO）
 * 用于接收查询参数
 */
@Data
public class OrderQueryVO {
    /**
     * 订单号
     */
    private String orderNo;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 订单状态：0-待支付，1-已支付，2-已发货，3-已完成，4-已取消
     */
    private Integer status;

    /**
     * 开始时间
     */
    private LocalDateTime startTime;

    /**
     * 结束时间
     */
    private LocalDateTime endTime;

    /**
     * 页码（从1开始）
     */
    private Integer pageNum = 1;

    /**
     * 每页大小
     */
    private Integer pageSize = 10;
}

// ==================== 请求 VO ====================

/**
 * 创建订单请求 VO
 */
@Data
public class CreateOrderReqVO {
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
    private List<OrderItemVO> items;

    /**
     * 订单备注
     */
    @Size(max = 500, message = "备注长度不能超过500")
    private String remark;

    /**
     * 优惠券ID
     */
    private Long couponId;

    @Data
    public static class OrderItemVO {
        /**
         * 商品ID
         */
        @NotNull(message = "商品ID不能为空")
        private Long productId;

        /**
         * 商品SKU ID
         */
        @NotNull(message = "SKU不能为空")
        private Long skuId;

        /**
         * 购买数量
         */
        @NotNull(message = "数量不能为空")
        @Min(value = 1, message = "数量必须大于0")
        private Integer quantity;
    }
}

/**
 * 更新订单状态请求 VO
 */
@Data
public class UpdateOrderStatusReqVO {
    /**
     * 订单ID
     */
    @NotNull(message = "订单ID不能为空")
    private Long orderId;

    /**
     * 新状态
     */
    @NotNull(message = "状态不能为空")
    @Min(value = 0, message = "状态值无效")
    @Max(value = 4, message = "状态值无效")
    private Integer status;

    /**
     * 备注
     */
    private String remark;
}

// ==================== 响应 VO ====================

/**
 * 订单列表响应 VO
 * 用于返回订单列表数据
 *
 * 注意：字段都是格式化后的字符串，便于前端直接展示
 */
@Data
public class OrderListRespVO {
    /**
     * 订单ID
     */
    private Long id;

    /**
     * 订单号
     */
    private String orderNo;

    /**
     * 用户名
     */
    private String userName;

    /**
     * 订单总金额（格式化后的字符串）
     */
    private String totalAmount;

    /**
     * 订单状态码
     */
    private String status;

    /**
     * 订单状态描述
     */
    private String statusDesc;

    /**
     * 商品数量
     */
    private Integer itemCount;

    /**
     * 创建时间（格式化后的字符串）
     */
    private String createTime;
}

/**
 * 订单详情响应 VO
 * 用于返回订单详情数据
 *
 * 注意：字段都是格式化后的字符串，便于前端直接展示
 */
@Data
public class OrderDetailRespVO {
    /**
     * 订单ID
     */
    private Long id;

    /**
     * 订单号
     */
    private String orderNo;

    /**
     * 用户信息
     */
    private UserInfo userInfo;

    /**
     * 收货地址信息
     */
    private AddressInfo addressInfo;

    /**
     * 订单金额（格式化后）
     */
    private String totalAmount;

    /**
     * 优惠金额（格式化后）
     */
    private String discountAmount;

    /**
     * 实付金额（格式化后）
     */
    private String paidAmount;

    /**
     * 订单状态码
     */
    private String status;

    /**
     * 订单状态描述
     */
    private String statusDesc;

    /**
     * 订单项列表
     */
    private List<OrderItemVO> items;

    /**
     * 优惠券信息
     */
    private CouponInfo couponInfo;

    /**
     * 订单备注
     */
    private String remark;

    /**
     * 创建时间（格式化后）
     */
    private String createTime;

    /**
     * 支付时间（格式化后）
     */
    private String payTime;

    /**
     * 发货时间（格式化后）
     */
    private String deliveryTime;

    /**
     * 完成时间（格式化后）
     */
    private String completeTime;

    @Data
    public static class UserInfo {
        private Long userId;
        private String userName;
        private String userPhone;
    }

    @Data
    public static class AddressInfo {
        private String receiverName;
        private String receiverPhone;
        private String province;
        private String city;
        private String district;
        private String detailAddress;
    }

    @Data
    public static class OrderItemVO {
        private Long productId;
        private String productName;
        private String productImage;
        private String skuName;
        private Integer quantity;
        private String unitPrice;  // 格式化后的单价
        private String subtotal;    // 格式化后的小计
    }

    @Data
    public static class CouponInfo {
        private Long couponId;
        private String couponName;
        private String discountAmount;
    }
}

/**
 * 使用示例：
 *
 * // 1. Controller 接收 ReqVO
 * @PostMapping("/create")
 * public HttpResult<Long> createOrder(@Valid @RequestBody CreateOrderReqVO reqVO) {
 *     // 转换为 BO
 *     OrderBO orderBO = OrderConvertor.INSTANCE.toBO(reqVO);
 *     // 调用 Service
 *     Long orderId = orderService.createOrder(orderBO);
 *     return HttpResult.success(orderId);
 * }
 *
 * // 2. Controller 返回 RespVO
 * @GetMapping("/detail")
 * public HttpResult<OrderDetailRespVO> getOrderDetail(@RequestParam Long orderId) {
 *     // 调用 Service 获取 BO
 *     OrderBO orderBO = orderService.getOrderDetail(orderId);
 *     // 转换为 RespVO
 *     OrderDetailRespVO respVO = OrderConvertor.INSTANCE.toRespVO(orderBO);
 *     return HttpResult.success(respVO);
 * }
 */
