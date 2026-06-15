# Testing-Repo 独立运行模式

Testing-Repo 可脱离插件会话独立执行测试，通过 `run.sh`（Linux/macOS）或 `run.ps1`（Windows）入口：

```bash
# Linux/macOS
cd $TESTING_REPO && ./scripts/run.sh --scope frontend

# Windows PowerShell
cd $TESTING_REPO; .\scripts\run.ps1 --scope frontend
```

入口脚本职责：加载 `.env` 环境变量 → 设置 `TESTING_REPO_MODE=1` → 转发到插件 `run-tests.js`。

**环境变量 `TESTING_REPO_MODE=1`**：
- 由 `run.sh` / `run.ps1` 设置，或由 `run-tests.js` 检测到 testing-repo 模式后自动设置
- `pre-check.js` 据此切换 storageState 路径：`.cache/.auth/storage-state.json`（而非 `testing/auth/`）
- `playwright.config.ts` 据此切换配置路径

**`--config .env` 参数**：
- Testing-Repo standalone 模式下，config 指向 `.env` 文件而非 `test-config.json`
- `run-tests.js` 检测到 `.env` 后缀时，使用 dotenv 加载环境变量（fallback 手动逐行解析）
- 从环境变量构造等效的 configData 对象（FRONTEND_URL → frontend.baseUrl 等）

## 测试仓库模式（Phase 3）

> 以下内容仅在 testingRepo 已配置时适用。

### 执行路径解析

testingRepo 已配置时，执行路径从测试仓库读取：

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/test-exec/resolve-test-paths.js" --config "$WORK_DIR/testing/test-config.json"
```

- 输出 `"mode": "legacy"` 或 `"mode": "no-config"` → 阻塞，提示配置 testingRepo（由前置检查处理）
- 输出 `"mode": "testing-repo"` → 使用测试仓库路径：
  - E2E 路径：`{projectRoot}/tests/e2e/`（递归扫描 features/ 和 flows/ 子目录）
  - API 流程路径：`{projectRoot}/tests/api/flows/`
  - API 单接口路径：`{projectRoot}/tests/api/features/`
  - `changeType=infra` 时执行全量回归或用户手动指定范围
  - 从 `workspace-manifest.json` 读取 `affectedGroups`/`affectedFlows` 推导执行范围

### 两轮执行编排

Phase 3 执行分两轮：

**第一轮：API 流程测试**（快速验证接口连通性）
```bash
# 从 tests/api/flows/ 收集 API 流程测试
npx vitest run {projectRoot}/tests/api/flows/ --reporter=json
```
- API 流程全部失败（100% 失败率）→ 提示用户"API 服务可能不可用"并询问是否跳过 E2E

**第二轮：E2E 功能组 + 流程统一执行**（第一轮完成后执行）
```bash
# tests/e2e/ 下递归执行所有测试
npx playwright test \
  {projectRoot}/tests/e2e/ \
  --workers=2 --retries=1
```

- 智能跳过：从 Playwright 报告提取失败的 describe 块，与 flows.steps 比对
- 降级策略：编号标注缺失时回退到功能组级跳过

### 报告格式（Phase 3 新增）

报告末尾增加"因依赖未合并而跳过的流程"专项统计：
- 跳过的流程不计入通过率分母
- 报告标题标注跳过数量：`"总计：18/18 通过（2 个流程因依赖未合并跳过）"`
