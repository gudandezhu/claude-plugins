<!--
  incident.md 模板 v0.1.0
  适用: god v0.5.0+ G11 落地 (plan §4.1 C)
  触发: god-trends 检测 L3 档 / spec-review 不通过 / 状态机 ROLLBACK / spec 显著变更
  位置: docs/incidents/NNNN-<slug>.md (4 位补零编号)
  关联: 经 god-trends → ADR 转化机制,合入 docs/adrs/
  不可手改核心段(事实/根因/影响) —— 修改请追加 "附录: 修订记录"
-->

# Incident {NNNN}: {title}

> 触发: {god-trends L3|spec-review FAIL|状态机 ROLLBACK|spec 显著变更}
> 发生: {YYYY-MM-DD HH:MM}
> 系统: {project-name}
> 等级: {P0 阻塞|P1 返工|P2 体验降级}

## 事实（时间线,客观可验）

| 时间 | 事件 | 证据 |
|------|------|------|
| {HH:MM} | {event} | {trace 行 / spec 行 / commit hash} |
| ... | ... | ... |

## 根因分析（5 Whys,或更简）

1. Why 1: {问题}
2. Why 2: {问题}
3. ...
5. Why 5: {根本原因}

## 影响

- {影响面 1: 哪类项目/哪类 feature}
- {影响面 2: 多大量级}
- {系统信号: L3 档 / 测试失败率 / 等}

## 修复（已落地 / 计划中）

- [ ] {action 1} — {owner} — {due}
- [ ] {action 2} — {owner} — {due}

## 预防（机制层,不只补当前 bug）

- {机制 1: 怎么让此类事故系统层不再发生}
- {机制 2: ...}

## 关联

- spec: {spec-file-line}
- 测试: {test-file-line}
- commit: {hash}
- 衍生 ADR: docs/adrs/NNNN-{slug}.md(如已合入)

## 附录: 修订记录

| 日期 | 修订人 | 内容 |
|------|--------|------|
| {YYYY-MM-DD} | {author} | 初版 |
