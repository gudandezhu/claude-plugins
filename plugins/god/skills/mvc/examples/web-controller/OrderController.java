package com.example.app.order.api.web.controller;

import com.szjlc.framework.api.base.response.HttpResult;
import com.example.app.order.api.web.OrderApi;
import com.example.app.order.api.web.vo.*;
import com.example.app.order.service.OrderService;
import com.example.app.order.service.bo.OrderBO;
import com.example.app.order.convertor.OrderConvertor;
import lombok.extern.slf4j.Slf4j;
import com.szjlc.framework.api.base.annotation.WebApiController;

import javax.annotation.Resource;
import javax.validation.Valid;
import java.util.List;

/**
 * 订单 Web 控制器
 * 提供给前端页面使用的接口
 *
 * 核心职责：
 * 1. 接收 *ReqVO / *QueryVO 参数
 * 2. 转换为 *BO 调用 Service 层
 * 3. 将 Service 返回的 *BO 转换为 *RespVO
 * 4. 使用 HttpResult<T> 包装响应
 */
@Slf4j
@WebApiController
public class OrderController implements OrderApi {

    @Resource
    private OrderService orderService;

    /**
     * 查询订单列表
     *
     * HTTP 方法：POST（复杂查询使用 POST）
     * 请求参数：OrderQueryVO
     * 响应数据：List<OrderListRespVO>
     */
    @Override
    public HttpResult<List<OrderListRespVO>> listOrders(@Valid @RequestBody OrderQueryVO queryVO) {
        log.info("查询订单列表，参数：{}", queryVO);

        // 1. 转换 QueryVO 为 BO
        OrderBO queryBO = OrderConvertor.INSTANCE.toQueryBO(queryVO);

        // 2. 调用 Service 层
        List<OrderBO> orderBOList = orderService.listOrders(queryBO);

        // 3. 转换 BO 为 RespVO
        List<OrderListRespVO> respVOList = OrderConvertor.INSTANCE.toRespVOList(orderBOList);

        // 4. 包装响应
        return HttpResult.success(respVOList);
    }

    /**
     * 查询订单详情
     *
     * HTTP 方法：GET（简单查询使用 GET）
     * 请求参数：orderId（查询参数，不使用路径变量）
     * 响应数据：OrderDetailRespVO
     * URL: GET /order/detail?orderId=123
     */
    @Override
    public HttpResult<OrderDetailRespVO> getOrderDetail(@RequestParam Long orderId) {
        log.info("查询订单详情，订单ID：{}", orderId);

        // 1. 调用 Service 层
        OrderBO orderBO = orderService.getOrderDetail(orderId);

        // 2. 转换 BO 为 RespVO
        OrderDetailRespVO respVO = OrderConvertor.INSTANCE.toDetailRespVO(orderBO);

        // 3. 包装响应
        return HttpResult.success(respVO);
    }

    /**
     * 创建订单
     *
     * HTTP 方法：POST（添加数据使用 POST）
     * 请求参数：CreateOrderReqVO
     * 响应数据：Long（订单ID）
     */
    @Override
    public HttpResult<Long> createOrder(@Valid @RequestBody CreateOrderReqVO reqVO) {
        log.info("创建订单，参数：{}", reqVO);

        // 1. 转换 ReqVO 为 BO
        OrderBO orderBO = OrderConvertor.INSTANCE.toBO(reqVO);

        // 2. 调用 Service 层
        Long orderId = orderService.createOrder(orderBO);

        // 3. 包装响应
        return HttpResult.success(orderId);
    }

    /**
     * 更新订单状态
     *
     * HTTP 方法：POST（修改数据使用 POST）
     * 请求参数：UpdateOrderStatusReqVO
     * 响应数据：Boolean
     */
    @Override
    public HttpResult<Boolean> updateOrderStatus(@Valid @RequestBody UpdateOrderStatusReqVO reqVO) {
        log.info("更新订单状态，订单ID：{}，新状态：{}", reqVO.getOrderId(), reqVO.getStatus());

        // 1. 转换 ReqVO 为 BO
        OrderBO orderBO = OrderConvertor.INSTANCE.toBO(reqVO);

        // 2. 调用 Service 层
        Boolean result = orderService.updateOrderStatus(orderBO);

        // 3. 包装响应
        return HttpResult.success(result);
    }

    /**
     * 删除订单
     *
     * HTTP 方法：POST（删除数据使用 POST，禁止使用 GET）
     * 请求参数：orderId（查询参数，不使用路径变量）
     * 响应数据：Boolean
     * URL: POST /order/delete?orderId=123
     */
    @Override
    public HttpResult<Boolean> deleteOrder(@RequestParam Long orderId) {
        log.info("删除订单，订单ID：{}", orderId);

        // 1. 调用 Service 层
        Boolean result = orderService.deleteOrder(orderId);

        // 2. 包装响应
        return HttpResult.success(result);
    }

    /**
     * 取消订单
     *
     * HTTP 方法：POST（修改数据使用 POST）
     * 请求参数：orderId（查询参数，不使用路径变量）
     * 响应数据：Boolean
     * URL: POST /order/cancel?orderId=123
     */
    @Override
    public HttpResult<Boolean> cancelOrder(@RequestParam Long orderId) {
        log.info("取消订单，订单ID：{}", orderId);

        // 1. 调用 Service 层
        Boolean result = orderService.cancelOrder(orderId);

        // 2. 包装响应
        return HttpResult.success(result);
    }
}
