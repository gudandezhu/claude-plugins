#!/bin/bash
# Stop Hook - 检查是否有未完成的敏捷任务

cd ${CLAUDE_PROJECT_DIR}

if [ -d "ai-docs" ]; then
  echo "请继续任务,按照agile流程完成迭代,如果迭代已完成,请继续规划新迭代" >&2
  exit 2
fi
