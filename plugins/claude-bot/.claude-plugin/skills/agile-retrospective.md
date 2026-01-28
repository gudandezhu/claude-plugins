---
name: agile-retrospective
description: 敏捷教练技能：在迭代完成时生成回顾报告，总结完成的任务、测试覆盖率、缺陷统计、遇到的阻塞和改进建议。读取 status.json、summary.md、所有任务卡片、bug 列表，生成 retrospective.md 回顾报告
version: 1.0.0
---

# Agile Retrospective - 敏捷教练技能

## 🎯 核心任务

在迭代完成时生成全面的回顾报告，总结本次迭代的成果、质量指标、遇到的问题和改进建议。

---

## 📋 执行流程

### 第一步：检查迭代状态

```bash
# 读取当前迭代编号
current_iteration=$(cat projects/active/iteration.txt)

# 检查迭代是否完成
status_file="projects/active/iterations/${current_iteration}/status.json"
if [ ! -f "$status_file" ]; then
    echo "❌ 状态文件不存在: $status_file"
    exit 1
fi

# 检查是否所有任务完成
total_tasks=$(jq '.progress.tasks_total' "$status_file")
completed_tasks=$(jq '.progress.tasks_completed' "$status_file")

if [ "$completed_tasks" -lt "$total_tasks" ]; then
    echo "⚠️ 迭代未完成：$completed_tasks/$total_tasks 任务已完成"
    echo ""
    echo "是否仍要生成回顾报告？(y/N)"
    read -r response
    if [[ ! $response =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

echo "📊 开始生成迭代 ${current_iteration} 回顾报告..."
```

---

### 第二步：收集迭代数据

```bash
# 1. 读取状态索引
echo "🔍 读取状态索引..."
status_json=$(cat "$status_file")

# 2. 读取上下文摘要
summary_file="projects/active/iterations/${current_iteration}/summary.md"
if [ -f "$summary_file" ]; then
    summary_md=$(cat "$summary_file")
fi

# 3. 读取所有任务卡片
tasks_dir="projects/active/iterations/${current_iteration}/tasks/"
task_count=0
completed_task_count=0
failed_task_count=0

for task_file in "$tasks_dir"TASK-*.md; do
    if [ -f "$task_file" ]; then
        task_count=$((task_count + 1))

        # 检查任务状态
        task_status=$(grep '^status:' "$task_file" | sed 's/status: "//;s/"//')

        if [ "$task_status" = "completed" ]; then
            completed_task_count=$((completed_task_count + 1))
        elif [ "$task_status" = "failed" ]; then
            failed_task_count=$((failed_task_count + 1))
        fi
    fi
done

# 4. 读取缺陷列表
bugs_dir="projects/active/iterations/${current_iteration}/bugs/"
bug_count=0
critical_bugs=0
high_bugs=0
medium_bugs=0

for bug_file in "$bugs_dir"BUG-*.md; do
    if [ -f "$bug_file" ]; then
        bug_count=$((bug_count + 1))

        # 检查严重程度
        severity=$(grep '^severity:' "$bug_file" | sed 's/severity: //;s/"//g')

        case "$severity" in
            "critical")
                critical_bugs=$((critical_bugs + 1))
                ;;
            "high")
                high_bugs=$((high_bugs + 1))
                ;;
            "medium")
                medium_bugs=$((medium_bugs + 1))
                ;;
        esac
    fi
done

echo "✅ 数据收集完成"
echo "  - 任务: $completed_task_count/$task_count 完成"
echo "  - 缺陷: $bug_count 个"
```

---

### 第三步：分析质量指标

