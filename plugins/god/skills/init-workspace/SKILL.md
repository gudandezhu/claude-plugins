---
status: stable
name: init-workspace
description: |
  初始化工作空间
---

# AI 工作空间初始化

帮助用户快速搭建 AI 开发工作空间：确认工作目录、持久化环境变量、批量 clone 所需仓库。

## 目标目录结构

初始化完成后，`$JLC_AI_WORKSPACE` 下包含：

| 目录                  | 描述                                           |
|---------------------|----------------------------------------------|
| `tech-specs/`       | 技术规范文档，统一团队开发标准                              |
| `biz-tech-docs/`    | 团队技术知识库，从团队远程仓库 clone，各 agent 按子目录名称动态读取所需知识 |
| `biz-product-docs/` | 团队业务知识库，从团队远程仓库 clone，各 agent 按子目录名称动态读取所需知识 |
| `projects/`         | 团队项目代码统一存放目录，所有业务项目仓库 clone 到此处              |
| `process-docs/`     | Agent 过程产物存放目录，从团队远程仓库 clone，团队成员共享协作        |

## 环境变量

| 环境变量 | 用途 | 示例 |
|---------|------|------|
| `JLC_AI_WORKSPACE` | 一级目录，包含规范、agents、项目代码、agent 工作空间等 | `C:\project\workspace` |

## 仓库清单

基础仓库（依赖 `--git-server` 参数）：

| 仓库 | 用途 |
|------|------|
| `git@{git-server}:ai-coding/tech-specs.git` | 技术规范 |

团队仓库（依赖 `--team-git-server` 和 `--team-group` 参数）：

| 仓库                                                     | 用途               |
|--------------------------------------------------------|------------------|
| `git@{team-git-server}:{team-group}/biz-tech-docs.git`    | 团队技术知识库          |
| `git@{team-git-server}:{team-group}/biz-product-docs.git` | 团队业务知识库          |
| `git@{team-git-server}:{team-group}/process-docs.git`     | Agent 过程产物（团队共享） |
| `git@{team-git-server}:{team-group}/biz-test-regression.git` | 集中测试版本化仓库 |

## 脚本接口

核心逻辑由 `scripts/init.sh` 完成，脚本为非交互式，接受参数调用。

```bash
bash skills/init-workspace/scripts/init.sh <workspace_path> --team-group <group> [--git-server <host>] [--team-git-server <host>] [--copy-from <existing_path>] [--team-repos <repo1> <repo2> ...]
```

参数说明：

| 参数 | 必填 | 说明 |
|------|------|------|
| `<workspace_path>` | 是 | 工作空间路径 |
| `--team-group` | 是 | 团队在 Git 服务器上的 group 名称 |
| `--git-server` | 否 | 基础仓库（tech-specs）的 Git 服务器地址，默认 `git.jlcops.com` |
| `--team-git-server` | 否 | 团队仓库的 Git 服务器地址，默认与 `--git-server` 相同 |
| `--copy-from` | 否 | 从已有工作空间复制（优先从 remote clone，失败则从本地复制） |
| `--team-repos` | 否 | 团队项目仓库地址，多个以空格分隔 |

脚本自动处理：
1. 持久化 `JLC_AI_WORKSPACE` 环境变量（Linux 写 `.bashrc`/`.zshrc`，Windows 通过 `setx` + `.bashrc`）
2. Clone 或从已有工作空间复制基础仓库
3. Clone 团队分组仓库（`biz-tech-docs`、`process-docs`）
4. 批量 clone 团队项目仓库到 `projects/`
5. 生成 `$JLC_AI_WORKSPACE/.claude/CLAUDE.md` 项目索引

## 执行流程

由 Skill 层通过 AskUserQuestion 工具完成交互，收集参数后调用脚本。

### Step 1: 收集信息

使用一次 AskUserQuestion 同时收集所有必要信息（最多 4 个问题合并为一次调用）：

**Q1: 工作空间路径**
- header: "路径"，单选，默认第一个为当前工作目录

**Q2: 基础仓库 Git 服务器**
- header: "Git服务器"，单选
- options: `git.jlcops.com`（内网，默认），`git-w.jlcops.com`（外网）
- 用途：决定 tech-specs 等基础仓库的 clone 地址

**Q3: 团队分组**
- header: "团队分组"，单选。输入团队在 Git 服务器上的 group 名称（如 `ecommerce`、`supply-chain`），用于 clone `biz-tech-docs` 和 `process-docs` 仓库

**Q4: 团队 Git 服务器**
- header: "团队Git"，单选
- options: `与基础仓库相同`（默认），`git.jlcops.com`，`git-w.jlcops.com`
- 用途：团队仓库所在 Git 服务器，可能与基础仓库不同
- 当用户选择"与基础仓库相同"时，使用 Q2 的值

如需从已有工作空间复制，用户可在 Other 中说明，追加 `--copy-from` 参数。

### Step 2: 执行脚本

```bash
bash skills/init-workspace/scripts/init.sh <workspace_path> --team-group <group> --git-server <host> [--team-git-server <host>] [--team-repos <source1> <source2> ...]
```

### Step 3: 使环境变量生效

脚本执行完成后，执行其输出的 export 命令使环境变量在当前终端立即生效：

```bash
export JLC_AI_WORKSPACE="<workspace_path>" && echo $JLC_AI_WORKSPACE
```

如果输出了正确的路径，说明环境变量已生效。如果用户新开终端仍未生效，提醒 `source ~/.bashrc`。

### Step 4: 输出下一步说明

```
初始化完成！下一步：
1. cd $JLC_AI_WORKSPACE 进入工作空间
2. 用 claude 开始开发
```

如果脚本输出中有 clone 失败的信息，额外提示：

```
部分仓库 clone 失败，请检查：
  - {团队分组}内是否已创建项目
```

## 注意事项

- 脚本使用 SSH 地址 clone，用户需提前配置 SSH key
- Windows 路径由脚本自动通过 `cygpath -w` 转换