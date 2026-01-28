#!/bin/bash
# Stop Hook - 会话结束时执行
# 功能：检查是否应该保存继续状态，实现跨会话自动执行

set -euo pipefail

# 项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-.}"

# 第一步：检查暂停标记
# 如果用户主动暂停，不保存继续状态
if [ -f "$PROJECT_ROOT/projects/active/pause.flag" ]; then
    echo "ℹ️  检测到暂停标记，不保存继续状态"
    exit 0
fi

# 第二步：检查项目是否初始化
if [ ! -f "$PROJECT_ROOT/projects/active/iteration.txt" ]; then
    exit 0
fi

iteration=$(cat "$PROJECT_ROOT/projects/active/iteration.txt")
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json"

if [ ! -f "$status_file" ]; then
    exit 0
fi

# 第三步：判断是否应该继续
# 使用 jq 检查状态
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq 未安装，无法读取状态文件"
    exit 0
fi

# 提取状态信息
pending_count=$(jq '.pending_tasks | length' "$status_file" 2>/dev/null || echo "0")
critical_bugs=$(jq '[.bugs[]? | select(.severity == "critical" or .severity == "high")] | length' "$status_file" 2>/dev/null || echo "0")
blockers_count=$(jq '.blockers | length' "$status_file" 2>/dev/null || echo "0")

# 判断条件：全部满足才保存继续状态
should_continue=true

# 检查 1：有待办任务
if [ "$pending_count" -eq 0 ]; then
    echo "✅ 所有任务已完成，不保存继续状态"
    should_continue=false
fi

# 检查 2：无严重缺陷
if [ "$critical_bugs" -gt 0 ]; then
    echo "⚠️  发现严重缺陷 ($critical_bugs 个)，需要人工介入"
    should_continue=false
fi

# 检查 3：无阻塞因素
if [ "$blockers_count" -gt 0 ]; then
    echo "⚠️  存在阻塞因素 ($blockers_count 个)，需要人工介入"
    should_continue=false
fi

if [ "$should_continue" = false ]; then
    exit 0
fi

# 第四步：保存继续状态
next_task=$(jq '.pending_tasks[0]' "$status_file")
current_task=$(jq -r '.current_task // {}' "$status_file")

# 创建 continuation_state.json
continuation_file="$PROJECT_ROOT/projects/active/continuation_state.json"
cat > "$continuation_file" << EOF
{
  "mode": "continue",
  "iteration": $iteration,
  "current_task": $current_task,
  "next_task": $next_task,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "auto_continue"
}
EOF

echo "✅ 已保存继续状态"
echo "📋 下次启动将自动执行任务: $(echo "$next_task" | jq -r '.id // "N/A"') - $(echo "$next_task" | jq -r '.name // "N/A"')"
echo "💡 如需暂停，请运行: /agile-pause"

exit 0
