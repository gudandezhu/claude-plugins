# DOM 探测（scope 含前端时）

## ⛔ 核心禁令

**禁止将步骤 2a-pre 的交互清单作为 dom-probe.md 的最终输出。**
交互清单是探测前的规划文档，不是探测结果。

**dom-probe.md 中的所有选择器必须来自 agent-browser snapshot 的运行时数据，不得从 PRD、UI 原型或 Element Plus 通用知识推断。**

判断 dom-probe.md 是否真实探测的标志：
- 头部探测时间戳必须是非整点时间（如 `03:31:47.382Z`），整点时间（如 `03:30:00.000Z`）说明是 LLM 伪造的
- 选择器必须包含从 snapshot 中观察到的实际 DOM 结构（如自定义组件的真实 class 名），不能全是通用的 `.el-table`、`.el-button` 等

**禁止跳过 agent-browser 步骤直接生成 dom-probe.md**——即使 PRD 和 UI 原型已经很详细，运行时 DOM 结构仍可能与设计文档不一致（自定义组件封装、异步渲染、条件渲染等）。

**禁止省略"交互后探测"步骤**——未交互的 DOM 状态缺少动态元素（弹窗、下拉、展开面板、抽屉）。每个页面的每个交互按钮都必须触发并捕获交互后 DOM。省略交互后探测会导致生成的脚本引用不可见的弹窗/表单中的选择器。

**禁止将推断的选择器标记为 `verified`**——从 PRD/UI 原型/代码推断的选择器只能标记为 `inferred`。只有经过 agent-browser snapshot 实际捕获的选择器才能标记为 `verified`。`inferred` 选择器在脚本生成时会降级处理（优先使用 `verified` 选择器）。

## 禁读源码

禁止在探测过程中读取 projects/ 下的任何源码文件（.vue/.jsx/.tsx/.ts/.js）。
路由提取和 DOM 推断脚本（步骤零）是唯一允许访问源码的环节，且仅通过脚本自动化执行。
探测阶段的所有信息必须来自运行时 Playwright snapshot，不得从源码推断 DOM 结构。

## 工具限制

DOM 探测使用 agent-browser 的 `snapshot -i` 命令获取结构化可交互元素列表。
不要用 agent-browser 执行测试——它没有断言能力，执行结果不可复现。
测试执行由 Playwright 负责，详见 test-execution 技能。

## 步骤零：源码辅助提取（可选，projects.frontend 不为 null 时）

在运行时探测前，可选从前端源码提取辅助信息，减少运行时探测的盲目性。
此步骤为可选——如果 projects.frontend 为 null 或脚本执行失败，直接跳过进入步骤一。
运行时 Playwright snapshot 是探测的主要信息来源。

### 路由提取（可选）

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/adapters/vue/route-extract.js" --project <前端项目路径> --output "$WORK_DIR/testing/.cache/routes.json"
```

输出 `testing/.cache/routes.json`，包含所有路由的 path、name、component 映射。
有了路由表就不需要在运行时逐页盲目导航。

### DOM 选择器推断

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/adapters/vue/dom-infer.js" --components <组件文件列表> --output "$WORK_DIR/testing/.cache/dom-probe-skeleton.json"
```

输出 `testing/.cache/dom-probe-skeleton.json`，包含从 Vue 模板中提取的 UI 组件标签
和通过 adapter.json selectorMapping 映射的 CSS 选择器。

源码推断的选择器置信度为 `inferred`——源码中的组件结构不等于最终渲染的 DOM，
必须通过步骤二的运行时 snapshot 验证后才能标记为 `verified`。

## 步骤一：打开首页，处理运行时干扰

> **认证约束（强制）**
>
> - 禁止直接询问账号密码
> - 禁止跳过 resolve-auth.js
> - 必须先搜索 storage-state.json（localStorageState / cachedStorageState），再展示选择面板
> - 选择面板格式固定（4 个选项），禁止 Agent 自行修改选项内容或增减选项

