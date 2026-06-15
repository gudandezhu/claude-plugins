---
description: |
  testing 目录初始化规范。自动检测和初始化 testing 目录，防止带日期后缀的错误命名。
  在 gen-test/run-test 初始化阶段加载。
---

# testing 目录初始化

## 问题背景

历史上曾出现 `testing-20260429-01` 这种带日期后缀的目录名，导致：
- 报告路径跑偏（reports 出现在归档目录）
- test-config.json 中 workDir 与实际目录不一致
- 后续命令无法找到正确的 testing 目录

## 正确行为

- 目录下存在 `testing/` 目录 → 直接使用
- 不存在 → 创建新的 `testing/` 目录
- 归档时保留依赖文件和登录信息

## 执行脚本

```bash
# gen-test 阶段：仅创建最小目录（test-cases/ + .cache/）
node $CLAUDE_PLUGIN_ROOT/skills/command-bootstrap/scripts/init-testing-dir.js --work-dir $WORK_DIR --scope minimal

# run-test 阶段：创建完整目录（补充 scripts/api/helpers/ + reports/ + screenshots/ + evidence/）
node $CLAUDE_PLUGIN_ROOT/skills/command-bootstrap/scripts/init-testing-dir.js --work-dir $WORK_DIR --scope full
```

可选参数：
- `--scope minimal`：仅创建 gen-test 所需目录（`test-cases/` + `.cache/`）
- `--scope full`：创建全部目录（默认值）
- `--archive`：归档现有 testing 目录后重新初始化

## 目录职责

| 目录 | 创建时机 | 消费方 |
|------|---------|--------|
| `test-cases/` | gen-test Wave 1 | gen-test 写 + run-test 读 |
| `.cache/` | gen-test Wave 1 | gen-test + run-test 缓存 |
| `scripts/api/helpers/` | run-test Phase 0 | run-test Phase 3（API helpers） |
| `reports/` | run-test Phase 0 | run-test Phase 6（报告） |
| `screenshots/` | run-test Phase 0 | run-test Phase 5（截图） |
| `evidence/` | run-test Phase 0 | run-test Phase 5（证据） |

## 输出处理

脚本输出 JSON 到 stdout，根据 `status` 字段决定后续动作：

| status | 含义 | 后续动作 |
|--------|------|---------|
| `created` | testing 目录已创建 | 继续执行 |
| `ready` | testing 目录已存在且有效 | 继续执行 |
| `archived` | testing 目录已归档并重建 | 继续执行 |
| `error` | 初始化失败 | 停止，展示 message 字段内容 |

## 归档保留策略

使用 `--archive` 参数时，以下内容保留在 testing 目录中，不归档：

- `node_modules/`：依赖包
- `package.json`：依赖配置
- `package-lock.json`：依赖锁定
- `auth/`：登录态信息
- `.gitignore`：Git 忽略配置

其他内容（test-cases/、scripts/、reports/ 等）移动到归档目录。

## 禁止事项

- 禁止创建 `testing-{日期}-{序号}` 格式的目录名
- 禁止手动判断 testing 目录是否存在——必须通过脚本判断
- 禁止在归档时删除依赖文件和登录信息
