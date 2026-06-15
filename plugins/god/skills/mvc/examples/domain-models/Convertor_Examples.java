package com.example.app.order.convertor;

import com.example.app.order.api.web.vo.*;
import com.example.app.order.api.feign.dto.*;
import com.example.app.order.service.bo.*;
import com.example.app.order.infrastructure.dataobject.*;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Mappings;
import org.mapstruct.factory.Mappers;

import java.util.List;

/**
 * 对象转换器示例 - 使用 MapStruct
 *
 * 用途：
 * - 负责不同层次模型之间的转换
 * - 使用 MapStruct 自动生成转换代码
 *
 * 定义位置：convertor 包
 *
 * 使用规则：
 * ✅ 使用 MapStruct 注解自动生成转换代码
 * ✅ 定义清晰的转换方法
 * ✅ 处理字段映射差异
 * ✅ 支持 List 批量转换
 */

@Mapper(componentModel = "spring")
public interface OrderConvertor {

    OrderConvertor INSTANCE = Mappers.getMapper(OrderConvertor.class);

    // ==================== PO -> BO ====================

    /**
     * 订单 PO -> BO
     */
    OrderBO toBO(OrderPO po);

    /**
     * 订单项 PO -> BO
     */
    OrderBO.OrderItemBO toBO(OrderItemPO po);

    /**
     * 批量转换：订单项 PO List -> BO List
     */
    List<OrderBO.OrderItemBO> toItemBOList(List<OrderItemPO> poList);

    // ==================== VO -> BO ====================

    /**
     * 创建订单请求 VO -> BO
     */
    @Mappings({
        @Mapping(target = "id", ignore = true),
        @Mapping(target = "orderNo", ignore = true),
        @Mapping(target = "status", constant = "0"),
        @Mapping(target = "createTime", ignore = true),
        @Mapping(target = "items", source = "items")
    })
    OrderBO toBO(CreateOrderReqVO reqVO);

    /**
     * 订单项 VO -> BO
     */
    OrderBO.OrderItemBO toBO(CreateOrderReqVO.OrderItemVO itemVO);

    /**
     * 查询条件 VO -> BO
     */
    OrderBO toQueryBO(OrderQueryVO queryVO);

    // ==================== BO -> VO ====================

    /**
     * 订单详情 BO -> RespVO
     *
     * 注意：金额和时间需要格式化为字符串
     */
    @Mappings({
        @Mapping(target = "totalAmount", expression = "java(formatAmount(bo.getTotalAmount()))"),
        @Mapping(target = "paidAmount", expression = "java(formatAmount(bo.getPaidAmount()))"),
        @Mapping(target = "createTime", expression = "java(formatDateTime(bo.getCreateTime()))"),
        @Mapping(target = "payTime", expression = "java(formatDateTime(bo.getPayTime()))")
    })
    OrderDetailRespVO toRespVO(OrderBO bo);

    /**
     * 订单列表 BO -> List RespVO
     */
    OrderListRespVO toListRespVO(OrderBO bo);

    /**
     * 批量转换：BO List -> RespVO List
     */
    List<OrderListRespVO> toRespVOList(List<OrderBO> boList);

    /**
     * 订单项 BO -> RespVO
     */
    OrderDetailRespVO.OrderItemVO toRespVO(OrderBO.OrderItemBO itemBO);

    // ==================== DTO -> BO ====================

    /**
     * 创建订单请求 DTO -> BO（Feign 接口）
     */
    @Mappings({
        @Mapping(target = "id", ignore = true),
        @Mapping(target = "orderNo", ignore = true),
        @Mapping(target = "status", constant = "0")
    })
    OrderBO toBO(CreateOrderReqDTO reqDTO);

    /**
     * 订单项 DTO -> BO
     */
    OrderBO.OrderItemBO toBO(CreateOrderReqDTO.OrderItemDTO itemDTO);

    /**
     * 查询条件 DTO -> BO
     */
    OrderBO toQueryBO(OrderQueryDTO queryDTO);

    // ==================== BO -> DTO ====================

    /**
     * 订单详情 BO -> RespDTO（Feign 接口）
     *
     * 注意：DTO 不需要格式化，保持原始类型
     */
    OrderDetailRespDTO toRespDTO(OrderBO bo);

    /**
     * 批量转换：BO List -> RespDTO List
     */
    List<OrderDetailRespDTO> toRespDTOList(List<OrderBO> boList);

    /**
     * 订单项 BO -> RespDTO
     */
    OrderDetailRespDTO.OrderItemDTO toRespDTO(OrderBO.OrderItemBO itemBO);

    // ==================== 辅助方法 ====================

    /**
     * 格式化金额
     */
    default String formatAmount(java.math.BigDecimal amount) {
        if (amount == null) {
            return "¥0.00";
        }
        return "¥" + amount.setScale(2, java.math.RoundingMode.HALF_UP).toString();
    }

    /**
     * 格式化日期时间
     */
    default String formatDateTime(java.time.LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        return dateTime.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}

/**
 * 使用示例：
 *
 * // 1. VO -> BO
 * OrderBO orderBO = OrderConvertor.INSTANCE.toBO(createOrderReqVO);
 *
 * // 2. BO -> VO
 * OrderDetailRespVO respVO = OrderConvertor.INSTANCE.toRespVO(orderBO);
 *
 * // 3. DTO -> BO
 * OrderBO orderBO = OrderConvertor.INSTANCE.toBO(createOrderReqDTO);
 *
 * // 4. BO -> DTO
 * OrderDetailRespDTO respDTO = OrderConvertor.INSTANCE.toRespDTO(orderBO);
 *
 * // 5. List 转换
 * List<OrderListRespVO> voList = OrderConvertor.INSTANCE.toRespVOList(orderBOList);
 */
