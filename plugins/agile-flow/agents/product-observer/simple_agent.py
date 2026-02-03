#!/usr/bin/env python3
"""
Product Observer - 产品观察者 Agent

持续运行，主动发现问题、提出改进建议
"""

import os
import sys
import asyncio
import httpx
import json
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

# Agent SDK 导入
try:
    from claude_agent_sdk import query, ClaudeAgentOptions
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False
    print("⚠️  Agent SDK 未安装，将使用基础观察模式", flush=True)

# 配置
ANALYSIS_INTERVAL = 120  # 分析间隔（秒）
AI_DOCS_PATH = os.environ.get('AI_DOCS_PATH', '')
PROJECT_PATH = str(Path(AI_DOCS_PATH).parent) if AI_DOCS_PATH else ''

# 启动时输出环境变量（用于调试）
print(f"[DEBUG] AI_DOCS_PATH = {AI_DOCS_PATH}", flush=True)
print(f"[DEBUG] PROJECT_PATH = {PROJECT_PATH}", flush=True)
print(f"[DEBUG] SDK_AVAILABLE = {SDK_AVAILABLE}", flush=True)

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
    return 3737


def get_dashboard_api() -> str:
    """获取 Dashboard API 地址"""
    port = get_dashboard_port()
    return f'http://127.0.0.1:{port}'


