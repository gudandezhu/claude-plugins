# 操作指南 (OPS)

## 快速启动

### 1. 启动敏捷开发流程
/agile-start

### 2. 停止流程
/agile-stop

### 3. 查看进度
访问 http://localhost:3737

## 开发工作流

### 任务流程
需求 → 任务规划 → TDD开发 → E2E验证 → 完成

### TDD 开发流程

1. 编写测试用例
2. 运行测试（预期失败）
3. 编写最少代码使测试通过
4. 运行覆盖率测试（目标 ≥ 80%）
5. 重构代码

### 代码提交
git add .
git commit -m "feat: 描述变更"

## 测试

### 单元测试
npm run test:unit
# 或
pytest

### 覆盖率测试
npm run test:unit -- --coverage
# 或
pytest --cov

## 常见问题

### Q: 如何添加新需求？
A: 编辑 ai-docs/docs/PRD.md，然后运行 /agile-start

### Q: 如何查看任务？
A: 访问 Web Dashboard: http://localhost:3737

### Q: 如何更新任务状态？
A: node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update <task_id> <status>
