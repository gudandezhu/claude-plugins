#!/bin/bash
# SessionStart Hook - 会话开始时执行
# 功能：检测继续状态并自动恢复任务

set -euo pipefail

# 项目根目录
PROJECT_ROOT="${PROJECT_ROOT:-.}"

continuation_file="$PROJECT_ROOT/projects/active/continuation_state.json"

# 第一步：检测继续状态
if [ ! -f "$continuation_file" ]; then
    # 无继续状态，正常启动
    exit 0
fi

echo ""
echo "🔄 检测到继续状态，准备自动恢复..."
echo ""

# 第二步：读取继续状态
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq 未安装，无法读取继续状态"
    exit 0
fi

iteration=$(jq -r '.iteration' "$continuation_file")
next_task_id=$(jq -r '.next_task.id // empty' "$continuation_file")
next_task_name=$(jq -r '.next_task.name // empty' "$continuation_file")
timestamp=$(jq -r '.timestamp // empty' "$continuation_file")

if [ -z "$next_task_id" ]; then
    echo "⚠️  继续状态无效，清理状态文件"
    rm -f "$continuation_file"
    exit 0
fi

# 第三步：加载上下文
status_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/status.json"
task_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/tasks/${next_task_id}.md"
summary_file="$PROJECT_ROOT/projects/active/iterations/${iteration}/summary.md"

# 读取状态信息
if [ -f "$status_file" ]; then
    tasks_completed=$(jq -r '.progress.tasks_completed // 0' "$status_file")
    tasks_total=$(jq -r '.progress.tasks_total // 0' "$status_file")
else
    tasks_completed=0
    tasks_total=0
fi

# 第四步：生成自动执行提示
cat << EOF

╔════════════════════════════════════════════════════════════╗
║         🔄 Agile Flow - 自动继续模式                      ║
╚════════════════════════════════════════════════════════════╝

检测到上次的会话未完成，将继续执行下一个任务。

📊 当前进度
  迭代: ${iteration}
  完成度: ${tasks_completed}/${tasks_total} 任务完成

📋 下一个任务
  ID: ${next_task_id}
  名称: ${next_task_name}
  状态: pending

🕒 上次保存时间: ${timestamp}

EOF

# 显示任务详情（如果存在）
if [ -f "$task_file" ]; then
    echo "📄 任务详情"
    echo "----------------------------------------"
    # 提取任务描述的前几行
    sed -n '/^## 任务描述/,/^## /p' "$task_file" | head -20
    echo ""
fi

# 显示项目摘要（如果存在）
if [ -f "$summary_file" ]; then
    echo "📖 项目摘要"
    echo "----------------------------------------"
    head -30 "$summary_file"
    echo ""
fi

cat << EOF
▶️  请继续执行此任务:
    /agile-develop-task ${next_task_id}

💡 如需暂停自动继续，请运行: /agile-pause

╔════════════════════════════════════════════════════════════╗
╚════════════════════════════════════════════════════════════╝

EOF

# 第五步：清理继续状态文件
rm -f "$continuation_file"
echo "✅ 继续状态已加载"

exit 0
