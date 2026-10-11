"""
Kalisi SMP Hosting Panel — Main FastAPI Application

This is the phone agent that runs in Termux.
It provides authenticated API endpoints for managing the
Minecraft Paper server.
"""
import asyncio
import json
import os
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import (
    Body,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from auth import (
    LoginRequest,
    TokenResponse,
    authenticate_user,
    create_access_token,
    decode_token,
    get_current_user,
)
from backup_manager import backup_manager
from config import settings
from database import (
    add_moderation_action,
    get_all_players,
    get_audit_logs,
    get_metrics_history,
    get_moderation_history,
    get_player,
    init_db,
    log_audit,
    search_players,
    upsert_player,
)
from metrics import metrics_collector
from security import (
    is_forbidden,
    is_path_safe,
    is_plugin_file,
    is_protected,
    is_text_file,
    resolve_safe_path,
    sanitize_filename,
    validate_upload_size,
    MAX_UPLOAD_BYTES,
)
from server_manager import ServerState, server_manager

# ── App Setup ──────────────────────────────────────────────

app = FastAPI(
    title="Kalisi SMP Panel Agent",
    version="1.0.0",
    docs_url=None,  # Don't expose docs in production
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def private_network_cors_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        # Handle preflight including Chrome Private Network Access
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# ── Rate Limiting (simple in-memory) ──────────────────────

_rate_limits: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 60  # requests per window


def check_rate_limit(key: str) -> bool:
    now = time.time()
    if key not in _rate_limits:
        _rate_limits[key] = []
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[key]) >= RATE_LIMIT_MAX:
        return False
    _rate_limits[key].append(now)
    return True


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
        )
    response = await call_next(request)
    return response


# ── Lifecycle Events ──────────────────────────────────────

@app.on_event("startup")
async def startup():
    init_db()
    await metrics_collector.start()
    log_audit("agent_start")
    print(f"✅ Kalisi SMP Panel Agent running on {settings.host}:{settings.port}")
    print(f"📂 Minecraft directory: {settings.minecraft_dir}")


@app.on_event("shutdown")
async def shutdown():
    await metrics_collector.stop()
    log_audit("agent_stop")


# ══════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    token = authenticate_user(req.username, req.password)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    _, expires_in = create_access_token(req.username)
    return TokenResponse(access_token=token, expires_in=expires_in)


@app.get("/api/auth/verify")
async def verify_token(user: str = Depends(get_current_user)):
    return {"valid": True, "username": user}


# ══════════════════════════════════════════════════════════
# SERVER STATUS & CONTROL
# ══════════════════════════════════════════════════════════

@app.get("/api/server/status")
async def get_server_status(user: str = Depends(get_current_user)):
    health = await server_manager.check_health()
    status_info = server_manager.get_status()
    metrics = metrics_collector.get_latest()
    if not metrics or metrics.get("cpu_percent") is None:
        metrics = await metrics_collector.collect_once()

    # Read server.properties for version info
    version_info = _get_version_info()

    return {
        **status_info,
        "health": health,
        "metrics": metrics,
        "version": version_info,
        "minecraft_port": settings.minecraft_port,
    }


@app.post("/api/server/start")
async def start_server(user: str = Depends(get_current_user)):
    result = await server_manager.start()
    return result


@app.post("/api/server/stop")
async def stop_server(user: str = Depends(get_current_user)):
    result = await server_manager.stop()
    return result


@app.post("/api/server/restart")
async def restart_server(user: str = Depends(get_current_user)):
    result = await server_manager.restart()
    return result


@app.get("/api/server/health")
async def health_check():
    """Public health endpoint for monitoring."""
    return {
        "agent": "online",
        "server_state": server_manager.state,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════
# CONSOLE
# ══════════════════════════════════════════════════════════

class CommandRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=500)


@app.get("/api/console/logs")
async def get_console_logs(
    lines: int = Query(default=200, ge=1, le=5000),
    user: str = Depends(get_current_user),
):
    return {"logs": server_manager.get_logs(lines)}


@app.post("/api/console/command")
async def send_console_command(
    req: CommandRequest,
    user: str = Depends(get_current_user),
):
    # Block dangerous commands that should use dedicated endpoints
    cmd = req.command.strip().lower()
    blocked = ["stop", "restart"]
    if cmd in blocked:
        return {
            "success": False,
            "error": f"Use the dedicated /{cmd} endpoint instead",
        }

    result = await server_manager.send_command(req.command)
    return result


