# claude-plugins

个人 Claude Code 插件市场（marketplace）。

## 包含插件

| 插件 | 说明 |
|------|------|
| `god` | God 模式插件（骨架，功能待填充） |

## 添加市场

本地开发：

```bash
claude plugin marketplace add /Users/puyifan/project/github/claude-plugins
```

发布后用 git url：

```bash
claude plugin marketplace add <your-git-url>
```

## 安装插件

> marketplace 标识名为 `fan-plugins`，不��用仓库名 `claude-plugins` —— 后者以 `claude` 开头，会被官方校验判为冒充官方市场。

```bash
claude plugin install god@fan-plugins
```

## 目录布局

```
claude-plugins/                      # 仓库根 = 市场根
├── .claude-plugin/
│   └── marketplace.json             # 市场声明
└── plugins/                         # 所有插件源码（pluginRoot）
    └── god/
        ├── .claude-plugin/
        │   └── plugin.json          # 插件 manifest
        └── README.md
```

## 本地校验

```bash
claude plugin validate .                  # 校验市场
claude plugin validate ./plugins/god      # 校验 god 插件
```
