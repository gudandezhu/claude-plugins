---
name: agile-tech-design
description: 技术负责人技能：读取用户故事（user-story-{id}.md），将其拆解为技术任务（task-{id}.md），定义 TDD 测试策略，设计技术方案，生成测试计划（unit-test-plan.md、e2e-test-plan.md），更新迭代任务列表
version: 1.0.0
---

# Agile Tech Design - 技术负责人技能

## 🎯 核心任务

将用户故事拆解为可执行的技术任务，设计技术方案，定义测试策略，生成任务卡片和测试计划。

---

## 📋 执行流程

### 第一步：读取用户故事

```bash
# 从参数获取故事 ID
story_id="$1"

# 读取用户故事文档
story_file="projects/active/backlog/user-story-${story_id}.md"

if [ ! -f "$story_file" ]; then
    echo "❌ 用户故事不存在: $story_file"
    exit 1
fi

# 解析 YAML frontmatter（使用 jq 或类似工具）
story_title=$(grep '^title:' "$story_file" | sed 's/title: //')
story_priority=$(grep '^priority:' "$story_file" | sed 's/priority: //')
story_complexity=$(grep '^complexity:' "$story_file" | sed 's/complexity: //')
```

---

### 第二步：分析现有代码库

使用 `Grep` 和 `Glob` 工具分析项目结构：

```bash
# 检测项目类型
if [ -f "package.json" ]; then
    project_type="nodejs"
    framework=$(grep -E '"(react|vue|next|express)"' package.json)
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    project_type="python"
    framework=$(grep -E '(django|fastapi|flask)' requirements.txt 2>/dev/null || echo "unknown")
elif [ -f "pom.xml" ]; then
    project_type="java"
elif [ -f "go.mod" ]; then
    project_type="go"
else
    project_type="unknown"
fi
```

---

### 第三步：拆解技术任务

**基于用户故事的验收标准，拆解为技术任务**

**任务拆解原则**：
1. **按技术层次拆分**: 数据层 → API 层 → UI 层
2. **按验收标准拆分**: 每个验收标准对应 1-2 个任务
3. **TDD 友好**: 每个任务可独立测试
4. **依赖清晰**: 使用 `blocked_by` 字段明确依赖

**示例任务拆解**：

```markdown
**用户故事**: story-001 用户登录功能

**验收标准**:
1. 用户可以输入邮箱和密码
2. 系统验证邮箱格式是否正确
3. 系统验证邮箱和密码是否匹配
4. 登录成功后跳转到仪表盘
5. 登录失败时显示错误提示

**拆解任务**:
- TASK-101: 设计登录数据模型（User 实体、LoginRequest/Response）
- TASK-102: 实现邮箱格式验证（单元测试）
- TASK-103: 实现密码加密和验证（单元测试 + bcrypt）
- TASK-104: 实现 POST /api/auth/login API（集成测试）
- TASK-105: 实现登录表单组件（React/Vue 组件）
- TASK-106: 实现 JWT token 生成和验证
- TASK-107: 实现登录状态管理（Context/Store）
- TASK-108: 实现登录成功后跳转
- TASK-109: 实现错误提示显示
- TASK-110: 编写 E2E 测试（Playwright）
```

---

### 第四步：生成任务卡片

**基于模板** `.claude-plugin/templates/task-card.md`

**任务编号**:

```bash
# 读取当前迭代的任务序列号
current_iteration=$(cat projects/active/iteration.txt)
if [ -f "projects/active/iterations/${current_iteration}/.task_sequence" ]; then
    next_task_id=$(cat projects/active/iterations/${current_iteration}/.task_sequence)
else
    next_task_id=1
fi

# 生成任务卡片
for ((i=0; i<num_tasks; i++)); do
    task_id="TASK-$(printf '%03d' $((next_task_id + i)))"

    # 创建任务卡片文件
    task_file="projects/active/iterations/${current_iteration}/tasks/${task_id}.md"

    # 使用模板创建任务卡片
    cp .claude-plugin/templates/task-card.md "$task_file"

    # 填写任务详情
    # （具体内容根据任务类型填写）
done

# 更新序列号
echo $((next_task_id + num_tasks)) > "projects/active/iterations/${current_iteration}/.task_sequence"
```

