#!/usr/bin/env python3
"""
并行任务执行器

支持智能分组、依赖分析、文件冲突检测
"""

import os
import json
import asyncio
import hashlib
import fcntl
from pathlib import Path
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass


@dataclass
class Task:
    """任务数据结构"""
    id: str
    description: str
    priority: str
    status: str
    dependencies: List[str] = None
    files: List[str] = None

    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.files is None:
            self.files = []


class TaskDependencyAnalyzer:
    """任务依赖分析器"""

    def __init__(self, project_path: str):
        self.project_path = Path(project_path)

    def analyze_dependencies(self, tasks: List[Task]) -> Dict[str, List[str]]:
        """分析任务依赖关系"""
        graph = {}

        # 先构建 ID 到任务的映射
        task_map = {t.id: t for t in tasks}

        for task in tasks:
            deps = []

            # 1. 使用任务中明确的 dependencies 字段
            if task.dependencies:
                for dep_id in task.dependencies:
                    if dep_id in task_map:
                        deps.append(dep_id)

            # 2. 分析模块依赖（用户任务依赖认证任务等）
            for other in tasks:
                if task.id == other.id:
                    continue

                # 如果不在明确依赖中，检查隐式依赖
                if other.id not in deps:
                    if self._check_module_dependency(task, other):
                        deps.append(other.id)

            graph[task.id] = deps

        return graph

    def _extract_apis(self, task: Task) -> Set[str]:
        """提取任务涉及的 API"""
        apis = set()
        desc = task.description.lower()

        # 常见 API 模式
        if 'api' in desc or 'endpoint' in desc:
            # 提取 /api/xxx 模式
            import re
            api_patterns = re.findall(r'/api/[a-zA-Z0-9/_-]+', desc)
            apis.update(api_patterns)

        # 检查任务标签
        if task.files:
            for file in task.files:
                if '/api/' in file:
                    # 从文件路径推断 API
                    parts = file.split('/api/')
                    if len(parts) > 1:
                        apis.add(f"/api/{parts[1].split('.')[0]}")

        return apis

    def _extract_modules(self, task: Task) -> Set[str]:
        """提取任务涉及的模块"""
        modules = set()
        if task.files:
            for file in task.files:
                # 提取一级目录作为模块
                parts = Path(file).parts
                if len(parts) > 1:
                    modules.add(parts[0])
        return modules

    def _check_module_dependency(self, task: Task, other: Task) -> bool:
        """检查模块依赖"""
        # 常见依赖规则
        task_lower = task.description.lower()
        other_lower = other.description.lower()

        # 用户功能依赖认证
        if 'user' in task_lower and 'auth' in other_lower:
            return True

        # 权限功能依赖用户
        if 'permission' in task_lower and 'user' in other_lower:
            return True

        # 数据分析功能依赖数据源
        if 'analysis' in task_lower and 'data' in other_lower:
            return True

        return False

    def get_parallel_groups(self, graph: Dict[str, List[str]]) -> List[List[str]]:
        """获取可并行的任务组（拓扑排序 + 分层）"""
        groups = []
        remaining = graph.copy()

        while remaining:
            # 找出无依赖的任务
            ready = [task_id for task_id, deps in remaining.items() if not deps]

            if not ready:
                # 循环依赖，按优先级打破
                ready = [min(remaining.keys(), key=lambda x: self._get_priority(x))]

            groups.append(ready)

            # 移除已处理的任务
            for task_id in ready:
                del remaining[task_id]

            # 更新剩余任务的依赖
            for task_id in remaining:
                remaining[task_id] = [d for d in remaining[task_id] if d not in ready]

        return groups


class FileLockManager:
    """文件锁管理器"""

    def __init__(self, lock_dir: str = "/tmp/agile-flow-locks"):
        self.lock_dir = Path(lock_dir)
        self.lock_dir.mkdir(parents=True, exist_ok=True)
        self.locks: Dict[str, int] = {}

    def _get_lock_path(self, file_path: str) -> Path:
        """获取锁文件路径"""
        file_hash = hashlib.md5(file_path.encode()).hexdigest()
        return self.lock_dir / f"{file_hash}.lock"

    def acquire(self, file_path: str, timeout: float = 60.0) -> bool:
        """获取文件锁"""
        lock_path = self._get_lock_path(file_path)

        import time
        start = time.time()

        while True:
            try:
                fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                self.locks[file_path] = fd
                return True
            except FileExistsError:
                if time.time() - start > timeout:
                    return False
                time.sleep(0.5)

    def release(self, file_path: str):
        """释放文件锁"""
        if file_path in self.locks:
            os.close(self.locks[file_path])
            del self.locks[file_path]

        lock_path = self._get_lock_path(file_path)
        if lock_path.exists():
            lock_path.unlink()

    def release_all(self):
        """释放所有锁"""
        for file_path in list(self.locks.keys()):
            self.release(file_path)


class PortPool:
    """端口池管理器"""

    def __init__(self, start: int = 3000, count: int = 10):
        self.start = start
        self.count = count
        self.ports: Set[int] = set()

    def allocate(self, count: int = 1) -> List[int]:
        """分配端口"""
        allocated = []
        for i in range(self.count):
            port = self.start + i
            if port not in self.ports:
                self.ports.add(port)
                allocated.append(port)
                if len(allocated) >= count:
                    break
        return allocated

    def release(self, ports: List[int]):
        """释放端口"""
        for port in ports:
            self.ports.discard(port)


