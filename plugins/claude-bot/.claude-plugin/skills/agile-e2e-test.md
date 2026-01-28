---
name: agile-e2e-test
description: 测试工程师技能：根据用户故事编写 E2E 测试（Playwright 推荐，支持 Cypress/Selenium/TestCafe），运行测试并报告结果，生成测试报告（e2e-test-report.md），发现缺陷时创建 bug-{id}.md
version: 1.0.0
---

# Agile E2E Test - 测试工程师技能

## 🎯 核心任务

基于用户故事和已实现的功能，编写并执行端到端（E2E）测试，验证完整的用户流程。

---

## 📋 执行流程

### 第一步：检测测试框架

```bash
# 自动检测项目使用的 E2E 测试框架
framework=""

# 1. 检查配置文件
if [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]; then
    framework="playwright"
elif [ -f "cypress.config.ts" ] || [ -f "cypress.config.js" ]; then
    framework="cypress"
elif [ -f "wdio.conf.ts" ] || [ -f "webdriver.json" ]; then
    framework="selenium"
elif [ -f ".testcaferc.json" ]; then
    framework="testcafe"
fi

# 2. 检查 package.json 依赖
if [ -z "$framework" ] && [ -f "package.json" ]; then
    if grep -q "@playwright/test" package.json; then
        framework="playwright"
    elif grep -q "cypress" package.json; then
        framework="cypress"
    elif grep -q "testcafe" package.json; then
        framework="testcafe"
    fi
fi

# 3. 如果未检测到，使用配置中的默认框架
if [ -z "$framework" ]; then
    framework=$(jq -r '.testingFrameworks.default // "playwright"' projects/active/config.json)
fi

echo "🔍 检测到测试框架: $framework"
```

---

### 第二步：读取用户故事

```bash
# 从参数获取故事 ID 或迭代编号
story_id="${1:-}"
iteration="${2:-$(cat projects/active/iteration.txt)}"

if [ -z "$story_id" ]; then
    # 如果没有指定故事，测试当前迭代的所有故事
    echo "📋 测试迭代 ${iteration} 的所有用户故事"
else
    story_file="projects/active/backlog/user-story-${story_id}.md"
    if [ ! -f "$story_file" ]; then
        echo "❌ 用户故事不存在: $story_file"
        exit 1
    fi
    echo "📋 测试用户故事: $story_id"
fi
```

---

### 第三步：生成 E2E 测试文件

**基于测试计划**: `projects/active/iterations/${iteration}/tests/e2e-test-plan.md`

#### Playwright 测试示例

**文件**: `tests/e2e/${story_name}.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Story: ${story_id} - ${story_title}
 *
 * These tests verify the complete user flow from the user's perspective.
 */

test.describe('${story_title}', () => {

  /**
   * Test: Successful flow
   * Given: User is on the starting page
   * When: User completes the main flow
   * Then: Expected outcome occurs
   */
  test('${scenario_1_description}', async ({ page }) => {
    // Arrange
    await page.goto('${start_url}');

    // Act
    await page.fill('${selector_1}', '${input_1}');
    await page.click('${button_selector}');

    // Assert
    await expect(page).toHaveURL('${expected_url}');
    await expect(page.locator('${expected_element}')).toBeVisible();
  });

  /**
   * Test: Validation error handling
   * Given: User is on the form page
   * When: User submits invalid data
   * Then: Error message is displayed
   */
  test('${scenario_2_description}', async ({ page }) => {
    await page.goto('${start_url}');

    // Submit invalid data
    await page.click('${submit_button}');

    // Verify error message
    await expect(page.locator('${error_selector}')).toHaveText('${expected_error}');
    await expect(page).toHaveURL('${start_url}'); // Should not navigate
  });

  /**
   * Test: Edge case handling
   */
  test('${scenario_3_description}', async ({ page }) => {
    // Test implementation
  });

  /**
   * Test: Data persistence
   */
  test('${scenario_4_description}', async ({ page }) => {
    // Perform action
    await page.goto('${start_url}');
    await page.fill('${selector}', '${value}');
    await page.click('${save_button}');

    // Reload page
    await page.reload();

    // Verify data persisted
    await expect(page.locator('${selector}')).toHaveValue('${value}');
  });
});
```

#### Cypress 测试示例

**文件**: `cypress/e2e/${story_name}.spec.ts`

