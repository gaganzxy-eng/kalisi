"""
Kalisi SMP Hosting Panel — Configuration
"""
import os
import secrets
from pathlib import Path
try:
    from pydantic_settings import BaseSettings
except ImportError:
    try:
        from pydantic import BaseSettings
    except ImportError:
        BaseSettings = object

from pydantic import Field


class Settings(BaseSettings):
    # ── Paths ──────────────────────────────────────────────
    minecraft_dir: str = Field(
        default_factory=lambda: str(Path.home() / "minecraft-server"),
        description="Absolute path to the Minecraft server directory",
    )
    server_jar: str = Field(default="paper.jar", description="Server JAR filename")
    java_binary: str = Field(default="java", description="Path to Java binary")
    java_args: str = Field(
        default="-Xms512M -Xmx1G",
        description="JVM arguments for the Minecraft server",
    )
    backup_dir: str = Field(
        default_factory=lambda: str(Path.home() / "minecraft-backups"),
        description="Absolute path to the backup directory",
    )

    # ── Network ────────────────────────────────────────────
    host: str = Field(default="127.0.0.1", description="Agent bind address")
    port: int = Field(default=8728, description="Agent port")
    minecraft_port: int = Field(default=25565, description="Minecraft server port")

    # ── Auth ───────────────────────────────────────────────
    api_secret: str = Field(
        default_factory=lambda: secrets.token_urlsafe(48),
        description="API authentication secret key",
    )
    jwt_secret: str = Field(
        default_factory=lambda: secrets.token_urlsafe(48),
        description="JWT signing key",
    )
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60)
    admin_username: str = Field(default="admin", description="Admin username")
    admin_password_hash: str = Field(
        default="", description="Bcrypt hash of admin password"
    )
    allowed_origins: str = Field(
        default="https://panel.kalisiadudhamsmpseason2.in,http://localhost:3000",
        description="Comma-separated allowed CORS origins",
    )

    # ── Cloudflare Access ──────────────────────────────────
    cf_access_team: str = Field(default="", description="Cloudflare Access team domain")
    cf_access_aud: str = Field(default="", description="Cloudflare Access audience tag")

    # ── Monitoring ─────────────────────────────────────────
    metrics_interval: int = Field(
        default=15, description="Metrics collection interval in seconds"
    )
    max_log_lines: int = Field(
        default=5000, description="Maximum log lines kept in memory"
    )
    max_upload_size_mb: int = Field(default=100, description="Max upload size in MB")

    # ── Backups ────────────────────────────────────────────
    max_backups: int = Field(default=10, description="Maximum backups to retain")
    scheduled_backup_cron: str = Field(
        default="0 */6 * * *", description="Cron for scheduled backups"
    )

    # ── Database ───────────────────────────────────────────
    db_path: str = Field(
        default_factory=lambda: str(
            Path.home() / ".kalisi-panel" / "kalisi.db"
        ),
        description="SQLite database path",
    )

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def minecraft_path(self) -> Path:
        return Path(self.minecraft_dir)

    @property
    def backup_path(self) -> Path:
        return Path(self.backup_dir)

    @property
    def server_jar_path(self) -> Path:
        return self.minecraft_path / self.server_jar

    class Config:
        env_prefix = "KALISI_"
        env_file = ".env"
        extra = "ignore"

    model_config = {"env_prefix": "KALISI_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
