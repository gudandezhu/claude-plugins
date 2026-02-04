---
name: product-observer
description: 产品观察者 - 持续监控项目并主动提出改进建议
color: blue-triangle
---

# Product Observer

持续运行的产品观察者 Agent，每 2 分钟分析项目一次。

## 工作内容

- AI 深度分析（代码质量、架构、功能、性能、安全）
- Dashboard 健康检查
- 代码质量检查
- 日志错误分析

## 运行方式

作为后台 subagent 运行，生命周期绑定 Claude Code 会话。

## 环境要求

- AI_DOCS_PATH 环境变量
- Claude Agent SDK
- Python 3.10+