```bash
agent-browser open <frontend.baseUrl>
agent-browser wait --load load
agent-browser snapshot -i
```（满足任意一条即触发登录流程）：
- URL 包含 login、signin、auth 等关键词
- snapshot 显示登录表单（用户名/密码输入框）
- snapshot 中可交互元素为 0 或极少（页面空白）——这是路由守卫静默拦截的典型表现，
  Vue/React 应用挂载了但路由守卫阻止了页面渲染，`#app` 内容为空或只有注释节点
- 页面标题包含"登录"但 URL 未变（SPA 内部重定向）

不要在页面空白时用 `agent-browser eval` 手动探测 DOM 结构试图理解原因——
SPA 页面空白 + 应用已挂载（body 有内容但 #app 为空）几乎 100% 是未登录导致的。
直接进入登录流程比调试 DOM 快得多。

检测到需要登录时，加载 `auto-login-passport` skill 按其流程获取登录态。

具体步骤：
1. 执行 `auto-login-passport`「预设检测」→ resolve-auth.js
2. status=ready → 按「登录态验证」流程检查现有 storage-state.json
3. 有效 → 加载继续探测
4. 失效/不存在 → 按「优先级判定」自动获取
5. 无预设 → 展示「认证选择面板」等待用户选择
6. 获取成功后执行「登录态后处理」（secure cookie 修正 + localStorage 检查）

DOM 探测中的单域手动登录特殊处理：
- 单域场景可用 agent-browser headed 模式手动登录
- 用户完成登录后 `agent-browser state save` 保存
- **禁止自行判断登录是否完成——必须展示确认面板让用户主动确认**
- 登录态后处理同上

Playwright 登录完成后，如需继续用 agent-browser 做交互式探测：
```bash
agent-browser --state "$WORK_DIR/testing/auth/storage-state.json" open <frontend.baseUrl>
agent-browser wait --load load
agent-browser snapshot -i
```

**如何判断是否为 CAS/SSO**：
- `test-config.json` 中配置了 `auth.ssoUrl`
- 打开首页后 URL 跳转到了 `passport`、`sso`、`cas`、`auth` 等其他域
- snapshot 中出现了指向其他域的登录表单 iframe
- 如果不确定，默认按 CAS 处理——最坏情况只是多弹一个 Playwright 窗口

用户选择 3 时：
- 跳过需要登录的页面，只探测公开可访问的页面
- 在 dom-probe.md 中标注"以下页面因未登录跳过探测"

检测并处理常见干扰：
- 引导遮罩（el-tour、intro.js 等）：找到关闭/跳过按钮并点击
- 版本更新弹窗：找到确认/关闭按钮并点击
- 用户协议弹窗：找到同意/确认按钮并点击
- 公告/通知弹窗：找到关闭按钮并点击

每种干扰记录：干扰类型、触发时机、关闭方式（具体的选择器和操作）。

## 步骤 1.5：菜单布局探测（登录成功后）

登录成功后（或加载登录态后页面正常显示），在进入逐页探测前，先快速探测侧边栏/顶部菜单布局：

```bash
agent-browser snapshot -i    # 获取首页菜单结构
```

记录以下信息到 dom-probe.md 的「菜单布局」章节：
- 菜单类型：侧边栏 / 顶部导航 / 混合
- 目标功能在菜单中的路径（如：财务管理 → 对账规则配置）
- 菜单项的选择器（如 `.el-menu-item:has-text("对账规则配置")`）
- 点击菜单项后的实际 URL（用于验证 routes.json 中的路由是否正确）

这一步的目的：
1. 验证目标页面的实际 URL — 避免从 routes.json 或 PRD 猜测的 URL 不正确
2. 发现需要展开子菜单才能到达的页面 — 有些路由在菜单中是嵌套的
3. 为后续逐页探测提供准确的导航路径

如果 routes.json 已提供了准确的路由且可以通过 URL 直接访问，此步骤可快速完成（只需验证 1-2 个页面的 URL 正确性）。

## 步骤二：逐页探测 + 交互探测 + 快速验证

### 2a. 页面级探测

根据 routes.json（如有）或 PRD 功能列表，导航到每个目标页面：

#### 页面级并行探测策略

当目标页面 ≥ 3 个时，可对独立页面同时打开最多 2 个 tab 并行探测，减少串行等待：

