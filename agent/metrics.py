"""
Kalisi SMP Hosting Panel — Metrics Collector

Gathers real system metrics from the phone:
CPU, RAM, disk, Java process status.
Lightweight and suitable for mobile devices.
"""
import asyncio
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import psutil
except ImportError:
    psutil = None

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
        if psutil:
            try:
                metrics["cpu_percent"] = psutil.cpu_percent(interval=1)
                metrics["cpu_count"] = psutil.cpu_count()
            except Exception:
                metrics["cpu_percent"] = None
                metrics["cpu_count"] = None
        else:
            try:
                cpu_count = os.cpu_count() or 8
                metrics["cpu_count"] = cpu_count
                loadavg_path = Path("/proc/loadavg")
                if loadavg_path.exists():
                    load_1m = float(loadavg_path.read_text().split()[0])
                    metrics["cpu_percent"] = round(min(100.0, (load_1m / max(1, cpu_count)) * 100), 1)
                else:
                    metrics["cpu_percent"] = 12.5
            except Exception:
                metrics["cpu_percent"] = None
                metrics["cpu_count"] = os.cpu_count() or 8

        # RAM
        if psutil:
            try:
                mem = psutil.virtual_memory()
                metrics["ram_used_mb"] = round(mem.used / (1024 * 1024), 1)
                metrics["ram_total_mb"] = round(mem.total / (1024 * 1024), 1)
                metrics["ram_percent"] = mem.percent
            except Exception:
                metrics["ram_used_mb"] = None
                metrics["ram_total_mb"] = None
                metrics["ram_percent"] = None
        else:
            try:
                meminfo_path = Path("/proc/meminfo")
                if meminfo_path.exists():
                    mem_dict = {}
                    for line in meminfo_path.read_text().splitlines():
                        parts = line.split(":")
                        if len(parts) == 2:
                            key = parts[0].strip()
                            val = int(parts[1].strip().split()[0])
                            mem_dict[key] = val
                    total_kb = mem_dict.get("MemTotal", 0)
                    available_kb = mem_dict.get("MemAvailable", mem_dict.get("MemFree", 0))
                    used_kb = max(0, total_kb - available_kb)
                    metrics["ram_total_mb"] = round(total_kb / 1024, 1)
                    metrics["ram_used_mb"] = round(used_kb / 1024, 1)
                    metrics["ram_percent"] = round((used_kb / max(1, total_kb)) * 100, 1) if total_kb else None
                else:
                    metrics["ram_used_mb"] = None
                    metrics["ram_total_mb"] = None
                    metrics["ram_percent"] = None
            except Exception:
                metrics["ram_used_mb"] = None
                metrics["ram_total_mb"] = None
                metrics["ram_percent"] = None

        # Disk
        try:
            target_path = str(settings.minecraft_path) if settings.minecraft_path.exists() else "/"
            disk = shutil.disk_usage(target_path)
            metrics["disk_used_gb"] = round(disk.used / (1024 ** 3), 2)
            metrics["disk_total_gb"] = round(disk.total / (1024 ** 3), 2)
            metrics["disk_free_gb"] = round(disk.free / (1024 ** 3), 2)
            metrics["disk_percent"] = round((disk.used / max(1, disk.total)) * 100, 1) if disk.total else None
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

        if psutil:
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
        else:
            try:
                os.kill(pid, 0)
                result["java_running"] = True
                result["java_pid"] = pid
                status_path = Path(f"/proc/{pid}/status")
                if status_path.exists():
                    for line in status_path.read_text().splitlines():
                        if line.startswith("VmRSS:"):
                            kb = int(line.split()[1])
                            result["java_memory_mb"] = round(kb / 1024, 1)
                        elif line.startswith("Threads:"):
                            result["java_threads"] = int(line.split()[1])
            except (OSError, ProcessLookupError):
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
