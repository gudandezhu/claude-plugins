# E2E 测试案例编写规范

产出：`{e2eCasesOutputPath}`（由主会话展开为绝对路径后传入）

生成前必须先读取 `$CLAUDE_PLUGIN_ROOT/skills/test-scripting/templates/frontend-test-case-template.md` 模板，
按模板的完整表格格式编写每个案例。

基于 PRD、UI 设计稿/原型和前端代码编写，按页面/功能模块组织。

## 案例格式（强制）

每个案例必须包含以下完整字段，使用模板中的表格格式：

| 项目 | 必填 | 说明 |
|------|------|------|
| 用例ID | ✅ | 正常 FE-{页面}-001，异常 FE-{页面}-001-E01，边界 FE-{页面}-001-B01 |
| 用例描述 | ✅ | 一句话说明验证什么 |
| 优先级 | ✅ | P0（核心）/ P1（重要）/ P2（一般） |
| 测试类型 | ✅ | UI测试/功能测试/交互测试/异常测试/验证测试 |
| 前置条件 | ✅ | 编号列表，每条一行 |
| 测试步骤 | ✅ | 编号列表，每步一行，具体到点击哪个按钮、输入什么值 |
| 预期结果 | ✅ | 编号列表，与测试步骤一一对应，具体到看到什么提示、跳转到哪个页面 |

禁止使用简化格式（如只有"页面 | 功能模块 | 操作点"三列的概要表格）——
这种格式缺少前置条件、测试步骤和预期结果，无法指导脚本编写，门禁也不会通过。

## 覆盖完整性（强制）

必须覆盖以下所有类型，缺少任何一类都不算覆盖完整：

- 正常流程（Happy Path）：所有主流程的完整操作，每个主流程至少 1 个案例
- 异常流程（E 编号）：每个表单提交至少 2 个异常案例（接口报错、数据不存在）
- 边界值（B 编号）：每个输入字段至少 1 个边界案例（空值、最大长度、特殊字符）
- 表单验证：每个必填字段至少 1 个空值提交验证案例
- 交互状态：加载中、空状态、分页（如有）
- 权限控制：不同角色的页面元素可见性和操作权限（如有）

编写边界值和表单验证案例时，注意 UI 组件的内置行为——
详见 `element-plus-scripting-rules.md`（Element Plus 项目）。

## PRD 驱动的案例设计（强制）

案例设计必须从 PRD 和 UI 原型出发，不能只依赖 dom-probe.md 的页面结构。
以下信息必须从 PRD 中提取并转化为测试案例：

### 从 PRD 功能表提取
- PRD 中每个「元素名称」对应至少 1 个正常流程案例
- PRD 中每个「异常提醒」列的内容对应至少 1 个异常场景案例
  （如"保存失败提示'保存失败，请重试'" → Mock 接口返回 500，验证提示文字）
- PRD 中每个「触发事件」列的联动描述对应至少 1 个联动测试案例
  （如"切换下方客户/供应商选项" → 切换对账类型后验证标签变化）

### 从 UI 原型提取
- 输入框的 min/max/step 属性 → 边界值案例（最小值、最大值、越界值）
- 下拉框的选项列表 → 每个非默认选项至少 1 个案例
- 复选框的默认勾选状态 → 取消勾选后的联动案例
- 必填标记（红色星号）→ 空值提交校验案例

### 从 PRD 异常场景表提取
- PRD 中的「异常场景及处理」章节，每条异常场景对应 1 个 Mock 测试案例
- 重点关注：保存失败、删除失败、开关切换失败的前端恢复行为（弹窗不关闭、值回滚）

## 案例与脚本同步（强制）

案例与脚本必须同步生成，双向对应：
- 案例文档中的每个 TC 编号必须有对应的 test() 实现——不要写了案例不写脚本
- 脚本中的每个 test() 必须有对应的案例编号——不要写了脚本没有案例
- 门禁步骤 2 要求覆盖率 100%（缺失数=0），8% 或 20% 的覆盖率不会通过

如果案例数量太多（超过 30 个），先写核心场景的案例和脚本通过门禁，
再在后续迭代中补充。不要一次写 40 个案例但只实现 8 个脚本——
这会导致门禁永远过不了，浪费时间。

# E2E 脚本生成

前置条件：dom-probe.md 必须已生成。
没有真实 DOM 结构，脚本中的选择器全靠猜测，首次执行必然大面积失败。

