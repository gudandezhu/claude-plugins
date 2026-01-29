---
name: agile-start
description: 启动敏捷开发流程
version: 2.0.0
---

# Agile Start

清除暂停标记，恢复自动继续模式。如果项目未初始化，自动执行初始化。

```bash
# 检查项目是否已初始化
if [ ! -f "projects/active/iteration.txt" ]; then
    echo "🚀 首次使用，正在初始化项目..."
    bash scripts/init-project.sh
fi

# 清除暂停标记
if [ -f "projects/active/pause.flag" ]; then
    echo "🔄 清除暂停标记，启用自动继续模式"
    rm -f projects/active/pause.flag
else
    echo "✅ 敏捷开发流程已启动"
fi

echo ""
echo "💡 提示："
echo "  - 添加任务：p0: 实现新功能"
echo "  - 查看进度：/agile-dashboard"
echo "  - 暂停：/agile-stop"
```

完成后，敏捷开发流程将继续自动执行任务跟踪和管理。
