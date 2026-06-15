# 一致性校验规则

> 本文档由 SKILL.md Step 6 引用。每次补充任务后必须全部通过。

## 检查清单

### 1. 状态不变性

**规则**：补充操作未修改任何已有任务的 phase 值。

**检查方法**：
- 对比操作前后目标迭代 task-list.json 中已有任务的 phase 字段
- 逐字段比对，任何差异视为违规

**失败动作**：阻止操作，恢复原始 phase 值

### 2. 任务 ID 唯一性

**规则**：新任务 ID 在所有迭代的 task-list.json 中不存在。

**检查方法**：
- 读取 `$WORK_DIR/tasks/IT-*/task-list.json` 所有文件
- 提取所有 `id` 字段
- 验证新任务 ID 不在其中

**失败动作**：阻止操作，提示 ID 冲突

### 3. DAG 无环验证

**规则**：所有迭代的任务依赖关系构成有向无环图。

**检查方法**：
- 读取目标迭代的 task-list.json
- 构建依赖图（tasks 数组中每个 task 的 dependencies）
- 执行拓扑排序，检测是否存在环

**失败动作**：阻止操作，提示循环依赖链

### 4. 文件存在性

**规则**：task-list.json 中每个 task 的 `detailFile` 对应的文件实际存在。

**检查方法**：
- 遍历目标迭代 task-list.json 的 tasks 数组
- 对每个 task 检查 `tasks/{iteration}/{detailFile}` 文件是否存在
- 重点检查新增的 detailFile

**失败动作**：阻止操作，提示缺失文件

### 5. YAML Frontmatter 完整性

**规则**：所有任务详情文件的 YAML frontmatter 字段完整填充。

**后端任务必需字段**：`iteration`, `task-id`, `task-name`, `role`, `microservice`, `depends-on`, `acceptance-criteria`, `skipped-gates`, `tech-design-sections`, `api-docs`, `tech-design-section-hashes`

**前端任务必需字段**：`iteration`, `task-id`, `task-name`, `role`, `page`, `depends-on`, `acceptance-criteria`, `skipped-gates`, `ui-designs`

**检查方法**：
- 读取新增的每个任务详情文件
- 解析 YAML frontmatter
- 验证所有必需字段存在且无占位符

**失败动作**：阻止操作，提示缺失字段

### 6. REQUIRED 区块完整性

**规则**：所有 `<!-- REQUIRED:xxx -->` 区块已填充实际内容，无占位符。

**检查方法**：
- 读取新增的每个任务详情文件
- 提取所有 REQUIRED 区块
- 检查区块内不存在以下占位符模式：
  - `{request-body}`, `{请求体}`, `/api_url`, `{接口路径}`
  - "类似TaskN", "同上", "参考XX", "待补充", "TODO", "TBD"
  - 模板中的大括号占位符如 `{具体描述...}`

**失败动作**：阻止操作，提示占位符位置

### 7. 计数一致性

**规则**：task-list.json 的 summary 字段与实际任务数匹配。

**检查方法**：
- 统计 tasks 数组中 role 为 "backend" 的数量，应等于 summary.backend
- 统计 tasks 数组中 role 为 "frontend" 的数量，应等于 summary.frontend
- 统计 tasks 数组中 role 为 "infra" 的数量，应等于 summary.infra
- tasks 数组总长度应等于 summary.total

**失败动作**：阻止操作，自动修正 summary

### 8. tech-design 覆盖性

**规则**：每个新增任务的核心流程步骤都可溯源到 tech-design.md 的具体章节。

**检查方法**：
- 读取新增任务的来源标注
- 验证引用的章节在 tech-design.md 中实际存在
- 验证章节内容与任务描述相关

**失败动作**：阻止操作，提示无法溯源的步骤

## 校验执行顺序

按以下顺序执行，前一项失败立即停止：

1. 状态不变性（最优先，保护已有工作）
2. 任务 ID 唯一性
3. DAG 无环验证
4. 文件存在性
5. YAML Frontmatter 完整性
6. REQUIRED 区块完整性
7. 计数一致性
8. tech-design 覆盖性
