# Agile Flow 插件

> AI驱动的自动化敏捷开发插件：完全自动化的任务管理与流转

[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/your-org/agile-flow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🚀 特性

- **完全自动化**：启动后持续运行，无需人工干预
- **Web Dashboard**：实时看板 + 需求提交界面
- **需求池机制**：自动评估优先级并转换为任务
- **智能流程引擎**：Agent 自动处理任务流转、测试、验收
- **零中断**：所有操作通过 Web 界面，不影响流程运行

## 📋 系统要求

- Claude Code（最新版本）
- Node.js 18+ （用于 Web Dashboard）
- Bash 4.0+

## 🔧 安装

### 方式 1：从 Marketplace 安装

```bash
# 在 Claude Code 中
/marketplace install agile-flow
```

### 方式 2：本地安装

```bash
# 克隆仓库
git clone https://github.com/your-org/agile-flow.git

# 复制到插件目录
cp -r agile-flow ~/.claude/plugins/
```

### 方式 3：项目级安装

```bash
# 复制到项目的 .claude-plugin/ 目录
cp -r agile-flow your-project/.claude-plugin/
```

## 🎯 快速开始

### 1. 启动流程

```bash
/agile-start
```

这将：
- ✅ 初始化项目（首次）
- 🌐 启动 Web Dashboard
- 🤖 启动自动流程引擎

### 2. 打开 Dashboard

在浏览器中打开：http://localhost:3737

### 3. 提交需求

在 Dashboard 页面输入需求，例如：
```
实现用户登录功能
```

系统会自动：
- 📊 评估优先级（P0/P1/P2/P3）
- 📝 转换为任务
- 🚀 自动执行开发
- 🧪 自动测试验收
- ✅ 继续下一个任务

### 4. 查看进度

Dashboard 实时显示：
- 任务统计
- 各状态任务列表
- 自动刷新（5秒）

### 5. 停止流程

```bash
/agile-stop
```

## 📁 项目结构

```
your-project/
├── ai-docs/              # AI 文档目录
│   ├── PRD.md            # 需求池
│   ├── PLAN.md           # 任务清单
│   ├── ACCEPTANCE.md     # 验收报告
│   ├── BUGS.md           # Bug 列表
│   ├── OPS.md            # 操作指南
│   ├── CONTEXT.md        # 项目上下文
│   └── API.md            # API 清单
```

## 🔄 工作流程

```
用户提交需求 → PRD.md（需求池）
              ↓
         自动评估优先级
              ↓
         转换为任务 → PLAN.md
              ↓
    Agent 自动执行任务
              ↓
    feature-dev → 测试 → 验收
              ↓
         继续下一个任务
```

## 🎨 组件

### Commands（2个）

- `/agile-start` - 启动自动化流程
- `/agile-stop` - 停止自动化流程

### Agent（1个）

- `agile-flow-engine` - 自动流程引擎，持续运行

### Skills（5个）

- `agile-product-analyze` - 产品需求分析
- `agile-tech-design` - 技术设计
- `agile-develop-task` - TDD 开发
- `agile-e2e-test` - E2E 测试
- `agile-retrospective` - 迭代回顾

### Hooks（1个）

- `stop-hook` - 停止时显示项目状态

## 📊 优先级自动评估

系统根据关键词自动评估需求优先级：

- **P0（关键）**：紧急、关键、核心、阻塞、崩溃、安全、漏洞
- **P1（高）**：重要、优化、性能、体验、提升、改进
- **P2（中）**：默认优先级
- **P3（低）**：可选、建议、美化、调整、微调

## 🔌 配置

### Web Dashboard 端口

默认端口：`3737`

如需修改，编辑 `web/server.js`：

```javascript
const PORT = 3737; // 修改为其他端口
```

### 需求评估规则

编辑 `scripts/utils/priority-evaluator.sh` 自定义优先级评估规则。

## 📚 文档

- [CLAUDE.md](CLAUDE.md) - 插件架构和详细说明
- [OPS.md](ai-docs/OPS.md) - 操作指南（项目初始化后生成）

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

## 📝 许可证

[MIT License](LICENSE)

## 🙏 致谢

- Claude Code 官方插件开发指南
- plugin-dev 最佳实践