@app.websocket("/api/console/ws")
async def console_websocket(ws: WebSocket):
    """WebSocket endpoint for real-time log streaming."""
    # Authenticate via query parameter
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=1008, reason="Authentication required")
        return

    token_data = decode_token(token)
    if not token_data:
        await ws.close(code=1008, reason="Invalid token")
        return

    await ws.accept()

    # Send existing logs
    for line in server_manager.get_logs():
        await ws.send_text(line)

    # Set up callback for new logs
    queue: asyncio.Queue = asyncio.Queue()

    def on_log(line: str):
        try:
            queue.put_nowait(line)
        except asyncio.QueueFull:
            pass

    server_manager.register_log_callback(on_log)

    try:
        while True:
            # Send new log lines
            try:
                line = await asyncio.wait_for(queue.get(), timeout=30)
                await ws.send_text(line)
            except asyncio.TimeoutError:
                # Send heartbeat
                await ws.send_text("")
            except WebSocketDisconnect:
                break

    except WebSocketDisconnect:
        pass
    finally:
        server_manager.unregister_log_callback(on_log)


# ══════════════════════════════════════════════════════════
# METRICS
# ══════════════════════════════════════════════════════════

@app.get("/api/metrics/current")
async def get_current_metrics(user: str = Depends(get_current_user)):
    return await metrics_collector.collect_once()


@app.get("/api/metrics/history")
async def get_history_metrics(
    limit: int = Query(default=100, ge=1, le=1000),
    user: str = Depends(get_current_user),
):
    return {"metrics": get_metrics_history(limit)}


# ══════════════════════════════════════════════════════════
# FILE MANAGER
# ══════════════════════════════════════════════════════════

@app.get("/api/files/list")
async def list_files(
    path: str = Query(default=".", description="Relative path"),
    user: str = Depends(get_current_user),
):
    safe_path = resolve_safe_path(path)
    if not safe_path:
        raise HTTPException(400, "Invalid path")
    if not safe_path.exists():
        raise HTTPException(404, "Path not found")
    if not safe_path.is_dir():
        raise HTTPException(400, "Not a directory")

    items = []
    try:
        for entry in sorted(safe_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            if is_forbidden(entry):
                continue
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "is_dir": entry.is_dir(),
                "size": stat.st_size if not entry.is_dir() else None,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "is_text": is_text_file(entry) if not entry.is_dir() else False,
                "is_plugin": is_plugin_file(entry),
                "is_protected": is_protected(entry),
            })
    except PermissionError:
        raise HTTPException(403, "Permission denied")

    return {"path": path, "items": items}


@app.get("/api/files/read")
async def read_file(
    path: str = Query(..., description="Relative path to file"),
    user: str = Depends(get_current_user),
):
    safe_path = resolve_safe_path(path)
    if not safe_path:
        raise HTTPException(400, "Invalid path")
    if not safe_path.exists():
        raise HTTPException(404, "File not found")
    if not safe_path.is_file():
        raise HTTPException(400, "Not a file")
    if is_forbidden(safe_path):
        raise HTTPException(403, "Access denied")
    if not is_text_file(safe_path):
        raise HTTPException(400, "Not a text file — use download instead")

    # Limit file size for reading
    if safe_path.stat().st_size > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(400, "File too large to view in editor")

    try:
        async with aiofiles.open(str(safe_path), "r", encoding="utf-8", errors="replace") as f:
            content = await f.read()
        return {"path": path, "content": content, "size": safe_path.stat().st_size}
    except Exception as e:
        raise HTTPException(500, f"Error reading file: {e}")


class FileWriteRequest(BaseModel):
    path: str
    content: str
    create_backup: bool = True


@app.post("/api/files/write")
async def write_file(
    req: FileWriteRequest,
    user: str = Depends(get_current_user),
):
    safe_path = resolve_safe_path(req.path)
    if not safe_path:
        raise HTTPException(400, "Invalid path")
    if is_forbidden(safe_path):
        raise HTTPException(403, "Access denied")
    if not is_text_file(safe_path):
        raise HTTPException(400, "Only text files can be edited")

    # Backup before editing
    if req.create_backup and safe_path.exists():
        backup_name = f"{safe_path.name}.bak.{int(time.time())}"
        backup_path = safe_path.parent / backup_name
        shutil.copy2(str(safe_path), str(backup_path))

    try:
        # Ensure parent directory exists
        safe_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(str(safe_path), "w", encoding="utf-8") as f:
            await f.write(req.content)

        log_audit("file_edit", admin=user, resource=req.path)
        return {"success": True, "path": req.path}
    except Exception as e:
        raise HTTPException(500, f"Error writing file: {e}")


