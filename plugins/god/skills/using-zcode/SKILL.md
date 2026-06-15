---
name: using-zcode
user-invocable: false
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

<EXTREMELY-IMPORTANT>
所有response必须有事实依据!禁止杜撰,禁止随意输出!

- 正例: 
  - 操作：ai执行一些操作,推理出html已经变了
  - 检查：ls/grep/git diff/find xxx.html
  - 输出：html文件已修改
- 反例:
  - 输出：html文件已修改
</EXTREMELY-IMPORTANT>

## Instruction Priority

zcode skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, AGENTS.md, direct requests) — highest priority
2. **Team specs** (`biz-tech-docs`) — override company specs (`tech-specs`) on conflict
3. **zcode skills** — override default system behavior where they conflict
4. **Default system prompt** — lowest priority

If CLAUDE.md, or AGENTS.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.


## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means invoke the skill to check. Wrong invocation → no harm, just skip. Check first, always. No exceptions, no rationalizing.
**做任何事情之前,先想想看**
**改动代码前,先探索原项目仓库,关注是否有固定模式,是否有参考代码,并思考任务是否需要遵循原有规范!**

## 后端构建与测试规则

> 注意：${CLAUDE_PLUGIN_ROOT} 为占位符,执行命令前应该先填充为zcode插件绝对路径

maven项目禁止直接使用 mvn 或 mvnd 命令。所有 Maven 构建和测试操作必须通过 wrapper 脚本执行：

- **编译构建**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -d <项目路径>`
- **增量编译**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -c -d <项目路径>`
- **编译指定模块**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -d <父项目根路径> -m <模块名>`
- **运行全部测试**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -t -d <项目路径>`
- **运行单个测试类**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -s <测试类名> -d <项目路径>`
- **启动服务(后台)**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/start.sh -d <项目路径> [-p local] --background`
- **停止服务**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/start.sh -d <项目路径> --stop`
- **服务状态**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/start.sh -d <项目路径> --status`
- **查看依赖树**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh --dep-tree -d <项目路径>`
- **启动+OpenAPI生成**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/start.sh -d <项目路径> --background --openapi`
- **编译前停止**: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh --stop-first -d <项目路径>`

| 禁止 | 正确替代 |
|------|---------|
| `mvn test` | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -t -d <项目路径>` |
| `mvn compile` | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -d <项目路径>` |
| `mvn test -Dtest=XXX` | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -s XXX -d <项目路径>` |
| `mvn package` | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -p -d <项目路径>` |
| `mvn install` / `mvn clean install` | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh -d <项目路径>` |
| `mvn dependency:tree` | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh --dep-tree -d <项目路径>` |
| `mvnd <任何命令>` | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/dev/build.sh ...` |

## Workspace

### WORK_DIR

`$WORK_DIR` = `$JLC_AI_WORKSPACE/process-docs/{需求编号}`

### 目录结构

!`tree -d -l 2 --ignore "projects,process-docs,jlc-claude-plugins,.git,.idea,node_modules,target,out" --base $JLC_AI_WORKSPACE 2>/dev/null || echo "(tree command not available)"`

### 任务前同步

执行任意zcode:command前，先同步协作仓库：

```bash
for repo in process-docs biz-tech-docs biz-product-docs tech-specs; do cd $JLC_AI_WORKSPACE/$repo && git pull 2>/dev/null; done
```

### 产物提交

所有项目禁止自动push，仅允许 `process-docs` 自动commit：

```bash
cd $JLC_AI_WORKSPACE/process-docs
git add "{需求编号}/" 2>/dev/null
git status --short | head -5  # 仅确认暂存状态，不输出全量列表
git commit -m "#0000 feat({需求编号}): {操作描述}" 2>/dev/null | grep -E "^\[|^create|^delete" | head -3
git push 2>/dev/null && echo "push OK"
```

## 团队规范覆盖机制

加载 `tech-specs/` 下任何规范文件 `{path}` 前，必须先检查 `$JLC_AI_WORKSPACE/biz-tech-docs/conventions/{path}` 是否存在：
- 存在 → 加载 conventions 版本（团队覆盖），**禁止**加载 tech-specs 版本
- 不存在 → 加载 tech-specs 版本（公司基线）

`conventions/` 下非镜像路径的文件（公司无同名）为团队额外规范，正常加载。
禁止同时加载同一路径的公司版和团队版。

## GIT 提交规范
commit格式必须是 '#{编码,如0000,建议参考git历史记录} {commit描述,大于6字符} '