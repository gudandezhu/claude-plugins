---
name: test-scripting
user-invocable: false
description: |
  测试脚本生成规范与测试模板资源库。定义产物目录结构、路径引用规则、E2E 和 API 流程的脚本生成标准。
  templates/ 目录提供验收报告、测试案例、冒烟测试、CI 配置等标准化模板，供本技能及其他测试技能加载。
  案例设计已拆分到 test-case-design 技能，本技能只负责脚本生成。
  在 /run-test Phase 3（脚本生成）时加载。
  当需要生成测试脚本（E2E + API 流程）或加载测试模板时，使用此技能。
  单 API 接口脚本由本技能（scope=backend）生成，backend-test 命令调用。
  涉及 Playwright E2E 脚本、axios+vitest API 流程脚本时加载此技能。
  门禁审核和质量规则已拆分到 test-gate 技能。
---

# 项目结构

输入来源、配置文件分工、产物目录结构、工具分工详见 `references/project-structure.md`。

# Stage Interface

test-scripting 暴露 4 个 stage，供下游调用方委托调用：

## Stage 1: Probe（探测）

委托给 test-probing 技能。
- 加载 `skills/test-probing/references/api-probing.md`
- 执行 `swagger-probe.js`，产出 `$WORK_DIR/testing/api-probe.md` + `.cache/api-skeleton.json`

## Stage 2: Skeleton（骨架生成）

执行 gen-skeleton.js：
```bash
node $CLAUDE_PLUGIN_ROOT/scripts/test-design/gen-skeleton.js --testing-dir $WORK_DIR/testing
```

## Stage 3: Generate（案例 + 脚本生成）

加载对应的 reference 和 template：
- API：`references/api-case-writing.md` + `skills/test-scripting/templates/api-test-case-template.md`
- E2E：`skills/test-scripting/templates/frontend-test-case-template.md`
  （`references/e2e-case-writing.md` 和 `references/element-plus-scripting-rules.md` 的核心要点已内嵌到 script-writer.md，完整文件仅供 gate-check checkers 和 quality-auditor 使用）

产出：案例文档（`test-cases/`）+ 脚本文件（`scripts/`）

## Stage 4: Gate（门禁检查）

委托给 test-gate 技能。
- 执行 `gate-check.js`，scope 由调用方指定（backend / frontend）
- testingRepo 参数传递方式见 api-flow-subagent.md 的上下文管理

## 消费方式

下游调用方应：
1. 仅描述自身与标准 pipeline 的差异（scope、命名、特有校验）
2. 不重复列出 stage 步骤和脚本调用命令
3. 不重复引用 test-scripting 已管理的 reference 文件

# 路径引用规则

1. **路径锚点自适应**：集成模式和 WORK_DIR（process-docs 根），standalone 模式 fallback 到 process.cwd()
   ```typescript
   const WORK_DIR = process.env.WORK_DIR || process.cwd();
   const IS_STANDALONE = !process.env.WORK_DIR;
   const SCREENSHOTS_DIR = IS_STANDALONE
       ? path.resolve(process.cwd(), 'screenshots')
       : path.resolve(WORK_DIR, 'testing/screenshots');
   ```
   - 截图：`path.resolve(SCREENSHOTS_DIR, '{TC}_{step}.png')`
   - storage state（由 playwright.config.ts 配置，spec 中不引用）
   - API 路径：`` `${BASE_URL}${API_PREFIX}/具体路径` ``
2. **WORK_DIR 由 run-tests.js 注入**，LLM 不需要计算路径
3. **禁止使用 `__dirname`** — gate-check 会检查并警告
4. **不要硬编码绝对路径或 apiPrefix** — 使用环境变量
5. **环境变量有 fallback 默认值**（仅限 vitest API 测试中的 BASE_URL/API_PREFIX）：
   ```typescript
   const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
   const API_PREFIX = process.env.API_PREFIX || '';
   ```
6. vitest.config.ts 和 playwright.config.ts 由 gen-skeleton.js 自动生成，不需要 LLM 编写
7. Windows Git Bash 环境下 `/finance/...` 这样的路径会被 MSYS 自动转换为 Windows 路径，
   导致 API URL 中断。API 请求路径不要以 `/` 开头拼接，用环境变量 `API_PREFIX` 包含前导斜杠

# 规范加载

生成产物前，根据当前阶段从 `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/` 按需加载对应模板：

