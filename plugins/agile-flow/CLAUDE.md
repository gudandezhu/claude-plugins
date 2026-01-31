# Agile Flow 插件

> AI驱动的自动化敏捷开发插件：完全自动化的任务管理与流转

---

### 插件协同
```
用户需求 → PRD.md → agile-flow-engine → /python-development 或 /typescript → agile-flow-engine → pr-review-toolkit
  (Web)     需求池      自动流程引擎       功能开发        测试验收         代码审核
```

| 插件 | 职责 |
|------|------|
| **agile-flow** | 自动化任务流程管理、测试验收、文档更新 |
| **/python-development 或 /typescript** | 功能开发、技术设计、代码实现 |
| **pr-review-toolkit** | 代码审核、简化、优化 |
| **typescript** | TypeScript 代码实现 |
| **python-development** | Python 代码实现 |
| **shell-scripting** | Shell 脚本实现 |

---

## 代码实现规范

在实现代码时，根据代码类型使用对应的技能：

- **TypeScript 代码实现**：使用 `/typescript`
- **Python 代码实现**：使用 `/python-development`
- **Shell 脚本实现**：使用 `/shell-scripting`

---

## 核心特性

### 1. 完全自动化

- 启动后持续运行，无需暂停
- 自动需求评估和任务转换
- 自动测试验收
- 自动流转到下一个任务

### 2. Web Dashboard

- 实时看板显示（自动刷新）
- 需求提交接口
- 任务进度展示
- 访问地址：http://localhost:3737

### 3. 需求池机制

用户通过 Web Dashboard 提交需求 → 保存到 PRD.md → 自动评估优先级 → 转换为任务 → 自动执行

---

## 典型工作流程

### 自动流程(完全自动化)
```
需求池 → 任务 → 测试 → BUG修复 → 测试 → 验收 → 下一个任务
```

#### 需求阶段
```
1. 用户在 Web Dashboard 提交需求
2. 需求自动保存到 PRD.md（需求池）
3. 系统自动评估优先级（P0/P1/P2/P3）
4. 自动转换为任务添加到 PLAN.md
```

#### 任务执行阶段
```
1. 自动选择最高优先级任务（BUG > 进行中 > 待测试 > 待办）
2. 使用 /python-development 或 /typescript 插件完成任务
3. 如果是编程，使用 /pr-review-toolkit:review-pr 审核代码
4. 提交 git commit
5. 自动将状态改为 `待测试`
```

#### 测试阶段
```
1. 自动生成单元测试用例，要求测试覆盖率80%
2. 运行单元测试
3. 启动项目进行真实环境测试：
   a. 查看日志是否有error信息
   b. 使用playwright进行功能验证
4. 发现BUG：
   - 将相关信息详细记录到BUGS.md
   - PLAN.md中该任务状态改为 `BUG`
   - 自动跳转到BUG修复阶段
5. 测试完成，无BUG：
   - PLAN.md中该任务状态改为 `已测试`
   - 自动跳转到验收阶段
```

#### BUG修复
```
1. 自动使用 /python-development 或 /typescript 插件修复BUG任务
2. 使用 /pr-review-toolkit:review-pr 审核代码
3. 提交 git commit
4. 自动将状态改为 `待测试`
5. 自动跳转到测试阶段
```

#### 验收
```
1. 自动总结核心内容(200字内)到ACCEPTANCE.md
2. 自动将项目相关核心内容(50字内)总结到CONTEXT.md
3. 如果有API变更，自动记录到API.md
4. 自动将状态改为 `已完成`
5. 自动继续处理下一个任务
```

---

## 文档系统