```typescript
describe('${story_title}', () => {

  beforeEach(() => {
    cy.visit('${start_url}');
  });

  it('${scenario_1_description}', () => {
    // Act
    cy.get('${selector_1}').type('${input_1}');
    cy.get('${button_selector}').click();

    // Assert
    cy.url().should('include', '${expected_url}');
    cy.get('${expected_element}').should('be.visible');
  });

  it('${scenario_2_description}', () => {
    cy.get('${submit_button}').click();

    cy.get('${error_selector}').should('contain', '${expected_error}');
    cy.url().should('not.include', '${expected_url}');
  });
});
```

#### Selenium (Python) 测试示例

**文件**: `tests/e2e/test_${story_name}.py`

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pytest

class Test${StoryTitle}:
    """E2E Tests for Story: ${story_id}"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup browser before each test"""
        self.driver = webdriver.Chrome()
        self.driver.implicitly_wait(10)

    def teardown(self):
        """Cleanup after each test"""
        self.driver.quit()

    def test_scenario_1(self):
        """Test ${scenario_1_description}"""
        # Arrange
        self.driver.get("${start_url}")

        # Act
        self.driver.find_element(By.CSS_SELECTOR, "${selector_1}").send_keys("${input_1}")
        self.driver.find_element(By.CSS_SELECTOR, "${button_selector}").click()

        # Assert
        WebDriverWait(self.driver, 10).until(
            EC.url_contains("${expected_url}")
        )
        assert self.driver.find_element(By.CSS_SELECTOR, "${expected_element}").is_displayed()

    def test_scenario_2(self):
        """Test ${scenario_2_description}"""
        self.driver.get("${start_url}")
        self.driver.find_element(By.CSS_SELECTOR, "${submit_button}").click()

        error_element = self.driver.find_element(By.CSS_SELECTOR, "${error_selector}")
        assert "${expected_error}" in error_element.text
        assert "${expected_url}" not in self.driver.current_url
```

---

### 第四步：准备测试环境

```bash
echo "🔧 准备测试环境..."

# 1. 启动开发服务器
if [ -f "package.json" ]; then
    if grep -q '"dev"' package.json; then
        echo "启动开发服务器..."
        npm run dev &
        DEV_SERVER_PID=$!
        echo "开发服务器 PID: $DEV_SERVER_PID"

        # 等待服务器启动
        sleep 5
    fi
fi

# 2. 准备测试数据
echo "准备测试数据..."
# （根据项目需要，执行数据库迁移或填充测试数据）

# 3. 安装浏览器驱动（如需要）
if [ "$framework" = "playwright" ]; then
    npx playwright install --with-deps
fi

echo "✅ 测试环境准备完成"
```

---

### 第五步：运行 E2E 测试

```bash
echo "🧪 运行 E2E 测试..."

# 根据框架执行测试
case "$framework" in
    "playwright")
        test_command="npx playwright test"
        ;;
    "cypress")
        test_command="npx cypress run"
        ;;
    "selenium")
        test_command="pytest tests/e2e/"
        ;;
    "testcafe")
        test_command="npx testcafe chrome tests/e2e/"
        ;;
esac

echo "命令: $test_command"

# 运行测试并捕获输出
test_output_file="projects/active/iterations/${iteration}/tests/e2e-test-output.log"
$test_command 2>&1 | tee "$test_output_file"
test_exit_code=${PIPESTATUS[0]}

# 清理：关闭开发服务器
if [ -n "$DEV_SERVER_PID" ]; then
    kill $DEV_SERVER_PID 2>/dev/null || true
fi

if [ $test_exit_code -eq 0 ]; then
    echo "✅ 所有 E2E 测试通过"
else
    echo "❌ E2E 测试失败"
fi
```

---

### 第六步：生成测试报告

**文件**: `projects/active/iterations/${iteration}/tests/e2e-test-report.md`

```markdown
# E2E 测试报告 - Iteration ${iteration}

**生成时间**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**测试框架**: ${framework}
**测试环境**: ${environment}

---

## 测试概览

| 指标 | 结果 |
|------|------|
| 总测试数 | ${total_tests} |
| 通过 | ${passed} |
| 失败 | ${failed} |
| 跳过 | ${skipped} |
| 通过率 | ${pass_rate}% |

---

## 测试结果详情

### ✅ 通过的测试

${passed_tests_list}

### ❌ 失败的测试

${failed_tests_list}

---

## 发现的缺陷

### BUG-001: ${bug_title}

**严重程度**: high
**相关测试**: ${failed_test_name}
**相关任务**: TASK-${id}

**问题描述**:
${bug_description}

**复现步骤**:
1. ${step_1}
2. ${step_2}
3. ${step_3}

**预期行为**:
${expected_behavior}

**实际行为**:
${actual_behavior}

**截图/日志**:
${error_log}

