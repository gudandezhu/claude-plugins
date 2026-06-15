---
name: test-case-design
user-invocable: false
description: |
  测试案例设计技能。定义三种案例类型（E2E、单 API、API 业务流程）的设计规范、
  评审打分机制、覆盖率预检规则。
  在 /gen-test 命令中加载。
  当需要设计测试案例、评审案例质量、检查案例覆盖率时，使用此技能。
  本技能只负责案例设计，不涉及脚本生成——脚本由 test-scripting 技能负责。
---

# 三种案例类型

| 案例类型 | 编号前缀 | 消费方 | 说明 |
|---------|---------|--------|------|
| E2E UI 测试案例 | FE- | run-test | 前端页面交互验证 |
| 单 API 接口测试案例 | API- | backend-test | 单接口参数校验、边界值、业务规则 |
| API 业务流程测试案例 | FLOW- | run-test | 多接口串联的业务流程验证 |

# 输入来源

| 输入 | 用途 | 加载条件 |
|------|------|---------|
| PRD 原文 | 业务规则、异常场景表、功能点 | 始终加载 |
| UI 原型 HTML | 表单字段约束、默认值、联动关系 | scope 含前端时 |
| 接口文档 | 接口路径、参数、响应结构 | scope 含后端时 |
| dom-probe-summary.json | 页面交互元素摘要（可选，有探测数据时） | 存在时加载 |
| api-probe-summary.json | 接口摘要（可选） | 存在时加载 |
| businessObjective | 核心业务目标（牵引案例设计） | 始终加载 |
| ac.md | AC 驱动主线（三类 AC 是覆盖基准） | ac.md 存在时加载 |

| 用户视角文档 | 每类用户的业务目标、隐性需求、测试重点 | 始终加载（不存在时自动执行探测） |

# 禁止事项

- 禁止读取 projects/ 下任何源码文件——案例设计基于 PRD + UI 原型 + 接口文档
- 禁止包含脚本编写规范（CSS 选择器、Playwright API、代码模板）——那是 test-scripting 的职责
- 禁止在案例中指定具体的 CSS 选择器或 DOM 结构——案例只描述业务操作和预期结果

# references 按需加载

| reference 文件 | 加载条件 |
|---------------|---------|
| e2e-case-design.md | scope 含前端时，设计 E2E 案例时 |
| api-case-design.md | scope 含后端时，设计单 API 案例时 |
| api-flow-case-design.md | scope 含后端时，设计流程案例时 |
| api-doc-validation.md | scope 含后端时，接口文档校验 |

### 方法论驱动设计（默认启用）

用户视角文档由 Agent 0 在案例生成前自动执行，产物存入 `testing/.cache/user-perspectives/`。
具体如何指导案例设计，详见 `prompts/case-designer.md` 的「用户视角文档」章节。

**上下文保护**：reference 文件由执行者按需读取（通过 `{caseDesignReferencePath}` 路径变量）。
编排层只传递路径，不预读取 reference 文件内容。

# prompts 按角色加载

| prompt 文件 | 角色 | 使用场景 |
|------------|------|---------|
| case-designer.md | 案例生成/修正角色 | 案例生成、修正 |

**上下文保护**：prompt 文件在构造执行上下文时读取，替换模板变量后传入，主上下文不保留 prompt 文件内容。

# 案例模板目录说明

本技能的 `templates/` 目录（e2e-test-case-template.md、api-test-case-template.md、api-flow-test-case-template.md）
是 json-to-md.js 脚本的格式参考，用于将 JSON 转为 Markdown。

# 输出格式（JSON-only + 后处理生成 MD）

案例设计阶段**只输出 JSON 文件**。Markdown 文件由后处理脚本 `scripts/json-to-md.js` 从 JSON 自动生成。

| 案例类型 | case-designer 输出 | json-to-md.js 生成 |
|---------|-------------------|-------------------|
| E2E | `test-cases/e2e-test-cases.json` | `test-cases/e2e-test-cases.md` |
| 单 API | `test-cases/api-test-cases.json` | `test-cases/api-test-cases.md` |
| API 流程 | `test-cases/api-flow-test-cases.json` | `test-cases/api-flow-test-cases.md` |

## JSON Schema（v3）

