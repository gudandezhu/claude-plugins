#!/bin/bash
# Agile Flow - 停止敏捷开发流程
set -e

# 创建暂停标记
if [ -d "projects/active" ]; then
    cat > projects/active/pause.flag << EOF
{
  "paused_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "user_requested"
}
EOF
    echo "✅ 已创建暂停标记"
else
    echo "⚠️  项目未初始化"
fi
