# 门禁修复 Prompt 模板

> 由 run-test 阶段三门禁修复时使用。主会话按此模板组装修复上下文。

## 输入变量

| 变量 | 值来源 | 说明 |
|------|--------|------|
| `{failedScripts}` | gate-result.json 中未通过脚本路径列表 | 需要修复的脚本文件路径 |
| `{gateResult}` | gate-result.json 中未通过的步骤 | 包含 step name、issues、details |
| `{fixRules}` | `skills/test-gate/references/quality-rules.md` 对应原则的修复规则 | 从 quality-rules.md 提取的对应原则 |
| `{workDir}` | WORK_DIR 字面路径 | 工作目录路径 |

## 修复 Prompt 结构

按以下结构组装门禁修复上下文：

```
你是测试脚本修复专家。请修复以下门禁失败项。

## 工作目录
{workDir}

## 失败脚本
{failedScripts 列表}

## 门禁失败详情
{gateResult 格式化输出}

## 修复规则
{fixRules 对应步骤的规则}

## 修复要求
1. 只修复上述失败项对应的脚本文件（.spec.ts / .api.test.ts）
2. 每个修复必须引用具体的 gate-check 步骤编号和规则
3. 修复时不得降低其他检查项的合规性
4. 修复完成后脚本必须通过 gate-check.js 的所有检查
5. 禁止通过 try/catch 吞掉错误、禁止跳过断言、禁止删除 test() 块
6. **禁止修改 test-cases/ 目录下的案例文档**（e2e-test-cases.md、api-flow-test-cases.md 等）——案例文档是脚本生成的上游输入，修改会导致 TC ID 不匹配。修复只针对 spec 文件和脚本文件
```

## 失败分组策略

门禁失败项按以下类型分组展示，主会话按分组顺序修复：

| 失败类型 | 包含步骤 | 修复参考 |
|---------|---------|---------|
| 质量类 | 4a-4g（断言、截图、路径等） | 脚本内容 + quality-rules.md 对应原则 |
| 选择器类 | 6、9-14（语法、定位方式） | 脚本内容 + dom-probe.md 选择器 |
| 覆盖类 | 2、3、16（TC 编号、场景、AC） | 案例文档 + 脚本内容 |

## 修复后验证

修复完成后重新运行 gate-check.js 验证：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-gate/scripts/gate-check.js" --testing-dir "$WORK_DIR/testing/" --scope <scope> $TESTING_REPO_ARGS
```

## 3 轮不过处理

修复超过 3 轮仍未通过时，展示增强处理面板：

```
⚠️ 门禁修复已进行 3 轮仍未全部通过

当前状态：
  通过: {N}/{M} 步骤
  仍未通过: {失败步骤列表}

请选择：
1. 继续修复（再尝试一轮）
2. 人工检查（输出当前失败详情，由人工判断）
3. 接受当前状态（标记 gate=partial，后续执行可能存在质量问题）
```
