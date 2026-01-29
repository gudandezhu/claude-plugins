---
name: agile-pause
description: 暂停自动继续模式
version: 2.0.0
---

# Agile Pause - 暂停自动继续

## 任务

创建暂停标记，停止自动继续模式，输出当前进度摘要。

---

## 执行流程

### 第一步：创建暂停标记

创建 `projects/active/pause.flag` 文件：
```json
{
  "paused": true,
  "reason": "user_requested",
  "timestamp": "2026-01-29T14:00:00Z"
}
```

### 第二步：读取当前状态并输出摘要

读取迭代状态文件，输出：
- 当前任务
- 已完成任务数
- 待办任务数

---

## 输出结果

```
⏸️ Agile Flow 已暂停

📊 当前进度:
- 迭代: 1
- 已完成: 5/10 任务
- 当前任务: TASK-006

💡 使用 /agile-start 恢复开发
```
