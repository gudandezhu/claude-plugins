# defect-list.json 结构定义

```json
{
  "version": "1.0",
  "generatedAt": "2026-04-07T10:30:00Z",
  "summary": {
    "total": 3,
    "byType": { "frontend": 1, "backend": 2 },
    "bySeverity": { "P0": 0, "P1": 2, "P2": 1 }
  },
  "defects": [
    {
      "id": "DEF-001",
      "severity": "P1",
      "type": "backend",
      "module": "规则管理",
      "title": "创建规则接口返回 500",
      "tcId": "API-RULE-002",
      "endpoint": "POST /saas/erp/biz/rule/create",
      "expected": "HTTP 200, code=0, 返回新建规则 ID",
      "actual": "HTTP 500, NullPointerException",
      "errorMessage": "完整错误信息",
      "sourceLocation": {
        "file": "src/main/java/com/xxx/service/RuleServiceImpl.java",
        "line": 45,
        "method": "create",
        "hint": "搜索提示（无法精确定位时）"
      },
      "reproSteps": ["POST /saas/erp/biz/rule/create", "Body: {...}"],
      "evidence": { "request": "evidence/api/rule-create-API-RULE-002.json", "screenshot": null },
      "suggestedFix": "rule.getConfig() 可能为 null，需要空值检查"
    }
  ]
}
```

## 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| id | ✅ | 缺陷编号，格式 DEF-NNN |
| severity | ✅ | P0/P1/P2 |
| type | ✅ | frontend / backend |
| module | ✅ | 功能模块名 |
| title | ✅ | 缺陷标题 |
| tcId | ✅ | 关联的测试案例编号 |
| endpoint | 后端必填 | API 路径 |
| expected | ✅ | 期望结果 |
| actual | ✅ | 实际结果 |
| errorMessage | ✅ | 完整错误信息 |
| sourceLocation | 可选 | 代码定位信息（projects 为 null 时设为 null） |
| reproSteps | ✅ | 复现步骤 |
| evidence | ✅ | 证据文件路径 |
| suggestedFix | 可选 | 修复建议 |
