# 后端 API 路径探测（scope 含后端时）

> 由命令文件在测试范围含后端时加载。

## 依赖检查

测试依赖（vitest、@playwright/test、axios）安装在 `$WORK_DIR/testing/` 目录下。
首次安装后，`node_modules/`、`package.json`、`package-lock.json` 会跨轮次保留，
重新生成（run-test 选项 3）和重新执行（run-test）都不会清除它们。

检查逻辑：

```bash
node --version          # 唯一硬性依赖

# 检查 testing/node_modules 是否已有依赖（已安装则跳过）
if [ ! -d "$WORK_DIR/testing/node_modules/vitest" ] || [ ! -d "$WORK_DIR/testing/node_modules/@playwright" ]; then
  cd $WORK_DIR/testing
  npm init -y 2>/dev/null
  npm install vitest @playwright/test axios 2>&1
fi

# 浏览器可用性由 pre-check.js 统一检查和降级，此处不重复检查

# agent-browser（DOM 探测时需要，测试执行不需要）
agent-browser --version   # 未安装 → npm i -g agent-browser && agent-browser install
```

插件自带的工具脚本已编译为 JS，用 `node` 直接运行，零 npm 依赖。
只有测试脚本本身需要 vitest/playwright/axios，这些安装在 testing/ 目录下。

## 为什么需要探测

后端的 apiPrefix 可能是 /api/v1、/saas/erp/biz、或空字符串，
不同来源（接口文档、技术方案、项目代码）给出的值可能不一致。
硬编码错误的 apiPrefix 会导致所有 API 测试请求 404。

## 探测来源（按优先级）

1. **swagger-probe 自动检测**（后端服务运行时，推荐）
   - swagger-probe.js 的 `detectApiPrefix()` 从所有接口路径中自动提取公共前缀
   - 结果写入 `testing/.cache/api-probe-summary.json` 的 `apiPrefix` 字段
   - 如果 api-probe-summary.json 已存在且 apiPrefix 非空，直接使用（无需重复探测）
   ```bash
   # 检查已有探测结果
   node -e "const fs=require('fs'),p='$WORK_DIR/testing/.cache/api-probe-summary.json';if(fs.existsSync(p)){const d=JSON.parse(fs.readFileSync(p,'utf8'));if(d.apiPrefix){console.log('DETECTED:'+d.apiPrefix);process.exit(0)}}process.exit(1)"
   ```
2. **Swagger/OpenAPI 文档**（后端服务运行时）
   - 访问 `<backend.baseUrl>/v3/api-docs` 或 `/swagger-resources` 获取 API 定义
   - 从 paths 中提取所有接口路径，分析公共前缀
   - 这是最准确的来源，因为 Swagger 从代码注解自动生成
3. **运行时探测**（后端服务运行时，swagger 不可用时）
   - 请求 baseUrl 根路径，检查是否 404
   - 如果 404，尝试常见前缀（/api、/v1 等）
   - 或从前端页面网络请求中提取共同前缀
4. 后端项目源码（test-config.json 中 projects.backend 不为 null 时）
   - Java: `@RequestMapping` 类级注解、`server.servlet.context-path`
   - Node: `app.use('/prefix', router)`、express/koa 路由前缀
   - Python: `url_prefix`、`ROOT_URLCONF`
   - Go: `r.Group("/prefix")`
5. 接口文档（`$WORK_DIR/${paths.apiDocs}/*.md`）：提取所有接口路径，分析公共前缀
6. 技术方案（`$WORK_DIR/${paths.techDesign}`）：提取后端服务地址、端口、context-path

## 必须人工确认的情况

以下情况不要自动选择，必须展示探测结果让用户确认：
- 不同来源的探测值不一致——自动选择可能选错，导致后续所有请求失败
- 所有来源都未找到 apiPrefix——猜测不如让用户告诉你
- 用户未提供后端项目路径且接口文档无法推断前缀

展示格式：
| 配置项 | 探测值 | 来源 |
|--------|--------|------|
| 后端端口 | 8080 | tech-design.md |
| API 前缀 | （由探测自动填充） | 接口文档公共前缀 |
