# Agile Flow 插件分析报告

> 基于 finance-analysis 项目实际使用反馈的分析和优化建议

---

## 一、核心发现

### 1.1 实际使用情况

**finance-analysis 项目的实际开发流程：**
- 使用 `/prompt-enhancer` 优化需求
- 使用 `/feature-dev` 完成功能开发
- 使用 `code-simplifier` 进行架构优化
- 手动维护项目文档（PROJECT_STATUS.md、COMPLETION_REPORT.md 等）

**未使用 agile-flow 插件的原因：**
1. 项目中**根本没有初始化** agile-flow（无 `projects/active/` 目录）
2. 用户更倾向于**直接使用功能插件**，而非通过敏捷插件间接管理
3. 插件设计的**文档模板过于固定**，不符合用户的实际需求

### 1.2 插件设计问题

#### 问题1：Hook 依赖文件系统判断任务完成
```bash
# post-tool-use-hook.sh
task_status=$(grep '^status:' "$task_file" | cut -d: -f2 | xargs)
if [ "$task_status" = "completed" ]; then
    # 触发自动继续
fi
```
**问题**：
- 依赖文件内容判断，不可靠
- AI 可能不会更新 `status:` 字段
- 无法区分任务是真的完成还是临时保存

#### 问题2：文档模板僵化
插件强制创建 7 个固定文档（PRD.md、PLAN.md、OPS.md 等），但：
- 用户可能只需要部分文档
- 文档格式不符合用户习惯
- 维护成本高

#### 问题3：命令混淆
- `/agile-start` vs `/feature-dev`：功能重叠
- 用户不清楚何时用哪个命令
- 缺少明确的决策指南

#### 问题4：自动化流程复杂
需要多个技能协作：
1. `agile-start` - 初始化
2. `agile-develop-task` - 开发
3. `agile-continue` - 自动流转
4. `agile-dashboard` - 查看状态

**用户心智负担重**，违背了"仅需 start/stop"的初衷。

---

## 二、优化方案

### 2.1 简化插件定位

**核心原则**：agile-flow 不替代 feature-dev，而是增强它

```
用户工作流：
1. 需求优化 → /prompt-enhancer
2. 功能开发 → /feature-dev
3. 自动测试 → agile-flow (增强)
4. 文档更新 → agile-flow (自动)
```

### 2.2 重构 Hook 逻辑

#### 当前问题
PostToolUse Hook 依赖任务文件状态判断，容易误判

#### 优化方案
**改用显式标记**，而非推断状态

```bash
# 新方案：创建完成标记
touch /tmp/task_complete_${task_id}

# Hook 检查标记
if [ -f "/tmp/task_complete_${task_id}" ]; then
    # 触发测试和验收
fi
```

#### 或者更简单：移除 PostToolUse Hook
- 让用户显式调用 `/agile-continue`
- 减少隐式触发的不可预测性

### 2.3 灵活的文档系统

#### 当前问题
强制创建 7 个文档，不符合实际需求

#### 优化方案
**按需创建**，配置驱动

```json
// projects/active/config.json
{
  "docs": {
    "enabled": ["PLAN.md", "ACCEPTANCE.md", "BUGS.md"],
    "disabled": ["PRD.md", "OPS.md", "CONTEXT.md", "API.md"]
  }
}
```

#### 更进一步：使用用户已有的文档
检测项目中已有文档：
- `PROJECT_STATUS.md` → 充当 PLAN.md
- `COMPLETION_REPORT.md` → 充当 ACCEPTANCE.md
- `CLAUDE.md` → 充当 CONTEXT.md

### 2.4 简化命令结构

#### 当前问题
命令过多，用户混淆

#### 优化方案
**保留最小命令集**

| 命令 | 用途 | 是否保留 |
|------|------|---------|
| `/agile-start` | 开始/恢复开发 | ✅ 保留 |
| `/agile-stop` | 暂停自动继续 | ✅ 保留 |
| `/agile-continue` | 手动触发下一个任务 | ⚠️ 可选 |
| `/agile-add-task` | 添加任务 | ⚠️ 可选 |
| `/agile-dashboard` | 查看状态 | ⚠️ 可选 |

