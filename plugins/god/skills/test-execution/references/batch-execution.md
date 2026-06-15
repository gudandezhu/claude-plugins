# 自适应分批执行（E2E 文件 > 30 时自动启用）

当 E2E 测试文件数量超过 30 时，run-tests.js 自动启用自适应分批：
1. **校准批次**：先跑 5 个文件，测量平均耗时
2. **动态批次**：根据实测耗时计算每批文件数 = 时间预算(8min) / 平均耗时 x 0.8 安全系数
3. **滚动调整**：每批完成后用指数移动平均更新耗时估算
4. **断点续跑**：进度写入 batch-progress.json，中断后可恢复
5. **超时降级**：批次超时时自动回退到逐文件执行
6. **结果合并**：所有批次结果合并为 e2e-raw.json，与 parse-results.js 兼容

关键文件：
- 进度文件：`testing/.cache/batch-progress.json`（phase: "running" | "complete"）
- 批次结果：`testing/.cache/e2e-batch-{N}.json`
- 批次日志：`testing/.cache/e2e-batch-{N}.log`

**Reporter 配置**：playwright.config.ts 已配置双 reporter（json + line）：
- json reporter：结构化结果写入 PLAYWRIGHT_JSON_OUTPUT_NAME 指定的文件
- line reporter：实时进度输出到 stdout，被捕获到 e2e-console.log（或批次 log）

这使得执行期间的进度可见，避免 LLM 因"日志 0 字节"误判进程卡死。

**stdout 输出**：run-tests.js 输出步骤标题、批次进度和退出码摘要到 stdout。
测试框架的详细进度日志写入 .cache/e2e-console.log 或批次 log 文件。
诊断失败时读取对应的 log 文件即可。
