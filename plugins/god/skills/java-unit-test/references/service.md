# Service 层单元测试

适用于 Service 接口实现类的单元测试，验证业务逻辑是否符合预期。

## 技术栈

Mockito、JUnit 5、Spring Boot Test

## 类注解配置

```java
@ExtendWith(com.szjlc.framework.app.base.test.JlcSpringRunner.class)
@SpringBootTest(classes = ${testTarget}.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
```

## 特殊 Mock 要求

1. **必须 Mock**:`@MockBean com.szjlc.framework.auditlog.client.core.log.AuditLogClient auditLogClient;`
2. **禁止 Mock**:`StringUtils` 等基本工具类

## 响应断言

响应体反序列化为 `com.szjlc.framework.api.base.response.HttpResult<T>`

## 示例

```java
package com.szjlc.ai.manage.mcp.service.impl;

import com.szjlc.ai.manage.mcp.req.CreateMcpGatewayReq;
import com.szjlc.ai.manage.mcp.service.McpGatewayService;
import com.szjlc.framework.api.base.response.HttpResult;
import com.szjlc.framework.auditlog.client.core.log.AuditLogClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 由AI自动生成
 */
@ExtendWith(com.szjlc.framework.app.base.test.JlcSpringRunner.class)
@SpringBootTest(classes = McpGatewayServiceImpl.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class McpGatewayServiceImplAiTest {

    @Autowired
    private McpGatewayService mcpGatewayService;

    @MockBean
    private AuditLogClient auditLogClient;

    @MockBean
    private McpGatewayDao mcpGatewayDao;

    @BeforeEach
    void setUp() {
        when(mcpGatewayDao.insert(any())).thenReturn(1);
    }

    @AfterEach
    void tearDown() {
        // 清理资源
    }

    @Test
    void testCreate_Success() {
        CreateMcpGatewayReq req = new CreateMcpGatewayReq();
        req.setName("test-gateway");
        req.setEndpoint("http://test.com");

        HttpResult<Void> result = mcpGatewayService.create(req);

        assertEquals(200, result.getCode());
        verify(mcpGatewayDao, times(1)).insert(any());
    }
}
```