| 阶段 | 加载模板 |
|------|---------|
| E2E 案例 | `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/frontend-test-case-template.md` |
| API 案例 | `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/api-test-case-template.md` |

不要一次读取所有模板——信息过载会导致格式混淆，只读当前阶段需要的那一个。

# references 按需加载

references/ 目录下的文件按条件加载，禁止一次性读取全部：

| reference 文件 | 加载条件 |
|---------------|---------|
| project-structure.md | 需要了解输入来源、配置分工、产物目录结构时 |
| e2e-case-writing.md | gate-check checkers / quality-auditor / 降级路径 test-writer（script-writer 不再加载） |
| api-case-writing.md | 阶段二，生成 API 脚本时（脚本规范部分，内部引用 api-script-template.ts） |
| element-plus-scripting-rules.md | gate-check checkers / quality-auditor（script-writer 不再加载，核心要点已内嵌） |
| subagent-generation.md | 阶段二，启动脚本生成时 |
| upstream-validation.md | Step 0，案例文档检查 + progress 同步 + 续生成逻辑 |
| api-flow-subagent.md | 阶段二 Step 3，用户选 A（包含流程测试）时构造 API flow 脚本 |

# Phase 模式

testingRepo 是强制配置项（run-test 初始化阶段保证）。所有脚本输出到 testingRepo（详见 `references/impact-and-selectors.md`）：

| 模式 | 条件 | 脚本输出路径 |
|------|------|------------|
| PHASE_BOOT→2 | 首次运行，从 dom-probe.md 引导 selectors | `{testingRepo.path}/features/` |
| Phase 2 | selectors 模块已存在（增量更新） | `{testingRepo.path}/features/` |

编排层设置模板变量：
- `{groupId}` = 功能树第一个 group ID（如 `PRQL-FLTR`），无功能树时为空字符串
- `{groupDir}` = 功能树 groupId（如 `PRQL-FLTR`），无功能树时为空字符串
- `{e2eScriptsOutputDir}` = 功能树存在时：`{testingRepo.path}/tests/e2e/features/{groupDir}/`；不存在时：`{testingRepo.path}/tests/e2e/features/`
- `{apiScriptsOutputDir}` = `{testingRepo.path}/tests/api/features/`

**禁止 LLM 自主判断降级**——必须由编排层统一决策。

# prompts 按角色加载

| prompt 文件 | 角色 | 使用场景 |
|------------|------|---------|
| script-writer.md | 脚本生成角色（默认） | 阶段二，从案例文档生成 E2E + 流程脚本 |
| test-writer.md | 案例+脚本生成角色（降级） | 阶段二，script-writer 不可用时降级 |
| quality-auditor.md | 质量审核角色 | 阶段三，E2E 脚本质量审核 |

## 经验库参考（脚本生成前）

5 条质量原则详见 `skills/test-gate/references/quality-rules.md`，此处不重复。
以下是质量规则未覆盖的操作技巧：

### API 路径处理
- API 测试脚本使用 `get('/path')` 相对路径，禁止拼接 `API_PREFIX`
- 从 `api-probe.md` 读取的路径已包含 apiPrefix，需要自动剥离

### el-tour 遮罩处理
- tour 在 API 响应后异步渲染，不能在 `page.goto` 后立即关闭
- 双层防护：fixtures.ts 的 addInitScript 抢先压制 + beforeEach 主动点击关闭
- 禁止依赖 `networkidle` 和 localStorage 预设置
- `addLocatorHandler` 无法处理异步渲染的 tour

### Element Plus 特殊处理
- 弹窗内文本输入框禁止用 `.el-input input`——el-select 内部也有隐藏 input，会 selector_ambiguous；用 `getByPlaceholder` 或 form-item label 过滤
- 弹窗内下拉框用 `.el-form-item:has(.el-form-item__label:has-text("字段名")) .el-select` 定位
- 弹窗操作后必须等待 overlay 消失再操作下一个元素
- `el-input-number` 的 fill() 不触发 Vue change 事件，必须用 fillNumberInput 辅助函数
- 编辑弹窗数据通过 API 异步加载，读取字段值前必须用 waitForFormPopulated 等待回显
- 写入接口（POST/PUT/DELETE）的 `data` 可能为 null，断言用可选链 `data?.field`

### Playwright 时序
- fixtures 的 `test.extend` 在页面导航前执行，不能用于关闭 tour
- `waitForResponse` Promise 先创建再 goto 最后 await 是 Playwright 推荐模式

