# agent-browser 测试探测用法速查

本文件是 agent-browser 的精简引用，仅包含测试系统 DOM 探测和失败诊断所需的命令。
完整文档见 `skills/agent-browser/SKILL.md`。

## 核心工作流

```
open → wait → snapshot → interact → re-snapshot
```

```bash
agent-browser open <url>
agent-browser wait --load load
agent-browser snapshot -i          # 获取可交互元素 refs（@e1, @e2...）
agent-browser fill @e1 "text"      # 填写输入框
agent-browser click @e2            # 点击按钮
agent-browser snapshot -i          # 交互后必须重新 snapshot
```

## Ref 生命周期（重要）

Refs（@e1, @e2 等）在页面变化后失效。以下操作后必须重新 snapshot：
- 点击导致页面导航的链接/按钮
- 表单提交
- 弹窗打开/关闭、下拉菜单展开

## 常用命令

```bash
# 导航
agent-browser open <url>
agent-browser close

# 快照（DOM 探测核心）
agent-browser snapshot -i              # 可交互元素列表（推荐）
agent-browser snapshot -s "#selector"  # 限定范围

# 交互
agent-browser click @e1
agent-browser fill @e2 "text"
agent-browser select @e1 "option"
agent-browser press Enter

# 等待
# SPA 应用禁止用 networkidle（持续轮询永远不满足）；用 load 等 HTML 解析完成，再等关键元素出现
agent-browser wait --load load
agent-browser wait @e1
agent-browser wait --text "Welcome"

# 截图（诊断用）
agent-browser screenshot
agent-browser screenshot --full

# 获取信息
agent-browser get url
agent-browser get text @e1
```

## 认证相关

```bash
# 保存登录态（仅限单域登录）
agent-browser state save ./auth/storage-state.json

# 加载登录态
agent-browser state load ./auth/storage-state.json

# 有头模式（单域手动登录时）
agent-browser --headed open <url>
```

⛔ **CAS/SSO 跨域登录禁止使用 `state save`**——只保存���前域 cookie，SSO 域 TGT 丢失。
CAS 场景加载 `auto-login-passport` skill 按其优先级获取登录态。
登录完成后可用 agent-browser 加载保存的 storageState 继续探测：
```bash
agent-browser --state "$WORK_DIR/testing/auth/storage-state.json" open <url>
```

## 测试系统注意事项

- 不要用 agent-browser 执行测试——它没有断言能力，测试执行由 Playwright 负责
- DOM 探测时用 `snapshot -i` 获取选择器，不要用 `eval` 手动查询 DOM
- 有头模式仅在需要用户手动登录时使用（单域场景），CAS/SSO 场景用 Playwright headed 模式
