"""
Kalisi SMP Hosting Panel — Metrics Collector

Gathers real system metrics from the phone:
CPU, RAM, disk, Java process status.
Lightweight and suitable for mobile devices.
"""
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional

import psutil

from config import settings
from database import record_metrics
from server_manager import server_manager


class MetricsCollector:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._latest: dict = {}
        self._peak_players: int = 0
        self._agent_start_time = datetime.now(timezone.utc)

    async def start(self):
        """Start periodic metrics collection."""
        self._task = asyncio.create_task(self._collect_loop())

    async def stop(self):
        """Stop metrics collection."""
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def get_latest(self) -> dict:
        """Get the most recent metrics snapshot."""
        return self._latest.copy()

    def get_agent_uptime(self) -> int:
        """Agent uptime in seconds."""
        return int((datetime.now(timezone.utc) - self._agent_start_time).total_seconds())

    async def collect_once(self) -> dict:
        """Collect all metrics once."""
        metrics = {}

        # CPU
        try:
            metrics["cpu_percent"] = psutil.cpu_percent(interval=1)
            metrics["cpu_count"] = psutil.cpu_count()
        except Exception:
            metrics["cpu_percent"] = None
            metrics["cpu_count"] = None

        # RAM
        try:
            mem = psutil.virtual_memory()
            metrics["ram_used_mb"] = round(mem.used / (1024 * 1024), 1)
            metrics["ram_total_mb"] = round(mem.total / (1024 * 1024), 1)
            metrics["ram_percent"] = mem.percent
        except Exception:
            metrics["ram_used_mb"] = None
            metrics["ram_total_mb"] = None
            metrics["ram_percent"] = None

        # Disk
        try:
            disk = psutil.disk_usage(str(settings.minecraft_path))
            metrics["disk_used_gb"] = round(disk.used / (1024 ** 3), 2)
            metrics["disk_total_gb"] = round(disk.total / (1024 ** 3), 2)
            metrics["disk_free_gb"] = round(disk.free / (1024 ** 3), 2)
            metrics["disk_percent"] = disk.percent
        except Exception:
            metrics["disk_used_gb"] = None
            metrics["disk_total_gb"] = None
            metrics["disk_free_gb"] = None
            metrics["disk_percent"] = None

        # Java / Minecraft process
        java_metrics = self._get_java_metrics()
        metrics.update(java_metrics)

        # Server status
        status = server_manager.get_status()
        metrics["server_state"] = status["state"]
        metrics["server_uptime"] = status["uptime_seconds"]
        metrics["restart_count"] = status["restart_count"]
        metrics["crash_count"] = status["crash_count"]

        # Agent info
        metrics["agent_uptime"] = self.get_agent_uptime()
        metrics["peak_players"] = self._peak_players
        metrics["timestamp"] = datetime.now(timezone.utc).isoformat()

        self._latest = metrics
        return metrics

    def _get_java_metrics(self) -> dict:
        """Get Minecraft Java process metrics."""
        result = {
            "java_running": False,
            "java_pid": None,
            "java_cpu_percent": None,
            "java_memory_mb": None,
            "java_threads": None,
        }

        pid = server_manager.pid
        if not pid:
            return result

        try:
            proc = psutil.Process(pid)
            if proc.is_running():
                result["java_running"] = True
                result["java_pid"] = pid
                result["java_cpu_percent"] = proc.cpu_percent(interval=0.5)
                mem = proc.memory_info()
                result["java_memory_mb"] = round(mem.rss / (1024 * 1024), 1)
                result["java_threads"] = proc.num_threads()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

        return result

    async def _collect_loop(self):
        """Periodically collect and store metrics."""
        while True:
            try:
                metrics = await self.collect_once()

                # Record to database (sampled — not every tick)
                record_metrics(
                    cpu=metrics.get("cpu_percent"),
                    ram_used=metrics.get("ram_used_mb"),
                    ram_total=metrics.get("ram_total_mb"),
                    disk_used=metrics.get("disk_used_gb"),
                    disk_total=metrics.get("disk_total_gb"),
                    players=metrics.get("player_count"),
                    tps=metrics.get("tps"),
                    mspt=metrics.get("mspt"),
                    java_running=metrics.get("java_running", False),
                )

            except Exception:
                pass

            await asyncio.sleep(settings.metrics_interval)


# Singleton
metrics_collector = MetricsCollector()
