# RFC-0007: dev-gen（roadmap G5，P1）

> **状态**：草稿（v0.4.0+）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 ADR-NNNN
> **关联 3 视角**：[`02-dev-perspective.md §3`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §2`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.1 G5`](../roadmap.md)
> **关联 plan**：[`docs/plan.md §4 Week 2 B`](../plan.md)

---

## 1. 背景

god 当前 dev 阶段（[commands/dev.md](../../commands/dev.md) v0.4.0 起接入工具链）AI 仍从零开始写代码。问题：
- 每个 SC AI 都要"读 spec → 想函数签名 → 写 @spec 标注"重复劳动
- 改 SC 时 AI 容易漏改或重复标注
- 实现质量参差（新人 AI agent 不知从哪下手）

**核心价值**：dev-gen 出**确定性骨架**，AI 在骨架上**改而非从零写**——重复劳动消解、漏改/重复错防住。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 读 spec.feature 自动产出代码骨架 | 每个 SC 一个 export function |
| 2 | 每个函数带 JSDoc `@spec SC-xxx` 标注 | spec-validate.js #7 通过 |
| 3 | 函数体为空 + `// TODO: 实现 SC-xxx` | 跑通但实际无业务逻辑 |
| 4 | 产出物通过 spec-validate.js 全 14 项 | 不破现有校验 |
| 5 | dry-run 模式可预览不写 | `--dry-run` 不写文件 |
| 6 | 输出语言可推断 | 从 `package.json` 判 TS / JS |

## 3. 详细设计

### 3.1 产出物结构

```
src/
└── <feature-slug>.js    # 或 .ts（按 package.json）
```

每 SC 一个 export function：

```js
/**
 * <SC 名（去掉 Scenario: 前缀）>
 * @spec SC-001
 * @scenario 健康 lead 显示高分
 */
export function sc001(lastContactDays) {
  // TODO: 实现 SC-001 健康 lead 显示高分
  // Given: lead 7 天内被联系
  // When: 计算健康分
  // Then: 分数 >= 80
}
```

### 3.2 CLI 签名

```bash
# 生成骨架
$ node spec/scripts/dev-gen.js <项目目录>
# 读 spec/spec.feature → 写 src/<feature>.js
# 覆盖前询问（如已存在）

# 仅预览
$ node spec/scripts/dev-gen.js <项目目录> --dry-run
# stdout 输出将要写的内容，不实际写

# 强制覆盖
$ node spec/scripts/dev-gen.js <项目目录> --force
```

### 3.3 关键约束

| 约束 | 决定 |
|---|---|
| 输入 | `spec/spec.feature`（@SC-xxx 列表）+ `spec/sources.md`（可选，feature 名取自 sources.md 的 Goal 段）|
| 输出语言 | 优先 TS（`tsconfig.json` 存在则用 .ts），否则 JS |
| 文件名 | `<feature-slug>.js/.ts`（feature-slug = sources.md 第一行 H1 slugify 或 meta.json specId）|
| 函数名 | `scXXX`（XXX = SC 号零填充） |
| JSDoc | 含 `@spec SC-xxx` + `@scenario <名>` + 函数体注释 Given/When/Then |
| 覆盖策略 | 默认询问（`--force` 跳过）|
| 失败回滚 | 写失败 → 删除部分文件（不留半成品）|

### 3.4 落点

- `spec/scripts/dev-gen.js`（~250 行）
- `spec/scripts/dev-gen.test.js`（~150 行）
- `spec/TESTING.md L1-F` 段

## 4. 验收

- [ ] `node spec/scripts/dev-gen.js demo/lead-scoring` 产出 src/lead-scoring.js
- [ ] 每个 SC 一个 export function（含 JSDoc + TODO）
- [ ] spec-validate.js #7 在 dev-gen 产出后通过
- [ ] `--dry-run` 不写文件但输出预览
- [ ] `--force` 覆盖不询问
- [ ] TS 项目产出 .ts；JS 项目产出 .js
- [ ] 13+ 单元测试全过

## 5. 反模式（明确不做）

- ❌ dev-gen 写实现（**只写骨架**）—— 与 AI 写实现冲突
- ❌ dev-gen 读 sources.md 改 GWT（**只生成 TODO 占位**）—— AI 自己想实现细节
- ❌ 跨 feature 共用文件（每 feature 独立文件）—— 模块化优先
- ❌ 自动跑 dev-gen（必须显式调用）—— 避免破坏用户已有代码

## 6. 开放问题

- [ ] SC 的函数参数怎么推断？当前简化 = 无参数
- [ ] 多文件拆分（每 SC 一个文件 vs 单文件多函数）？当前单文件
- [ ] 是否集成到 `commands/dev.md` 阶段 1 自动跑？当前手动

## 7. 时间线

- **Week 2**（2026-07-28 ~ 08-03）：RFC 评审 + dev-gen.js 实现 + 测试
- **Week 2 末**：RFC 转 ADR + demo 跑通 + 接入 dev.md
