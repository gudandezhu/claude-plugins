# Controller 层单元测试

适用于 Spring MVC Controller 类的单元测试，重点验证请求入参是否合法，而非验证用户登录状态。

## 技术栈

Mockito、JUnit 5、Spring Boot Test

## 类注解配置

```java
@AutoConfigureMockMvc
@ExtendWith(JlcSpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
```

**成员变量**:`@Autowired MockMvc mockMvc;`

## 测试目标

**核心目标**:验证 Controller 的请求入参是否符合验证注解规则（如 `@NotNull`、`@Size` 等），而非验证用户认证。

## 认证绕过策略

当测试返回的响应 `code == 460` 时，表示未通过用户认证。此时需要 Mock 认证相关类，绕过用户认证校验：

### 策略 1: Mock SessionUtil（静态方法）

适用于使用 `SessionUtil.getSessionUser()` 的 Controller：

```java
private MockedStatic<SessionUtil> mockedSessionUtil;

@BeforeEach
void setUp() {
    mockedSessionUtil = Mockito.mockStatic(SessionUtil.class);
    mockedSessionUtil.when(() -> SessionUtil.getSessionUser(any(HttpServletRequest.class)))
        .thenReturn(createMockUser());
}

@AfterEach
void tearDown() {
    if (mockedSessionUtil != null) {
        mockedSessionUtil.close();
    }
}

private Object createMockUser() {
    // 返回模拟用户对象
    return new Object();
}
```

### 策略 2: Mock ApiAuthorizationInterceptor（对象）

适用于使用 `ApiAuthorizationInterceptor` 的 Controller：

```java
@MockBean
private ApiAuthorizationInterceptor apiAuthorizationInterceptor;

@BeforeEach
void setUp() {
    when(apiAuthorizationInterceptor.preHandle(any(), any(), any()))
        .thenReturn(true);
}
```

### 选择策略

**如何判断使用哪种策略**:
1. 先运行测试，检查响应 `code` 是否为 460
2. 如果是 460，检查 Controller 代码：
   - 如果使用了 `SessionUtil.getSessionUser()` → 使用策略 1
   - 如果注入了 `ApiAuthorizationInterceptor` → 使用策略 2
3. 也可以两种策略都尝试，看哪种有效

## 响应断言

响应体反序列化为 `com.szjlc.framework.api.base.response.HttpResult<T>`

- **成功**: `code == 200`
- **失败**: `code != 200`（如参数验证失败）
- **未认证**: `code == 460`（需要添加认证绕过策略）

## 完整示例

### 示例 1: 基本测试（无认证）

```java
package com.szjlc.ai.manage.mcp.controller;

import com.szjlc.ai.manage.mcp.req.CreateMcpGatewayReq;
import com.szjlc.framework.api.base.response.HttpResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.result.MockMvcResultHandlers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.szjlc.commons.utils.JsonUtils.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 由AI自动生成
 */
@AutoConfigureMockMvc
@ExtendWith(com.szjlc.framework.app.base.test.JlcSpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class McpGatewayControllerAiTest {

    @Autowired
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        // 公共桩代码
    }

    @AfterEach
    void tearDown() {
        // 清理资源
    }

    @Test
    void testCreate_Success() throws Exception {
        CreateMcpGatewayReq req = new CreateMcpGatewayReq();
        req.setName("test-gateway");
        req.setEndpoint("http://test.com");

        MvcResult result = mockMvc.perform(post("/api/gateway")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(req)))
                .andExpect(status().isOk())
                .andReturn();

        HttpResult<?> response = fromJson(result.getResponse().getContentAsString(), HttpResult.class);
        assertEquals(200, response.getCode());
    }

    @Test
    void testCreate_WithNullName() throws Exception {
        CreateMcpGatewayReq req = new CreateMcpGatewayReq();
        // name 为 null，违反 @NotNull 注解
        req.setEndpoint("http://test.com");

        MvcResult result = mockMvc.perform(post("/api/gateway")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(req)))
                .andExpect(status().isOk())
                .andDo(MockMvcResultHandlers.print())  // 打印响应详情，便于调试
                .andReturn();

        HttpResult<?> response = fromJson(result.getResponse().getContentAsString(), HttpResult.class);
        assertNotEquals(200, response.getCode());
    }
}
```

