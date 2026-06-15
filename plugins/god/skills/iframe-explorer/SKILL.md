---
name: iframe-explorer
user-invocable: false
description: |
  快速探测网页中的 iframe 并获取其内部 DOM 内容和结构。
  当用户需要：探测/检查/分析 iframe 内容、获取 iframe 内部 DOM、在 iframe 中查找元素、
  与 iframe 内元素交互、查看 iframe 嵌套页面结构时使用。
  触发词：iframe、嵌套页面、内联框架、子页面内容。
  即使用户没有明确说"iframe"，只要提到"页面里面有个页面"、"嵌入的页面"、"里面的内容看不到"等场景也应触发。
---

# iframe-explorer

快速探测和交互网页 iframe 的技能。基于 agent-browser，通过 accessibility tree 内联 + 直接导航两种策略获取 iframe 内容。

## 前置依赖

- `agent-browser` CLI 已安装（`npm i -g agent-browser`）
- 目标页面可访问（需登录的页面要先登录）

## 工作流程

### 第一步：确定目标 URL

从 args 或用户消息中提取目标 URL。如果用户没有给 URL 但当前浏览器已打开目标页面，跳到第二步。

打开页面：
```bash
agent-browser set viewport 1920 1080
agent-browser open "<URL>"
agent-browser wait --load networkidle
agent-browser wait 2000
```

**为什么 1920x1080**：iframe 内部如果是 VitePress/文档站点，窄视口会触发移动端布局（导航折叠为 hamburger），导致看不到完整导航。大视口确保桌面布局。

**登录处理**：如果 snapshot 显示登录表单，使用以下策略之一：
1. `agent-browser --headed open "<URL>"` — headed 模式，用户手动登录
2. `agent-browser --profile <path> open "<URL>"` — 复用已有 profile
3. `agent-browser --session-name <name> open "<URL>"` — session 持久化

### 第二步：探测所有 iframe

```bash
agent-browser snapshot -i
```

**关键点**：`snapshot -i` 会自动将 iframe 内容内联到 accessibility tree 中。这意味着：
- iframe 内的链接、按钮、导航、标题等都能直接看到
- iframe 内元素的 ref（如 `@e41`）已经携带了 frame 上下文，可以直接交互（click/fill）
- 不需要手动切换 frame

同时获取 iframe 详细属性：

```bash
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(
  Array.from(document.querySelectorAll('iframe')).map((iframe, i) => ({
    index: i,
    id: iframe.id,
    name: iframe.name,
    src: iframe.src,
    title: iframe.title,
    className: iframe.className,
    width: iframe.width || iframe.style?.width,
    height: iframe.height || iframe.style?.height,
    isCrossOrigin: !iframe.contentDocument,
    parentTag: iframe.parentElement?.tagName,
    parentId: iframe.parentElement?.id,
    parentClass: typeof iframe.parentElement?.className === 'string'
      ? iframe.parentElement.className.substring(0, 100) : ''
  })),
  null, 2
)
EVALEOF
```

`isCrossOrigin: !iframe.contentDocument` — 如果为 `true`，说明跨域，需要用第三步的深度探测。

### 第三步：根据需求选择策略

#### 策略 A：快速概览（默认）

snapshot 已经内联了 iframe 的 accessibility tree。如果只需要了解页面结构和可交互元素，第二步的输出已经足够。

**直接与 iframe 内元素交互**（ref 自动携带 frame 上下文）：
```bash
agent-browser click @e41    # @e41 是 iframe 内的导航链接
agent-browser wait 2000
agent-browser snapshot -i   # 重新获取，ref 会变化
```

#### 策略 B：深度探测（需要完整 DOM 结构时）

当需要 iframe 内部的完整 DOM 树、CSS 类名、JS 执行等 snapshot 无法提供的信息时：

**同域 iframe**：
```bash
agent-browser frame @<iframe-ref>
# 现在处于 iframe 上下文，可以 eval、snapshot
agent-browser eval --stdin <<'EVALEOF'
// 这里可以自由访问 iframe 的 DOM
JSON.stringify({ url: window.location.href, title: document.title }, null, 2)
EVALEOF
agent-browser frame main    # 回到主页面
```

**跨域 iframe**（contentDocument 为 null）：

`frame @ref` + `eval` 会**静默失败** — eval 仍在父页面上下文执行。解决方案是直接导航到 iframe 的 src URL：

```bash
# 1. 先记住主页面 URL
agent-browser get url   # 记住这个 URL，后面要回来

# 2. 直接打开 iframe 的 src
agent-browser open "<iframe-src-URL>"
agent-browser wait --load networkidle
agent-browser wait 2000

# 3. 现在可以完全访问 DOM
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify({
  url: window.location.href,
  title: document.title,
  bodyChildTags: Array.from(document.body.children).map(c => ({
    tag: c.tagName, id: c.id,
    class: typeof c.className === 'string' ? c.className.substring(0, 150) : ''
  }))
}, null, 2)
EVALEOF

# 4. 探测完成后返回主页面
agent-browser open "<original-URL>"
```

### 第四步：在 iframe 中搜索内容

**方法 1：snapshot 文本搜索**（最快）
```bash
agent-browser snapshot -i | grep -i "关键词"
```

**方法 2：深度 DOM 搜索**（需要进入 iframe 上下文）
```bash
# 跨域：先直接打开 iframe src
agent-browser open "<iframe-src>"
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(
  Array.from(document.querySelectorAll('*'))
    .filter(el => el.textContent?.includes('搜索关键词') && el.children.length === 0)
    .slice(0, 20)
    .map(el => ({ tag: el.tagName, text: el.textContent.substring(0, 100), id: el.id, class: typeof el.className === 'string' ? el.className.substring(0, 80) : '' }))
)
EVALEOF
```

## 输出格式

向用户汇报时，使用以下结构：

### iframe 概览表

| # | id | title | src | 跨域 | 尺寸 |
|---|---|---|---|---|---|
| 1 | `xxx` | xxx | `https://...` | 是/否 | 100%x100% |

### iframe 内部 DOM 树（缩进层级表示嵌套）

```
body
└── div#app
    └── div.Layout
        ├── header.VPNav -> 导航栏
        ├── div#VPContent -> 主内容区
        └── footer.VPFooter
```

## 常见陷阱

1. **viewport 太小** -> iframe 内部站点变成移动端布局，导航消失。始终先 `set viewport 1920 1080`。
2. **跨域 iframe + frame @ref + eval** -> 看似成功但 eval 实际在父页面执行。用 `get url` 验证当前上下文。
3. **ref 失效** — 页面变化后 ref 会失效。每次导航或 DOM 变化后必须重新 `snapshot -i`。
4. **iframe 延迟加载** — 有些 iframe 内容是异步加载的。snapshot 时可能内容为空。用 `wait --load networkidle && wait 3000` 确保加载完成。
5. **eval 中的 className** — SVG 元素等非 HTML 元素的 `className` 是 `SVGAnimatedString` 而非 string。始终用 `typeof x === 'string' ? x : ''` 做类型检查。

## 交互示例

```
用户：探测这个页面的 iframe http://example.com/page
-> 执行步骤 1-2，输出 iframe 概览表和 DOM 树

用户：点击 iframe 里的"指南"链接
-> snapshot -i 找到链接 ref -> click -> 重新 snapshot 确认结果

用户：在 iframe 里搜索"Vue3"
-> 根据是否跨域选择搜索方法 -> 输出匹配元素列表

用户：看看 iframe 里面那个按钮点了会发生什么
-> snapshot 获取按钮 ref -> click -> wait -> 重新 snapshot -> 描述变化
```
