package com.example.app.order.infrastructure.dataobject;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * PO (Persistent Object) 示例 - 持久化对象
 *
 * 用途：
 * - 与数据库表结构一一对应的实体类
 * - 由 ORM 框架（如 MyBatis Plus）使用
 *
 *
 * 特点：
 * - 纯数据载体，不包含任何业务逻辑
 * - 一个 PO 对应数据库中的一张表
 * - 字段与表列一一对应
 * - 使用 ORM 框架注解（如 @TableName, @TableId）
 * - 使用 Lombok @Data 注解，只生成 getter/setter
 *
 * 使用规则：
 * ✅ 在 Mapper 接口中使用
 * ✅ 在数据层（Repository/DAO）中使用
 * ❌ 不要在 Service 层返回给上层（应该转换为 BO）
 * ❌ 不要在 Controller 层使用
 * ❌ 不允许直接暴露给前端
 * ❌ 不允许包含业务方法（如 validateXxx(), calculateXxx() 等）
 * ❌ 不允许包含数据转换方法
 *
 * 注意：
 * - PO 只负责映射数据库表，不负责业务逻辑
 * - 所有业务逻辑应该在 Service 层实现
 * - PO 不应该包含除 getter/setter 以外的任何方法
 */

// ==================== 订单 PO ====================
@Data
@TableName("t_order")
public class OrderPO {
    /**
     * 主键
     */
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 业务主键ID
     */
    @TableField(value = "biz_key")
    private Long bizKey;

    /**
     * 订单号
     */
    private String orderNo;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 订单总金额
     */
    private BigDecimal totalAmount;

    /**
     * 订单状态：0-待支付，1-已支付，2-已发货，3-已完成，4-已取消
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}

// ==================== 订单项 PO ====================
@Data
@TableName("t_order_item")
public class OrderItemPO {
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 订单ID
     */
    private Long orderId;

    /**
     * 商品ID
     */
    private Long productId;

    /**
     * 商品SKU ID
     */
    private Long skuId;

    /**
     * 商品名称
     */
    private String productName;

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
     * 小计金额
     */
    private BigDecimal subtotal;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}

// ==================== 用户 PO ====================
@Data
@TableName("t_user")
public class UserPO {
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 用户名
     */
    private String userName;

    /**
     * 手机号
     */
    private String phone;

    /**
     * 邮箱
     */
    private String email;

    /**
     * 用户状态：0-禁用，1-启用
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}

// ==================== 商品 PO ====================
@Data
@TableName("t_product")
public class ProductPO {
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 商品名称
     */
    private String productName;

    /**
     * 商品编码
     */
    private String productCode;

    /**
     * 分类ID
     */
    private Long categoryId;

    /**
     * 商品价格
     */
    private BigDecimal price;

    /**
     * 库存数量
     */
    private Integer stock;

    /**
     * 商品状态：0-下架，1-上架
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
