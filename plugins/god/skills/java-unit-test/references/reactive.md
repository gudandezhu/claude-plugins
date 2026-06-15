# 响应式编程单元测试

适用于使用 Reactor 响应式编程的类(方法返回 `Mono` 或 `Flux`)的单元测试，验证逻辑是否符合期。

## 技术栈

Mockito、JUnit 5、reactor-test

## 类注解配置

```java
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
```

## 断言方式

**使用 `StepVerifier`**(来自 `reactor-test` 包),而非 JUnit Assertions。

## StepVerifier 常用模式

### 验证 Mono 成功场景
```java
StepVerifier.create(monoResult)
    .expectNext(expectedValue)  // 验证下一个元素
    .verifyComplete();          // 验证流正常完成
```

### 验证空 Mono
```java
StepVerifier.create(monoResult)
    .verifyComplete();  // 直接验证完成,无元素
```

### 验证 Flux 多个元素
```java
StepVerifier.create(fluxResult)
    .expectNext(value1, value2, value3)  // 验证多个元素
    .verifyComplete();
```

### 验证元素数量
```java
StepVerifier.create(fluxResult)
    .expectNextCount(3)  // 期望接下来有 3 个元素
    .verifyComplete();
```

### 验证错误场景
```java
StepVerifier.create(monoResult)
    .expectError(ExpectedException.class)  // 验证抛出指定类型的异常
    .verify();
```

## 示例

```java
package com.szjlc.gateway.server.filter;

import com.szjlc.gateway.server.common.Constants;
import org.junit.jupiter.api.TestInstance;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import com.szjlc.gateway.server.flowcontrol.support.ReactiveDuplexPathTrie;
import com.szjlc.gateway.server.route.LiteDomain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpResponse;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 由AI自动生成
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CollectPathWebFilterAiTest {

    private ReactiveDuplexPathTrie duplexPathTrie;
    private CollectPathWebFilter filter;
    private ServerWebExchange exchange;
    private LiteDomain domain;

    @BeforeEach
    void setUp() {
        duplexPathTrie = Mockito.mock(ReactiveDuplexPathTrie.class);
        filter = new CollectPathWebFilter(duplexPathTrie);
        exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/test").build());
        domain = new LiteDomain("test-domain", true, false);
        exchange.getAttributes().put(Constants.ATTR_DOMAIN, domain);
    }

    @Test
    void filter_shouldRecordPathOnSuccessResponse() {
        MockServerHttpResponse response = (MockServerHttpResponse) exchange.getResponse();
        response.setStatusCode(HttpStatus.OK);

        Mono<Void> result = filter.filter(exchange, chain -> Mono.empty());

        StepVerifier.create(result)
                .verifyComplete();

        verify(duplexPathTrie).insert("test-domain", "/test");
    }
}
```