@app.post("/api/files/upload")
async def upload_file(
    path: str = Query(..., description="Directory to upload to"),
    file: UploadFile = File(...),
    user: str = Depends(get_current_user),
):
    safe_dir = resolve_safe_path(path)
    if not safe_dir:
        raise HTTPException(400, "Invalid path")
    if not safe_dir.is_dir():
        raise HTTPException(400, "Not a directory")

    filename = sanitize_filename(file.filename or "upload")
    target = safe_dir / filename

    if is_forbidden(target):
        raise HTTPException(403, "Forbidden filename")

    # Read file content with size limit
    content = await file.read()
    if not validate_upload_size(len(content)):
        raise HTTPException(400, f"File too large. Max: {settings.max_upload_size_mb}MB")

    try:
        async with aiofiles.open(str(target), "wb") as f:
            await f.write(content)

        log_audit("file_upload", admin=user, resource=f"{path}/{filename}",
                  detail=f"{len(content)} bytes")
        return {
            "success": True,
            "path": f"{path}/{filename}",
            "size": len(content),
        }
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")


@app.get("/api/files/download")
async def download_file(
    path: str = Query(..., description="Relative file path"),
    user: str = Depends(get_current_user),
):
    safe_path = resolve_safe_path(path)
    if not safe_path:
        raise HTTPException(400, "Invalid path")
    if not safe_path.exists() or not safe_path.is_file():
        raise HTTPException(404, "File not found")
    if is_forbidden(safe_path):
        raise HTTPException(403, "Access denied")

    return FileResponse(
        str(safe_path),
        filename=safe_path.name,
        media_type="application/octet-stream",
    )


class CreateDirRequest(BaseModel):
    path: str
    name: str = Field(..., min_length=1, max_length=255)


@app.post("/api/files/mkdir")
async def create_directory(
    req: CreateDirRequest,
    user: str = Depends(get_current_user),
):
    safe_path = resolve_safe_path(req.path)
    if not safe_path:
        raise HTTPException(400, "Invalid path")

    name = sanitize_filename(req.name)
    new_dir = safe_path / name

    if new_dir.exists():
        raise HTTPException(400, "Directory already exists")

    try:
        new_dir.mkdir(parents=False, exist_ok=False)
        log_audit("dir_create", admin=user, resource=f"{req.path}/{name}")
        return {"success": True, "path": f"{req.path}/{name}"}
    except Exception as e:
        raise HTTPException(500, f"Error creating directory: {e}")


class RenameRequest(BaseModel):
    path: str
    new_name: str = Field(..., min_length=1, max_length=255)


@app.post("/api/files/rename")
async def rename_file(
    req: RenameRequest,
    user: str = Depends(get_current_user),
):
    safe_path = resolve_safe_path(req.path)
    if not safe_path:
        raise HTTPException(400, "Invalid path")
    if not safe_path.exists():
        raise HTTPException(404, "File not found")
    if is_forbidden(safe_path):
        raise HTTPException(403, "Access denied")

    new_name = sanitize_filename(req.new_name)
    new_path = safe_path.parent / new_name

    if new_path.exists():
        raise HTTPException(400, "A file with that name already exists")

    try:
        safe_path.rename(new_path)
        log_audit("file_rename", admin=user, resource=req.path, detail=f"→ {new_name}")
        return {"success": True, "new_name": new_name}
    except Exception as e:
        raise HTTPException(500, f"Error renaming: {e}")


class DeleteRequest(BaseModel):
    path: str


@app.post("/api/files/delete")
async def delete_file(
    req: DeleteRequest,
    user: str = Depends(get_current_user),
):
    safe_path = resolve_safe_path(req.path)
    if not safe_path:
        raise HTTPException(400, "Invalid path")
    if not safe_path.exists():
        raise HTTPException(404, "File not found")
    if is_forbidden(safe_path):
        raise HTTPException(403, "Access denied")
    if is_protected(safe_path):
        raise HTTPException(403, "Protected file — cannot delete")

    try:
        if safe_path.is_dir():
            shutil.rmtree(str(safe_path))
        else:
            safe_path.unlink()

        log_audit("file_delete", admin=user, resource=req.path)
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Error deleting: {e}")


