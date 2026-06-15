// E2E 脚本代码模板
// 文件路径：scripts/e2e/tests/{功能模块}.spec.ts
// 选择器规则、作用域规则、异步等待规则详见 e2e-case-writing.md 和 element-plus-scripting-rules.md

import { test, expect } from '../fixtures';
import path from 'path';

// 路径锚点：集成模式用 WORK_DIR，standalone 模式 fallback 到 process.cwd()
const WORK_DIR = process.env.WORK_DIR || process.cwd();
const IS_STANDALONE = !process.env.WORK_DIR;
// 截图路径：集成 → testing/screenshots/，standalone → screenshots/
const SCREENSHOTS_DIR = IS_STANDALONE
    ? path.resolve(process.cwd(), 'screenshots')
    : path.resolve(WORK_DIR, 'testing/screenshots');
// storage-state 路径：集成 → testing/auth/，standalone → .cache/.auth/
const STORAGE_STATE_PATH = IS_STANDALONE
    ? path.resolve(process.cwd(), '.cache', '.auth', 'storage-state.json')
    : path.resolve(WORK_DIR, 'testing/auth/storage-state.json');
// API_PREFIX 用于 waitForResponse 的 URL 匹配
const API_PREFIX = process.env.API_PREFIX || '';
const TS = Date.now(); // 每次运行唯一时间戳，避免数据名称重复

// 页面路由从 dom-probe.md 的「完整 URL 路径」字段提取
// hash 模式：'/#/finance/statement-rule-config'  history 模式：'/finance/statement-rule-config'
const ROUTE = '/#/actual-route-from-dom-probe';

// ── 菜单树导航辅助（tree-context.json 存在时使用） ──
// 从 tree-context.json 的 menuTree.navigation 生成
const NAV = {
  // 示例：按实际 menuTree 数据替换
  // prql: {
  //   url: '/inventory/purchase-requisition-detailList',
  //   menuPath: ['进销存', '请购申请列表'],
  // },
} as const;

/** 通过侧边菜单导航到目标页面（带错误处理）
 * 从 tree-context.json 的 menuTree.navigation 生成调用
 * 使用 Promise.race 多信号等待，处理 SPA 内部路由场景
 */
async function navigateViaMenu(page: any, target: keyof typeof NAV) {
  const navConfig = NAV[target as keyof typeof NAV];
  if (!navConfig) return; // NAV 为空对象时直接返回
  const { menuPath, url } = navConfig as { menuPath: string[]; url: string };
  const lastLabel = menuPath[menuPath.length - 1];

  // 设置多信号等待（点击前注册，避免竞态）
  const responsePromise = page.waitForResponse(
    (r: any) => r.url().includes(url), { timeout: 5000 }
  ).catch(() => null);

  // 点击菜单项
  await page.locator(
    `.el-menu-item:has-text("${lastLabel}"), .el-sub-menu__title:has-text("${lastLabel}")`
  ).first().click();

  // 多信号等待：响应 / URL变化 / 超时
  const result = await Promise.race([
    responsePromise,
    page.waitForURL(`**/*${url}*`, { timeout: 5000 }).catch(() => null),
  ]);

  if (!result) {
    // fallback: 验证菜单项激活或 URL 包含目标路径
    await page.waitForFunction(
      (targetUrl: string) => window.location.href.includes(targetUrl) || window.location.hash.includes(targetUrl),
      url, { timeout: 3000 }
    ).catch(() => console.warn(`[WARN] 导航 fallback 检测失败: ${String(target)}`));
  }
}

// 选择器常量（来自 dom-probe.md）
// ⚠️ el-message-box 确认弹窗必须加容器限定：
//   ✓ '.el-message-box button.el-button--primary:has-text("确定")'
// ⚠️ 弹窗内文本输入框禁止用 '.el-input input'——el-select 内部也有隐藏 input，会 selector_ambiguous
//   ✓ 用 getByPlaceholder('占位符') 或 '.el-form-item:has(.el-form-item__label:has-text("字段名")) input'
// ⚠️ 禁止用 '.el-select:nth-of-type(N)' 定位下拉框——nth-of-type 按 div 标签计数，不按 class
//   ✓ 用 '.el-form-item:has(.el-form-item__label:has-text("字段名")) .el-select'
const SEL = {
  // 由 gen-skeleton.js 自动生成的结构选择器
  // table, tableRow, addBtn, dialog, dialogSaveBtn, deleteConfirmBtn 等
  // ── 表单字段（来自 dom-probe.md 交互后探测）──
};