**任务卡片示例**：

```markdown
---
id: "TASK-102"
story: "story-001"
status: "pending"
priority: 1
estimated_hours: 2
complexity: "low"
dependencies: ["TASK-101"]
blocked_by: ["TASK-101"]
related_files: ["src/utils/validators.ts", "tests/unit/validators.test.ts"]
tags: ["utility", "validation"]
created_at: "2026-01-28T00:00:00Z"
updated_at: "2026-01-28T00:00:00Z"
---

# TASK-102: 实现邮箱格式验证

## 用户故事关联
**父级用户故事**: story-001 - 用户登录功能

## Input（输入）

### 依赖的前置任务
- **TASK-101**: 设计登录数据模型 - completed

### 数据模型/接口
```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateEmail(email: string): ValidationResult
```

## Output（输出）

### 交付文件
- `src/utils/validators.ts`: 邮箱验证函数
- `tests/unit/validators.test.ts`: 单元测试

## 验收标准

1. [ ] 支持标准邮箱格式验证（user@domain.com）
2. [ ] 拒绝无效格式（缺少 @、缺少域名等）
3. [ ] 返回清晰的错误信息
4. [ ] 单元测试覆盖率 ≥ 80%

## 实施步骤

### 第一步：编写单元测试（TDD）
- [ ] 编写测试用例：有效邮箱
- [ ] 编写测试用例：无效邮箱（缺少 @）
- [ ] 编写测试用例：无效邮箱（缺少域名）
- [ ] 编写测试用例：无效邮箱（特殊字符）
- [ ] 运行测试，确认失败（红）

### 第二步：实现验证逻辑
- [ ] 实现邮箱格式验证函数
- [ ] 使用正则表达式验证
- [ ] 返回验证结果对象

### 第三步：验证通过（绿）
- [ ] 运行测试，确认通过
- [ ] 检查覆盖率 ≥ 80%

## 实施说明

### 技术要点
```typescript
// 使用正则表达式验证邮箱格式
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}
```

## 测试要求

### 单元测试
**文件**: `tests/unit/validators.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from '@/utils/validators';

