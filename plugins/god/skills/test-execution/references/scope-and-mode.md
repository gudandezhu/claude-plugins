# 范围选择与执行模式

> 由 run-test 交互确认阶段加载。

## autoExecute 分支逻辑

读取 test-config.json 的 `autoExecute` 字段：

**autoExecute.enabled == true 时**：
```
⚡ 自动执行模式 | 范围: {testScope} | 模式: {mode}
💡 直接回车确认，或输入修改后继续
```
- 用户直接回车 → 使用配置值执行，将 `--mode {mode}` 传递给 run-tests.js
- 用户输入修改 → 使用修改后的值

**mode 取值规则**：
- `autoExecute.mode === "parallel"` 或字段不存在 → 使用并行模式（默认）
- `autoExecute.mode === "serial"` → 使用串行模式

**autoExecute.enabled == false 或字段不存在时**，展示测试范围选择面板。

## 测试范围选择面板

```
请选择测试范围：
1. 全部脚本（API业务流程 + E2E）  ← 默认
2. 只跑 API 业务流程测试
3. 只跑前端 E2E
4. 调试脚本（debugMode=true 时可见）

💡 单 API 接口测试请使用 gen-test（backend-test skill） 执行
```

> scope 参数映射：选项 1 → `--scope fullstack`，选项 2 → `--scope backend`，选项 3 → `--scope frontend`
> ⚠️ 不要使用 `e2e` 作为 scope 值，前端 E2E 对应 scope=frontend

## 执行模式选择面板（Step 2.5）

仅当 scope 包含 API+E2E 时展示。scope 仅为 API 或仅为 E2E 时跳过。

```
请选择执行模式：
1. 并行执行  ← 默认
   API 和 E2E 同时启动，总耗时约减半
   适合：CI 环境、后端性能充足的环境
2. 串行执行
   稳定可靠，API 测试完成后再执行 E2E 测试
   适合：单机开发环境、首次执行、后端性能有限
```

mode 值传递给 run-tests.js 的 `--mode` 参数。

## 并行执行配置示例

```json
{
  "autoExecute": {
    "enabled": true,
    "testScope": "all",
    "mode": "parallel"
  }
}
```

配置后，run-test 将：
1. 跳过交互确认面板
2. 使用 `--mode parallel` 调用 run-tests.js
3. API 和 E2E 测试同时启动

## 并行失败处理

run-tests.js 并行执行时的处理策略：

| 场景 | 处理方式 |
|------|---------|
| API 或 E2E 任一超时 | 记录超时状态，另一测试继续执行 |
| API 服务不可用（100% 失败） | 提示用户检查环境，可选择跳过 E2E |

> run-test 并行模式不进行串行降级重试——API 和 E2E 是独立进程，一个失败不影响另一个。用户可根据结果决定是否重新执行。
