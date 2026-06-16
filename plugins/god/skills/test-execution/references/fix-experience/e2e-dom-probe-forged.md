# dom-probe.md 由 LLM 从 PRD 推断伪造，导致 E2E 选择器全部失效

## 症状

- E2E 测试 100% 失败，errorType 为 `selector_not_found` 或 `unknown`
- 失败消息：`.el-table` 等标准 Element Plus 选择器超时找不到
- 实际页面使用自定义组件（如 `SuperTable`），但脚本里全是 `.el-table`
- dom-probe.md 头部标题为"交互清单（PRD + UI 原型驱动）"
- dom-probe.md 探测时间戳为整点（如 `03:30:00.000Z`）

## 根因

LLM 在 run-test 阶段一执行 dom-probing 时，完成了步骤 2a-pre（探测规划生成）后，
将规划文档直接当作 dom-probe.md 的最终输出，跳过了后续真正的 Playwright runtime 探测步骤（2a、2b、2c）。

步骤 2a-pre 的输出格式与 dom-probe.md 格式相似（同样有"交互清单"标题），
LLM 误认为已完成探测，实际上从未启动 Playwright 访问页面。

选择器标注 `verified` 是基于"这是 Element Plus 项目，应该有 `.el-table`"的推断，
不是 Playwright runtime snapshot 验证的结果。

## 影响范围

系统性——任何使用自定义组件封装的页面都会出现此问题。
标准 Element Plus 页面可能侥幸通过（推断选择器恰好正确），但仍属于伪造探测。

## 修复方式（脚本层面）

重新执行 run-test 的阶段一（DOM 探测），确保 Playwright 真实访问页面：

```
/zcode:run-test {需求编号}
→ 选择"重新生成"
→ 阶段一会重新执行 Playwright 探测
```

或单独重新探测：
1. 删除旧的 dom-probe.md
2. 重新执行 run-test，从阶段一开始

## 修复方式（插件层面）

已修复以下文件：

- `skills/test-probing/references/dom-probing.md`：
  - 文件顶部新增"⛔ 核心禁令"章节，明确禁止将 2a-pre 输出作为 dom-probe.md
  - 步骤 2a-pre 标题改为"探测规划"，输出路径改为 `.cache/probe-plan.md`（不是 dom-probe.md）
  - 步骤三新增时间戳真实性要求（禁止整点时间）

- `skills/test-gate/scripts/gate-check.js`：
  - 新增步骤 17：dom-probe.md 真实性检查
  - 检测整点时间戳、仅含 PRD 驱动内容、全部通用 .el- 选择器三种伪造特征

## 预防措施

gate-check 步骤 17 会自动检测以下伪造特征：
1. 探测时间戳为整点（`HH:00:00.000Z` 或 `HH:30:00.000Z`）
2. 仅包含"交互清单（PRD + UI 原型驱动）"内容，无 snapshot 运行时数据
3. 所有选择器均为标准 `.el-` 前缀，无自定义组件选择器

任意一条触发则门禁失败，强制重新执行真实探测。
