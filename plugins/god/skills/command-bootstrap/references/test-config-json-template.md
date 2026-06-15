# 生成 test-config.json

> 由命令文件在用户确认配置面板后加载。

## JSON 模板

```json
{
  "scope": "fullstack",
  "headed": false,
  "businessObjective": "",
  "caseScope": "all",
  "frontend": { "baseUrl": "http://localhost:9090", "uiFramework": null, "routePrefix": null },
  "backend": { "baseUrl": "http://localhost:8080", "apiPrefix": "", "authHeaderName": "Authorization", "authHeaderFormat": "Bearer {token}" },
  "swagger": { "url": "http://localhost:8080/v3/api-docs", "source": "auto" },
  "techStack": {
    "frontend": "vue",
    "uiLibrary": "element-plus",
    "backend": "spring-boot",
    "customOverlay": null,
    "customHints": null
  },
  "paths": {
    "prd": "requirement/prd",
    "ui": "requirement/ui",
    "techDesign": "design/tech-design.md",
    "apiDocs": "{探测结果，未找到则为空字符串}",
    "taskList": "tasks/{迭代编号}/task-list.json"
  },
  "projects": { "frontend": null, "backend": null },
  "testingRepo": null,
  "auth": null,
  "domProbe": { "status": "pending", "probedAt": null },
  "apiProbe": { "status": "pending", "probedAt": null },
  "timeout": { "navigation": 30000, "action": 10000, "api": 15000, "apiParallel": 180000, "e2eParallel": 300000, "serialApi": 300000, "serialE2e": 300000, "perTestMs": 120000 },
  "execution": { "workers": 1, "retries": 1 },
  "autoExecute": {
    "enabled": true,
    "countdownSeconds": 30,
    "caseTypes": ["e2e", "api", "flow"],
    "scriptTypes": "all",
    "testScope": "all",
    "mode": "parallel"
  },
  "browser": "local-chrome",
  "git": {
    "commitFormat": "test({scope}): {message}",
    "autoGitignore": true
  },
  "progress": {
    "domProbe": "pending", "apiProbe": "pending",
    "e2eCases": "pending", "apiCases": "pending",
    "e2eScripts": "pending", "apiScripts": "pending",
    "apiFlowCases": "pending", "apiFlowScripts": "pending",
    "gate": "pending"
  }
}
```

## autoExecute 字段说明

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `enabled` | boolean | 是否启用自动执行（跳过交互确认） | `false` |
| `countdownSeconds` | number | 倒计时秒数（提示用户可中断） | `30` |
| `caseTypes` | string[] | gen-test 默认案例类型 | `["e2e", "api", "flow"]` |
| `scriptTypes` | string | run-test 默认脚本类型：`all`/`e2e`/`api-flow` | `"all"` |
| `testScope` | string | run-test 默认测试范围：`all`/`api`/`e2e` | `"all"` |
| `mode` | string | 执行模式：`parallel`（并行，默认）/ `serial`（串行） | `"parallel"` |

**mode 取值说明**：

| 值 | 说明 | gen-test | run-test | run-test |
|----|------|---------------|-----------------|----------|
| `parallel` | 并行执行（默认，推荐） | E2E/API/Flow 并行生成 subagent | E2E+API 流程并行 subagent | API+E2E 并行执行 |
| `serial` | 串行执行 | 逐类型串行生成 subagent | 逐类型串行生成 | API 完成后执行 E2E |

## customOverlay 配置

`techStack.customOverlay` 为可选字段，用于非内置 UI 框架的覆盖层配置：
```json
{
  "techStack": {
    "uiLibrary": "vuetify",
    "customOverlay": {
      "selectors": [".v-overlay:not(.v-dialog__content)"],
      "localStorageKeys": { "vuetify-tour-done": "true" }
    }
  }
}
```
- 内置映射覆盖 Element Plus / Ant Design / Naive UI，无需配置
- 其他 UI 框架通过 `customOverlay` 配置
- 不配置时 MutationObserver 兜底层仍能检测未知框架的覆盖层

## storageStatePatches 配置

`auth.storageStatePatches` 为可选字段，用于配置 localStorage 认证标志：
```json
{
  "auth": {
    "type": "cas",
    "ssoUrl": "passport.example.com",
    "storageStatePatches": {
      "localStorage": [
        { "name": "SAASERPCASLOGIN", "value": "true" },
        { "name": "isLogin", "value": "true" }
      ]
    }
  }
}
```
- `localStorage` 数组配置需要检查和注入的认证标志
- 每项包含 `name`（标志名）和 `value`（期望值）
- `pre-check.js` 检查这些标志是否为期望值，不匹配时提示重新获取登录态
- `inject-auth-flag.js` 从配置读取注入项，无配置时使用默认值
- 未配置时跳过检查，保持向后兼容

## git 配置说明

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `commitFormat` | string | 测试仓库提交信息格式模板 | `"test({scope}): {message}"` |
| `autoGitignore` | boolean | 是否自动生成 testing/.gitignore | `true` |

**commitFormat 占位符**：
- `{scope}` — 需求编号（如 `REQ-001`）
- `{message}` — 命令标识（如 `run-test`）

示例：
- 默认格式：`test(REQ-001): run-test`
- 自定义：`"chore(test-{scope}): auto {message}"` → `chore(test-REQ-001): auto run-test`

## .gitignore

同时生成 `testing/.gitignore`：
```
node_modules/
screenshots/
evidence/
.cache/
test-runs/
auth/storage-state.json
```

敏感信息（账号密码）使用环境变量引用，不硬编码——硬编码会泄露到版本控制。

## testingRepo 自动探测（配置生成后立即执行）

test-config.json 写入磁盘后，立即执行测试仓库探测：

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/workspace/workspace-check.js" --config "$WORK_DIR/testing/test-config.json"
```

- 输出含 `"error"` 字段 → 警告但不阻塞（gen-test 阶段不强制要求 testingRepo）：
  ```
  ⚠️ testingRepo 自动探测失败（{error}），后续 run-test 时将重新探测。
  ```
- 输出含 testingRepo 数据 → 已自动写入 test-config.json，展示确认：
  ```
  ✅ 测试仓库已关联：biz-test-regression → {path}
  ```

> 设计理由：testingRepo 探测前置到配置创建时，避免后续 run-test 依赖 LLM 文本指令触发探测（容易被跳过）。