describe('validateEmail', () => {
  it('should validate correct email format', () => {
    const result = validateEmail('user@example.com');
    expect(result.valid).toBe(true);
  });

  it('should reject email without @', () => {
    const result = validateEmail('userexample.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject email without domain', () => {
    const result = validateEmail('user@');
    expect(result.valid).toBe(false);
  });

  it('should reject empty email', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is required');
  });
});
```

**覆盖率要求**: ≥ 80%

## TDD 流程检查

- [ ] ✅ 测试文件已创建
- [ ] ✅ 测试运行失败（红）
- [ ] ✅ 编写最少代码使测试通过
- [ ] ✅ 测试运行成功（绿）
- [ ] ✅ 覆盖率 ≥ 80%
- [ ] ✅ 代码通过 Linting
- [ ] ✅ 代码通过类型检查

## 依赖检查

### 前置条件
- [ ] TASK-101 已完成（数据模型已定义）

### 阻塞因素
无

## 完成标准（Definition of Done）

- [ ] 代码已实现
- [ ] 单元测试通过且覆盖率 ≥ 80%
- [ ] 代码通过 Linting
- [ ] 代码通过类型检查
- [ ] status.json 状态已更新为 "completed"
```

---

### 第五步：生成测试计划

#### 单元测试计划

**文件**: `projects/active/iterations/{current_iteration}/tests/unit-test-plan.md`

```markdown
# 单元测试计划 - Iteration {n}

## 测试框架
- **框架**: Vitest (Node.js) / Pytest (Python)
- **覆盖率目标**: ≥ 80%
- **运行命令**: `npm run test:unit` / `pytest`

## 测试策略

### 测试金字塔
```
        E2E (10%)
       /        \
    集成测试 (30%)
   /              \
单元测试 (60%)
```

### 测试原则
1. **TDD 优先**: 先写测试，再写实现
2. **隔离性**: 每个测试独立运行
3. **可重复**: 测试结果稳定，不依赖外部状态
4. **快速**: 单元测试应在秒级完成

## 测试用例列表

### TASK-102: 邮箱格式验证
| 测试用例 | 输入 | 预期输出 |
|---------|------|---------|
| 有效邮箱 | user@example.com | valid=true |
| 缺少@ | userexample.com | valid=false, error="Invalid format" |
| 缺少域名 | user@ | valid=false, error="Invalid format" |
| 空字符串 | "" | valid=false, error="Required" |

### TASK-103: 密码加密
| 测试用例 | 输入 | 预期输出 |
|---------|------|---------|
| 正常密码 | password123 | hash!=password, verify=true |
| 空密码 | "" | throw Error |
| 相同密码不同hash | password123 | hash1!=hash2 |

（更多测试用例...）

## Mock 策略

### 外部依赖 Mock
- **数据库**: 使用内存数据库或 Mock 仓储
- **API**: 使用 MSW (Mock Service Worker)
- **时间**: 使用 fake timers

### 测试数据
```typescript
// tests/fixtures/users.ts
export const mockUsers = {
  valid: {
    email: 'test@example.com',
    password: 'password123'
  },
  invalid: {
    email: 'invalid-email',
    password: ''
  }
};
```

## 持续集成

### CI 配置
```yaml
# .github/workflows/test.yml
name: Unit Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run test:unit -- --coverage
      - run: npm run test:e2e
```
```

#### E2E 测试计划

**文件**: `projects/active/iterations/{current_iteration}/tests/e2e-test-plan.md`

```markdown
# E2E 测试计划 - Iteration {n}

## 测试框架
- **框架**: Playwright (推荐) / Cypress / Selenium
- **运行命令**: `npx playwright test`
- **测试环境**: http://localhost:3000

## 测试策略

### 测试范围
E2E 测试关注**用户视角的关键业务流程**，不测试所有细节。

### 测试原则
1. **真实浏览器**: 在真实浏览器环境中运行
2. **关键路径**: 覆盖核心用户流程
3. **稳定性**: 使用自动等待，避免 flaky tests
4. **可维护**: 使用 Page Object Model

## 测试场景

### 场景 1: 用户成功登录
```typescript
test('user can login with valid credentials', async ({ page }) => {
  // Arrange
  await page.goto('/login');

  // Act
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  // Assert
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid=user-menu]')).toBeVisible();
});
```

### 场景 2: 登录失败 - 邮箱格式错误
```typescript
test('shows error for invalid email format', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'invalid-email');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  await expect(page.locator('[data-testid=email-error]')).toHaveText('Invalid email format');
  await expect(page).toHaveURL('/login');
});
```

### 场景 3: 登录失败 - 密码错误
```typescript
test('shows error for wrong password', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'wrongpassword');
  await page.click('button[type=submit]');

  await expect(page.locator('[data-testid=login-error]')).toHaveText('Invalid email or password');
});
```

### 场景 4: 登录后 Token 持久化
```typescript
test('persists auth token after login', async ({ page, context }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  // 检查 localStorage 中的 token
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(token).toBeTruthy();

  // 刷新页面，验证仍然登录
  await page.reload();
  await expect(page.locator('[data-testid=user-menu]')).toBeVisible();
});
```

## Page Object Model

### 定义页面对象
```typescript
// tests/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[name=email]', email);
    await this.page.fill('[name=password]', password);
    await this.page.click('button[type=submit]');
  }

  async getErrorMessage() {
    return await this.page.locator('[data-testid=login-error]').textContent();
  }
}
```

### 使用页面对象
```typescript
test('user login flow', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');

  await expect(page).toHaveURL('/dashboard');
});
```

## 测试数据管理

### 测试用户
```typescript
// tests/fixtures/test-users.ts
export const testUsers = {
  valid: {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  }
};
```

### 数据库清理
```typescript
// tests/setup/database.ts
export async function cleanupDatabase() {
  await db.deleteMany('users', {
    email: { $in: ['test@example.com'] }
  });
}

export async function seedTestUser() {
  await db.insert('users', {
    email: 'test@example.com',
    password: bcrypt.hash('password123'),
    name: 'Test User'
  });
}
```

## 持续集成

### Playwright CI 配置
```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build
      - run: npm run dev &
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```
```

---

### 第六步：更新 status.json

**文件**: `projects/active/iterations/{current_iteration}/status.json`

