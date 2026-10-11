"""
Kalisi SMP Hosting Panel — Backup Manager

Creates, lists, downloads, and restores Minecraft world backups.
Ensures backups are stored outside the server directory to
prevent recursive inclusion.
"""
import asyncio
import os
import shutil
import tarfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from config import settings
from database import add_backup_record, get_backups, delete_backup_record, log_audit
from server_manager import server_manager, ServerState


class BackupManager:
    def __init__(self):
        self._ensure_backup_dir()

    def _ensure_backup_dir(self):
        settings.backup_path.mkdir(parents=True, exist_ok=True)

    def _get_world_dirs(self) -> list[str]:
        """Identify world directories from server.properties."""
        worlds = []
        props_path = settings.minecraft_path / "server.properties"

        level_name = "world"
        if props_path.exists():
            try:
                with open(props_path, "r") as f:
                    for line in f:
                        if line.strip().startswith("level-name="):
                            level_name = line.strip().split("=", 1)[1].strip()
                            break
            except Exception:
                pass

        # Paper creates world, world_nether, world_the_end
        for suffix in ["", "_nether", "_the_end"]:
            world_dir = settings.minecraft_path / f"{level_name}{suffix}"
            if world_dir.exists() and world_dir.is_dir():
                worlds.append(f"{level_name}{suffix}")

        return worlds

    async def create_backup(
        self,
        backup_type: str = "manual",
        worlds_only: bool = False,
        admin: str = "system",
    ) -> dict:
        """Create a backup archive."""
        self._ensure_backup_dir()

        # Check disk space
        try:
            disk = shutil.disk_usage(str(settings.backup_path))
            free_gb = disk.free / (1024 ** 3)
            if free_gb < 0.5:
                return {
                    "success": False,
                    "error": f"Insufficient disk space: {free_gb:.2f} GB free",
                }
        except Exception:
            pass

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        prefix = "worlds" if worlds_only else "full"
        filename = f"kalisi_backup_{prefix}_{timestamp}.tar.gz"
        backup_file = settings.backup_path / filename

        try:
            # If server is running, warn the user about consistency
            save_was_off = False
            if server_manager.state == ServerState.RUNNING:
                await server_manager.send_command("save-off")
                await server_manager.send_command("save-all flush")
                save_was_off = True
                await asyncio.sleep(3)  # Wait for save

            # Create tar.gz
            loop = asyncio.get_event_loop()
            if worlds_only:
                world_dirs = self._get_world_dirs()
                await loop.run_in_executor(
                    None, self._create_worlds_archive, backup_file, world_dirs
                )
                worlds_str = ",".join(world_dirs)
            else:
                await loop.run_in_executor(
                    None, self._create_full_archive, backup_file
                )
                worlds_str = "all"

            # Re-enable saving
            if save_was_off:
                await server_manager.send_command("save-on")

            size = backup_file.stat().st_size

            add_backup_record(
                filename=filename,
                size_bytes=size,
                backup_type=backup_type,
                worlds=worlds_str,
                status="completed",
            )
            log_audit("backup_create", admin=admin, resource=filename,
                      detail=f"{size} bytes, type={backup_type}")

            # Enforce retention
            await self._enforce_retention()

            return {
                "success": True,
                "filename": filename,
                "size_bytes": size,
                "size_mb": round(size / (1024 * 1024), 2),
            }

        except Exception as e:
            if save_was_off:
                try:
                    await server_manager.send_command("save-on")
                except Exception:
                    pass

            log_audit("backup_create", admin=admin, detail=str(e), result="failure")
            return {"success": False, "error": str(e)}

    def _create_full_archive(self, backup_file: Path):
        """Create a full server backup, excluding the backup directory itself."""
        with tarfile.open(str(backup_file), "w:gz") as tar:
            for item in settings.minecraft_path.iterdir():
                # Skip backup directory if somehow inside server dir
                if item.resolve() == settings.backup_path.resolve():
                    continue
                tar.add(str(item), arcname=item.name)

    def _create_worlds_archive(self, backup_file: Path, world_dirs: list[str]):
        """Create a worlds-only backup."""
        with tarfile.open(str(backup_file), "w:gz") as tar:
            for world in world_dirs:
                world_path = settings.minecraft_path / world
                if world_path.exists():
                    tar.add(str(world_path), arcname=world)

    async def restore_backup(self, filename: str, admin: str = "admin") -> dict:
        """Restore a backup. Server MUST be stopped first."""
        if server_manager.state != ServerState.STOPPED:
            return {
                "success": False,
                "error": "Server must be stopped before restoring a backup",
            }

        backup_file = settings.backup_path / filename
        if not backup_file.exists():
            return {"success": False, "error": "Backup file not found"}

        # Verify it's within backup directory
        try:
            backup_file.resolve().relative_to(settings.backup_path.resolve())
        except ValueError:
            return {"success": False, "error": "Invalid backup path"}

        # Create a recovery backup first
        recovery_result = await self.create_backup(
            backup_type="pre_restore_recovery", admin=admin
        )
        if not recovery_result["success"]:
            return {
                "success": False,
                "error": f"Failed to create recovery backup: {recovery_result['error']}",
            }

        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._extract_backup, backup_file)

            log_audit("backup_restore", admin=admin, resource=filename)
            return {
                "success": True,
                "message": f"Backup {filename} restored. Recovery backup: {recovery_result['filename']}",
                "recovery_backup": recovery_result["filename"],
            }

        except Exception as e:
            log_audit("backup_restore", admin=admin, resource=filename,
                      detail=str(e), result="failure")
            return {"success": False, "error": str(e)}

    def _extract_backup(self, backup_file: Path):
        """Extract backup archive to the server directory."""
        with tarfile.open(str(backup_file), "r:gz") as tar:
            # Security: check for path traversal in archive
            for member in tar.getmembers():
                member_path = Path(settings.minecraft_dir) / member.name
                try:
                    member_path.resolve().relative_to(
                        settings.minecraft_path.resolve()
                    )
                except ValueError:
                    raise ValueError(
                        f"Archive contains unsafe path: {member.name}"
                    )
            tar.extractall(path=str(settings.minecraft_path))

    def list_backups(self) -> list[dict]:
        """List all backup files with metadata."""
        db_backups = get_backups()
        result = []
        for b in db_backups:
            backup_file = settings.backup_path / b["filename"]
            exists = backup_file.exists()
            entry = dict(b)
            entry["exists_on_disk"] = exists
            if exists:
                entry["size_bytes"] = backup_file.stat().st_size
                entry["size_mb"] = round(entry["size_bytes"] / (1024 * 1024), 2)
            result.append(entry)
        return result

    async def delete_backup(self, filename: str, admin: str = "admin") -> dict:
        """Delete a backup file and its database record."""
        backup_file = settings.backup_path / filename

        # Verify path safety
        try:
            backup_file.resolve().relative_to(settings.backup_path.resolve())
        except ValueError:
            return {"success": False, "error": "Invalid backup path"}

        try:
            if backup_file.exists():
                backup_file.unlink()
            delete_backup_record(filename)
            log_audit("backup_delete", admin=admin, resource=filename)
            return {"success": True, "message": f"Backup {filename} deleted"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _enforce_retention(self):
        """Delete oldest backups if over retention limit."""
        backups = self.list_backups()
        # Only count manual and scheduled backups for retention
        regular = [b for b in backups if b["backup_type"] in ("manual", "scheduled")]
        while len(regular) > settings.max_backups:
            oldest = regular.pop()  # already sorted newest first
            await self.delete_backup(oldest["filename"], admin="system")

    def get_backup_path(self, filename: str) -> Optional[Path]:
        """Get safe path to a backup file for download."""
        backup_file = settings.backup_path / filename
        try:
            backup_file.resolve().relative_to(settings.backup_path.resolve())
        except ValueError:
            return None
        if backup_file.exists():
            return backup_file
        return None


# Singleton
backup_manager = BackupManager()
