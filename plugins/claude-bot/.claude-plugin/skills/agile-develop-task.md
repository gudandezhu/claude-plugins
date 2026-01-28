---
name: agile-develop-task
description: 开发工程师技能：TDD 驱动开发。读取任务卡片（task-{id}.md），严格执行 5 步 TDD 流程（检查测试文件→测试失败（红）→编写代码→测试通过（绿）→覆盖率≥80%），运行测试并修复，提交代码并更新任务状态，更新 status.json
version: 1.0.0
---

# Agile Develop Task - 开发工程师技能（TDD 驱动）

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

### 阶段 5：触发 Dashboard 更新

```bash
# 任务完成后，触发 PostToolUse hook 更新 dashboard
echo "📊 正在更新进度看板..."
echo "（PostToolUse hook 将自动触发 /agile-dashboard）"
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

## 📚 相关技能

- `/agile-tech-design` - 任务拆解和设计
- `/agile-e2e-test` - E2E 测试
- `/agile-dashboard` - 进度看板
- `/agile-continue` - 持续运行
