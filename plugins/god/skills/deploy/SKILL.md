---
status: stable
name: deploy
user-invocable: false
description: |
  deploy 阶段流水线（v0.7.4 新增）。**范围 = 本地 docker compose**（不涉及 k8s / 云 / CI/CD）。
  test 阶段 `phase: verified` 后派 deploy subagent 写 Dockerfile + docker-compose.yml + .env.example。
  主 agent 不写部署配置，只编排。
  触发：prd 阶段 5 test 末（phase: verified）/ 用户显式 /god:deploy（向后兼容）。
---

# Deploy（v0.7.4 本地 docker compose）

> **v0.7.4 范围**：只到本地 docker compose。k8s / 云 / GitHub Actions 留给 v0.8.0 路线图。
> 读 `tech.md`（服务划分 + DB + 通信）→ 写 `Dockerfile` + `docker-compose.yml` + `.env.example`。
> 部署动作（`docker compose up`）由 OPC 手动跑——god 不替你 `up`。

## 调用契约

**调用方**：主 agent（prd skill 阶段 5 test 末）派 `deploy` subagent
**主 agent 干**：跑阶段 0 自检、读 subagent 结果、回显
**deploy subagent 干**：读 tech.md → 写 Dockerfile + docker-compose.yml + .env.example
**subagent 不能做**：弹 AskUserQuestion / 派 subagent / 跑 sign-gate / 改 spec.state.meta.json / 实际 `docker compose up`
**subagent 完事回主 agent**，主 agent 跑 docker compose config 自检 + 回显产物

## 阶段 0：环境 + tech.md 自检（主 agent 跑 L3 脚本）

```bash
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-cli.js status <项目>  # phase 应为 verified
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-validate.js <项目>
```

判断：
- `phase: verified` + 全过 → 派 deploy subagent
- `phase: implemented` → 回 test 阶段
- `phase: drafted/reviewed` → 走 prd 阶段 4/5
- 校验失败 → 回 prd 阶段 1/2 修

## 阶段 1：deploy 产物生成（派 deploy subagent）

主 agent 派 `deploy` subagent（worktree 隔离）：

**subagent 任务清单**：
1. 读 `spec/architecture/tech.md`（**服务划分 + DB schema + 端口 + 环境变量**）
2. 读 `spec/domains/D-XXX/spec.feature`（每个业务域的 SC 涉及哪些服务）
3. 写 `Dockerfile`（**多阶段构建**：builder + runtime，最小镜像）
4. 写 `docker-compose.yml`（**服务列表 + 网络 + volume + 端口映射**）
5. 写 `.env.example`（**所有环境变量占位**，不写真实值）
6. 写 `docker-compose.override.yml`（可选，dev 模式覆盖）
7. 写 `nginx.conf`（可选，反向代理）
8. 完事回主 agent

**主 agent 收尾**：跑 `docker compose config` 校验 yaml 合法 + 回显产物列表。

## 产物清单（v0.7.4 必须有）

| 文件 | 必有 | 内容 | 大小参考 |
|---|---|---|---|
| `Dockerfile` | ✅ | 多阶段构建（node:20-alpine 或 python:3.12-slim）| 30-50 行 |
| `docker-compose.yml` | ✅ | 服务列表（app + db + redis）+ network + volume | 30-60 行 |
| `.env.example` | ✅ | DATABASE_URL / REDIS_URL / PORT 等占位 | 10-20 行 |
| `docker-compose.override.yml` | ❌ 可选 | dev 模式覆盖（mount src + hot reload）| 15-30 行 |
| `nginx.conf` | ❌ 可选 | 反向代理（多服务时）| 20-40 行 |
| `Makefile` | ❌ 可选 | 封装 `docker compose up/down/logs` | 10-20 行 |

## 不在 v0.7.4 范围（v0.8.0 路线图）

