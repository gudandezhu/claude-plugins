# 路径解析

> 由命令文件在初始化阶段加载，解析工作目录字面路径。

## 需求编号确认

确认**需求编号**，如用户未指定则询问。

## 工作目录解析

解析工作目录字面路径（subagent 不继承环境变量，必须在主会话展开）：

> ⚠️ **转义写法禁止修改**：必须原样使用 `/\x5c/g`（反斜杠的十六进制）。
> - Git Bash 双引号中 `\\` 会被 shell 消耗一层 → Node 收到的是 `/\/`（正则未闭合）
> - 单引号中 `\\` 会被 MSYS2 自动转换为 Git 安装路径
> - `\x5c` 是唯一可靠通过 shell 到达 Node.js 的方式

```bash
node -e "console.log((process.env.JLC_AI_WORKSPACE||'').replace(/\x5c/g,'/'))"
```

将输出结果记为 `{AI_WORKSPACE_LITERAL}`（纯字面路径，正斜杠，无环境变量引用）。

定义工作目录：
- `$WORK_DIR` = `$WORK_DIR`（主会话 shell 命令使用）
- `{WORK_DIR_LITERAL}` = `{AI_WORKSPACE_LITERAL}/process-docs/{需求编号}`（传入 subagent prompt 时使用）

## 插件路径

`$CLAUDE_PLUGIN_ROOT` 由 Claude Code 平台自动注入，无需手动解析。直接使用即可。

**验证**：检查 `$CLAUDE_PLUGIN_ROOT/skills/` 目录是否存在，不存在则报错：
`❌ CLAUDE_PLUGIN_ROOT 异常，请确认插件安装正确`

## 路径写法统一规范

- 在 bash 脚本中引用插件路径时，统一使用 `$CLAUDE_PLUGIN_ROOT`（平台环境变量）
- 在文档描述中引用插件路径时，统一使用 `$CLAUDE_PLUGIN_ROOT`
- 传入 subagent 时使用字面路径字符串

## WORK_DIR 验证（路径解析完成后立即执行）

路径解析完成后，验证 WORK_DIR 指向正确的目录：

```bash
# 验证 testing/ 目录存在于 WORK_DIR 下
if [ ! -d "$WORK_DIR/testing" ] && [ ! -d "$WORK_DIR/requirement" ] && [ ! -d "$WORK_DIR/design" ]; then
  echo "⚠️ WORK_DIR 可能解析错误：$WORK_DIR 下未找到 testing/、requirement/ 或 design/ 目录"
  echo "   请确认需求编号是否正确"
fi
```

如果 `test-config.json` 已存在，交叉验证 workDir 字段：
```bash
if [ -f "$WORK_DIR/testing/test-config.json" ]; then
  STORED_WORK_DIR=$(node -e "
    try { const c = require('$WORK_DIR/testing/test-config.json');
      console.log(c.workDir || ''); } catch(e) { console.log(''); }
  ")
  if [ -n "$STORED_WORK_DIR" ] && [ "$STORED_WORK_DIR" != "$WORK_DIR" ]; then
    echo "⚠️ WORK_DIR 不一致：当前解析=$WORK_DIR，test-config.json 中=$STORED_WORK_DIR"
    echo "   将使用 test-config.json 中的值"
    WORK_DIR="$STORED_WORK_DIR"
  fi
fi
```

## 导出 shell 变量（供后续步骤使用）

路径解析和验证完成后，编排层应立即导出变量，确保后续加载的 reference 文件中的 `$WORK_DIR` 可用：

```bash
export WORK_DIR="{WORK_DIR_LITERAL}"
```
