---
name: agile-develop-task
description: TDD 开发技能：5步流程（测试检查→红→绿→重构→覆盖率≥80%），自动运行测试、检查验收标准、记录结果、自动修复或报告问题、更新文档
version: 2.0.0
---

# Agile Develop Task - TDD 开发技能

## 🎯 核心任务

按照严格的 TDD 流程开发任务，确保代码质量和测试覆盖率。

---

## 📋 TDD 流程强制（5 步骤）

### ⚠️ 强制执行规则

**禁止跳过任何步骤！** 任何违规都将终止开发流程。

---

### 步骤 1️⃣：检查测试文件

**任务**: 确认测试文件存在

```bash
# 从参数获取任务 ID
task_id="$1"

# 读取任务卡片
task_file="projects/active/iterations/1/tasks/${task_id}.md"

if [ ! -f "$task_file" ]; then
    echo "❌ 任务卡片不存在: $task_file"
    exit 1
fi

# 从任务卡片提取测试文件路径
test_file=$(grep -A 10 '## 测试要求' "$task_file" | grep '文件:' | sed 's/.*文件: `//;s/`.*//')

if [ ! -f "$test_file" ]; then
    echo "❌ TDD 违规：测试文件不存在"
    echo ""
    echo "TDD 第一步：必须先编写测试文件"
    echo "测试文件位置: $test_file"
    echo ""
    echo "请先创建测试文件，然后再运行此命令。"
    echo ""
    echo "💡 提示：使用 Write 工具创建测试文件，参考模板："
    echo "   .claude-plugin/templates/task-card.md 中的 '## 测试要求' 部分"
    exit 1
fi

echo "✅ 步骤 1 通过：测试文件存在 - $test_file"
```

---

### 步骤 2️⃣：运行测试（红）

**任务**: 确认测试失败（Red Phase）

```bash
# 读取测试命令
test_command=$(jq -r '.testingFrameworks.default.command' projects/active/config.json)

# 如果没有配置，使用默认命令
if [ -z "$test_command" ]; then
    # 检测项目类型
    if [ -f "package.json" ]; then
        test_command="npm run test:unit"
    elif [ -f "requirements.txt" ]; then
        test_command="pytest"
    fi
fi

echo "🔴 步骤 2：运行测试（应该失败）"
echo "命令: $test_command $test_file"

# 运行测试
eval "$test_command $test_file"
test_exit_code=$?

if [ $test_exit_code -eq 0 ]; then
    echo ""
    echo "⚠️ 警告：测试全部通过"
    echo ""
    echo "TDD 第二步要求：测试必须失败（红）"
    echo ""
    echo "可能的原因："
    echo "1. 测试用例不完整（未覆盖所有场景）"
    echo "2. 实现代码已存在（违反 TDD 原则）"
    echo ""
    echo "请检查测试文件，确保："
    echo "- 测试用例覆盖所有验收标准"
    echo "- 实现代码尚未编写（或测试会失败）"
    echo ""
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ 步骤 2 通过：测试失败（红），符合 TDD 流程"
fi
```

---

### 步骤 3️⃣：编写代码（绿）

**任务**: 编写最少代码使测试通过（Green Phase）

```bash
echo "🟢 步骤 3：编写代码使测试通过"
echo ""
echo "现在开始实现功能..."
echo ""
echo "请使用以下工具："
echo "- Read: 读取相关文件"
echo "- Edit: 编辑现有文件"
echo "- Write: 创建新文件"
echo ""
echo "📋 实施指南："
echo "1. 只编写使测试通过的代码（不要过度设计）"
echo "2. 遵循项目的代码风格"
echo "3. 添加必要的注释"
echo "4. 确保代码可读性"
echo ""
echo "等待代码实现..."
```

**AI 实现代码时**，遵循以下原则：

1. **最小实现**: 只写使测试通过的最少代码
2. **YAGNI**: You Aren't Gonna Need It（不做过度设计）
3. **代码风格**: 遵循项目现有代码风格
4. **类型安全**: 使用 TypeScript 类型或 Python 类型提示

**代码实现示例**：

```typescript
// src/utils/validators.ts

