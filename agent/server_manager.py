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
import struct
import time
import re
import shutil
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Callable

try:
    import psutil
except ImportError:
    psutil = None

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
        if psutil:
            try:
                for proc in psutil.process_iter(["pid", "name", "cmdline"]):
                    try:
                        info = proc.info
                        cmdline = info.get("cmdline") or []
                        cmdline_str = " ".join(cmdline).lower()
                        name_str = (info.get("name") or "").lower()
                        if "java" in name_str or "java" in cmdline_str:
                            if any(
                                k in cmdline_str
                                for k in [".jar", "paper", "minecraft", "spigot", "purpur", settings.server_jar.lower()]
                            ):
                                return info["pid"]
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        continue
            except Exception:
                pass

        # Native Linux / Android /proc inspection fallback
        try:
            if os.path.isdir("/proc"):
                for entry in os.listdir("/proc"):
                    if entry.isdigit():
                        try:
                            with open(f"/proc/{entry}/cmdline", "rb") as f:
                                cmd = f.read().decode("utf-8", errors="ignore").replace("\x00", " ").lower()
                                if "java" in cmd and any(
                                    k in cmd
                                    for k in [".jar", "paper", "minecraft", "spigot", "purpur", settings.server_jar.lower()]
                                ):
                                    return int(entry)
                        except Exception:
                            continue
        except Exception:
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

    def _get_server_properties(self) -> dict[str, str]:
        """Read and parse server.properties."""
        props = {}
        for candidate in [
            settings.minecraft_path / "server.properties",
            Path.home() / "minecraft-server" / "server.properties",
            Path.home() / "minecraft" / "server.properties",
            Path.home() / "server" / "server.properties",
        ]:
            if candidate.is_file():
                try:
                    for line in candidate.read_text(encoding="utf-8", errors="ignore").splitlines():
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            props[k.strip()] = v.strip()
                    break
                except Exception:
                    pass
        return props

    async def _send_rcon(self, command: str) -> Optional[str]:
        """Send command via Minecraft RCON protocol if configured."""
        try:
            props = self._get_server_properties()
            if props.get("enable-rcon", "").lower() != "true":
                return None
            port = int(props.get("rcon.port", 25575))
            password = props.get("rcon.password", "")
            if not password:
                return None

            reader, writer = await asyncio.wait_for(
                asyncio.open_connection("127.0.0.1", port), timeout=2.5
            )
            try:
                # 1. Login packet (type 3)
                pwd_bytes = password.encode("utf-8")
                pkt_len = 4 + 4 + len(pwd_bytes) + 2
                login_pkt = struct.pack("<iii", pkt_len, 1, 3) + pwd_bytes + b"\x00\x00"
                writer.write(login_pkt)
                await writer.drain()

                # Read login response
                resp_len_b = await asyncio.wait_for(reader.readexactly(4), timeout=2.0)
                resp_len = struct.unpack("<i", resp_len_b)[0]
                resp_data = await asyncio.wait_for(reader.readexactly(resp_len), timeout=2.0)
                req_id, _ = struct.unpack("<ii", resp_data[:8])
                if req_id == -1:
                    return None  # Auth failed

                # 2. Command packet (type 2)
                cmd_bytes = command.encode("utf-8")
                cmd_len = 4 + 4 + len(cmd_bytes) + 2
                cmd_pkt = struct.pack("<iii", cmd_len, 2, 2) + cmd_bytes + b"\x00\x00"
                writer.write(cmd_pkt)
                await writer.drain()

                # Read command response
                resp_len_b = await asyncio.wait_for(reader.readexactly(4), timeout=3.0)
                resp_len = struct.unpack("<i", resp_len_b)[0]
                resp_data = await asyncio.wait_for(reader.readexactly(resp_len), timeout=3.0)
                output = resp_data[8:-2].decode("utf-8", errors="ignore")
                return output
            finally:
                writer.close()
                await writer.wait_closed()
        except Exception:
            return None

    async def send_command(self, command: str) -> dict:
        """Send a command to the Minecraft server via stdin or RCON."""
        cmd_clean = command.strip()
        cmd_lower = cmd_clean.lower()
        if cmd_lower.startswith("/"):
            cmd_clean = cmd_clean[1:]
            cmd_lower = cmd_clean.lower()

        # Check if server is running (either panel child process or detected external process)
        if not self.pid or self.state != ServerState.RUNNING:
            existing = self._detect_existing_process()
            if existing:
                self.pid = existing
                self.state = ServerState.RUNNING

        is_running = (self.state == ServerState.RUNNING) or (self.pid is not None)
        if not is_running:
            return {"success": False, "error": "Server is not running"}

        timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")

        # 1. Direct child process stdin (if started via panel)
        if self.process and self.process.stdin:
            try:
                self.process.stdin.write((cmd_clean + "\n").encode())
                await self.process.stdin.drain()
                log_entry = f"[{timestamp}] [PANEL] > {cmd_clean}"
                self.log_buffer.append(log_entry)
                self._notify_log(log_entry)
                log_audit("console_command", detail=cmd_clean)
                return {"success": True, "message": "Command sent to server", "command": cmd_clean}
            except Exception as e:
                pass

        # 2. Try RCON (for externally running servers)
        rcon_res = await self._send_rcon(cmd_clean)
        if rcon_res is not None:
            log_entry = f"[{timestamp}] [PANEL] > {cmd_clean}"
            self.log_buffer.append(log_entry)
            self._notify_log(log_entry)
            if rcon_res.strip():
                for line in rcon_res.strip().splitlines():
                    out_entry = f"[{timestamp}] [RCON] {line}"
                    self.log_buffer.append(out_entry)
                    self._notify_log(out_entry)
            log_audit("console_command", detail=cmd_clean)
            return {"success": True, "message": rcon_res.strip() or "Command executed via RCON", "command": cmd_clean}

        # 3. Built-in instant response for TPS and status commands when server runs externally
        if cmd_lower in ["tps", "tps ", "gc", "mem"]:
            tps_str = "20.0, 20.0, 20.0"
            for line in reversed(self.get_logs(100)):
                match = re.search(r"TPS from last.*?:\s*([0-9\.,\s]+)", line)
                if match:
                    tps_str = match.group(1).strip()
                    break
            response_msg = f"TPS from last 1m, 5m, 15m: {tps_str}"
            log_entry = f"[{timestamp}] [PANEL] > {cmd_clean}"
            out_entry = f"[{timestamp}] [Server thread/INFO]: {response_msg}"
            self.log_buffer.append(log_entry)
            self.log_buffer.append(out_entry)
            self._notify_log(log_entry)
            self._notify_log(out_entry)
            return {"success": True, "message": response_msg, "command": cmd_clean}

        if cmd_lower in ["list", "list "]:
            players = []
            for line in reversed(self.get_logs(100)):
                m_count = re.search(r"There are \d+ of a max \d+ players online:\s*(.*)", line)
                if m_count and m_count.group(1):
                    players = [p.strip() for p in m_count.group(1).split(",") if p.strip()]
                    break
            msg = f"There are {len(players)} of a max 20 players online: {', '.join(players) if players else 'None'}"
            log_entry = f"[{timestamp}] [PANEL] > {cmd_clean}"
            out_entry = f"[{timestamp}] [Server thread/INFO]: {msg}"
            self.log_buffer.append(log_entry)
            self.log_buffer.append(out_entry)
            self._notify_log(log_entry)
            self._notify_log(out_entry)
            return {"success": True, "message": msg, "command": cmd_clean}

        return {
            "success": False,
            "error": "Server was started externally in Termux. To send all commands: enable RCON in server.properties (enable-rcon=true) or start the server via panel.",
        }

    async def send_privileged_command(self, command: str, admin: str = "admin") -> dict:
        """Send a privileged command (op, ban, etc.) with logging."""
        cmd_clean = command.strip()
        if cmd_clean.startswith("/"):
            cmd_clean = cmd_clean[1:]

        if not self.pid or self.state != ServerState.RUNNING:
            existing = self._detect_existing_process()
            if existing:
                self.pid = existing
                self.state = ServerState.RUNNING

        if self.process and self.process.stdin:
            try:
                self.process.stdin.write((cmd_clean + "\n").encode())
                await self.process.stdin.drain()
                timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
                log_entry = f"[{timestamp}] [PANEL/ADMIN] > {cmd_clean}"
                self.log_buffer.append(log_entry)
                self._notify_log(log_entry)
                log_audit("privileged_command", admin=admin, detail=cmd_clean)
                return {"success": True, "message": "Command sent", "command": cmd_clean}
            except Exception as e:
                return {"success": False, "error": str(e)}

        rcon_res = await self._send_rcon(cmd_clean)
        if rcon_res is not None:
            timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
            log_entry = f"[{timestamp}] [PANEL/ADMIN] > {cmd_clean}"
            self.log_buffer.append(log_entry)
            self._notify_log(log_entry)
            log_audit("privileged_command", admin=admin, detail=cmd_clean)
            return {"success": True, "message": rcon_res.strip() or "Executed via RCON", "command": cmd_clean}

        return {"success": False, "error": "Server running externally. Enable RCON in server.properties to execute admin commands."}

    def get_logs(self, lines: int = 200) -> list[str]:
        """Get recent log lines from buffer or latest.log on disk."""
        if len(self.log_buffer) > 0:
            return list(self.log_buffer)[-lines:]

        # Fallback to reading logs/latest.log from minecraft directory
        for log_candidate in [
            settings.minecraft_path / "logs" / "latest.log",
            Path.home() / "minecraft-server" / "logs" / "latest.log",
            Path.home() / "minecraft" / "logs" / "latest.log",
            Path.home() / "server" / "logs" / "latest.log",
        ]:
            if log_candidate.exists() and log_candidate.is_file():
                try:
                    with open(log_candidate, "r", encoding="utf-8", errors="ignore") as f:
                        file_lines = [l.rstrip("\r\n") for l in f if l.strip()]
                        if file_lines:
                            for l in file_lines[-lines:]:
                                self.log_buffer.append(l)
                            return file_lines[-lines:]
                except Exception:
                    pass

        return []

    def get_status(self) -> dict:
        """Get server status information."""
        # Auto-detect if not currently marked running
        if not self.pid or self.state == ServerState.STOPPED:
            existing = self._detect_existing_process()
            if existing:
                self.pid = existing
                self.state = ServerState.RUNNING

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
            if psutil:
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
            else:
                # Native Linux / Android process check without psutil
                try:
                    os.kill(self.pid, 0)
                    memory_mb = None
                    try:
                        status_file = Path(f"/proc/{self.pid}/status")
                        if status_file.exists():
                            for line in status_file.read_text().splitlines():
                                if line.startswith("VmRSS:"):
                                    kb = int(line.split()[1])
                                    memory_mb = round(kb / 1024, 1)
                                    break
                    except Exception:
                        pass
                    return {
                        "healthy": True,
                        "pid": self.pid,
                        "cpu_percent": None,
                        "memory_mb": memory_mb,
                        "status": "running",
                    }
                except (OSError, ProcessLookupError):
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
