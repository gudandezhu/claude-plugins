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

# 配置
# 确保 SDK 能找到 API 密钥
if not os.environ.get('ANTHROPIC_API_KEY'):
    os.environ['ANTHROPIC_API_KEY'] = os.environ.get('ANTHROPIC_AUTH_TOKEN', '')

CHECK_INTERVAL = 60  # 检查间隔（秒）
AI_DOCS_PATH = os.environ.get('AI_DOCS_PATH', '')
PROJECT_PATH = str(Path(AI_DOCS_PATH).parent) if AI_DOCS_PATH else ''

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

class ProductObserverAgent:
    """产品观察者 Agent"""

    def __init__(self):
        """初始化 Agent"""
        if not AI_DOCS_PATH:
            raise ValueError("AI_DOCS_PATH 环境变量未设置")

        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.dashboard_api = get_dashboard_api()

    async def analyze_with_claude(self, prompt: str) -> str:
        """使用 Claude Agent SDK 分析"""
        try:
            result_text = ""

            async for message in query(
                prompt=prompt,
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-5-20250929"
                )
            ):
                # 处理不同类型的消息
                if hasattr(message, 'result') and message.result:
                    # ResultMessage 包含最终结果
                    result_text = str(message.result)
                    break
                elif hasattr(message, 'content') and message.content:
                    # AssistantMessage 包含文本内容
                    for block in message.content:
                        if hasattr(block, 'text'):
                            result_text = block.text
                            break
                    if result_text:
                        break

            return result_text
        except Exception as e:
            print(f"❌ Claude 分析失败: {e}")
            import traceback
            traceback.print_exc()
            return ""

    async def check_dashboard(self) -> list:
        """检查 Dashboard（暂时禁用，太慢）"""
        # 暂时禁用 dashboard 检查，因为需要多次 API 调用
        return []

    async def check_code_quality(self) -> list:
        """检查代码质量（暂时禁用，太慢）"""
        # 暂时禁用代码质量检查，因为扫描整个代码库非常耗时
        return []

    async def check_logs(self) -> list:
        """检查日志"""
        issues = []

        try:
            # 检查项目中的 Web Server 日志
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
                f'{self.dashboard_api}/api/requirement',
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

        # 顺序执行所有检查（避免并发调用 query 导致的问题）
        try:
            result = await self.check_dashboard()
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ Dashboard 检查异常: {e}")

        try:
            result = await self.check_code_quality()
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ 代码质量检查异常: {e}")

        try:
            result = await self.check_logs()
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ 日志检查异常: {e}")

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
API: {dashboard_api}
间隔: {CHECK_INTERVAL}s

观察: Dashboard、代码质量、日志
        """.format(
            PROJECT_PATH=PROJECT_PATH,
            dashboard_api=self.dashboard_api,
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
