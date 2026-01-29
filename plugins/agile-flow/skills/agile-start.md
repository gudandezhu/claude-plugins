---
name: agile-start
description: 启动或恢复敏捷开发流程，与其他插件协同工作
version: 2.1.0
---

# Agile Start - 启动开发流程

## 任务

初始化或恢复敏捷开发流程，与其他插件协同完成需求优化、任务管理和功能开发。

---

## 与其他插件的协同

### 推荐工作流

```
1. 用户提出需求
   ↓
2. [可选] /prompt-enhancer - 优化需求描述
   ↓
3. /agile-start - 创建任务并开始
   ↓
4. /feature-dev - 功能开发
   ↓
5. [自动] agile-flow - 测试验收
   ↓
6. [可选] /code-simplifier - 架构优化
```

### 何时使用其他插件

| 场景 | 使用插件 |
|------|---------|
| 需求描述不清楚 | `/prompt-enhancer` |
| 具体功能开发 | `/feature-dev` |
| 架构重构优化 | `/code-simplifier` |
| 任务进度跟踪 | agile-flow 自动处理 |

---

## 执行流程

### 第一步：初始化项目（首次）

如果是首次使用，创建项目结构：
- 项目目录（projects/active/）
- 文档模板（ai-docs/）- 只创建必需的文档
- 配置文件（config.json）
- 初始迭代状态

**注意**：文档按需创建，不会强制创建所有7个文档。

### 第二步：检查当前迭代

从 `projects/active/iteration.txt` 读取当前迭代编号。

### 第三步：需求优化（可选）

如果用户提出了新需求，建议用户使用 `/prompt-enhancer` 优化需求：

```
检测到新需求，建议先使用 /prompt-enhancer 优化需求描述。
这样可以获得更清晰、结构化的需求，有助于后续开发。
```

### 第四步：加载状态

使用 jq 读取 `projects/active/iterations/{iteration}/status.json`：
- 当前任务（current_task）
- 待办任务列表（pending_tasks）
- 完成进度

### 第五步：获取下一个任务

优先级：current_task > pending_tasks[0]

- 如果有 current_task，继续执行
- 如果没有，从 pending_tasks 中获取第一个
- 如果都没有，提示用户添加任务

### 第六步：推荐开发方式

根据任务类型，推荐合适的开发方式：

- **复杂功能**：推荐使用 `/feature-dev` 进行完整开发流程
- **简单修改**：可以直接进行修改
- **架构优化**：推荐使用 `/code-simplifier`

---

## 输出结果

### 首次初始化
```
✅ 项目结构已创建
✅ 文档模板已创建（PLAN.md, ACCEPTANCE.md, BUGS.md）
✅ 迭代 1 已创建

💡 提示: agile-flow 与其他插件协同工作
  - 需求优化: /prompt-enhancer
  - 功能开发: /feature-dev
  - 架构优化: /code-simplifier
```

### 已有项目
```
🔄 当前任务: TASK-001 - 实现用户登录

💡 推荐使用 /feature-dev 进行开发
```

### 无待办任务
```
✅ 所有任务已完成
💡 添加新任务: "p0: 实现新功能"
```

---

## 配置选项

### 文档配置

在 `projects/active/config.json` 中配置：

```json
{
  "docs": {
    "mode": "flexible",
    "enabled": ["PLAN.md", "ACCEPTANCE.md", "BUGS.md"],
    "optional": ["PRD.md", "OPS.md", "CONTEXT.md", "API.md"],
    "auto_create": true
  }
}
```

### 自动继续配置

```json
{
  "continuation": {
    "enabled": true,
    "autoStart": true,
    "pauseOnBugs": true
  }
}
```

---

## 注意事项

1. **不替代其他插件**：agile-flow 只负责任务管理，不替代 feature-dev
2. **推荐而非强制**：推荐用户使用合适的插件，但允许用户选择
3. **灵活文档**：文档按需创建，支持使用项目中已有文档
4. **自动验收**：任务完成后自动测试和验收

---

## 版本历史

### v2.1.0
- 添加与其他插件的协同说明
- 支持需求优化推荐
- 支持文档按需创建
- 添加开发方式推荐
