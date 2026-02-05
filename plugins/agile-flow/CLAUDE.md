# Agile Flow 插件

> AI驱动的自动化敏捷开发插件：完全自动化的任务管理与流转

---

## 插件协同

**自动化引擎**：`/agile-flow:agile-flow-engine` 驱动整个流程

```
需求池 → 需求分析 → 技术设计 → TDD开发 → E2E测试 → 验收 → 下一个任务
   ↑                                                        ↓
   └──────────────────────── 自动循环 ←───────────────────────┘
```


---

## 文档系统

**所有数据统一在 `ai-docs/` 目录管理**：

```
ai-docs/
├── docs/           # 文档目录
│   ├── PRD.md      # 项目需求文档（需求池）
│   ├── BUGS.md     # Bug 列表
│   ├── CONTEXT.md  # 项目业务上下文
│   ├── TECH.md     # 技术上下文（技术地图）
│   ├── API.md      # API 清单
│   └── OPS.md      # 操作指南
├── data/           # 数据目录
│   └── TASKS.json  # 任务数据（JSON格式）
├── logs/           # 日志目录
│   └── *.log       # 各种日志文件
└── run/            # 运行时目录
    ├── *.pid       # 进程 ID 文件
    ├── *.port      # 端口文件
    └── *.lock      # 锁文件
```

---

## 命令

| 命令 | 说明 |
|------|------|
| `/agile-start` | 启动自动化流程（Web Dashboard + 流程引擎） |
| `/agile-stop` | 停止自动化流程 |

---

## 必须执行

- ❌ **永远不要**使用 `AskUserQuestion` 工具
- ✅ **流程必须**完全自动化，不需要暂停
- ❌ **永远不要**修改 `stop-hook.sh`

---

## 版本号管理

修改以下文件后必须更新[marketplace.json](../../.claude-plugin/marketplace.json) 和[plugin.json](.claude-plugin/plugin.json) 版本号：

- `commands/` - 添加或修改命令
- `skills/` - 添加或修改技能
- `agents/` - 添加或修改代理
- `scripts/` - 修改核心脚本
- `hooks/` - 修改钩子脚本

**版本号格式**：`主版本.次版本.修订版本`（如 4.0.1）

**然后执行git commit**