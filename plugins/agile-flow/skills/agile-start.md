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
4. 功能开发
   ↓
5. [自动] agile-flow - 测试验收
   ↓
6. [可选] /code-simplifier - 架构优化
```

### 何时使用其他插件

| 场景 | 使用插件               |
|------|--------------------|
| 需求描述不清楚 | `/prompt-enhancer` |
| 具体功能开发 | `coding`           |
| 架构重构优化 | `/code-simplifier` |
| 任务进度跟踪 | agile-flow 自动处理    |

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

- **简单修改**：可以直接进行修改
- **架构优化**：推荐使用 `/code-simplifier`
