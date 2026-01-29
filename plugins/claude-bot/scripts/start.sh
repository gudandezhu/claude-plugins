#!/bin/bash
# Agile Flow - 启动敏捷开发流程
set -e

# 清除暂停标记
if [ -f "projects/active/pause.flag" ]; then
    echo "🔄 清除暂停标记，启用自动继续模式"
    rm -f projects/active/pause.flag
else
    echo "✅ 无暂停标记需要清除"
fi

echo "💡 敏捷开发流程已启动"