脚本生成时必须：
1. 读取 `dom-probe.md` 获取真实选择器、UI 框架、实际路由
2. 使用 `dom-probe.md` 中记录的选择器，禁止猜测 DOM 结构
3. 覆盖层抑制已由 `fixtures.ts` 全局处理，spec 文件中不需要 `dismissOverlays`
4. **URL 必须使用 dom-probe.md 中的「完整 URL 路径」字段**，禁止使用「实际路由」行中的括号注释文字。
   hash 模式的 URL 格式为 `${FRONTEND_URL}/#/path`，不是 `${FRONTEND_URL}/path`。
   如果 dom-probe.md 中只有「实际路由」，根据「路由模式」字段拼接：hash → 加 `/#` 前缀，history → 直接使用。

## waitForResponse 路径规则（强制）

从 `api-probe.md` 读取接口路径时，路径已包含 apiPrefix（如 `/saas/erp/biz/finance/xxx`）。
在 `waitForResponse` 中使用 `${API_PREFIX}/path` 模式时，**必须先去掉路径中的 apiPrefix 前缀**，只保留业务路径部分：

```typescript
// api-probe.md 记录：### DELETE /saas/erp/biz/finance/statement-rules/delete/{bizKey}
// test-config.json 中 backend.apiPrefix = '/saas/erp/biz'

// ✗ 错误：直接用 api-probe.md 的完整路径
r.url().includes(`${API_PREFIX}/saas/erp/biz/finance/statement-rules/delete/`)
// 运行时 → '/saas/erp/biz/saas/erp/biz/...' 永远不匹配

// ✓ 正确：剥离 apiPrefix，只保留业务路径
r.url().includes(`${API_PREFIX}/finance/statement-rules/delete/`)
// 运行时 → '/saas/erp/biz/finance/statement-rules/delete/' ✓
```

判断方法：看 api-probe.md 路径是否以 `test-config.json` 中的 `backend.apiPrefix` 开头，是则去掉该前缀。

脚本规范：
- `playwright.config.ts` 必须配置 `use: { headless: true }`——run-test 默认无头执行，
  有头模式仅在 DOM 探测阶段需要用户手动登录时使用
- auth 不为 null 时，测试通过 storageState 复用登录态。
  登录态由 `auto-login-passport` 优先级系统获取（自定义脚本 > auto-login.js > 手动面板）。
  gen-skeleton.js 会直接在 playwright.config.ts 中引用 storageState，无需 setup project。
- auth 为 null 时直接访问页面
- 元素定位优先级：
  1. `page.getByTestId('xxx')` — dom-probe.md 中选择器为 `getByTestId('xxx')` 格式时直接使用，无需容器限定
  2. dom-probe.md 其他真实选择器（CSS）— 无 data-testid 时使用
  3. `aria-label/role` 语义定位
  4. CSS 选择器兜底

### :has-text 禁止条款

禁止在无 data-testid 时直接使用 `:has-text()` 作为唯一选择器。
必须使用结构化选择器作为兜底：
- ✓ `.locator('.el-form-item:has(.el-form-item__label:has-text("字段名")) input')` — 结构化定位
- ✗ `.locator(':has-text("字段名")')` — 文案变更即失效
- 每个 test() 对应案例中的一条 TC 记录
- 每个 test() 结束前必须调用 `page.screenshot()` 保存截图
- 每个 test() 必须独立——不依赖其他 test() 的执行结果或副作用（如创建的数据），
  一个 test() 失败不应导致后续 test() 级联失败
- 每个 describe 块的 beforeAll 中准备测试数据，afterAll 中清理，
  避免重复执行时因残留数据导致唯一约束冲突

## 选择器精确定位规则（按 UI 框架条件加载）

根据 `test-config.json` 的 `techStack.uiLibrary` 加载对应的选择器规则：
- `element-plus` → 加载 `element-plus-scripting-rules.md`
- 其他框架 → 使用通用原则：先用 `.locator()` 限定容器，再用语义定位器找目标

代码模板详见 e2e-script-template.ts（生成脚本前必须加载此模板）。

## Mock 清理规范（强制）

使用 `page.route()` 注入 mock 后，测试结束前必须调用 `page.unroute()` 清理：
```typescript
const handler = (route) => route.fulfill({ status: 500, body: '...' });
await page.route('**/api/path', handler);
// ... 测试逻辑 ...
await page.unroute('**/api/path', handler); // 必须清理
```