class ParallelTaskExecutor:
    """并行任务执行器"""

    def __init__(self, project_path: str, max_parallel: int = 3):
        self.project_path = Path(project_path)
        self.max_parallel = max_parallel
        self.analyzer = TaskDependencyAnalyzer(str(project_path))
        self.file_locks = FileLockManager()
        self.port_pool = PortPool(start=3000, count=10)

    def check_file_conflicts(self, tasks: List[Task]) -> List[Tuple[str, str, str]]:
        """检查文件冲突"""
        file_map: Dict[str, str] = {}
        conflicts = []

        for task in tasks:
            files = task.files or []
            for file in files:
                if file in file_map:
                    conflicts.append((file, file_map[file], task.id))
                else:
                    file_map[file] = task.id

        return conflicts

    async def execute_group(self, tasks: List[Task]) -> List[Dict]:
        """并行执行一组任务"""
        print(f"\n{'='*70}")
        print(f"🚀 并行执行 {len(tasks)} 个任务")
        print(f"{'='*70}\n")

        # 检查文件冲突
        conflicts = self.check_file_conflicts(tasks)
        if conflicts:
            print(f"⚠️  发现文件冲突:")
            for file, task1, task2 in conflicts:
                print(f"   {file}: {task1} vs {task2}")
            # 可以选择：1) 串行执行 2) 重新分组 3) 报错
            # 这里选择串行执行有冲突的任务
            return await self._execute_with_conflicts(tasks, conflicts)

        # 分配端口
        ports = self.port_pool.allocate(len(tasks))

        # 获取文件锁
        for task in tasks:
            if task.files:
                for file in task.files:
                    self.file_locks.acquire(file)

        try:
            # 并行执行
            results = await asyncio.gather(*[
                self._execute_task(task, ports[i] if i < len(ports) else None)
                for i, task in enumerate(tasks)
            ])
            return results
        finally:
            # 释放锁
            for task in tasks:
                if task.files:
                    for file in task.files:
                        self.file_locks.release(file)
            # 释放端口
            self.port_pool.release(ports)

    async def _execute_with_conflicts(self, tasks: List[Task], conflicts: List) -> List[Dict]:
        """处理有冲突的任务"""
        # 简单策略：串行执行有冲突的任务
        results = []
        executed = set()

        for task in tasks:
            # 检查是否与已执行的任务冲突
            has_conflict = False
            for file, task1, task2 in conflicts:
                if task.id == task2 and task1 in executed:
                    has_conflict = True
                    break

            if has_conflict:
                print(f"⏳ 任务 {task.id} 有冲突，串行执行")
                # 串行执行（等待）
                result = await self._execute_task(task, None)
                results.append(result)
            else:
                results.append(None)  # 占位

            executed.add(task.id)

        return results

    async def _execute_task(self, task: Task, port: int = None) -> Dict:
        """执行单个任务（由子类实现）"""
        # 这里是接口，实际实现在流程引擎中
        print(f"  🔧 执行任务: {task.id} - {task.description[:50]}")
        if port:
            print(f"     端口: {port}")

        # 模拟执行
        await asyncio.sleep(1)

        return {
            "task_id": task.id,
            "status": "completed",
            "port": port
        }

    async def execute_parallel_flow(self, tasks: List[Task]):
        """执行完整的并行流程"""
        # 分析依赖
        graph = self.analyzer.analyze_dependencies(tasks)

        print("\n📊 任务依赖图:")
        for task_id, deps in graph.items():
            if deps:
                print(f"  {task_id} → {', '.join(deps)}")
            else:
                print(f"  {task_id} (无依赖)")

        # 获取并行组
        groups = self.analyzer.get_parallel_groups(graph)

        print(f"\n🎯 并行执行计划 (共 {len(groups)} 组):")
        for i, group in enumerate(groups, 1):
            print(f"  第 {i} 组: {', '.join(group)}")

        # 执行每组
        all_results = []
        for i, group_ids in enumerate(groups, 1):
            group_tasks = [t for t in tasks if t.id in group_ids]

            # 限制并行度
            for j in range(0, len(group_tasks), self.max_parallel):
                batch = group_tasks[j:j + self.max_parallel]
                results = await self.execute_group(batch)
                all_results.extend(results)

        return all_results


# 测试代码
if __name__ == "__main__":
    # 创建测试任务（包含依赖关系）
    tasks = [
        Task("TASK-001", "实现用户认证", "P1", "pending", [], ["src/auth/login.py"]),
        Task("TASK-002", "实现用户管理", "P1", "pending", ["TASK-001"], ["src/api/users.py"]),
        Task("TASK-003", "实现股票数据 API", "P1", "pending", [], ["src/api/stocks.py"]),
        Task("TASK-004", "实现报告生成", "P2", "pending", [], ["src/services/report.py"]),
        Task("TASK-005", "实现权限管理", "P2", "pending", ["TASK-002"], ["src/api/permissions.py"]),
    ]

    async def test():
        executor = ParallelTaskExecutor("/tmp/test", max_parallel=3)
        await executor.execute_parallel_flow(tasks)

        print("\n" + "="*70)
        print("✅ 测试完成")
        print("="*70)
        print("\n说明：")
        print("  - 第1组: TASK-001, TASK-003, TASK-004 (无依赖，可并行)")
        print("  - 第2组: TASK-002 (依赖 TASK-001)")
        print("  - 第3组: TASK-005 (依赖 TASK-002)")

    asyncio.run(test())
