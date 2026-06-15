# Windows Git Bash 兼容性问题

## 症状

- errorType: `network_error`
- message 关键词: `ENOENT /dev/stdin`、`python3: command not found`、`2>&1 | tee`
- 表现：脚本在 Windows Git Bash 环境下执行失败，报路径或命令不存在

## 根因

Windows Git Bash（MSYS2）有以下兼容性问题：

1. **路径转换**：Git Bash 自动将 `/saas/erp/biz` 转换为 `C:/Program Files/Git/saas/erp/biz`，
   导致 API_PREFIX 被篡改。需设置 `MSYS_NO_PATHCONV=1`。
2. **/dev/stdin 不存在**：某些 node 脚本使用 `/dev/stdin` 读取管道输入，Windows 下不存在。
3. **python3 不可用**：Windows 下 Python 命令通常是 `python` 而非 `python3`。
4. **2>&1 | tee 污染 JSON**：stderr 和 stdout 混合后，JSON 解析失败。

## 影响范围

系统性 — 所有在 Windows Git Bash 下执行的脚本都可能受影响。

## 修复方式（脚本层面）

1. 路径转换问题：
   ```bash
   # 在执行命令前设置
   export MSYS_NO_PATHCONV=1
   ```

2. /dev/stdin 问题：
   ```bash
   # ✗ 错误
   cat /dev/stdin | node script.js
   # ✓ 正确：用参数传递或临时文件
   node script.js --input file.json
   ```

3. python3 问题：
   ```bash
   # ✗ 错误
   python3 -c "..."
   # ✓ 正确：统一用 node
   node -e "..."
   ```

4. 输出捕获问题：
   ```bash
   # ✗ 错误：stderr 污染 stdout
   npx playwright test --reporter=json 2>&1 | tee result.json
   # ✓ 正确（手动执行时）：用环境变量让 Playwright 直接写文件
   PLAYWRIGHT_JSON_OUTPUT_NAME=result.json npx playwright test --reporter=json 2>error.log
   # ✓ 也可以：分离 stderr 和 stdout（但大输出仍可能阻塞管道）
   npx playwright test --reporter=json > result.json 2>error.log
   ```

## 修复方式（插件层面）

run-tests.js 已自动设置 `MSYS_NO_PATHCONV=1`，无需额外修改。
但手动执行时需要用户自行设置。

## 预防措施

- 所有脚本执行使用 run-tests.js 统一入口（自动处理环境变量）
- 手动执行时提醒设置 `MSYS_NO_PATHCONV=1`
- 禁止在脚本中使用 `python3`，统一用 `node`
- 禁止用 `2>&1 | tee` 捕获输出，改用重定向分离
- 检查 storage-state.json 用 node 而非 python
