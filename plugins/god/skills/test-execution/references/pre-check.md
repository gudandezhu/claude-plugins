# 前置检查

> 由 run-test 在前置检查阶段加载，验证执行条件是否满足。

## 基础检查

1. **test-config.json 存在性**：
   - `$WORK_DIR/testing/test-config.json` 不存在 → 提示先执行 `/zcode:run-test`

2. **gate 状态检查**：
   - `progress.gate` 不为 `"done"` → 提示先执行 `/zcode:run-test` 完成门禁
   - **例外**：`debugMode == true` 时跳过 gate 检查（调试模式专门用于门禁通过后的脚本修复验证）

3. **tasks 状态检查**（不阻塞）：
   - 检查 `$WORK_DIR/tasks/` 目录下是否有至少一个迭代的任务状态为 completed
   - 无 completed 任务时警告：`⚠️ 未检测到已完成的迭代任务，建议确认开发已完成`

4. **testingRepo 配置检查**：
   ```bash
   node "$CLAUDE_PLUGIN_ROOT/scripts/test-exec/resolve-test-paths.js" --config "$WORK_DIR/testing/test-config.json"
   ```
   - 输出 `mode=legacy` 或 `mode=no-config` → 调用自动探测：
   ```bash
   node "$CLAUDE_PLUGIN_ROOT/scripts/workspace/workspace-check.js" --config "$WORK_DIR/testing/test-config.json"
   ```
   - 探测失败 → 阻塞，提示用户手动配置或执行 init-workspace

## 增强检查（关键配置完整性）

执行增强预检查脚本，验证配置与环境一致性：

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/test-execution/scripts/pre-check-enhanced.js" \
    --testing-dir "$WORK_DIR/testing" \
    --config "$WORK_DIR/testing/test-config.json"
```

**增强检查项**：
- **API 路径验证**：比对 dom-probe.md 中的 API 路径与 test-config.json 的 apiPrefix 是否一致
- **认证配置验证**：检查 storage-state.json 是否存在、是否包含登录标记
- **测试文件存在性**：统计 E2E 和 API 测试文件数量

### 新增阻塞检查项

| 检查项 | 检查逻辑 | 阻塞条件 |
|--------|---------|---------|
| 探测数据完整性 | `dom-probe.md` 存在且非空（scope 含前端时）；`api-probe.md` 存在且非空（scope 含后端时） | 文件不存在或为空 |
| 测试脚本存在性 | `scripts/e2e/tests/*.spec.ts` 计数 > 0 或 `scripts/api/tests/*.api.test.ts` 计数 > 0 | 对应 scope 的脚本数为 0 |
| 登录态有效性 | `auth/storage-state.json` 存在且可解析为合法 JSON（scope 含前端时） | 文件不存在或 JSON 损坏 |

### 依赖完整性检查 + 自动安装

```bash
# 检查 testing/node_modules 是否存在且包含关键依赖
node -e "
const fs = require('fs');
const path = require('path');
const nm = path.join(process.env.WORK_DIR, 'testing/node_modules');
const missing = [];
if (!fs.existsSync(path.join(nm, '@playwright/test'))) missing.push('playwright');
if (!fs.existsSync(path.join(nm, 'vitest'))) missing.push('vitest');
if (missing.length > 0) {
  console.log(JSON.stringify({status:'missing', packages: missing}));
  process.exit(1);
} else {
  console.log(JSON.stringify({status:'ok'}));
}
"
```

依赖缺失时自动安装：

```bash
if [ $? -ne 0 ]; then
  echo "⚠️ 测试依赖缺失，正在安装到共享目录..."
  node "$CLAUDE_PLUGIN_ROOT/scripts/workspace/init-shared-deps.js"
  if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败，请手动执行: node $CLAUDE_PLUGIN_ROOT/scripts/workspace/init-shared-deps.js"
    # 阻塞执行
  fi
fi
```

**阻塞逻辑**：
- `status: "fail"` → 阻塞执行，展示失败原因
- `status: "warn"` → 展示警告，用户确认后继续
- `status: "pass"` → 继续执行

## 配置面板展示

前置检查完成后，统一展示配置面板：

```
╔═══════════════════════════════════════════════════════╗
║  测试执行 - 配置面板                                   ║
╠═══════════════════════════════════════════════════════╣
║  环境配置:                                             ║
║    前端地址: {frontend.baseUrl}             {状态}      ║
║    后端地址: {backend.baseUrl}              {状态}      ║
║    API 前缀: {backend.apiPrefix}            {状态}      ║
║                                                       ║
║  生成进度:                                             ║
║    {逐项展示 progress 各字段状态}                       ║
║                                                       ║
║  关键配置:                                             ║
║    探测数据: {状态}                                     ║
║    E2E 脚本: {N} 个 spec 文件                          ║
║    API 脚本: {N} 个 test 文件                          ║
║    登录态:   {状态}                                     ║
║    依赖:     {状态}                                     ║
║    测试仓库: {模式}                                     ║
║                                                       ║
║  自动执行: {启用/关闭}                                  ║
╚═══════════════════════════════════════════════════════╝
```

阻塞项显示为 ❌ 时：
```
❌ 关键配置缺失，无法执行测试：

  ❌ {缺失项}
     → {修复建议}
```

## 阻塞逻辑（基础检查）

- 基础检查项 1 和 2 为阻塞条件（debugMode=true 时 2 放宽）
- 基础检查项 3 为警告，不阻塞执行
- 不要在门禁未通过时执行测试——脚本可能不完整或有质量问题，执行结果没有参考价值
