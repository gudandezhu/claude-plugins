# API Helpers 前置检查

> 在 run-test 前置检查阶段调用（scope 含后端时）。

验证 API helpers 目录存在（gen-skeleton.js 应已生成）：

```bash
if [ ! -f "$WORK_DIR/testing/scripts/api/helpers/auth.ts" ]; then
  echo "⚠️ helpers/auth.ts 不存在，重新运行 gen-skeleton.js 生成"
  node "$CLAUDE_PLUGIN_ROOT/scripts/test-design/gen-skeleton.js" --testing-dir "$WORK_DIR/testing"
fi
```

> 注意：gen-skeleton.js 生成基础设施文件（playwright.config.ts、vitest.config.ts、fixtures.ts、helpers/）到本地 `$WORK_DIR/testing/`，这是设计意图——基础设施跟随需求目录，测试脚本输出到 testingRepo。
