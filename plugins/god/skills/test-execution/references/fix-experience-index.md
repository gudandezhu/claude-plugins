# 测试失败经验索引

## 使用时机

1. **run-test 正常模式（阶段三）**：生成脚本前加载索引，参考"预防措施"列避免已知的坑
2. **run-test 正常模式（修复循环）**：classify-error 输出后查索引匹配已知模式，加速修复
3. **run-test 调试模式**：失败后先查此索引匹配已知模式
4. **run-test 调试模式**：重新生成脚本前，加载索引提醒避免已知的坑
5. **用户在 Claude Code 中粘贴失败日志时**：快速匹配给出修复建议

## 按 errorType 索引

| errorType | 失败模式关键词 | 经验文件 | 简述 | 预防措施摘要 |
|-----------|--------------|---------|------|------------|
| element_blocked | click timeout + .el-overlay | fix-experience/e2e-overlay-blocking.md | 遮罩层阻挡，需等待消失或检查 fixtures.ts | 弹窗操作后等待 overlay 消失；检查 fixtures.ts 覆盖层抑制 |
| element_blocked | click intercepted + el-dialog | element-plus-fix-patterns.md | 弹窗内部遮挡（已有文件） | 弹窗内操作用 `:visible` 限定；checkbox 点击 `.el-checkbox__input` |
| element_blocked | click intercepted + .el-tour | fix-experience/e2e-tour-blocking.md | el-tour 引导弹窗由操作触发，CSS 注入有竞争窗口 | 点击新增/编辑/删除后立即调用 dismissTour；dismissTour 用 page.evaluate 强制隐藏 |
| selector_ambiguous | strict mode violation | fix-experience/e2e-selector-ambiguous.md | 未限定作用域，需加 .locator() 容器 | 禁止无容器的 `getByText()`；表格行用 `.filter({ hasText })` 定位 |
| selector_ambiguous | strict mode violation + getByText + placeholder | element-plus-scripting-rules.md | el-select placeholder 文字与 form-item label 相同，getByText 同时匹配两者 | 禁止用 `getByText` 定位 el-select；用 form-item label 过滤：`.el-form-item:has(.el-form-item__label:has-text("字段名")) .el-select` |
| selector_ambiguous | strict mode violation + .or() + toBeVisible | element-plus-scripting-rules.md | waitForErrorMessage 用 .or() 复合 locator，两侧都匹配时合并结果含多个元素 | 禁止 `.or()` 配合 `toBeVisible()`；改用多选择器 CSS 字符串 `.el-message--error, .el-notification--error` |
| unknown | waitForResponse timeout | fix-experience/e2e-wait-for-response.md | ① URL 不含 API_PREFIX ② status === 200 但接口返回 204/其他 2xx ③ api-probe.md 路径含 apiPrefix 导致双重前缀 ④ test 级 timeout 被前置步骤耗尽 ⑤ API 请求根本未发出（按钮被遮罩拦截/点击了错误元素） | `waitForResponse` 用 `${API_PREFIX}` 拼接路径；status 用 `>= 200 && < 300`；timeout 持续时先排查操作是否真正触发了 API |
| unknown | Test timeout + waitForLoadState + networkidle 或 load | fix-experience/e2e-networkidle-timeout.md | SPA 有持续轮询，networkidle 永远不满足；waitForLoadState('load') 只等 HTML 解析，Vue 组件异步渲染未完成 | 禁止 `waitForLoadState('networkidle')` 和 `waitForLoadState('load')` 等待内容；必须用 `expect(locator).toBeVisible({ timeout: 15000 })` |
| unknown | Test timeout of 30000ms exceeded + waitForResponse | fix-experience/e2e-wait-for-response.md | playwright.config.ts 未设置 test 级 timeout，默认 30000ms 被前置步骤耗尽，waitForResponse 被硬截断 | playwright.config.ts 必须设置 `timeout: 60000`；gen-skeleton.js 已修复，旧项目需手动补加 |
| unknown | click 后无 API 请求 + el-message-box | fix-experience/e2e-message-box-selector.md | 确认弹窗选择器无容器限定，匹配到页面其他 primary 按钮，点击了错误按钮 | el-message-box 按钮必须加 `.el-message-box` 容器限定 |
| assertion_failed | 全部失败 + .el-table timeout + localStorage认证标志=false | fix-experience/e2e-storagestate-cas-login.md | CAS session cookie 跨实例失效 + localStorage 认证标志在 sessionStorage 无法持久化 | 用 auth-login.js 保存 storageState；登录勾选"自动登录"；auth-login.js 自动注入配置的 localStorage 标志 |
| check-environment | E2E 全量重定向到 CAS 登录页 + pre-check cas_tgt_missing | fix-experience/e2e-cas-tgt-missing.md | agent-browser state save 只保存当前域 cookie，CAS 域 TGT 未捕获，Playwright 加载后被重定向 | 必须用 auth-login.js（Playwright context.storageState()）；test-config.json 设置 auth.ssoUrl；pre-check 自动检测 |
| api_path_error | Cannot read properties of null | fix-experience/api-null-data-path.md | 创建接口返回 data:null，脚本假设有 bizKey | 写入接口只断言 `code`；`data` 字段用可选链 `data?.field` |
| network_error | ENOENT /dev/stdin | fix-experience/env-git-bash-windows.md | Windows Git Bash 兼容性问题 | 统一用 run-tests.js 执行；禁止 `python3`、`2>&1 \| tee` |
| unknown | E2E 100% selector_not_found + dom-probe.md 含"交互清单（PRD + UI 原型驱动）" | fix-experience/e2e-dom-probe-forged.md | LLM 将 2a-pre 探测规划直接当作 dom-probe.md 输出，跳过 agent-browser 真实探测，选择器全部是推断值 | 检查 dom-probe.md 时间戳是否整点、是否含 snapshot 运行时数据；重新执行阶段一真实探测 |

