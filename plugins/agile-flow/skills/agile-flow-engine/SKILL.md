---
name: agile-flow-engine
description: 极简敏捷开发流程引擎：固定3个slot（开发1+测试1+需求1），完整流程（product→develop→test）
version: 5.0.0
---

# Agile Flow Engine - 极简敏捷开发流程引擎

## 核心设计

**引擎只负责调度，subagent处理单任务后立即退出（清理上下文）**

```
主循环:
  1. 检查3个slot状态
  2. 为空闲slot启动subagent
  3. 等待5秒
  4. 检查完成的subagent → 输出状态
  5. 重复，直到所有slot空闲且无任务
```

---

## 固定3 Slot策略

| Slot | 数量 | 处理任务 | 技能 |
|------|------|----------|------|
| 开发 | 1个 | status='pending' | /agile-flow:agile-develop-task |
| 测试 | 1个 | status='testing' | /agile-flow:agile-e2e-test |
| 需求 | 1个 | PRD.md未处理需求 | /agile-flow:agile-product-analyze |

---

## 环境变量

**必须设置**：
```bash
export AI_DOCS_PATH="$(pwd)/ai-docs"
export CLAUDE_PLUGIN_ROOT="/path/to/claude-plugins/plugins/agile-flow"
```

---

## 实现步骤

### 1. 状态管理

使用3个变量跟踪slot状态：
```javascript
running = {
  "dev": null,           // null 或 task_id
  "test": null,          // null 或 task_id
  "requirement": null    // null 或 task_id
}
```

### 2. 主循环（5步骤）

#### 步骤1：启动空闲slot

**开发slot（如果空闲）**：
```bash
# 获取pending任务
pending=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-by-status pending | head -1)

if [ -n "$pending" ]; then
  # 提取task_id
  task_id=$(echo "$pending" | cut -d'|' -f1)

  # 启动开发subagent
  Task(subagent_type="general-purpose", run_in_background=true,
    prompt="使用 /agile-flow:agile-develop-task 技能
           从 ${AI_DOCS_PATH}/TASKS.json 获取status='pending'的任务
           执行TDD开发: 测试检查→红→绿→重构→覆盖率≥80%→代码审核
           完成后更新状态: node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update TASK-XXX testing
           然后立即结束
           输出限制: 只输出 ✓ TASK-XXX → testing (不超过20字)")

  running["dev"] = task_id
fi
```

**测试slot（如果空闲）**：
```bash
# 获取testing任务
testing=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-by-status testing | head -1)

if [ -n "$testing" ]; then
  # 提取task_id
  task_id=$(echo "$testing" | cut -d'|' -f1)

  # 启动测试subagent
  Task(subagent_type="general-purpose", run_in_background=true,
    prompt="使用 /agile-flow:agile-e2e-test 技能
           从 ${AI_DOCS_PATH}/TASKS.json 获取status='testing'的任务
           使用Playwright执行E2E测试
           测试通过: node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update TASK-XXX tested
           发现bug: node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js update TASK-XXX bug
           然后立即结束
           输出限制: 只输出 ✓ TASK-XXX → tested (不超过20字)")

  running["test"] = task_id
fi
```

**需求slot（如果空闲）**：
```bash
# 检查PRD.md是否有未处理需求
prd_content=$(cat ${AI_DOCS_PATH}/PRD.md)

if echo "$prd_content" | grep -q "\[.*\]"; then
  # 启动需求分析subagent
  Task(subagent_type="general-purpose", run_in_background=true,
    prompt="使用 /agile-flow:agile-product-analyze 技能
           从 ${AI_DOCS_PATH}/PRD.md 读取一个未处理需求
           评估优先级，创建任务: node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js add P0 '描述'
           更新CONTEXT.md
           然后立即结束
           输出限制: 只输出 ✓ 创建 N 个任务 (不超过20字)")

  running["requirement"] = true
fi
```

#### 步骤2：检查完成的subagent

对每个slot检查状态：
```bash
for slot in dev test requirement; do
  if [ "${running[$slot]}" != "null" ]; then
    task_info=$(TaskGet task_id="${running[$slot]}")
    status=$(echo "$task_info" | jq -r '.status')

    if [ "$status" = "completed" ]; then
      echo "[$slot] ✓ 完成"
      running[$slot]=null
    fi
  fi
done
```

#### 步骤3：检查退出条件

```bash
all_free=$([ "${running[dev]}" = "null" ] && [ "${running[test]}" = "null" ] && [ "${running[requirement]}" = "null" ] && echo "yes" || echo "no")

no_pending=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-by-status pending | wc -l)
no_testing=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js get-by-status testing | wc -l)
no_prd=$(grep -c "\[.*\]" ${AI_DOCS_PATH}/PRD.md || echo "0")

if [ "$all_free" = "yes" ] && [ "$no_pending" = "0" ] && [ "$no_testing" = "0" ] && [ "$no_prd" = "0" ]; then
  echo "✅ 所有任务已完成"
  exit
fi
```

#### 步骤4：等待5秒
```bash
sleep 5
```

#### 步骤5：返回步骤1

---

## 输出格式规范

### Subagent输出（严格限制20字）

每个subagent必须严格限制输出：

```
✓ TASK-001 → testing
✓ TASK-002 → tested
✓ 创建 5 个任务
```

或更简洁：
```
✓
```

### 引擎主循环输出

```
[dev] ✓ TASK-001完成
[test] ✓ TASK-002通过
[req] ✓ 3个新任务
```

---

## 任务状态流转

```
pending → inProgress → testing → tested → completed
                    ↓
                   bug
```

---

## 关键文件

- `${AI_DOCS_PATH}/PRD.md` - 产品需求文档
- `${AI_DOCS_PATH}/TASKS.json` - 任务数据
- `${AI_DOCS_PATH}/CONTEXT.md` - 项目上下文
- `${AI_DOCS_PATH}/BUGS.md` - Bug列表
- `${CLAUDE_PLUGIN_ROOT}/scripts/utils/tasks.js` - 任务管理工具

---

## 完整流程示例

```bash
# 初始化状态
running = { dev: null, test: null, requirement: null }

# 循环开始
while true; do
  # 步骤1：启动空闲slot
  if [ "$running[dev]" = "null" ]; then
    pending=$(node get-by-status pending | head -1)
    if [ -n "$pending" ]; then
      Task(prompt="开发任务", run_in_background=true)
      running[dev] = task_id
    fi
  fi

  # 步骤2：检查完成的subagent
  for slot in dev test requirement; do
    if running[$slot] != null; then
      status=$(TaskGet task_id=running[$slot])
      if [ "$status" = "completed" ]; then
        echo "[$slot] ✓ 完成"
        running[$slot] = null
      fi
    fi
  done

  # 步骤3：检查退出条件
  if [ 所有slot空闲 ] && [ 无pending任务 ] && [ 无testing任务 ] && [ PRD无未处理需求 ]; then
    echo "✅ 所有任务已完成"
    exit
  fi

  # 步骤4：等待5秒
  sleep 5

  # 步骤5：继续循环
done
```

---

## 注意事项

1. **环境变量**：确保 `AI_DOCS_PATH` 和 `CLAUDE_PLUGIN_ROOT` 已设置
2. **Subagent输出限制**：严格限制20字以内，避免上下文累积
3. **任务状态管理**：使用 `tasks.js` 工具管理任务状态
4. **固定3个slot**：不要同时运行超过3个subagent
5. **完全自动化**：不要使用 `AskUserQuestion` 工具
