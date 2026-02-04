---
name: agile-e2e-test
description: 端到端测试技能：使用 Playwright 进行功能验证、记录结果
version: 5.0.0
---

# Agile E2E Test - 端到端测试

## 任务

使用 Playwright 运行端到端测试，验证整个系统的功能完整性。

---

## 环境变量

**必须设置**：
```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
```

---

## 核心工具

**Playwright MCP 工具**（浏览器自动化）：

| 工具 | 用途 |
|------|------|
| `mcp__plugin_playwright_playwright__browser_navigate` | 导航到 URL |
| `mcp__plugin_playwright_playwright__browser_snapshot` | 获取页面快照（用于分析） |
| `mcp__plugin_playwright_playwright__browser_click` | 点击元素 |
| `mcp__plugin_playwright_playwright__browser_type` | 输入文本 |
| `mcp__plugin_playwright_playwright__browser_fill_form` | 填写表单 |
| `mcp__plugin_playwright_playwright__browser_console_messages` | 获取控制台日志 |
| `mcp__plugin_playwright_playwright__browser_take_screenshot` | 截图 |
| `mcp__plugin_playwright_playwright__browser_wait_for` | 等待条件 |

---

## 执行流程

### 第一步：启动项目

确保项目正在运行（根据项目类型启动服务）。

### 第二步：获取测试任务

使用任务管理工具获取待测试任务：
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-by-status testing
```

### 第三步：运行测试用例

**使用 Playwright MCP 工具进行功能验证**：

1. **导航到页面**
2. **获取页面快照**（分析页面结构，获取元素引用）
3. **执行操作**（点击、输入、填表单等）
4. **检查控制台错误**（必需步骤）
5. **截图记录**（可选）

**重要**：如果需要编写新的测试代码：
- TypeScript 测试代码 → 使用 `/typescript`
- Python 测试代码 → 使用 `/python-development`
- Shell 脚本 → 使用 `/shell-scripting`

### 第四步：处理测试结果

**测试通过**：
```bash
# 更新任务状态到 tested
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <task_id> tested
```

**发现 BUG**：
1. 详细记录 BUG 到 `ai-docs/BUGS.md`
2. 更新任务状态到 bug
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <task_id> bug
```

### 第五步：记录测试结果

将测试结果记录到 `ai-docs/BUGS.md`（如果发现 BUG）。

---

## BUG 记录模板

记录到 `ai-docs/BUGS.md`：

```markdown
## BUG-<编号>: <简短描述>

**任务**: TASK-XXX
**严重程度**: Critical/High/Medium/Low
**发现时间**: 2025-01-15

### 问题描述
详细描述 BUG 的现象和复现步骤。

### 复现步骤
1. 步骤 1
2. 步骤 2
3. 步骤 3

### 预期行为
描述预期应该发生什么。

### 实际行为
描述实际发生了什么。

### 截图/日志
（如果有）
```

---

## 测试用例示例

```markdown
### 用例：用户登录功能

1. 导航到登录页面
2. 获取页面快照，确认存在登录表单
3. 填写用户名和密码
4. 点击登录按钮
5. 检查是否跳转到首页
6. 检查控制台无 error 信息
7. 截图记录
```

---

## 输出结果

### 测试通过

```
🧪 E2E 测试完成

测试结果:
- 测试用例: 5 个
- 通过: 5/5
- 失败: 0
- 控制台错误: 0

✅ 所有功能测试通过
📊 任务状态已更新：TASK-001 → tested
```

### 发现 BUG

```
🧪 E2E 测试完成

测试结果:
- 测试用例: 5 个
- 通过: 4/5
- 失败: 1

❌ 发现 BUG
📝 BUG 已记录到 ai-docs/BUGS.md
📊 任务状态已更新：TASK-001 → bug
```

---

## 注意事项

1. **环境变量**：确保 `AI_DOCS_PATH` 已设置
2. **使用快照**：使用 `browser_snapshot` 获取元素引用，而不是猜测
3. **检查控制台**：检查控制台错误是必需步骤
4. **BUG 详细记录**：失败的测试应该详细记录到 BUGS.md
5. **状态同步**：及时更新 TASKS.json 中的任务状态
6. **测试数据库**：测试数据库应该独立于开发数据库