# ══════════════════════════════════════════════════════════
# PLUGINS
# ══════════════════════════════════════════════════════════

@app.get("/api/plugins/list")
async def list_plugins(user: str = Depends(get_current_user)):
    plugins_dir = settings.minecraft_path / "plugins"
    if not plugins_dir.exists():
        return {"plugins": []}

    plugins = []
    for jar in sorted(plugins_dir.iterdir()):
        if jar.suffix.lower() == ".jar":
            stat = jar.stat()
            # Check for config directory
            config_dir = plugins_dir / jar.stem
            has_config = config_dir.exists() and config_dir.is_dir()

            # Check if disabled (has .disabled extension)
            is_disabled = ".disabled" in jar.name.lower()

            plugins.append({
                "name": jar.stem,
                "filename": jar.name,
                "size_bytes": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "has_config": has_config,
                "config_dir": jar.stem if has_config else None,
                "appears_enabled": not is_disabled,
            })

    return {"plugins": plugins}


@app.post("/api/plugins/upload")
async def upload_plugin(
    file: UploadFile = File(...),
    user: str = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".jar"):
        raise HTTPException(400, "Only .jar files are accepted")

    plugins_dir = settings.minecraft_path / "plugins"
    plugins_dir.mkdir(exist_ok=True)

    filename = sanitize_filename(file.filename)
    target = plugins_dir / filename

    content = await file.read()
    if not validate_upload_size(len(content)):
        raise HTTPException(400, f"File too large. Max: {settings.max_upload_size_mb}MB")

    async with aiofiles.open(str(target), "wb") as f:
        await f.write(content)

    log_audit("plugin_upload", admin=user, resource=filename,
              detail=f"{len(content)} bytes")

    return {
        "success": True,
        "filename": filename,
        "size": len(content),
        "restart_required": True,
        "message": "Plugin uploaded. Restart the server to load it.",
    }


class PluginToggleRequest(BaseModel):
    filename: str


@app.post("/api/plugins/toggle")
async def toggle_plugin(
    req: PluginToggleRequest,
    user: str = Depends(get_current_user),
):
    """Toggle a plugin by renaming its JAR (adding/removing .disabled)."""
    plugins_dir = settings.minecraft_path / "plugins"
    jar_path = plugins_dir / req.filename

    if not jar_path.exists():
        raise HTTPException(404, "Plugin not found")

    try:
        jar_path.resolve().relative_to(plugins_dir.resolve())
    except ValueError:
        raise HTTPException(400, "Invalid path")

    if req.filename.endswith(".disabled"):
        new_name = req.filename.replace(".disabled", "")
        action = "enabled"
    else:
        new_name = req.filename + ".disabled"
        action = "disabled"

    new_path = plugins_dir / new_name
    jar_path.rename(new_path)

    log_audit(f"plugin_{action}", admin=user, resource=req.filename)

    return {
        "success": True,
        "action": action,
        "new_filename": new_name,
        "restart_required": True,
        "message": f"Plugin {action}. Restart the server for changes to take effect.",
    }


# ══════════════════════════════════════════════════════════
# PLAYERS
# ══════════════════════════════════════════════════════════

@app.get("/api/players/online")
async def get_online_players(user: str = Depends(get_current_user)):
    """Get online players by sending the 'list' command."""
    if server_manager.state != ServerState.RUNNING:
        return {"online": [], "count": 0, "max": 0, "server_offline": True}

    # Send list command and parse response from logs
    result = await server_manager.send_command("list")
    if not result["success"]:
        return {"online": [], "count": 0, "max": 0, "error": result.get("error")}

    # Parse from recent logs
    await asyncio.sleep(0.5)
    logs = server_manager.get_logs(20)
    players = []
    count = 0
    max_players = 0

    for log_line in reversed(logs):
        # Paper format: "There are X of a max of Y players online: player1, player2"
        match = re.search(
            r"There are (\d+) of a max of (\d+) players online:\s*(.*)",
            log_line,
        )
        if match:
            count = int(match.group(1))
            max_players = int(match.group(2))
            if match.group(3).strip():
                players = [p.strip() for p in match.group(3).split(",") if p.strip()]
            break

        # Alternative: "There are X of a max of Y players online."
        match2 = re.search(
            r"There are (\d+) of a max of (\d+) players online",
            log_line,
        )
        if match2:
            count = int(match2.group(1))
            max_players = int(match2.group(2))
            break

    return {
        "online": players,
        "count": count,
        "max": max_players,
        "server_offline": False,
    }


