# vitest include 路径解析导致 0 个测试文件被找到

## 症状

API 测试执行后 test-summary.json 中 `api.total = 0`，api-console.log 显示无测试文件匹配。
run-tests.js 输出 `API: 0/0 通过, 0 失败`。

## 根因

两个叠加问题：

1. **include 路径相对 CWD 解析**：`include: ['tests/**/*.api.test.ts']` 相对 CWD（`testing/`）解析，但测试文件在 `testing/scripts/api/tests/`，路径不匹配，0 个文件被找到。

2. **`__dirname` 在 vitest TS 配置中不可靠**：vitest 用 esbuild 动态编译 `.ts` 配置文件时，`__dirname` 指向临时目录而非配置文件所在目录，`root: path.resolve(__dirname)` 无法正确解析。

## 影响范围

系统性——所有旧版本生成的 vitest.config.ts 都受影响。gen-skeleton.js 已修复，新生成的项目不受影响。

## 修复方式（脚本层面）

将 `testing/scripts/api/vitest.config.ts` 替换为：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['scripts/api/tests/**/*.api.test.ts'],
    exclude: ['**/test-runs/**', '**/node_modules/**'],
  },
});
```

关键：`include` 使用相对 CWD（`testing/`）的路径，run-tests.js 始终以 `testing/` 为 cwd 执行 vitest，路径始终可靠。不使用 `root` 或 `__dirname`。

## 修复方式（插件层面）

`scripts/test-design/gen-skeleton.js` 的 `generateVitestConfig()` 已修正：
- 移除 `root: path.resolve(__dirname)`
- `include` 改为 `'scripts/api/tests/**/*.api.test.ts'`（相对 CWD）

## 预防措施

run-test 预检阶段若 API total=0 且无 processError，检查 vitest.config.ts 的 include 路径是否为 `scripts/api/tests/**/*.api.test.ts`（相对 testing/ CWD）。旧格式（`tests/**/*.api.test.ts` 或含 `root/__dirname`）需重新生成。