### 固定在ai-docs目录下
| 文档 | 类型 | 用途 |
|------|--|------|
| PRD.md | 必需 | 项目需求文档（需求池） |
| TASKS.json | 必需 | 任务数据（JSON格式） |
| ACCEPTANCE.md | 必需 | 任务验收报告 |
| BUGS.md | 必需 | Bug 列表 |
| OPS.md | 必需 | 操作指南 |
| CONTEXT.md | 必需 | 项目上下文 |
| API.md | 必需 | API 清单 |
| tasks-detail/ | 可选 | 任务详情文档目录 |
| PLAN.md | 可选 | 工作计划（Markdown格式，供阅读） |

### 重要说明

**所有项目数据统一在 `ai-docs/` 目录管理**：
- ❌ **不要**使用 `projects/` 目录
- ❌ **不要**在项目根目录创建任务文档
- ✅ 所有任务数据使用 `ai-docs/TASKS.json`
- ✅ 所有需求使用 `ai-docs/PRD.md`
- ✅ 所有文档统一在 `ai-docs/` 目录

**.gitignore 配置**：
- `ai-docs/` - AI 生成的文档
- `.hooks/` - Hook 脚本
- `projects/` - 忽略其他插件的项目目录

### TASKS.json 格式

```json
{
  "iteration": 1,
  "tasks": [
    {
      "id": "TASK-001",
      "priority": "P0",
      "status": "pending",
      "description": "任务描述"
    }
  ]
}
```

**状态值**：`pending`, `inProgress`, `testing`, `tested`, `bug`, `completed`

如果项目已有文档（如 `PROJECT_STATUS.md`、`AI_CONTEXT.md`），agile-flow 可以使用它们。

---

## 任务管理

### 添加任务

通过 Web Dashboard 提交需求，系统会：
1. 自动评估优先级
2. 转换为任务
3. 添加到 PLAN.md 的待办列表

### 优先级

- **P0**: 关键任务，阻塞其他功能
- **P1**: 高优先级，重要但不阻塞
- **P2**: 中等优先级，可以延后
- **P3**: 低优先级，有时间再做

### 自动流转

任务完成后，agile-flow 自动：
1. 运行测试（覆盖率 ≥ 80%）
2. 检查验收标准
3. 更新验收报告
4. 继续下一个优先级最高的任务

---

## 命令

### /agile-start

启动完全自动化的敏捷开发流程：

```bash
/agile-start
```

功能：
- 初始化项目（首次）
- 启动 Web Dashboard（http://localhost:3737）
- 启动自动流程引擎
- 持续运行，无需暂停

### /agile-stop

停止自动化流程：

```bash
/agile-stop
```

功能：
- 停止自动流程引擎
- 关闭 Web Dashboard
- 清理后台进程

---

## Web Dashboard

### 访问地址

```
http://localhost:3737
```

### 功能

1. **实时看板**
   - 任务统计（总数、已完成、完成率）
   - 当前迭代编号
   - 各状态任务列表
   - 自动刷新（5秒）

2. **需求提交**
   - 输入需求描述
   - 点击提交按钮
   - 自动保存到需求池

3. **进度查看**
   - 进行中任务
   - 待测试任务
   - Bug 任务
   - 已测试任务
   - 已完成任务
   - 待办任务

---

## 优先级评估

系统自动根据关键词评估需求优先级：

### P0（关键）
- 关键词：紧急、关键、核心、阻塞、崩溃、安全、漏洞、致命、无法使用

### P1（高优先级）
- 关键词：重要、优化、性能、体验、提升、改进

### P2（中等优先级）
- 默认优先级

### P3（低优先级）
- 关键词：可选、建议、美化、调整、微调

---

## Stop Hook

当接收到stop hook指令时

**流程**:
- 显示项目状态和任务统计
- 提示用户使用 /agile-start 重新启动

**输出示例**:
```
────────────────────────────────────
🔍 agile-flow 项目: /data/project/my-app
📊 迭代 1: 已完成 5 个，待办 3 个
────────────────────────────────────
💡 使用 /agile-start 重新启动流程
```

---

# 必须执行

- 永远不要使用AskUserQuestion工具询问用户
- 流程必须完全自动化，不需要暂停等待用户输入