**移除的技能**：
- `agile-develop-task` → 使用 `/feature-dev` 替代
- `agile-tech-design` → 使用 `/feature-dev` 内置的设计
- `agile-product-analyze` → 使用 `/prompt-enhancer` 替代

### 2.5 与现有工具协同

#### 集成 feature-dev
```markdown
<!-- agile-develop-task.md -->
## 执行流程

1. 调用 `/feature-dev` 进行开发
2. 开发完成后，自动运行测试
3. 更新验收报告
4. 继续下一个任务
```

#### 集成 prompt-enhancer
```markdown
<!-- agile-start.md -->
## 执行流程

1. 如果是新需求，先调用 `/prompt-enhancer` 优化需求
2. 优化后的需求用于任务创建
3. 获取下一个任务
```

---

## 三、具体优化建议

### 3.1 立即优化

#### 1. 简化 PostToolUse Hook
**目标**：减少误判

```bash
# hooks/post-tool-use-hook.sh
# 只检查显式标记，不推断状态
marker_file="$PROJECT_ROOT/projects/active/.task_complete_flag"
if [ -f "$marker_file" ]; then
    # 触发继续流程
fi
```

#### 2. 灵活文档配置
**目标**：按需创建文档

```bash
# scripts/init-project.sh
# 检查 config.json 的 docs.enabled
for doc in "${enabled_docs[@]}"; do
    create_doc_template "$doc"
done
```

#### 3. 集成现有插件
**目标**：增强而非替代

```markdown
<!-- skills/agile-start.md -->
## 需求处理

- 如果是新需求，推荐用户使用 `/prompt-enhancer` 优化
- 使用优化后的需求创建任务

## 开发执行

- 推荐用户使用 `/feature-dev` 进行开发
- agile-flow 只负责任务流转和文档更新
```

### 3.2 中期优化

#### 1. 移除复杂 Hook
**考虑移除 PostToolUse Hook**，原因：
- 任务完成判断不可靠
- 隐式触发让用户困惑
- 维护成本高

**替代方案**：
- 用户显式调用 `/agile-continue`
- 或在 feature-dev 完成后自动提示用户

#### 2. 简化技能结构
保留核心技能：
- `agile-start` - 启动流程
- `agile-continue` - 任务流转
- `agile-stop` - 暂停流程

移冗余技能：
- `agile-develop-task` → 用 feature-dev
- `agile-tech-design` → 用 feature-dev
- `agile-product-analyze` → 用 prompt-enhancer

### 3.3 长期优化

#### 1. 插件协同模式
定义清晰的插件边界：

```
prompt-enhancer: 需求优化
     ↓
agile-flow: 任务管理和流转
     ↓
feature-dev: 具体实现
     ↓
agile-flow: 测试验收 + 文档更新
     ↓
code-simplifier: 架构优化
```

#### 2. 用户配置驱动
```json
// .claude/agile.json
{
  "workflow": {
    "requirement_enhancement": true,
    "development_plugin": "feature-dev",
    "auto_test": true,
    "auto_document": true
  },
  "docs": {
    "custom_docs": ["PROJECT_STATUS.md", "COMPLETION_REPORT.md"],
    "auto_create_missing": false
  }
}
```

---

## 四、优先级排序

### P0（立即修复）
1. 简化 PostToolUse Hook，减少误判
2. 文档系统改为按需创建
3. 更新文档说明与其他插件的协同关系

### P1（重要优化）
1. 考虑移除 PostToolUse Hook
2. 简化技能结构，移除冗余技能
3. 添加与 feature-dev 的集成示例

### P2（长期改进）
1. 实现配置驱动
2. 支持自定义文档模板
3. 添加插件协同模式文档

---

## 五、总结

### 核心问题
agile-flow 插件设计过于理想化，试图包办一切，导致：
1. 用户不知道何时使用
2. 与现有工具功能重叠
3. 自动化流程复杂且不可靠

### 优化方向
1. **明确边界**：agile-flow 专注任务流转，不替代 feature-dev
2. **简化交互**：保留最小命令集，减少用户心智负担
3. **灵活配置**：文档按需创建，支持用户自定义
4. **增强协同**：与现有插件（feature-dev、prompt-enhancer）协同工作

### 最终目标
让 agile-flow 成为一个**轻量级的任务管理增强插件**，而非独立的开发流程系统。
