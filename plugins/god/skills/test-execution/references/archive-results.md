# 归档上一轮执行结果

> 由 run-test 步骤一加载，清理上一轮的执行产物，为新测试准备干净环境。

## 设计原则

testingRepo 有 git 版本控制，归档策略按产物类型区分：

| 产物类型 | 位置 | 处理方式 | 原因 |
|---------|------|---------|------|
| 测试脚本 | testingRepo | **不处理** | git 管理版本，直接覆盖 |
| test-results/（截图/trace） | testingRepo | **直接删除** | 临时产物，gitignore，每次重新生成 |
| 验收报告/缺陷清单 | testingRepo reports/ | **直接覆盖** | git 管理版本，无需归档 |
| .cache/（raw JSON） | testing/ | **直接删除** | 每次重新生成 |
| screenshots/reports/evidence | testing/ | **归档到 test-runs/** | process-docs 无版本控制，需保留历史 |

## testingRepo 路径解析

```bash
TESTING_REPO_ROOT=""
REPO_RESOLVE=$(node "$CLAUDE_PLUGIN_ROOT/scripts/test-exec/resolve-test-paths.js" --config "$WORK_DIR/testing/test-config.json" 2>/dev/null || echo '{"mode":"legacy"}')
REPO_MODE=$(echo "$REPO_RESOLVE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).mode||'legacy'))")
if [ "$REPO_MODE" = "testing-repo" ]; then
  TESTING_REPO_ROOT=$(echo "$REPO_RESOLVE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).projectRoot||''))")
fi
```

## 清理命令

```bash
# ── testing/ 目录（process-docs，无版本控制）──
if [ -d "$WORK_DIR/testing/screenshots" ] || [ -d "$WORK_DIR/testing/reports" ] || [ -d "$WORK_DIR/testing/evidence" ]; then
  ARCHIVE_DIR=$WORK_DIR/testing/test-runs/$(date +%Y%m%d%H%M%S)
  mkdir -p $ARCHIVE_DIR
  mv $WORK_DIR/testing/screenshots $ARCHIVE_DIR/ 2>/dev/null
  mv $WORK_DIR/testing/reports $ARCHIVE_DIR/ 2>/dev/null
  mv $WORK_DIR/testing/evidence $ARCHIVE_DIR/ 2>/dev/null
fi
rm -rf $WORK_DIR/testing/.cache 2>/dev/null

# ── testingRepo 目录（有 git 版本控制）──
# 直接清理临时产物，不需要归档——git 管理版本历史
if [ -n "$TESTING_REPO_ROOT" ]; then
  # Playwright test-results/（截图、trace、视频）—— 临时产物，直接删除
  rm -rf "$TESTING_REPO_ROOT/features/e2e/test-results" 2>/dev/null
  rm -rf "$TESTING_REPO_ROOT/test-results" 2>/dev/null
fi
```

归档后重新创建 testing/ 空目录：
```bash
mkdir -p $WORK_DIR/testing/screenshots
mkdir -p $WORK_DIR/testing/reports
mkdir -p $WORK_DIR/testing/evidence
```

## 不归档/不删除的内容

- **testingRepo 中的测试脚本** — git 管理版本，run-test 直接覆盖
- **testingRepo 中的 reports/** — 报告提交 testingRepo git，run-test 完成后按 artifact-commit 提交
- test-config.json — run-test 的产物，run-test 不动
- test-cases/ — 案例文档，跨轮次复用
- node_modules/ — 依赖，跨轮次复用
- auth/ — 登录态，跨轮次复用
