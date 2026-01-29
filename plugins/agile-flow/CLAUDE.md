# Agile Flow 插件

> AI驱动的敏捷开发插件：轻量级任务管理，与现有插件协同工作

---

## 设计理念

**核心定位**：agile-flow 是一个**轻量级的任务管理增强插件**，而非独立的开发流程系统。

### 与其他插件的协同

```
prompt-enhancer → agile-flow → feature-dev → agile-flow → code-simplifier
   需求优化        任务管理      功能开发      测试验收      架构优化
```

| 插件 | 职责 |
|------|------|
| **prompt-enhancer** | 需求优化，使用 BROKE/RTF 等框架优化需求描述 |
| **agile-flow** | 任务管理和流转，测试验收，文档更新 |
| **feature-dev** | 功能开发，技术设计，代码实现 |
| **code-simplifier** | 架构优化，代码重构 |

### 核心原则

1. **不替代**：不替代 feature-dev 或其他功能插件
2. **增强**：为现有开发流程提供任务管理和自动化支持
3. **极简**：用户只需关注 `/agile-start` 和 `/agile-stop`
4. **灵活**：文档按需创建，支持用户自定义

---

## 用户命令

### 核心命令

| 命令 | 用途 | 何时使用 |
|------|------|---------|
| `/agile-start` | 启动/恢复开发流程 | 开始新项目或继续开发 |
| `/agile-stop` | 暂停自动继续 | 需要手动控制时 |

### 可选命令

| 命令 | 用途 |
|------|------|
| `/agile-continue` | 手动触发下一个任务 |
| `/agile-add-task` | 添加新任务 |
| `/agile-dashboard` | 查看进度看板 |

---

## 典型工作流程

### 方案1：使用 agile-flow 管理任务（推荐）

```
用户: "我要实现用户登录功能"
   ↓
AI: 推荐使用 /prompt-enhancer 优化需求
   ↓
AI: 使用 agile-start 创建任务
   ↓
AI: 使用 /feature-dev 进行开发
   ↓
AI: agile-flow 自动测试和验收
   ↓
AI: 继续下一个任务
```

### 方案2：直接使用 feature-dev（快速开发）

```
用户: "我要实现用户登录功能"
   ↓
AI: 直接使用 /feature-dev
   ↓
AI: 手动测试
   ↓
用户: 使用 /code-simplifier 优化
```

### 选择建议

- **使用 agile-flow**：需要任务管理、自动测试验收、文档维护
- **直接 feature-dev**：快速原型、简单功能、不需要任务跟踪

---

## 文档系统

### 按需创建

文档不再强制创建，默认只创建核心文档：

| 文档 | 类型 | 用途 |
|------|------|------|
| PLAN.md | 必需 | 工作计划和任务清单 |
| ACCEPTANCE.md | 必需 | 任务验收报告 |
| BUGS.md | 必需 | Bug 列表 |
| PRD.md | 可选 | 项目需求文档 |
| OPS.md | 可选 | 操作指南 |
| CONTEXT.md | 可选 | 项目上下文 |
| API.md | 可选 | API 清单 |

### 配置

在 `projects/active/config.json` 中配置：

```json
{
  "docs": {
    "mode": "flexible",
    "enabled": ["PLAN.md", "ACCEPTANCE.md", "BUGS.md"],
    "optional": ["PRD.md", "OPS.md", "CONTEXT.md", "API.md"],
    "custom_mappings": {}
  }
}
```

### 使用现有文档

如果项目已有文档（如 `PROJECT_STATUS.md`、`AI_CONTEXT.md`），agile-flow 可以使用它们。

---

## 任务管理

### 添加任务

随时可以添加任务，指定优先级：

```
p0: 实现用户认证功能
p1: 添加数据导出功能
实现文件上传功能  # 默认 P2
```

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

## 技术实现

### Hooks

#### 1. SessionStart Hook
**触发时机**: 会话开始时

**功能**:
- 检测项目根目录
- 显示项目状态（迭代、任务数量）
- 显示当前任务
- 检查是否有待处理的任务完成标记
- 检查是否暂停