```
并行规则：
- 最多 2 个并行 tab（避免资源竞争导致 snapshot 不稳定）
- 只有页面级探测（2a）可并行——交互后探测（2b）必须串行（弹窗会互相遮挡）
- 两个并行页面必须是独立功能（不共享状态），如"对账规则配置"和"对账记录查询"可并行，"新增规则"和"规则列表"不可并行（新增会影响列表）
- 并行 tab 的 snapshot 结果分别记录到各自的页面章节
```

串行探测（默认）：

```bash
agent-browser open <目标页面URL>
agent-browser wait --load load
agent-browser snapshot -i
```

每个页面记录：
- 实际路由路径（可能与设计文档不一致）
- 路由模式：通过 URL 中是否包含 `#/` 判断（hash 或 history）
- 完整 URL 路径：hash 模式为 `/#/path`，history 模式为 `/path`（直接拼接到 baseUrl 后即可访问）
- UI 框架识别：通过 CSS 类名前缀判断（`.el-` = Element Plus，`.ant-` = Ant Design，`.n-` = Naive UI）
- 关键交互元素的真实选择器：按钮、输入框、下拉选择器、表格、弹窗、开关、标签页
- **data-testid 优先规则**：snapshot 中元素包含 `data-testid` 属性时，选择器列使用 `getByTestId('xxx')` 格式（Playwright 原生 API），不使用 CSS 属性选择器 `[data-testid="xxx"]`。无 `data-testid` 的元素保持原有 CSS 选择器记录方式不变。有 `data-testid` 的元素置信度直接标记为 `verified`（开发者显式标注，不因渲染变化）。
- 页面状态：是否有加载动画、空状态提示等
- **页面初始状态**（必须记录）：
  - 哪些区域默认收起（筛选区、折叠面板、展开行等）
  - 哪些元素需要前置操作才能可见（如点击"展开"按钮）
  - 多实例元素：同一选择器匹配到多个 DOM 节点时，记录每个实例的用途和区分方式（如 el-table 影子表）

#### iframe 页面探测

snapshot 中检测到 `iframe` 元素时，加载 skill `iframe-explorer`，按其流程探测 iframe 内容：

1. 执行 `agent-browser snapshot -i`，确认 iframe 内容已内联到 accessibility tree
2. 使用 iframe-explorer 的 `eval` 脚本获取 iframe 详细属性（src、跨域状态、尺寸）
3. 同域 iframe → `frame @<ref>` 进入上下文探测内部 DOM
4. 跨域 iframe → 直接导航到 iframe src 探测

iframe 探测结果记录到 dom-probe.md 的对应页面章节：

```markdown
#### iframe 探测结果
| # | id/title | src | 跨域 | 内部关键元素 |
|---|----------|-----|------|------------|
| 1 | xxx | https://... | 否 | 导航栏、内容区、侧边栏 |
```

### 2a-pre. 探测规划（PRD + UI 原型驱动）

⚠️ **此步骤输出的是探测规划，不是 dom-probe.md 的内容。禁止将此步骤的输出直接写入 dom-probe.md。**

在运行时探测前，基于 PRD 功能表和 ui-prototype-analysis.json（如存在）生成探测规划清单。
探测规划驱动后续 agent-browser 探测，确保不遗漏非标准交互（如条件渲染、联动、批量操作）。

**生成方式**：

1. 从 PRD 功能表提取所有操作类型（不限于新增/编辑/删除）：
   - 标准 CRUD：新增、编辑、删除、查询
   - 状态操作：启用/禁用、审批/驳回、发布/撤回
   - 批量操作：批量删除、批量导出、批量修改状态
   - 联动操作：类型切换后表单字段变化、级联选择
   - 条件渲染：不同状态下按钮可见性变化、权限控制
2. 从 ui-prototype-analysis.json（如存在）补充 PRD 未明确的交互：
   - 按钮文字 → 操作类型
   - 弹窗标题 → 关联操作
   - 表单字段 → 输入类型
3. 输出探测规划到 `.cache/probe-plan.md`（**不是 dom-probe.md**）：