---

## 测试覆盖

### 用户故事覆盖
- ✅ story-001: 用户登录功能
- ✅ story-002: 商品列表展示
- ⏳ story-003: 购物车功能

### 业务流程覆盖
- ✅ 用户注册 → 登录 → 浏览商品
- ⏳ 添加商品 → 购物车 → 结账
- ❌ 支付流程（未测试）

---

## 性能指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 页面加载时间 | < 2s | 1.5s | ✅ |
| API 响应时间 | < 500ms | 350ms | ✅ |
| 测试执行时间 | < 5min | 3min | ✅ |

---

## 建议

1. **修复缺陷**: 优先修复 high 和 critical 级别的缺陷
2. **补充测试**: 为边缘情况添加更多测试用例
3. **性能优化**: 优化慢速页面和 API
4. **环境一致性**: 确保测试环境与生产环境一致
```

---

### 第七步：处理测试失败的缺陷

```bash
# 如果测试失败，创建 Bug 卡片
if [ $test_exit_code -ne 0 ]; then
    echo ""
    echo "🐛 检测到测试失败，正在创建 Bug 卡片..."

    # 读取 bug 序列号
    if [ -f "projects/active/.bug_sequence" ]; then
        bug_id=$(cat projects/active/.bug_sequence)
    else
        bug_id=1
    fi

    bug_number=$(printf '%03d' $bug_id)
    bug_id="BUG-${bug_number}"

    # 创建 Bug 卡片
    bug_file="projects/active/iterations/${iteration}/bugs/${bug_id}.md"

    # 使用模板创建 Bug 卡片
    cp .claude-plugin/templates/bug-card.md "$bug_file"

    # 填写 Bug 信息（从测试输出中提取）
    # ...

    # 更新序列号
    echo $((bug_id + 1)) > "projects/active/.bug_sequence"

    # 更新 status.json
    jq \
        --arg bug_id "$bug_id" \
        '.bugs += [{
            "id": $bug_id,
            "task_id": "TASK-${id}",
            "severity": "high",
            "description": "${bug_description}",
            "status": "open"
        }]' \
        "projects/active/iterations/${iteration}/status.json" > "${status_file}.tmp"

    mv "${status_file}.tmp" "$status_file"

    echo "✅ Bug 卡片已创建: $bug_file"
fi
```

---

## 📤 输出结果

```markdown
✅ E2E 测试完成

**测试框架**: Playwright
**测试通过率**: 90% (9/10)

**测试报告**:
- projects/active/iterations/1/tests/e2e-test-report.md

**发现的缺陷**:
- BUG-001: 登录后 Token 未持久化（High 严重性）

**下一步**:
1. 修复发现的缺陷
2. 或继续下一个用户故事的测试
3. 或运行 /agile-dashboard 查看整体进度
```

---

## ⚠️ 错误处理

### 错误 1：开发服务器未启动

```bash
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 开发服务器未运行"
    echo ""
    echo "请先启动开发服务器："
    echo "  npm run dev"
    echo ""
    echo "或在测试配置中指定自动启动。"
    exit 1
fi
```

### 错误 2：测试框架未安装

```bash
if ! command -v npx &> /dev/null; then
    echo "❌ Node.js/npm 未安装"
    exit 1
fi

if [ "$framework" = "playwright" ]; then
    if ! npx playwright --version &> /dev/null; then
        echo "❌ Playwright 未安装"
        echo ""
        echo "请安装："
        echo "  npm install -D @playwright/test"
        echo "  npx playwright install"
        exit 1
    fi
fi
```

---

## 🔍 质量检查清单

- [ ] ✅ 测试文件已创建
- [ ] ✅ 测试覆盖所有验收标准
- [ ] ✅ 测试使用 Page Object Model（推荐）
- [ ] ✅ 测试数据准备完整
- [ ] ✅ 测试报告已生成
- [ ] ✅ 失败测试已创建 Bug 卡片
- [ ] ✅ status.json 已更新

---

## 💡 最佳实践

1. **从用户视角编写测试**: 关注业务流程，而非技术细节
2. **使用 Page Object Model**: 提高测试可维护性
3. **测试数据隔离**: 每个测试使用独立的测试数据
4. **等待机制**: 使用自动等待，避免硬编码 sleep
5. **并行执行**: 配置并行测试以加快执行速度

---

## 📚 相关技能

- `/agile-tech-design` - 查看测试计划
- `/agile-develop-task` - 修复测试发现的缺陷
- `/agile-dashboard` - 查看测试覆盖率
- `/agile-retrospective` - 迭代回顾时分析测试结果
