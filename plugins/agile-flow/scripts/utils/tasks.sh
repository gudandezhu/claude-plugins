#!/usr/bin/env bash
# TASKS.json 操作工具
# 用法: tasks.sh <command> [args]
#
# Commands:
#   list                    - 列出所有任务
#   add <priority> <desc>   - 添加新任务 (priority: P0/P1/P2/P3)
#   update <id> <status>    - 更新任务状态
#   get-next               - 获取下一个要处理的任务
#   get-by-status <status> - 获取指定状态的任务

set -e

# 智能检测 ai-docs 目录
find_ai_docs_path() {
    # 1. 优先使用环境变量
    if [ -n "$AI_DOCS_PATH" ]; then
        echo "$AI_DOCS_PATH"
        return
    fi

    # 2. 尝试从 git 根目录查找
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
        local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        if [ -n "$git_root" ] && [ -d "$git_root/ai-docs" ]; then
            echo "$git_root/ai-docs"
            return
        fi
    fi

    # 3. 向上查找 ai-docs 目录
    local current_dir=$(pwd)
    while [ "$current_dir" != "/" ]; do
        if [ -d "$current_dir/ai-docs" ]; then
            echo "$current_dir/ai-docs"
            return
        fi
        current_dir=$(dirname "$current_dir")
    done

    # 4. 使用 git 根目录（即使 ai-docs 不存在）
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
        local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        if [ -n "$git_root" ]; then
            echo "$git_root/ai-docs"
            return
        fi
    fi

    # 5. 最后使用当前目录
    echo "$(pwd)/ai-docs"
}

AI_DOCS_PATH=$(find_ai_docs_path)
TASKS_FILE="$AI_DOCS_PATH/TASKS.json"

# 确保 TASKS.json 存在
init_tasks() {
    if [ ! -f "$TASKS_FILE" ]; then
        mkdir -p "$(dirname "$TASKS_FILE")"
        cat > "$TASKS_FILE" << 'EOF'
{
  "iteration": 1,
  "tasks": []
}
EOF
    fi
}

# 列出所有任务
list_tasks() {
    init_tasks
    cat "$TASKS_FILE"
}

# 添加新任务
add_task() {
    local priority="$1"
    local description="$2"

    if [ -z "$priority" ] || [ -z "$description" ]; then
        echo "Usage: tasks.sh add <P0|P1|P2|P3> <description>" >&2
        exit 1
    fi

    init_tasks

    # 生成新的任务 ID
    local max_id=$(jq -r '.tasks[].id // empty' "$TASKS_FILE" | sed 's/TASK-//' | sort -n | tail -1)
    local new_num=$((max_id + 1))
    local new_id="TASK-$(printf '%03d' "$new_num")"

    # 添加任务
    jq --arg id "$new_id" \
       --arg priority "$priority" \
       --arg desc "$description" \
       '.tasks += [{
         "id": $id,
         "priority": $priority,
         "status": "pending",
         "description": $desc
       }]' "$TASKS_FILE" > "${TASKS_FILE}.tmp" && mv "${TASKS_FILE}.tmp" "$TASKS_FILE"

    echo "$new_id"
}

# 更新任务状态
update_task() {
    local task_id="$1"
    local new_status="$2"

    if [ -z "$task_id" ] || [ -z "$new_status" ]; then
        echo "Usage: tasks.sh update <task_id> <status>" >&2
        exit 1
    fi

    init_tasks

    jq --arg id "$task_id" \
       --arg status "$new_status" \
       '.tasks |= map(if .id == $id then .status = $status else . end)' \
       "$TASKS_FILE" > "${TASKS_FILE}.tmp" && mv "${TASKS_FILE}.tmp" "$TASKS_FILE"

    echo "Updated $task_id to $new_status"
}

# 获取下一个要处理的任务
get_next_task() {
    init_tasks

    jq -r '
        .tasks
        | map(select(.status == "bug"))
        + map(select(.status == "inProgress"))
        + map(select(.status == "testing"))
        + map(select(.status == "tested"))
        + (map(select(.status == "pending")) | sort_by(.priority))
        | .[0]
        | // empty
        | "\(.id)|\(.priority)|\(.description)"
    ' "$TASKS_FILE"
}

# 按状态获取任务
get_by_status() {
    local status="$1"

    if [ -z "$status" ]; then
        echo "Usage: tasks.sh get-by-status <status>" >&2
        exit 1
    fi

    init_tasks

    jq -r --arg status "$status" \
        '.tasks[] | select(.status == $status) | "\(.id)|\(.priority)|\(.description)"' \
        "$TASKS_FILE"
}

# 主函数
case "${1:-list}" in
    list)
        list_tasks
        ;;
    add)
        add_task "$2" "$3"
        ;;
    update)
        update_task "$2" "$3"
        ;;
    get-next)
        get_next_task
        ;;
    get-by-status)
        get_by_status "$2"
        ;;
    *)
        echo "Unknown command: $1" >&2
        echo "Usage: tasks.sh <list|add|update|get-next|get-by-status> [args]" >&2
        exit 1
        ;;
esac
