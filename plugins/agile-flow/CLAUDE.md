# Agile Flow 插件

> AI驱动的自动化敏捷开发插件：3个顺序执行的agent（规划+构建+验证）

---

## 架构设计

**3个顺序执行的Agent**

| Agent | 技能 | 职责 |
|----------|------|------|
| Planner Agent | `agile-planner` | 分析需求文档，生成任务列表 |
| Builder Agent | `agile-builder` | 循环处理 pending 任务，执行 TDD |
| Verifier Agent | `agile-verifier` | 使用 Playwright 进行 E2E 测试验证 |

**工作流程**：
```
用户编辑 REQUIREMENTS.md
    ↓
/agile-start 启动流程
    ↓
Planner Agent → 分析需求 → 生成任务
    ↓
Builder Agent → 循环处理任务 → TDD开发
    ↓
Verifier Agent → E2E测试 → 生成报告
    ↓
完成
```

---

## 文档系统

**简化的文档系统**：

```
ai-docs/
├── REQUIREMENTS.md   # 需求文档（合并了 PRD 和用户故事）
├── docs/             # 文档目录
│   ├── BUGS.md       # Bug 列表
│   └── OPS.md        # 操作指南
├── data/             # 数据目录
│   └── TASKS.json    # 任务数据（JSON格式）
├── logs/             # 日志目录
│   └── *.log         # 各种日志文件
└── run/              # 运行时目录
    ├── *.pid         # 进程 ID 文件
    ├── *.port        # 端口文件
    └── *.lock        # 锁文件
```

**文档变更说明**：
- ✅ 保留：`REQUIREMENTS.md`（新的需求文档）
- ✅ 保留：`BUGS.md`
- ✅ 保留：`OPS.md`
- ❌ 移除：`PRD.md`（合并到 REQUIREMENTS.md）
- ❌ 移除：`CONTEXT.md`
- ❌ 移除：`TECH.md`
- ❌ 移除：`API.md`

---

## 命令

| 命令 | 说明 |
|------|------|
| `/agile-start` | 启动自动化流程（Web Dashboard + 3个Agent） |
| `/agile-stop` | 停止自动化流程 |

---

## 技能

| 技能 | 说明 |
|------|------|
| `agile-planner` | 需求规划技能：分析需求文档、评估优先级、生成任务列表 |
| `agile-builder` | TDD 开发技能：循环处理 pending 任务，执行测试→红→绿→重构流程 |
| `agile-verifier` | E2E 验证技能：使用 Playwright 进行端到端测试，生成验证报告 |
| `agile-flow-engine` | 流程引擎：顺序执行 3 个 agent |

---

## 必须执行

- ❌ **永远不要**使用 `AskUserQuestion` 工具
- ✅ **流程必须**完全自动化，不需要暂停
- ❌ **永远不要**修改 `stop-hook.sh`

---

## 版本号管理

修改以下文件后必须更新 `plugin.json` 版本号：

- `commands/` - 添加或修改命令
- `skills/` - 添加或修改技能
- `scripts/` - 修改核心脚本
- `hooks/` - 修改钩子脚本

**版本号格式**：`主版本.次版本.修订版本`（如 8.0.0）

**然后执行 git commit**
