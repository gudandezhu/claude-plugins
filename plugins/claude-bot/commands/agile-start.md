---
name: agile-start
description: 启动敏捷开发流程
version: 2.0.0
---

# Agile Start

清除暂停标记，恢复自动继续模式。

```bash
if [ -f "projects/active/pause.flag" ]; then
    echo "🔄 清除暂停标记，启用自动继续模式"
    rm -f projects/active/pause.flag
else
    echo "✅ 无暂停标记需要清除"
fi
```

完成后，敏捷开发流程将继续自动执行任务跟踪和管理。
