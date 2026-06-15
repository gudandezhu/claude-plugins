---
name: command-bootstrap
user-invocable: false
description: |
  命令执行前的公共初始化技能。提供路径解析、ac.md 校验、跨命令上下文保护、
  progress 更新、产物提交等四个命令共享的公共能力。
  由 gen-test、run-test、backend-test 在初始化阶段调用。
---

# 能力概述

本技能为三个测试命令提供公共的初始化和收尾能力，避免每个命令重复实现相同逻辑。

# 调用接口

命令文件在初始化阶段加载本技能的 references，按需传入以下参数：

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| acBlockMessage | 是 | ac.md 不存在时的阻塞文案 | "AC 覆盖率检查无法执行" |
| extraValidations | 否 | 额外校验项列表 | ["PRD 目录存在性", "businessObjective 提取"] |
| commitTarget | 否 | 提交目标 | "process-docs" 或 "testingRepo" |

命令文件中的调用方式：直接加载对应 reference 文件路径，在加载指令中声明参数值。

# 与 init-workspace 的区别

⚠️ 本技能（command-bootstrap）与 `skills/init-workspace/` 职责完全不同：

| 维度 | command-bootstrap | init-workspace |
|------|-------------------|----------------|
| 职责 | 命令执行前的初始化（解析路径、校验 ac.md、上下文保护） | 帮用户搭建 AI 工作空间（clone 仓库、设置环境变量） |
| 调用时机 | 每次执行 /zcode 命令时 | 用户首次搭建工作空间时（一次性） |
| 调用方 | gen-test、run-test、backend-test | 用户手动调用 |
| 产出 | 路径变量、ac.md 校验结果 | 目录结构、环境变量持久化 |

两者互不影响，修改 command-bootstrap 不会影响 init-workspace 的功能。

# references 索引

| reference 文件 | 行数 | 职责 |
|---------------|------|------|
| path-resolution.md | ~30 | 路径解析（AI_WORKSPACE、WORK_DIR、CLAUDE_PLUGIN_ROOT） |
| ac-validation.md | ~50 | ac.md 查找 + 三类 AC 检查 + businessObjective 提取 |
| progress-update.md | ~25 | progress 字段更新脚本模板 |
| artifact-commit.md | ~45 | git 提交流程（branch/main/none + testingRepo） |

# 跨命令上下文保护

如果当前会话中已执行过其他 /zcode 命令，上下文会残留上一个命令的交互历史，
压缩本命令的可用 token 预算并导致产出质量下降。

检测方式：对话历史中包含其他命令的特征输出（如"案例生成完成"、"脚本生成进度"、"测试通过率"、"门禁检查"等）。

处理策略：
- 提示用户：`⚠️ 检测到当前会话已执行过其他命令，建议开启新会话执行当前命令以获得最佳效果`
- 如果用户选择继续：后续调度时优先使用轻量模式，减少上下文消耗
- run-test 特殊处理：限制修复循环最多 1 轮（而非正常的 3 轮），超出则提示开新会话

# 禁止事项

- 禁止跳过 ac.md 校验——ac.md 是 AC 覆盖率 100% 保障的前提
- 禁止在 ac.md 不存在时提供跳过选项
- 禁止在 $CLAUDE_PLUGIN_ROOT 异常时降级执行——应确认插件安装正确