/**
 * 验证邮箱格式
 * @param email - 待验证的邮箱地址
 * @returns 验证结果对象
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  // 边界检查
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }

  // 格式验证
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}
```

---

### 步骤 4️⃣：测试通过（绿）

**任务**: 运行测试确认通过

```bash
echo "🟢 步骤 4：运行测试（应该通过）"
echo "命令: $test_command $test_file"

# 运行测试
eval "$test_command $test_file"
test_exit_code=$?

if [ $test_exit_code -ne 0 ]; then
    echo ""
    echo "❌ 步骤 4 失败：测试未通过"
    echo ""
    echo "请检查："
    echo "1. 实现代码是否正确"
    echo "2. 测试用例是否合理"
    echo "3. 是否有边缘情况未覆盖"
    echo ""
    echo "修复问题后重新运行测试。"
    exit 1
fi

echo "✅ 步骤 4 通过：测试全部通过（绿）"
```

---

### 步骤 5️⃣：覆盖率检查

**任务**: 确保测试覆盖率 ≥ 80%

```bash
echo "📊 步骤 5：检查测试覆盖率"

# 读取覆盖率阈值配置
coverage_threshold=$(jq -r '.qualityGates.codeCoverage.threshold // 0.8' projects/active/config.json)

echo "目标覆盖率: $(echo "$coverage_threshold * 100" | bc)%"
echo ""

# 运行覆盖率测试
if [ -f "package.json" ]; then
    coverage_command="npm run test:unit -- --coverage"
elif [ -f "requirements.txt" ]; then
    coverage_command="pytest --cov=$(echo $test_file | sed 's|tests/||;s|/.*||') --cov-report=term-missing"
fi

echo "命令: $coverage_command"
eval "$coverage_command"

# 解析覆盖率结果（示例，需要根据项目调整）
if [ -f "coverage/coverage-summary.json" ]; then
    coverage_percent=$(jq '.total.lines.pct' coverage/coverage-summary.json)
    coverage_int=$(echo "$coverage_percent / 1" | bc)

    if [ $(echo "$coverage_percent < $coverage_threshold * 100" | bc -l) -eq 1 ]; then
        echo ""
        echo "❌ 步骤 5 失败：覆盖率不足"
        echo "当前覆盖率: ${coverage_percent}%"
        echo "目标覆盖率: $(echo "$coverage_threshold * 100" | bc)%"
        echo ""
        echo "请添加更多测试用例以提高覆盖率。"
        exit 1
    fi

    echo "✅ 步骤 5 通过：覆盖率 ${coverage_percent}% ≥ $(echo "$coverage_threshold * 100" | bc)%"
else
    echo "⚠️ 无法自动检查覆盖率，请手动确认 ≥ 80%"
fi
```

---

## 📋 完整开发流程

### 阶段 1：准备

```bash
# 1. 读取任务卡片
task_file="projects/active/iterations/1/tasks/${task_id}.md"
echo "📋 任务信息："
grep -A 5 "^# ${task_id}" "$task_file"

# 2. 检查依赖
dependencies=$(jq -r '.blocked_by[]' "$task_file" 2>/dev/null || echo "")

if [ -n "$dependencies" ]; then
    echo "⚠️ 此任务依赖以下任务："
    echo "$dependencies"
    echo ""
    echo "请确认依赖任务已完成。"
fi
```

---

### 阶段 2：执行 TDD 流程

按照上述 5 步骤严格执行：

```bash
# 步骤 1: 检查测试文件
# 步骤 2: 运行测试（红）
# 步骤 3: 编写代码
# 步骤 4: 运行测试（绿）
# 步骤 5: 覆盖率检查
```

---

### 阶段 3：质量检查

#### Linting 检查

```bash
echo "🔍 运行 Linting 检查"

if [ -f "package.json" ]; then
    if grep -q '"lint"' package.json; then
        npm run lint
        if [ $? -ne 0 ]; then
            echo "❌ Linting 检查失败"
            echo "请修复 Linting 错误后继续。"
            exit 1
        fi
        echo "✅ Linting 检查通过"
    fi
elif [ -f "requirements.txt" ]; then
    if command -v ruff &> /dev/null; then
        ruff check .
        if [ $? -ne 0 ]; then
            echo "❌ Linting 检查失败"
            exit 1
        fi
        echo "✅ Linting 检查通过"
    fi
fi
```

#### 类型检查

```bash
echo "🔍 运行类型检查"

if [ -f "package.json" ]; then
    if grep -q '"typecheck"' package.json; then
        npm run typecheck
        if [ $? -ne 0 ]; then
            echo "❌ 类型检查失败"
            echo "请修复类型错误后继续。"
            exit 1
        fi
        echo "✅ 类型检查通过"
    elif [ -f "tsconfig.json" ]; then
        npx tsc --noEmit
        if [ $? -ne 0 ]; then
            echo "❌ 类型检查失败"
            exit 1
        fi
        echo "✅ 类型检查通过"
    fi
elif [ -f "requirements.txt" ]; then
    if command -v mypy &> /dev/null; then
        mypy .
        if [ $? -ne 0 ]; then
            echo "❌ 类型检查失败"
            exit 1
        fi
        echo "✅ 类型检查通过"
    fi
fi
```

---

### 阶段 4：更新状态

#### 更新任务卡片

```bash
# 更新任务状态为 completed
sed -i 's/^status: ".*"/status: "completed"/' "$task_file"

# 添加完成时间
echo "completed_at: \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" >> "$task_file"

echo "✅ 任务状态已更新为 completed"
```

#### 更新 status.json

```bash
# 读取当前迭代
current_iteration=$(cat projects/active/iteration.txt)
status_file="projects/active/iterations/${current_iteration}/status.json"

# 使用 jq 更新状态
jq \
  --arg task_id "$task_id" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '
    .current_task.status = "completed" |
    .progress.tasks_completed += 1 |
    .updated_at = $timestamp |
    .pending_tasks = [.pending_tasks[] | select(.id != $task_id)]
  ' \
  "$status_file" > "${status_file}.tmp"

mv "${status_file}.tmp" "$status_file"

echo "✅ status.json 已更新"
```

---

### 阶段 5：更新 ai-docs 文档

#### 更新 ACCEPTANCE.md（验收报告）

```bash
echo "📝 更新验收报告..."

# 提取任务信息
task_name=$(grep '^name:' "$task_file" | cut -d: -f2 | xargs)
task_description=$(grep -A 10 '^## 任务描述' "$task_file" | tail -9)

# 获取当前时间
completion_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 更新 ai-docs/ACCEPTANCE.md
acceptance_file="ai-docs/ACCEPTANCE.md"

# 检查文件是否存在
if [ ! -f "$acceptance_file" ]; then
    echo "警告：$acceptance_file 不存在，跳过验收报告更新"
else
    # 在 "已完成任务" 部分添加新条目
    # 使用临时文件
    awk -v task_id="$task_id" \
        -v task_name="$task_name" \
        -v completion_time="$completion_time" \
        '
        /^## 已完成任务/ {
            print
            print ""
            print "### " task_id ": " task_name
            print "**完成时间**: " completion_time
            print "**验收人**: AI"
            print "**验收结果**: ✅ 通过"
            print ""
            print "**验收详情**:"
            print "- 功能验收: ✅"
            print "- 质量验收: ✅ (覆盖率 ≥ 80%)"
            print "- 文档验收: ✅"
            print ""
            print "**备注**:"
            print "TDD 流程完整执行，所有质量检查通过"
            print ""
            next
        }
        { print }
        ' "$acceptance_file" > "${acceptance_file}.tmp"

    mv "${acceptance_file}.tmp" "$acceptance_file"
    echo "✅ 验收报告已更新"
fi
```

#### 更新 PLAN.md（工作计划）

```bash
echo "📝 更新工作计划..."

plan_file="ai-docs/PLAN.md"

if [ -f "$plan_file" ]; then
    # 从进行中移到已完成
    sed -i.bak "s/- ${task_id}: .*$/- ${task_id}: ${task_name} (已完成)/" "$plan_file" 2>/dev/null || true

    # 更新进度统计（简单示例）
    # 实际应用中可能需要更复杂的逻辑

    echo "✅ 工作计划已更新"
fi
```

#### 更新 BUGS.md（如发现问题）

```bash
# 如果在测试中发现 bug，自动记录
if [ $test_exit_code -ne 0 ] || [ $coverage_percent -lt 80 ]; then
    echo "⚠️  发现质量问题，记录到 BUGS.md"

    bugs_file="ai-docs/BUGS.md"

    if [ -f "$bugs_file" ]; then
        bug_id="BUG-$(date +%s)"
        cat >> "$bugs_file" << EOF

### ${bug_id}: ${task_name} 质量问题
**严重程度**: Medium
**发现时间**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**状态**: ⚠️ 待修复

**描述**:
EOF

        if [ $test_exit_code -ne 0 ]; then
            echo "- 测试失败" >> "$bugs_file"
        fi

        if [ $(echo "$coverage_percent < 80" | bc -l) -eq 1 ]; then
            echo "- 测试覆盖率不足 (${coverage_percent}% < 80%)" >> "$bugs_file"
        fi

        echo "" >> "$bugs_file"
        echo "**修复方案**:" >> "$bugs_file"
        echo "需要进一步测试或增加测试用例" >> "$bugs_file"
        echo "" >> "$bugs_file"

        echo "⚠️  已记录到 BUGS.md: ${bug_id}"
    fi
fi
```

---

### 阶段 6：触发 Dashboard 更新

```bash
# 任务完成后，触发 PostToolUse hook 更新 dashboard
echo "📊 正在更新进度看板..."
echo "（PostToolUse hook 将自动触发 /agile-dashboard）"
```

---

### 阶段 7：自动运行 E2E 测试（可选）

```bash
# 检查是否应该运行 E2E 测试
# 例如：每完成 3 个任务或完成关键功能时

# 读取已完成任务数
completed_count=$(jq -r '.progress.tasks_completed' "$status_file")

# 如果已完成任务数是 3 的倍数，建议运行 E2E 测试
if [ $((completed_count % 3)) -eq 0 ]; then
    echo ""
    echo "💡 建议运行 E2E 测试验证集成效果"
    echo "   使用命令: /agile-e2e-test"
    echo ""
fi
```

---

### 阶段 8：自动继续下一个任务（核心自动化功能）

```bash
echo ""
echo "🚀 自动化流程：准备继续下一个任务"
echo ""

# 检查是否有待办任务
pending_count=$(jq -r '.pending_tasks | length' "$status_file")

if [ "$pending_count" -gt 0 ]; then
    # 获取下一个任务（按优先级排序）
    next_task_id=$(jq -r '.pending_tasks[0].id' "$status_file")
    next_task_name=$(jq -r '.pending_tasks[0].name' "$status_file")
    next_priority=$(jq -r '.pending_tasks[0].priority' "$status_file")

    echo "📋 下一个任务:"
    echo "  • ID: $next_task_id"
    echo "  • 名称: $next_task_name"
    echo "  • 优先级: $next_priority"
    echo ""

    # 更新 current_task 为下一个任务
    jq \
        --arg id "$next_task_id" \
        --arg name "$next_task_name" \
        '
            .current_task.id = $id |
            .current_task.name = $name |
            .current_task.status = "in_progress" |
            .updated_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
        ' \
        "$status_file" > "${status_file}.tmp"

    mv "${status_file}.tmp" "$status_file"

    echo "✅ 已切换到下一个任务"
    echo ""
    echo "💡 技能将自动继续执行 /agile-develop-task ${next_task_id}"
    echo ""
else
    echo "✅ 所有待办任务已完成！"
    echo ""
    echo "📊 迭代进度:"
    jq '.progress' "$status_file"
    echo ""
    echo "💡 建议操作:"
    echo "  1. 添加新任务（例如：p0: 实现新功能）"
    echo "  2. 生成迭代回顾（/agile-retrospective）"
    echo "  3. 开始下一迭代"
fi
```

---

## 📤 输出结果

```markdown
✅ 任务完成

**任务 ID**: TASK-102
**任务名称**: 实现邮箱格式验证
**状态**: completed ✅

**TDD 流程检查**:
- ✅ 步骤 1: 测试文件存在
- ✅ 步骤 2: 测试失败（红）
- ✅ 步骤 3: 代码实现
- ✅ 步骤 4: 测试通过（绿）
- ✅ 步骤 5: 覆盖率 ≥ 80% (82%)

**质量检查**:
- ✅ Linting 通过
- ✅ 类型检查通过

**交付文件**:
- src/utils/validators.ts
- tests/unit/validators.test.ts

**下一步**:
继续下一个任务，或运行 /agile-e2e-test 进行端到端测试
```

---

## ⚠️ 错误处理

### 错误 1：任务不存在

```bash
if [ ! -f "$task_file" ]; then
    echo "❌ 任务不存在: $task_id"
    echo "请使用 /agile-tech-design 创建任务"
    exit 1
fi
```

### 错误 2：依赖任务未完成

```bash
dependencies=$(grep -A 5 'blocked_by:' "$task_file" | grep 'TASK-' | sed 's/.*- //' | tr -d ',"')

if [ -n "$dependencies" ]; then
    echo "⚠️ 检查依赖任务..."
    for dep in $dependencies; do
        dep_file="projects/active/iterations/1/tasks/${dep}.md"
        if [ -f "$dep_file" ]; then
            dep_status=$(grep '^status:' "$dep_file" | sed 's/status: "//;s/"//')
            if [ "$dep_status" != "completed" ]; then
                echo "❌ 依赖任务未完成: $dep"
                echo "请先完成依赖任务，然后再执行当前任务。"
                exit 1
            fi
        fi
    done
    echo "✅ 所有依赖任务已完成"
fi
```

### 错误 3：TDD 流程违规

```bash
# 任何步骤失败都终止流程
set -e  # 遇到错误立即退出

trap 'echo "❌ TDD 流程中断，请修复问题后重新运行"; exit 1' ERR
```

---

## 🔍 质量检查清单

完成开发后，验证：

- [ ] ✅ TDD 5 步骤全部通过
- [ ] ✅ 单元测试覆盖率 ≥ 80%
- [ ] ✅ 代码通过 Linting
- [ ] ✅ 代码通过类型检查
- [ ] ✅ 任务状态更新为 completed
- [ ] ✅ status.json 已更新
- [ ] ✅ 代码已提交（如有需要）

---

## 💡 最佳实践

1. **严格 TDD**: 禁止跳过测试步骤
2. **小步快跑**: 每个任务 2-8 小时
3. **持续重构**: 保持代码简洁
4. **及时提交**: 完成后立即提交代码
5. **文档更新**: 更新相关文档

---

## 触发条件

此技能在以下情况下自动触发：

1. **agile-start 技能调用**：启动项目并获取到待执行任务
2. **agile-continue 技能调用**：完成当前任务后继续下一个
3. **用户明确要求**：用户说"开始开发"、"执行任务"、"开发这个功能"
4. **任务引用**：用户提到任务 ID（如 "开发 TASK-001"）
5. **Hook 触发**：post-tool-use-hook 检测到需要继续开发

---

## 📚 相关技能

- `/agile-tech-design` - 任务拆解和设计
- `/agile-e2e-test` - E2E 测试
- `/agile-dashboard` - 进度看板
- `/agile-continue` - 持续运行
