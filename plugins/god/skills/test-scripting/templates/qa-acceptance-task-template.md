# {VERSION}-{类型}-{模块/页面名称}验收任务

**任务ID**：{VERSION}-{类型}-{模块/页面名称}-{YYYYMMDD}
**页面名称**：{模块/页面名称}
**创建时间**：{YYYY-MM-DD HH:MM}
**负责人**：@qa
**验收环境**：{URL}
**测试账号**：{TEST_ACCOUNT} / {TEST_PASSWORD}
**{VERSION}新增功能**：{✅ 是 / ❌ 否}

---

## 🎯 任务目标

对{模块/页面名称}进行全面验收测试，确保功能的正确性、稳定性和用户体验符合产品要求。

---

## 📋 测试范围

### UI页面验收（{类型} = UI 时使用）

| 序号 | 功能项 | 优先级 | 备注 |
|------|--------|--------|------|
| 1 | {功能项描述} | P0 | {备注} |
| 2 | {功能项描述} | P1 | {备注} |

### API接口验收（{类型} = API 时使用）

| 序号 | 接口 | 方法 | 优先级 | 备注 |
|------|------|------|--------|------|
| 1 | {接口路径} | GET | P0 | {备注} |
| 2 | {接口路径} | POST | P0 | {备注} |

---

## 🔄 测试流程

### 阶段 1：准备阶段
1. **编写测试用例**
   - 输出文件（UI）：`team-docs/testing/test-cases/frontend/{VERSION}-UI-{页面名称}-test-cases.md`
   - 输出文件（API）：`team-docs/testing/test-cases/api/{VERSION}-API-{模块名称}-test-cases.md`
   - 覆盖正常流程、异常流程、边界条件

2. **编写自动化测试脚本**
   - 输出文件（UI）：`team-docs/testing/scripts/ui/{VERSION}-UI-{页面名称}-test.ts`
   - 输出文件（API）：`team-docs/testing/scripts/api/{VERSION}-API-{模块名称}-test.ts`
   - 使用 Playwright 框架（UI）/ Jest 框架（API）

3. **生成验收清单**
   - 输出文件（UI）：`team-docs/testing/checklists/{version}/{VERSION}-UI-{页面名称}-checklist.md`
   - 输出文件（API）：`team-docs/testing/checklists/{version}/{VERSION}-API-{模块名称}-checklist.md`
   - 基于测试范围创建，含状态跟踪和证据记录列

### 阶段 2：执行阶段
4. **执行验收测试**
   - 运行自动化测试脚本
   - 记录测试证据（截图、日志）
   - 证据目录（UI）：`team-docs/testing/evidence/{version}/{页面名称}/`
   - 证据目录（API）：`team-docs/testing/evidence/{version}/{模块名称}/`

5. **更新验收清单**
   - 在验收清单中实时记录每项测试结果和证据路径

### 阶段 3：输出阶段
6. **生成验收报告**
   - 输出文件（UI）：`team-docs/testing/reports/{version}/{VERSION}-UI-{页面名称}-report.md`
   - 输出文件（API）：`team-docs/testing/reports/{version}/{VERSION}-API-{模块名称}-report.md`
   - 包含测试统计、问题汇总、验收结论

---

## 📝 验收结论

验收完成后填写验收报告，详见输出文件中的验收报告路径。

---

## 📄 输出文件

**UI页面**：
- **测试用例**：`team-docs/testing/test-cases/frontend/{VERSION}-UI-{页面名称}-test-cases.md`
- **测试脚本**：`team-docs/testing/scripts/ui/{VERSION}-UI-{页面名称}-test.ts`
- **验收清单**：`team-docs/testing/checklists/{version}/{VERSION}-UI-{页面名称}-checklist.md`
- **验收报告**：`team-docs/testing/reports/{version}/{VERSION}-UI-{页面名称}-report.md`
- **测试证据**：`team-docs/testing/evidence/{version}/{页面名称}/`

**API接口**：
- **测试用例**：`team-docs/testing/test-cases/api/{VERSION}-API-{模块名称}-test-cases.md`
- **测试脚本**：`team-docs/testing/scripts/api/{VERSION}-API-{模块名称}-test.ts`
- **验收清单**：`team-docs/testing/checklists/{version}/{VERSION}-API-{模块名称}-checklist.md`
- **验收报告**：`team-docs/testing/reports/{version}/{VERSION}-API-{模块名称}-report.md`
- **测试证据**：`team-docs/testing/evidence/{version}/{模块名称}/`

---

## 📎 相关文档

- **验收任务模板**：`team-docs/testing/templates/qa-acceptance-task-template.md`
- **验收结果清单模板**：`team-docs/testing/templates/acceptance-result-checklist-template.md`
- **测试用例模板（UI）**：`team-docs/testing/templates/frontend-test-case-template.md`
- **测试用例模板（API）**：`team-docs/testing/templates/api-test-case-template.md`
- **验收报告模板**：`team-docs/testing/templates/acceptance-report-template.md`

---

**验收人签字**：
**验收日期**：

---

## 📝 占位符说明

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `{VERSION}` | 大写版本号 | V5.5 |
| `{version}` | 小写版本号 | v5.5 |
| `{YYYYMMDD}` | 日期（紧凑） | 20260322 |
| `{类型}` | 验收类型 | UI 或 API |
| `{模块/页面名称}` | 模块或页面名称 | 登录页面、任务模块 |
| `{URL}` | 环境地址 | http://localhost:3100 |
| `{TEST_ACCOUNT}` | 测试账号 | admin@example.com |
| `{TEST_PASSWORD}` | 测试密码 | Admin123! |
| `{X}` | 数量 | 5、11 |

**模板版本**：v7.2
**创建时间**：2026-03-22
**更新时间**：2026-03-23
**维护人**：@qa-team
