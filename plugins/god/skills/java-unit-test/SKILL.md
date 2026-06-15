---
name: java-unit-test
user-invocable: false
description: 编写 Java 单元测试,支持多种场景(普通类、Service 层、Controller 层、响应式编程)。当用户需要为 Java 类编写单元测试、生成测试代码、或提到 JUnit、Mockito、单元测试覆盖率时使用此技能。自动识别测试目标类型并生成符合规范的测试类。
---

# Java 单元测试生成器

帮助用户为 Java 类生成规范的单元测试代码,支持多种场景。

## 核心能力

1. **自动识别测试目标类型**:分析待测类判断是普通类、Service 层、Controller 层还是响应式类
2. **智能生成测试用例**:读取 Pojo 类和 validation 注解,构造正常/异常测试数据
3. **生成完整的测试类**:包含 setup、tearDown、测试方法、断言等
4. **遵循团队规范**:100% 分支覆盖率、Mock 策略、序列化规范、断言规范
5. **执行测试并验证**:生成测试后立即执行,根据失败信息自动调整代码直至测试通过

## 使用方式

用户需要提供:
- 待测试的 Java 类路径或源码
- (可选)相关的 Pojo 类、依赖类路径

## 工作流程

### 第一步:识别测试场景

读取待测类源码,分析类的特征:

1. **响应式类**:方法返回 `Mono` 或 `Flux`,使用 `reactor-test` 的 `StepVerifier`
2. **Controller 层**:
   - 类名包含 `Controller`
   - 使用 `@SpringBootTest` + `@AutoConfigureMockMvc` + `MockMvc`
3. **Service 层**:类实现 Service 接口,使用 `@SpringBootTest` + `@ExtendWith(JlcSpringRunner.class)`
4. **普通类**:工具类、工具方法等,使用纯 Mockito + JUnit 5


### 第二步:读取依赖信息

1. 读取待测类的所有依赖(字段注入、方法参数)
2. 读取方法参数和返回值涉及的 Pojo 类
3. 读取 Pojo 类的 validation 注解(`@NotNull`、`@Size` 等)

### 第三步:读取场景参考文档

**必须** 根据识别的场景类型,读取 `references/` 目录下对应的详细指南:
- **普通类** → `references/general.md`
- **Service 层** → `references/service.md`
- **Controller 层** → `references/controller.md`(包含认证绕过策略)
- **响应式类** → `references/reactive.md`

### 第四步:生成测试类

基于第三步读取的场景参考文档,生成测试类。**参考文档中包含了该场景的详细配置和示例代码,必须仔细阅读并遵循。**

## 核心规范（所有场景通用）

### 基本要求
1. 测试类名称:`${testTarget}AiTest.java`
2. 类注释:`/** 由AI自动生成 */`
3. **不测试** `private` 或 `private static` 修饰的方法
4. **分支覆盖率 100%**:覆盖所有 if/else、try/catch、switch 等分支

### 测试数据构造
1. 根据方法参数的 `jakarta.validation.constraints.*` 注解(`@NotNull`、`@Size` 等)构造正常和异常请求
2. 读取 Pojo 类的成员属性验证注解,构造符合规范的测试数据

### Mock 策略
1. **分析依赖**:确定要 mock 的依赖(不 mock 被测试类本身)
2. **创建模拟对象**:使用 `Mockito.mock` 创建模拟对象并对成员方法打桩
3. **静态方法 Mock**:使用 `Mockito.mockStatic` 对类方法打桩,必须用 TWR 语法管理:
   ```java
   try (MockedStatic<SomeClass> mockedStatic = Mockito.mockStatic(SomeClass.class)) {
       mockedStatic.when(() -> SomeClass.staticMethod()).thenReturn(value);
       // 测试代码
   }
   ```
4. **Mock 限制**:
   - 只能对模拟对象的方法打桩
   - 禁止对模拟对象成员属性的方法打桩
   - 禁止 mock 基本工具类(如 `StringUtils`)

### 测试类结构
```java
// 1. 类注解(根据场景选择,见下方场景特定规则)
// 2. 成员变量(包括被测对象、Mock 对象、@Autowired、@MockBean 等)
// 3. @BeforeEach setup 方法(公共桩代码)
// 4. @AfterEach tearDown 方法(关闭 MockedStatic 等资源)
// 5. 测试方法(每个方法只包含必要的桩代码)
```

### 测试方法设计
1. 分析待测方法的所有分支路径
2. 为每个分支生成一个测试方法
3. 测试方法命名规范:`test{MethodName}_{Scenario}`(如 `testSave_Success`、`testSave_WithNullParam`)
4. 测试方法结构:Mock 桩代码 → 调用待测方法 → 断言结果/行为

### 断言规范
1. **必须包含断言**:所有测试方法必须包含结果断言或行为断言
2. **优先使用 JUnit 5**:优先使用 `org.junit.jupiter.api.Assertions` 的断言方法
3. **响应式断言**:响应式测试使用 `reactor.test.StepVerifier`(见响应式场景)

### JSON序列化与反序列化
**强制：** 使用`com.szjlc.framework:jlc-common-utils:{version}`依赖中的com.szjlc.commons.utils.JsonUtils工具类来进行JSON序列化与反序列化。
1. JSON序列化:`com.szjlc.commons.utils.JsonUtils.toJson(Object)`
2. JSON反序列化:
   - `JsonUtils.fromJson(String, Class<T>)`
   - `JsonUtils.fromJson(String, TypeRefrence<T>)`

### 第五步:生成并写入测试代码

生成测试类代码后,直接写入到测试文件中:
- 测试类文件路径:遵循 Maven 规范,放在 `src/test/java/` 下对应的包路径中
- 测试类名称:`${testTarget}AiTest.java`

