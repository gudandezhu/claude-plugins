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

> 读 `tech.md` → 写 `Dockerfile` + `docker-compose.yml` + `.env.example`。
> 部署动作（`docker compose up`）由 OPC 手动跑。
> **不动产品代码**——只产部署配置。

## 调用契约

**主 agent 干**：跑阶段 0 自检 + 读 subagent 结果 + 回显
**deploy subagent 干**：读 tech.md → 写 Dockerfile + docker-compose.yml + .env.example
**subagent 禁**：弹签 / 派 subagent / 改 `feature/state/meta.json` / 实际 `docker compose up` / 改产品代码

## 路径约定

**业务项目**（用 `context/`）：

| 资源 | 路径 |
|---|---|
| 状态 | `context/feature/state/meta.json` |
| 技术架构 | `context/architecture/tech.md` |
| 业务架构 | `context/domain/D-XXX/README.md` |

**god 自身**（保留 `spec/`）：

| 资源 | 路径 |
|---|---|
| 状态 | `spec/state/meta.json` |
| 技术架构 | `spec/architecture/tech.md` |

**deploy subagent 读 tech.md 时**——主 agent 传绝对路径，避免歧义。

## 阶段 0：环境 + tech.md 自检（主 agent 跑）

```bash
# 业务项目（优先）
test -f context/feature/state/meta.json && cat context/feature/state/meta.json | grep '"phase"' | grep 'verified'
# god 自身（兜底）
test -f spec/state/meta.json && cat spec/state/meta.json | grep '"phase"' | grep 'verified'

# tech.md 存在
test -f context/architecture/tech.md || test -f spec/architecture/tech.md
```

判断：
- `verified` + tech.md 存在 → 派 subagent
- `implemented` → 回 test 阶段
- 其他 → 回对应阶段

## 阶段 1：deploy 产物（派 subagent）

subagent 任务清单：
1. 读 `tech.md`（服务划分 + API 契约 + DB schema + 通信方式）
2. 写 `Dockerfile`（多阶段构建，最小镜像）
3. 写 `docker-compose.yml`（服务列表 + 网络 + volume）
4. 写 `.env.example`（占位环境变量）
5. 可选：`docker-compose.override.yml` / `nginx.conf` / `Makefile`
6. 完事回主 agent

## 产物清单

| 文件 | 必有 | 内容 |
|---|---|---|
| `Dockerfile` | ✅ | 多阶段构建，最小镜像 |
| `docker-compose.yml` | ✅ | 服务列表 + 网络 + volume |
| `.env.example` | ✅ | 占位环境变量（**不入真实密钥**）|
| `docker-compose.override.yml` / `nginx.conf` / `Makefile` | ❌ | 可选 |

**不入用户仓库的产物**：实际部署的 image / volume（用户手动 `docker compose up`）。

## 阶段 2：自检（主 agent 跑）

```bash
docker compose config -q
which hadolint && hadolint Dockerfile
test -f .env.example
```

不通过 → 派 fixer subagent 修（>3 次回 OPC）。**不弹 S4 签**——deploy 完成后主 agent 跑回显（产物列表 + 下一步）。

## OPC 使用流程

```bash
cp .env.example .env       # 编辑填真实值
docker compose up -d       # 启动
docker compose logs -f     # 看日志
docker compose down        # 停
```

**OPC 看 `docker compose up` 跑通 = 验收 deploy 成功**。

## 不在 v0.7.4 范围（v0.8.0 路线图）

- ❌ k8s（Helm / Kustomize / manifests）
- ❌ 云（AWS / GCP / Azure）
- ❌ CI/CD（GitHub Actions / GitLab CI）
- ❌ 镜像仓库推送（Docker Hub / GHCR）
- ❌ 监控告警（Prometheus / Grafana / Sentry）
- ❌ 备份恢复（snapshot / WAL archive）
- ❌ HTTPS / TLS（cert-manager / Let's Encrypt）
- ❌ 域名 / DNS

**理由**：v0.7.4 是"本地能 up 起来"里程碑。生产化是 v0.8.0+。

## 阶段 3：回显（主 agent）

```
deploy 完成（v0.7.4，本地 docker compose）：
- 新增: Dockerfile + docker-compose.yml + .env.example
- 自检: docker compose config -q 通过
- 下一步: OPC 手动跑
  1. cp .env.example .env  # 编辑填值
  2. docker compose up -d  # 启动
  3. docker compose logs -f  # 验证

不弹 S4 签（v0.7.4）。phase 保持 verified，accepted 仍由 S3 签字。
```

## 衔接 + 多会话

deploy 完成 → prd 流水线结束。`feature/state/meta.json` phase 保持 `verified`（accepted 仍由 S3 签字）。

**subagent 跑不完 N 产物** → subagent 写 `feature/verified-deploy-status.md` 断点 → 下一会话主 agent 读 phase+checkpoint 续派。

## 禁止

- ❌ 跳过阶段 0 自检
- ❌ 在 v0.7.4 范围外加 deploy 产物（k8s / 云 / CI / 监控）
- ❌ 主 agent 写部署配置（必须派 subagent）
- ❌ 主 agent 实际 `docker compose up`（必须 OPC 手动）
- ❌ `.env.example` 写真实密钥（**只占位**）
- ❌ 改产品代码（deploy 阶段**只产部署配置**）
