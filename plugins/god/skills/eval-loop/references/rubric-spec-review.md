# Spec 评审 Rubric

总分 100 分,**≥ 90 分通过,< 90 分不通过**。每个检查项按三级评分:通过(满分)、部分通过(50%)、不通过(0 分)。

## 目标内容

`spec/sources.md` + `spec/spec.feature`(必交付,缺一由 PreCheck 阶段 FAIL,reviewer 跳过)。

## 维度汇总

| 维度 | 满分 |
|---|---|
| D1 需求完整性 | 30 |
| D2 用户视角正确性 | 25 |
| D3 GWT 可验证性 | 25 |
| D4 双向绑定一致性 | 20 |
| **合计** | **100** |

---

## D1 需求完整性(30)

- [6] happy 路径完整:happy REQ 数量对齐 M2 用户旅程步骤数
- [6] 边界/异常全覆盖:M2 边界/异常清单每条都在 REQ 表里(happy/edge/error)
- [6] 每条 REQ 有归属:`→ SC-xxx` 或 `Out of Scope`,列非空
- [4] MoSCoW 合理:无 `Won't` 偷渡到 `Must`,无"全 Must"
- [4] 未决项已结案:C3 全部结案;**未结案项不为 0 → 本项 0 分 + 总分封顶 89**
- [4] Out of Scope 显式记录:故意不做的需求标 `oos` + `Out of Scope`,不静默丢弃

**失分**:
- REQ 归属为空 → -2/条
- `Must` 标在 Won't 类需求上 → -3/条
- 未结案项不为 0 → -4 + **总分封顶 89**

---

## D2 用户视角正确性(25)

- [8] Feature 描述合规:用"作为/我想/以便"或等价;无 API 路径/库表/框架名
- [7] 无技术栈泄漏:Given/When/Then 不出现编程语言/框架/数据库/中间件/协议/架构/API/类名/函数名
- [5] 无实现选型:不指定"用什么实现",只描述"要什么效果"
- [5] 术语用户可懂:业务术语在"核心用户角色"中可解释,不夹带 jargon

**违禁词**(命中即该 SC 此维度 0 分,记 Critical):
- 技术栈:Java/Python/Go/Rust/JavaScript/TypeScript/Node/Vue/React/Spring/MyBatis/Django/Flask/...
- 中间件:Redis/MySQL/PostgreSQL/MongoDB/Kafka/RabbitMQ/Elasticsearch/...
- 架构:微服务/单体/事件驱动/分层/六边形/CQRS/DDD/...
- 协议:REST/GraphQL/gRPC/WebSocket/HTTP/HTTPS/JSON/XML/...
- 实现细节:类/方法/函数/接口/抽象/继承/多态/闭包/线程/协程/锁/...

**失分**:
- Feature 描述出现 API 路径(例:`POST /api/v1/users`)→ -3
- "调用 XXX 方法"类表述 → -2/处

---

## D3 GWT 可验证性(25)

- [10] Then 可观察可断言:不含"正常/美观/友好/良好/合理"等不可测形容词
- [6] 一个 Scenario 一个断言点:不出现"并且还..."式大杂烩
- [5] Given 状态可达:能从测试 setup 构造
- [4] When 动作明确:用户可执行的具体动作,不出现"系统处理业务"等无主语

**不可测反模式**(命中 -2/处,3 处以上本维度 0):
- 形容词:正常/美观/友好/良好/合理/合适/正确/无误
- 模糊量词:适当/一定/某些/可能/也许
- 内部状态:系统处理完毕/内部状态正确/数据已落库(无外部可观察的副作用)
- 复合断言:Then X 并且 Y 并且 Z(超过 3 个独立断言)

**封顶**:整个 Feature 半数以上 SC 不可测 → 本维度封顶 50% 分

---

## D4 双向绑定一致性(20)

- [6] SC-ID 唯一且格式:`SC-xxx` 3 位数字,无重复
- [5] 双向 1:1 绑定:每个 SC-ID 在 sources.md 有对应 REQ(允许 1 REQ → N SC,反向 N → 1 必查)
- [4] @spec-version 语义化:符合 `X.Y.Z`;变更幅度与版本号匹配
- [5] 元信息齐全:Feature 元信息含 目标价值/成功指标/核心用户角色;C1-C4 Check 结论已记录

**失分**:
- SC-ID 重复 → -2/个
- 孤儿 SC(spec 有 / sources 无 REQ)→ -2/个
- 孤儿 REQ(sources 有归属 / spec 无 SC)→ -2/个
- 版本号与场景数变更幅度不匹配 → -2

---

## 评审校准

- 不读 sources.md 和 spec.feature → 自动不通过
- 每个扣分项附证据:sources 行号 / spec 行号 / SC-ID / 文本片段(4 选 1)
- 评级:Critical(必修)> Important(应修)> Minor(建议)
- **未结案项不为 0 → D1 -4 + 总分封顶 89**
- D2 违禁词 → 该 SC 此维度 0 + Critical
- D3 半数 SC 不可测 → D3 封顶 50% 分

## 输出格式(spec 特有补充)

通用模板见 `prompts/reviewer.md`。本 rubric 补充 spec 评审特有字段:

```
## Spec 评审报告

**得分:** XX/100(阈值:90)
**档位:** {简单档|复杂档}    ← 来自 SKILL 传入
**状态:** ✅ 通过 / ❌ 不通过

### 评分明细
(同通用模板)

### 扣分详情
(同通用模板;每条证据 4 选 1:sources 行号 / spec 行号 / SC-ID / 文本片段)

### 修复路径建议(主 agent 决策参考)

| 扣分维度 | 建议回退阶段 |
|---------|------------|
| D1 | brainstorm M2/M3 |
| D2 | build-spec |
| D3 | build-spec |
| D4 | build-spec |
| 未结案项 | 主 agent AskUserQuestion,不可静默 |

### 评审结论
{一句话总结,例:"未结案项 1 条 + D2 出现 Redis,总分 78,不通过;建议回 build-spec 重写。"}
```
