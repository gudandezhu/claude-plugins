# 敏捷流程并行化改进

## 概述

将完全串行的敏捷开发流程改造为支持并行执行的智能流程，通过任务依赖分析、冲突检测和智能分组，大幅提升开发效率。

---

## 问题分析

### 原始流程（串行）

```
需求池 → 需求A → 设计A → 开发A → 测试A
                  → 需求B → 设计B → 开发B → 测试B
                  → 需求C → 设计C → 开发C → 测试C
```

**问题**：
- 开发 A 时，需求 B/C 必须等待
- 测试 A 时，开发 B/C 必须等待
- Subagent 大部分时间在空闲等待
- 总耗时 = 所有任务时间之和

### 示例计算

```
串行: 10任务 × 30分钟 = 300分钟 (5小时)
并行: 4组 × 30分钟 = 120分钟 (2小时) ← 提升 60%
```

---

## 解决方案

### 核心组件

#### 1. 任务依赖分析器

```python
class TaskDependencyAnalyzer:
    def analyze_dependencies(tasks):
        """分析任务依赖关系"""
        # 1. 读取任务明确声明的依赖
        # 2. 分析隐式依赖（API 调用、模块引用）
        # 3. 构建依赖图

    def get_parallel_groups(graph):
        """拓扑排序 + 分层"""
        # 返回可并行的任务组
```

**检测结果示例**：
```
📊 任务依赖图:
  TASK-001 (无依赖)
  TASK-002 → TASK-001
  TASK-003 (无依赖)
  TASK-004 → TASK-002

🎯 并行执行计划:
  第1组: TASK-001, TASK-003 (可并行)
  第2组: TASK-002 (等待 TASK-001)
  第3组: TASK-004 (等待 TASK-002)
```

#### 2. 文件锁管理器

```python
class FileLockManager:
    def acquire(file_path):
        """获取文件锁"""

    def release(file_path):
        """释放文件锁"""
```

**防止冲突**：
- Subagent A 修改 `src/api/users.py` → 获取锁
- Subagent B 尝试修改同一文件 → 等待或跳过

#### 3. 端口池管理器

```python
class PortPool:
    def allocate(count):
        """分配端口"""

    def release(ports):
        """释放端口"""
```

**动态分配**：
```
Subagent A → 端口 3000
Subagent B → 端口 3001
Subagent C → 端口 3002
```

#### 4. 并行任务执行器

```python
class ParallelTaskExecutor:
    async def execute_parallel_flow(tasks):
        """执行完整的并行流程"""
        # 1. 分析依赖
        # 2. 智能分组
        # 3. 并行执行每组
        # 4. 自动冲突处理
```

---

## 使用方法

### 1. 在 Skill 中集成

```python
from utils.parallel_executor import ParallelTaskExecutor, Task

# 创建执行器
executor = ParallelTaskExecutor(
    project_path=os.environ['PROJECT_PATH'],
    max_parallel=3
)

# 执行并行流程
await executor.execute_parallel_flow(tasks)
```

### 2. 任务声明依赖

```javascript
// tasks.js
{
  "id": "TASK-002",
  "description": "实现用户管理",
  "dependencies": ["TASK-001"],  // 明确声明依赖
  "files": ["src/api/users.py"]
}
```

### 3. 配置并行度

```bash
export MAX_PARALLEL=3  # 推荐 2-4

# 根据团队规模调整
小型团队: MAX_PARALLEL=2
中型团队: MAX_PARALLEL=3-4
大型团队: MAX_PARALLEL=5-6
```

---

## 冲突处理

### 自动处理

| 冲突类型 | 检测方法 | 处理策略 |
|----------|----------|----------|
| 文件冲突 | 文件路径比对 | 自动串行执行 |
| 端口冲突 | 端口占用检测 | 动态端口分配 |
| 任务依赖 | 依赖图分析 | 拓扑排序保证顺序 |
| 循环依赖 | 图算法检测 | 报错 + 人工介入 |

### 人工干预

当自动处理失败时：

```
⚠️  检测到循环依赖：

TASK-002 → TASK-003 → TASK-002

请选择处理方式：
1. 移除 TASK-002 对 TASK-003 的依赖
2. 移除 TASK-003 对 TASK-002 的依赖
3. 合并两个任务
```

---

## 性能提升

### 理论计算

假设每个任务 30 分钟，共 10 个任务：

| 并行度 | 组数 | 总耗时 | 提升 |
|--------|------|--------|------|
| 1 (串行) | 10 | 300分钟 | - |
| 2 | 5 | 150分钟 | 50% |
| 3 | 4 | 120分钟 | 60% |
| 5 | 2 | 60分钟 | 80% |

### 实际考虑

- **并行度越高，冲突概率越大**
- 建议从 2-3 开始，逐步提升
- 监控冲突率，动态调整

---

## 文件结构

```
plugins/agile-flow/
├── utils/
│   └── parallel_executor.py      # 核心并行执行器
├── skills/
│   ├── agile-flow-engine/         # 原版（串行）
│   └── agile-flow-engine-parallel/ # 新版（并行）
└── docs/
    ├── parallel-execution-design.md  # 设计文档
    └── README-PARALLEL.md            # 本文档
```

---

## 测试

运行测试验证功能：

```bash
cd plugins/agile-flow
python3 utils/parallel_executor.py
```

**预期输出**：
```
📊 任务依赖图:
  TASK-001 (无依赖)
  TASK-002 → TASK-001
  TASK-003 (无依赖)

🎯 并行执行计划 (共 2 组):
  第1组: TASK-001, TASK-003 (并行)
  第2组: TASK-002

======================================================================
🚀 并行执行 2 个任务
======================================================================
  🔧 执行任务: TASK-001 - 实现用户认证
     端口: 3000
  🔧 执行任务: TASK-003 - 实现股票数据 API
     端口: 3001
```

---

## 最佳实践

### 1. 任务拆分

**✅ 好的拆分**：
- 独立模块（auth, users, stocks）
- 清晰边界（前端 vs 后端）
- 最小依赖

**❌ 不好的拆分**：
- 大而全的任务
- 循环依赖
- 共享状态

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

## 后续改进

### 短期（1-2 周）
- [ ] 集成到现有 agile-flow-engine
- [ ] 添加详细日志和监控
- [ ] 实现失败重试机制

### 中期（1-2 月）
- [ ] 支持动态并行度调整
- [ ] 添加可视化依赖图
- [ ] 实现智能任务调度

### 长期（3-6 月）
- [ ] 机器学习预测最优并行度
- [ ] 分布式执行（多机器）
- [ ] 实时协作冲突解决

---

## 相关文档

- [并行执行设计文档](./parallel-execution-design.md)
- [并行流程引擎 Skill](../skills/agile-flow-engine-parallel/SKILL.md)
- [原始流程引擎 Skill](../skills/agile-flow-engine/SKILL.md)

---

## 版本历史

- **v1.0.0** (2025-02-04): 初始版本
  - 任务依赖分析
  - 文件锁机制
  - 端口池管理
  - 并行任务执行器
