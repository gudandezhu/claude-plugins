---
name: agile-start
description: 自动任务管理技能：初始化项目（首次）、加载状态、获取下一个任务
version: 2.0.0
---

# Agile Start - 自动任务管理

## 任务

初始化或恢复敏捷开发流程，检查项目状态，获取下一个待执行任务。

---

## 执行流程

### 第一步：初始化项目（首次）

如果是首次使用，创建项目结构：
- 项目目录（projects/active/）
- 文档模板（ai-docs/）
- 配置文件（config.json）
- 初始迭代状态

### 第二步：检查当前迭代

从 `projects/active/iteration.txt` 读取当前迭代编号。

### 第三步：加载状态

使用 jq 读取 `projects/active/iterations/{iteration}/status.json`：
- 当前任务（current_task）
- 待办任务列表（pending_tasks）
- 完成进度

### 第四步：获取下一个任务

优先级：current_task > pending_tasks[0]

- 如果有 current_task，继续执行
- 如果没有，从 pending_tasks 中获取第一个
- 如果都没有，提示用户添加任务

---

## 输出结果

### 首次初始化
```
✅ 项目结构已创建
✅ 文档模板已创建
✅ 迭代 1 已创建
```

### 已有项目
```
🔄 当前任务: TASK-001 - 实现用户登录
```

### 无待办任务
```
✅ 所有任务已完成
💡 添加新任务: "p0: 实现新功能"
```