**E2E / API 共用 Schema**：
```json
{
  "feature": "string — 功能模块名称",
  "version": "v1",
  "requirement": "string — 需求编号",
  "businessObjective": "string — 业务目标（E2E）",
  "generatedAt": "string — ISO 日期",
  "test_cases": [
    {
      "id": "string — FE-{模块}-001 / API-{模块}-001",
      "title": "string — 案例标题",
      "priority": "P0 | P1 | P2",
      "type": "happy_path | negative | edge_case | exception",
      "testPath": "string — 浏览器导航路径（仅 E2E）",
      "covers": ["AC-001", "UI-FORM-002"],
      "preconditions": ["string"],
      "steps": ["string"],
      "expected": ["string"],
      "design_method": "string",
      "tags": ["string"]
    }
  ]
}
```

**Flow Schema**：
```json
{
  "feature": "string",
  "version": "v1",
  "requirement": "string",
  "apiPrefix": "string — API 路径前缀",
  "generatedAt": "string",
  "flowOverview": [{ "id": "", "name": "", "flowType": "", "covers": [], "apis": [] }],
  "test_cases": [
    {
      "id": "FLOW-{模块}-001",
      "title": "流程描述",
      "priority": "P0 | P1 | P2",
      "type": "flow_happy | flow_exception | flow_boundary",
      "flowType": "CRUD 完整流程 | 状态流转 | 业务联动 | 异常中断",
      "writeOps": ["创建"],
      "stateTransitions": "起始状态 → 目标状态",
      "covers": ["AC-001"],
      "preconditions": ["string"],
      "steps": [
        { "step": "S01", "tc": "", "action": "", "api": "", "params": "", "uiExpected": "", "apiExpected": "", "dataPass": "" }
      ],
      "cleanup": "清理策略",
      "design_method": "string",
      "tags": ["string"]
    }
  ]
}
```

covers 字段是 AC 覆盖率的唯一数据源，verify-case-coverage.js 从 JSON 的 covers 字段提取（同时兼容从 MD 的 `覆盖AC:` 提取）。

# 案例文档标准化格式

统一字段：用例编号、测试场景、前置条件、操作步骤（含具体数据值）、预期结果、
优先级（P0/P1/P2）、version（v1/v2）、lastUpdatedBy（case-designer/script-writer）。

# 评审打分机制（脚本化）

由 `scripts/review-case-quality.js` 执行，检查结构化指标，禁止 AI 主观判断。

**4 维度正交评分（满分 100）**：
- 结构完整性（25）：步骤编号 + 前置条件
- 内容精确度（30）：模糊描述检测 + 具体数据值
- 场景覆盖度（30）：正常/异常/边界比例
- 断言有效性（15）：预期结果存在性 + 模糊结果检测

**通过门槛**：综合分 ≥ 80 分 + 无 high 级问题 → passed；≥ 60 分 → auto-fix；< 60 → user-decide。
`--pass-score` 参数可覆盖默认 80 分。

# AC 驱动说明

- ac.md 是案例设计的主线输入，PRD 是补充上下文
- AC 提供"测什么"（覆盖基准），PRD 提供"为什么测"（业务理解）
- ac.md 不存在时自动退回功能点驱动模式，不阻塞流程
- 降级时所有 AC 相关字段（覆盖AC、acRef）留空
- AC 覆盖率阈值：AC 类 100%，UI 类 100%，综合 100%（全覆盖，不允许遗漏）

# 覆盖率预检

案例进入评审前，先执行客观覆盖率预检（verify-case-coverage.js）：
- AC 覆盖率 100%（硬编码，不可配置）→ 未达标则直接修正
- AC-OP 操作语义覆盖 100% → 未达标则直接修正
- 状态转换覆盖 ≥ 90%（留 10% 容差给措辞差异）→ 未达标则直接修正
- 嵌入规则覆盖 ≥ 90%（AC-STS-/AC-CALC-/AC-FMT- 关键词在步骤中出现）→ 未达标则直接修正
- 功能点覆盖率 ≥ 80% → 未达标则直接修正
- 语义检查（PRD 异常场景、业务目标、重复检测）→ 未通过则进入修正

# 与 test-scripting 的边界

| 职责 | test-case-design | test-scripting |
|------|-----------------|----------------|
| 案例设计 | ✅ | ❌ |
| 案例评审 | ✅ | ❌ |
| 脚本生成 | ❌ | ✅ |
| 脚本审核 | ❌ | ✅（test-gate） |
| 选择器规范 | ❌ | ✅ |
| 代码模板 | ❌ | ✅ |
