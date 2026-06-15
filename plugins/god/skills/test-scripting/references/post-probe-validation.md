# 阶段一完成后：验证与配置探测

> 在 run-test 阶段一完成后调用（scope 含前端时）。

## API 路径验证

验证 API 路径配置一致性：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-scripting/scripts/analyze-api-prefix.js" \
    --dom-probe "$WORK_DIR/testing/dom-probe.md" \
    --config "$WORK_DIR/testing/test-config.json"
```

**处理结果**：
- `isConsistent: true` → 继续
- `isConsistent: false` → 展示选择面板让用户确认前缀
