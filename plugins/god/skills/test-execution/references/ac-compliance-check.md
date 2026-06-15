# AC 合规检查（执行后维度）

## 前置：确定 ACTIVE_TYPES

从当前执行范围推导 ACTIVE_TYPES：
- `--only=e2e` → `ACTIVE_TYPES="e2e"`
- `--only=api` → `ACTIVE_TYPES="api"`
- `--only=flow` → `ACTIVE_TYPES="flow"`
- 全量执行 → `ACTIVE_TYPES="e2e,api,flow"`

执行 AC 合规检查（执行后维度）：

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/check-ac-test-compliance.js" \
  --testing-dir "$WORK_DIR/testing" \
  --ac-file "$AC_FILE" \
  --ac-assignment "$WORK_DIR/testing/.cache/ac-assignment.json" \
  --summary-file "$WORK_DIR/testing/.cache/test-summary.json" \
  --active-types "$ACTIVE_TYPES" \
  --mode post-execution \
  --output "$WORK_DIR/testing/.cache/ac-test-compliance.json"
```

### 门禁判定

读取 `ac-test-compliance.json` 的 gates 字段：

| 门禁 | 阈值 | 失败处理 |
|------|------|---------|
| acCoverageGate | 100% | 展示未覆盖 AC 列表，阻塞报告生成 |
| testPassGate | 100% | 展示失败测试列表，用户选择：修复/接受 |
| noSkipGate | 0 | 展示跳过测试列表，阻塞报告生成 |

**全部通过** → 继续步骤五生成报告

**任一失败** → 展示选择面板：

```
❌ AC 测试合规检查未通过

AC 覆盖门禁: ✅ 100% (127/127)
测试通过门禁: ❌ 96% (82/85) - 阈值 100%
跳过检测门禁: ❌ 1 个测试被跳过 - 阈值 0

失败测试:
  - FE-PRQL-003: 导航超时
  - FE-PRQL-015: 断言失败

跳过测试:
  - FE-PRQL-022

请选择：
1. 修复失败测试后重新执行
2. 查看详细错误信息
3. 接受当前状态并继续生成报告
```

**选择 3（接受当前状态）时**：
- 在验收报告中标注"⚠️ AC 测试合规检查未通过"
- 记录未通过的测试到缺陷清单
