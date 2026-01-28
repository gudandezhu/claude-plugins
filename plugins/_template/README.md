# 插件模板

这是一个 Claude Code 插件的模板结构，你可以基于此创建自己的插件。

## 目录结构

```
template-plugin/
├── plugin.json          # 插件清单（必填）
├── commands/            # 命令目录
│   └── example.md       # 示例命令
├── skills/              # 技能目录
│   └── example.md       # 示例技能
├── agents/              # 代理目录（可选）
├── hooks/               # 钩子目录（可选）
└── README.md            # 插件说明
```

## 创建新插件

1. 复制此模板目录
2. 重命名为你的插件名称
3. 修改 `plugin.json` 中的插件信息
4. 在 marketplace.json 中注册你的插件
