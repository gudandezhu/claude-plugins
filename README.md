# Claude Code 插件市场

这是 Claude Code 的本地插件市场，用于管理和存放自定义插件。

## 目录结构

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          # 插件市场配置文件
├── plugins/                      # 插件存放目录
│   ├── plugin-1/
│   │   ├── plugin.json          # 插件清单
│   │   ├── commands/            # 命令目录
│   │   ├── skills/              # 技能目录
│   │   └── ...
│   └── plugin-2/
└── README.md
```

## 添加新插件

1. 在 `plugins/` 目录下创建插件目录
2. 编写插件的 `plugin.json` 和相关文件
3. 在 `.claude-plugin/marketplace.json` 的 `plugins` 数组中注册插件

### marketplace.json 格式

```json
{
  "marketplace": {
    "name": "local-marketplace",
    "displayName": "本地插件市场",
    "description": "Claude Code 本地插件市场",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "displayName": "插件显示名称",
      "description": "插件描述",
      "version": "1.0.0",
      "source": "./plugins/plugin-name",
      "enabled": true
    }
  ]
}
```

## 安装到 Claude Code

参考：`~/.claude/CLAUDE_PLUGIN_INSTALLATION.md`

核心步骤：
1. 将此目录链接到 `~/.claude/local-marketplace`
2. 在 `~/.claude/settings.json` 中启用插件
3. 重启 Claude Code
