#!/usr/bin/env node
/**
 * CAS/SSO 场景专用探测脚本
 * 使用 Playwright headed 模式进行探测，自动捕获所有访问域的 cookie（包括 SSO 域的 TGT）
 * 
 * 用法：
 *   node probe-with-playwright.js --config testing/test-config.json
 *   node probe-with-playwright.js --baseUrl http://localhost:9090 --storage-state ./auth/storage-state.json
 * 
 * 核心优势：
 *   - Playwright context.storageState() 会保存所有访问过的域的 cookie
 *   - CAS 跨域场景下 SSO TGT 不会丢失
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    config: null,
    baseUrl: null,
    storageState: null,
    apiPrefix: '',
    headless: false,
    headed: true,
    timeout: 120000,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      options.config = args[++i];
    } else if (args[i] === '--baseUrl' && args[i + 1]) {
      options.baseUrl = args[++i];
    } else if (args[i] === '--storage-state' && args[i + 1]) {
      options.storageState = args[++i];
    } else if (args[i] === '--api-prefix' && args[i + 1]) {
      options.apiPrefix = args[++i];
    } else if (args[i] === '--headless') {
      options.headless = true;
      options.headed = false;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      options.timeout = parseInt(args[++i]);
    }
  }

  // 从配置文件加载
  if (options.config && fs.existsSync(options.config)) {
    const config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
    const configDir = path.dirname(options.config);
    options.baseUrl = options.baseUrl || config.frontend?.baseUrl;
    options.apiPrefix = options.apiPrefix || config.backend?.apiPrefix || '';
    // 从 config.auth.storageStatePath 读取，支持相对路径
    options.storageState = options.storageState || 
      (config.auth?.storageStatePath
        ? path.resolve(configDir, config.auth.storageStatePath)
        : path.join(configDir, 'auth', 'storage-state.json'));
    // 从 config.auth.loginTimeout 读取超时时间
    if (!args.includes('--timeout') && config.auth?.loginTimeout) {
      options.timeout = config.auth.loginTimeout;
    }
  }

  return options;
}

/**
 * 检查页面是否需要登录
 */
async function checkNeedsLogin(page) {
  const url = page.url();
  
  // 检查 URL 关键词
  if (/login|signin|auth|passport|sso/i.test(url)) {
    return { needsLogin: true, reason: 'url_contains_login_keyword' };
  }

  // 检查登录表单
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    return { needsLogin: true, reason: 'password_input_found' };
  }

  // 检查 SPA 路由守卫（页面空白）
  try {
    const appContent = await page.$eval('#app', el => el.innerHTML.trim());
    if (!appContent || appContent.length < 100) {
      return { needsLogin: true, reason: 'spa_blank_page' };
    }
  } catch {
    // #app 不存在，可能是非 SPA 应用
  }

  // 检查可交互元素数量
  const interactiveCount = await page.$$eval(
    'button, a[href], input, select, textarea',
    els => els.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length
  );

  if (interactiveCount < 5) {
    return { needsLogin: true, reason: 'few_interactive_elements' };
  }

  return { needsLogin: false };
}

/**
 * 等待用户完成登录（有头模式）
 */
async function waitForLogin(page, options) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 浏览器已打开，请在浏览器中完成登录操作');
  console.log('   登录完成后，脚本将自动检测并继续探测');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const startTime = Date.now();
  const timeout = options.timeout || 120000;

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(2000);

    const result = await checkNeedsLogin(page);
    
    if (!result.needsLogin) {
      console.log('[OK] 登录成功！检测到页面内容已正常显示');
      return { success: true };
    }
  }

  console.error('[FAIL] 登录超时，请在 ' + Math.round(timeout / 1000) + ' 秒内完成登录');
  return { success: false, reason: 'timeout' };
}

/**
 * 获取可交互元素快照
 */
async function getInteractiveSnapshot(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [tabindex]:not([tabindex="-1"])'
    );

    const snapshot = [];
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        let selector;
        if (el.id) {
          selector = `#${el.id}`;
        } else if (el.getAttribute('data-testid')) {
          selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
        } else if (el.className && typeof el.className === 'string') {
          const classes = el.className.split(' ').filter(c => c && !c.startsWith('el-') && !c.startsWith('ant-'));
          selector = classes.length > 0 ? `.${classes.slice(0, 2).join('.')}` : el.tagName.toLowerCase();
        } else {
          selector = el.tagName.toLowerCase();
        }

        snapshot.push({
          ref: `@e${index + 1}`,
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.value || el.placeholder || '').trim().slice(0, 50),
          type: el.type || el.getAttribute('role') || '',
          selector,
          testid: el.getAttribute('data-testid') || null,
        });
      }
    });

    return snapshot;
  });
}

/**
 * 检测 CAS/SSO 登录
 */