```bash
# 1. 测试覆盖率分析
echo "📊 分析质量指标..."

# 检查是否有覆盖率报告
coverage_report="projects/active/iterations/${current_iteration}/tests/coverage-summary.json"
if [ -f "$coverage_report" ]; then
    coverage_percent=$(jq '.total.lines.pct' "$coverage_report")
else
    coverage_percent="N/A"
fi

# 2. E2E 测试通过率
e2e_report="projects/active/iterations/${current_iteration}/tests/e2e-test-report.md"
if [ -f "$e2e_report" ]; then
    # 从报告中提取通过率
    e2e_pass_rate=$(grep "通过率" "$e2e_report" | head -1 | sed 's/.*：//;s/%.*//')
else
    e2e_pass_rate="N/A"
fi

# 3. 计算任务完成率
task_completion_rate=$(echo "scale=1; $completed_task_count * 100 / $task_count" | bc)

echo "✅ 质量指标分析完成"
echo "  - 单元测试覆盖率: ${coverage_percent}%"
echo "  - E2E 测试通过率: ${e2e_pass_rate}%"
echo "  - 任务完成率: ${task_completion_rate}%"
```

---

### 第四步：生成回顾报告

**文件路径**: `projects/active/iterations/${current_iteration}/retrospective.md`

```markdown
# 迭代 ${current_iteration} 回顾报告

**生成时间**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**迭代周期**: ${start_date} ~ ${end_date}

---

## 📊 执行摘要

### 总体成果
- ✅ 完成任务: **${completed_task_count}/${task_count}** (${task_completion_rate}%)
- ✅ 完成故事: $(jq '.progress.stories_completed' "$status_file") 个
- 🐛 发现缺陷: **${bug_count}** 个
- 📈 测试覆盖率: **${coverage_percent}%**
- 🧪 E2E 测试通过率: **${e2e_pass_rate}%**

### 质量评级
$(get_quality_grade "${task_completion_rate}" "${coverage_percent}" "${e2e_pass_rate}")

---

## ✨ 完成的功能

### 用户故事

$(generate_completed_stories_section "$current_iteration")

### 任务清单

$(generate_tasks_summary "$tasks_dir")

---

## 🐛 缺陷统计

### 缺陷分布

| 严重程度 | 数量 | 百分比 |
|---------|------|--------|
| Critical | ${critical_bugs} | $(echo "scale=1; $critical_bugs * 100 / $bug_count" | bc)% |
| High | ${high_bugs} | $(echo "scale=1; $high_bugs * 100 / $bug_count" | bc)% |
| Medium | ${medium_bugs} | $(echo "scale=1; $medium_bugs * 100 / $bug_count" | bc)% |
| Low | $((bug_count - critical_bugs - high_bugs - medium_bugs)) | $(echo "scale=1; ($bug_count - $critical_bugs - $high_bugs - $medium_bugs) * 100 / $bug_count" | bc)% |
| **总计** | **${bug_count}** | 100% |

### 主要缺陷

$(generate_top_bugs "$bugs_dir")

---

## ⚠️ 遇到的阻塞

### 阻塞因素列表

$(generate_blockers_section "$status_file")

### 阻塞影响分析

- **阻塞时长**: $(calculate_blocker_duration)
- **影响任务数**: $(jq '.blockers | length' "$status_file")
- **主要原因**: $(identify_main_blockers)

---

## 📈 质量指标

### 测试覆盖率趋势

$(generate_coverage_trend "$current_iteration")

### 缺陷趋势

$(generate_bug_trend "$current_iteration")

### 任务完成趋势

$(generate_task_completion_trend "$current_iteration")

---

## 💡 改进建议

### 流程改进

1. **需求分析**
   - $(get_process_improvement_suggestions "product")

2. **技术设计**
   - $(get_process_improvement_suggestions "tech")

3. **开发流程**
   - $(get_process_improvement_suggestions "dev")

4. **测试流程**
   - $(get_process_improvement_suggestions "test")

### 技术改进

1. **代码质量**
   - $(get_technical_improvement_suggestions "code_quality")

2. **架构设计**
   - $(get_technical_improvement_suggestions "architecture")

3. **工具链**
   - $(get_technical_improvement_suggestions "tooling")

---

## 🎓 经验总结

### 做得好的地方

1. $(get_positive_point 1)
2. $(get_positive_point 2)
3. $(get_positive_point 3)

### 需要改进的地方

1. $(get_improvement_point 1)
2. $(get_improvement_point 2)
3. $(get_improvement_point 3)

### 下次迭代尝试

1. $(get_experiment_suggestion 1)
2. $(get_experiment_suggestion 2)

---

## 📊 数据附录

### 任务完成详情

| 任务 ID | 任务名称 | 状态 | 预估工时 | 实际工时 |
|---------|---------|------|---------|---------|
$(generate_task_table "$tasks_dir")

### 缺陷详情

| 缺陷 ID | 描述 | 严重程度 | 状态 | 相关任务 |
|---------|------|---------|------|---------|
$(generate_bug_table "$bugs_dir")

### 技术决策

$(generate_technical_decisions_section "$current_iteration")

---

## 🔄 下一步行动

### 立即行动

1. [ ] $(generate_next_action_item 1)
2. [ ] $(generate_next_action_item 2)
3. [ ] $(generate_next_action_item 3)

### 下一次迭代准备

1. [ ] 根据回顾结果调整迭代计划
2. [ ] 处理遗留缺陷（优先处理 Critical/High）
3. [ ] 优化改进点
4. [ ] 准备下一个迭代的用户故事

---

**报告生成**: agile-retrospective
**迭代状态**: $(get_iteration_status)
**下次迭代**: $((current_iteration + 1))

---

*本报告由 Agile Flow 插件自动生成*
```

