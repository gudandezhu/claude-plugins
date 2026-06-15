# AC 覆盖矩阵生成

> 由 run-test 步骤四-B 加载，生成 AC 覆盖矩阵。

## 前置条件

- ac.md 已在前置检查阶段确认存在（不存在时已阻塞）
- test-summary.json 已生成（测试已执行完成）

## 执行命令

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/generate-ac-matrix.js" \
  --ac-file "$AC_FILE_ACTUAL_PATH" \
  --testing-dir "$WORK_DIR/testing" \
  --summary-file "$WORK_DIR/testing/.cache/test-summary.json"
```

- `$AC_FILE_ACTUAL_PATH` 为前置检查阶段找到的实际路径（`$WORK_DIR/design/ac.md` 或 `$WORK_DIR/requirement/ac.md`）
- `$CLAUDE_PLUGIN_ROOT` 已在路径解析阶段设置

## 功能覆盖维度矩阵（tree-context.json 存在时增强）

当 `TREE_CONTEXT` 变量非空时，在 AC 覆盖矩阵之外新增功能维度视角：

```
验收报告 - 功能覆盖维度:

| 功能编号 | 功能名称 | 关联AC | 案例数 | 通过 | 失败 | 跳过 |
|---------|---------|--------|--------|------|------|------|
| PRQL-ACT-CRTE | 创建请购需求 | AC-OP-01 | 3 | 2 | 1 | 0 |
| PRQL-ACT-DEL | 删除请购单 | AC-OP-02 | 2 | 2 | 0 | 0 |

未覆盖功能: PRQL-REDO-RPRQ (再次请购)
```

## 失败分析增强（tree-context.json 存在时）

E2E 导航失败时关联菜单树入口：

```
失败案例 FE-PRQL-003:
  导航失败: page.goto('/inventory/purchase-requisition-detailList') 超时
  菜单树入口: L1:进销存 → L3:请购申请列表
  建议: 检查 L1 主导航 Tab "进销存" 是否可点击，或使用菜单导航替代直接 goto
```

## 输出

产出 `testing/.cache/ac-coverage-matrix.json`，步骤五生成报告时读取此文件渲染 AC 覆盖矩阵章节。

## 结果处理

- 全部 PASS → 继续生成报告
- 存在 UNCOVERED 或 FAIL → 由调用方（run-test）展示选择面板
- 脚本执行失败 → 警告但不阻塞报告生成，在报告中标注"AC 矩阵生成失败"
- 不存在 tree-context 时不输出功能维度矩阵（保持现有格式）
