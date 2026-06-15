# 报告合规校验规则

> 由 run-test 步骤五加载，执行验收报告合规校验。

## 执行命令

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/verify-report.js" --testing-dir "$WORK_DIR/testing" --scope <scope>
```

（`$CLAUDE_PLUGIN_ROOT` 已在路径解析阶段设置）

## 检查项

脚本自动检查：
- 验收报告是否包含所有 13 个必填章节
- 验收清单是否存在
- E2E 截图是否覆盖所有 TC 编号
- API 证据是否覆盖所有 TC 编号
- 测试通过率是否达到 `testPolicy.stabilityThreshold` 阈值（默认 80%）

## 结果读取

读取 `testing/.cache/verify-report-result.json` 获取检查结果。

## 结果处理

**通过率未达标（❌）**→ 展示选择面板（要求 100% 全部 success）：
```
❌ 测试通过率 {rate}%，要求 100% 全部 success（{passed}/{total}）

失败用例：{失败用例列表}

请选择：
1. 修复失败用例后重新执行测试（推荐）
2. 继续生成报告（报告中标注"存在失败用例"）
```
用户选择 2 时：在验收报告的验收结论中标注 `❌ 存在失败用例（通过率 {rate}%，{failed} 个失败）`

**AC 覆盖矩阵存在 UNCOVERED 或 FAIL（❌）**→ 展示面板：
```
❌ AC 覆盖矩阵未全部通过（{failCount} FAIL, {uncoveredCount} UNCOVERED）

失败 AC：{failedAc 列表}
未覆盖 AC：{uncoveredAc 列表}

请选择：
1. 修复失败用例后重新执行测试（推荐）
2. 补充缺失案例和脚本（UNCOVERED 的 AC 需要回到 gen-test 补充）
3. 继续生成报告（报告中标注"AC 覆盖不完整"）
```

**必填章节缺失（❌）**→ 补充后重新执行验证

**截图/证据缺失（⚠️）**→ 警告，记录但不阻塞

**全部通过** → 继续
