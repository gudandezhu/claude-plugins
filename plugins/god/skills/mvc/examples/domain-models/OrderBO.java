package com.example.app.order.service.bo;

import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * BO (Business Object) 示例 - 业务对象
 *
 * 用途：
 * - 封装业务数据的对象，由 Service 层输出
 * - 包含经过处理的业务数据
 *
 *
 * 特点：
 * - 纯数据载体，不包含任何业务逻辑
 * - 业务逻辑应该在 Service 层实现
 * - 可能包含多个 PO 的数据组合
 * - 可能包含计算字段（由 Service 层计算并填充）
 * - 使用 Lombok @Data 注解，只生成 getter/setter
 *
 * 使用规则：
 * ✅ 在 Service 层内部使用
 * ✅ 作为 Service 方法的返回值
 * ❌ 不允许直接传递给前端（需要转换为 VO/DTO）
 * ❌ 不允许包含业务方法（如 calculateXxx(), canXxx() 等）
 * ❌ 不允许包含数据转换方法
 *
 * 注意：
 * - 所有计算、验证、转换等业务逻辑必须在 Service 层实现
 * - BO 只负责承载数据，不负责处理数据
 */

// ==================== 订单 BO ====================
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderBO {
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
     * 用户名（来自用户表，组合数据）
     */
    private String userName;

    /**
     * 用户手机号（来自用户表）
     */
    private String userPhone;

    /**
     * 订单总金额（由 Service 计算并填充）
     */
    private BigDecimal totalAmount;

    /**
     * 优惠金额（由 Service 计算并填充）
     */
    private BigDecimal discountAmount;

    /**
     * 实付金额（由 Service 计算并填充）
     */
    private BigDecimal paidAmount;

    /**
     * 订单状态码
     */
    private Integer status;

    /**
     * 订单状态描述（由 Service 翻译）
     */
    private String statusDesc;

    /**
     * 订单项列表（包含子对象）
     */
    private List<OrderItemBO> items;

    /**
     * 收货地址信息（聚合数据）
     */
    private AddressBO address;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 支付时间
     */
    private LocalDateTime payTime;

    // ==================== 内部类：订单项 BO ====================
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemBO {
        /**
         * 订单项ID
         */
        private Long id;

        /**
         * 商品ID
         */
        private Long productId;

        /**
         * 商品名称
         */
        private String productName;

        /**
         * SKU ID
         */
        private Long skuId;

        /**
         * SKU名称
         */
        private String skuName;

        /**
         * 购买数量
         */
        private Integer quantity;

        /**
         * 商品单价
         */
        private BigDecimal unitPrice;

        /**
         * 小计金额（由 Service 计算并填充）
         */
        private BigDecimal subtotal;

        /**
         * 商品图片
         */
        private String productImage;
    }
}

// ==================== 地址 BO ====================
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class AddressBO {
    private Long id;
    private String receiverName;
    private String receiverPhone;
    private String province;
    private String city;
    private String district;
    private String detailAddress;

    /**
     * 完整地址（由 Service 拼接并填充）
     */
    private String fullAddress;
}

// ==================== 用户 BO ====================
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class UserBO {
    private Long id;
    private String userName;
    private String phone;
    private String email;
    private Integer status;
    private String statusDesc;
}

// ==================== 分页查询结果 BO ====================
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class PageBO<T> {
    /**
     * 当前页码
     */
    private Integer pageNum;

    /**
     * 每页大小
     */
    private Integer pageSize;

    /**
     * 总记录数
     */
    private Long total;

    /**
     * 总页数（由 Service 计算）
     */
    private Integer pages;

    /**
     * 数据列表
     */
    private List<T> list;

    /**
     * 是否有下一页（由 Service 计算）
     */
    private Boolean hasNextPage;
}
