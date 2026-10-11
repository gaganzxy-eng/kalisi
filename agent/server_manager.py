"""
Kalisi SMP Hosting Panel — Server Process Manager

Manages the Minecraft Paper server lifecycle:
start, stop, restart, and health monitoring.

Captures stdout/stderr, tracks PID, and prevents
duplicate instances.
"""
import asyncio
import os
import signal
import time
import re
import shutil
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Callable

import psutil

from config import settings
from database import log_audit, record_metrics


class ServerState:
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    CRASHED = "crashed"


class ServerManager:
    def __init__(self):
        self.process: Optional[asyncio.subprocess.Process] = None
        self.state: str = ServerState.STOPPED
        self.pid: Optional[int] = None
        self.start_time: Optional[datetime] = None
        self.log_buffer: deque = deque(maxlen=settings.max_log_lines)
        self.log_callbacks: list[Callable] = []
        self._monitor_task: Optional[asyncio.Task] = None
        self._log_reader_stdout: Optional[asyncio.Task] = None
        self._log_reader_stderr: Optional[asyncio.Task] = None
        self._restart_count = 0
        self._crash_count = 0
        self._last_crash: Optional[datetime] = None

    def _detect_existing_process(self) -> Optional[int]:
        """
        Detect if a Minecraft server is already running on the configured port.
        Returns the PID if found, None otherwise.
        """
        try:
            for proc in psutil.process_iter(["pid", "name", "cmdline"]):
                try:
                    info = proc.info
                    cmdline = info.get("cmdline") or []
                    cmdline_str = " ".join(cmdline)
                    if (
                        "java" in (info.get("name") or "").lower()
                        and settings.server_jar in cmdline_str
                    ):
                        return info["pid"]
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception:
            pass

        # Also check port binding
        try:
            for conn in psutil.net_connections(kind="tcp"):
                if (
                    conn.laddr.port == settings.minecraft_port
                    and conn.status == "LISTEN"
                ):
                    return conn.pid
        except (psutil.AccessDenied, OSError):
            pass

        return None

    async def start(self) -> dict:
        """Start the Minecraft server."""
        # Check if already running
        if self.state in (ServerState.RUNNING, ServerState.STARTING):
            return {"success": False, "error": "Server is already running or starting"}

        # Detect externally-started server
        existing_pid = self._detect_existing_process()
        if existing_pid:
            self.state = ServerState.RUNNING
            self.pid = existing_pid
            return {
                "success": False,
                "error": f"Server is already running (PID {existing_pid}). It was started outside this panel. Stop it first to manage it through the panel.",
            }

        # Validate server JAR exists
        jar_path = settings.server_jar_path
        if not jar_path.exists():
            return {
                "success": False,
                "error": f"Server JAR not found: {jar_path}",
            }

        # Check EULA
        eula_path = settings.minecraft_path / "eula.txt"
        if eula_path.exists():
            eula_content = eula_path.read_text()
            if "eula=true" not in eula_content.lower():
                return {
                    "success": False,
                    "error": "EULA not accepted. Set eula=true in eula.txt",
                }

        self.state = ServerState.STARTING
        self.log_buffer.clear()

        try:
            java_args = settings.java_args.split()
            cmd = [
                settings.java_binary,
                *java_args,
                "-jar",
                settings.server_jar,
                "nogui",
            ]

            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE,
                cwd=str(settings.minecraft_path),
            )

            self.pid = self.process.pid
            self.start_time = datetime.now(timezone.utc)

            # Start log readers
            self._log_reader_stdout = asyncio.create_task(
                self._read_stream(self.process.stdout, "stdout")
            )
            self._log_reader_stderr = asyncio.create_task(
                self._read_stream(self.process.stderr, "stderr")
            )

            # Start monitor
            self._monitor_task = asyncio.create_task(self._monitor_process())

            log_audit("server_start", detail=f"PID {self.pid}")

            return {
                "success": True,
                "pid": self.pid,
                "message": "Server starting...",
            }

        except FileNotFoundError:
            self.state = ServerState.STOPPED
            return {
                "success": False,
                "error": f"Java binary not found: {settings.java_binary}",
            }
        except Exception as e:
            self.state = ServerState.STOPPED
            log_audit("server_start", detail=str(e), result="failure")
            return {"success": False, "error": str(e)}

    async def stop(self, timeout: int = 30) -> dict:
        """Gracefully stop the server by sending the 'stop' command."""
        if self.state == ServerState.STOPPED:
            return {"success": False, "error": "Server is not running"}

        if self.state == ServerState.STOPPING:
            return {"success": False, "error": "Server is already stopping"}

        self.state = ServerState.STOPPING

        try:
            # Send the Minecraft stop command
            if self.process and self.process.stdin:
                self.process.stdin.write(b"stop\n")
                await self.process.stdin.drain()

            # Wait for graceful shutdown
            if self.process:
                try:
                    await asyncio.wait_for(self.process.wait(), timeout=timeout)
                except asyncio.TimeoutError:
                    # Force kill if graceful shutdown fails
                    self.process.kill()
                    await self.process.wait()
                    log_audit("server_stop", detail="Force killed after timeout")

            self.state = ServerState.STOPPED
            self.pid = None
            self.start_time = None

            log_audit("server_stop")
            return {"success": True, "message": "Server stopped"}

        except Exception as e:
            self.state = ServerState.CRASHED
            log_audit("server_stop", detail=str(e), result="failure")
            return {"success": False, "error": str(e)}

    async def restart(self) -> dict:
        """Restart the server: stop then start."""
        if self.state in (ServerState.RUNNING, ServerState.STARTING):
            stop_result = await self.stop()
            if not stop_result["success"]:
                return stop_result

        # Brief pause between stop and start
        await asyncio.sleep(2)

        result = await self.start()
        if result["success"]:
            self._restart_count += 1
            log_audit("server_restart")
        return result

    async def send_command(self, command: str) -> dict:
        """Send a command to the Minecraft server stdin."""
        if self.state != ServerState.RUNNING or not self.process or not self.process.stdin:
            return {"success": False, "error": "Server is not running"}

        # Security: Block dangerous commands
        cmd_lower = command.strip().lower()
        blocked_prefixes = ["op ", "deop ", "stop", "ban ", "ban-ip "]

        # These need special handling through dedicated endpoints
        is_sensitive = any(cmd_lower.startswith(p) for p in blocked_prefixes)

        try:
            self.process.stdin.write((command.strip() + "\n").encode())
            await self.process.stdin.drain()

            timestamp = datetime.now(timezone.utc).isoformat()
            log_entry = f"[{timestamp}] [PANEL] > {command}"
            self.log_buffer.append(log_entry)
            self._notify_log(log_entry)

            log_audit("console_command", detail=command)

            return {
                "success": True,
                "message": "Command sent",
                "command": command,
                "sensitive": is_sensitive,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def send_privileged_command(self, command: str, admin: str = "admin") -> dict:
        """
        Send a privileged command (op, ban, etc.) with logging.
        Must be called through dedicated moderation/permission endpoints.
        """
        if self.state != ServerState.RUNNING or not self.process or not self.process.stdin:
            return {"success": False, "error": "Server is not running"}

        try:
            self.process.stdin.write((command.strip() + "\n").encode())
            await self.process.stdin.drain()

            timestamp = datetime.now(timezone.utc).isoformat()
            log_entry = f"[{timestamp}] [PANEL/ADMIN] > {command}"
            self.log_buffer.append(log_entry)
            self._notify_log(log_entry)

            log_audit("privileged_command", admin=admin, detail=command)

            return {"success": True, "message": "Command sent", "command": command}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_logs(self, lines: int = 200) -> list[str]:
        """Get recent log lines."""
        return list(self.log_buffer)[-lines:]

    def get_status(self) -> dict:
        """Get server status information."""
        uptime = None
        if self.start_time:
            delta = datetime.now(timezone.utc) - self.start_time
            uptime = int(delta.total_seconds())

        return {
            "state": self.state,
            "pid": self.pid,
            "uptime_seconds": uptime,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "restart_count": self._restart_count,
            "crash_count": self._crash_count,
            "last_crash": self._last_crash.isoformat() if self._last_crash else None,
            "log_lines": len(self.log_buffer),
        }

    def register_log_callback(self, callback: Callable):
        """Register a callback for new log lines."""
        self.log_callbacks.append(callback)

    def unregister_log_callback(self, callback: Callable):
        """Unregister a log callback."""
        if callback in self.log_callbacks:
            self.log_callbacks.remove(callback)

    def _notify_log(self, line: str):
        """Notify all registered log callbacks."""
        for cb in self.log_callbacks:
            try:
                cb(line)
            except Exception:
                pass

    async def _read_stream(self, stream, name: str):
        """Read from stdout/stderr and buffer lines."""
        try:
            while True:
                line = await stream.readline()
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace").rstrip()
                if decoded:
                    self.log_buffer.append(decoded)
                    self._notify_log(decoded)

                    # Detect server ready
                    if "Done" in decoded and "For help" in decoded:
                        self.state = ServerState.RUNNING

        except Exception:
            pass

    async def _monitor_process(self):
        """Monitor the server process and detect crashes."""
        try:
            if self.process:
                exit_code = await self.process.wait()

                if self.state == ServerState.STOPPING:
                    self.state = ServerState.STOPPED
                else:
                    self.state = ServerState.CRASHED
                    self._crash_count += 1
                    self._last_crash = datetime.now(timezone.utc)
                    log_audit(
                        "server_crash",
                        detail=f"Exit code: {exit_code}",
                        result="failure",
                    )

                self.pid = None
        except asyncio.CancelledError:
            pass

    async def check_health(self) -> dict:
        """Check if the server process is alive and healthy."""
        if self.pid:
            try:
                proc = psutil.Process(self.pid)
                if proc.is_running():
                    mem = proc.memory_info()
                    return {
                        "healthy": True,
                        "pid": self.pid,
                        "cpu_percent": proc.cpu_percent(interval=0.5),
                        "memory_mb": round(mem.rss / (1024 * 1024), 1),
                        "status": proc.status(),
                    }
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        # Re-detect
        existing = self._detect_existing_process()
        if existing:
            self.pid = existing
            self.state = ServerState.RUNNING
            return {"healthy": True, "pid": existing, "externally_managed": True}

        if self.state == ServerState.RUNNING:
            self.state = ServerState.CRASHED
            self._crash_count += 1

        return {"healthy": False, "state": self.state}


# Singleton
server_manager = ServerManager()
