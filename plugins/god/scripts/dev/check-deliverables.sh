#!/usr/bin/env bash
# 交付物校验脚本
# 用法: check-deliverables.sh <WORK_DIR> "描述1|glob1" "描述2|glob2" ...
# 返回: 退出码 0=全部通过, 1=有缺失

set -euo pipefail

WORK_DIR="${1:?用法: check-deliverables.sh <WORK_DIR> \"描述|glob\" ...}"
shift

if [ $# -eq 0 ]; then
  echo "错误: 未提供交付物清单"
  exit 1
fi

MISSING=()
FOUND=()
shopt -s nullglob

for item in "$@"; do
  IFS='|' read -r desc pattern <<< "$item"
  files=("$WORK_DIR"/$pattern)
  # nullglob 只对含通配符的路径生效，纯文件名需额外 -e 检查
  if [ ${#files[@]} -eq 0 ] || [ ! -e "${files[0]}" ]; then
    MISSING+=("$desc ($pattern)")
  else
    FOUND+=("$desc")
  fi
done

shopt -u nullglob

echo "=== 交付物校验结果 ==="
echo "通过: ${#FOUND[@]}/$#"
for f in "${FOUND[@]}"; do echo "  [OK] $f"; done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "缺失:"
  for m in "${MISSING[@]}"; do echo "  [MISSING] $m"; done
  exit 1
fi
