# 项目结构参考

## 输入来源

所有输入路径相对于 `$WORK_DIR`，实际值从 `test-config.json` 的 `paths` 字段读取。
`paths` 字段不存在时使用以下默认值：

| 输入 | 配置键 | 默认路径 | 说明 |
|------|--------|---------|------|
| 需求文档（PRD） | `paths.prd` | `requirement/prd` | 功能需求、验收标准 |
| UI 设计稿/原型 | `paths.ui` | `requirement/ui` | 页面结构、交互流程 |
| 技术方案 | `paths.techDesign` | `design/tech-design.md` | 架构、接口总览、数据库 |
| 任务列表 | `paths.taskList` | `tasks/{迭代编号}/task-list.json` | 前后端任务拆分 |
| 接口文档 | `paths.apiDocs` | `tasks/api` | 接口详细定义 |

## testingRepo 强制模式

**所有测试脚本必须输出到集中测试仓库（testingRepo），禁止降级到本地 testing/ 目录。**

从 `test-config.json` 的 `testingRepo` 字段获取仓库路径：
- `testingRepo.path`: 仓库根目录（支持 `$JLC_AI_WORKSPACE` 变量）

脚本输出路径模板（功能树存在时按 groupId 分组，否则扁平）：
- E2E 测试：功能树存在时 `{testingRepo.path}/tests/e2e/features/{groupId}/*.spec.ts`；不存在时 `{testingRepo.path}/tests/e2e/features/*.spec.ts`
- API 测试：`{testingRepo.path}/tests/api/features/*.api.test.ts`
- 选择器：`{testingRepo.path}/selectors/`

`{groupId}` 由 `scripts/lib/group-dir-map.js` 从 `tree-context.json` 提取（如 `PRQL-FLTR`）。

## 配置文件生成分工

以下文件由 gen-skeleton.js 自动生成，LLM 不需要编写：
- `{testingRepo}/playwright.config.ts`（项目根）
- `{testingRepo}/vitest.config.ts`（项目根）
- `{testingRepo}/fixtures.ts`（项目根）

LLM 仍然需要生成（gen-skeleton.js 不覆盖）：
- `{testingRepo}/shared/auth.setup.ts`（仅 testing-repo 独立模式下 Playwright 自动登录时需要；标准模式由 auto-login-passport 获取 storageState）
- `{testingRepo}/shared/api-client.ts`（需要认证时）
- `{testingRepo}/tests/e2e/features/{groupId}/*.spec.ts` 或 `{testingRepo}/tests/e2e/features/*.spec.ts`（测试脚本）
- `{testingRepo}/tests/api/features/*.api.test.ts`（测试脚本）

## testing/ 目录作用

**testing/ 目录仅存放配置文件和探测数据，不存放测试脚本：**

```
testing/
├── test-config.json              # 测试配置（含 testingRepo 路径）
├── dom-probe.md                  # DOM 探测报告（scope 含前端）
├── api-probe.md                  # API 探测报告（scope 含后端）
├── test-cases/
│   ├── e2e-test-cases.md         # E2E 测试案例文档
│   └── api-test-cases.md         # API 测试案例文档
├── auth/
│   └── storage-state.json        # 登录态存储（需要认证时）
├── screenshots/                  # 截图证据
├── evidence/api/                 # API 测试证据
├── reports/
│   ├── acceptance-report.md
│   └── test-summary.md
└── .cache/                       # 缓存和临时文件
```

## 集中测试仓库目录结构

功能树存在时（分组结构）：
```
{testingRepo.path}/
├── features/
│   └── {groupId}/                    ← 功能树 groupId（如 PRQL-FLTR）
│       └── e2e/
│           ├── playwright.config.ts  # gen-skeleton.js 自动生成
│           ├── fixtures.ts           # gen-skeleton.js 自动生成
│           ├── auth.setup.ts         # 仅 testing-repo 独立模式时
│           └── tests/
│               └── {模块}.spec.ts    # E2E 测试脚本
├── scripts/
│   └── api/
│       └── helpers/
│       │   └── auth.ts               # 需要认证时
│       ├── vitest.config.ts          # gen-skeleton.js 自动生成
│       └── tests/
│           └── {接口}.api.test.ts    # API 测试脚本
└── selectors/
    └── {模块}-selectors.ts           # 选择器定义
```

功能树不存在时（扁平结构）：
```
{testingRepo.path}/
├── features/
│   └── e2e/
│       ├── playwright.config.ts
│       ├── fixtures.ts
│       └── tests/
│           └── {模块}.spec.ts
├── scripts/
│   └── api/
│       ├── helpers/
│       ├── vitest.config.ts
│       └── tests/
│           └── {接口}.api.test.ts
└── selectors/
    └── {模块}-selectors.ts
```

## 工具分工

DOM 探测工具负责"看"（探测页面结构、诊断失败），Playwright 负责"跑"（执行脚本）。
DOM 探测工具的详细使用规范在 test-probing 技能中。