---

### 第五步：更新项目摘要

**文件**: `projects/active/knowledge-base/context-summary.md`

追加本次迭代的关键信息：

```markdown
## 迭代 ${current_iteration} 总结

**完成时间**: $(date -u +%Y-%m-%d)

**主要成果**:
- 完成故事: $(jq '.progress.stories_completed' "$status_file") 个
- 完成任务: ${completed_task_count}/${task_count} 个
- 测试覆盖率: ${coverage_percent}%

**关键决策**:
- $(extract_key_decisions)

**经验教训**:
- $(extract_lessons_learned)
```

---

### 第六步：准备下一迭代

```bash
# 检查是否需要创建下一迭代
echo "🔄 准备下一迭代..."

# 读取最大迭代限制
max_iterations=$(jq -r '.continuation.maxIterations // 10' projects/active/config.json)

if [ "$current_iteration" -lt "$max_iterations" ]; then
    # 创建下一迭代目录
    next_iteration=$((current_iteration + 1))
    mkdir -p "projects/active/iterations/${next_iteration}"/{tasks,tests,development,bugs,stories}

    # 复制模板文件
    cp "projects/active/iterations/${current_iteration}/status.json" \
       "projects/active/iterations/${next_iteration}/status.json"

    # 重置状态
    jq \
        --argjson next $next_iteration \
        '.iteration = $next_iteration | .status = "planned" | .progress = {stories_completed: 0, tasks_completed: 0}' \
        "projects/active/iterations/${next_iteration}/status.json" > "${status_file}.tmp"

    mv "${status_file}.tmp" "projects/active/iterations/${next_iteration}/status.json"

    # 更新当前迭代编号
    echo "$next_iteration" > projects/active/iteration.txt

    echo "✅ 已创建迭代 ${next_iteration}"
else
    echo "⚠️ 已达到最大迭代限制 (${max_iterations})"
fi
```

---

## 📤 输出结果

```markdown
✅ 迭代回顾报告已生成

**迭代**: ${current_iteration}
**报告位置**: projects/active/iterations/${current_iteration}/retrospective.md

**关键指标**:
- 任务完成率: ${task_completion_rate}%
- 测试覆盖率: ${coverage_percent}%
- E2E 测试通过率: ${e2e_pass_rate}%
- 发现缺陷: ${bug_count} 个

**下一步**:
- 处理遗留缺陷
- 准备下一迭代
- 查看完整报告: cat projects/active/iterations/${current_iteration}/retrospective.md
```

---

## ⚠️ 错误处理

### 错误 1：迭代未完成

```bash
if [ "$completed_tasks" -lt "$total_tasks" ]; then
    echo "⚠️ 迭代未完成，但仍可生成回顾报告"
    echo "未完成的任务将在下一迭代继续"
fi
```

### 错误 2：数据缺失

```bash
if [ ! -f "$status_file" ]; then
    echo "❌ 状态文件不存在，无法生成回顾报告"
    echo "请先运行: /agile-dashboard"
    exit 1
fi
```