class ProductObserverAgent:
    """产品观察者 Agent - 主动发现问题和需求"""

    def __init__(self):
        """初始化"""
        if not AI_DOCS_PATH:
            raise ValueError("AI_DOCS_PATH 环境变量未设置")
        if not PROJECT_PATH or not Path(PROJECT_PATH).exists():
            raise ValueError(f"项目路径不存在: {PROJECT_PATH}")

        # 增加超时时间，避免网络问题
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
        self.dashboard_api = get_dashboard_api()
        self.project_context = ""
        self.last_analysis_time = None

    async def collect_project_context(self) -> str:
        """收集项目上下文信息"""
        context_parts = []

        # 1. 项目基本信息
        context_parts.append(f"# 项目信息\n")
        context_parts.append(f"路径: {PROJECT_PATH}\n")
        context_parts.append(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        # 2. 读取项目文档
        docs_to_read = ['README.md', 'CLAUDE.md', 'ai-docs/CONTEXT.md', 'ai-docs/API.md']
        for doc_name in docs_to_read:
            doc_path = Path(PROJECT_PATH) / doc_name
            if doc_path.exists():
                try:
                    content = doc_path.read_text(encoding='utf-8')[:2000]  # 限制长度
                    context_parts.append(f"\n## {doc_name}\n{content}\n")
                except Exception as e:
                    context_parts.append(f"\n## {doc_name}\n读取失败: {e}\n")

        # 3. 当前任务状态
        tasks_file = Path(AI_DOCS_PATH) / 'TASKS.json'
        if tasks_file.exists():
            try:
                with open(tasks_file, 'r', encoding='utf-8') as f:
                    tasks_data = json.load(f)
                tasks = tasks_data.get('tasks', [])

                context_parts.append(f"\n## 当前任务\n")
                status_count = {}
                for task in tasks:
                    status = task.get('status', 'unknown')
                    status_count[status] = status_count.get(status, 0) + 1

                context_parts.append(f"总任务数: {len(tasks)}\n")
                context_parts.append(f"状态分布: {status_count}\n")

                # 列出进行中和待测试的任务
                active_tasks = [t for t in tasks if t.get('status') in ['inProgress', 'testing', 'pending']]
                if active_tasks:
                    context_parts.append(f"\n活跃任务 ({len(active_tasks)}):\n")
                    for task in active_tasks[:5]:  # 最多显示5个
                        context_parts.append(f"- [{task.get('id', 'N/A')}] {task.get('description', 'N/A')[:80]}\n")
            except Exception as e:
                context_parts.append(f"\n## 任务读取失败\n{e}\n")

        # 4. 最近日志（如果有错误）
        server_log = Path(AI_DOCS_PATH) / '.logs' / 'server.log'
        if server_log.exists():
            try:
                log_content = server_log.read_text(encoding='utf-8')[-1000:]
                if 'error' in log_content.lower():
                    context_parts.append(f"\n## 最近日志（包含错误）\n{log_content}\n")
            except Exception:
                pass

        return "\n".join(context_parts)

    async def run_tests(self) -> Dict[str, Any]:
        """运行测试并收集结果"""
        test_results = {
            'unit_tests': None,
            'coverage': None,
            'errors': [],
            'summary': ''
        }

        print("  🧪 运行测试套件...", flush=True)

        # 1. 单元测试
        try:
            result = subprocess.run(
                ['python', '-m', 'pytest', '-v', '--tb=line', '--cov=.'],
                cwd=PROJECT_PATH,
                capture_output=True,
                text=True,
                timeout=300
            )

            output = result.stdout + result.stderr
            test_results['summary'] = output[-500:]  # 保存最后500字符

            # 分析结果
            if 'passed' in output:
                import re
                passed_match = re.search(r'(\d+) passed', output)
                if passed_match:
                    test_results['unit_tests'] = {
                        'passed': int(passed_match.group(1)),
                        'success': True
                    }

            if 'FAILED' in output:
                failed_match = re.search(r'(\d+) failed', output)
                if failed_match:
                    test_results['unit_tests'] = {
                        'passed': test_results['unit_tests'].get('passed', 0) if test_results['unit_tests'] else 0,
                        'failed': int(failed_match.group(1)),
                        'success': False
                    }
                    test_results['errors'].append(f"单元测试失败: {failed_match.group(1)} 个")

            # 覆盖率
            cov_match = re.search(r'(\d+)%', output)
            if cov_match:
                test_results['coverage'] = int(cov_match.group(1))

        except FileNotFoundError:
            print("    ⚠️  pytest 未安装", flush=True)
        except subprocess.TimeoutExpired:
            test_results['errors'].append("测试超时（超过5分钟）")
        except Exception as e:
            test_results['errors'].append(f"测试执行异常: {e}")

        return test_results

    async def analyze_with_claude(self, context: str, test_results: Dict) -> List[Dict]:
        """使用 Claude 分析项目并提出改进建议"""
        if not SDK_AVAILABLE:
            return []

        print("  🤖 AI 分析中...", flush=True)

        issues = []

        try:
            # 简化提示，减少 token 使用
            prompt = f"""分析项目并找出问题。项目路径: {PROJECT_PATH}

任务状态: {context.count('任务')} 个任务
测试结果: 通过 {test_results['unit_tests'].get('passed', 0) if test_results['unit_tests'] else 0} 个测试
覆盖率: {test_results.get('coverage', 'N/A')}%

输出 JSON 格式的问题列表:
[
  {{"type": "bug|performance|security|ux|feature|documentation|quality", "priority": "P0|P1|P2|P3", "title": "简短标题", "description": "详细描述"}},
  ...
]

没有问题则返回 []。"""

            # 调用 Claude SDK（添加超时控制）
            result_text = ""
            try:
                async for message in query(
                    prompt=prompt,
                    options=ClaudeAgentOptions(
                        model="claude-sonnet-4-5-20250929"
                    )
                ):
                    if hasattr(message, 'result') and message.result:
                        result_text = str(message.result)
                        break
                    elif hasattr(message, 'content') and message.content:
                        for block in message.content:
                            if hasattr(block, 'text'):
                                result_text = block.text
                                break
                        if result_text:
                            break
            except asyncio.TimeoutError:
                print("    ⚠️  AI 分析超时，使用基础分析", flush=True)
                return []
            except Exception as e:
                print(f"    ⚠️  AI SDK 调用失败: {e}，使用基础分析", flush=True)
                return []

            # 解析结果
            if result_text:
                try:
                    # 提取 JSON
                    import re
                    json_match = re.search(r'\[.*\]', result_text, re.DOTALL)
                    if json_match:
                        issues_json = json_match.group(0)
                        issues = json.loads(issues_json)
                        print(f"    ✓ AI 发现 {len(issues)} 个问题", flush=True)
                except json.JSONDecodeError as e:
                    print(f"    ⚠️  AI 返回格式错误: {e}", flush=True)

        except Exception as e:
            print(f"    ❌ AI 分析异常: {e}", flush=True)

        return issues

    async def analyze_basic(self, context: str, test_results: Dict) -> List[Dict]:
        """基础分析（无 SDK 时使用）"""
        issues = []

        # 1. 测试失败
        if test_results['errors']:
            for error in test_results['errors']:
                issues.append({
                    'type': 'testing',
                    'priority': 'P1',
                    'title': f'测试错误: {error}',
                    'description': f'测试过程中发现错误: {error}'
                })

        # 2. 覆盖率不足
        if test_results['coverage'] and test_results['coverage'] < 80:
            issues.append({
                'type': 'quality',
                'priority': 'P2',
                'title': f'测试覆盖率不足 ({test_results["coverage"]}%)',
                'description': f'当前覆盖率 {test_results["coverage"]}%，建议达到 80% 以上'
            })

        # 3. 日志错误
        if 'error' in context.lower():
            issues.append({
                'type': 'stability',
                'priority': 'P1',
                'title': '日志中发现错误',
                'description': '项目日志中存在错误信息，需要排查处理'
            })

        return issues

    async def submit_issue(self, issue: Dict) -> bool:
        """提交问题到需求池"""
        issue_key = f"{issue['type']}:{issue['title']}"

        # 去重
        if issue_key in submitted_issues:
            return False

        submitted_issues.add(issue_key)
        if len(submitted_issues) > MAX_ISSUE_MEMORY:
            submitted_issues.pop(next(iter(submitted_issues)))

        try:
            requirement_text = f"""[{issue['type'].upper()}] {issue['title']}

{issue['description']}

---
优先级: {issue['priority']}
发现时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
发现者: Product Observer AI"""

            response = await self.http_client.post(
                f'{self.dashboard_api}/api/requirement',
                json={'requirement': requirement_text}
            )

            if response.status_code == 200:
                print(f"    ✅ 已提交: [{issue['priority']}] {issue['title']}", flush=True)
                return True
            else:
                print(f"    ❌ 提交失败: {issue['title']}", flush=True)
                return False

        except Exception as e:
            print(f"    ❌ 提交异常: {e}", flush=True)
            return False

    async def analyze_once(self):
        """执行一次完整分析"""
        print(f"\n{'='*70}", flush=True)
        print(f"🔍 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 产品分析与测试", flush=True)
        print(f"{'='*70}\n", flush=True)

        # 1. 收集上下文
        print("📊 收集项目信息...", flush=True)
        context = await self.collect_project_context()

        # 2. 运行测试
        test_results = await self.run_tests()

        # 3. AI 分析
        print("\n🤖 AI 分析中...", flush=True)
        if SDK_AVAILABLE:
            issues = await self.analyze_with_claude(context, test_results)
        else:
            issues = await self.analyze_basic(context, test_results)

        # 4. 基础检查作为补充
        basic_issues = await self.analyze_basic(context, test_results)
        for basic_issue in basic_issues:
            if not any(i['title'] == basic_issue['title'] for i in issues):
                issues.append(basic_issue)

        # 5. 按优先级排序
        priority_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
        issues.sort(key=lambda x: priority_order.get(x.get('priority', 'P2'), 2))

        # 6. 提交问题
        print(f"\n{'='*70}", flush=True)
        if issues:
            print(f"📋 发现 {len(issues)} 个问题和改进机会:\n", flush=True)
            submitted = 0
            for i, issue in enumerate(issues, 1):
                print(f"  {i}. [{issue['priority']}] {issue['title']}", flush=True)
                if await self.submit_issue(issue):
                    submitted += 1
            print(f"\n✓ 已提交 {submitted} 个新问题到需求池", flush=True)
        else:
            print("✓ 未发现明显问题，项目运行良好", flush=True)

        print(f"{'='*70}", flush=True)
        print(f"⏰ 下次分析: {datetime.fromtimestamp(datetime.now().timestamp() + ANALYSIS_INTERVAL).strftime('%H:%M:%S')}", flush=True)
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
分析间隔: {ANALYSIS_INTERVAL}s
AI 分析: {SDK_AVAILABLE}

工作内容:
  • 持续运行测试（单元测试、覆盖率）
  • AI 分析项目状态
  • 主动发现问题和风险
  • 提出改进建议和新需求
  • 自动提交到需求池
        """.format(
            PROJECT_PATH=PROJECT_PATH,
            dashboard_api=self.dashboard_api,
            ANALYSIS_INTERVAL=ANALYSIS_INTERVAL,
            SDK_AVAILABLE="启用" if SDK_AVAILABLE else "禁用（使用基础模式）"
        ), flush=True)

        # 立即执行一次
        await self.analyze_once()

        # 持续运行
        while True:
            await asyncio.sleep(ANALYSIS_INTERVAL)
            await self.analyze_once()


async def main():
    """主入口"""
    agent = None
    try:
        agent = ProductObserverAgent()
        await agent.run()
    except ValueError as e:
        print(f"❌ 配置错误: {e}", flush=True)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Product Observer Agent 停止\n", flush=True)
    except Exception as e:
        print(f"❌ Agent 异常: {e}", flush=True)
        import traceback
        traceback.print_exc()
        # 即使出错也尝试继续运行
        if agent:
            print("\n⚠️  Agent 将在 30 秒后重启...", flush=True)
            await asyncio.sleep(30)
            # 重新启动
            await main()
        else:
            sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