// ── Element Plus 运行时辅助函数 ──

/** el-input-number 的 fill() 不触发 Vue change 事件，必须用此函数替代
 * 适用于所有 el-input-number 组件（对账日、数量、金额等数值输入框）
 */
async function fillNumberInput(page: any, selector: string, value: number | string) {
  const input = page.locator(selector);
  await input.click();
  await input.fill('');
  await input.pressSequentially(String(value), { delay: 50 });
  await input.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await input.blur();
}

/** 编辑弹窗打开后等待数据回显完成
 * 编辑弹窗的数据通过 API 异步加载，直接读取可能拿到空值
 */
async function waitForFormPopulated(page: any, fieldSelector: string, timeout = 5000) {
  await expect(page.locator(fieldSelector)).not.toHaveValue('', { timeout });
}

/** 等待错误提示出现（宽松匹配）
 * el-message 的文字可能是"操作失败"、"网络异常"等，不要硬匹配特定文字
 * ⚠️ 禁止用 .or() 复合 locator——两侧都匹配时合并结果含多个元素，strict mode 下 toBeVisible() 报错
 * ✓ 用多选择器 CSS 字符串代替 .or()
 */
async function waitForErrorMessage(page: any, timeout = 5000) {
  await expect(
    page.locator('.el-message--error, .el-message.is-error, .el-notification--error, .el-notification.is-error')
  ).toBeVisible({ timeout });
}

/** 等待覆盖层消失（弹窗关闭动画、loading mask 等）
 * Element Plus 弹窗关闭有 ~300ms 动画，期间 el-overlay 仍可见
 * 在关闭弹窗后、继续操作前调用，避免 overlay 遮挡后续点击
 */
async function waitForOverlayGone(page: any, timeout = 3000) {
  const overlay = page.locator('.el-overlay:not(.el-dialog__wrapper):not(.el-drawer__wrapper)');
  if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expect(overlay).not.toBeVisible({ timeout });
  }
}

/** 等待 Element Plus 页面级 loading 遮罩消失 */
async function waitForLoading(page: Page, timeout = 5000) {
  const mask = page.locator('.el-loading-mask');
  if (await mask.isVisible({ timeout: 500 }).catch(() => false)) {
    await expect(mask).not.toBeVisible({ timeout });
  }
}

/** 关闭 el-tour 引导弹窗（如果存在）
 * 在每个可能触发 tour 的点击操作之后立即调用（新增/编辑/删除按钮点击后）
 */
async function dismissTour(page: any) {
  await page.evaluate(() => {
    // 覆盖 .el-tour 及所有子元素（含 .el-tour__hollow path 元素，它才是实际拦截 pointer-events 的元素）
    if (!document.getElementById('test-tour-suppression')) {
      const style = document.createElement('style');
      style.id = 'test-tour-suppression';
      style.textContent = '.el-tour, .el-tour *, .el-tour__hollow { display: none !important; pointer-events: none !important; }';
      document.head.appendChild(style);
    }
    // 立即隐藏当前已存在的 tour 元素
    document.querySelectorAll<HTMLElement>('.el-tour').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
    // MutationObserver 持续压制：Vue 异步重挂载 tour 时自动隐藏
    if (!(window as any).__tourObserver) {
      (window as any).__tourObserver = new MutationObserver(() => {
        document.querySelectorAll<HTMLElement>('.el-tour').forEach(el => {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        });
      });
      (window as any).__tourObserver.observe(document.body, { childList: true, subtree: true });
    }
  });
  // 等待 tour 真正消失后再继续，避免后续操作被遮罩拦截
  await page.waitForSelector('.el-tour', { state: 'hidden', timeout: 3000 }).catch(() => {});
}