---

## 🔍 辅助函数

### 质量评级函数

```bash
get_quality_grade() {
    local task_rate=$1
    local coverage=$2
    local e2e_rate=$3

    # 移除百分号和 N/A
    task_rate=${task_rate%\%}
    coverage=${coverage%\%}
    e2e_rate=${e2e_rate%\%}

    # 评级逻辑
    if [[ "$task_rate" =~ ^[0-9]+$ ]] && \
       [[ "$coverage" =~ ^[0-9]+$ ]] && \
       [[ "$e2e_rate" =~ ^[0-9]+$ ]]; then

        task_score=$((task_rate >= 80 ? 1 : 0))
        coverage_score=$((coverage >= 80 ? 1 : 0))
        e2e_score=$((e2e_rate >= 90 ? 1 : 0))

        total_score=$((task_score + coverage_score + e2e_score))

        case $total_score in
            3) echo "🌟 **优秀** - 所有指标达标" ;;
            2) echo "✅ **良好** - 大部分指标达标" ;;
            1) echo "⚠️ **需改进** - 部分指标未达标" ;;
            0) echo "❌ **不合格** - 所有指标未达标" ;;
        esac
    else
        echo "📊 **待评估** - 数据不完整"
    fi
}
```

### 任务汇总函数

```bash
generate_tasks_summary() {
    local tasks_dir=$1

    echo "#### 按状态分类"
    echo ""
    echo "**已完成** (${completed_task_count} 个):"
    for task_file in "$tasks_dir"TASK-*.md; do
        if grep -q '^status: "completed"' "$task_file"; then
            task_id=$(basename "$task_file" .md)
            task_name=$(grep "^# ${task_id}:" "$task_file" | sed "s/^# ${task_id}: //")
            echo "- ${task_id}: ${task_name}"
        fi
    done

    echo ""
    echo "**失败** (${failed_task_count} 个):"
    for task_file in "$tasks_dir"TASK-*.md; do
        if grep -q '^status: "failed"' "$task_file"; then
            task_id=$(basename "$task_file" .md)
            task_name=$(grep "^# ${task_id}:" "$task_file" | sed "s/^# ${task_id}: //")
            echo "- ${task_id}: ${task_name}"
        fi
    done
}
```

### Top Bugs 函数

```bash
generate_top_bugs() {
    local bugs_dir=$1

    # 列出 Critical 和 High 级别的缺陷
    for bug_file in "$bugs_dir"BUG-*.md; do
        if [ -f "$bug_file" ]; then
            severity=$(grep '^severity:' "$bug_file" | sed 's/severity: //;s/"//g')

            if [[ "$severity" == "critical" ]] || [[ "$severity" == "high" ]]; then
                bug_id=$(basename "$bug_file" .md)
                bug_title=$(grep "^# ${bug_id}:" "$bug_file" | sed "s/^# ${bug_id}: //")
                bug_desc=$(grep "^### 简短描述" "$bug_file" -A 2 | tail -1)

                echo "#### ${bug_id}: ${bug_title}"
                echo "**严重程度**: ${severity}"
                echo "**描述**: ${bug_desc}"
                echo ""
            fi
        fi
    done
}
```

---

## 🔍 质量检查清单

生成回顾报告后，验证：

- [ ] 报告文件已创建
- [ ] 所有关键指标已统计
- [ ] 缺陷分布已分析
- [ ] 改进建议已提出
- [ ] 下一迭代已准备
- [ ] 项目摘要已更新

---

## 💡 最佳实践

1. **数据驱动**: 基于实际数据生成报告，避免主观臆断
2. **诚实透明**: 准确记录问题和缺陷，不遮掩
3. **可操作性**: 改进建议应具体可行
4. **及时性**: 迭代结束后立即生成
5. **跟踪闭环**: 下一迭代检查改进建议的落实情况

---

## 📚 相关技能

- `/agile-dashboard` - 获取状态数据
- `/agile-tech-design` - 查看技术决策记录
- `/agile-e2e-test` - 获取缺陷报告
- `/agile-start` - 准备下一迭代