### 示例 2: 带认证绕过的测试（SessionUtil）

```java
package com.szjlc.erp.controller;

import com.szjlc.framework.api.base.response.HttpResult;
import com.szjlc.erp.component.base.utils.SessionUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.result.MockMvcResultHandlers;

import jakarta.servlet.http.HttpServletRequest;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.szjlc.commons.utils.JsonUtils.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 由AI自动生成
 */
@AutoConfigureMockMvc
@ExtendWith(com.szjlc.framework.app.base.test.JlcSpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ErpDataControllerAiTest {

    @Autowired
    private MockMvc mockMvc;

    private MockedStatic<SessionUtil> mockedSessionUtil;

    @BeforeEach
    void setUp() {
        // Mock SessionUtil 绕过用户认证
        mockedSessionUtil = Mockito.mockStatic(SessionUtil.class);
        mockedSessionUtil.when(() -> SessionUtil.getSessionUser(any(HttpServletRequest.class)))
            .thenReturn(createMockUser());
    }

    @AfterEach
    void tearDown() {
        if (mockedSessionUtil != null) {
            mockedSessionUtil.close();
        }
    }

    @Test
    void testQuery_Success() throws Exception {
        MvcResult result = mockMvc.perform(get("/erp/data")
                .param("id", "123"))
                .andExpect(status().isOk())
                .andReturn();

        HttpResult<?> response = fromJson(result.getResponse().getContentAsString(), HttpResult.class);
        assertEquals(200, response.getCode());
    }

    @Test
    void testQuery_WithInvalidId() throws Exception {
        MvcResult result = mockMvc.perform(get("/erp/data")
                .param("id", ""))  // 空字符串，违反验证规则
                .andExpect(status().isOk())
                .andDo(MockMvcResultHandlers.print())  // 打印响应详情，便于调试
                .andReturn();

        HttpResult<?> response = fromJson(result.getResponse().getContentAsString(), HttpResult.class);
        assertNotEquals(200, response.getCode());
    }

    private Object createMockUser() {
        // 返回模拟用户对象，具体根据实际 User 类型调整
        return new Object();
    }
}
```

### 示例 3: 带认证绕过的测试（ApiAuthorizationInterceptor）

```java
package com.szjlc.svc.controller;

import com.szjlc.framework.api.base.response.HttpResult;
import com.szjlc.framework.api.base.security.ApiAuthorizationInterceptor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.result.MockMvcResultHandlers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.szjlc.commons.utils.JsonUtils.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 由AI自动生成
 */
@AutoConfigureMockMvc
@ExtendWith(com.szjlc.framework.app.base.test.JlcSpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SvcApiControllerAiTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ApiAuthorizationInterceptor apiAuthorizationInterceptor;

    @BeforeEach
    void setUp() {
        // Mock ApiAuthorizationInterceptor 绕过用户认证
        when(apiAuthorizationInterceptor.preHandle(any(), any(), any()))
            .thenReturn(true);
    }

    @AfterEach
    void tearDown() {
        // 清理资源
    }

    @Test
    void testUpdate_Success() throws Exception {
        UpdateReq req = new UpdateReq();
        req.setId(123L);
        req.setName("test");

        MvcResult result = mockMvc.perform(put("/svc/data")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(req)))
                .andExpect(status().isOk())
                .andReturn();

        HttpResult<?> response = fromJson(result.getResponse().getContentAsString(), HttpResult.class);
        assertEquals(200, response.getCode());
    }

    @Test
    void testUpdate_WithNullId() throws Exception {
        UpdateReq req = new UpdateReq();
        // id 为 null，违反 @NotNull 注解
        req.setName("test");

        MvcResult result = mockMvc.perform(put("/svc/data")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(req)))
                .andExpect(status().isOk())
                .andDo(MockMvcResultHandlers.print())  // 打印响应详情，便于调试
                .andReturn();

        HttpResult<?> response = fromJson(result.getResponse().getContentAsString(), HttpResult.class);
        assertNotEquals(200, response.getCode());
    }
}
```

