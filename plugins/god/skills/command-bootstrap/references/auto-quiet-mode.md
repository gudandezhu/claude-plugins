# --auto / --quiet 公共模式定义

> 由 gen-test、run-test 在初始化阶段加载。
> 各命令只需在自身文件中声明"本命令 --auto 特有行为"和"本命令 --auto 豁免的禁止事项"。

## --auto 模式公共规则

### 交互面板自动选择

--auto 模式下，所有交互确认面板自动选择"继续执行"方向：
- 配置确认面板 → 自动确认当前配置
- 范围/模式选择面板 → 使用参数中的 scope，mode 默认 parallel
- 其他选择面板 → 自动选择"继续"方向

### test-config.json 不存在时

所有命令统一行为：阻塞，写入 exec-report.json:
```json
{ "status": "blocked", "errors": [{ "type": "config_missing" }] }
```

### 门禁/评审循环行为

1. 门禁脚本正常执行，输出通过/不通过
2. 如果通过 → 正常继续
3. 如果不通过：
   a. 第 1-2 轮：正常执行修复迭代（与非 --auto 模式相同）
   b. 第 2 轮结束后仍不通过：
      - 记录 gate 降级: `{ "gate": "{gate名}", "status": "forced_pass", "round": 2 }`
      - 写入 exec-log.txt
      - 强制通过，继续后续流程
4. 最终 exec-report.json 中标记: `gateOverrides: ["{gate名}_forced_pass_round_2"]`

### artifact-commit

--auto 模式下统一跳过 artifact-commit（不自动提交产物）。

### --auto 模式豁免模板

各命令的禁止事项中，标注 **（--auto 模式豁免）** 的条目在 --auto 模式下自动豁免。
未标注的禁止事项在 --auto 模式下仍然生效。

## --quiet 模式行为（通用）

- 不输出过程性描述文字
- 不输出生成的产物全文（案例/脚本/报告）
- 只输出关键节点状态（一行格式）: `[阶段] 关键信息`
- 详细内容写入 `testing/.cache/auto-verify/round-N/exec-log.txt`
  （独立使用 --quiet 时写入 `testing/.cache/exec-log.txt`）
- 命令结束时写入 exec-report.json

## --quiet 模式下的 Subagent 派遣

如果当前处于 --quiet 模式，在派遣每个内部 subagent 时，在 subagent prompt 末尾追加：

```
## 输出模式：quiet

你处于 --quiet 模式。遵循以下输出规则：
- 不输出过程性描述文字（"正在分析..."、"开始生成..."）
- 不输出生成的产物全文
- 只在关键节点输出一行状态: "[阶段] 关键信息"
- 产出文件正常写入磁盘（不受 quiet 影响）
- 错误信息正常输出（不抑制）
```

## exec-report 写入（--auto 或 --quiet 模式时）

如果参数包含 --auto 或 --quiet，在命令结束时（无论成功/失败）调用 write-exec-report.js：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/auto-verify-fix/scripts/write-exec-report.js" \
  --work-dir "$WORK_DIR" \
  --status "{success|failed|blocked}" \
  --command "{当前命令名}" \
  --scope "{scope}" \
  --round "{当前轮次，仅 auto-verify 模式}" \
  --duration "{执行总时长ms}" \
  --gate-overrides "{降级列表，逗号分隔}"
```

如果有错误，追加 `--errors '<errors JSON>'`。
如果有额外输出数据（如 run-test 的测试结果统计），追加 `--outputs '<outputs JSON>'`。