test.describe('{模块名称}', () => {
  // ── beforeAll/afterAll 测试数据准备（需要创建/清理数据时使用）──
  // ⚠️ 禁止用 browser.newPage()——不继承 storageState，API 请求无 auth cookie 必然失败
  // ✓ 必须用 browser.newContext({ storageState }) 再 context.newPage()
  let createdId: string;
  test.beforeAll(async ({ browser }) => {
    const storageStatePath = STORAGE_STATE_PATH;
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(`${process.env.FRONTEND_URL}${ROUTE}`);
    await expect(page.locator(SEL.table)).toBeVisible({ timeout: 15000 });
    // 创建测试数据...
    // ⚠️ 数据名称必须包含 TS 时间戳后缀确保唯一性
    // createdId = 从 API 响应中提取
    await context.close();
  });
  test.afterAll(async ({ browser }) => {
    if (!createdId) return;
    const storageStatePath = STORAGE_STATE_PATH;
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    // 清理测试数据（用 page.request，不用 page.evaluate fetch）
    await page.request.delete(`${process.env.BACKEND_URL}${API_PREFIX}/具体路径/${createdId}`);
    await context.close();
  });

  /**
   * el-tour 处理策略
   *
   * 两层防护：
   * 1. fixtures.ts 中的 addInitScript 抢先注入 CSS 压制（已自动生效）
   * 2. beforeEach 中主动点击关闭按钮（作为补充）
   *
   * 注意：测试用例中不再需要调用 dismissTour
   */
  test.beforeEach(async ({ page }) => {
    // 优化：检查页面是否已在目标位置且数据已加载
    // 只读测试（断言字段值、列名等）可复用上一个 test 的页面状态
    // 写操作（新增/编辑/删除）后需在 test 末尾 await page.reload() 触发重新加载
    const currentUrl = page.url();
    const routeHash = ROUTE.replace('/#', '#');
    const isOnTargetPage = currentUrl.includes(routeHash);
    const tableVisible = isOnTargetPage
      && await page.locator(SEL.table).isVisible({ timeout: 2000 }).catch(() => false);

    if (!tableVisible) {
      await page.goto(`${process.env.FRONTEND_URL}${ROUTE}`);

      // 等待页面数据就绪：数据依赖元素可见 = API 已返回 + Vue 已渲染
      // 禁止 waitForResponse——SPA 中 API 返回不代表 DOM 已更新，且存在竞态条件
      // 禁止 waitForTimeout——非确定性等待违反规范
      await expect(page.locator(SEL.table)).toBeVisible({ timeout: 15000 });
      await waitForLoading(page);
    }

    // 第二层 tour 防护（第一层 addInitScript 已处理绝大多数）
    const closeBtn = page.locator('button.el-tour__closebtn, button.el-tour__close');
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
    }
  });

  // 测试用例中不再需要 dismissTour 调用
  test('{TC编号}: {测试描述}', async ({ page }) => {
    await expect(page.locator('.selector-from-dom-probe')).toBeVisible();
    await page.screenshot({
      path: path.resolve(SCREENSHOTS_DIR, '{TC编号}_01.png')
    });
  });

  // 新增操作模板
  test('{TC编号}: 新增{实体}', async ({ page }) => {
    // beforeEach 已处理 tour，直接操作
    await page.locator(SEL.addBtn).click();
    await expect(page.locator(SEL.dialog)).toBeVisible();

    // 填写表单（使用 SEL 中的 form* 字段选择器）
    // 数值输入框用 fillNumberInput 替代 fill()
    // await fillNumberInput(page, SEL.formAmount, 100);

    const [response] = await Promise.all([
      page.waitForResponse(r =>
        r.url().includes(`${API_PREFIX}/具体接口路径`) &&
        r.status() >= 200 && r.status() < 300
      ),
      page.locator(SEL.dialogSaveBtn).click(),
    ]);
    const body = await response.json();
    expect(body.success).toBe(true);
    // 写操作后重新加载，确保 beforeEach 检测到页面状态变化并重新 goto
    await page.reload();
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '{TC编号}_01.png') });
  });

  // 编辑操作模板
  test('{TC编号}: 编辑{实体}', async ({ page }) => {
    test.skip(!createdId, '测试数据未创建，跳过');
    const targetRow = page.locator(SEL.tableRow).last();
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    // beforeEach 已处理 tour，直接操作
    await targetRow.getByRole('button', { name: '编辑' }).click();
    await expect(page.locator(SEL.dialog)).toBeVisible();

    // 等待编辑弹窗数据回显完成后再操作
    // await waitForFormPopulated(page, SEL.formRuleName);

    const [response] = await Promise.all([
      page.waitForResponse(r =>
        r.url().includes(`${API_PREFIX}/具体接口路径`) &&
        r.status() >= 200 && r.status() < 300
      ),
      page.locator(SEL.dialogSaveBtn).click(),
    ]);
    const body = await response.json();
    expect(body.success).toBe(true);
    await page.reload();
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '{TC编号}_01.png') });
  });

  // 删除操作模板
  test('{TC编号}: 删除{实体}', async ({ page }) => {
    test.skip(!createdId, '测试数据未创建，跳过');
    const targetRow = page.locator('.el-table__row').filter({ hasText: `目标数据_${TS}` });
    // beforeEach 已处理 tour，直接操作
    await targetRow.getByRole('button', { name: '删除' }).click();

    await expect(page.locator('.el-message-box')).toBeVisible();
    await Promise.all([
      page.waitForResponse(r =>
        r.url().includes(`${API_PREFIX}/具体接口路径`) &&
        r.status() >= 200 && r.status() < 300
      ),
      page.locator('.el-message-box button.el-button--primary:has-text("确定")').click(),
    ]);
    await page.reload();
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '{TC编号}_01.png') });
  });

  // 开关/切换操作模板
  test('{TC编号}: 切换{实体}状态', async ({ page }) => {
    const targetRow = page.locator(SEL.tableRow).last();
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    // beforeEach 已处理 tour，直接操作
    // el-switch 必须点击 .el-switch__core，点击外层 div 可能不触发 change
    const toggle = targetRow.locator('.el-switch__core');
    const wasBefore = await targetRow.locator('.el-switch').getAttribute('aria-checked');

    await Promise.all([
      page.waitForResponse(r =>
        r.url().includes(`${API_PREFIX}/具体接口路径`) &&
        r.status() >= 200 && r.status() < 300
      ),
      toggle.click(),
    ]);

    const wasAfter = await targetRow.locator('.el-switch').getAttribute('aria-checked');
    expect(wasAfter).not.toBe(wasBefore);
    await page.reload();
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '{TC编号}_01.png') });
  });

  // ── 表单验证失败模板 ──
  test('{TC编号}: 表单验证失败-{场景}', async ({ page }) => {
    await page.locator(SEL.addBtn).click();
    await expect(page.locator(SEL.dialog)).toBeVisible();
    // 不填写必填字段，直接点击保存
    await page.locator(SEL.dialogSaveBtn).click();
    // 验证错误提示可见
    await expect(page.locator('.el-form-item__error')).toBeVisible();
    // 验证弹窗未关闭
    await expect(page.locator(SEL.dialog)).toBeVisible();
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '{TC编号}_01.png') });
  });

  // ── API 异常 Mock 模板 ──
  test('{TC编号}: {操作}失败-接口异常', async ({ page }) => {
    // Mock 接口返回错误
    await page.route(`**${API_PREFIX}/具体接口路径`, route => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: -1, msg: '服务器错误' }) });
    });
    // 执行操作...
    await page.locator(SEL.addBtn).click();
    await expect(page.locator(SEL.dialog)).toBeVisible();
    // 填写表单后提交
    await page.locator(SEL.dialogSaveBtn).click();
    // 验证错误提示可见
    await waitForErrorMessage(page);
    // 验证页面状态不变（弹窗未关闭、数据未变化）
    await expect(page.locator(SEL.dialog)).toBeVisible();
    await page.screenshot({ path: path.resolve(SCREENSHOTS_DIR, '{TC编号}_01.png') });
    // 清理 route mock
    await page.unroute(`**${API_PREFIX}/具体接口路径`);
  });
});
