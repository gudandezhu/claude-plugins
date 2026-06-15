---
name: api-selftest-guide
user-invocable: false
description: >
  API 自测方法论。提供系统性 API 测试清单和断言标准。
  精简自 test-case-design/references/api-case-design.md。
---

# API 自测指导

## 概述

本 skill 提供 API 自测的结构化方法论。加载后按清单逐 API 验证，确保自测覆盖面足够，
减少后续 gen-test 的工作量。

## 加载的参考文件

读取以下参考文件（位于本 skill 的 references/ 目录）：
- `api-quick-test-checklist.md`：API 测试清单（6 维覆盖）
- `api-assertion-standards.md`：响应断言标准

## 工作流

### 1. 提取 API 列表

从任务上下文提取需要测试的 API：
- 任务文件的 `api-docs` 字段 → 读取每个 API 文档
- 技术设计的接口锚点 → 提取 HTTP 方法 + 路径 + 参数
- AC 中涉及接口验证的条目

### 2. 逐 API 执行测试清单

对每个 API，按 `api-quick-test-checklist.md` 6 个维度逐一验证：

| 维度 | 最低要求 |
|------|----------|
| 正向用例 | 每个 API 至少 1 个 |
| 参数校验 | 每个必填字段至少 1 个缺失/错误用例 |
| 边界值 | 字符串最大长度、数值边界、空数组（按字段类型选做） |
| 业务规则 | 唯一性、状态流转、依赖检查（按 AC 要求） |
| 异常场景 | 未授权、资源不存在（至少 1 个） |
| 接口联动 | create → query → update → delete（任务涉及多接口时） |

**优先级**：正向 > 参数校验 > 业务规则 > 接口联动 > 边界值 > 异常场景

时间有限时按优先级执行，确保正向 + 参数校验 + 业务规则必须覆盖。

### 3. 应用断言标准

每个 API 响应按 `api-assertion-standards.md` 验证。核心断言：
- HTTP 状态码符合预期
- 响应结构完整 (code, data, msg)
- 至少 1 个业务字段值与预期一致
- 失败场景的错误码 + 错误信息正确

### 4. 记录覆盖率

在 self-test report 中增加**测试覆盖率摘要**：

```markdown
## API 测试覆盖率

| API | 正向 | 参数校验 | 边界值 | 业务规则 | 异常 | 联动 |
|-----|------|----------|--------|----------|------|------|
| POST /api/xxx | ✅ | ✅ | ✅ | - | ✅ | - |

覆盖率: {已测维度}/{总维度} ({百分比}%)
```

此摘要供 gen-test 阶段读取，用于缩减 case 生成范围。