```markdown
## 探测规划（仅用于指导 agent-browser 探测，不是探测结果）

| 序号 | 操作类型 | 触发元素（待探测确认） | 预期结果 | 来源 |
|------|---------|-------------------|---------|------|
| 1 | 新增 | "新增"按钮（选择器待 snapshot 确认） | 弹出新增弹窗 | PRD 功能表 |
| 2 | 编辑 | 行内"编辑"按钮（选择器待 snapshot 确认） | 弹出编辑弹窗 | PRD 功能表 |
```

此文件仅作为步骤 2b 交互后探测的检查清单，探测完成后可删除。

### 2a-api. API 路径记录（必须执行，不可跳过）

**⛔ 此步骤是强制要求**——dom-probe.md 中的 `#### API 路径记录` 表格是 script-writer 写 `waitForResponse` 路径的唯一权威来源。缺失此表格时，script-writer 会错误地从 api-probe.md（后端 Swagger 目录）取路径，导致等待前端从未发出的接口而永久超时。

在逐页探测过程中，开启 API 路径记录，捕获每次交互触发的实际 API 请求。
记录到 dom-probe.md 的对应页面章节中，供后续脚本生成时使用。

**记录方式**：在每个页面探测开始时，通过 Playwright 的 response 事件监听：

```javascript
const apiPaths = [];
page.on('response', response => {
  const url = response.url();
  if (url.includes(API_PREFIX) && !url.includes('.js') && !url.includes('.css')) {
    apiPaths.push({
      method: response.request().method(),
      url: url,
      status: response.status(),
      triggeredBy: currentInteraction  // 当前正在执行的交互操作
    });
  }
});
```

每次交互后记录触发的 API 请求，输出到 dom-probe.md：

```markdown
#### API 路径记录
| 交互操作 | 请求方法 | API 路径 | 状态码 |
|---------|---------|---------|--------|
| 页面加载 | GET | /finance/statement-rules/list | 200 |
| 点击新增→保存 | POST | /finance/statement-rules/add | 200 |
| 点击编辑→保存 | PUT | /finance/statement-rules/update | 200 |
| 点击删除→确认 | DELETE | /finance/statement-rules/delete/{id} | 200 |
```

### 2b. 交互后探测（按交互清单逐一探测）

页面级 snapshot 只能看到当前可见的 DOM。弹窗、抽屉、下拉菜单等需要交互后才出现。
不做这一步，E2E 脚本中的弹窗选择器全靠猜测，首次执行必然大面积失败。

#### 交互后探测优化

1. **批量 snapshot**：打开弹窗后，一次 snapshot 提取所有信息（表单字段+按钮+标题），不需要多次 snapshot
2. **跳过重复弹窗**：如果新增弹窗和编辑弹窗结构相同（通过弹窗标题判断），只探测一次，在 dom-probe.md 中标注"编辑弹窗结构同新增弹窗"
3. **简单弹窗快速处理**：删除确认弹窗（el-message-box）结构固定，只需记录确认按钮文字和提示文案，不需要完整 snapshot
4. **el-popconfirm 快速处理**：气泡确认框结构固定（确认+取消两个按钮），只需记录按钮文字

按交互清单逐一探测（不再局限于新增/编辑/删除三种操作）：

对每个页面，按交互清单中的操作逐一执行：
1. 点击"新增/添加"按钮 → snapshot 弹窗内部的表单结构
   - 记录弹窗标题、表单字段标签、输入框类型
   - 记录按钮文字（是"确定"还是"保存"还是"提交"）
   - 记录下拉选择框的默认值和 placeholder
   - 记录必填字段标记（红色星号）
2. 如果有编辑功能 → 点击编辑按钮 → snapshot 编辑弹窗（可能与新增弹窗不同）
3. 如果有删除功能 → 点击删除按钮 → snapshot 确认对话框的按钮文字
4. 关闭弹窗后继续下一个交互
5. 如果有开关/状态切换 → 点击开关 → 记录 API 请求和状态变化
6. 如果有批量操作 → 勾选多行 → 点击批量操作按钮 → snapshot 确认弹窗
7. 如果有联动操作（如类型切换） → 切换选项 → snapshot 表单字段变化
8. 交互清单中的其他操作 → 逐一执行并 snapshot