## 按插件文件索引（溯源用）

当确认是系统性问题（会影响所有 run-test 生成的脚本）时，需要修正插件文件。

| 插件文件 | 关联经验 | 文件职责 |
|---------|---------|---------|
| skills/test-scripting/references/e2e-script-template.ts | e2e-wait-for-response.md, e2e-overlay-blocking.md, e2e-tour-blocking.md, e2e-message-box-selector.md | E2E 脚本代码模板 |
| skills/test-scripting/prompts/script-writer.md | e2e-networkidle-timeout.md | 脚本生成禁令（networkidle 已加入禁止事项） |
| skills/test-scripting/references/element-plus-scripting-rules.md | e2e-selector-ambiguous.md | Element Plus 选择器规则 |
| skills/test-execution/references/element-plus-fix-patterns.md | e2e-overlay-blocking.md | Element Plus 修复策略 |
| skills/test-scripting/references/api-case-writing.md | api-null-data-path.md | API 脚本生成规范 |
| scripts/test-design/gen-skeleton.js | e2e-overlay-blocking.md, e2e-tour-blocking.md, e2e-wait-for-response.md, api-vitest-include-path.md | 骨架生成（fixtures.ts 模板、playwright.config.ts timeout、apiPrefix 剥离、vitest root 字段） |
| skills/test-execution/scripts/lib/error-classifier.js | api-null-data-path.md | 错误分类逻辑 |
| testing/auth-login.js | e2e-storagestate-cas-login.md | 登录态保存脚本（项目级，非插件） |
| skills/test-execution/scripts/check-auth.js | e2e-storagestate-cas-login.md, e2e-cas-tgt-missing.md | 登录态检查（localStorage 检查 + CAS TGT 检测，从配置读取检查项） |
| skills/test-execution/scripts/pre-check.js | e2e-storagestate-cas-login.md, e2e-cas-tgt-missing.md | 预检 + storageState 自动修正（localStorage 检查 + CAS TGT 检测，从配置读取） |

| skills/test-probing/SKILL.md | e2e-cas-tgt-missing.md | 登录态验证（check-auth.js 调用加 --sso-url，新增 cas_tgt_missing 处理） |
| skills/auto-login-passport/SKILL.md | e2e-cas-tgt-missing.md | 登录唯一权威（优先级链 + CAS/SSO 识别 + 手动面板） |
| skills/test-probing/references/dom-probing.md | e2e-dom-probe-forged.md | DOM 探测规范（新增核心禁令、2a-pre 输出路径改为 .cache/probe-plan.md、时间戳真实性要求） |
| skills/test-gate/scripts/gate-check.js | e2e-dom-probe-forged.md | 产物门禁（新增步骤 17：dom-probe.md 真实性检查） |

## 新增经验流程

修复问题后，如果是系统性问题：
1. 在 `fix-experience/` 下新建经验文件（按模板）
2. 更新本索引的对应表格
3. 同步修正关联的插件文件（按"按插件文件索引"表定位）

### 经验文件模板

```markdown
# {问题标题}

## 症状
<!-- classify-error 输出的 errorType + message 关键词 -->

## 根因
<!-- 为什么会出现这个问题 -->

## 影响范围
<!-- 个案 / 系统性（系统性 = 会影响所有 run-test 生成的脚本） -->

## 修复方式（脚本层面）
<!-- 如何修正当前需求的测试脚本 -->

## 修复方式（插件层面）
<!-- 如果是系统性问题，需要修正哪些插件文件，怎么改 -->

## 预防措施
<!-- run-test 生成脚本时如何避免 -->
```