完整经验索引见 `test-execution/references/fix-experience-index.md`（run-test 修复循环时加载）。


# 案例设计流程

骨架文件（gen-skeleton.js 生成）提供选择器常量（SEL 对象）和辅助函数作为参考输入，
不包含 test() 空壳——测试用例完全由 LLM 从案例文档生成。

正确流程：
1. **先做测试设计**：读取 PRD + UI 原型 + dom-probe.md + api-probe.md，
   从业务角度设计完整的测试案例（正常流程 + 异常 + 边界 + 联动 + 表单验证）
2. **再参考骨架写脚本**：骨架中的选择器常量（SEL 对象）、dismissTour 函数、
   fillNumberInput 辅助函数、waitForResponse 辅助函数可以直接复用，但测试逻辑从案例设计出发编写
3. **骨架中没有的场景也必须覆盖**：
   异常场景（API Mock 失败）、边界值（输入极值）、联动（类型切换）等必须从 PRD/UI 原型设计

骨架的价值是提供真实选择器和代码结构参考，不是限定测试范围。

## 骨架参考输入流程

1. 检查 `testing/.cache/api-skeleton.json` 和骨架文件是否存在
2. 存在 → 脚本生成已内嵌核心规范（7 条元原则），无需额外加载 reference 文件
   - 完整规范文件（e2e-case-writing.md / element-plus-scripting-rules.md）仅用于 gate-check checkers 和 quality-auditor
   - 降级路径 test-writer 仍按原流程加载
3. 读取骨架文件，提取选择器常量（SEL 对象）和辅助函数供脚本复用，
   然后从 PRD + UI 原型 + 案例文档出发设计完整脚本，复用骨架的选择器
4. 不存在骨架 → 同样加载对应 reference 文件，按其规范从零编写

# 脚本生成流程

编排层选择生成时，按 `references/subagent-generation.md` 执行统一 Test Writer 的 prompt 构造和调用。
顺序生成 E2E + API 的案例和脚本。

遇到服务端错误时，按 `references/subagent-generation.md` 的降级策略降级到轻量 writer。
**禁止退化到编排上下文直接生成**——编排上下文此时已重（经历了探测+调度），Bash/Write 参数会被截断。
降级不是降低质量的理由——案例格式、覆盖完整性、脚本规范的要求不变。

# 禁止事项

以下规则贯穿测试产物生成全过程：

- 禁止跳过异常场景——只测正常流程的测试等于没测
- 禁止硬编码环境地址——换环境后全部失败，使用环境变量
- 禁止跳过 DOM 探测直接编写 E2E 脚本——选择器全靠猜测，首次执行必然大面积失败
- 禁止跳过 API 探测直接编写 API 脚本——字段名不一致导致断言全挂
- 禁止门禁未通过就标记完成——门禁是质量底线
- 禁止为整个系统的所有接口生成测试——那是全量回归测试，不是需求验收测试
- 禁止生成失败后在编排上下文直接生成或修改脚本文件（包括新建文件和修改现有文件）——连续失败时必须停止并提示用户开启新会话
- 禁止通过 shell 重定向（`echo "..." > file.md`）写入中文内容——Git Bash 默认编码非 UTF-8，会导致乱码。所有含中文的文件必须通过 LLM 的文件写入工具或 Node.js `fs.writeFileSync(path, content, 'utf-8')` 写入
- 禁止用 `node -e "..."` 内联写入脚本文件——TypeScript 代码含大量单引号，放进 bash 双引号字符串会破坏 shell 解析，必然报 `unexpected EOF`；写文件必须用 Write 工具
- 禁止单次 Write 写超过 200 行的文件——Write 工具有大小限制，超出时静默失败（`Error writing file`）；正确做法是先 Write 写文件头部（import、常量、辅助函数），再用 Edit 逐段追加每个 test() 块
- 禁止在出现语言漂移（如切换成韩语、日语）后继续生成——这是上下文窗口耗尽的症状，必须立即停止并告知用户开启新会话
- **禁止读取源码**——选择器和 API 路径必须从探测报告（dom-probe.md / api-probe.md）获取，禁止读取 projects/ 目录下的 .vue/.jsx/.tsx/.java 等源码文件。源码结构变化频繁，硬编码选择器会导致脚本脆弱。gate-check 步骤 15 会扫描源码引用
