# 报告生成

tree-context 存在性检查：
```bash
TREE_CTX="{WORK_DIR_LITERAL}/testing/.cache/tree-context.json"
if [ -f "$TREE_CTX" ]; then
  echo "TREE_CONTEXT=$TREE_CTX"
else
  echo "NO_TREE_CONTEXT"
fi
```

加载 `skills/test-execution/references/ac-matrix-generation.md`，生成 AC 覆盖矩阵。
加载 `skills/test-execution/SKILL.md`：
- 生成缺陷清单（有缺陷时）
- 生成验收报告 + 验收清单
加载 `skills/test-execution/references/verify-report-rules.md`，执行合规校验。

通过率未达标 → 展示选择面板。
AC 矩阵未通过 → 展示选择面板。
