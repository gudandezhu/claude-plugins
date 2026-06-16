# RFC-0008: test-gen（roadmap G6，P1）

> **状态**：草稿（v0.4.0+）
> **作者**：god 架构组
> **关联 ADR**：合并后改名为 ADR-NNNN
> **关联 3 视角**：[`02-dev-perspective.md §3`](../perspectives/02-dev-perspective.md) / [`03-architect-perspective.md §2`](../perspectives/03-architect-perspective.md)
> **关联 roadmap**：[`docs/roadmap.md §3.1 G6`](../roadmap.md)
> **关联 plan**：[`docs/plan.md §4 Week 3 C`](../plan.md)
> **依赖**：[`RFC-0007 dev-gen`](../rfcs/0007-dev-gen.md) 先落地

---

## 1. 背景

G5 dev-gen 出代码骨架后，**测试**还从零写。test 阶段 AI 仍要：
- 读 spec 想测试结构
- 命名 `test('SC-001: ...', ...)`（spec-validate #8 要求）
- 写 setup/teardown
- 重复劳动 + 漏测风险

G6 test-gen 出**测试桩**，AI 在桩上改——和 G5 一样消解重复 + 防漏。

## 2. 目标

| # | 目标 | 验证 |
|---|---|---|
| 1 | 读 spec.feature 自动产出测试桩 | 每个 SC 一个 test/it |
| 2 | 用例名严格 `SC-xxx: <name>` 格式 | spec-validate.js #8 通过 |
| 3 | @sad-path SC 用 `it.todo`（待补） | 强提示：sad-path 必须有真测试 |
| 4 | 测试框架推断 | vitest (`vitest.config.*`) / jest (`jest.config.*`) / 默认 vitest |
| 5 | 不写断言 | `expect(...)` 占位 + TODO 注释 |
| 6 | dry-run / force 模式 | 跟 dev-gen 一致 |

## 3. 详细设计

### 3.1 产出物结构

```
tests/
└── <feature-slug>.spec.<ts|js>
```

每 SC 一个 test/it：

```js
import { describe, it, expect } from 'vitest';
import * as feat from '../src/<feature-slug>.js';

describe('<Feature 名>', () => {
  // SC-001: 健康 lead 显示高分
  it('SC-001: 健康 lead 显示高分', () => {
    // TODO: implement test
    // Given: lead 7 天内被联系
    // When: 计算健康分
    // Then: 分数 >= 80
    expect(feat.sc1(/* TODO */)).toBeDefined();
  });

  // SC-002: 30 天未联系 lead 降权（@sad-path）
  it.todo('SC-002: 30 天未联系 lead 降权');
});
```

### 3.2 CLI 签名

```bash
# 生成测试桩
$ node spec/scripts/test-gen.js <项目目录>
# 读 spec/spec.feature → 写 tests/<feature>.spec.<ext>

# 预览
$ node spec/scripts/test-gen.js <项目目录> --dry-run

# 强制覆盖
$ node spec/scripts/test-gen.js <项目目录> --force

# 强制 vitest / jest
$ node spec/scripts/test-gen.js <项目目录> --framework vitest
```

### 3.3 关键约束

| 约束 | 决定 |
|---|---|
| 输入 | `spec/spec.feature`（@SC-xxx + tag 列表）|
| 输出语言 | 跟 dev-gen 一致（TS / JS）|
| 测试框架 | 默认 vitest；有 `jest.config.*` → jest；可 `--framework` 强制 |
| 文件位置 | `tests/<feature-slug>.spec.<ext>`（约定）|
| 用例名 | `SC-XXX: <name>` 严格格式（spec-validate #8 要求）|
| @sad-path | `it.todo(...)` 不写实现（强提示 AI 必填）|
| 普通 SC | `it('SC-XXX: ...', () => { expect(...) })` 桩 |
| 失败回滚 | 写失败 → 自动恢复原文件 |

### 3.4 落点

- `spec/scripts/test-gen.js`（~250 行）
- `spec/scripts/test-gen.test.js`（~150 行）
- `spec/TESTING.md L1-G` 段

## 4. 验收

- [ ] `node spec/scripts/test-gen.js demo/lead-scoring` 产 tests/lead-scoring.spec.js
- [ ] 用例名格式 `SC-XXX: <name>`（spec-validate #8 通过）
- [ ] @sad-path 用 `it.todo`
- [ ] vitest 项目 import 路径正确
- [ ] jest 项目 `require` + `describe/it/expect` 正确
- [ ] `--dry-run` 不写文件
- [ ] `--force` 覆盖
- [ ] `--framework` 强制
- [ ] 14+ 单元测试全过

## 5. 反模式（明确不做）

- ❌ test-gen 写真实断言 —— 留 TODO 给 AI
- ❌ test-gen 推断 SC 函数参数 —— 留 `/* TODO */` 占位
- ❌ 自动跑 test-gen —— 必须显式
- ❌ 跨 feature 共用 test 文件

## 6. 开放问题

- [ ] 集成测试（playwright）何时支持？需 spec.feature 标 `@integration` tag（v0.4.0+ 待开）
- [ ] sad-path 用 `it.todo` 还是用 `it.skip`？当前 `it.todo`（vitest 原生支持）

## 7. 时间线

- **Week 3**（2026-08-04 ~ 08-10）：RFC 评审 + test-gen.js 实现 + 测试
- **Week 3 末**：RFC 转 ADR + demo 跑通 + 接入 test.md
