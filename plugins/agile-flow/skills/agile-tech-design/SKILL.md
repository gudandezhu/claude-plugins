---
name: agile-tech-design
description: 技术设计技能：拆分用户故事为技术任务，维护项目技术上下文
version: 5.0.0
---

# Agile Tech Design - 技术设计

## 任务

1. 将用户故事拆分为具体的技术任务，添加到 `ai-docs/TASKS.json`
2. 维护项目技术上下文 `ai-docs/TECH.md`，帮助后续 agent 快速理解项目结构

---

## 环境变量

**必须设置**：
```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
```

---

## 执行流程

### 第一步：读取用户需求

从 `ai-docs/PRD.md` 读取用户需求。

### 第二步：分析技术需求

识别技术组件：
- API 端点
- 数据模型
- 前端组件
- 测试需求
- 配置和部署

### 第三步：拆分技术任务

**重要**：将任务添加到 `ai-docs/TASKS.json`（不是 PLAN.md）

使用任务管理工具：
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add <P0|P1|P2|P3> "描述"
```

### 第四步：更新技术上下文

**每次拆分任务后，更新 `ai-docs/TECH.md`**，记录技术架构和约定。

---

## 技术上下文 (TECH.md)

### 内容原则

**应该包含**（技术地图）：
- 技术栈
- 目录结构
- 代码约定
- 重要文件位置
- API 设计原则
- 数据模型概述

**不应该包含**（这些由 TODO 和需求管理）：
- 具体功能需求
- 详细实现步骤
- 业务逻辑说明

### TECH.md 模板

```markdown
# 技术上下文 (TECH)

## 技术栈

### 后端
- 框架: (如 Express, FastAPI)
- 数据库: (如 PostgreSQL, MongoDB)
- 认证: (如 JWT, OAuth)
- 测试: (如 pytest, jest)

### 前端
- 框架: (如 React, Vue)
- 状态管理: (如 Redux, Zustand)
- UI 库: (如 Ant Design, Material-UI)
- 构建工具: (如 Vite, Webpack)

---

## 目录结构

```
project-root/
├── src/           # 源代码
├── tests/         # 测试代码
├── docs/          # 文档
├── scripts/       # 脚本
└── ai-docs/       # AI 文档
```

---

## 代码约定

### 命名规范
- 文件命名: camelCase 或 kebab-case
- 变量命名: camelCase
- 常量命名: UPPER_CASE
- 类命名: PascalCase

### 目录组织
- 按功能模块组织
- 每个模块包含：models/, services/, routes/, tests/

---

## 重要文件位置

| 文件/目录 | 位置 | 说明 |
|----------|------|------|
| 主入口 | src/index.ts | 应用启动 |
| 路由定义 | src/routes/ | API 路由 |
| 数据模型 | src/models/ | 数据模型 |
| 工具函数 | src/utils/ | 通用工具 |
| 配置文件 | src/config/ | 配置管理 |

---

## API 设计原则

1. RESTful 风格
2. 统一的响应格式
3. 错误处理规范
4. 版本管理

---

## 数据模型概述

### 主要实体
- User: 用户
- (其他实体)

### 关系
- User → Post: 一对多
- (其他关系)

---

## 最新架构更新

### [日期] 新增功能
- 功能描述
- 涉及的文件/模块

### [日期] 重构
- 重构描述
- 影响范围
```

---

## 更新时机

**每次以下操作后，更新 TECH.md**：
1. 新增技术栈
2. 修改目录结构
3. 变更代码约定
4. 添加新的数据模型
5. 重要的架构调整

---

## 代码实现规范

技术任务代码实现时，根据代码类型选择：
- TypeScript 代码使用 `/typescript`
- Python 代码使用 `/python-development`
- Shell 脚本使用 `/shell-scripting`

---

## 任务拆分示例

### 用户需求：用户认证

拆分为：
- TASK-001: 设计用户数据模型 (P0)
- TASK-002: 实现注册 API (P0)
- TASK-003: 实现登录 API (P0)
- TASK-004: 创建认证中间件 (P0)
- TASK-005: 编写单元测试 (P0)
- TASK-006: 创建登录页面 (P1)
- TASK-007: 集成测试 (P1)

**同时更新 TECH.md**：
- 记录新增的认证技术
- 更新数据模型概述
- 添加 API 端点说明

---

## 输出结果

```
✅ 技术设计完成

用户需求: 用户认证

创建的技术任务: 7 个
- TASK-001: 设计用户数据模型 (P0)
- TASK-002: 实现注册 API (P0)
- TASK-003: 实现登录 API (P0)
- TASK-004: 创建认证中间件 (P0)
- TASK-005: 编写单元测试 (P0)
- TASK-006: 创建登录页面 (P1)
- TASK-007: 集成测试 (P1)

📊 任务已添加到 ai-docs/TASKS.json
📝 技术上下文已更新到 ai-docs/TECH.md
```

---

## 注意事项

1. **使用 TASKS.json**：任务数据统一在 `TASKS.json`，不要手动编辑
2. **环境变量**：所有脚本都需要 `AI_DOCS_PATH` 环境变量
3. **任务粒度**：每个任务应该是独立可完成的，预计 1-4 小时
4. **优先级准确**：根据依赖关系和重要性设置优先级
5. **描述清晰**：任务描述要包含具体的技术细节（如 API 端点、组件名称）
6. **维护 TECH.md**：每次拆分任务后，更新技术上下文，帮助后续 agent 快速理解项目
