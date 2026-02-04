---
name: agile-flow-engine-parallel
description: 并行化敏捷开发流程引擎，支持多任务并行执行，智能依赖分析和冲突检测
version: 1.0.0
---

# Agile Flow Engine - 并行版本

## 核心改进

### 串行 vs 并行

**串行（原版）**：
```
需求A → 设计A → 开发A → 测试A → 需求B → 设计B → 开发B → 测试B
总耗时 = 8 × 30分钟 = 240分钟
```

**并行（新版）**：
```
[需求A, 需求B, 需求C] → [设计A, 设计B, 设计C]
→ [开发A, 开发B, 开发C] → [测试A, 测试B, 测试C]
总耗时 = 4 × 30分钟 = 120分钟 (提升 50%)
```

---

## 并行策略

### 1. 任务依赖分析

```python
from utils.parallel_executor import TaskDependencyAnalyzer

analyzer = TaskDependencyAnalyzer(project_path)
graph = analyzer.analyze_dependencies(tasks)
# {
#   "TASK-002": ["TASK-001"],  # TASK-002 依赖 TASK-001
#   "TASK-005": ["TASK-002"],  # TASK-005 依赖 TASK-002
#   "TASK-003": [],            # TASK-003 无依赖
# }
```

### 2. 智能分组

```python
groups = analyzer.get_parallel_groups(graph)
# [
#   ["TASK-001", "TASK-003", "TASK-004"],  # 第1组：无依赖，可并行
#   ["TASK-002"],                          # 第2组：依赖 TASK-001
#   ["TASK-005"],                          # 第3组：依赖 TASK-002
# ]
```

### 3. 文件冲突检测

```python
conflicts = executor.check_file_conflicts(group_tasks)
# [("src/api/users.py", "TASK-002", "TASK-005")]
# → 自动串行执行冲突任务
```

---

## 执行流程

### 步骤 1：获取任务

```bash
# 获取所有待处理任务
tasks=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js list pending)
```

### 步骤 2：分析依赖

```python
# 使用 Task tool 调用 subagent
Task(
  subagent_type="general-purpose",
  description="分析任务依赖关系",
  prompt="""
分析以下任务的依赖关系：

${tasks}

返回 JSON：
{
  "graph": {
    "TASK-002": ["TASK-001"],
    "TASK-003": []
  },
  "groups": [
    ["TASK-001", "TASK-003"],
    ["TASK-002"]
  ]
}
"""
)
```

### 步骤 3：并行执行组

```python
for group in groups:
    # 限制并行度为 3
    for batch in chunks(group, 3):
        # 并行启动 subagent
        results = await asyncio.gather(*[
            Task(subagent_type="general-purpose", prompt=f"开发任务: {task}")
            for task in batch
        ])
```

---

## 使用方法

### 启动并行流程

```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export MAX_PARALLEL=3  # 最大并行度

/agile-flow:agile-flow-engine-parallel
```

### 配置并行度

| 并行度 | 适用场景 | 风险 |
|--------|----------|------|
| 1 | 串行模式（原版） | 无 |
| 2-3 | 小型团队，模块独立 | 低 |
| 4-5 | 中型团队，良好模块化 | 中 |
| 6+ | 大型团队，严格隔离 | 高 |

---

## 冲突处理

### 自动处理

1. **文件冲突** → 自动串行执行
2. **端口冲突** → 动态端口分配
3. **任务依赖** → 拓扑排序保证顺序

### 人工干预

当自动处理失败时，暂停并报告：

```
⚠️  无法自动解决冲突：

任务 TASK-002 和 TASK-005 都需要修改：
- src/api/users.py
- src/api/auth.py

请选择：
1. 串行执行（推荐）
2. 合并任务
3. 手动解决
```

---

## 监控与调试

### 实时状态

```
🚀 并行执行中 (组 1/3)

  ✅ TASK-001: 用户认证 (45%)
  🔄 TASK-003: 股票 API (30%)
  ⏳ TASK-004: 报告生成 (等待)

📊 进度: 2/3 完成 | 预计剩余: 15分钟
```

### 详细日志

```
logs/parallel-execution/
  ├── group-1/
  │   ├── task-001-transcript.md
  │   ├── task-003-transcript.md
  │   └── task-004-transcript.md
  ├── group-2/
  └── metrics.json
```

---

## 最佳实践

### 1. 任务拆分

**好的拆分**：
- ✅ 独立模块（auth, users, stocks）
- ✅ 清晰边界（前端 vs 后端）
- ✅ 最小依赖

**不好的拆分**：
- ❌ 大而全的任务
- ❌ 循环依赖
- ❌ 共享状态

### 2. 并行度选择

```
小型项目 (< 5 人): MAX_PARALLEL = 2
中型项目 (5-10 人): MAX_PARALLEL = 3-4
大型项目 (> 10 人): MAX_PARALLEL = 5-6
```

### 3. 冲突预防

- 使用接口隔离
- 合理的模块划分
- 及时合并代码
- 定期依赖检查

---

## 性能对比

### 测试场景：10个任务，每个30分钟

| 模式 | 总耗时 | 提升 |
|------|--------|------|
| 串行 | 300分钟 | - |
| 并行(2) | 150分钟 | 50% |
| 并行(3) | 100分钟 | 67% |
| 并行(5) | 60分钟 | 80% |

### 实际考虑

- 并行度越高，冲突概率越大
- 建议从 2-3 开始，逐步提升
- 监控冲突率，动态调整
