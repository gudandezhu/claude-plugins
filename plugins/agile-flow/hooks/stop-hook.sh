#!/bin/bash
# Stop Hook - 输出到 stderr

set -e

if [ -d "ai-docs" ]; then
  echo "请继续任务,按照agile流程完成迭代,如果迭代已完成,请继续规划新迭代" >&2
  exit 2
fi

# 没有未完成任务，正常退出
exit 0