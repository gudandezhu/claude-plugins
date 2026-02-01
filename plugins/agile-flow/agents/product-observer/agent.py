"""
Product Observer Agent - 产品观察者 Agent

使用 Claude Agent SDK 创建的 AI 产品观察者，持续监控平台并智能提出改进建议。
"""

import os
import asyncio
import httpx
from pathlib import Path
from datetime import datetime

# Agent SDK 导入
from claude_agent_sdk import query, ClaudeAgentOptions
from anthropic import Anthropic

# 配置
CHECK_INTERVAL = 60  # 检查间隔（秒）
AI_DOCS_PATH = os.environ.get('AI_DOCS_PATH', '')
PROJECT_PATH = str(Path(AI_DOCS_PATH).parent) if AI_DOCS_PATH else ''
DASHBOARD_API = 'http://127.0.0.1:3737'
WEBAPP_URL = 'http://localhost:5173'

# 已提交的问题（去重）
submitted_issues = set()
MAX_ISSUE_MEMORY = 100


class ProductObserverAgent:
    """产品观察者 Agent"""

    def __init__(self):
        """初始化 Agent"""
        if not AI_DOCS_PATH:
            raise ValueError("AI_DOCS_PATH 环境变量未设置")

        self.http_client = httpx.AsyncClient(timeout=30.0)

    async def analyze_with_claude(self, prompt: str) -> str:
        """使用 Claude Agent SDK 分析"""
        try:
            messages = []

            async for message in query(
                prompt=prompt,
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=2000
                )
            ):
                messages.append(message)
                if hasattr(message, 'content') and message.content:
                    return message.content[0].text if message.content else ""

            return ""
        except Exception as e:
            print(f"❌ Claude 分析失败: {e}")
            return ""

    async def check_dashboard(self) -> list:
        """检查 Dashboard"""
        issues = []

        try:
            # 使用 AI 分析 Dashboard 状态
            analysis = await self.analyze_with_claude(
                f"请检查 {DASHBOARD_API.replace('127.0.0.1', 'localhost')} 的状态。"
                f"这是一个敏捷开发 Dashboard，显示任务进度和需求池。"
                f"请识别："
                f"1. 是否有界面布局问题"
                f"2. 是否有数据异常（如任务积压）"
                f"3. 是否有功能缺失"
                f"返回 2-3 个具体问题的简短描述，每条一行。"
            )

            if analysis.strip():
                for line in analysis.strip().split('\n')[:3]:
                    if line.strip():
                        issues.append({
                            'type': 'dashboard',
                            'priority': 'P2',
                            'title': line.strip()[:50],
                            'description': line.strip()[:200]
                        })

        except Exception as e:
            print(f"❌ Dashboard 检查失败: {e}")

        return issues

    async def check_webapp(self) -> list:
        """检查前端应用"""
        issues = []

        try:
            # 检查应用是否运行
            response = await self.http_client.get(WEBAPP_URL, timeout=5.0)
            response_time = response.elapsed.total_seconds() * 1000

            if response_time > 2000:
                issues.append({
                    'type': 'performance',
                    'priority': 'P1',
                    'title': 'Web 应用响应慢',
                    'description': f'首页加载 {response_time:.0f}ms'
                })

        except Exception as e:
            if 'timeout' in str(e).lower() or 'connect' in str(e).lower():
                issues.append({
                    'type': 'availability',
                    'priority': 'P1',
                    'title': 'Web 应用未运行',
                    'description': f'无法访问 {WEBAPP_URL}'
                })

        return issues

    async def check_code_quality(self) -> list:
        """检查代码质量"""
        issues = []

        try:
            webapp_path = Path(PROJECT_PATH) / 'webapp-vue'
            if not webapp_path.exists():
                return issues

            src_path = webapp_path / 'src'
            if not src_path.exists():
                return issues

            # 使用 AI 分析代码结构
            analysis = await self.analyze_with_claude(
                f"请分析 {src_path} 目录下的 Vue 3 + TypeScript 前端代码。"
                f"检查："
                f"1. 代码组织结构"
                f"2. 是否有明显的代码坏味道"
                f"3. 是否缺少关键功能（如错误处理、日志）"
                f"返回 2-3 个具体改进建议，每条一行。"
            )

            if analysis.strip():
                for line in analysis.strip().split('\n')[:3]:
                    if line.strip():
                        issues.append({
                            'type': 'code',
                            'priority': 'P2',
                            'title': f'代码质量: {line.strip()[:40]}',
                            'description': line.strip()[:200]
                        })

        except Exception as e:
            print(f"❌ 代码质量检查失败: {e}")

        return issues

    async def check_logs(self) -> list:
        """检查日志"""
        issues = []

        try:
            # 检查 Web Server 日志
            log_dir = Path(__file__).parent.parent.parent / 'web' / '.logs'
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
            print(f"❌ 日志检查失败: {e}")

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
                f'{DASHBOARD_API}/api/requirement',
                json={
                    'requirement': f"[{issue['type'].upper()}] {issue['title']}\n\n"
                                  f"{issue['description']}\n\n"
                                  f"优先级: {issue['priority']}"
                }
            )

            if response.status_code == 200:
                print(f"✅ {issue['title']}")
                return True
            else:
                print(f"❌ 提交失败: {issue['title']}")
                return False

        except Exception as e:
            print(f"❌ 提交异常: {e}")
            return False

    async def observe_once(self):
        """执行一次观察"""
        print(f"\n🔍 {datetime.now().strftime('%H:%M:%S')} 开始观察...\n")

        all_issues = []

        # 并发执行所有检查
        checks = [
            self.check_dashboard(),
            self.check_webapp(),
            self.check_code_quality(),
            self.check_logs()
        ]

        results = await asyncio.gather(*checks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                print(f"❌ 检查异常: {result}")
            elif isinstance(result, list):
                all_issues.extend(result)

        # 按优先级排序
        priority_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
        all_issues.sort(key=lambda x: priority_order.get(x.get('priority', 'P2'), 2))

        # 提交问题
        if all_issues:
            print(f"\n发现 {len(all_issues)} 个问题:\n")
            submitted = 0
            for issue in all_issues:
                if await self.submit_issue(issue):
                    submitted += 1
            print(f"\n✓ 已提交 {submitted} 个新问题")
        else:
            print("✓ 未发现问题")

        print(f"\n⏰ 下次检查: {(datetime.now().timestamp() + CHECK_INTERVAL):.0f}\n")

    async def run(self):
        """持续运行"""
        print("""
╔══════════════════════════════════════════════╗
║     👁️  Product Observer Agent               ║
║                                              ║
║     AI 驱动的产品观察者                       ║
╚══════════════════════════════════════════════╝

项目: {PROJECT_PATH}
Web: {WEBAPP_URL}
API: {DASHBOARD_API}
间隔: {CHECK_INTERVAL}s

观察: Dashboard、Web 应用、代码质量、日志
        """.format(
            PROJECT_PATH=PROJECT_PATH,
            WEBAPP_URL=WEBAPP_URL,
            DASHBOARD_API=DASHBOARD_API,
            CHECK_INTERVAL=CHECK_INTERVAL
        ))

        # 立即执行一次
        await self.observe_once()

        # 定时执行
        while True:
            await asyncio.sleep(CHECK_INTERVAL)
            await self.observe_once()


async def main():
    """主入口"""
    agent = ProductObserverAgent()

    try:
        await agent.run()
    except KeyboardInterrupt:
        print("\n🛑 Product Observer Agent 停止\n")
    except Exception as e:
        print(f"❌ Agent 异常: {e}")
        raise


if __name__ == '__main__':
    asyncio.run(main())
