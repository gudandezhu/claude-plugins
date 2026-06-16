---
status: stable
name: frontend-selftest-guide
user-invocable: false
description: >
  前端 Mock 模式测试方法论。提供 Mock 模式测试模式和 UI 验证清单。
  核心理念：mock 环境下验证所有交互，不需要真实后端。
---

# 前端自测指导

## 概述

本 skill 提供前端 Mock 模式测试的结构化方法论。核心原则：
**前端自测在 Mock 环境下完成，不需要真实后端运行**。

Mock 模式验证前端自身的交互逻辑、数据渲染、错误处理是否正确。
真实后端联调由后续阶段覆盖。

## 加载的参考文件

读取以下参考文件（位于本 skill 的 references/ 目录）：
- `mock-testing-patterns.md`：Mock 模式测试模式
- `ui-verification-checklist.md`：UI 验证清单

## 工作流

### 1. 确认 Mock 模式

- 优先使用 `dev:mock` script 启动
- 启动后确认 Mock 拦截器生效（Network 面板请求被拦截或返回 mock 数据）
- Mock 模式不可用时降级为真实后端测试，在报告中标注

### 2. 按清单逐交互验证

对任务中的每个交互操作（从任务文件的"交互操作"章节提取），按 `ui-verification-checklist.md` 验证：

| 维度 | 最低要求 |
|------|----------|
| 页面渲染 | 无白屏、无控制台错误、元素可见 |
| CRUD 操作 | 增删改查 mock 验证 |
| 表单校验 | 必填、格式规则、边界值 |
| 状态切换 | Loading / 空数据 / 错误状态 |
| 错误处理 | Mock API 错误 → 验证 toast / 恢复 |

**优先级**：页面渲染 > CRUD 操作 > 表单校验 > 错误处理 > 状态切换 > 边界值

### 3. Mock 错误测试

使用 Playwright `page.route` 拦截网络模拟 API 错误：
- 拦截指定 API 路径 → 返回 500 / 超时 / 空响应
- 验证前端正确显示错误提示
- 验证操作后表单状态保留（不丢失用户输入）

参考 `mock-testing-patterns.md` 中的具体模式。

### 4. 记录覆盖率

在 self-test report 中增加**Mock 测试覆盖率摘要**：

```markdown
## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 页面初始化 | ✅ | - | - | - | ✅ |
| 新增供应商 | ✅ | ✅ | ✅ | ✅ | - |
| 删除供应商 | ✅ | ✅ | - | ✅ | - |

覆盖率: {已测维度}/{总维度} ({百分比}%)
Mock 模式: {生效/未生效，降级为真实后端}
```

此摘要供 gen-test 阶段读取，用于缩减 E2E case 生成范围。