@app.get("/api/players/all")
async def get_all_known_players(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: str = Query(default=None),
    user: str = Depends(get_current_user),
):
    if search:
        players = search_players(search, limit)
    else:
        players = get_all_players(limit, offset)
    return {"players": players}


@app.get("/api/players/{uuid}")
async def get_player_info(uuid: str, user: str = Depends(get_current_user)):
    player = get_player(uuid)
    if not player:
        raise HTTPException(404, "Player not found")

    # Get moderation history
    history = get_moderation_history(player_name=player["name"])

    return {"player": player, "moderation_history": history}


# ══════════════════════════════════════════════════════════
# MODERATION
# ══════════════════════════════════════════════════════════

class ModerationRequest(BaseModel):
    player: str = Field(..., min_length=1, max_length=16)
    reason: str = Field(default="No reason specified", max_length=500)
    duration: Optional[str] = None  # e.g., "1d", "2h", "30m"


@app.post("/api/moderation/kick")
async def kick_player(
    req: ModerationRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    cmd = f'kick {req.player} {req.reason}'
    result = await server_manager.send_privileged_command(cmd, admin=user)

    if result["success"]:
        add_moderation_action(
            player_name=req.player,
            action_type="kick",
            reason=req.reason,
            admin=user,
            server_confirmed=True,
        )

    return result


@app.post("/api/moderation/ban")
async def ban_player(
    req: ModerationRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    cmd = f'ban {req.player} {req.reason}'
    result = await server_manager.send_privileged_command(cmd, admin=user)

    if result["success"]:
        add_moderation_action(
            player_name=req.player,
            action_type="ban",
            reason=req.reason,
            admin=user,
            server_confirmed=True,
        )

    return result


@app.post("/api/moderation/unban")
async def unban_player(
    req: ModerationRequest,
    user: str = Depends(get_current_user),
):
    cmd = f'pardon {req.player}'
    result = await server_manager.send_privileged_command(cmd, admin=user)

    if result["success"]:
        add_moderation_action(
            player_name=req.player,
            action_type="unban",
            reason=req.reason,
            admin=user,
            server_confirmed=True,
        )

    return result


@app.get("/api/moderation/history")
async def get_mod_history(
    player: str = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    user: str = Depends(get_current_user),
):
    history = get_moderation_history(player_name=player, limit=limit)
    return {"history": history}


# ══════════════════════════════════════════════════════════
# PERMISSIONS (OP & Whitelist)
# ══════════════════════════════════════════════════════════

class PermissionRequest(BaseModel):
    player: str = Field(..., min_length=1, max_length=16)


@app.post("/api/permissions/op")
async def grant_op(
    req: PermissionRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    result = await server_manager.send_privileged_command(f"op {req.player}", admin=user)
    log_audit("permission_op_grant", admin=user, resource=req.player)
    return result


@app.post("/api/permissions/deop")
async def revoke_op(
    req: PermissionRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    result = await server_manager.send_privileged_command(f"deop {req.player}", admin=user)
    log_audit("permission_op_revoke", admin=user, resource=req.player)
    return result


@app.post("/api/whitelist/add")
async def whitelist_add(
    req: PermissionRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    result = await server_manager.send_privileged_command(
        f"whitelist add {req.player}", admin=user
    )
    log_audit("whitelist_add", admin=user, resource=req.player)
    return result


@app.post("/api/whitelist/remove")
async def whitelist_remove(
    req: PermissionRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    result = await server_manager.send_privileged_command(
        f"whitelist remove {req.player}", admin=user
    )
    log_audit("whitelist_remove", admin=user, resource=req.player)
    return result


@app.get("/api/whitelist/list")
async def get_whitelist(user: str = Depends(get_current_user)):
    whitelist_file = settings.minecraft_path / "whitelist.json"
    if not whitelist_file.exists():
        return {"whitelist": []}
    try:
        with open(whitelist_file, "r") as f:
            data = json.load(f)
        return {"whitelist": data}
    except Exception:
        return {"whitelist": []}


@app.get("/api/ops/list")
async def get_ops(user: str = Depends(get_current_user)):
    ops_file = settings.minecraft_path / "ops.json"
    if not ops_file.exists():
        return {"ops": []}
    try:
        with open(ops_file, "r") as f:
            data = json.load(f)
        return {"ops": data}
    except Exception:
        return {"ops": []}


# ══════════════════════════════════════════════════════════
# PLAYER ACTIONS
# ══════════════════════════════════════════════════════════

class PlayerActionRequest(BaseModel):
    player: str = Field(..., min_length=1, max_length=16)
    value: Optional[str] = None


@app.post("/api/actions/gamemode")
async def change_gamemode(
    req: PlayerActionRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    valid_modes = ["survival", "creative", "adventure", "spectator"]
    if req.value not in valid_modes:
        return {"success": False, "error": f"Invalid game mode. Valid: {valid_modes}"}

    result = await server_manager.send_privileged_command(
        f"gamemode {req.value} {req.player}", admin=user
    )
    return result


@app.post("/api/actions/teleport")
async def teleport_player(
    player: str = Body(...),
    target: str = Body(default=None),
    x: float = Body(default=None),
    y: float = Body(default=None),
    z: float = Body(default=None),
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    if target:
        cmd = f"tp {player} {target}"
    elif x is not None and y is not None and z is not None:
        cmd = f"tp {player} {x} {y} {z}"
    else:
        return {"success": False, "error": "Provide target player or coordinates"}

    result = await server_manager.send_privileged_command(cmd, admin=user)
    return result


@app.post("/api/actions/message")
async def send_message(
    req: PlayerActionRequest,
    user: str = Depends(get_current_user),
):
    if server_manager.state != ServerState.RUNNING:
        return {"success": False, "error": "Server is not running"}

    if not req.value:
        return {"success": False, "error": "Message is required"}

    # Sanitize message
    message = req.value.replace('"', '\\"')[:256]
    result = await server_manager.send_privileged_command(
        f'msg {req.player} {message}', admin=user
    )
    return result


# ══════════════════════════════════════════════════════════
# WORLDS
# ══════════════════════════════════════════════════════════

@app.get("/api/worlds/list")
async def list_worlds(user: str = Depends(get_current_user)):
    """List world directories."""
    worlds = []

    # Read level-name from server.properties
    level_name = "world"
    props_path = settings.minecraft_path / "server.properties"
    if props_path.exists():
        try:
            with open(props_path, "r") as f:
                for line in f:
                    if line.strip().startswith("level-name="):
                        level_name = line.strip().split("=", 1)[1].strip()
                        break
        except Exception:
            pass

    for item in settings.minecraft_path.iterdir():
        if item.is_dir():
            # Check if this looks like a world directory
            level_dat = item / "level.dat"
            if level_dat.exists():
                # Calculate world size
                total_size = sum(
                    f.stat().st_size
                    for f in item.rglob("*")
                    if f.is_file()
                )
                worlds.append({
                    "name": item.name,
                    "size_bytes": total_size,
                    "size_mb": round(total_size / (1024 * 1024), 2),
                    "is_primary": item.name == level_name,
                    "has_level_dat": True,
                })

    return {"worlds": worlds, "level_name": level_name}


# ══════════════════════════════════════════════════════════
# BACKUPS
# ══════════════════════════════════════════════════════════

@app.get("/api/backups/list")
async def list_backups_endpoint(user: str = Depends(get_current_user)):
    return {"backups": backup_manager.list_backups()}


class BackupCreateRequest(BaseModel):
    worlds_only: bool = False


@app.post("/api/backups/create")
async def create_backup(
    req: BackupCreateRequest,
    user: str = Depends(get_current_user),
):
    result = await backup_manager.create_backup(
        worlds_only=req.worlds_only, admin=user
    )
    return result


class BackupRestoreRequest(BaseModel):
    filename: str


@app.post("/api/backups/restore")
async def restore_backup(
    req: BackupRestoreRequest,
    user: str = Depends(get_current_user),
):
    result = await backup_manager.restore_backup(req.filename, admin=user)
    return result


class BackupDeleteRequest(BaseModel):
    filename: str


@app.post("/api/backups/delete")
async def delete_backup(
    req: BackupDeleteRequest,
    user: str = Depends(get_current_user),
):
    result = await backup_manager.delete_backup(req.filename, admin=user)
    return result


@app.get("/api/backups/download/{filename}")
async def download_backup(
    filename: str,
    user: str = Depends(get_current_user),
):
    path = backup_manager.get_backup_path(filename)
    if not path:
        raise HTTPException(404, "Backup not found")
    return FileResponse(str(path), filename=filename)


# ══════════════════════════════════════════════════════════
# SERVER SETTINGS
# ══════════════════════════════════════════════════════════

@app.get("/api/settings/properties")
async def get_server_properties(user: str = Depends(get_current_user)):
    props_path = settings.minecraft_path / "server.properties"
    if not props_path.exists():
        return {"properties": {}, "raw": ""}

    properties = {}
    try:
        with open(props_path, "r") as f:
            raw = f.read()
            for line in raw.splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key, value = line.split("=", 1)
                        properties[key.strip()] = value.strip()
    except Exception as e:
        raise HTTPException(500, f"Error reading properties: {e}")

    # Mask sensitive values
    sensitive_keys = ["rcon.password", "server-ip"]
    for key in sensitive_keys:
        if key in properties:
            properties[key] = "***HIDDEN***"

    return {"properties": properties}


class PropertyUpdateRequest(BaseModel):
    key: str
    value: str


@app.post("/api/settings/properties")
async def update_server_property(
    req: PropertyUpdateRequest,
    user: str = Depends(get_current_user),
):
    # Validate key
    dangerous_keys = ["rcon.password", "rcon.port", "enable-rcon"]
    if req.key in dangerous_keys:
        raise HTTPException(403, "Cannot modify RCON settings through the panel")

    # Security warning for online-mode
    if req.key == "online-mode" and req.value.lower() == "false":
        return {
            "success": False,
            "warning": True,
            "error": "SECURITY WARNING: Disabling online-mode allows anyone to join with any username, including impersonating administrators. Are you sure?",
            "requires_confirmation": True,
        }

    props_path = settings.minecraft_path / "server.properties"
    if not props_path.exists():
        raise HTTPException(404, "server.properties not found")

    # Backup
    backup_path = settings.minecraft_path / f"server.properties.bak.{int(time.time())}"
    shutil.copy2(str(props_path), str(backup_path))

    try:
        lines = []
        found = False
        with open(props_path, "r") as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith(f"{req.key}="):
                    lines.append(f"{req.key}={req.value}\n")
                    found = True
                else:
                    lines.append(line)

        if not found:
            lines.append(f"{req.key}={req.value}\n")

        with open(props_path, "w") as f:
            f.writelines(lines)

        log_audit("settings_change", admin=user, resource=req.key, detail=f"→ {req.value}")

        # Determine if restart is needed
        restart_keys = [
            "server-port", "online-mode", "level-name", "level-seed",
            "view-distance", "simulation-distance", "max-players",
        ]
        needs_restart = req.key in restart_keys

        return {
            "success": True,
            "needs_restart": needs_restart,
            "message": f"Property {req.key} updated" + (
                ". Restart required for changes to take effect." if needs_restart else "."
            ),
        }
    except Exception as e:
        raise HTTPException(500, f"Error updating property: {e}")


# ══════════════════════════════════════════════════════════
# AUDIT LOGS
# ══════════════════════════════════════════════════════════

@app.get("/api/audit/logs")
async def get_audit_log_entries(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    action: str = Query(default=None),
    user: str = Depends(get_current_user),
):
    logs = get_audit_logs(limit=limit, offset=offset, action_filter=action)
    return {"logs": logs}


# ══════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════

def _get_version_info() -> dict:
    """Try to detect Minecraft and Paper version from logs or version files."""
    version = {"minecraft": "Unknown", "paper": "Unknown"}

    # Try version_history.json
    version_file = settings.minecraft_path / "version_history.json"
    if version_file.exists():
        try:
            with open(version_file, "r") as f:
                data = json.load(f)
            if "currentVersion" in data:
                version["paper"] = data["currentVersion"]
        except Exception:
            pass

    # Try to parse from recent logs
    logs = server_manager.get_logs(50)
    for line in logs:
        # Paper startup: "Starting minecraft server version X.X.X"
        match = re.search(r"Starting minecraft server version ([\d.]+)", line)
        if match:
            version["minecraft"] = match.group(1)
            break

    return version


# ══════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        log_level="info",
        reload=False,
    )