每次交互后的 snapshot 记录到 dom-probe.md 的对应页面章节中，
标注"交互触发方式"（如"点击 .el-button--primary:has-text('新增')"）。

不要跳过这一步——页面级探测只覆盖了列表页的表格和按钮，
弹窗内的表单字段、按钮文字、下拉选项才是 E2E 脚本最容易出错的地方。

#### 状态变化快照（交互前后对比）

对每个状态切换操作（按钮激活/取消、Tab 切换、展开/收起、开关切换），
必须记录交互前后同一元素的 class 属性差异。script-writer 依赖此信息生成精确的状态断言，
缺失时 script-writer 只能猜测 class 名称（如误用 `toHaveClass(/active/)`），导致大量测试失败。

记录方式：在每个交互操作章节末尾添加"状态变化快照"表格。

```markdown
### 状态变化快照

| 操作 | 元素选择器 | 交互前 class | 交互后 class | 状态标识 |
|------|-----------|-------------|-------------|---------|
| 点击"汇总显示" | `button:has-text("汇总显示")` | `el-button el-button--default` | `el-button el-button--primary` | 激活=--primary |
| 点击 Tab"我的请购单" | `.el-tabs__item:nth(2)` | （无 is-active） | `is-active` | 激活=is-active |
| 展开表格行 | `.el-table__expand-icon` | （无 --expanded） | `el-table__expand-icon--expanded` | 展开=--expanded |
| 切换开关 | `.el-switch` | （无 is-checked） | `is-checked` | 开启=is-checked |
```

获取方式：
1. 交互前：`agent-browser snapshot` 获取元素当前 class
2. 执行交互操作（点击按钮/切换 tab 等）
3. 交互后：`agent-browser snapshot` 获取同一元素变化后的 class
4. 对比两次 snapshot 中该元素的 class 差异，记录到表格

**至少覆盖以下交互类型的状态变化**（如果页面上存在这些组件）：
- 模式切换按钮（如"汇总显示"/"明细显示"）
- Tab 标签页切换
- 表格行展开/收起
- 开关/切换组件
- 折叠面板展开/收起

### 2c. 快速验证（有 dom-probe-skeleton.json 时）

将 snapshot 中的实际选择器与 dom-probe-skeleton.json 中推断的选择器对比：
- skeleton 中为 `getByTestId('xxx')` 格式（有 data-testid）→ 直接标记为 `verified`，无需与 snapshot CSS 对比（testid 是开发者显式标注，运行时稳定）
- 其他选择器匹配 → 标记为 `verified`
- 不匹配 → 用 snapshot 中的真实选择器替换，标记为 `verified`
- skeleton 中有但 snapshot 中找不到 → 标记为 `missing`，可能是动态渲染元素

## 步骤三：输出 DOM 探测报告

生成 `$WORK_DIR/testing/dom-probe.md`。

**⛔ dom-probe.md 必须直接生成在 `$WORK_DIR/testing/` 根目录，禁止写入 `$WORK_DIR/testing/.cache/` 或其他子目录。**
verify-probe.js、gen-skeleton.js、gen-selectors.js 等下游脚本均从 `testing/dom-probe.md` 读取。
写入 `.cache/` 会导致验证脚本找不到文件、骨架生成跳过 E2E、selectors 引导失败。

格式：

**⛔ 时间戳必须使用 `new Date().toISOString()` 的真实值，禁止手动填写整点时间（如 `03:30:00.000Z`）。整点时间是 LLM 伪造的特征，gate-check 会检测并拒绝。**

**格式强制要求（gen-skeleton.js 依赖以下格式进行自动解析）：**

1. 交互后探测章节标题必须为 `#### 交互后探测：{操作类型}{弹窗/组件}`，操作类型为：新增、编辑、删除确认
2. 弹窗类型必须单独一行，格式为 `- 弹窗类型：\`{类型}\``，类型为 CSS 类名（不含点号），如 `el-dialog`、`el-message-box`、`el-popconfirm`
3. 确认按钮文字必须用粗体标记：`- 确认按钮文字：**{文字}**`
4. 取消按钮文字格式：`- 取消按钮文字：{文字}`
5. 表单字段表格的「类型」列只允许以下值：`input`、`select`、`textarea`、`date`、`number`、`radio`、`checkbox`、`switch`
6. 表单字段表格的「必填」列只允许 `✅` 或 `❌`
7. 如果有编辑弹窗且与新增弹窗结构不同，必须单独记录 `#### 交互后探测：编辑弹窗` 章节
8. 如果页面有开关/切换操作，在关键元素选择器表格中记录开关选择器，描述包含"开关"或"切换"关键词

