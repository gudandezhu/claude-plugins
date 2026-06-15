package com.example.app.order.api.feign.controller;

import com.szjlc.framework.api.base.response.HttpResult;
import com.example.app.order.api.feign.OrderBizApi;
import com.example.app.order.api.feign.dto.*;
import com.example.app.order.service.OrderService;
import com.example.app.order.service.bo.OrderBO;
import com.example.app.order.convertor.OrderConvertor;
import lombok.extern.slf4j.Slf4j;
import com.szjlc.framework.api.base.annotation.ApiController;

import javax.annotation.Resource;
import javax.validation.Valid;
import java.util.List;

/**
 * 订单 API 控制器
 * 提供给其他微服务调用的接口（通过 Feign）
 *
 * 核心职责：
 * 1. 接收 *ReqDTO / *QueryDTO 参数
 * 2. 转换为 *BO 调用 Service 层
 * 3. 将 Service 返回的 *BO 转换为 *RespDTO
 * 4. 使用 HttpResult<T> 包装响应
 *
 * 注意：
 * - API 控制器使用 @ApiController 注解
 * - 接口定义在 OrderBizApi 中
 * - Service 层不应依赖 DTO，必须转换为 BO
 */
@Slf4j
@ApiController
public class OrderBizController implements OrderBizApi {

    @Resource
    private OrderService orderService;

    /**
     * 根据用户ID查询订单列表
     *
     * HTTP 方法：POST（跨服务调用统一使用 POST）
     * 请求参数：UserOrderQueryDTO
     * 响应数据：List<OrderDetailRespDTO>
     */
    @Override
    public HttpResult<List<OrderDetailRespDTO>> queryOrdersByUserId(@Valid @RequestBody UserOrderQueryDTO queryDTO) {
        log.info("API调用：查询用户订单列表，用户ID：{}", queryDTO.getUserId());

        // 1. 转换 QueryDTO 为 BO
        OrderBO queryBO = OrderConvertor.INSTANCE.toQueryBO(queryDTO);

        // 2. 调用 Service 层
        List<OrderBO> orderBOList = orderService.listOrdersByUserId(queryBO);

        // 3. 转换 BO 为 RespDTO
        List<OrderDetailRespDTO> respDTOList = OrderConvertor.INSTANCE.toRespDTOList(orderBOList);

        // 4. 包装响应
        return HttpResult.success(respDTOList);
    }

    /**
     * 查询订单详情
     *
     * HTTP 方法：POST（跨服务调用统一使用 POST）
     * 请求参数：OrderQueryDTO
     * 响应数据：OrderDetailRespDTO
     */
    @Override
    public HttpResult<OrderDetailRespDTO> getOrderDetail(@Valid @RequestBody OrderQueryDTO queryDTO) {
        log.info("API调用：查询订单详情，订单ID：{}", queryDTO.getOrderId());

        // 1. 调用 Service 层
        OrderBO orderBO = orderService.getOrderDetail(queryDTO.getOrderId());

        // 2. 转换 BO 为 RespDTO
        OrderDetailRespDTO respDTO = OrderConvertor.INSTANCE.toDetailRespDTO(orderBO);

        // 3. 包装响应
        return HttpResult.success(respDTO);
    }

    /**
     * 创建订单（供其他服务调用）
     *
     * HTTP 方法：POST
     * 请求参数：CreateOrderReqDTO
     * 响应数据：Long（订单ID）
     */
    @Override
    public HttpResult<Long> createOrder(@Valid @RequestBody CreateOrderReqDTO reqDTO) {
        log.info("API调用：创建订单，用户ID：{}", reqDTO.getUserId());

        // 1. 转换 ReqDTO 为 BO
        OrderBO orderBO = OrderConvertor.INSTANCE.toBO(reqDTO);

        // 2. 调用 Service 层
        Long orderId = orderService.createOrder(orderBO);

        // 3. 包装响应
        return HttpResult.success(orderId);
    }

    /**
     * 批量查询订单
     *
     * HTTP 方法：POST
     * 请求参数：BatchOrderQueryDTO（包含订单ID列表）
     * 响应数据：List<OrderDetailRespDTO>
     */
    @Override
    public HttpResult<List<OrderDetailRespDTO>> batchGetOrders(@Valid @RequestBody BatchOrderQueryDTO queryDTO) {
        log.info("API调用：批量查询订单，订单数量：{}", queryDTO.getOrderIds().size());

        // 1. 调用 Service 层
        List<OrderBO> orderBOList = orderService.batchGetOrders(queryDTO.getOrderIds());

        // 2. 转换 BO 为 RespDTO
        List<OrderDetailRespDTO> respDTOList = OrderConvertor.INSTANCE.toRespDTOList(orderBOList);

        // 3. 包装响应
        return HttpResult.success(respDTOList);
    }

    /**
     * 更新订单状态（供其他服务调用）
     *
     * HTTP 方法：POST
     * 请求参数：UpdateOrderStatusReqDTO
     * 响应数据：Boolean
     */
    @Override
    public HttpResult<Boolean> updateOrderStatus(@Valid @RequestBody UpdateOrderStatusReqDTO reqDTO) {
        log.info("API调用：更新订单状态，订单ID：{}，新状态：{}", reqDTO.getOrderId(), reqDTO.getStatus());

        // 1. 转换 ReqDTO 为 BO
        OrderBO orderBO = OrderConvertor.INSTANCE.toBO(reqDTO);

        // 2. 调用 Service 层
        Boolean result = orderService.updateOrderStatus(orderBO);

        // 3. 包装响应
        return HttpResult.success(result);
    }

    /**
     * 检查订单是否属于指定用户
     *
     * HTTP 方法：POST
     * 请求参数：CheckOrderOwnerDTO
     * 响应数据：Boolean
     */
    @Override
    public HttpResult<Boolean> checkOrderOwner(@Valid @RequestBody CheckOrderOwnerDTO queryDTO) {
        log.info("API调用：检查订单归属，订单ID：{}，用户ID：{}", queryDTO.getOrderId(), queryDTO.getUserId());

        // 1. 调用 Service 层
        Boolean isOwner = orderService.checkOrderOwner(queryDTO.getOrderId(), queryDTO.getUserId());

        // 2. 包装响应
        return HttpResult.success(isOwner);
    }
}
