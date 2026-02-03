#!/usr/bin/env python3
"""
Simple Product Observer - 简化版产品观察者

只做基本检查，不使用 SDK，避免超时和并发问题
"""

import os
import asyncio
import httpx
from pathlib import Path
from datetime import datetime

# 配置
CHECK_INTERVAL = 60  # 检查间隔（秒）
AI_DOCS_PATH = os.environ.get('AI_DOCS_PATH', '')
PROJECT_PATH = str(Path(AI_DOCS_PATH).parent) if AI_DOCS_PATH else ''

# 启动时输出环境变量（用于调试）
print(f"[DEBUG] AI_DOCS_PATH = {AI_DOCS_PATH}", flush=True)
print(f"[DEBUG] PROJECT_PATH = {PROJECT_PATH}", flush=True)
print(f"[DEBUG] 当前工作目录 = {os.getcwd()}", flush=True)
print(f"[DEBUG] 脚本路径 = {__file__}", flush=True)

# 已提交的问题（去重）
submitted_issues = set()
MAX_ISSUE_MEMORY = 100


def get_dashboard_port() -> int:
    """获取 Dashboard 端口"""
    port_file = Path(AI_DOCS_PATH) / '.logs' / 'server.port'
    if port_file.exists():
        try:
            return int(port_file.read_text().strip())
        except (ValueError, IOError):
            pass
    return 3737  # 默认端口


def get_dashboard_api() -> str:
    """获取 Dashboard API 地址"""
    port = get_dashboard_port()
    return f'http://127.0.0.1:{port}'


class SimpleProductObserver:
    """简化的产品观察者"""

    def __init__(self):
        """初始化"""
        if not AI_DOCS_PATH:
            raise ValueError("AI_DOCS_PATH 环境变量未设置")

        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.dashboard_api = get_dashboard_api()

    async def check_logs(self) -> list:
        """检查日志"""
        issues = []

        try:
            log_dir = Path(AI_DOCS_PATH) / '.logs'
            server_log = log_dir / 'server.log'

            if server_log.exists():
                content = server_log.read_text()[-5000:]  # 只看最后 5000 字符
                error_count = content.lower().count('error')

                if error_count > 5:
                    issues.append({
                        'type': 'stability',
                        'priority': 'P1',
                        'title': 'Server 日志存在错误',
                        'description': f'发现 {error_count} 处错误'
                    })

        except Exception as e:
            print(f"❌ 日志检查失败: {e}", flush=True)

        return issues

    async def check_task_file(self) -> list:
        """检查任务文件"""
        issues = []

        try:
            tasks_file = Path(AI_DOCS_PATH) / 'TASKS.json'

            if not tasks_file.exists():
                issues.append({
                    'type': 'documentation',
                    'priority': 'P2',
                    'title': 'TASKS.json 不存在',
                    'description': '任务文件缺失，可能影响项目管理'
                })
                return issues

            # 检查是否有长期未更新的任务
            import json
            import time

            with open(tasks_file, 'r') as f:
                data = json.load(f)

            if not data.get('tasks'):
                return issues

            current_time = time.time()
            one_day = 86400

            for task in data.get('tasks', []):
                if task.get('status') == 'inProgress':
                    # 检查任务是否超过 1 天未更新
                    # 这里简化处理，实际应该记录任务开始时间
                    pass

        except Exception as e:
            print(f"❌ 任务文件检查失败: {e}", flush=True)

        return issues

    async def submit_issue(self, issue: dict) -> bool:
        """提交问题到需求池"""
        issue_key = f"{issue['type']}:{issue['title']}"

        # 去重
        if issue_key in submitted_issues:
            return False

        submitted_issues.add(issue_key)
        if len(submitted_issues) > MAX_ISSUE_MEMORY:
            submitted_issues.pop(next(iter(submitted_issues)))

        try:
            response = await self.http_client.post(
                f'{self.dashboard_api}/api/requirement',
                json={
                    'requirement': f"[{issue['type'].upper()}] {issue['title']}\n\n"
                                  f"{issue['description']}\n\n"
                                  f"优先级: {issue['priority']}"
                }
            )

            if response.status_code == 200:
                print(f"✅ {issue['title']}", flush=True)
                return True
            else:
                print(f"❌ 提交失败: {issue['title']}", flush=True)
                return False

        except Exception as e:
            print(f"❌ 提交异常: {e}", flush=True)
            return False

    async def observe_once(self):
        """执行一次观察"""
        print(f"\n🔍 {datetime.now().strftime('%H:%M:%S')} 开始观察...\n", flush=True)

        all_issues = []

        # 顺序执行所有检查
        try:
            result = await self.check_logs()
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ 日志检查异常: {e}", flush=True)

        try:
            result = await self.check_task_file()
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ 任务文件检查异常: {e}", flush=True)

        # 按优先级排序
        priority_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
        all_issues.sort(key=lambda x: priority_order.get(x.get('priority', 'P2'), 2))

        # 提交问题
        if all_issues:
            print(f"\n发现 {len(all_issues)} 个问题:\n", flush=True)
            submitted = 0
            for issue in all_issues:
                if await self.submit_issue(issue):
                    submitted += 1
            print(f"\n✓ 已提交 {submitted} 个新问题", flush=True)
        else:
            print("✓ 未发现问题", flush=True)

        print(f"\n⏰ 下次检查: {(datetime.now().timestamp() + CHECK_INTERVAL):.0f}\n", flush=True)

    async def run(self):
        """持续运行"""
        print("""
╔══════════════════════════════════════════════╗
║     👁️  Simple Product Observer              ║
║                                              ║
║     简化版产品观察者                          ║
╚══════════════════════════════════════════════╝

项目: {PROJECT_PATH}
API: {dashboard_api}
间隔: {CHECK_INTERVAL}s

观察: 日志、任务文件
        """.format(
            PROJECT_PATH=PROJECT_PATH,
            dashboard_api=self.dashboard_api,
            CHECK_INTERVAL=CHECK_INTERVAL
        ), flush=True)

        # 立即执行一次
        await self.observe_once()

        # 定时执行
        while True:
            await asyncio.sleep(CHECK_INTERVAL)
            await self.observe_once()


async def main():
    """主入口"""
    agent = SimpleProductObserver()

    try:
        await agent.run()
    except KeyboardInterrupt:
        print("\n🛑 Product Observer Agent 停止\n", flush=True)
    except Exception as e:
        print(f"❌ Agent 异常: {e}")
        raise


if __name__ == '__main__':
    asyncio.run(main())
