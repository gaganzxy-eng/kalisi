"""
Kalisi SMP Hosting Panel — Filesystem Security

All file operations MUST go through this module.
Prevents path traversal, symlink escapes, and access
to files outside ~/minecraft-server.
"""
import os
from pathlib import Path
from typing import Optional

from config import settings

# Files that should be treated with extra care
PROTECTED_FILES = {
    "server.properties",
    "eula.txt",
    "whitelist.json",
    "ops.json",
    "banned-players.json",
    "banned-ips.json",
}

# Never expose these regardless of location
FORBIDDEN_PATTERNS = {
    ".env",
    ".bashrc",
    ".bash_profile",
    ".profile",
    ".ssh",
    "id_rsa",
    "id_ed25519",
    "known_hosts",
    "authorized_keys",
    ".gnupg",
    ".termux",
    ".kalisi-panel",
}

# Max upload size
MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024

# Allowed extensions for plugin uploads
PLUGIN_EXTENSIONS = {".jar"}

# Editable text extensions
TEXT_EXTENSIONS = {
    ".yml", ".yaml", ".json", ".properties", ".txt",
    ".cfg", ".conf", ".toml", ".ini", ".log", ".md",
    ".sk", ".csv", ".xml", ".html",
}


def resolve_safe_path(relative_path: str) -> Optional[Path]:
    """
    Resolve a user-provided relative path to an absolute path
    within the Minecraft server directory.

    Returns None if the path escapes the allowed directory.
    """
    base = settings.minecraft_path.resolve()

    # Normalize and resolve
    try:
        target = (base / relative_path).resolve()
    except (ValueError, OSError):
        return None

    # Check that resolved path is within the server directory
    try:
        target.relative_to(base)
    except ValueError:
        return None

    # Check for symlink escapes
    if target.is_symlink():
        real_target = target.resolve()
        try:
            real_target.relative_to(base)
        except ValueError:
            return None

    return target


def is_path_safe(relative_path: str) -> bool:
    """Check if a relative path resolves safely within the server directory."""
    return resolve_safe_path(relative_path) is not None


def is_forbidden(path: Path) -> bool:
    """Check if a path matches forbidden patterns."""
    name = path.name.lower()
    for pattern in FORBIDDEN_PATTERNS:
        if name == pattern.lower() or name.startswith(pattern.lower()):
            return True
    return False


def is_protected(path: Path) -> bool:
    """Check if a file is protected and requires backup before editing."""
    return path.name in PROTECTED_FILES


def is_text_file(path: Path) -> bool:
    """Check if a file has a text-editable extension."""
    return path.suffix.lower() in TEXT_EXTENSIONS


def is_plugin_file(path: Path) -> bool:
    """Check if a file is a plugin JAR."""
    return path.suffix.lower() in PLUGIN_EXTENSIONS


def validate_upload_size(size_bytes: int) -> bool:
    """Check if upload is within size limits."""
    return 0 < size_bytes <= MAX_UPLOAD_BYTES


def get_relative_path(absolute_path: Path) -> str:
    """Get the path relative to the Minecraft server directory."""
    base = settings.minecraft_path.resolve()
    return str(absolute_path.resolve().relative_to(base))


def sanitize_filename(name: str) -> str:
    """Remove dangerous characters from filenames."""
    # Remove path separators and null bytes
    sanitized = name.replace("/", "").replace("\\", "").replace("\0", "")
    # Remove leading dots (hidden files)
    sanitized = sanitized.lstrip(".")
    # Limit length
    if len(sanitized) > 255:
        sanitized = sanitized[:255]
    return sanitized or "unnamed"
