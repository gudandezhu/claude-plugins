#!/bin/bash
# Setup Web Dashboard
#
# 本脚本使用 /shell-scripting 技能实现

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

WEB_DIR="${CLAUDE_PLUGIN_ROOT}/web"

echo -e "${YELLOW}🌐 设置 Web Dashboard...${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 需要 Node.js 来运行 Web Dashboard"
    echo "请安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 安装依赖
cd "$WEB_DIR"
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install --silent
fi

echo -e "${GREEN}✅ Web Dashboard 准备就绪${NC}"
echo "   启动命令: node ${WEB_DIR}/server.js"
echo "   访问地址: http://localhost:3737"