## 测试方法设计

1. **成功场景**:构造符合验证规则的请求参数，断言 `code == 200`
2. **失败场景**:构造违反验证规则的请求参数（如 null、空字符串、超出长度等），断言 `code != 200`
3. **边界场景**:测试边界值（如 `@Size(min=1, max=100)` 的最小值和最大值）

## 调试技巧：打印响应结果

在测试失败场景（参数验证失败）时，建议添加 `.andDo(MockMvcResultHandlers.print())` 来打印详细的响应信息，便于调试和验证错误原因。

**示例**:
```java
@Test
void testCreate_WithNullName() throws Exception {
    CreateAccessTokenReq req = new CreateAccessTokenReq();
    // name 为 null，违反 @NotBlank 注解
    req.setPermissions(Arrays.asList(TokenPermission.READ_DOCUMENT));

    MvcResult result = mockMvc.perform(post("/tokens/create")
            .contentType(MediaType.APPLICATION_JSON)
            .content(JsonUtils.toJson(req)))
            .andExpect(status().isOk())
            .andDo(MockMvcResultHandlers.print())  // 打印响应详情
            .andReturn();

    String responseBody = result.getResponse().getContentAsString();
    HttpResult<?> response = JsonUtils.fromJson(responseBody, HttpResult.class);

    // 参数验证失败，应该返回非 200 的 code
    assertNotEquals(200, response.getCode());
}
```

**输出效果**:
```
MockHttpServletRequest:
      HTTP Method = POST
      Request URI = /tokens/create
       Parameters = {}
          Headers = [Content-Type:"application/json"]
             Body = {"permissions":["READ_DOCUMENT"]}
    Session Attrs = {}

Handler:
             Type = com.szjlc.ai.doc.controller.AccessTokenController
           Method = public com.szjlc.framework.api.base.response.HttpResult<java.lang.String> com.szjlc.ai.doc.controller.AccessTokenController.create(com.szjlc.ai.doc.req.CreateAccessTokenReq)

Async:
    Async started = false
     Async result = null

Resolved Exception:
             Type = org.springframework.validation.BindException

ModelAndView:
        View name = null
             View = null
            Model = null

FlashMap:
       Attributes = null

MockHttpServletResponse:
           Status = 200
    Error message = null
          Headers = [Content-Type:"application/json;charset=UTF-8"]
     Content type = application/json;charset=UTF-8
             Body = {"code":400,"msg":"参数验证失败: name不能为空","data":null}
    Forwarded URL = null
   Redirected URL = null
          Cookies = []
```

**使用建议**:
- ✅ 在**参数验证失败**的测试用例中使用，查看具体的错误信息
- ✅ 在**调试复杂场景**时使用，了解完整的请求和响应信息
- ❌ 不需要在**成功的测试用例**中使用，避免控制台输出过多
- ❌ 不需要在**所有测试用例**中使用，只在需要查看响应详情时添加

**必须导入**:
```java
import org.springframework.test.web.servlet.result.MockMvcResultHandlers;
```

## 注意事项

1. **优先测试入参验证**:Controller 测试的核心是验证入参合法性，而非业务逻辑
2. **认证绕过**:遇到 `code == 460` 时，使用认证绕过策略，不要让认证问题干扰参数验证测试
3. **Mock 必要的依赖**:只 Mock 必要的认证相关类和外部依赖，不要过度 Mock
4. **验证所有分支**:确保测试覆盖正常参数、异常参数、边界值等各种场景
5. **打印响应详情**:在失败场景中使用 `.andDo(MockMvcResultHandlers.print())` 便于调试