async function detectCASSSO(page, initialUrl) {
  const currentUrl = page.url();
  const initialDomain = new URL(initialUrl).hostname;
  
  try {
    const currentDomain = new URL(currentUrl).hostname;
    
    if (currentDomain !== initialDomain) {
      if (/sso|cas|passport|oauth|auth/i.test(currentDomain)) {
        return {
          isCAS: true,
          ssoDomain: currentDomain,
          ssoUrl: currentUrl,
        };
      }
    }
  } catch {
    // URL 解析失败，忽略
  }

  // 检查 iframe 中的 SSO 登录
  const ssoIframe = await page.$('iframe[src*="sso"], iframe[src*="cas"], iframe[src*="passport"]');
  if (ssoIframe) {
    const src = await ssoIframe.getAttribute('src');
    try {
      return {
        isCAS: true,
        ssoDomain: new URL(src).hostname,
        ssoUrl: src,
      };
    } catch {
      // URL 解析失败
    }
  }

  return { isCAS: false };
}

/**
 * 主探测流程
 */
async function main() {
  const options = parseArgs();

  if (!options.baseUrl) {
    console.error('[FAIL] 缺少 --baseUrl 或 --config 参数');
    process.exit(1);
  }

  if (!options.storageState) {
    console.error('[FAIL] 缺少 --storage-state 参数');
    process.exit(1);
  }

  console.log('[INFO] Playwright 探测模式（支持 CAS/SSO）');
  console.log(`[INFO] 目标地址: ${options.baseUrl}`);
  console.log(`[INFO] 登录态保存路径: ${options.storageState}`);
  console.log(`[INFO] 模式: ${options.headless ? '无头' : '有头'}`);

  // 确保 storage-state 目录存在
  const storageDir = path.dirname(options.storageState);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // 启动浏览器
  const browser = await chromium.launch({ 
    headless: options.headless,
    args: options.headless ? [] : ['--start-maximized'],
  });

  // 加载已有的 storageState（如果有）
  let contextOptions = {};
  if (fs.existsSync(options.storageState)) {
    console.log('[INFO] 加载已有登录态...');
    contextOptions.storageState = options.storageState;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // API 请求记录
  const apiRequests = [];
  page.on('response', async response => {
    const url = response.url();
    if (options.apiPrefix && url.includes(options.apiPrefix) && !url.includes('.js') && !url.includes('.css')) {
      apiRequests.push({
        method: response.request().method(),
        url,
        status: response.status(),
      });
    }
  });

  try {
    // 导航到首页
    console.log('[INFO] 导航到首页...');
    await page.goto(options.baseUrl, { waitUntil: 'load', timeout: 30000 });

    // 检测是否需要登录
    let loginCheck = await checkNeedsLogin(page);

    if (loginCheck.needsLogin) {
      console.log(`[INFO] 检测到需要登录: ${loginCheck.reason}`);

      // 检测 CAS/SSO
      const casCheck = await detectCASSSO(page, options.baseUrl);
      if (casCheck.isCAS) {
        console.log(`[INFO] 检测到 CAS/SSO 登录: ${casCheck.ssoDomain}`);
      }

      // 尝试加载已有登录态
      if (fs.existsSync(options.storageState)) {
        console.log('[INFO] 已有登录态已加载，检查是否有效...');
        loginCheck = await checkNeedsLogin(page);
        if (!loginCheck.needsLogin) {
          console.log('[OK] 已有登录态有效');
        } else {
          console.log('[WARN] 已有登录态已过期');
        }
      }

      // 仍需要登录
      if (loginCheck.needsLogin && options.headed) {
        const loginResult = await waitForLogin(page, options);
        if (!loginResult.success) {
          process.exit(1);
        }
      } else if (loginCheck.needsLogin && options.headless) {
        console.error('[FAIL] 无头模式下无法完成登录，请使用 --headed 参数');
        process.exit(1);
      }
    } else {
      console.log('[OK] 页面无需登录或已登录');
    }

    // 保存完整的 storageState（关键：包含所有访问过的域的 cookie）
    await context.storageState({ path: options.storageState });
    console.log(`[OK] 登录态已保存: ${options.storageState}`);

    // 读取并报告保存的 cookie 信息
    const savedState = JSON.parse(fs.readFileSync(options.storageState, 'utf-8'));
    const domains = [...new Set(savedState.cookies.map(c => c.domain))];
    console.log(`[INFO] 已保存 ${savedState.cookies.length} 个 cookie，涉及域名: ${domains.join(', ')}`);

    // 检查 SSO 域的 TGT
    const ssoDomains = domains.filter(d => /sso|cas|passport|oauth|auth/i.test(d));
    if (ssoDomains.length > 0) {
      console.log(`[OK] 检测到 SSO 域 cookie: ${ssoDomains.join(', ')}`);
    }

    // 获取初始快照
    const snapshot = await getInteractiveSnapshot(page);
    console.log(`[INFO] 页面快照: ${snapshot.length} 个可交互元素`);

    // 输出结果
    const result = {
      success: true,
      storageStatePath: options.storageState,
      cookiesCount: savedState.cookies.length,
      domains,
      ssoDomains,
      interactiveElements: snapshot.length,
      apiRequests,
      snapshot,
    };

    // 写入结果文件
    const resultPath = path.join(path.dirname(options.storageState), 'probe-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`[OK] 探测结果已保存: ${resultPath}`);

  } catch (error) {
    console.error('[FAIL] 探测失败:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