- ❌ k8s 部署（Deployment / Service / Ingress / ConfigMap）
- ❌ 云部署（AWS / GCP / Azure）
- ❌ CI/CD（GitHub Actions / GitLab CI）
- ❌ 镜像仓库推送（Docker Hub / ECR / GCR）
- ❌ 监控告警（Prometheus / Grafana / Sentry）
- ❌ 备份恢复（pg_dump / volume snapshot）
- ❌ HTTPS / TLS 证书
- ❌ 域名 / DNS

**理由**：v0.7.4 是 god 的"本地跑通"里程碑。CI/CD 是另一阶段（v0.8.0 路线图）。

## OPC 使用流程

```bash
# 1. god 跑完 test 阶段 → 自动写 Dockerfile + docker-compose.yml
# 2. OPC 跑：
cp .env.example .env
# 编辑 .env 填真实值（DATABASE_URL / API keys）

# 3. 启动：
docker compose up -d

# 4. 看日志：
docker compose logs -f

# 5. 停：
docker compose down
```

**OPC 不必懂 K8s / 云**——本地 docker compose 一键启停。

## 阶段 2：自检（主 agent 跑 L3 脚本）

```bash
# 2a yaml 合法性校验
docker compose config -q

# 2b Dockerfile 静态检查（用 hadolint 如果装了）
which hadolint && hadolint Dockerfile

# 2c 总结
node ${CLAUDE_PLUGIN_ROOT}/spec/scripts/spec-summary.js gen <项目>
```

不通过 → 派 fixer subagent 修（按报错定位），不通过超过 3 次回主 agent 问 OPC。

## 阶段 3：回显产物（主 agent）

不弹 S4 签——deploy 完成后主 agent 跑回显：

```
deploy 阶段完成（v0.7.4 本地 docker compose）：
- ✅ Dockerfile (42 行)
- ✅ docker-compose.yml (3 服务：app + postgres + redis)
- ✅ .env.example (8 环境变量占位)
- ❌ docker-compose.override.yml (可选)
- ❌ nginx.conf (可选，单服务不需要)

下一步（OPC 手动）：
  cp .env.example .env
  docker compose up -d

CI/CD / k8s / 云部署 = v0.8.0 路线图，本阶段不实装
```

## 衔接

deploy 完成 → prd 流水线结束。`spec/state/meta.json` phase 保持 `verified`（**deploy 不改 phase**——`accepted` 仍由 S3 签字后置入）。

## 多会话接续

> **subagent 跑不完 N 产物** 是 subagent 自己的事——subagent 写 `spec/verified-deploy-status.md` 断点。

| 触发 | 处理者 | 动作 |
|---|---|---|
| deploy subagent 跑不完 N 产物 | subagent 内部 | 写 `spec/verified-deploy-status.md`（已做 N 产物 + 剩余 M）→ 退出 |
| OPC 说"结束会话" | 主 agent | 跑 session-end hook 写 `spec/<phase>-checkpoint.md` |
| 下一会话启动 | 主 agent | 读 phase + checkpoint → 重新派 deploy subagent → subagent 读 status 续跑 |

**禁止**：

- ❌ 主 agent 写 Dockerfile / docker-compose.yml
- ❌ subagent 弹签 / 派 subagent / 实际 `docker compose up`
- ❌ 主 agent 主动建议"下一会话跑 /god:deploy"
- ❌ subagent 把"OPC 注意力预算"当成"该退出"

## 禁止

- ❌ 跳过阶段 0 自检
- ❌ 在 v0.7.4 范围外加 deploy 产物（k8s / 云 / CI）——v0.8.0 路线图
- ❌ 主 agent 写部署配置
- ❌ 实际跑 `docker compose up`（OPC 手动跑）

## 机制

- **部署配置跟随 tech.md**：先有服务划分，后有 Dockerfile
- **产物可重建**：`docker compose.yml` 必须 1 个命令启停，不依赖外部脚本
- **OPC 看 = `.env.example` + `docker compose up -d`**：2 步上手
- **subagent 物理隔离**：deploy subagent 独立 session 写产物，主 agent 不知道 Dockerfile 细节
