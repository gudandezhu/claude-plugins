# API Flow Subagent 构造

> 由 run-test 阶段二 Step 3 加载，用户选择 A（包含流程测试）时执行。

## 前置条件

- 用户选择了 A（包含流程测试）
- E2E subagent 已完成（禁止并发启动）
- `api-flow-test-cases.md` 存在

## 技能加载

加载 `skills/test-scripting/references/api-flow-case-writing.md` 获取 API 流程测试规范。

## 模板变量

替换以下路径变量（必须用 `{WORK_DIR_LITERAL}` 字面路径，subagent 不继承环境变量）：

| 变量 | 值 |
|------|------|
| `{flowCasesPath}` | `{WORK_DIR_LITERAL}/testing/test-cases/api-flow-test-cases.md` |
| `{apiProbePath}` | `{WORK_DIR_LITERAL}/testing/api-probe.md` |
| `{testConfigPath}` | `{WORK_DIR_LITERAL}/testing/test-config.json` |
| `{apiScriptsOutputDir}` | `{TESTING_REPO_LITERAL}/{PROJECT_DIR}/tests/api/features/` |
| `{acFilePath}` | `{AC_FILE_LITERAL}`（Step 0 确定的实际路径） |
| `$CLAUDE_PLUGIN_ROOT` | 主会话解析的插件目录字面路径 |

## 输出约束

- 禁止在 `scripts/flow/` 目录输出任何文件——Flow 层已合并到 API 层
- 文件命名为 `*-flow.api.test.ts` 与单 API 脚本区分
- 脚本必须遵循 test-scripting skill 的 API 流程规范

## 降级

API flow subagent 失败时：
- 降级到 test-writer.md 单 subagent（scope=api-flow）
- 禁止退化到主会话直接生成

## 完成后处理

用户选 B（跳过流程测试）时：更新 progress：`apiFlowScripts: "skipped"`
