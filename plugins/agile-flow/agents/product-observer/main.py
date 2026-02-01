#!/usr/bin/env python3
"""
Product Observer - 启动入口

使用方法：
    python main.py
"""

import asyncio
import sys
from pathlib import Path

# 添加当前目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from agent import main


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 再见！")
        sys.exit(0)
