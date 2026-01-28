---
name: agile-start
description: 启动敏捷开发项目 - 检查项目结构、初始化配置、加载状态
version: 1.0.0
---

# Agile Start - 启动敏捷开发项目

请执行以下步骤来启动敏捷开发项目：

## 第一步：检查项目结构

```bash
# 检查是否已初始化
if [ -f "projects/active/iteration.txt" ]; then
    echo "✅ 项目已初始化"
    iteration=$(cat projects/active/iteration.txt)
    echo "当前迭代: $iteration"
else
    echo "首次使用，初始化项目..."
fi
```

## 第二步：初始化项目结构（如果首次使用）

```bash
# 创建目录结构
mkdir -p projects/active/{backlog,knowledge-base}
mkdir -p projects/active/iterations/1/{tasks,stories,bugs,tests,development}

# 创建配置文件
cat > projects/active/config.json << 'EOF'
{
  "continuation": {
    "enabled": true,
    "autoStart": true,
    "maxIterations": 10,
    "pauseOnBugs": true,
    "pauseOnBlockers": true,
    "taskTimeout": 14400
  }
}
EOF

# 初始化迭代编号
echo "1" > projects/active/iteration.txt

# 创建项目清单
cat > projects/active/project-manifest.md << 'EOF'
# 项目清单

**项目名称**:
**创建时间**:
**目标**:

## 迭代信息
- 当前迭代: 1
- 状态: 初始化
EOF

echo "✅ 项目结构已创建"
```

## 第三步：加载项目状态

```bash
# 读取当前迭代
iteration=$(cat projects/active/iteration.txt)

# 检查状态文件
status_file="projects/active/iterations/${iteration}/status.json"
if [ -f "$status_file" ]; then
    echo "📊 当前进度:"
    jq '.progress' "$status_file"
else
    echo "初始化状态文件..."
    cat > "$status_file" << 'EOF'
{
  "iteration": 1,
  "current_task": null,
  "pending_tasks": [],
  "progress": {
    "tasks_total": 0,
    "tasks_completed": 0,
    "tasks_in_progress": 0,
    "tasks_pending": 0,
    "completion_percentage": 0
  },
  "bugs": [],
  "blockers": [],
  "last_updated": null
}
EOF
fi
```

## 第四步：输出下一步指引

```bash
echo ""
echo "✅ Agile Flow 项目已启动！"
echo ""
echo "📋 下一步操作："
echo "  1. 创建用户故事: 使用自然语言描述需求"
echo "  2. 或执行产品分析: 告诉我你需要分析产品需求"
echo ""
echo "💡 提示：输入 /agile-dashboard 查看进度看板"
```

## 注意事项

1. **首次使用**：会自动创建完整的项目结构
2. **已存在项目**：会加载当前状态并显示进度
3. **数据持久化**：所有数据保存在 `projects/active/` 目录

## 自动触发场景

- 用户说"开始敏捷开发"
- 用户说"启动项目"
- 用户说"初始化 agile flow"