```markdown
# DOM 探测报告

## 基本信息
- UI 框架：Element Plus
- 选择器前缀：.el-
- 探测时间：{时间戳}
- 前端地址：{baseUrl}

## 页面初始状态

> ⚠️ 此章节为必填——script-writer 依赖此信息生成前置操作步骤。
> 未记录初始状态会导致脚本直接操作不可见元素而失败。

| 页面 | 区域 | 默认状态 | 激活方式 | 选择器 |
|------|------|---------|---------|--------|
| 列表页 | 筛选区 | 收起 | 点击"展开"按钮 | `button:has-text("展开"), .filter-expand-btn` |
| 列表页 | 展开行 | 收起 | 点击行首展开图标 | `.el-table__expand-icon` |

## 多实例元素说明

> ⚠️ 此章节为必填——Element Plus 的固定列、影子表等会产生多个同选择器 DOM 节点。
> 未记录多实例信息会导致 `.first()` 选中隐藏元素。
> verify-probe.js 会自动检测多实例选择器并输出 WARNING，探测步骤必须根据 WARNING 补充此章节。

### 自动多实例检测

对 snapshot 中出现的以下选择器，统计 DOM 中的实例数量：

| 选择器模式 | 检测方式 |
|-----------|---------|
| `.el-table` | snapshot 中搜索 `el-table` 标签出现次数（排除 `.el-table__` 子元素） |
| `.el-tabs__item` | 计数 `el-tabs__item` class 出现次数 |
| `.el-form` | 排除 `el-form-item`，仅计数顶级 `el-form` |
| `.el-dialog__wrapper` | 计数可见的 `dialog wrapper` |

计数 > 1 时，自动填充下表中的对应行：

| 选择器 | 实例数 | 区分方式 | 推荐定位 |
|--------|--------|---------|---------|
| `.el-table.super-table` | 2 | 第一个 display:none（影子表），第二个 display:flex（主表） | `.last()` 或可见性过滤 |

## 状态变化快照

> ⚠️ 此章节为必填（当页面包含状态切换操作时）——script-writer 依赖此信息生成精确的 toHaveClass 断言。
> 缺失时 script-writer 会猜测 class 名称，导致 toHaveClass(/active/) 等错误断言。

（由交互探测步骤 2b 的"状态变化快照"章节填充。格式见步骤 2b 说明。）

## 运行时干扰处理

探测时必须记录以下信息（用于自动生成覆盖层抑制脚本）：

| 字段 | 说明 | 示例 |
|------|------|------|
| 干扰类型 | 描述性名称 | 引导遮罩 |
| CSS 选择器 | 覆盖层容器的 CSS class | `.el-tour` |
| 关闭选择器 | 关闭按钮的选择器 | `.el-tour__close` |
| localStorage key | 禁止再次出现的 key（如有） | `el-tour-status` |
| localStorage value | 对应的值 | `finished` |
| 触发条件 | 何时出现 | 首次访问 / 路由切换后 / 版本变化 |

示例记录：
| 干扰类型 | CSS 选择器 | 关闭选择器 | localStorage key | localStorage value | 触发条件 |
|---------|-----------|-----------|-----------------|-------------------|---------|
| 引导遮罩 | `.el-tour` | `.el-tour__close` | `el-tour-status` | `finished` | 首次访问 |
| 版本更新 | `.update-dialog` | `.update-dialog .close-btn` | — | — | 版本变化 |

注意：
- CSS 选择器是覆盖层**容器**的选择器（如 `.el-tour`），不是关闭按钮的选择器
- 覆盖层可能在路由切换、弹窗打开后重建，需要记录触发条件
- 如果无法找到 localStorage key，填 "—"，生成时会跳过该项

## 页面探测结果

### 菜单布局
- 菜单类型：侧边栏
- 目标功能路径：{一级菜单} → {二级菜单} → {目标页面}
- 菜单选择器：`.el-menu-item:has-text("{目标页面名称}")`

### 页面：{功能名称}
- 实际路由：/xxx/yyy
- 路由模式：hash 或 history（hash 模式的完整路径为 /#/xxx/yyy）
- 完整 URL 路径：/#/xxx/yyy（直接拼接到 baseUrl 后即可访问，禁止包含中文说明）
- 设计文档路由：/aaa/bbb（如不一致则标注）

#### 关键元素选择器
| 元素描述 | 选择器 | 置信度 | 类型 |
|---------|--------|--------|------|
| 新增按钮 | `getByTestId('prd-btn-create')` | verified | button |
| 数据表格 | `.el-table` | verified | table |
| 搜索输入框 | `getByTestId('search-input')` | verified | input |

#### 交互后探测：新增弹窗
- 触发方式：点击 `.el-button--primary:has-text("新增")`
- 弹窗类型：`el-dialog`
- 弹窗标题：新增规则
- 确认按钮文字：**保存**

| 表单字段 | 选择器 | 类型 | 默认值/placeholder | 必填 |
|---------|--------|------|-------------------|------|
| 规则名称 | `.el-dialog .el-input:nth(0) input` | input | (空) | ✅ |
| 对账类型 | `.el-dialog .el-select:nth(0)` | select | 已有默认值"按日对账" | ✅ |
| 时间周期 | `.el-dialog .el-select:nth(1)` | select | 按自然月 | ✅ |

#### 交互后探测：编辑弹窗
- 触发方式：点击 `.el-table__row` 行内 `编辑` 按钮
- 弹窗类型：`el-dialog`
- 弹窗标题：编辑规则
- 确认按钮文字：**保存**
- 与新增弹窗结构：相同 / 不同（如不同则列出差异字段）

#### 交互后探测：删除确认弹窗
- 触发方式：点击 `.el-table__row` 行内 `删除` 按钮
- 弹窗类型：`el-message-box`
- 确认按钮文字：**确定**
- 取消按钮文字：取消
```

