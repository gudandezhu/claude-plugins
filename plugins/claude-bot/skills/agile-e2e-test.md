---
name: agile-e2e-test
description: 端到端测试技能：运行完整功能测试、记录结果
version: 2.0.0
---

# Agile E2E Test - 端到端测试

## 任务

运行端到端测试，验证整个系统的功能完整性。

---

## 执行流程

### 第一步：准备测试环境

确保所有服务正在运行。

### 第二步：运行 E2E 测试

根据项目类型运行：
- Node.js (Playwright): `npm run test:e2e`
- Node.js (Cypress): `npm run cypress:run`
- Python: `pytest tests/e2e/`

### 第三步：记录测试结果

将结果记录到 `ai-docs/ACCEPTANCE.md`。

---

## 输出结果

```
🧪 E2E 测试完成

测试结果:
- 通过: 45/45
- 失败: 0
- 跳过: 0

✅ 所有功能测试通过
```

---

## 注意事项

1. 确保测试环境已正确配置
2. 测试数据库应该独立于开发数据库
3. 失败的测试应该立即修复