> 注：e2e-script-template.ts 的 API 异常 Mock 模板已有正确的 unroute 示范，
> 此规范确保非模板场景下也不遗漏清理。

## 超时配置规范

超时值从 `test-config.json` 的 `timeouts` 配置节读取，不在脚本中硬编码数字。

### test-config.json 配置示例

```json
{
  "timeouts": {
    "toBeVisible": 10000,
    "action": 15000,
    "navigation": 30000
  }
}
```

### 脚本中使用

- `playwright.config.ts` 已从 test-config.json 读取并配置 `expect.timeout`、`navigationTimeout`、`actionTimeout`
- 脚本中直接使用 `expect(locator).toBeVisible()` 即可使用配置值，无需手动指定 timeout
- 特定场景可覆盖: `expect(locator).toBeVisible({ timeout: 20000 })`
- **禁止使用 `waitForTimeout()`**（非确定性等待）

### 未配置时的默认值

| 配置项 | 默认值 |
|--------|--------|
| toBeVisible | 10000ms |
| action | 15000ms |
| navigation | 30000ms |

## el-tour 遮罩处理规范（Element Plus 项目）

### 处理策略

采用两层防护机制：

1. **第一层（fixtures.ts）**：`addInitScript` 抢先注入 CSS 压制
2. **第二层（beforeEach）**：数据就绪后主动点击关闭按钮

### 禁止事项

1. **禁止在测试用例中调用 `dismissTour`**——已在 beforeEach 统一处理
2. **禁止在 fixtures 的 test.extend 中调用**——此时页面还没导航
3. **禁止依赖 localStorage 预设置**——key 名不确定
4. **禁止依赖 `waitForLoadState('networkidle')`**——SPA 应用不可靠
5. **禁止在 beforeEach 中使用 `waitForResponse` 等待页面加载 API**——存在竞态条件
   （goto 发出请求，响应可能在监听器注册前到达）；使用 `toBeVisible` 等待数据依赖元素
6. **禁止在 beforeEach 中使用 `waitForTimeout`**——非确定性等待

### 正确示例

```typescript
// fixtures.ts
export const test = base.extend({
  page: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    
    await page.addInitScript(() => {
      // 抢先压制 tour
      const style = document.createElement('style');
      style.textContent = '.el-tour, .el-tour * { display: none !important; pointer-events: none !important; }';
      document.head.appendChild(style);
    });
    
    await use(page);
    await context.close();
  },
});

// *.spec.ts
test.beforeEach(async ({ page }) => {
  await page.goto(URL);

  // 等待页面数据就绪：数据依赖元素可见 = API 已返回 + Vue 已渲染
  // 不使用 waitForResponse（竞态条件）、不使用 waitForTimeout（非确定性）
  await expect(page.locator(SEL.table)).toBeVisible({ timeout: 15000 });

  // 第二层 tour 防护（第一层 addInitScript 已处理绝大多数）
  const closeBtn = page.locator('button.el-tour__closebtn');
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
  }
});

test('业务测试', async ({ page }) => {
  // 不需要处理 tour，直接操作
  await page.locator(SEL.addBtn).click();
});
```

## 菜单树区域指导（tree-context.json 存在时）

从 tree-context.json 的 menuTree 提取区域信息，生成对应的等待和断言策略。

zone 是**产品架构层的逻辑层级指示器**，不是 CSS z-index，不直接用于 CSS 选择器或 z-index 断言。

| 区域 | 逻辑层级 | 等待策略 | 关闭/完成策略 |
|------|---------|---------|-------------|
| C区 | 基础层（无覆盖） | 直接操作 | N/A |
| F区 | 页面切换层 | 等待 transition 完成（waitForResponse 或 URL 变化） | 返回按钮 / browser.back() |
| E区 | 弹窗层 | `expect(overlay).toBeVisible()` | 关闭后 `expect(overlay).toBeHidden()` |
| D区 | 确认层（E区之上） | D区优先处理 | 先处理确认弹窗，再等 E区 overlay 消失 |
| S区 | 抽屉层 | `expect(drawer).toBeVisible()` | `expect(drawer).toBeHidden()` |
| T区 | 反馈层 | `waitFor` toast 出现 | 自动消失（waitForHidden） |

不存在 tree-context 时跳过此章节。
