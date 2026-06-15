---
name: mvc
user-invocable: false
description: This skill should be used when developing Spring Boot web applications following MVC architecture best practices. Triggers when users mention 'web layer', 'controller', 'API endpoint', 'REST API', 'VO/DTO/PO/BO models', 'request validation', 'HTTP methods', or need guidance on Web/API controllers, domain model separation, and data flow between layers. Provides standards for Web/API controllers, domain model patterns, dependency injection, and configuration management.
---

# Spring Boot MVC Web 开发最佳实践

遵循既定的最佳实践来编写高质量的 Spring Boot Web 应用程序。

## 项目设置与结构

- **构建工具：** 使用 Maven (`pom.xml`) 或 Gradle (`build.gradle`) 进行依赖管理。
- **启动器：** 使用 Spring Boot starters（例如 `spring-boot-starter-web`、`mybatis-plus-spring-boot3-starter`）来简化依赖管理。
- **包结构：** 按功能/领域组织代码（例如 `com.example.app.order`、`com.example.app.user`），而不是按层次（例如 `com.example.app.controller`、`com.example.app.service`）。

## 依赖注入与组件

### 组件定义
使用 `@Component`、`@Service`、`@WebApiController` 或 `@ApiController` 注解来定义 bean。

### 依赖注入
- **注入优先级：** 优先使用基于构造器的注入方式，其次使用基于 `@Resource` 注解的注入方式，最后使用基于 `@Autowired` 注解的注入方式。
- **构造器注入：** 始终使用 `private final` 修饰必需的依赖项，通过构造器注入方式注入这些依赖项。

## 配置

- **外部化配置：** 使用 `application.yaml`（或 `application.properties`）进行配置。YAML 通常因其可读性和层次结构而更受青睐。
- **类型安全的属性：** 使用 `@ConfigurationProperties` 将配置绑定到强类型的 Java 对象。
- **配置文件：** 使用 Spring Profiles（`application-dev.yml`、`application-prod.yml`）来管理特定环境的配置。
- **密钥管理：** 不要硬编码密钥。使用环境变量或专用的密钥管理工具。

## 领域模型

### 模型分类

1. **PO (Persistent Object)**：持久化对象，与数据库表结构一一对应，从数据层向上传递。

2. **BO (Business Object)**：业务对象，由 Service 层输出的封装业务逻辑的对象。

3. **DTO (Data Transfer Object)**：数据传输对象，用于 API 层、Service 层、Manager 层之间的数据传输。
   - 如果需要跨层传输，应该定义在下层，由上层依赖。
   - API 层可以定义 DTO 对象，但在调用 Service 层接口时必须做一次转化，不可以让 Service 依赖 API 层定义的对象（避免反向依赖）。

4. **VO (View Object)**：展示层对象，一种特殊的 DTO，通常作为 Web 层的响应对象。

### 命名约定

VO 层具有特殊含义的后缀：
- `*QueryVO` / `*QueryDTO`：特指数据查询入参。
- `*ReqVO` / `*ReqDTO`：特指请求数据。
- `*RespVO` / `*RespDTO`：特指响应返回数据。

## Web 层（控制器）

### 结构示例

```text
com.example.app.order/
└─ api/
   ├─ feign/                         # API端点，提供给其它服务
   │     ├─ OrderBizApi              # interface，定义端点
   │     └─ controller/
   │        └─ OrderBizController    # 实现OrderBizApi，添加 @ApiController 注解
   └─ web/                           # Web端点，提供给页面
      ├─ OrderApi                    # interface，定义端点
      └─ controller/
         └─ OrderController          # 实现OrderApi，添加 @WebController 注解
```

### 核心规则

#### 关键职责
- 把`*QueryVO` / `*QueryDTO` / `*ReqVO`/ `*ReqDTO`转换成`*BO`再传入服务层
- 把服务层返回的`*BO`转换成 `*RespVO` / `*RespDTO`

#### 端点设计
- 设计清晰且一致的 RESTful 端点，区分 Web 端点和 API 端点。
- 禁止在端点的URL中使用路径变量
- 只允许使用 `GET`、`POST` 两种 HTTP 方法：
  - 简单查询使用 GET 方法
  - 复杂查询使用 POST 方法
  - 添加、修改、删除数据使用 POST 方法
  - 禁止使用 GET 方法添加、修改、删除数据，避免 XSS 攻击
  - 禁用 PUT 和 DELETE 等方法，以防 Nginx 等中间件存在的漏洞引发上传文件等安全风险

#### 数据传输
- **Web 端点：** 使用 `*ReqVO` 接收请求数据，使用 `*RespVO` 响应数据。不要将实体（`PO`）直接暴露给客户端。
  - `*QueryVO` 是一种特殊的 `*ReqVO`，用于接收数据查询入参。
- **API 端点：** 使用 `*ReqDTO` 接收请求数据，使用 `*RespDTO` 响应数据。
  - `*QueryDTO` 是一种特殊的 `*ReqDTO`，用于接收数据查询入参。
- **包装响应：** 使用`com.szjlc.framework.api.base.response.HttpResult<T>`包装响应，例如`HttpResult<OrderDetailRespVO>`

#### 验证与异常处理
- **验证：** 在 `*ReqVO` 和 `*ReqDTO` 上使用 Java Bean Validation (JSR 380) 及其注解（例如 `@Valid`、`@NotNull`、`@Size`）来验证请求入参。
- **错误处理：** 使用 `com.szjlc.framework.api.base.exception.handler.GlobalExceptionHandler` 实现全局异常处理器，以提供一致的错误响应。

## 服务层与数据层

本技能主要关注 Web 层（控制器层）的开发。简要说明 Web 层与其他层的交互：

### Web 层与服务层的交互

Web 层调用服务层时应遵循以下原则：
- 将 `*ReqVO` / `*QueryVO` 转换为 `*BO` 后传入服务层
- 将服务层返回的 `*BO` 转换为 `*RespVO`
- 不要让服务层依赖 Web 层的 VO 对象

### 服务层开发要点

- **业务逻辑：** 将所有业务逻辑封装在 `@Service` 类中
- **无状态性：** 服务应该是无状态的
- **事务管理：** 在修改数据的方法上使用 `@Transactional(rollbackFor = Exception.class)`，事务范围要尽可能小
- **错误处理：** 抛出带有适当错误码的 `BusinessException`
- **单一职责：** 每个服务应该处理一个业务领域

### 数据层开发要点

- **ORM 框架：** 优先使用 `MyBatis Plus`，其次使用 `MyBatis`
- **查询方式：** 当使用 `MyBatis Plus` 时，单表查询使用 `lambdaQuery()`，复杂查询通过 `Mapper` 接口执行自定义 SQL

## 日志

- **SLF4J：** 使用 SLF4J API 进行日志记录。
- **Logger 声明：** 添加类注解 `@Slf4j`。
- **参数化日志：** 使用参数化消息（`log.info("Processing user {}...", userId);`）而不是字符串拼接来提高性能。
- **记录错误的日志：** 对于预期的错误使用 `log.warn()`，对于意外的错误使用 `log.error()`

## 更多资源

### 详细参考文档
- **[领域模型详细指南](references/domain-models.md)** - PO/BO/DTO/VO 的详细说明和示例

### 完整代码示例
- **[Web 控制器示例](examples/web-controller/)** - 完整的 Web Controller 实现代码
- **[API 控制器示例](examples/api-controller/)** - 完整的 API Controller（Feign）实现代码
- **[领域模型示例](examples/domain-models/)** - VO 和 DTO 的完整示例代码
- **[示例代码说明](examples/README.md)** - 示例代码的使用指南和最佳实践
