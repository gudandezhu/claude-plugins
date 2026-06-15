# AC 测试合规检查

> run-test 阶段三 Step 2 调用。执行 AC 合规检查（执行前维度）。

## 前置：确定 ACTIVE_TYPES

从当前生成模式推导 ACTIVE_TYPES（与 ac-coverage-precheck.md 保持一致）：
- `--only=e2e` → `ACTIVE_TYPES="e2e"`
- `--only=api` → `ACTIVE_TYPES="api"`
- `--only=flow` → `ACTIVE_TYPES="flow"`
- 全量模式 → `ACTIVE_TYPES="e2e,api,flow"`

## 检查脚本

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/check-ac-test-compliance.js" \
  --testing-dir "$WORK_DIR/testing" \
  --ac-file "$AC_FILE" \
  --ac-assignment "$WORK_DIR/testing/.cache/ac-assignment.json" \
  --active-types "$ACTIVE_TYPES" \
  --mode pre-execution \
  --output "$WORK_DIR/testing/.cache/ac-test-compliance.json"
```

## 结果处理

读取 `ac-test-compliance.json`：

| overallStatus | 处理 |
|---------------|------|
| PASS | 全部通过 → 更新 progress: gate="done" |
| FAIL | 展示失败项，阻塞后续步骤 |

## 失败时展示面板

```
❌ AC 测试合规检查未通过

TC 实现门禁: ❌ 80% (68/85)
跳过检测门禁: ❌ 3 个测试被跳过

未实现 TC:
  - FE-PRQL-022
  - FE-PRQL-023
  ...

跳过测试:
  - FE-PRQL-030
  - FE-PRQL-031
  - FE-PRQL-032

请选择：
1. 补充缺失的脚本
2. 查看详细问题
3. 跳过门禁（不推荐，质量无保障）
```

**注意**：test.skip 检测为 FAIL 时必须修正，不允许跳过。
