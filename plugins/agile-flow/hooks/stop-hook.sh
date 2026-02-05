#!/bin/bash
# Stop Hook - 检查是否有未完成的敏捷任务

echo "执行stop hook"

cd ${CLAUDE_PROJECT_DIR}

if [ -d "ai-docs" ]; then
  echo "请继续任务" >&2
  exit 2
fi

exit 0