---
name: agile-stop
description: 停止敏捷开发流程
version: 2.0.0
---

# Agile Stop

创建暂停标记，停止自动继续模式。

```bash
if [ -d "projects/active" ]; then
    echo "{\"paused_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"reason\": \"user_requested\"}" > projects/active/pause.flag
    echo "✅ 已创建暂停标记"
else
    echo "⚠️  项目未初始化"
fi
```

使用 `/agile-start` 可恢复开发流程。
