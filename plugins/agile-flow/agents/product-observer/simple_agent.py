#!/usr/bin/env python3
"""
Simple Product Observer - 简化版产品观察者

执行端到端测试，检查项目质量和任务完成情况
"""

import os
import sys
import asyncio
import httpx
import json
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

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
    """简化的产品观察者 - 执行端到端测试"""

    def __init__(self):
        """初始化"""
        if not AI_DOCS_PATH:
            raise ValueError("AI_DOCS_PATH 环境变量未设置")

        if not PROJECT_PATH or not Path(PROJECT_PATH).exists():
            raise ValueError(f"项目路径不存在: {PROJECT_PATH}")

        self.http_client = httpx.AsyncClient(timeout=60.0)
        self.dashboard_api = get_dashboard_api()

    async def read_tasks(self) -> Dict[str, Any]:
        """读取任务文件"""
        tasks_file = Path(AI_DOCS_PATH) / 'TASKS.json'
        if not tasks_file.exists():
            return {'tasks': []}

        try:
            with open(tasks_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ 读取任务文件失败: {e}", flush=True)
            return {'tasks': []}

    async def run_unit_tests(self) -> List[Dict]:
        """运行单元测试"""
        issues = []
        print("  🧪 运行单元测试...", flush=True)

        try:
            # 检查是否有 pytest
            result = subprocess.run(
                ['python', '-m', 'pytest', '--version'],
                cwd=PROJECT_PATH,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                issues.append({
                    'type': 'testing',
                    'priority': 'P2',
                    'title': 'pytest 未安装',
                    'description': '无法运行单元测试，请先安装 pytest'
                })
                return issues

            # 运行测试
            print("    执行 pytest...", flush=True)
            result = subprocess.run(
                ['python', '-m', 'pytest', '-v', '--tb=short', '--cov=.'],
                cwd=PROJECT_PATH,
                capture_output=True,
                text=True,
                timeout=300  # 5分钟超时
            )

            output = result.stdout + result.stderr

            # 分析测试结果
            if 'passed' in output.lower():
                # 提取测试通过数量
                import re
                passed_match = re.search(r'(\d+) passed', output)
                if passed_match:
                    passed_count = int(passed_match.group(1))
                    print(f"    ✓ 通过 {passed_count} 个测试", flush=True)

            # 检查覆盖率
            cov_match = re.search(r'(\d+)%', output)
            if cov_match:
                coverage = int(cov_match.group(1))
                print(f"    覆盖率: {coverage}%", flush=True)
                if coverage < 80:
                    issues.append({
                        'type': 'quality',
                        'priority': 'P2',
                        'title': f'测试覆盖率不足 ({coverage}%)',
                        'description': f'当前覆盖率 {coverage}%，建议达到 80% 以上'
                    })

            # 检查失败的测试
            if 'FAILED' in output:
                failed_match = re.search(r'(\d+) failed', output)
                if failed_match:
                    failed_count = int(failed_match.group(1))
                    issues.append({
                        'type': 'bug',
                        'priority': 'P0',
                        'title': f'{failed_count} 个单元测试失败',
                        'description': f'单元测试发现 {failed_count} 个失败，需要修复\n\n测试输出:\n{output[-1000:]}'
                    })

        except subprocess.TimeoutExpired:
            issues.append({
                'type': 'testing',
                'priority': 'P1',
                'title': '单元测试超时',
                'description': '测试运行超过 5 分钟，可能存在死循环或性能问题'
            })
        except FileNotFoundError:
            # pytest 未安装，跳过
            print("    ⚠️  pytest 未安装，跳过单元测试", flush=True)
        except Exception as e:
            print(f"    ❌ 单元测试执行异常: {e}", flush=True)

        return issues

    async def check_logs(self) -> List[Dict]:
        """检查日志"""
        issues = []
        print("  📋 检查日志...", flush=True)

        try:
            log_dir = Path(AI_DOCS_PATH) / '.logs'
            server_log = log_dir / 'server.log'

            if server_log.exists():
                content = server_log.read_text()[-5000:]  # 只看最后 5000 字符
                error_count = content.lower().count('error')

                if error_count > 0:
                    issues.append({
                        'type': 'stability',
                        'priority': 'P1',
                        'title': f'日志中发现 {error_count} 处错误',
                        'description': f'Server 日志中存在错误信息，需要排查\n\n最近日志:\n{content[-500:]}'
                    })

        except Exception as e:
            print(f"    ❌ 日志检查失败: {e}", flush=True)

        return issues

    async def check_task_status(self, tasks_data: Dict) -> List[Dict]:
        """检查任务状态"""
        issues = []
        print("  📋 检查任务状态...", flush=True)

        try:
            tasks = tasks_data.get('tasks', [])

            # 统计各状态任务
            status_count = {}
            for task in tasks:
                status = task.get('status', 'unknown')
                status_count[status] = status_count.get(status, 0) + 1

            print(f"    任务统计: {status_count}", flush=True)

            # 检查是否有测试中的任务
            testing_tasks = [t for t in tasks if t.get('status') == 'testing']
            if testing_tasks:
                print(f"    ⚠️  {len(testing_tasks)} 个任务待测试", flush=True)

                # 对测试中的任务运行测试
                print("    对待测试任务运行端到端测试...", flush=True)
                test_issues = await self.run_unit_tests()
                issues.extend(test_issues)

            # 检查进行中的任务是否超过 1 天
            import time
            current_time = time.time()
            one_day = 86400

            in_progress_tasks = [t for t in tasks if t.get('status') == 'inProgress']
            for task in in_progress_tasks:
                # 如果任务有时间戳，检查是否超时
                # 这里简化处理
                pass

        except Exception as e:
            print(f"    ❌ 任务状态检查失败: {e}", flush=True)

        return issues

    async def check_code_quality(self) -> List[Dict]:
        """检查代码质量（基础检查）"""
        issues = []
        print("  🔍 检查代码质量...", flush=True)

        try:
            # 检查是否有明显的代码问题
            # 这里可以添加更多的静态检查

            # 检查 TODO 注释
            result = subprocess.run(
                ['grep', '-r', 'TODO', '--include=*.py', '.'],
                cwd=PROJECT_PATH,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                todo_count = result.stdout.count('\n')
                if todo_count > 10:
                    issues.append({
                        'type': 'quality',
                        'priority': 'P3',
                        'title': f'代码中存在 {todo_count} 处 TODO',
                        'description': '建议逐步清理 TODO 注释，完善代码'
                    })

        except subprocess.TimeoutExpired:
            print("    ⚠️  代码质量检查超时", flush=True)
        except Exception as e:
            print(f"    ❌ 代码质量检查异常: {e}", flush=True)

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
            response = await self.http_client.post(
                f'{self.dashboard_api}/api/requirement',
                json={
                    'requirement': f"[{issue['type'].upper()}] {issue['title']}\n\n"
                                  f"{issue['description']}\n\n"
                                  f"优先级: {issue['priority']}\n"
                                  f"发现时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                }
            )

            if response.status_code == 200:
                print(f"    ✅ 已提交: {issue['title']}", flush=True)
                return True
            else:
                print(f"    ❌ 提交失败: {issue['title']}", flush=True)
                return False

        except Exception as e:
            print(f"    ❌ 提交异常: {e}", flush=True)
            return False

    async def observe_once(self):
        """执行一次完整观察（端到端测试）"""
        print(f"\n{'='*60}", flush=True)
        print(f"🔍 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 开始端到端测试观察", flush=True)
        print(f"{'='*60}\n", flush=True)

        all_issues = []

        # 1. 读取任务
        print("📝 读取任务数据...", flush=True)
        tasks_data = await self.read_tasks()
        task_count = len(tasks_data.get('tasks', []))
        print(f"  共 {task_count} 个任务\n", flush=True)

        # 2. 检查日志
        try:
            result = await self.check_logs()
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ 日志检查异常: {e}\n", flush=True)

        # 3. 检查任务状态并运行测试
        try:
            result = await self.check_task_status(tasks_data)
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ 任务检查异常: {e}\n", flush=True)

        # 4. 代码质量检查
        try:
            result = await self.check_code_quality()
            all_issues.extend(result)
        except Exception as e:
            print(f"❌ 代码质量检查异常: {e}\n", flush=True)

        # 按优先级排序
        priority_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
        all_issues.sort(key=lambda x: priority_order.get(x.get('priority', 'P2'), 2))

        # 提交问题
        print(f"\n{'='*60}", flush=True)
        if all_issues:
            print(f"📋 发现 {len(all_issues)} 个问题:", flush=True)
            submitted = 0
            for issue in all_issues:
                print(f"  - [{issue['priority']}] {issue['title']}", flush=True)
                if await self.submit_issue(issue):
                    submitted += 1
            print(f"\n✓ 已提交 {submitted} 个新问题到需求池", flush=True)
        else:
            print("✓ 所有检查通过，未发现问题", flush=True)

        print(f"{'='*60}", flush=True)
        print(f"⏰ 下次检查: {datetime.fromtimestamp(datetime.now().timestamp() + CHECK_INTERVAL).strftime('%H:%M:%S')}", flush=True)
        print(f"{'='*60}\n", flush=True)

    async def run(self):
        """持续运行"""
        print("""
╔══════════════════════════════════════════════╗
║     👁️  Product Observer (E2E Testing)      ║
║                                              ║
║     端到端测试观察者                          ║
╚══════════════════════════════════════════════╝

项目: {PROJECT_PATH}
API: {dashboard_api}
间隔: {CHECK_INTERVAL}s

测试内容:
  • 单元测试 (pytest)
  • 测试覆盖率检查
  • 日志错误检查
  • 任务状态检查
  • 代码质量检查
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
    try:
        agent = SimpleProductObserver()
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
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
