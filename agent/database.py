"""
Kalisi SMP Hosting Panel — SQLite Database Layer

Stores audit logs, player records, moderation history,
backup metadata, and metrics history.
"""
import sqlite3
import json
import time
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional

from config import settings


def _ensure_dir(path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    _ensure_dir(settings.db_path)
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist."""
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            action TEXT NOT NULL,
            admin TEXT NOT NULL DEFAULT 'system',
            resource TEXT,
            detail TEXT,
            result TEXT NOT NULL DEFAULT 'success'
        );

        CREATE TABLE IF NOT EXISTS players (
            uuid TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            first_seen TEXT NOT NULL DEFAULT (datetime('now')),
            last_seen TEXT NOT NULL DEFAULT (datetime('now')),
            is_whitelisted INTEGER NOT NULL DEFAULT 0,
            is_op INTEGER NOT NULL DEFAULT 0,
            is_banned INTEGER NOT NULL DEFAULT 0,
            total_playtime_seconds INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS moderation_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            player_uuid TEXT,
            player_name TEXT NOT NULL,
            action_type TEXT NOT NULL,
            reason TEXT,
            admin TEXT NOT NULL DEFAULT 'admin',
            duration_seconds INTEGER,
            expires_at TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            server_confirmed INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            size_bytes INTEGER NOT NULL DEFAULT 0,
            backup_type TEXT NOT NULL DEFAULT 'manual',
            worlds TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS metrics_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            cpu_percent REAL,
            ram_used_mb REAL,
            ram_total_mb REAL,
            disk_used_gb REAL,
            disk_total_gb REAL,
            player_count INTEGER,
            tps REAL,
            mspt REAL,
            java_running INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type TEXT NOT NULL,
            cron_expression TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run TEXT,
            next_run TEXT,
            config TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
        CREATE INDEX IF NOT EXISTS idx_moderation_player ON moderation_actions(player_name);
        CREATE INDEX IF NOT EXISTS idx_moderation_active ON moderation_actions(active);
        CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp);
        CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);
        """)


# ── Audit Log Helpers ──────────────────────────────────────

def log_audit(action: str, admin: str = "system", resource: str = None,
              detail: str = None, result: str = "success"):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO audit_logs (action, admin, resource, detail, result) VALUES (?, ?, ?, ?, ?)",
            (action, admin, resource, detail, result),
        )


def get_audit_logs(limit: int = 100, offset: int = 0, action_filter: str = None):
    with get_db() as conn:
        if action_filter:
            rows = conn.execute(
                "SELECT * FROM audit_logs WHERE action = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                (action_filter, limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [dict(r) for r in rows]


# ── Player Helpers ─────────────────────────────────────────

def upsert_player(uuid: str, name: str, **kwargs):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM players WHERE uuid = ?", (uuid,)).fetchone()
        if existing:
            updates = ["name = ?", "last_seen = datetime('now')"]
            values = [name]
            for k, v in kwargs.items():
                updates.append(f"{k} = ?")
                values.append(v)
            values.append(uuid)
            conn.execute(
                f"UPDATE players SET {', '.join(updates)} WHERE uuid = ?",
                values,
            )
        else:
            conn.execute(
                "INSERT INTO players (uuid, name) VALUES (?, ?)",
                (uuid, name),
            )


def get_player(uuid: str) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM players WHERE uuid = ?", (uuid,)).fetchone()
        return dict(row) if row else None


def get_all_players(limit: int = 100, offset: int = 0):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM players ORDER BY last_seen DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def search_players(query: str, limit: int = 50):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM players WHERE name LIKE ? OR uuid LIKE ? ORDER BY last_seen DESC LIMIT ?",
            (f"%{query}%", f"%{query}%", limit),
        ).fetchall()
        return [dict(r) for r in rows]


# ── Moderation Helpers ─────────────────────────────────────

def add_moderation_action(player_name: str, action_type: str, reason: str = None,
                          admin: str = "admin", player_uuid: str = None,
                          duration_seconds: int = None, expires_at: str = None,
                          server_confirmed: bool = False):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO moderation_actions
            (player_name, player_uuid, action_type, reason, admin, duration_seconds, expires_at, server_confirmed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (player_name, player_uuid, action_type, reason, admin,
             duration_seconds, expires_at, 1 if server_confirmed else 0),
        )


def get_moderation_history(player_name: str = None, limit: int = 100):
    with get_db() as conn:
        if player_name:
            rows = conn.execute(
                "SELECT * FROM moderation_actions WHERE player_name = ? ORDER BY timestamp DESC LIMIT ?",
                (player_name, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM moderation_actions ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]


# ── Backup Helpers ─────────────────────────────────────────

def add_backup_record(filename: str, size_bytes: int, backup_type: str = "manual",
                      worlds: str = None, status: str = "completed", notes: str = None):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO backups (filename, size_bytes, backup_type, worlds, status, notes)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (filename, size_bytes, backup_type, worlds, status, notes),
        )


def get_backups(limit: int = 50):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM backups ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def delete_backup_record(filename: str):
    with get_db() as conn:
        conn.execute("DELETE FROM backups WHERE filename = ?", (filename,))


# ── Metrics Helpers ────────────────────────────────────────

def record_metrics(cpu: float = None, ram_used: float = None, ram_total: float = None,
                   disk_used: float = None, disk_total: float = None,
                   players: int = None, tps: float = None, mspt: float = None,
                   java_running: bool = False):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO metrics_history
            (cpu_percent, ram_used_mb, ram_total_mb, disk_used_gb, disk_total_gb,
             player_count, tps, mspt, java_running)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (cpu, ram_used, ram_total, disk_used, disk_total,
             players, tps, mspt, 1 if java_running else 0),
        )


def get_metrics_history(limit: int = 100):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM metrics_history ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def cleanup_old_metrics(keep_hours: int = 72):
    """Remove metrics older than keep_hours."""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM metrics_history WHERE timestamp < datetime('now', ?)",
            (f"-{keep_hours} hours",),
        )