## 步骤四：探测完整性验证

DOM 探测完成后，运行验证脚本检查是否遗漏了关键交互后探测：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-probing/scripts/verify-probe.js" --testing-dir "$WORK_DIR/testing" --prd-dir "$WORK_DIR/${paths.prd}"
```

`paths.prd` 从 test-config.json 读取，默认 `requirement/prd`。

脚本对比 PRD 功能描述与 dom-probe.md 内容：
- PRD 中有"新增/编辑"功能但 dom-probe.md 中没有弹窗选择器 → 🔴 高优先级警告
- PRD 中有表单功能但 dom-probe.md 中没有表单选择器 → 🔴 高优先级警告
- PRD 中有下拉/分页/上传但 dom-probe.md 中没有对应选择器 → 🟡 中优先级警告

高优先级警告必须回到步骤二补充交互后探测，中优先级警告记录但不阻塞。
这样 LLM 不需要"记住"必须做交互后探测——脚本会告诉它哪些遗漏了。

### 补充探测前：会话有效性验证

回到步骤二补充探测前，**必须先验证当前浏览器会话是否仍然有效**：

1. 执行 `agent-browser snapshot -i`
2. 如果 snapshot 返回可交互元素（>5 个且不包含登录表单）→ 会话有效，继续补充探测
3. 如果 snapshot 显示登录表单、页面空白、或元素极少 → 会话已过期
   - 加载 `auto-login-passport` skill 按「优先级判定」重新获取登录态
   - 获取成功后重新加载：`agent-browser state load $WORK_DIR/testing/auth/storage-state.json` → 重新验证

**禁止在会话失效时继续操作页面**——所有后续 snapshot 和交互都会失败或返回登录页内容。

## 步骤五：更新配置

更新 `test-config.json`：
- `frontend.uiFramework`：填入识别到的 UI 框架名称
- `frontend.routePrefix`：填入实际路由前缀
- `progress.domProbe`：设为 `"done"`