```json
{
  "iteration": 1,
  "updated_at": "2026-01-28T00:00:00Z",
  "status": "in_progress",
  "progress": {
    "stories_completed": 0,
    "stories_total": 1,
    "tasks_completed": 0,
    "tasks_total": 10,
    "completion_percentage": 0.0
  },
  "current_task": {
    "id": "TASK-101",
    "name": "设计登录数据模型",
    "status": "pending",
    "story_id": "story-001",
    "acceptance_criteria": [
      "定义 User 实体",
      "定义 LoginRequest/Response 接口",
      "添加 TypeScript 类型定义"
    ]
  },
  "pending_tasks": [
    {
      "id": "TASK-101",
      "name": "设计登录数据模型",
      "story_id": "story-001",
      "priority": 1,
      "blocked_by": []
    },
    {
      "id": "TASK-102",
      "name": "实现邮箱格式验证",
      "story_id": "story-001",
      "priority": 1,
      "blocked_by": ["TASK-101"]
    }
    // ... 更多任务
  ],
  "bugs": [],
  "blockers": []
}
```

---

### 第七步：生成技术决策记录（如需要）

**文件**: `projects/active/knowledge-base/technical-decisions.md`

**追加内容**：

```markdown
## ADR-001: 选择 JWT 作为身份验证方案

**状态**: 已接受
**日期**: 2026-01-28

### 上下文
需要为用户登录功能实现身份验证机制。

### 考虑的方案
1. **Session-based**: 传统 Session/Cookie
2. **JWT (JSON Web Token)**: 无状态的 token 验证
3. **OAuth 2.0**: 第三方登录

### 决策
选择 **JWT** 作为身份验证方案。

### 理由
- ✅ 无状态，服务器不需要存储 session
- ✅ 跨域友好，适合前后端分离
- ✅ 性能好，无需查询数据库验证
- ✅ 标准化，生态系统成熟
- ⚠️ Token 无法撤销（设置短有效期缓解）

### 后果
- 需要实现 token 刷新机制
- 前端需要妥善存储 token（localStorage vs cookie）
- 有效期设置为 24 小时

### 相关链接
- https://jwt.io/
- 故事: story-001
```

---

## 📤 输出结果

```markdown
✅ 技术设计完成

**用户故事**: story-001 - 用户登录功能
**任务数量**: 10 个技术任务
**预计工时**: 32 小时

**生成的文件**:
- 任务卡片: projects/active/iterations/1/tasks/TASK-101.md ~ TASK-110.md
- 单元测试计划: projects/active/iterations/1/tests/unit-test-plan.md
- E2E 测试计划: projects/active/iterations/1/tests/e2e-test-plan.md
- 技术决策: projects/active/knowledge-base/technical-decisions.md

**下一步**:
使用 /agile-develop-task TASK-101 开始第一个任务
```

---

## ⚠️ 错误处理

### 错误 1：用户故事不存在

```bash
if [ ! -f "projects/active/backlog/user-story-${story_id}.md" ]; then
    echo "❌ 用户故事不存在: user-story-${story_id}.md"
    echo "请先使用 /agile-product-analyze 创建用户故事"
    exit 1
fi
```

### 错误 2：项目类型不支持

```markdown
⚠️ 项目类型不支持自动检测

当前项目类型: {project_type}

请手动指定项目技术栈，或使用项目配置文件。
```

---

## 🔍 质量检查清单

- [ ] 所有任务卡片已创建
- [ ] 任务依赖关系清晰（blocked_by）
- [ ] 每个任务有明确的验收标准
- [ ] 测试计划完整（单元 + E2E）
- [ ] status.json 已更新
- [ ] 技术决策已记录（如需要）

---

## 💡 最佳实践

1. **任务粒度适中**: 每个任务 2-8 小时完成
2. **依赖明确**: 使用 blocked_by 避免循环依赖
3. **TDD 友好**: 每个任务可独立测试
4. **可追溯**: 每个任务关联到用户故事

---

## 📚 相关技能

- `/agile-product-analyze` - 创建用户故事
- `/agile-develop-task` - 执行 TDD 开发
- `/agile-e2e-test` - 执行 E2E 测试
- `/agile-dashboard` - 生成进度看板
