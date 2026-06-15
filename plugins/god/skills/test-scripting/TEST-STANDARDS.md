# 测试规范

## TC 编号命名规范

### API 测试用例
格式：`API-{模块编号}-{用例编号}`
子类型：正常 01-99，异常 E01-E99，边界 B01-B99
示例：API-AUTH-001、API-AUTH-001-E01

### 前端测试用例
格式：`FE-{页面编号}-{用例编号}`
示例：FE-LOGIN-001、FE-TASK-001

## 测试覆盖要求

- API 接口覆盖率：100%（所有对外接口）
- 前端页面-操作覆盖率：100%（所有页面功能）
- 每个模块必须覆盖：正常流程、异常流程、边界条件

## 问题分级标准

| 等级 | 定义 | 处理要求 |
|------|------|---------|
| P0 | 系统崩溃、核心功能不可用、数据丢失 | 立即停止测试，立即修复 |
| P1 | 重要功能异常、性能严重下降 | 24h 内修复，回归验证 |
| P2 | UI 显示问题、文案错误、非核心功能异常 | 72h 内修复，可延期 |

## 优先级定义

- P0：核心功能，必须测试
- P1：重要功能，推荐测试
- P2：一般功能，可选测试

## 模板按需加载

根据当前阶段加载对应模板，不要一次读取所有模板。

| 触发阶段 | 加载模板 | 路径 |
|---------|---------|------|
| run-test 阶段二（E2E 脚本） | 前端测试用例模板 | templates/frontend-test-case-template.md |
| run-test 阶段二（API 脚本） | API 测试用例模板 | templates/api-test-case-template.md |
| run-test 冒烟测试 | 冒烟测试模板 | templates/smoke-test-template.md |
| run-test 发现缺陷 | Bug 报告模板 | templates/bug-report-template.md |
| run-test 验收报告 | 验收报告 + 验收清单 | templates/acceptance-report-template.md + acceptance-result-checklist-template.md |
| run-test 测试总结（可选） | 测试总结模板 | templates/test-summary-template.md |
| 手动创建验收任务 | QA 验收任务模板 | templates/qa-acceptance-task-template.md |

## 证据命名规范

- E2E 截图：`{TC编号}_{步骤序号}.png`（如 FE-RULE-001-01_01.png）
- API 证据：`{接口名}-{TC编号}.json`
- 截图保存到 `testing/screenshots/`，API 证据保存到 `testing/evidence/api/`