### 第六步:执行测试用例

使用 Maven 命令执行刚生成的测试用例,**将完整日志输出到临时文件**,然后从日志文件中提取关键信息:

**执行步骤**:

1. **创建日志目录并执行测试**:
```bash
mkdir -p mvn-test && bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -s "{TestClassName}" -d "$(pwd)" > "mvn-test/{TestClassNameFull}.log" 2>&1
```

2. **提取测试结果摘要**:
```bash
grep -E "Tests run:|BUILD SUCCESS|BUILD FAILURE" "mvn-test/{TestClassNameFull}.log"
```

3. **如有失败,提取错误信息**:
```bash
grep -A 50 "<<< FAILURE!" "mvn-test/{TestClassNameFull}.log"
```

4. **清理临时日志文件**(可选):
```bash
rm "mvn-test/{TestClassNameFull}.log"
```

**命令参数说明**:
- `${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -s`:使用 wrapper 脚本运行单个测试类，自动检测 mvnd/mvn
- `{TestClassName}`:测试类的简单名称(如 `DocumentControllerAiTest`)
- `-d "$(pwd)"`:指定项目目录为当前目录
- `mkdir -p mvn-test`:创建日志目录(如果不存在)
- `> "mvn-test/{TestClassNameFull}.log" 2>&1`:将标准输出和错误输出都重定向到日志文件
- `grep -E`:使用扩展正则表达式提取关键信息

**参数说明**:
- `{TestClassName}`:测试类的简单名称(如 `DocumentControllerAiTest`)
- `{TestClassNameFull}`:测试类的全限定名(如 `com.szjlc.ai.doc.controller.DocumentControllerAiTest`)

**日志文件命名规则**:
- 目录:`mvn-test/`
- 文件名:`{TestClassNameFull}.log`
- 完整路径示例:`mvn-test/com.szjlc.ai.doc.controller.DocumentControllerAiTest.log`
- 目的:
  - 所有测试日志统一存储在 `mvn-test/` 目录,便于管理
  - 使用类全名作为文件名,避免不同包下同名类的日志冲突
  - `.log` 扩展名便于日志查看工具识别

**日志文件处理策略**:
- **测试成功**:提取 `Tests run:` 和 `BUILD SUCCESS` 信息展示给用户,然后删除临时日志文件
- **测试失败**:提取 `Tests run:`、`BUILD FAILURE` 以及失败的测试用例和错误堆栈,**保留日志文件**供用户详细查看
- **自动清理**:只有测试通过后才自动删除临时日志文件

**跨平台注意事项**:
- **Windows PowerShell**: 所有包含 `.` 或 `=` 的 `-D` 参数必须用双引号包裹
- **Git Bash / Linux / macOS**: 引号可选,但建议统一使用引号
- **输出重定向**: `2>&1` 在所有平台上语法相同,确保错误信息也被捕获

**完整示例**:
```bash
# 创建日志目录并执行测试
mkdir -p mvn-test && bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -s "DocumentControllerAiTest" -d "$(pwd)" > "mvn-test/com.szjlc.ai.doc.controller.DocumentControllerAiTest.log" 2>&1

# 查看测试结果
grep -E "Tests run:|BUILD SUCCESS|BUILD FAILURE" "mvn-test/com.szjlc.ai.doc.controller.DocumentControllerAiTest.log"

# 如果失败,查看错误详情
grep -A 20 "<<< FAILURE!" "mvn-test/com.szjlc.ai.doc.controller.DocumentControllerAiTest.log"

# 清理临时文件(测试成功后)
rm "mvn-test/com.szjlc.ai.doc.controller.DocumentControllerAiTest.log"
```

### 第七步:分析测试结果并调整

根据测试执行结果采取不同策略:

#### 场景1:测试全部通过
```
Tests run: X, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```
- 输出成功信息
- 告知用户测试用例已生成并通过验证
- 删除临时日志文件 `mvn-test/{TestClassNameFull}.log`

#### 场景2:测试失败或出错
```
Tests run: X, Failures: Y, Errors: Z
<<< FAILURE!
```

**自动修复流程**:
1. **分析错误信息**:从日志文件中提取关键信息
   - 失败的测试方法名
   - 断言失败的原因(AssertionError)
   - 异常类型和消息
   - 失败的代码位置

2. **定位问题根源**:
   - Mock 桩数据不正确
   - 断言期望值与实际值不符
   - 缺少必要的 Mock 配置
   - 测试数据构造不符合要求
   - 依赖注入问题

3. **调整测试代码**:
   - 修改 Mock 返回值
   - 调整断言条件
   - 补充遗漏的 Mock 配置
   - 修正测试数据构造逻辑
   - 优化 setup/tearDown 方法

4. **重新执行测试**:
   - 保存修改后的测试代码
   - 再次执行测试命令(输出到日志文件)
   - 提取新的测试结果
   - 重复此过程直至所有测试通过

**修复限制**:
- 最多尝试修复 3 次
- 如果 3 次后仍未通过,输出详细的错误信息和建议,请求用户协助
- **保留 `mvn-test/{TestClassNameFull}.log` 文件**供用户查看完整日志

### 第八步:输出总结

完成测试用例生成和验证后,向用户说明:
- 测试类文件路径
- 测试覆盖的方法列表
- 测试执行结果(通过/失败的用例数)
- 特殊 Mock 需求的说明(如果有)
- 需要添加的依赖(如果用户项目中缺少)
- 修复过程中的主要调整(如果有)
- 如有失败,告知用户可查看 `mvn-test/{TestClassNameFull}.log` 获取完整日志