**输出示例**:
```
══════════════════════════════════════════
🔄 agile-flow 项目已加载
   项目: /data/project/my-app
   迭代: 1 | 已完成: 5 | 待办: 3
   当前任务: TASK-006

✅ 检测到任务完成: TASK-005
   提示: 使用 /agile-continue 运行测试和验收
══════════════════════════════════════════
```

#### 2. PostToolUse Hook
**触发时机**: 工具使用后（Write、Edit 等）

**功能**:
- 检测任务完成（多种方式）
  - 显式标记文件 (`.task_complete`)
  - 任务文件 `status:` 字段
  - 完成标记 (✅ 完成)
- 创建自动继续标记
- 避免重复处理

**输出示例**:
```
✅ 任务完成: TASK-005
🧪 自动化流程已触发
   提示: 使用 /agile-continue 继续下一个任务
```

#### 3. Stop Hook
**触发时机**: 会话结束时

**功能**:
- 显示项目状态和任务统计
- 提供下一步操作建议
- 强制返回状态码 2（表示可继续）

**输出示例**:
```
────────────────────────────────────
🔍 agile-flow 项目: /data/project/my-app
📊 迭代 1: 已完成 5 个，待办 3 个

🔄 继续执行: 使用 /agile-continue 继续下一个任务
   暂停流程: 使用 /agile-stop 暂停自动继续
────────────────────────────────────
```

### 项目结构

```
projects/active/
├── iterations/
│   └── {iteration}/
│       ├── tasks/       # 任务卡片
│       ├── tests/       # 测试文件
│       └── status.json  # 迭代状态
├── backlog/            # 待办任务
├── knowledge-base/     # 知识库
├── iteration.txt       # 当前迭代编号
├── config.json         # 项目配置
└── pause.flag          # 暂停标记

ai-docs/                # AI 生成的文档
├── PLAN.md            # 工作计划
├── ACCEPTANCE.md      # 验收报告
└── BUGS.md            # Bug 列表
```

---

## 最佳实践

### 推荐流程

1. 需求明确时：`/prompt-enhancer` → `/agile-start` → `/feature-dev`
2. 快速原型时：直接 `/feature-dev`
3. 架构优化时：`/code-simplifier`
4. 定期回顾：`/agile-dashboard`

### 与 feature-dev 集成

agile-start 技能会：
1. 如果是新需求，推荐使用 `/prompt-enhancer` 优化
2. 使用优化后的需求创建任务
3. 推荐使用 `/feature-dev` 进行开发
4. 开发完成后自动测试和验收

### 测试和验收

- 自动运行测试（pytest/npm test）
- 覆盖率检查（目标 ≥ 80%）
- Linting 检查
- 记录到 ACCEPTANCE.md

---

## 配置选项

### 自动继续配置

```json
{
  "continuation": {
    "enabled": true,
    "autoStart": true,
    "pauseOnBugs": true,
    "pauseOnBlockers": true
  }
}
```

### 文档配置

```json
{
  "docs": {
    "mode": "flexible",
    "auto_create": true
  }
}
```

---

## 常见问题

### Q: 什么时候使用 agile-flow？

A: 当你需要：
- 任务管理和进度跟踪
- 自动化测试和验收
- 文档自动维护
- 多任务协作

### Q: agile-flow 和 feature-dev 的区别？

A:
- **feature-dev**: 功能开发插件，负责具体实现
- **agile-flow**: 任务管理插件，负责流程和文档

两者可以协同使用，agile-flow 会调用 feature-dev 进行开发。

### Q: 如何禁用自动继续？

A: 运行 `/agile-stop` 或创建 `pause.flag` 文件。

### Q: 如何添加自定义文档？

A: 修改 `config.json` 的 `docs.enabled` 或 `docs.custom_mappings`。

---

## 版本历史

### v2.1.0 (2025-01-30)

**优化**：
- 简化 PostToolUse Hook，支持多种任务完成检测方式
- 文档系统改为按需创建，不再强制创建所有7个文档
- 更新文档，明确与其他插件的协同关系
- 添加显式完成标记支持

### v2.0.0

**初始版本**：
- 自动任务管理
- 自动测试验收
- 文档自动维护
