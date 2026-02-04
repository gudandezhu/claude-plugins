"""
Product Observer Agent - 产品观察者 Agent

使用 Claude Agent SDK 创建的 AI 产品观察者，持续监控平台并智能提出改进建议。
"""

import os
import asyncio
import httpx
import json
import subprocess
import threading
import queue
from pathlib import Path
from datetime import datetime

# Agent SDK 导入
from claude_agent_sdk import query, ClaudeAgentOptions

# 配置
# 确保 SDK 能找到 API 密钥
if not os.environ.get('ANTHROPIC_API_KEY'):
    os.environ['ANTHROPIC_API_KEY'] = os.environ.get('ANTHROPIC_AUTH_TOKEN', '')

CHECK_INTERVAL = 120  # 检查间隔（秒）
AI_DOCS_PATH = os.environ.get('AI_DOCS_PATH', '')
PROJECT_PATH = str(Path(AI_DOCS_PATH).parent) if AI_DOCS_PATH else ''

# Claude Code 主进程 PID（用于监控生命周期）
CLAUDE_PID = os.environ.get('CLAUDE_PID', '')

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

        self.http_client = httpx.AsyncClient(timeout=60.0)
        self.dashboard_api = get_dashboard_api()

    async def collect_context(self) -> str:
        """收集项目上下文"""
        context_parts = []

        # 项目基本信息
        context_parts.append(f"# 项目信息\n")
        context_parts.append(f"路径: {PROJECT_PATH}\n")
        context_parts.append(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        # 读取项目文档
        docs_to_read = ['README.md', 'CLAUDE.md', 'ai-docs/CONTEXT.md', 'ai-docs/API.md']
        for doc_name in docs_to_read:
            doc_path = Path(PROJECT_PATH) / doc_name
            if doc_path.exists():
                try:
                    content = doc_path.read_text(encoding='utf-8')[:3000]
                    context_parts.append(f"\n## {doc_name}\n{content}\n")
                except Exception as e:
                    context_parts.append(f"\n## {doc_name}\n读取失败: {e}\n")

        # 当前任务状态
        tasks_file = Path(AI_DOCS_PATH) / 'TASKS.json'
        if tasks_file.exists():
            try:
                with open(tasks_file, 'r', encoding='utf-8') as f:
                    tasks_data = json.load(f)
                tasks = tasks_data.get('tasks', [])

                context_parts.append(f"\n## 当前任务状态\n")
                status_count = {}
                for task in tasks:
                    status = task.get('status', 'unknown')
                    status_count[status] = status_count.get(status, 0) + 1

                context_parts.append(f"总任务数: {len(tasks)}\n")
                context_parts.append(f"状态分布: {status_count}\n")

                # 列出活跃任务
                active_tasks = [t for t in tasks if t.get('status') in ['inProgress', 'testing', 'pending']]
                if active_tasks:
                    context_parts.append(f"\n活跃任务 ({len(active_tasks)}):\n")
                    for task in active_tasks[:10]:
                        task_id = task.get('id', 'N/A')
                        desc = task.get('description', 'N/A')[:100]
                        status = task.get('status', 'unknown')
                        context_parts.append(f"- [{status.upper()}] {task_id}: {desc}\n")
            except Exception as e:
                context_parts.append(f"\n## 任务读取失败\n{e}\n")

        # 需求池状态
        req_file = Path(AI_DOCS_PATH) / 'REQUIREMENTS.json'
        if req_file.exists():
            try:
                with open(req_file, 'r', encoding='utf-8') as f:
                    req_data = json.load(f)
                requirements = req_data.get('requirements', [])

                context_parts.append(f"\n## 需求池状态\n")
                context_parts.append(f"需求数: {len(requirements)}\n")

                # 统计优先级
                priority_count = {}
                for req in requirements:
                    priority = req.get('priority', 'P2')
                    priority_count[priority] = priority_count.get(priority, 0) + 1

                if priority_count:
                    context_parts.append(f"优先级分布: {priority_count}\n")

                # 列出高优先级需求
                high_priority = [r for r in requirements if r.get('priority') in ['P0', 'P1']]
                if high_priority:
                    context_parts.append(f"\n高优先级需求 ({len(high_priority)}):\n")
                    for req in high_priority[:5]:
                        title = req.get('title', req.get('content', '')[:50])
                        context_parts.append(f"- [{req.get('priority', 'P2')}] {title}\n")
            except Exception as e:
                context_parts.append(f"\n## 需求读取失败\n{e}\n")

        return "\n".join(context_parts)

    async def analyze_with_claude(self, context: str) -> list:
        """使用 Claude 深度分析项目"""
        issues = []

        print("  🤖 AI 深度分析中...", flush=True)

        prompt = f"""你是一个产品观察者 AI，负责主动发现项目的问题、风险和改进机会。

# 重要约束
- **直接基于以下提供的上下文进行分析**
- **不要使用任何工具**
- **立即输出 JSON 格式的结果**

# 项目上下文
{context}

# 你的任务
请从以下角度主动分析项目状态：

1. **代码质量**：重复代码、坏味道、过度复杂？
2. **架构问题**：模块耦合、职责不清？
3. **功能缺失**：用户体验不佳、缺少功能？
4. **性能风险**：潜在性能瓶颈？
5. **安全漏洞**：输入验证、权限控制？
6. **文档问题**：注释不足、文档过时？
7. **测试覆盖**：关键路径测试？
8. **改进机会**：可以做得更好的地方？

**输出格式（直接 JSON，无 markdown）**：
[
  {{
    "type": "bug|performance|security|ux|feature|documentation|quality|architecture",
    "priority": "P0|P1|P2|P3",
    "title": "简短标题",
    "description": "详细描述和改进建议"
  }}
]

没有问题则输出：[]

开始分析并输出 JSON：
"""

        # 使用独立线程运行 SDK，避免 cancel scope 问题
        try:
            result_queue = queue.Queue()

            def run_in_thread():
                """在单独线程中运行"""
                async def thread_query():
                    try:
                        async for message in query(
                            prompt=prompt,
                            options=ClaudeAgentOptions(
                                model="claude-sonnet-4-5-20250929",
                                tools=[],  # 禁用工具
                                permission_mode="bypassPermissions"
                            )
                        ):
                            if hasattr(message, 'result') and message.result:
                                result_queue.put(str(message.result))
                                return
                            elif hasattr(message, 'content') and message.content:
                                for block in message.content:
                                    if hasattr(block, 'text'):
                                        result_queue.put(block.text)
                                        return
                    except Exception as e:
                        result_queue.put(f"ERROR: {e}")

                # 新线程 + 新事件循环
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(thread_query())
                finally:
                    loop.close()

            # 启动线程
            thread = threading.Thread(target=run_in_thread, daemon=True)
            thread.start()
            thread.join(timeout=120.0)

            if thread.is_alive():
                print("    ⚠️  AI 分析超时", flush=True)
                return []

            # 获取结果
            try:
                result_text = result_queue.get_nowait()
            except queue.Empty:
                print("    ⚠️  AI 未返回结果", flush=True)
                return []

            if result_text.startswith("ERROR:"):
                print(f"    ⚠️  AI 错误: {result_text}", flush=True)
                return []

            # 解析 JSON
            if result_text:
                import re
                json_match = re.search(r'\[.*\]', result_text, re.DOTALL)
                if json_match:
                    issues_json = json_match.group(0)
                    issues = json.loads(issues_json)
                    print(f"    ✓ AI 发现 {len(issues)} 个问题/机会", flush=True)
                else:
                    print(f"    ⚠️  AI 未返回有效 JSON", flush=True)

        except Exception as e:
            print(f"    ⚠️  AI SDK 调用失败: {e}", flush=True)

        return issues

    async def check_dashboard(self) -> list:
        """检查 Dashboard 状态"""
        issues = []

        try:
            # 检查 Dashboard 是否运行
            response = await self.http_client.get(f'{self.dashboard_api}/api/health', timeout=5.0)

            if response.status_code != 200:
                issues.append({
                    'type': 'stability',
                    'priority': 'P0',
                    'title': 'Dashboard 服务不可用',
                    'description': f'健康检查失败，状态码: {response.status_code}'
                })

            # 获取任务统计
            response = await self.http_client.get(f'{self.dashboard_api}/api/tasks')
            if response.status_code == 200:
                tasks_data = response.json()
                tasks = tasks_data.get('tasks', [])

                # 检查失败任务
                failed_tasks = [t for t in tasks if t.get('status') == 'failed']
                if failed_tasks:
                    issues.append({
                        'type': 'quality',
                        'priority': 'P1',
                        'title': f'存在 {len(failed_tasks)} 个失败任务',
                        'description': '需要检查失败原因并修复'
                    })

        except Exception as e:
            issues.append({
                'type': 'stability',
                'priority': 'P0',
                'title': 'Dashboard 连接失败',
                'description': f'无法连接到 Dashboard: {e}'
            })

        return issues

    async def check_code_quality(self) -> list:
        """检查代码质量"""
        issues = []

        print("  🔍 检查代码质量...", flush=True)

        # 1. 检查是否有测试
        try:
            tests_dir = Path(PROJECT_PATH) / 'tests'
            if not tests_dir.exists() or len(list(tests_dir.rglob('test_*.py'))) == 0:
                issues.append({
                    'type': 'quality',
                    'priority': 'P1',
                    'title': '缺少单元测试',
                    'description': '项目中没有找到测试文件，建议添加 pytest 测试'
                })
        except Exception:
            pass

        # 2. 运行测试（如果存在）
        try:
            result = subprocess.run(
                ['python', '-m', 'pytest', '--tb=no', '-q'],
                cwd=PROJECT_PATH,
                capture_output=True,
                text=True,
                timeout=60
            )

            if 'failed' in result.stdout:
                import re
                failed_match = re.search(r'(\d+) failed', result.stdout)
                if failed_match:
                    issues.append({
                        'type': 'quality',
                        'priority': 'P1',
                        'title': f'{failed_match.group(1)} 个测试失败',
                        'description': '运行 pytest 发现失败，需要修复'
                    })
        except FileNotFoundError:
            pass  # pytest 未安装
        except subprocess.TimeoutExpired:
            issues.append({
                'type': 'quality',
                'priority': 'P2',
                'title': '测试执行超时',
                'description': 'pytest 运行超过 60 秒，可能存在性能问题'
            })
        except Exception:
            pass

        return issues

    async def check_logs(self) -> list:
        """检查日志"""
        issues = []

        print("  📋 检查日志...", flush=True)

        try:
            log_dir = Path(AI_DOCS_PATH) / '.logs'
            server_log = log_dir / 'server.log'

            if server_log.exists():
                content = server_log.read_text(encoding='utf-8')[-5000:]
                error_count = content.lower().count('error')

                if error_count > 10:
                    issues.append({
                        'type': 'stability',
                        'priority': 'P1',
                        'title': f'日志中发现 {error_count} 处错误',
                        'description': 'Server 日志中存在大量错误，需要排查'
                    })
                elif error_count > 0:
                    issues.append({
                        'type': 'stability',
                        'priority': 'P2',
                        'title': f'日志中发现 {error_count} 处错误',
                        'description': '存在少量错误，建议检查'
                    })

        except Exception as e:
            print(f"    ⚠️  日志检查失败: {e}", flush=True)

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
                                  f"优先级: {issue['priority']}\n"
                                  f"发现时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                                  f"发现者: Product Observer AI"
                }
            )

            if response.status_code == 200:
                print(f"    ✅ [{issue['priority']}] {issue['title']}", flush=True)
                return True
            else:
                print(f"    ❌ 提交失败: {issue['title']}", flush=True)
                return False

        except Exception as e:
            print(f"    ❌ 提交异常: {e}", flush=True)
            return False

    async def observe_once(self):
        """执行一次观察"""
        print(f"\n{'='*70}", flush=True)
        print(f"🔍 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 产品观察分析", flush=True)
        print(f"{'='*70}\n", flush=True)

        print("📊 收集项目信息...", flush=True)
        context = await self.collect_context()
        print(f"    ✓ 收集了 {context.count(chr(10))} 行上下文\n", flush=True)

        all_issues = []

        # 1. AI 深度分析
        try:
            ai_issues = await self.analyze_with_claude(context)
            all_issues.extend(ai_issues)
        except Exception as e:
            print(f"❌ AI 分析异常: {e}", flush=True)

        # 2. Dashboard 检查
        try:
            print("\n🖥️  检查 Dashboard...", flush=True)
            dashboard_issues = await self.check_dashboard()
            all_issues.extend(dashboard_issues)
        except Exception as e:
            print(f"❌ Dashboard 检查异常: {e}", flush=True)

        # 3. 代码质量检查
        try:
            code_issues = await self.check_code_quality()
            all_issues.extend(code_issues)
        except Exception as e:
            print(f"❌ 代码质量检查异常: {e}", flush=True)

        # 4. 日志检查
        try:
            log_issues = await self.check_logs()
            all_issues.extend(log_issues)
        except Exception as e:
            print(f"❌ 日志检查异常: {e}", flush=True)

        # 按优先级排序
        priority_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
        all_issues.sort(key=lambda x: priority_order.get(x.get('priority', 'P2'), 2))

        # 去重
        seen = {}
        unique_issues = []
        for issue in all_issues:
            key = f"{issue['type']}:{issue['title']}"
            if key not in seen:
                seen[key] = True
                unique_issues.append(issue)

        # 提交问题
        print(f"\n{'='*70}", flush=True)
        if unique_issues:
            print(f"📋 发现 {len(unique_issues)} 个问题和改进机会:\n", flush=True)
            submitted = 0
            for i, issue in enumerate(unique_issues, 1):
                type_emoji = {
                    'bug': '🐛', 'performance': '⚡', 'security': '🔒',
                    'ux': '🎨', 'feature': '✨', 'documentation': '📚',
                    'quality': '✅', 'architecture': '🏗️', 'testing': '🧪',
                    'stability': '📉'
                }.get(issue.get('type', 'bug'), '📌')

                print(f"  {i}. {type_emoji} [{issue['priority']}] {issue['title']}", flush=True)
                if await self.submit_issue(issue):
                    submitted += 1
            print(f"\n✅ 已提交 {submitted}/{len(unique_issues)} 个新问题到需求池", flush=True)
        else:
            print("✅ 未发现明显问题，项目运行良好", flush=True)

        print(f"{'='*70}", flush=True)
        print(f"⏰ 下次分析: {datetime.fromtimestamp(datetime.now().timestamp() + CHECK_INTERVAL).strftime('%H:%M:%S')}", flush=True)
        print(f"{'='*70}\n", flush=True)

    async def run(self):
        """持续运行"""
        print("""
╔═══════════════════════════════════════════════════════════╗
║     👁️  Product Observer Agent (AI-Powered)             ║
║                                                           ║
║     主动的产品分析与改进建议                               ║
╚═══════════════════════════════════════════════════════════╝

项目: {PROJECT_PATH}
API: {dashboard_api}
分析间隔: {CHECK_INTERVAL}s
AI 分析: 启用

观察内容:
  • AI 深度分析（代码质量、架构、功能、性能、安全）
  • Dashboard 健康检查
  • 代码质量检查
  • 日志错误分析
        """.format(
            PROJECT_PATH=PROJECT_PATH,
            dashboard_api=self.dashboard_api,
            CHECK_INTERVAL=CHECK_INTERVAL
        ), flush=True)

        # 启动 Claude Code 进程监控
        asyncio.create_task(self._monitor_claude_process())

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
        print("\n🛑 Product Observer Agent 停止\n", flush=True)
    except Exception as e:
        print(f"❌ Agent 异常: {e}", flush=True)
        raise


if __name__ == '__main__':
    asyncio.run(main())
