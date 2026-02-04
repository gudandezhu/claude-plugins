---
name: agile-develop-task
description: TDD 开发技能：测试检查→红→绿→重构→覆盖率≥80%→代码审核
version: 5.0.0
---

# Agile Develop Task - TDD 开发

## 任务

按照严格的 TDD 流程开发任务，确保代码质量和测试覆盖率。

---

## 环境变量

**必须设置**：
```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
```

---

## TODO 注释约定

**触发条件**：当需求修改代码超过 20 行时

### TODO 格式

```python
# TODO: [需求描述] 实现用户认证功能
# - [实现点1] 添加登录接口 POST /auth/login
# - [实现点2] 实现密码加密（bcrypt）
# - [实现点3] 生成 JWT token
# - [实现点4] 添加登录验证装饰器
# - [实现点5] 处理登录失败异常
```

### 执行流程

1. 接收需求后，评估修改行数
2. 超过 20 行 → 先添加 TODO 注释（需求 + 实现点）
3. 逐个实现 TODO 中的实现点
4. 完成后删除对应的 TODO 注释

---

## TDD 流程（6 步骤）

### 步骤 1：检查测试文件

确认测试文件存在。如果不存在，先创建测试文件。

### 步骤 2：运行测试（红）

运行测试，确认测试失败（Red Phase）。

根据项目类型运行：
- Node.js: `npm run test:unit`
- Python: `pytest`

### 步骤 3：编写最小代码（绿）

编写最少量的代码使测试通过（Green Phase）。

**根据代码类型选择技能**：
- TypeScript 代码 → 使用 `/typescript`
- Python 代码 → 使用 `/python-development`
- Shell 脚本 → 使用 `/shell-scripting`

### 步骤 4：重构

优化代码结构，保持测试通过。

### 步骤 5：检查覆盖率

运行覆盖率测试，确保 ≥ 80%：
- Node.js: `npm run test:unit -- --coverage`
- Python: `pytest --cov`

### 步骤 6：代码审核

使用 `/pr-review-toolkit:code-reviewer` 进行代码审核：
- 检查代码质量
- 优化代码结构
- 修复发现的问题

---

## 任务状态管理

### 更新任务状态

使用任务管理工具更新状态：
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <task_id> <status>
```

**状态流转**：
```
pending → inProgress → testing → tested → completed
                    ↓
                   bug
```

**示例**：
```bash
# 开始任务
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update TASK-001 inProgress

# 提交测试
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update TASK-001 testing

# 发现 BUG
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update TASK-001 bug
```

---

## 输出结果

```
✅ 步骤 0 通过：TODO 规划完成（5 个实现点）
🔴 步骤 1：测试文件存在
🔴 步骤 2：测试失败（符合预期）
🟢 步骤 3：测试通过
🔄 步骤 4：代码重构完成
📊 步骤 5：覆盖率 85% (≥ 80%) ✅
🔍 步骤 6：代码审核完成 ✅

🎯 任务开发完成！
📊 任务状态已更新：TASK-001 → testing
```

---

## 注意事项

1. **必须按顺序执行**：不要跳过任何步骤
2. **覆盖率要求**：必须 ≥ 80%
3. **环境变量**：确保 `AI_DOCS_PATH` 已设置
4. **状态同步**：及时更新 TASKS.json 中的任务状态
5. **TODO 清理**：完成后删除 TODO 注释，保持代码整洁
